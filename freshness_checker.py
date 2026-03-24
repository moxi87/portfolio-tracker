#!/usr/bin/env python3
"""
数据新鲜度检查器
- 检查 holdings.json 最后更新时间
- 超过阈值时告警
- 集成到看门狗和定时任务
"""
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
import sys

# 配置
DATA_FILE = Path("/root/.openclaw/workspace/portfolio-tracker/data/holdings.json")
FEISHU_USER_ID = "ou_ddff26b0a4b0f0e059d6e4d149232f92"

# 阈值（小时）
WARNING_HOURS = 12  # 黄色警告
ALERT_HOURS = 24    # 红色告警

def check_freshness():
    """检查数据新鲜度"""
    if not DATA_FILE.exists():
        return {
            "status": "error",
            "message": "数据文件不存在",
            "hours_old": None,
            "emoji": "🔴"
        }
    
    # 读取数据
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    last_update_str = data.get('summary', {}).get('lastUpdate', '')
    if not last_update_str:
        last_update_str = data.get('lastUpdate', '')
    
    if not last_update_str:
        return {
            "status": "error",
            "message": "无法获取更新时间",
            "hours_old": None,
            "emoji": "🔴"
        }
    
    # 解析时间
    try:
        last_update = datetime.fromisoformat(last_update_str.replace('Z', '+00:00'))
        # 转换为本地时间（去掉时区）
        last_update = last_update.replace(tzinfo=None)
    except:
        return {
            "status": "error", 
            "message": f"时间格式错误: {last_update_str}",
            "hours_old": None,
            "emoji": "🔴"
        }
    
    now = datetime.now()
    hours_old = (now - last_update).total_seconds() / 3600
    
    # 确定状态
    if hours_old >= ALERT_HOURS:
        status = "alert"
        emoji = "🔴"
        message = f"数据已滞后 {hours_old:.1f} 小时，请检查更新链路"
    elif hours_old >= WARNING_HOURS:
        status = "warning"
        emoji = "🟡"
        message = f"数据已滞后 {hours_old:.1f} 小时"
    else:
        status = "ok"
        emoji = "🟢"
        message = f"数据新鲜 ({hours_old:.1f} 小时前更新)"
    
    return {
        "status": status,
        "message": message,
        "hours_old": hours_old,
        "last_update": last_update_str,
        "emoji": emoji,
        "total_assets": data.get('summary', {}).get('totalAssets', 0)
    }

def send_feishu_notification(result: dict):
    """发送飞书通知（仅告警时）"""
    if result["status"] == "ok":
        print(f"✅ {result['message']}")
        return True
    
    # 构建告警消息
    msg = f"""{result['emoji']} 持仓数据状态告警

{result['message']}

📊 当前总资产: ¥{result['total_assets']:,.2f}
📅 最后更新: {result['last_update']}

请检查:
1. update_holdings.py 是否正常运行
2. crontab 配置是否正确
3. 数据源是否可用
"""
    
    try:
        subprocess.run([
            'openclaw', 'message', 'send',
            '--channel', 'feishu',
            '--target', FEISHU_USER_ID,
            '--message', msg
        ], check=True, timeout=30)
        print(f"✅ 告警已推送")
        return True
    except Exception as e:
        print(f"❌ 推送失败: {e}")
        return False

def main():
    """主函数"""
    print(f"[{datetime.now()}] 检查数据新鲜度...")
    
    result = check_freshness()
    
    print(f"状态: {result['emoji']} {result['status']}")
    print(f"消息: {result['message']}")
    if result['hours_old']:
        print(f"滞后: {result['hours_old']:.1f} 小时")
    
    # 发送通知（仅告警时）
    send_feishu_notification(result)
    
    # 返回状态码供脚本调用
    if result['status'] == 'alert':
        return 2
    elif result['status'] == 'warning':
        return 1
    return 0

if __name__ == "__main__":
    exit(main())
