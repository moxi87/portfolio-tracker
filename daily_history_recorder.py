#!/usr/bin/env python3
"""
每日收益记录器 - 自动记录每日资产数据到 history.json
用于生成收益走势图表

Usage:
    python3 daily_history_recorder.py           # 记录今天的数据
    python3 daily_history_recorder.py --sync    # 从 holdings.json 同步历史
    python3 daily_history_recorder.py --show    # 显示当前历史记录
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# 路径配置
DATA_DIR = Path("/root/.openclaw/workspace/portfolio-tracker/data")
HISTORY_FILE = DATA_DIR / "history.json"
HOLDINGS_FILE = DATA_DIR / "holdings.json"

def load_json(filepath):
    """安全加载JSON文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ 无法加载 {filepath}: {e}")
        return None

def save_json(filepath, data):
    """保存JSON文件"""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"❌ 无法保存 {filepath}: {e}")
        return False

def get_current_portfolio_data():
    """从 holdings.json 获取当前数据（主数据源）"""
    data = load_json(HOLDINGS_FILE)
    if data and 'summary' in data:
        summary = data['summary']
        return {
            'totalAssets': summary.get('totalAssets', 0),
            'dailyPnL': summary.get('dailyPnL', 0),
            'totalPnL': summary.get('totalPnL', 0)
        }
    return None

def load_history():
    """加载历史记录"""
    if not HISTORY_FILE.exists():
        return {"records": []}
    
    data = load_json(HISTORY_FILE)
    if data and 'records' in data:
        return data
    return {"records": []}

def save_history(records):
    """保存历史记录"""
    data = {"records": records}
    return save_json(HISTORY_FILE, data)

def is_trading_day(date_str):
    """简单判断是否为交易日（排除周末）"""
    date = datetime.strptime(date_str, '%Y-%m-%d')
    return date.weekday() < 5  # 周一到周五

def record_today():
    """记录今天的数据"""
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 获取当前投资组合数据
    portfolio = get_current_portfolio_data()
    if not portfolio:
        print("❌ 无法获取当前投资组合数据")
        print(f"   请确认 {HOLDINGS_FILE} 存在且格式正确")
        return False
    
    # 加载现有历史记录
    history = load_history()
    records = history.get('records', [])
    
    # 检查今天是否已记录
    for record in records:
        if record['date'] == today:
            print(f"⚠️ 今天 ({today}) 已有记录，将更新")
            record['totalAssets'] = portfolio['totalAssets']
            record['dailyPnL'] = portfolio['dailyPnL']
            break
    else:
        # 添加新记录
        records.append({
            'date': today,
            'totalAssets': portfolio['totalAssets'],
            'dailyPnL': portfolio['dailyPnL']
        })
        print(f"✅ 已添加今天 ({today}) 的记录")
    
    # 按日期排序
    records.sort(key=lambda x: x['date'])
    
    # 保存
    if save_history(records):
        print(f"📊 总资产: ¥{portfolio['totalAssets']:,.2f}")
        print(f"📈 今日盈亏: ¥{portfolio['dailyPnL']:+,.2f}")
        print(f"💾 已保存到 {HISTORY_FILE}")
        return True
    return False

def sync_from_holdings_history():
    """从 holdings.json 的 history 字段同步历史数据"""
    holdings = load_json(HOLDINGS_FILE)
    if not holdings or 'history' not in holdings:
        print("❌ holdings.json 中没有 history 数据")
        return False
    
    holdings_history = holdings.get('history', [])
    if not holdings_history:
        print("⚠️ holdings.json 的 history 为空")
        return False
    
    # 加载现有 history.json
    history = load_history()
    records = history.get('records', [])
    
    # 创建日期映射
    existing_dates = {r['date']: r for r in records}
    
    # 合并 holdings.json 的历史记录
    added = 0
    updated = 0
    for h in holdings_history:
        date = h.get('date')
        if date and date not in existing_dates:
            records.append({
                'date': date,
                'totalAssets': h.get('totalAssets', 0),
                'dailyPnL': h.get('dailyPnL', 0)
            })
            added += 1
            print(f"  ➕ 添加 {date}: ¥{h.get('totalAssets', 0):,.0f}")
        elif date:
            # 更新现有记录
            for r in records:
                if r['date'] == date:
                    if r.get('totalAssets') != h.get('totalAssets', 0):
                        r['totalAssets'] = h.get('totalAssets', 0)
                        r['dailyPnL'] = h.get('dailyPnL', 0)
                        updated += 1
                        print(f"  🔄 更新 {date}: ¥{h.get('totalAssets', 0):,.0f}")
                    break
    
    # 按日期排序
    records.sort(key=lambda x: x['date'])
    
    if save_history(records):
        if added > 0 or updated > 0:
            print(f"\n✅ 已同步: {added} 条新增, {updated} 条更新")
        else:
            print("\n✅ 无需更新，数据已同步")
        print(f"💾 当前共有 {len(records)} 条历史记录")
        return True
    return False

def show_history():
    """显示当前历史记录"""
    history = load_history()
    records = history.get('records', [])
    
    if not records:
        print("📭 历史记录为空")
        return
    
    print(f"\n📊 收益历史记录 (共 {len(records)} 条)")
    print("=" * 65)
    print(f"{'日期':<12} {'总资产':>15} {'日收益':>15} {'累计':>15}")
    print("-" * 65)
    
    cumulative = 0
    for record in records:
        date = record['date']
        total = record.get('totalAssets', 0)
        daily = record.get('dailyPnL', 0)
        cumulative += daily
        print(f"{date:<12} ¥{total:>13,.0f} ¥{daily:>+13,.0f} ¥{cumulative:>+13,.0f}")
    
    print("=" * 65)
    print(f"\n💡 记录范围: {records[0]['date']} → {records[-1]['date']}")
    
    # 显示最新数据
    latest = records[-1]
    print(f"\n📈 最新数据 ({latest['date']}):")
    print(f"   总资产: ¥{latest['totalAssets']:,.2f}")
    print(f"   日收益: ¥{latest['dailyPnL']:+,.2f}")
    
    # 检查缺失日期
    if len(records) >= 2:
        missing = check_missing_dates(records)
        if missing:
            print(f"\n⚠️  发现 {len(missing)} 个交易日缺失记录")
            print(f"   缺失日期: {', '.join(missing[-5:])}")

def check_missing_dates(records):
    """检查缺失的交易日"""
    if len(records) < 2:
        return []
    
    dates = [r['date'] for r in records]
    start = datetime.strptime(dates[0], '%Y-%m-%d')
    end = datetime.strptime(dates[-1], '%Y-%m-%d')
    
    missing = []
    current = start
    while current <= end:
        date_str = current.strftime('%Y-%m-%d')
        if date_str not in dates and is_trading_day(date_str):
            missing.append(date_str)
        current += timedelta(days=1)
    
    return missing

def main():
    import argparse
    parser = argparse.ArgumentParser(description='每日收益记录器')
    parser.add_argument('--show', action='store_true', help='显示历史记录')
    parser.add_argument('--sync', action='store_true', help='从 holdings.json 同步历史')
    
    args = parser.parse_args()
    
    if args.show:
        show_history()
    elif args.sync:
        sync_from_holdings_history()
    else:
        # 默认：记录今天
        record_today()

if __name__ == '__main__':
    main()
