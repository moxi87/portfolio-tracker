#!/usr/bin/env python3
"""
Portfolio Pro 定时任务入口
用于cron定时调用，自动同步持仓数据
"""

import os
import sys
import subprocess
import json
from datetime import datetime

# 添加项目路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

def run_sync():
    """执行同步"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 开始执行持仓数据同步...")
    
    try:
        # 执行同步脚本
        result = subprocess.run(
            [sys.executable, 'auto_sync.py'],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        print(result.stdout)
        
        if result.returncode != 0:
            print(f"同步失败: {result.stderr}")
            return False
        
        # 读取报告
        report_file = os.path.join(SCRIPT_DIR, 'sync_report.txt')
        if os.path.exists(report_file):
            with open(report_file, 'r', encoding='utf-8') as f:
                report = f.read()
            
            # 飞书推送（如果配置了）
            push_to_feishu(report)
        
        return True
        
    except subprocess.TimeoutExpired:
        print("同步超时")
        return False
    except Exception as e:
        print(f"同步异常: {e}")
        return False

def push_to_feishu(report: str):
    """推送到飞书"""
    try:
        # 使用openclaw message工具推送
        cmd = [
            'openclaw', 'message', 'send',
            '--target', 'ou_ddff26b0a4b0f0e059d6e4d149232f92',
            '--message', report
        ]
        subprocess.run(cmd, capture_output=True, timeout=30)
        print("已推送至飞书")
    except Exception as e:
        print(f"飞书推送失败: {e}")

def main():
    """主函数"""
    success = run_sync()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
