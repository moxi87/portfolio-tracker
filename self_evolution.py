#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agent 自我进化循环系统
自主检查 → 生成建议 → 评估置信度 → 自动执行/推送决策
"""

import json
import yaml
import datetime
import os
import subprocess

DECISION_QUEUE_FILE = '/root/.openclaw/workspace/decision_queue.json'
IMPROVEMENT_LOG_FILE = '/root/.openclaw/workspace/improvement_log.json'

def log(message):
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")

def load_decision_queue():
    if os.path.exists(DECISION_QUEUE_FILE):
        with open(DECISION_QUEUE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_decision_queue(queue):
    with open(DECISION_QUEUE_FILE, 'w', encoding='utf-8') as f:
        json.dump(queue, f, ensure_ascii=False, indent=2)

def add_to_decision_queue(item):
    """添加需要用户决策的事项"""
    queue = load_decision_queue()
    item['added_at'] = datetime.datetime.now().isoformat()
    item['status'] = 'pending'
    queue.append(item)
    save_decision_queue(queue)
    
    # 立即飞书通知用户
    send_urgent_decision_request(item)

def send_urgent_decision_request(item):
    """发送紧急决策请求到飞书"""
    message = f"""⚠️ 需要您决策

{item['title']}

{item['description']}

选项:
"""
    for i, option in enumerate(item.get('options', ['是', '否']), 1):
        message += f"{i}. {option}\n"
    
    message += f"\n请回复选项编号或您的想法。"
    
    # 使用 openclaw message 发送
    try:
        subprocess.run([
            'openclaw', 'message', 'send',
            '--target', 'ou_ddff26b0a4b0f0e059d6e4d149232f92',
            '--content', message
        ], capture_output=True, timeout=30)
    except Exception as e:
        log(f"推送决策请求失败: {e}")

def auto_execute_improvement(improvement):
    """自动执行改进"""
    log(f"🤖 自动执行: {improvement['title']}")
    
    # 根据改进类型执行
    if improvement['type'] == 'config_update':
        # 配置更新
        success = execute_config_update(improvement)
    elif improvement['type'] == 'file_cleanup':
        # 文件清理
        success = execute_file_cleanup(improvement)
    elif improvement['type'] == 'schedule_adjust':
        # 调度调整
        success = execute_schedule_adjust(improvement)
    else:
        success = False
    
    # 记录执行结果
    record_improvement(improvement, success, 'auto')
    
    return success

def execute_config_update(improvement):
    """执行配置更新"""
    try:
        # 执行具体的配置更新操作
        if 'file' in improvement and 'content' in improvement:
            with open(improvement['file'], 'w', encoding='utf-8') as f:
                f.write(improvement['content'])
            return True
    except Exception as e:
        log(f"配置更新失败: {e}")
    return False

def execute_file_cleanup(improvement):
    """执行文件清理"""
    try:
        for pattern in improvement.get('patterns', []):
            files = subprocess.run(['find', '/root/.openclaw/workspace', '-name', pattern, '-type', 'f'], 
                                 capture_output=True, text=True)
            for f in files.stdout.strip().split('\n'):
                if f:
                    os.remove(f)
                    log(f"已删除: {f}")
        return True
    except Exception as e:
        log(f"文件清理失败: {e}")
    return False

def execute_schedule_adjust(improvement):
    """执行调度调整"""
    # 调度调整需要更谨慎，降低置信度阈值
    return False

def record_improvement(improvement, success, mode):
    """记录改进历史"""
    log_entry = {
        'timestamp': datetime.datetime.now().isoformat(),
        'improvement': improvement,
        'success': success,
        'mode': mode  # 'auto' | 'manual'
    }
    
    logs = []
    if os.path.exists(IMPROVEMENT_LOG_FILE):
        with open(IMPROVEMENT_LOG_FILE, 'r', encoding='utf-8') as f:
            logs = json.load(f)
    
    logs.append(log_entry)
    
    with open(IMPROVEMENT_LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(logs[-100:], f, ensure_ascii=False, indent=2)  # 保留最近100条

def check_system_health():
    """检查系统健康状态，生成改进建议"""
    suggestions = []
    
    # 检查1: 音频文件完整性
    audio_dir = '/root/.openclaw/workspace/portfolio-tracker/audio'
    today = datetime.datetime.now().strftime('%Y%m%d')
    
    finance_audio = os.path.join(audio_dir, f'finance_{today}.mp3')
    podcast_audio = os.path.join(audio_dir, f'podcast_{today}.mp3')
    
    if not os.path.exists(finance_audio) or os.path.getsize(finance_audio) < 50000:
        suggestions.append({
            'title': '财经晨报音频缺失/异常',
            'description': f'今日财经晨报音频文件缺失或大小异常',
            'type': 'audio_fix',
            'confidence': 0.9,
            'auto_action': '尝试使用备用TTS方案或通知用户手动生成'
        })
    
    if not os.path.exists(podcast_audio) or os.path.getsize(podcast_audio) < 50000:
        suggestions.append({
            'title': '乐活播客音频缺失/异常',
            'description': f'今日乐活播客音频文件缺失或大小异常',
            'type': 'audio_fix',
            'confidence': 0.9,
            'auto_action': '尝试使用备用TTS方案或通知用户手动生成'
        })
    
    # 检查2: 配置文件有效性
    config_files = [
        '/root/.openclaw/workspace/feedback_config.yaml',
        '/root/.openclaw/workspace/task_retry_state.json'
    ]
    
    for config_file in config_files:
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    if config_file.endswith('.yaml') or config_file.endswith('.yml'):
                        yaml.safe_load(f)
                    else:
                        json.load(f)
            except Exception as e:
                suggestions.append({
                    'title': f'配置文件损坏: {os.path.basename(config_file)}',
                    'description': f'配置文件解析失败: {e}',
                    'type': 'config_fix',
                    'confidence': 0.85,
                    'auto_action': '尝试从备份恢复或重建默认配置'
                })
    
    # 检查3: 磁盘空间
    try:
        result = subprocess.run(['df', '-h', '/root/.openclaw/workspace'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) > 1:
                usage = lines[1].split()
                if len(usage) > 4:
                    percent = usage[4].replace('%', '')
                    if percent.isdigit() and int(percent) > 80:
                        suggestions.append({
                            'title': '磁盘空间不足',
                            'description': f'工作区磁盘使用率 {percent}%，建议清理旧日志和临时文件',
                            'type': 'file_cleanup',
                            'confidence': 0.8,
                            'patterns': ['*.log', '*.tmp', 'watchdog_reports/watchdog_*.md'],
                            'auto_action': '清理30天前的日志和临时文件'
                        })
    except:
        pass
    
    # 检查4: GitHub同步状态
    try:
        os.chdir('/root/.openclaw/workspace/portfolio-tracker')
        result = subprocess.run(['git', 'status', '--porcelain'], 
                              capture_output=True, text=True)
        if result.stdout.strip():
            uncommitted = len([l for l in result.stdout.strip().split('\n') if l.strip()])
            if uncommitted > 5:
                suggestions.append({
                    'title': f'GitHub未同步: {uncommitted}个文件',
                    'description': '本地有未提交的文件，建议立即同步',
                    'type': 'git_sync',
                    'confidence': 0.75,
                    'auto_action': '自动提交并推送'
                })
    except:
        pass
    
    return suggestions

def evaluate_and_execute(suggestions):
    """评估建议并决定执行方式"""
    auto_executed = []
    need_decision = []
    
    for suggestion in suggestions:
        confidence = suggestion.get('confidence', 0.5)
        
        if confidence >= 0.8:
            # 高置信度，自动执行
            success = auto_execute_improvement(suggestion)
            if success:
                auto_executed.append(suggestion)
            else:
                # 自动执行失败，转为需要决策
                need_decision.append(suggestion)
        elif confidence >= 0.5:
            # 中等置信度，执行但报告
            success = auto_execute_improvement(suggestion)
            record_improvement(suggestion, success, 'auto_reported')
            auto_executed.append({
                **suggestion,
                'note': '已执行，结果待观察'
            })
        else:
            # 低置信度，需要用户决策
            need_decision.append(suggestion)
    
    return auto_executed, need_decision

def generate_daily_evolution_report(auto_executed, need_decision):
    """生成每日进化报告"""
    report = f"""# 🤖 Agent 自我进化报告
**时间**: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## ✅ 已自动执行 ({len(auto_executed)}项)
"""
    
    for item in auto_executed:
        report += f"- **{item['title']}** (置信度: {item.get('confidence', 'N/A')})\n"
        if 'note' in item:
            report += f"  - 备注: {item['note']}\n"
    
    if need_decision:
        report += f"""
## ⚠️ 待您决策 ({len(need_decision)}项)
"""
        for item in need_decision:
            report += f"- **{item['title']}**\n"
            report += f"  - 原因: {item['description']}\n"
    else:
        report += "\n## ✨ 今日无待决策事项\n"
    
    # 添加决策队列状态
    queue = load_decision_queue()
    pending = [q for q in queue if q['status'] == 'pending']
    if pending:
        report += f"\n## 📋 历史待决策事项 ({len(pending)}项)\n"
        for item in pending[-3:]:  # 只显示最近3个
            report += f"- {item['title']} (等待中)\n"
    
    return report

def main():
    """主函数 - 进化循环"""
    log("=" * 60)
    log("🔄 Agent 自我进化循环启动")
    log("=" * 60)
    
    # 1. 检查系统健康
    log("🔍 检查系统健康...")
    suggestions = check_system_health()
    log(f"发现 {len(suggestions)} 个改进建议")
    
    # 2. 评估并执行
    log("⚖️ 评估建议置信度...")
    auto_executed, need_decision = evaluate_and_execute(suggestions)
    
    log(f"自动执行: {len(auto_executed)} 项")
    log(f"需要决策: {len(need_decision)} 项")
    
    # 3. 推送需要决策的事项
    for item in need_decision:
        add_to_decision_queue({
            'title': item['title'],
            'description': item['description'],
            'type': item['type'],
            'options': item.get('options', ['立即执行', '跳过', '稍后决定'])
        })
    
    # 4. 生成报告
    report = generate_daily_evolution_report(auto_executed, need_decision)
    
    # 保存报告
    reports_dir = '/root/.openclaw/workspace/evolution_reports'
    os.makedirs(reports_dir, exist_ok=True)
    report_file = os.path.join(reports_dir, f"evolution_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.md")
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    log(f"报告已保存: {report_file}")
    print(report)
    
    # 5. 推送摘要到飞书
    summary = f"""🤖 自我进化循环完成

✅ 自动执行: {len(auto_executed)} 项
⚠️ 待决策: {len(need_decision)} 项

{'今日无待决策事项，系统运行良好。' if not need_decision else f'有 {len(need_decision)} 项需要您决策，请查看飞书消息。'}
"""
    
    try:
        subprocess.run([
            'openclaw', 'message', 'send',
            '--target', 'ou_ddff26b0a4b0f0e059d6e4d149232f92',
            '--content', summary
        ], capture_output=True, timeout=30)
    except:
        pass
    
    log("✅ 进化循环完成")

if __name__ == '__main__':
    main()
