#!/usr/bin/env python3
"""
持仓数据实时更新脚本
- 读取 holdings.json
- 获取股票实时价格（新浪）
- 获取基金净值（天天基金）
- 更新 holdings.json
- 提交到GitHub
"""
import requests
import json
import subprocess
import re
from datetime import datetime
from typing import Dict, Optional
import sys
import os

# 添加 portfolio-tracker 到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_service import StockDataService

DATA_FILE = "data/holdings.json"

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
            'nav': float(data['dwjz']),
            'nav_date': data['jzrq'],
            'estimate': float(data['gsz']) if data.get('gsz') else None,
            'estimate_change': float(data['gszzl']) if data.get('gszzl') else None,
        }
    except Exception as e:
        print(f"[Fund Error] {code}: {e}")
        return None

def update_portfolio():
    """更新持仓数据"""
    print(f"[{datetime.now()}] 开始更新持仓数据...")
    
    # 读取现有数据
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    service = StockDataService()
    account = data['accounts'][0]
    
    total_value = 0
    total_cost = 0
    
    # 更新股票
    print("\n📈 更新股票...")
    for stock in account['stocks']:
        code = stock['code']
        name = stock['name']
        
        # 获取实时价格
        market_data = service.fetch_sina(code)
        if market_data:
            stock['price'] = market_data['price']
            stock['dailyChange'] = round((market_data['price'] - market_data['close']) / market_data['close'] * 100, 2)
            stock['marketValue'] = round(stock['shares'] * stock['price'], 2)
            stock['totalPnL'] = round(stock['marketValue'] - stock['shares'] * stock['cost'], 2)
            stock['returnRate'] = round(stock['totalPnL'] / (stock['shares'] * stock['cost']) * 100, 2)
            total_value += stock['marketValue']
            total_cost += stock['shares'] * stock['cost']
            print(f"  ✓ {name}({code}): ¥{stock['price']} | 今日{stock['dailyChange']}%")
        else:
            print(f"  ✗ {name}({code}): 获取失败")
            total_value += stock['marketValue']
    
    # 更新基金
    print("\n📊 更新基金...")
    for fund in account['funds']:
        code = fund['code']
        name = fund['name']
        
        if code == 'YEB':  # 余额宝跳过
            total_value += fund['marketValue']
            continue
            
        # 获取基金净值
        fund_data = fetch_fund_nav(code)
        if fund_data:
            old_nav = fund['nav']
            fund['nav'] = fund_data['nav']
            fund['dailyChange'] = fund_data.get('estimate_change', 0)
            # 基金marketValue根据净值变化比例调整
            if old_nav > 0:
                nav_change_pct = (fund['nav'] - old_nav) / old_nav
                fund['marketValue'] = round(fund['marketValue'] * (1 + nav_change_pct), 2)
            # 更新收益
            fund['totalPnL'] = round(fund['marketValue'] - fund.get('cost', fund['marketValue']), 2)
            fund['returnRate'] = round(fund['totalPnL'] / fund.get('cost', fund['marketValue']) * 100, 2) if fund.get('cost', 0) > 0 else 0
            total_value += fund['marketValue']
            print(f"  ✓ {name}({code}): ¥{fund['nav']} | 估算{fund['dailyChange']}%")
        else:
            print(f"  ✗ {name}({code}): 获取失败")
            total_value += fund['marketValue']
    
    # 更新汇总
    data['summary']['totalAssets'] = round(total_value, 2)
    data['summary']['stockValue'] = round(sum(s['marketValue'] for s in account['stocks']), 2)
    data['summary']['fundValue'] = round(sum(f['marketValue'] for f in account['funds']), 2)
    data['summary']['lastUpdate'] = datetime.now().isoformat()
    
    # 保存数据
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n💰 总资产: ¥{data['summary']['totalAssets']:,.2f}")
    print(f"📅 更新时间: {data['summary']['lastUpdate']}")
    print(f"\n✅ 数据已保存到 {DATA_FILE}")
    
    return data

def push_to_github():
    """推送到GitHub"""
    print("\n📤 推送到GitHub...")
    try:
        # 添加文件
        subprocess.run(['git', 'add', 'data/holdings.json'], check=True)
        
        # 提交
        result = subprocess.run(
            ['git', 'commit', '-m', f'Update holdings data: {datetime.now().strftime("%Y-%m-%d %H:%M")}'],
            capture_output=True, text=True
        )
        if 'nothing to commit' in result.stdout:
            print("  无变更需要提交")
            return False
            
        # 推送
        subprocess.run(['git', 'push', 'origin', 'main'], check=True)
        
        # 验证
        import time
        time.sleep(2)
        resp = requests.get('https://raw.githubusercontent.com/moxi87/portfolio-tracker/main/data/holdings.json', timeout=10)
        if resp.status_code == 200:
            remote_data = resp.json()
            if remote_data.get('summary', {}).get('lastUpdate', '').startswith(datetime.now().strftime('%Y-%m-%d')):
                print("  ✅ GitHub推送验证成功")
                return True
        
        print("  ⚠️ 推送成功但验证失败")
        return False
        
    except Exception as e:
        print(f"  ❌ GitHub推送失败: {e}")
        return False

if __name__ == "__main__":
    # 更新数据
    data = update_portfolio()
    
    # 推送到GitHub
    push_to_github()
    
    print("\n🎉 更新完成!")
