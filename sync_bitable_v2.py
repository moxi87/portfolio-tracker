#!/usr/bin/env python3
"""
Portfolio Pro Bitable同步脚本 v2（优化版）
- 文本字段：代码+名称（简洁）
- 添加汇总行：总资产+累计收益
- 清理已清仓记录
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Any

HOLDINGS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'holdings.json')
REPORT_FILE = os.path.join(os.path.dirname(__file__), 'bitable_sync_report.txt')

# Bitable配置
APP_TOKEN = "KfXrbF5RyakQPcsMfkccSkqInTe"
TABLE_ID = "tblpXsLfeFttFsWE"


def load_holdings() -> Dict:
    """加载持仓数据"""
    try:
        with open(HOLDINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ 加载持仓数据失败: {e}")
        return {}


def format_code_name(code: str, name: str, max_name_len: int = 10) -> str:
    """格式化代码+名称，简洁显示"""
    display_name = name[:max_name_len] + "..." if len(name) > max_name_len else name
    return f"{code} | {display_name}"


def prepare_fund_records(holdings: Dict) -> tuple:
    """准备基金记录"""
    records = []
    account = holdings.get('accounts', [{}])[0]
    funds = account.get('funds', [])
    cleared = 0
    
    for fund in funds:
        code = fund.get('code', '')
        name = fund.get('name', '')
        
        # 跳过市值为0的（已清仓）
        market_value = fund.get('marketValue', 0)
        if market_value <= 0:
            cleared += 1
            continue
        
        # 跳过余额宝（作为现金单独处理）
        if code == 'YEB':
            continue
        
        record = {
            "文本": format_code_name(code, name),
            "单选": "基金",
            "日期": int(datetime.now().timestamp() * 1000),
            "收益率": round(fund.get('returnRate', 0) / 100, 4),
            "今日涨跌": round(fund.get('dailyChange', 0) / 100, 4) if 'dailyChange' in fund else 0
        }
        records.append(record)
    
    return records, cleared


def prepare_stock_records(holdings: Dict) -> tuple:
    """准备股票记录"""
    records = []
    account = holdings.get('accounts', [{}])[0]
    stocks = account.get('stocks', [])
    cleared = 0
    
    for stock in stocks:
        code = stock.get('code', '')
        name = stock.get('name', '')
        
        # 跳过市值为0的（已清仓）
        market_value = stock.get('marketValue', 0)
        if market_value <= 0:
            cleared += 1
            continue
        
        # 计算今日涨跌
        daily_change = stock.get('dailyChange', 0)
        
        record = {
            "文本": format_code_name(code, name),
            "单选": "股票",
            "日期": int(datetime.now().timestamp() * 1000),
            "收益率": round(stock.get('returnRate', 0) / 100, 4),
            "今日涨跌": round(daily_change / 100, 4) if daily_change else 0
        }
        records.append(record)
    
    return records, cleared


def prepare_cash_record(holdings: Dict) -> Dict:
    """准备现金记录（余额宝）"""
    account = holdings.get('accounts', [{}])[0]
    funds = account.get('funds', [])
    
    for fund in funds:
        if fund.get('code') == 'YEB':
            return {
                "文本": "YEB | 余额宝",
                "单选": "现金",
                "日期": int(datetime.now().timestamp() * 1000),
                "收益率": 0,
                "今日涨跌": 0
            }
    return None


def prepare_summary_record(holdings: Dict) -> Dict:
    """准备汇总记录"""
    summary = holdings.get('summary', {})
    total_assets = summary.get('totalAssets', 0)
    total_pnl = summary.get('totalPnL', 0)
    return_rate = summary.get('returnRate', 0)
    
    # 格式化资产显示
    if total_assets >= 10000 * 10000:
        assets_display = f"{total_assets / (10000 * 10000):.2f}亿"
    elif total_assets >= 10000:
        assets_display = f"{total_assets / 10000:.2f}万"
    else:
        assets_display = f"{total_assets:.0f}"
    
    pnl_emoji = "+" if total_pnl >= 0 else ""
    
    return {
        "文本": f"💰 总资产 {assets_display} | 收益{pnl_emoji}{total_pnl:,.0f}",
        "单选": "汇总",
        "日期": int(datetime.now().timestamp() * 1000),
        "收益率": round(return_rate / 100, 4),
        "今日涨跌": 0
    }


def generate_sync_data(holdings: Dict) -> tuple:
    """生成同步数据和统计"""
    records = []
    stats = {'funds': 0, 'stocks': 0, 'cash': 0, 'cleared': 0, 'summary': 0}
    
    # 基金
    fund_records, fund_cleared = prepare_fund_records(holdings)
    records.extend(fund_records)
    stats['funds'] = len(fund_records)
    stats['cleared'] += fund_cleared
    
    # 股票
    stock_records, stock_cleared = prepare_stock_records(holdings)
    records.extend(stock_records)
    stats['stocks'] = len(stock_records)
    stats['cleared'] += stock_cleared
    
    # 现金
    cash_record = prepare_cash_record(holdings)
    if cash_record:
        records.append(cash_record)
        stats['cash'] = 1
    
    # 汇总
    summary_record = prepare_summary_record(holdings)
    if summary_record:
        records.append(summary_record)
        stats['summary'] = 1
    
    return records, stats


def generate_report(holdings: Dict, stats: Dict) -> str:
    """生成同步报告"""
    summary = holdings.get('summary', {})
    total_assets = summary.get('totalAssets', 0)
    total_pnl = summary.get('totalPnL', 0)
    daily_pnl = summary.get('dailyPnL', 0)
    
    report = f"""📊 **Bitable持仓同步完成** | {datetime.now().strftime('%Y-%m-%d %H:%M')}

**资产概览**
💰 总资产: ¥{total_assets:,.2f}
📈 累计收益: {'🟢' if total_pnl >= 0 else '🔴'} ¥{total_pnl:,.2f}
📉 今日盈亏: {'🟢' if daily_pnl >= 0 else '🔴'} ¥{daily_pnl:,.2f}

**同步明细**
- 基金: {stats['funds']} 只
- 股票: {stats['stocks']} 只
- 现金: {stats['cash']} 项
- 已清仓: {stats['cleared']} 条（已跳过）
- 汇总: {stats['summary']} 行

**优化项**
✅ 代码+名称简洁格式
✅ 添加汇总行（总资产+累计收益）
✅ 清理零市值记录
"""
    return report


def main():
    """主函数 - 生成同步数据并保存报告"""
    print("=" * 50)
    print("📊 Bitable持仓同步 v2（优化版）")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    holdings = load_holdings()
    if not holdings:
        print("❌ 无法加载持仓数据")
        return 1
    
    # 准备数据
    print("\n📝 正在准备同步数据...")
    records, stats = generate_sync_data(holdings)
    
    # 保存数据到JSON文件供外部工具读取
    sync_data_file = os.path.join(os.path.dirname(__file__), 'bitable_sync_data.json')
    with open(sync_data_file, 'w', encoding='utf-8') as f:
        json.dump({
            'app_token': APP_TOKEN,
            'table_id': TABLE_ID,
            'records': records,
            'stats': stats,
            'timestamp': datetime.now().isoformat()
        }, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 已准备 {len(records)} 条记录")
    print(f"   基金: {stats['funds']}, 股票: {stats['stocks']}, 现金: {stats['cash']}, 汇总: {stats['summary']}")
    print(f"   已跳过清仓: {stats['cleared']}")
    
    # 生成报告
    report = generate_report(holdings, stats)
    print("\n" + report)
    
    # 保存报告
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n💾 数据已保存到: {sync_data_file}")
    print(f"💾 报告已保存到: {REPORT_FILE}")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
