#!/usr/bin/env python3
"""
Portfolio Pro 日历视图模块
支持：交易日历、收益热力图、事件标记
"""
import json
import calendar
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class CalendarEvent:
    """日历事件"""
    date: str
    type: str  # dividend/earnings/trade/news
    title: str
    description: str
    amount: Optional[float] = None

class CalendarView:
    """日历视图生成器"""
    
    def __init__(self, holdings_file: str = None, history_file: str = None):
        self.holdings_file = holdings_file or '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
        self.history_file = history_file or '/root/.openclaw/workspace/portfolio-tracker/data/history.json'
        self.holdings = self._load_json(self.holdings_file)
        self.history = self._load_json(self.history_file)
        self.events = []
    
    def _load_json(self, filepath: str) -> Dict:
        """加载JSON"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    
    def generate_monthly_calendar(self, year: int = None, month: int = None) -> Dict:
        """生成月度日历"""
        if year is None:
            year = datetime.now().year
        if month is None:
            month = datetime.now().month
        
        # 获取日历数据
        cal = calendar.Calendar()
        month_days = cal.monthdayscalendar(year, month)
        
        # 获取历史收益数据
        daily_returns = self._get_daily_returns(year, month)
        
        # 生成事件
        events = self._generate_events(year, month)
        
        # 构建日历网格
        weeks = []
        for week in month_days:
            week_data = []
            for day in week:
                if day == 0:
                    week_data.append(None)
                else:
                    date_str = f"{year}-{month:02d}-{day:02d}"
                    day_data = {
                        'day': day,
                        'date': date_str,
                        'is_today': date_str == datetime.now().strftime('%Y-%m-%d'),
                        'is_weekend': datetime(year, month, day).weekday() >= 5,
                        'return': daily_returns.get(date_str, 0),
                        'events': [e for e in events if e.date == date_str]
                    }
                    week_data.append(day_data)
            weeks.append(week_data)
        
        return {
            'year': year,
            'month': month,
            'month_name': calendar.month_name[month],
            'weeks': weeks,
            'summary': self._calculate_month_summary(year, month, daily_returns)
        }
    
    def _get_daily_returns(self, year: int, month: int) -> Dict[str, float]:
        """获取日收益数据"""
        returns = {}
        
        # 从历史数据获取
        records = self.history.get('records', [])
        for record in records:
            date = record.get('date', '')
            if date.startswith(f"{year}-{month:02d}"):
                returns[date] = record.get('dailyPnL', 0)
        
        return returns
    
    def _generate_events(self, year: int, month: int) -> List[CalendarEvent]:
        """生成日历事件"""
        events = []
        
        # 获取持仓相关事件
        accounts = self.holdings.get('accounts', [])
        
        for account in accounts:
            # 股票分红/财报事件（模拟）
            for stock in account.get('stocks', []):
                # 模拟财报日（每月固定日期）
                earnings_day = (hash(stock['code']) % 28) + 1
                events.append(CalendarEvent(
                    date=f"{year}-{month:02d}-{earnings_day:02d}",
                    type='earnings',
                    title=f"{stock['name']} 财报",
                    description=f"{stock['name']} ({stock['code']}) 季度财报发布"
                ))
            
            # 基金分红事件（模拟）
            for fund in account.get('funds', []):
                # 模拟分红日
                dividend_day = (hash(fund['code']) % 28) + 1
                if hash(fund['code']) % 4 == month % 4:  # 季度分红
                    events.append(CalendarEvent(
                        date=f"{year}-{month:02d}-{dividend_day:02d}",
                        type='dividend',
                        title=f"{fund['name'][:10]}... 分红",
                        description=f"基金分红公告日",
                        amount=fund.get('marketValue', 0) * 0.01  # 假设1%分红
                    ))
        
        return events
    
    def _calculate_month_summary(self, year: int, month: int, returns: Dict) -> Dict:
        """计算月度汇总"""
        if not returns:
            return {'total_return': 0, 'positive_days': 0, 'negative_days': 0}
        
        total = sum(returns.values())
        positive = sum(1 for r in returns.values() if r > 0)
        negative = sum(1 for r in returns.values() if r < 0)
        
        return {
            'total_return': total,
            'positive_days': positive,
            'negative_days': negative,
            'win_rate': positive / len(returns) * 100 if returns else 0
        }
    
    def generate_heatmap_data(self, year: int = None) -> List[Dict]:
        """生成年度收益热力图数据"""
        if year is None:
            year = datetime.now().year
        
        records = self.history.get('records', [])
        heatmap_data = []
        
        for record in records:
            date = record.get('date', '')
            if date.startswith(str(year)):
                pnl = record.get('dailyPnL', 0)
                heatmap_data.append({
                    'date': date,
                    'value': pnl,
                    'intensity': self._get_heatmap_intensity(pnl)
                })
        
        return heatmap_data
    
    def _get_heatmap_intensity(self, pnl: float) -> int:
        """获取热力图强度（1-4级）"""
        if pnl > 5000:
            return 4
        elif pnl > 1000:
            return 3
        elif pnl > 0:
            return 2
        elif pnl > -1000:
            return 1
        else:
            return 0
    
    def format_text_calendar(self, year: int = None, month: int = None) -> str:
        """格式化文本日历"""
        cal_data = self.generate_monthly_calendar(year, month)
        
        lines = [
            f"\n📅 {cal_data['year']}年{cal_data['month']}月 投资日历",
            "=" * 60,
            f"\n{cal_data['month_name']} {cal_data['year']}",
            "一   二   三   四   五   六   日",
            "-" * 40
        ]
        
        for week in cal_data['weeks']:
            week_str = ""
            for day in week:
                if day is None:
                    week_str += "    "
                else:
                    day_num = day['day']
                    return_val = day['return']
                    
                    # 根据收益着色
                    if return_val > 1000:
                        marker = f"\033[92m{day_num:2d}\033[0m"  # 绿色
                    elif return_val < -1000:
                        marker = f"\033[91m{day_num:2d}\033[0m"  # 红色
                    elif return_val != 0:
                        marker = f"\033[93m{day_num:2d}\033[0m"  # 黄色
                    else:
                        marker = f"{day_num:2d}"
                    
                    if day['is_today']:
                        marker = f"[{day_num:2d}]"
                    
                    week_str += f"{marker}  "
            lines.append(week_str)
        
        # 汇总
        summary = cal_data['summary']
        lines.extend([
            "-" * 40,
            f"月度收益: ¥{summary['total_return']:,.0f}",
            f"盈利天数: {summary['positive_days']}天",
            f"亏损天数: {summary['negative_days']}天",
            f"胜率: {summary['win_rate']:.1f}%"
        ])
        
        # 事件列表
        events = []
        for week in cal_data['weeks']:
            for day in week:
                if day and day['events']:
                    for event in day['events']:
                        events.append(f"{day['date']} {event.title}")
        
        if events:
            lines.extend([
                "\n【本月大事】",
                *events[:5]  # 显示前5个事件
            ])
        
        return "\n".join(lines)
    
    def generate_html_calendar(self, year: int = None, month: int = None) -> str:
        """生成HTML日历（用于Web展示）"""
        cal_data = self.generate_monthly_calendar(year, month)
        
        html = f"""
        <div class="calendar-container">
            <div class="calendar-header">
                <h3>{cal_data['year']}年{cal_data['month']}月</h3>
                <div class="calendar-nav">
                    <button onclick="prevMonth()">&lt;</button>
                    <button onclick="nextMonth()">&gt;</button>
                </div>
            </div>
            <div class="calendar-grid">
                <div class="weekday-header">一</div>
                <div class="weekday-header">二</div>
                <div class="weekday-header">三</div>
                <div class="weekday-header">四</div>
                <div class="weekday-header">五</div>
                <div class="weekday-header weekend">六</div>
                <div class="weekday-header weekend">日</div>
        """
        
        for week in cal_data['weeks']:
            for day in week:
                if day is None:
                    html += '<div class="day-cell empty"></div>'
                else:
                    return_class = ''
                    if day['return'] > 1000:
                        return_class = 'profit-high'
                    elif day['return'] > 0:
                        return_class = 'profit'
                    elif day['return'] < -1000:
                        return_class = 'loss-high'
                    elif day['return'] < 0:
                        return_class = 'loss'
                    
                    today_class = 'today' if day['is_today'] else ''
                    weekend_class = 'weekend' if day['is_weekend'] else ''
                    
                    events_html = ''.join([
                        f'<div class="event-dot {e.type}"></div>' 
                        for e in day['events']
                    ])
                    
                    html += f'''
                        <div class="day-cell {return_class} {today_class} {weekend_class}">
                            <div class="day-number">{day['day']}</div>
                            <div class="day-return">{day['return']:+.0f}</div>
                            <div class="event-dots">{events_html}</div>
                        </div>
                    '''
        
        html += "</div></div>"
        return html


def main():
    """主函数"""
    calendar_view = CalendarView()
    
    # 生成本月日历
    now = datetime.now()
    print(calendar_view.format_text_calendar(now.year, now.month))
    
    # 生成年度热力图数据
    heatmap = calendar_view.generate_heatmap_data(now.year)
    print(f"\n\n📊 {now.year}年收益热力图数据")
    print(f"共 {len(heatmap)} 个交易日记录")
    
    # 统计
    profits = sum(1 for h in heatmap if h['value'] > 0)
    losses = sum(1 for h in heatmap if h['value'] < 0)
    print(f"盈利天数: {profits}")
    print(f"亏损天数: {losses}")


if __name__ == '__main__':
    main()
