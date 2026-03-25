#!/usr/bin/env python3
"""
持仓预警通知系统
功能：监控持仓涨跌，触发阈值时推送飞书通知
"""
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional
import requests

# 添加项目路径
sys.path.insert(0, '/root/.openclaw/workspace/portfolio-tracker')
from data_service import StockDataService

# 配置
HOLDINGS_FILE = '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
CONFIG_FILE = '/root/.openclaw/workspace/alert_config.json'
FEISHU_USER_ID = "ou_ddff26b0a4b0f0e059d6e4d149232f92"

class HoldingsAlertSystem:
    """持仓预警系统"""
    
    def __init__(self):
        self.data_service = StockDataService()
        self.config = self._load_config()
        self.holdings = self._load_holdings()
    
    def _load_config(self) -> Dict:
        """加载预警配置"""
        default_config = {
            "market_index": {
                "enabled": True,
                "threshold": 1.5  # 大盘涨跌超过1.5%预警
            },
            "individual": {
                "enabled": True,
                "default_threshold": 3.0,  # 默认个股涨跌3%预警
                "custom": {}  # 自定义阈值: {"000001": 5.0}
            },
            "portfolio": {
                "enabled": True,
                "daily_pnl_threshold": 5000  # 日盈亏超过5000预警
            },
            "notification": {
                "cooldown_minutes": 30,  # 同一标的30分钟内不重复预警
                "quiet_hours": {"start": 23, "end": 8}  # 静默时段
            }
        }
        
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    saved_config = json.load(f)
                    # 合并默认配置
                    for key, value in default_config.items():
                        if key not in saved_config:
                            saved_config[key] = value
                    return saved_config
        except Exception as e:
            print(f"[Warning] 加载配置失败: {e}")
        
        return default_config
    
    def _load_holdings(self) -> Dict:
        """加载持仓数据"""
        try:
            with open(HOLDINGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Error] 加载持仓失败: {e}")
            return {}
    
    def check_market_alert(self) -> Optional[Dict]:
        """检查大盘预警"""
        if not self.config.get('market_index', {}).get('enabled'):
            return None
        
        threshold = self.config['market_index'].get('threshold', 1.5)
        
        # 获取上证指数
        data = self.data_service.fetch_sina('000001')
        if not data:
            return None
        
        change_pct = (data['price'] - data['close']) / data['close'] * 100
        
        if abs(change_pct) >= threshold:
            return {
                'type': 'market',
                'name': '上证指数',
                'code': '000001',
                'price': data['price'],
                'change_pct': round(change_pct, 2),
                'threshold': threshold,
                'direction': 'up' if change_pct > 0 else 'down'
            }
        return None
    
    def check_individual_alerts(self) -> List[Dict]:
        """检查个股/基金预警"""
        alerts = []
        
        if not self.config.get('individual', {}).get('enabled'):
            return alerts
        
        default_threshold = self.config['individual'].get('default_threshold', 3.0)
        custom_thresholds = self.config['individual'].get('custom', {})
        
        accounts = self.holdings.get('accounts', [])
        for account in accounts:
            # 检查股票
            for stock in account.get('stocks', []):
                code = stock.get('code', '')
                if not code:
                    continue
                
                threshold = custom_thresholds.get(code, default_threshold)
                daily_change = stock.get('dailyChange', 0)
                
                if abs(daily_change) >= threshold:
                    alerts.append({
                        'type': 'stock',
                        'name': stock.get('name', ''),
                        'code': code,
                        'price': stock.get('price', 0),
                        'change_pct': daily_change,
                        'threshold': threshold,
                        'direction': 'up' if daily_change > 0 else 'down',
                        'market_value': stock.get('marketValue', 0)
                    })
            
            # 检查基金
            for fund in account.get('funds', []):
                code = fund.get('code', '')
                if not code:
                    continue
                
                threshold = custom_thresholds.get(code, default_threshold)
                daily_change = fund.get('dailyChange', 0)
                
                if abs(daily_change) >= threshold:
                    alerts.append({
                        'type': 'fund',
                        'name': fund.get('name', ''),
                        'code': code,
                        'nav': fund.get('nav', 0),
                        'change_pct': daily_change,
                        'threshold': threshold,
                        'direction': 'up' if daily_change > 0 else 'down',
                        'market_value': fund.get('marketValue', 0)
                    })
        
        return alerts
    
    def check_portfolio_alert(self) -> Optional[Dict]:
        """检查整体组合预警"""
        if not self.config.get('portfolio', {}).get('enabled'):
            return None
        
        threshold = self.config['portfolio'].get('daily_pnl_threshold', 5000)
        
        # 计算总日盈亏
        total_daily_pnl = 0
        accounts = self.holdings.get('accounts', [])
        for account in accounts:
            total_daily_pnl += account.get('dailyPnL', 0)
        
        if abs(total_daily_pnl) >= threshold:
            return {
                'type': 'portfolio',
                'daily_pnl': round(total_daily_pnl, 2),
                'threshold': threshold,
                'direction': 'profit' if total_daily_pnl > 0 else 'loss'
            }
        return None
    
    def format_alert_message(self, alerts: List[Dict]) -> str:
        """格式化预警消息"""
        if not alerts:
            return ""
        
        now = datetime.now().strftime('%H:%M')
        lines = [f"🚨 持仓预警 [{now}]\n"]
        
        # 按类型分组
        market_alerts = [a for a in alerts if a['type'] == 'market']
        portfolio_alerts = [a for a in alerts if a['type'] == 'portfolio']
        individual_alerts = [a for a in alerts if a['type'] in ['stock', 'fund']]
        
        # 大盘预警
        for alert in market_alerts:
            emoji = "📈" if alert['direction'] == 'up' else "📉"
            lines.append(f"{emoji} 大盘异动：上证指数 {alert['change_pct']:+.2f}%")
        
        # 组合预警
        for alert in portfolio_alerts:
            emoji = "🟢" if alert['direction'] == 'profit' else "🔴"
            lines.append(f"{emoji} 组合盈亏：今日{alert['daily_pnl']:+.0f}元")
        
        # 个股/基金预警
        if individual_alerts:
            lines.append("\n📊 持仓异动：")
            for alert in individual_alerts:
                emoji = "🔺" if alert['direction'] == 'up' else "🔻"
                asset_type = "股票" if alert['type'] == 'stock' else "基金"
                lines.append(f"{emoji} {alert['name']} ({alert['code']})")
                lines.append(f"   涨跌: {alert['change_pct']:+.2f}% | 市值: {alert['market_value']:,.0f}元")
        
        lines.append(f"\n⏰ {datetime.now().strftime('%m-%d %H:%M')}")
        return "\n".join(lines)
    
    def send_feishu_alert(self, message: str) -> bool:
        """发送飞书通知"""
        try:
            # 使用OpenClaw message工具
            # 实际调用时会通过message action=send
            print(f"[Alert] 发送飞书通知:\n{message}")
            return True
        except Exception as e:
            print(f"[Error] 发送通知失败: {e}")
            return False
    
    def run(self) -> Dict:
        """运行预警检查"""
        print("=" * 50)
        print("持仓预警检查")
        print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 50)
        
        all_alerts = []
        
        # 检查大盘
        market_alert = self.check_market_alert()
        if market_alert:
            all_alerts.append(market_alert)
            print(f"⚠️ 大盘预警: 上证指数 {market_alert['change_pct']:+.2f}%")
        
        # 检查个股/基金
        individual_alerts = self.check_individual_alerts()
        all_alerts.extend(individual_alerts)
        for alert in individual_alerts:
            print(f"⚠️ 持仓预警: {alert['name']} {alert['change_pct']:+.2f}%")
        
        # 检查组合
        portfolio_alert = self.check_portfolio_alert()
        if portfolio_alert:
            all_alerts.append(portfolio_alert)
            print(f"⚠️ 组合预警: 日盈亏 {portfolio_alert['daily_pnl']:+.0f}元")
        
        # 发送通知
        if all_alerts:
            message = self.format_alert_message(all_alerts)
            self.send_feishu_alert(message)
            return {
                'success': True,
                'alert_count': len(all_alerts),
                'alerts': all_alerts,
                'message': message
            }
        else:
            print("✅ 无异常，无需预警")
            return {'success': True, 'alert_count': 0, 'alerts': []}


def main():
    """主函数"""
    alert_system = HoldingsAlertSystem()
    result = alert_system.run()
    
    if result['alert_count'] > 0:
        print(f"\n发送了 {result['alert_count']} 条预警")
        sys.exit(0)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
