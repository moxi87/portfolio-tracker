#!/usr/bin/env python3
"""
Portfolio Pro 数据服务
实时获取股票数据，多源交叉验证
"""
import requests
import json
import time
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import threading
import os

class StockDataService:
    """股票数据服务 - 多源聚合"""
    
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 5  # 5秒缓存
        self.last_update = {}
        
    def fetch_sina(self, code: str) -> Optional[Dict]:
        """从新浪财经获取数据"""
        try:
            # 判断市场
            prefix = 'sh' if code.startswith('6') else 'sz'
            url = f'https://hq.sinajs.cn/list={prefix}{code}'
            
            headers = {
                'Referer': 'https://finance.sina.com.cn',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            resp = requests.get(url, headers=headers, timeout=5)
            resp.encoding = 'gb2312'
            
            # 解析数据
            match = re.search(r'"([^"]+)"', resp.text)
            if not match:
                return None
                
            data = match.group(1).split(',')
            if len(data) < 30:
                return None
                
            return {
                'name': data[0],
                'open': float(data[1]),
                'close': float(data[2]),  # 昨日收盘
                'price': float(data[3]),  # 当前价格
                'high': float(data[4]),
                'low': float(data[5]),
                'volume': int(data[8]),
                'turnover': float(data[9]),
                'bid1': float(data[11]),
                'ask1': float(data[21]),
                'updateTime': f"{data[30]} {data[31]}",
                'source': 'sina',
                'timestamp': time.time()
            }
        except Exception as e:
            print(f"[Sina Error] {code}: {e}")
            return None
    
    def fetch_tencent(self, code: str) -> Optional[Dict]:
        """从腾讯财经获取数据"""
        try:
            prefix = 'sh' if code.startswith('6') else 'sz'
            url = f'https://qt.gtimg.cn/q={prefix}{code}'
            
            resp = requests.get(url, timeout=5)
            resp.encoding = 'gb2312'
            
            # 解析数据
            match = re.search(r'v_sh\d+="([^"]+)"', resp.text) or re.search(r'v_sz\d+="([^"]+)"', resp.text)
            if not match:
                return None
                
            data = match.group(1).split('~')
            if len(data) < 40:
                return None
                
            return {
                'name': data[1],
                'price': float(data[3]),
                'close': float(data[4]),  # 昨日收盘
                'open': float(data[5]),
                'volume': int(data[6]),
                'high': float(data[33]),
                'low': float(data[34]),
                'change': float(data[4]) - float(data[3]),  # 涨跌额
                'changePercent': float(data[32]),  # 涨跌幅%
                'pe': float(data[39]) if data[39] else None,
                'pb': float(data[46]) if data[46] else None,
                'marketCap': float(data[44]) if data[44] else None,  # 市值
                'source': 'tencent',
                'timestamp': time.time()
            }
        except Exception as e:
            print(f"[Tencent Error] {code}: {e}")
            return None
    
    def cross_validate(self, sina_data: Dict, tencent_data: Dict) -> Dict:
        """交叉验证两个数据源"""
        if not sina_data and not tencent_data:
            return None
        
        if not sina_data:
            return {**tencent_data, 'crossValidated': False, 'validationNote': '仅腾讯数据源'}
        
        if not tencent_data:
            return {**sina_data, 'crossValidated': False, 'validationNote': '仅新浪数据源'}
        
        # 价格差异检查
        price_diff = abs(sina_data['price'] - tencent_data['price']) / sina_data['price'] * 100
        
        result = {
            'name': sina_data['name'],
            'price': (sina_data['price'] + tencent_data['price']) / 2,
            'open': sina_data.get('open', tencent_data.get('open')),
            'high': max(sina_data.get('high', 0), tencent_data.get('high', 0)),
            'low': min(sina_data.get('low', 999999), tencent_data.get('low', 999999)),
            'close': sina_data.get('close', tencent_data.get('close')),
            'volume': max(sina_data.get('volume', 0), tencent_data.get('volume', 0)),
            'bid1': sina_data.get('bid1'),
            'ask1': sina_data.get('ask1'),
            'pe': tencent_data.get('pe'),
            'pb': tencent_data.get('pb'),
            'marketCap': tencent_data.get('marketCap'),
            'updateTime': sina_data.get('updateTime'),
            'source': 'cross_validated',
            'crossValidated': True,
            'validationDiff': round(price_diff, 4),
            'timestamp': time.time()
        }
        
        # 如果差异过大，标记警告
        if price_diff > 1.0:
            result['warning'] = f'数据源价格差异{price_diff:.2f}%，请检查'
        
        return result
    
    def get_stock_data(self, code: str, use_cache: bool = True) -> Optional[Dict]:
        """获取股票数据（带缓存）"""
        # 检查缓存
        if use_cache and code in self.cache:
            cached = self.cache[code]
            if time.time() - cached.get('timestamp', 0) < self.cache_ttl:
                return cached
        
        # 获取新数据
        sina_data = self.fetch_sina(code)
        time.sleep(0.1)  # 避免请求过快
        tencent_data = self.fetch_tencent(code)
        
        # 交叉验证
        result = self.cross_validate(sina_data, tencent_data)
        
        if result:
            self.cache[code] = result
            self.last_update[code] = datetime.now()
        
        return result
    
    def get_batch_data(self, codes: List[str]) -> Dict[str, Dict]:
        """批量获取股票数据"""
        results = {}
        for code in codes:
            data = self.get_stock_data(code)
            if data:
                results[code] = data
            time.sleep(0.2)  # 限流
        return results


class PortfolioCalculator:
    """持仓计算器"""
    
    def __init__(self, data_service: StockDataService):
        self.data_service = data_service
        self.holdings_file = 'holdings.json'
        
    def load_holdings(self) -> List[Dict]:
        """加载持仓数据（写死的真实持仓）"""
        if os.path.exists(self.holdings_file):
            with open(self.holdings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        
        # 默认持仓（用户真实持仓）
        default_holdings = [
            {
                "code": "002594",
                "name": "比亚迪",
                "shares": 2100,
                "cost": 104.80,
                "addedDate": "2025-06-15"
            },
            {
                "code": "603019",
                "name": "中科曙光",
                "shares": 100,
                "cost": 165.43,
                "addedDate": "2025-08-20"
            },
            {
                "code": "603993",
                "name": "洛阳钼业",
                "shares": 300,
                "cost": -20.48,
                "addedDate": "2025-09-10"
            }
        ]
        
        self.save_holdings(default_holdings)
        return default_holdings
    
    def save_holdings(self, holdings: List[Dict]):
        """保存持仓数据"""
        with open(self.holdings_file, 'w', encoding='utf-8') as f:
            json.dump(holdings, f, ensure_ascii=False, indent=2)
    
    def calculate_portfolio(self) -> Dict:
        """计算持仓组合"""
        holdings = self.load_holdings()
        codes = [h['code'] for h in holdings]
        
        # 获取实时数据
        stock_data = self.data_service.get_batch_data(codes)
        
        total_value = 0
        total_cost = 0
        daily_pnl = 0
        
        enriched_holdings = []
        
        for holding in holdings:
            code = holding['code']
            data = stock_data.get(code, {})
            
            if not data:
                continue
            
            price = data.get('price', 0)
            prev_close = data.get('close', price)
            shares = holding['shares']
            cost = holding['cost']
            
            market_value = price * shares
            cost_value = cost * shares if cost > 0 else 0
            pnl = market_value - cost_value
            pnl_percent = (pnl / cost_value * 100) if cost_value > 0 else 0
            
            daily_change = (price - prev_close) * shares
            daily_pnl += daily_change
            
            total_value += market_value
            total_cost += cost_value
            
            enriched_holdings.append({
                **holding,
                'price': price,
                'prevClose': prev_close,
                'marketValue': market_value,
                'pnl': pnl,
                'pnlPercent': pnl_percent,
                'dailyChange': daily_change,
                'dataSource': data.get('source'),
                'crossValidated': data.get('crossValidated', False),
                'updateTime': data.get('updateTime')
            })
        
        total_pnl = total_value - total_cost
        
        return {
            'holdings': enriched_holdings,
            'summary': {
                'totalValue': total_value,
                'totalCost': total_cost,
                'totalPnL': total_pnl,
                'totalPnLPercent': (total_pnl / total_cost * 100) if total_cost > 0 else 0,
                'dailyPnL': daily_pnl,
                'holdingCount': len(enriched_holdings),
                'updateTime': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'dataValidated': all(h.get('crossValidated') for h in enriched_holdings)
            }
        }


if __name__ == '__main__':
    # 测试
    service = StockDataService()
    calculator = PortfolioCalculator(service)
    
    print("=" * 50)
    print("Portfolio Pro 数据服务测试")
    print("=" * 50)
    
    # 测试单只股票
    print("\n1. 测试单只股票获取 (比亚迪 002594):")
    data = service.get_stock_data('002594')
    if data:
        print(f"   名称: {data['name']}")
        print(f"   价格: ¥{data['price']:.2f}")
        print(f"   数据源: {data['source']}")
        print(f"   交叉验证: {'✓' if data.get('crossValidated') else '✗'}")
        if data.get('validationDiff'):
            print(f"   验证差异: {data['validationDiff']:.4f}%")
    
    # 测试持仓计算
    print("\n2. 测试持仓组合计算:")
    portfolio = calculator.calculate_portfolio()
    summary = portfolio['summary']
    
    print(f"   总资产: ¥{summary['totalValue']:,.2f}")
    print(f"   今日盈亏: ¥{summary['dailyPnL']:,.2f}")
    print(f"   累计盈亏: ¥{summary['totalPnL']:,.2f} ({summary['totalPnLPercent']:.2f}%)")
    print(f"   数据验证状态: {'✓ 已交叉验证' if summary['dataValidated'] else '✗ 未完全验证'}")
    
    print("\n3. 持仓明细:")
    for h in portfolio['holdings']:
        status = "✓" if h.get('crossValidated') else "?"
        print(f"   {status} {h['name']} ({h['code']}): {h['shares']}股 @ ¥{h['price']:.2f} = ¥{h['marketValue']:,.0f}")
