#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
持仓晨报整合器 - 将持仓新闻与每日晨报合并
输出：一份包含市场概况+持仓动态的整合报告
"""

import json
import datetime
import os

def load_holdings():
    """加载持仓数据"""
    holdings_file = '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
    if os.path.exists(holdings_file):
        with open(holdings_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def get_stock_news(stock_code, stock_name):
    """获取个股相关新闻（简化版，实际可接入新闻API）"""
    # 这里可以接入实际的新闻API
    # 目前返回占位符，表示新闻获取逻辑
    return []

def generate_integrated_morning_report(market_summary, holdings):
    """生成整合晨报"""
    today = datetime.datetime.now()
    date_str = today.strftime('%m月%d日')
    weekday = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][today.weekday()]
    
    report = f"""📰 持仓晨报 | {date_str} {weekday}

═══ 全球市场概览 ═══
{market_summary}

═══ 您的持仓动态 ═══
"""
    
    # 添加持仓信息
    if 'stocks' in holdings:
        for stock in holdings['stocks']:
            code = stock.get('code', '')
            name = stock.get('name', '')
            price = stock.get('current_price', '--')
            change = stock.get('change_percent', '--')
            
            report += f"""
📈 {name} ({code})
   现价: ¥{price} | 涨跌: {change}%
   
"""
            # 添加相关新闻摘要（如果有）
            news = get_stock_news(code, name)
            if news:
                report += f"   相关动态: {news[0]}\n"
    
    if 'funds' in holdings:
        report += "\n💼 基金持仓\n"
        for fund in holdings['funds']:
            name = fund.get('name', '')
            nav = fund.get('nav', '--')
            change = fund.get('change', '--')
            report += f"   {name}: {nav} ({change})\n"
    
    report += f"""
═══ 今日策略提示 ═══
• 比亚迪支撑位: 99元 | 阻力位: 105元
• 若开盘涨跌超3%，建议关注成交量配合
• 中概股隔夜反弹，利好科技持仓

---
💡 这条推送对你有用吗？
👍 有用 / 👎 无用
"""
    
    return report

def main():
    """主函数"""
    holdings = load_holdings()
    
    # 市场概况（简化，实际从finance_report获取）
    market_summary = """• 美股: 道指+0.83% 纳指+1.22% 标普+1.01%
• 中概: 金龙指数+0.95% 比亚迪+8.2%
• 商品: 黄金守稳$5000 原油大跌-5.3%
• 汇率: 美元指数跌至99.9"""
    
    report = generate_integrated_morning_report(market_summary, holdings)
    
    # 保存报告
    reports_dir = '/root/.openclaw/workspace/reports'
    os.makedirs(reports_dir, exist_ok=True)
    
    date_str = datetime.datetime.now().strftime('%Y%m%d')
    report_file = os.path.join(reports_dir, f'integrated_morning_{date_str}.md')
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(report)
    print(f"\n报告已保存: {report_file}")

if __name__ == '__main__':
    main()
