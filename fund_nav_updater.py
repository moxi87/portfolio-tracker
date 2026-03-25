#!/usr/bin/env python3
"""
基金净值自动更新模块
支持：天天基金网、新浪财经数据源
"""
import requests
import json
import time
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class FundInfo:
    """基金信息"""
    code: str
    name: str
    nav: float  # 单位净值
    acc_nav: float  # 累计净值
    date: str  # 净值日期
    daily_change: float  # 日涨跌幅
    source: str

class FundDataFetcher:
    """基金数据获取器"""
    
    def __init__(self):
        self.cache = {}
        self.cache_ttl = 3600  # 1小时缓存（基金一天更新一次）
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def fetch_from_eastmoney(self, fund_code: str) -> Optional[FundInfo]:
        """从东方财富获取基金净值"""
        try:
            # 天天基金网API
            url = f'http://fundgz.1234567.com.cn/js/{fund_code}.js'
            
            resp = self.session.get(url, timeout=10)
            resp.encoding = 'utf-8'
            
            # 解析JSONP
            match = re.search(r'jsonpgz\((.+?)\);', resp.text)
            if not match:
                return None
            
            data = json.loads(match.group(1))
            
            # 解析涨跌幅（包含%号）
            gszzl = data.get('gszzl', '0')
            daily_change = float(gszzl) if gszzl else 0.0
            
            return FundInfo(
                code=fund_code,
                name=data.get('name', ''),
                nav=float(data.get('dwjz', 0)),
                acc_nav=float(data.get('ljjz', 0)),
                date=data.get('jzrq', ''),
                daily_change=daily_change,
                source='eastmoney'
            )
        except Exception as e:
            print(f"[EastMoney Error] {fund_code}: {e}")
            return None
    
    def fetch_from_sina(self, fund_code: str) -> Optional[FundInfo]:
        """从新浪获取基金净值（备用源）"""
        try:
            # 新浪基金API
            url = f'https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/CaihuiFundInfoService.getFundInfo?symbol={fund_code}'
            
            resp = self.session.get(url, timeout=10)
            data = resp.json()
            
            result = data.get('result', {}).get('data', {})
            if not result:
                return None
            
            return FundInfo(
                code=fund_code,
                name=result.get('name', ''),
                nav=float(result.get('net', 0)),
                acc_nav=float(result.get('net_accumulated', 0)),
                date=result.get('net_date', ''),
                daily_change=float(result.get('day_growth', 0)),
                source='sina'
            )
        except Exception as e:
            print(f"[Sina Fund Error] {fund_code}: {e}")
            return None
    
    def get_fund_data(self, fund_code: str, use_cache: bool = True) -> Optional[FundInfo]:
        """获取基金数据（带缓存和降级）"""
        # 检查缓存
        if use_cache and fund_code in self.cache:
            cached = self.cache[fund_code]
            if time.time() - cached.get('_timestamp', 0) < self.cache_ttl:
                return cached.get('_data')
        
        # 主源：东方财富
        result = self.fetch_from_eastmoney(fund_code)
        
        # 降级：新浪
        if not result:
            result = self.fetch_from_sina(fund_code)
        
        if result:
            self.cache[fund_code] = {
                '_data': result,
                '_timestamp': time.time()
            }
        
        return result
    
    def get_batch_fund_data(self, fund_codes: List[str]) -> Dict[str, FundInfo]:
        """批量获取基金数据"""
        results = {}
        for code in fund_codes:
            fund = self.get_fund_data(code)
            if fund:
                results[code] = fund
            time.sleep(0.3)  # 限流保护
        return results


class FundPortfolioUpdater:
    """基金持仓更新器"""
    
    def __init__(self, holdings_file: str):
        self.holdings_file = holdings_file
        self.fetcher = FundDataFetcher()
        self.data = self._load_holdings()
    
    def _load_holdings(self) -> Dict:
        """加载持仓数据"""
        try:
            with open(self.holdings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Error] 加载持仓文件失败: {e}")
            return {}
    
    def _save_holdings(self):
        """保存持仓数据"""
        try:
            with open(self.holdings_file, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"[Error] 保存持仓文件失败: {e}")
            return False
    
    def extract_fund_codes(self) -> List[str]:
        """提取所有基金代码"""
        funds = []
        accounts = self.data.get('accounts', [])
        for account in accounts:
            for fund in account.get('funds', []):
                code = fund.get('code', '')
                if code and len(code) == 6 and code.isdigit():
                    funds.append(code)
        return funds
    
    def update_fund_nav(self) -> Dict:
        """更新基金净值"""
        fund_codes = self.extract_fund_codes()
        print(f"发现 {len(fund_codes)} 只基金需要更新")
        
        # 批量获取净值
        fund_data = self.fetcher.get_batch_fund_data(fund_codes)
        
        updated_count = 0
        failed_codes = []
        
        # 更新持仓数据
        accounts = self.data.get('accounts', [])
        for account in accounts:
            for fund in account.get('funds', []):
                code = fund.get('code', '')
                if code in fund_data:
                    info = fund_data[code]
                    old_nav = fund.get('nav', 0)
                    
                    # 更新净值和日涨跌
                    fund['nav'] = info.nav
                    fund['dailyChange'] = info.daily_change
                    
                    # 获取原始市值（shares=1是占位符，不能用于计算）
                    old_market_value = fund.get('marketValue', 0)
                    
                    # 如果原nav有效，按比例更新市值；否则保持不变
                    if old_nav and old_nav > 0:
                        # 市值 = 原市值 × (新净值 / 旧净值)
                        new_market_value = old_market_value * (info.nav / old_nav)
                        fund['marketValue'] = round(new_market_value, 2)
                    
                    # 重新计算收益
                    cost = fund.get('cost', 0)
                    if cost > 0:
                        fund['totalPnL'] = round(fund['marketValue'] - cost, 2)
                        fund['returnRate'] = round((fund['marketValue'] - cost) / cost * 100, 2)
                    
                    # 计算今日盈亏
                    if old_nav and old_nav > 0:
                        fund['dailyPnL'] = round(old_market_value * (info.daily_change / 100), 2)
                    
                    updated_count += 1
                    print(f"✓ {code} {info.name}: NAV {old_nav} → {info.nav} ({info.daily_change:+.2f}%)")
                elif code in fund_codes:
                    failed_codes.append(code)
        
        # 更新元数据
        self.data['lastUpdate'] = datetime.now().isoformat()
        self.data['version'] = datetime.now().strftime('%Y-%m-%d')
        
        # 保存
        if self._save_holdings():
            print(f"\n✅ 更新完成: {updated_count}/{len(fund_codes)} 只基金")
            if failed_codes:
                print(f"⚠️ 失败: {failed_codes}")
            return {
                'success': True,
                'updated': updated_count,
                'failed': failed_codes,
                'total': len(fund_codes)
            }
        else:
            return {'success': False, 'error': '保存失败'}


def main():
    """主函数"""
    import sys
    
    holdings_file = '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
    
    print("=" * 50)
    print("基金净值自动更新")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    updater = FundPortfolioUpdater(holdings_file)
    result = updater.update_fund_nav()
    
    if result.get('success'):
        print("\n更新成功!")
        sys.exit(0)
    else:
        print(f"\n更新失败: {result.get('error')}")
        sys.exit(1)


if __name__ == '__main__':
    main()
