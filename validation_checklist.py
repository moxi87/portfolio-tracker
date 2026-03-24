#!/usr/bin/env python3
"""
强制验证清单 - Validation Checklist
所有推送操作前必须通过此清单验证
"""
import subprocess
import requests
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

class ValidationChecklist:
    """验证清单管理器"""
    
    def __init__(self):
        self.checks = []
        self.passed = []
        self.failed = []
    
    def check_github_push(self, repo: str = "moxi87/portfolio-tracker", 
                          file_path: str = "data/holdings.json") -> bool:
        """验证GitHub推送是否成功"""
        try:
            url = f"https://raw.githubusercontent.com/{repo}/main/{file_path}"
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                self.passed.append(f"✅ GitHub文件可访问: {file_path}")
                return True
            else:
                self.failed.append(f"❌ GitHub返回状态码: {resp.status_code}")
                return False
        except Exception as e:
            self.failed.append(f"❌ GitHub访问失败: {e}")
            return False
    
    def check_data_timestamp(self, max_hours: int = 1) -> bool:
        """验证数据时间戳"""
        try:
            url = "https://raw.githubusercontent.com/moxi87/portfolio-tracker/main/data/holdings.json"
            resp = requests.get(url, timeout=10)
            data = resp.json()
            
            last_update_str = data.get('summary', {}).get('lastUpdate', '')
            if not last_update_str:
                self.failed.append("❌ 数据中无时间戳")
                return False
            
            last_update = datetime.fromisoformat(last_update_str.replace('Z', '+00:00'))
            last_update = last_update.replace(tzinfo=None)
            hours_old = (datetime.now() - last_update).total_seconds() / 3600
            
            if hours_old <= max_hours:
                self.passed.append(f"✅ 数据时效: {hours_old:.1f}小时（要求<={max_hours}小时）")
                return True
            else:
                self.failed.append(f"❌ 数据滞后: {hours_old:.1f}小时（要求<={max_hours}小时）")
                return False
                
        except Exception as e:
            self.failed.append(f"❌ 时间戳验证失败: {e}")
            return False
    
    def check_file_size(self, file_path: Path, min_bytes: int = 100) -> bool:
        """验证文件大小"""
        if not file_path.exists():
            self.failed.append(f"❌ 文件不存在: {file_path}")
            return False
        
        size = file_path.stat().st_size
        if size >= min_bytes:
            self.passed.append(f"✅ 文件大小: {size} bytes（要求>={min_bytes}）")
            return True
        else:
            self.failed.append(f"❌ 文件过小: {size} bytes（要求>={min_bytes}）")
            return False
    
    def check_json_valid(self, file_path: Path) -> bool:
        """验证JSON格式"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                json.load(f)
            self.passed.append(f"✅ JSON格式有效: {file_path.name}")
            return True
        except Exception as e:
            self.failed.append(f"❌ JSON解析失败: {e}")
            return False
    
    def validate_holdings_update(self) -> Tuple[bool, List[str]]:
        """持仓更新完整验证流程"""
        print("="*50)
        print("执行强制验证清单...")
        print("="*50)
        
        data_file = Path("/root/.openclaw/workspace/portfolio-tracker/data/holdings.json")
        
        # 1. 本地JSON格式
        if not self.check_json_valid(data_file):
            return False, self.failed
        
        # 2. 文件大小
        if not self.check_file_size(data_file, min_bytes=1000):
            return False, self.failed
        
        # 3. GitHub推送
        if not self.check_github_push():
            return False, self.failed
        
        # 4. 数据时效
        if not self.check_data_timestamp(max_hours=2):
            return False, self.failed
        
        # 汇总
        print("\n✅ 所有验证通过！")
        for check in self.passed:
            print(f"  {check}")
        
        return True, self.passed
    
    def validate_audio_file(self, file_path: Path) -> Tuple[bool, List[str]]:
        """音频文件验证（虽然现在不用了，但保留机制）"""
        # 音频功能已停用，直接返回失败
        self.failed.append("❌ 音频功能已永久停用")
        return False, self.failed

def main():
    """命令行入口"""
    import sys
    
    checklist = ValidationChecklist()
    
    if len(sys.argv) > 1 and sys.argv[1] == "holdings":
        success, results = checklist.validate_holdings_update()
    else:
        print("用法: python3 validation_checklist.py holdings")
        return 1
    
    if not success:
        print("\n❌ 验证失败:")
        for error in results:
            print(f"  {error}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
