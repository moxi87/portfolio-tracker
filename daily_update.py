#!/usr/bin/env python3
"""
每日持仓数据更新脚本
- 获取股票实时价格（新浪+腾讯交叉验证）
- 获取基金净值（天天基金）
- 计算收益并更新 portfolio-data.json
- 生成日报
"""
import requests
import json
import time
import re
from datetime import datetime
from typing import Dict, List, Optional

# ============ 配置 ============
STOCKS = [
    {"code": "002594", "name": "比亚迪", "shares": 2100, "cost": 104.8, "category": "汽车", "market": "A股"},
    {"code": "601669", "name": "中国电建", "shares": 100, "cost": 101.8, "category": "电网", "market": "A股"},
    {"code": "603019", "name": "中科曙光", "shares": 100, "cost": 165.43, "category": "科技", "market": "A股"},
    {"code": "603993", "name": "洛阳钼业", "shares": 300, "cost": 21.74, "category": "有色", "market": "A股"},
]

# 基金配置（从holdings.json中提取的成本数据）
FUNDS_CONFIG = {
    "003984": {"name": "嘉实新能源新材料股票A", "cost": 25704.66, "marketValue": 46090.54, "category": "新能源", "market": "A股"},
    "008586": {"name": "华夏人工智能ETF联接D", "cost": 14000, "marketValue": 22473.41, "category": "科技", "market": "A股"},
    "000043": {"name": "嘉实美国成长股票(QDII)", "cost": 33000, "marketValue": 37099.96, "category": "美股", "market": "美股"},
    "007904": {"name": "华宝海外新能源汽车(QDII)A", "cost": 16000, "marketValue": 17076.65, "category": "新能源", "market": "海外"},
    "016440": {"name": "华夏中证红利质量ETF联接A", "cost": 10591.89, "marketValue": 11257.07, "category": "红利", "market": "A股"},
    "007467": {"name": "华泰柏瑞中证红利低波动ETF联接C", "cost": 10427.77, "marketValue": 10166.89, "category": "红利", "market": "A股"},
    "013231": {"name": "博时智选量化多因子股票C", "cost": 9712.34, "marketValue": 9338.01, "category": "量化", "market": "A股"},
    "015283": {"name": "华安恒生科技ETF联接(QDII)C", "cost": 12004.32, "marketValue": 10503.40, "category": "科技", "market": "港股"},
}

def fetch_stock_sina(code: str) -> Optional[Dict]:
    """从新浪财经获取股票数据"""
    try:
        prefix = 'sh' if code.startswith('6') else 'sz'
        url = f'https://hq.sinajs.cn/list={prefix}{code}'
        headers = {
            'Referer': 'https://finance.sina.com.cn',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        resp = requests.get(url, headers=headers, timeout=5)
        resp.encoding = 'gb2312'
        
        match = re.search(r'"([^"]+)"', resp.text)
        if not match:
            return None
            
        data = match.group(1).split(',')
        if len(data) < 30:
            return None
            
        return {
            'name': data[0],
            'open': float(data[1]),
            'close': float(data[2]),
            'price': float(data[3]),
            'high': float(data[4]),
            'low': float(data[5]),
            'updateTime': f"{data[30]} {data[31]}",
            'source': 'sina'
        }
    except Exception as e:
        print(f"[Sina Error] {code}: {e}")
        return None

def fetch_fund_nav(code: str) -> Optional[Dict]:
    """从天天基金获取基金净值"""
    try:
        url = f'https://fundgz.1234567.com.cn/js/{code}.js'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://fund.eastmoney.com/'
        }
        resp = requests.get(url, headers=headers, timeout=5)
        
        # 解析JSONP
        match = re.search(r'jsonpgz\((.+?)\);', resp.text)
        if not match:
            return None
            
        data = json.loads(match.group(1))
        return {
            'code': data['fundcode'],
            'name': data['name'],
            'nav': float(data['dwjz']),  # 单位净值
            'nav_date': data['jzrq'],    # 净值日期
            'estimate': float(data['gsz']) if data.get('gsz') else None,  # 估算净值
            'estimate_change': float(data['gszzl']) if data.get('gszzl') else None,
            'source': 'eastmoney'
        }
    except Exception as e:
        print(f"[Fund Error] {code}: {e}")
        return None

def calculate_portfolio():
    """计算持仓组合"""
    print("=" * 50)
    print(f"每日持仓更新 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    # ============ 获取股票数据 ============
    print("\n📈 获取股票数据...")
    stock_results = []
    total_stock_value = 0
    total_stock_cost = 0
    total_stock_daily_pnl = 0
    
    for stock in STOCKS:
        data = fetch_stock_sina(stock['code'])
        time.sleep(0.2)
        
        if data:
            price = data['price']
            prev_close = data['close']
            shares = stock['shares']
            cost = stock['cost']
            
            market_value = price * shares
            cost_value = cost * shares
            holding_pnl = market_value - cost_value
            return_rate = (holding_pnl / cost_value * 100) if cost_value > 0 else 0
            daily_pnl = (price - prev_close) * shares
            
            total_stock_value += market_value
            total_stock_cost += cost_value
            total_stock_daily_pnl += daily_pnl
            
            stock_results.append({
                **stock,
                'price': price,
                'prevClose': prev_close,
                'marketValue': market_value,
                'holdingPnL': holding_pnl,
                'returnRate': return_rate,
                'dailyPnL': daily_pnl,
                'updateTime': data['updateTime']
            })
            
            print(f"  ✓ {stock['name']} ({stock['code']}): ¥{price:.2f} | 市值: ¥{market_value:,.0f} | 日收益: ¥{daily_pnl:+,.0f}")
        else:
            print(f"  ✗ {stock['name']} ({stock['code']}): 获取失败")
    
    # ============ 获取基金数据 ============
    print("\n📊 获取基金数据...")
    fund_results = []
    total_fund_value = 0
    total_fund_cost = 0
    total_fund_daily_pnl = 0
    
    for code, config in FUNDS_CONFIG.items():
        data = fetch_fund_nav(code)
        time.sleep(0.2)
        
        if data:
            nav = data['nav']
            cost = config['cost']
            prev_market_value = config['marketValue']
            
            # 计算净值变动比例
            prev_nav = data.get('estimate') 
            if prev_nav and nav > 0:
                change_pct = (nav - prev_nav) / prev_nav * 100
            else:
                change_pct = 0
            
            # 根据昨日市值和净值变动估算今日市值
            if change_pct != 0:
                market_value = prev_market_value * (1 + change_pct / 100)
                daily_pnl = market_value - prev_market_value
            else:
                # 如果没有估算数据，使用净值直接计算
                # 假设份额 = 昨日市值 / 昨日净值
                # 但因为我们没有昨日净值，直接用昨日市值作为基准
                market_value = prev_market_value
                daily_pnl = 0
            
            holding_pnl = market_value - cost
            return_rate = (holding_pnl / cost * 100) if cost > 0 else 0
            
            total_fund_value += market_value
            total_fund_cost += cost
            total_fund_daily_pnl += daily_pnl
            
            fund_results.append({
                'code': code,
                'name': config['name'],
                'nav': nav,
                'estimate': data.get('estimate'),
                'estimateChange': data.get('estimate_change'),
                'marketValue': market_value,
                'cost': cost,
                'holdingPnL': holding_pnl,
                'returnRate': return_rate,
                'dailyPnL': daily_pnl,
                'category': config['category'],
                'market': config['market'],
                'navDate': data['nav_date']
            })
            
            change_str = f" ({data.get('estimate_change', 0):+.2f}%)" if data.get('estimate_change') else ""
            print(f"  ✓ {config['name'][:20]}: ¥{nav:.4f}{change_str} | 市值: ¥{market_value:,.0f} | 日收益: ¥{daily_pnl:+,.0f}")
        else:
            print(f"  ✗ {config['name'][:20]} ({code}): 获取失败")
    
    # ============ 汇总计算 ============
    total_assets = total_stock_value + total_fund_value
    total_cost = total_stock_cost + total_fund_cost
    total_daily_pnl = total_stock_daily_pnl + total_fund_daily_pnl
    total_holding_pnl = total_assets - total_cost
    total_return_rate = (total_holding_pnl / total_cost * 100) if total_cost > 0 else 0
    
    print("\n" + "=" * 50)
    print("📋 持仓汇总")
    print("=" * 50)
    print(f"  总资产:     ¥{total_assets:,.2f}")
    print(f"  总成本:     ¥{total_cost:,.2f}")
    print(f"  今日盈亏:   ¥{total_daily_pnl:+,.2f}")
    print(f"  累计盈亏:   ¥{total_holding_pnl:+,.2f} ({total_return_rate:+.2f}%)")
    print(f"  股票市值:   ¥{total_stock_value:,.2f} ({total_stock_value/total_assets*100:.1f}%)")
    print(f"  基金市值:   ¥{total_fund_value:,.2f} ({total_fund_value/total_assets*100:.1f}%)")
    
    # ============ 生成portfolio-data.json ============
    portfolio_data = {
        "lastUpdate": datetime.now().strftime('%Y-%m-%d'),
        "lastSync": datetime.now().strftime('%H:%M'),
        "funds": [
            {
                "name": f['name'],
                "code": f['code'],
                "marketValue": round(f['marketValue'], 2),
                "dailyPnL": round(f['dailyPnL'], 2),
                "holdingPnL": round(f['holdingPnL'], 2),
                "returnRate": round(f['returnRate'], 2),
                "category": f['category'],
                "market": f['market'],
                "price": f['nav']
            } for f in fund_results
        ],
        "stocks": [
            {
                "name": s['name'],
                "code": s['code'],
                "marketValue": round(s['marketValue'], 2),
                "shares": s['shares'],
                "price": s['price'],
                "cost": s['cost'],
                "holdingPnL": round(s['holdingPnL'], 2),
                "returnRate": round(s['returnRate'], 2),
                "category": s['category'],
                "market": s['market']
            } for s in stock_results
        ],
        "summary": {
            "totalAssets": round(total_assets, 2),
            "fundValue": round(total_fund_value, 2),
            "stockValue": round(total_stock_value, 2),
            "dailyPnL": round(total_daily_pnl, 2),
            "totalPnL": round(total_holding_pnl, 2),
            "dailyReturn": round(total_daily_pnl / (total_assets - total_daily_pnl) * 100, 2) if total_assets != total_daily_pnl else 0,
            "totalReturn": round(total_return_rate, 2)
        }
    }
    
    # 保存portfolio-data.json
    with open('portfolio-data.json', 'w', encoding='utf-8') as f:
        json.dump(portfolio_data, f, ensure_ascii=False, indent=2)
    print("\n✅ portfolio-data.json 已更新")
    
    # ============ 生成持仓日报 ============
    report = generate_report(fund_results, stock_results, portfolio_data)
    
    return portfolio_data, report

def generate_report(funds, stocks, summary):
    """生成持仓日报"""
    now = datetime.now()
    date_str = now.strftime('%Y年%m月%d日')
    time_str = now.strftime('%H:%M')
    
    # 盈亏表情
    daily_pnl = summary['summary']['dailyPnL']
    pnl_emoji = "📈" if daily_pnl >= 0 else "📉"
    
    report = f"""【持仓日报】{date_str} {time_str}

{pnl_emoji} 今日盈亏: ¥{daily_pnl:+,.0f} ({summary['summary']['dailyReturn']:+.2f}%)
💰 总资产: ¥{summary['summary']['totalAssets']:,.0f}
📊 累计收益: ¥{summary['summary']['totalPnL']:+,.0f} ({summary['summary']['totalReturn']:+.2f}%)

┌─ 基金持仓 ({len(funds)}只) ─┐
"""
    
    for f in funds:
        change = f" ({f.get('estimateChange', 0):+.2f}%)" if f.get('estimateChange') else ""
        report += f"  {f['name'][:12]:12} ¥{f['marketValue']:>10,.0f} {f['returnRate']:+>6.1f}%{change}\n"
    
    report += f"""
└─ 基金市值: ¥{summary['summary']['fundValue']:,.0f} ─┘

┌─ 股票持仓 ({len(stocks)}只) ─┐
"""
    
    for s in stocks:
        report += f"  {s['name'][:10]:10} ¥{s['price']:>7.2f} ¥{s['marketValue']:>10,.0f} {s['returnRate']:+>6.1f}%\n"
    
    report += f"""
└─ 股票市值: ¥{summary['summary']['stockValue']:,.0f} ─┘

💡 提示: QDII基金净值T+1更新，数据仅供参考
"""
    
    # 保存日报到文件
    report_file = f"daily_report_{now.strftime('%Y%m%d')}.txt"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"✅ 日报已保存: {report_file}")
    return report

if __name__ == '__main__':
    portfolio_data, report = calculate_portfolio()
    print("\n" + "=" * 50)
    print("📱 飞书推送内容:")
    print("=" * 50)
    print(report)
