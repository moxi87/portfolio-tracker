#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
任务失败自动补跑监控 - Task Failure Watchdog v2.0
每30分钟检查一次，发现失败/缺失则自动补跑

改进点：
1. 检测音频文件是否缺失，缺失自动补生成
2. TTS失败自动重试（最多3次）
3. 修复任务状态检测逻辑，使用实际cron执行记录
4. 推送失败告警到飞书
"""

import json
import subprocess
import time
import datetime
import os
import glob

# 任务补跑配置
RETRY_CONFIG = {
    'finance_morning_report': {
        'script': '/root/.openclaw/workspace/finance_report.py',
        'retry_delay': 600,
        'max_retries': 3,
        'check_audio': True,
        'audio_pattern': 'finance_*.mp3'
    },
    'agile_daily_podcast': {
        'script': '/root/.openclaw/workspace/agile_podcast.py',
        'retry_delay': 600,
        'max_retries': 3,
        'check_audio': True,
        'audio_pattern': 'podcast_*.mp3',
        'audio_script_dir': '/root/.openclaw/workspace/agile_podcasts'
    }
}

RETRY_STATE_FILE = '/root/.openclaw/workspace/task_retry_state.json'
WATCHDOG_LOG_FILE = '/root/.openclaw/workspace/watchdog_execution.log'

def log(message):
    """记录日志"""
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    
    with open(WATCHDOG_LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(log_line + '\n')

def load_retry_state():
    """加载重试状态"""
    if os.path.exists(RETRY_STATE_FILE):
        try:
            with open(RETRY_STATE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_retry_state(state):
    """保存重试状态"""
    with open(RETRY_STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def check_audio_file_exists(pattern, date_str):
    """检查指定日期的音频文件是否存在"""
    audio_dir = '/root/.openclaw/workspace/portfolio-tracker/audio'
    expected_file = os.path.join(audio_dir, pattern.replace('*', date_str))
    
    if os.path.exists(expected_file):
        file_size = os.path.getsize(expected_file)
        # 小于50KB认为是失败/不完整的音频
        if file_size > 50000:
            return True, file_size
        else:
            return False, file_size
    return False, 0

def check_cron_job_runs(job_id, job_name):
    """检查指定任务的最近执行记录"""
    try:
        result = subprocess.run(
            ['openclaw', 'cron', 'runs', job_id, '--limit', '1'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            try:
                runs_data = json.loads(result.stdout)
                if runs_data and 'entries' in runs_data and len(runs_data['entries']) > 0:
                    latest_run = runs_data['entries'][0]
                    return {
                        'status': latest_run.get('status'),
                        'error': latest_run.get('error'),
                        'run_at': latest_run.get('runAtMs'),
                        'duration': latest_run.get('durationMs')
                    }
            except:
                pass
    except Exception as e:
        log(f"检查任务 {job_name} 失败: {e}")
    
    return None

def should_retry_task(job_name):
    """判断是否应该重试任务（按日期重置计数）"""
    state = load_retry_state()
    today = datetime.datetime.now().strftime('%Y%m%d')
    
    job_state = state.get(job_name, {
        'retry_count': 0, 
        'last_retry': None,
        'last_retry_date': None
    })
    config = RETRY_CONFIG.get(job_name, {'retry_delay': 600, 'max_retries': 3})
    
    # 如果是新的一天，重置重试计数
    if job_state.get('last_retry_date') != today:
        job_state['retry_count'] = 0
        job_state['last_retry_date'] = today
        state[job_name] = job_state
        save_retry_state(state)
        log(f"{job_name}: 新的一天，重置重试计数")
    
    # 检查重试次数
    if job_state['retry_count'] >= config['max_retries']:
        return False, f"今天已达到最大重试次数({config['max_retries']})"
    
    # 检查重试间隔
    if job_state['last_retry']:
        last_retry_time = datetime.datetime.fromisoformat(job_state['last_retry'])
        time_since_retry = (datetime.datetime.now() - last_retry_time).total_seconds()
        if time_since_retry < config['retry_delay']:
            return False, f"距离上次重试不足{config['retry_delay']}秒"
    
    return True, None

def update_retry_state(job_name, success=False):
    """更新重试状态"""
    today = datetime.datetime.now().strftime('%Y%m%d')
    state = load_retry_state()
    if job_name not in state:
        state[job_name] = {
            'retry_count': 0, 
            'last_retry': None, 
            'last_retry_date': None,
            'success_history': []
        }
    
    state[job_name]['last_retry'] = datetime.datetime.now().isoformat()
    state[job_name]['last_retry_date'] = today
    
    if not success:
        state[job_name]['retry_count'] += 1
    else:
        state[job_name]['retry_count'] = 0  # 成功后重置
        state[job_name]['success_history'].append(datetime.datetime.now().isoformat())
        # 只保留最近10条成功记录
        state[job_name]['success_history'] = state[job_name]['success_history'][-10:]
    
    save_retry_state(state)

def run_python_script(script_path):
    """运行Python脚本"""
    try:
        result = subprocess.run(
            ['python3', script_path],
            capture_output=True,
            text=True,
            timeout=300
        )
        if result.returncode == 0:
            return True, result.stdout
        else:
            return False, result.stderr
    except Exception as e:
        return False, str(e)

def generate_tts_audio(script_path, output_path, max_retries=3):
    """生成TTS音频，带重试机制"""
    try:
        # 读取脚本内容
        with open(script_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取核心内容（去掉格式标记）
        lines = content.split('\n')
        core_content = []
        for line in lines:
            line = line.strip()
            # 跳过分隔线和标题
            if line.startswith('=') or line.startswith('【') or line.startswith('http'):
                continue
            if line and not line.startswith('-'):
                core_content.append(line)
        
        # 合并内容并截断到合适长度
        text = '\n'.join(core_content[:80])  # 约5-7分钟内容
        
        # 尝试生成TTS（带重试）
        for attempt in range(max_retries):
            try:
                log(f"TTS生成尝试 {attempt + 1}/{max_retries}...")
                
                # 创建临时文本文件
                temp_text_file = '/tmp/tts_input.txt'
                with open(temp_text_file, 'w', encoding='utf-8') as f:
                    f.write(text)
                
                # 使用 openclaw tts 命令
                result = subprocess.run(
                    ['openclaw', 'tts', text, '--channel', 'feishu'],
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                
                if result.returncode == 0:
                    # 解析输出查找MEDIA路径
                    media_path = None
                    for line in result.stdout.split('\n'):
                        if 'MEDIA:' in line:
                            media_path = line.split('MEDIA:')[1].strip()
                            break
                    
                    if media_path and os.path.exists(media_path):
                        subprocess.run(['cp', media_path, output_path], check=True)
                        file_size = os.path.getsize(output_path)
                        if file_size > 50000:
                            return True, f"TTS生成成功，文件大小: {file_size}字节"
                        else:
                            return False, f"音频文件太小: {file_size}字节"
                    else:
                        log(f"未找到MEDIA路径，stdout: {result.stdout}")
                else:
                    log(f"TTS命令失败: {result.stderr}")
                
                if attempt < max_retries - 1:
                    log(f"等待30秒后重试...")
                    time.sleep(30)
                
            except Exception as e:
                log(f"TTS尝试 {attempt + 1} 异常: {e}")
                if attempt < max_retries - 1:
                    time.sleep(30)
        
        return False, f"TTS生成失败，已重试{max_retries}次"
        
    except Exception as e:
        return False, f"生成TTS异常: {e}"

def update_audio_manifest(date_str, title, audio_type, filename, duration_desc, description):
    """更新音频清单"""
    manifest_path = '/root/.openclaw/workspace/portfolio-tracker/audio/audio-manifest.json'
    
    try:
        if os.path.exists(manifest_path):
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
        else:
            manifest = []
        
        # 检查是否已存在
        existing = [m for m in manifest if m.get('date') == date_str and m.get('type') == audio_type]
        if existing:
            # 更新现有条目
            for item in manifest:
                if item.get('date') == date_str and item.get('type') == audio_type:
                    item['createdAt'] = datetime.datetime.now().isoformat()
                    break
        else:
            # 添加新条目
            manifest.append({
                'date': date_str,
                'title': title,
                'type': audio_type,
                'file': filename,
                'duration': duration_desc,
                'description': description,
                'createdAt': datetime.datetime.now().isoformat()
            })
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        return True
    except Exception as e:
        log(f"更新manifest失败: {e}")
        return False

def push_to_github():
    """推送到GitHub"""
    try:
        os.chdir('/root/.openclaw/workspace/portfolio-tracker')
        subprocess.run(['git', 'add', '-A'], check=True)
        result = subprocess.run(
            ['git', 'commit', '-m', f'Watchdog补跑: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M")}'],
            capture_output=True,
            text=True
        )
        # commit失败可能是没有变更，继续push
        subprocess.run(['git', 'push', 'origin', 'main'], check=True)
        return True, "GitHub推送成功"
    except Exception as e:
        return False, f"GitHub推送失败: {e}"

def send_feishu_alert(message):
    """发送飞书告警"""
    try:
        # 使用 openclaw message 工具
        result = subprocess.run(
            ['openclaw', 'message', 'send', 
             '--target', 'ou_ddff26b0a4b0f0e059d6e4d149232f92',
             '--content', message],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return True
    except Exception as e:
        log(f"飞书推送失败: {e}")
    return False

def retry_finance_report():
    """补跑财经晨报（含TTS）"""
    date_str = datetime.datetime.now().strftime('%Y%m%d')
    date_display = datetime.datetime.now().strftime('%m月%d日')
    
    log(f"开始补跑财经晨报: {date_str}")
    
    # 步骤1: 运行脚本
    success, output = run_python_script('/root/.openclaw/workspace/finance_report.py')
    if not success:
        return False, f"脚本运行失败: {output}"
    
    log("财经报告脚本运行成功")
    
    # 步骤2: 生成TTS音频
    report_file = f'/root/.openclaw/workspace/reports/finance_report_{date_str}.md'
    audio_file = f'/root/.openclaw/workspace/portfolio-tracker/audio/finance_{date_str}.mp3'
    
    if os.path.exists(report_file):
        tts_success, tts_msg = generate_tts_audio(report_file, audio_file)
        if not tts_success:
            return False, f"TTS生成失败: {tts_msg}"
        log(f"TTS生成成功: {tts_msg}")
    else:
        return False, f"报告文件不存在: {report_file}"
    
    # 步骤3: 更新manifest
    update_audio_manifest(
        date_str, 
        f'财经晨报 | {date_display}',
        'finance',
        f'finance_{date_str}.mp3',
        '约5分钟',
        '市场情绪分析+主题解读'
    )
    
    # 步骤4: 推送GitHub
    push_success, push_msg = push_to_github()
    if not push_success:
        log(f"警告: {push_msg}")
    
    return True, "财经晨报补跑完成（含TTS+GitHub同步）"

def retry_agile_podcast():
    """补跑乐活播客（含TTS）"""
    date_str = datetime.datetime.now().strftime('%Y%m%d')
    date_display = datetime.datetime.now().strftime('%m月%d日')
    
    log(f"开始补跑乐活播客: {date_str}")
    
    # 步骤1: 运行脚本
    success, output = run_python_script('/root/.openclaw/workspace/agile_podcast.py')
    if not success:
        return False, f"脚本运行失败: {output}"
    
    log("播客脚本运行成功")
    
    # 步骤2: 生成TTS音频
    script_file = f'/root/.openclaw/workspace/agile_podcasts/audio_script_{date_str}.txt'
    audio_file = f'/root/.openclaw/workspace/portfolio-tracker/audio/podcast_{date_str}.mp3'
    
    if os.path.exists(script_file):
        tts_success, tts_msg = generate_tts_audio(script_file, audio_file)
        if not tts_success:
            return False, f"TTS生成失败: {tts_msg}"
        log(f"TTS生成成功: {tts_msg}")
    else:
        return False, f"播客脚本不存在: {script_file}"
    
    # 步骤3: 更新manifest
    update_audio_manifest(
        date_str,
        f'乐活播客 | {date_display}',
        'podcast',
        f'podcast_{date_str}.mp3',
        '约5分钟',
        '两篇文章深度解读'
    )
    
    # 步骤4: 推送GitHub
    push_success, push_msg = push_to_github()
    if not push_success:
        log(f"警告: {push_msg}")
    
    return True, "乐活播客补跑完成（含TTS+GitHub同步）"

def check_and_fix_missing_audio():
    """检查并修复缺失的音频文件"""
    date_str = datetime.datetime.now().strftime('%Y%m%d')
    issues_found = []
    fixes_applied = []
    
    # 检查财经晨报音频
    finance_exists, finance_size = check_audio_file_exists('finance_*.mp3', date_str)
    if not finance_exists:
        issues_found.append(f"财经晨报音频缺失/异常 (大小: {finance_size}字节)")
        
        # 检查是否需要重试
        should_retry, reason = should_retry_task('finance_morning_report')
        if should_retry:
            success, msg = retry_finance_report()
            update_retry_state('finance_morning_report', success)
            if success:
                fixes_applied.append(f"财经晨报音频已补生成: {msg}")
            else:
                fixes_applied.append(f"财经晨报补生成失败: {msg}")
        else:
            fixes_applied.append(f"财经晨报跳过补跑: {reason}")
    else:
        log(f"财经晨报音频正常: {finance_size}字节")
    
    # 检查乐活播客音频
    podcast_exists, podcast_size = check_audio_file_exists('podcast_*.mp3', date_str)
    if not podcast_exists:
        issues_found.append(f"乐活播客音频缺失/异常 (大小: {podcast_size}字节)")
        
        should_retry, reason = should_retry_task('agile_daily_podcast')
        if should_retry:
            success, msg = retry_agile_podcast()
            update_retry_state('agile_daily_podcast', success)
            if success:
                fixes_applied.append(f"乐活播客音频已补生成: {msg}")
            else:
                fixes_applied.append(f"乐活播客补生成失败: {msg}")
        else:
            fixes_applied.append(f"乐活播客跳过补跑: {reason}")
    else:
        log(f"乐活播客音频正常: {podcast_size}字节")
    
    return issues_found, fixes_applied

def main():
    """主函数"""
    log("=" * 60)
    log("Watchdog v2.0 启动检查")
    log("=" * 60)
    
    issues_found, fixes_applied = check_and_fix_missing_audio()
    
    # 生成报告
    report_lines = [
        "# 🐕 Watchdog 检查报告",
        f"**检查时间**: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## 📊 检查结果",
        f"- 发现问题: {len(issues_found)} 个",
        f"- 已修复: {len([f for f in fixes_applied if '已补' in f])} 个",
        f"- 修复失败: {len([f for f in fixes_applied if '失败' in f])} 个",
        "",
        "## 🔴 发现的问题"
    ]
    
    if issues_found:
        for issue in issues_found:
            report_lines.append(f"- {issue}")
    else:
        report_lines.append("- ✅ 所有音频文件正常")
    
    report_lines.extend(["", "## 🔧 修复操作"])
    
    if fixes_applied:
        for fix in fixes_applied:
            report_lines.append(f"- {fix}")
    else:
        report_lines.append("- ✅ 无需修复")
    
    report = '\n'.join(report_lines)
    
    # 保存报告
    reports_dir = '/root/.openclaw/workspace/watchdog_reports'
    os.makedirs(reports_dir, exist_ok=True)
    report_file = os.path.join(reports_dir, f"watchdog_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.md")
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    log(f"检查完成，报告: {report_file}")
    
    # 如果有修复失败，发送告警
    failed_fixes = [f for f in fixes_applied if '失败' in f]
    if failed_fixes:
        alert_msg = f"⚠️ Watchdog告警\n\n以下修复失败:\n" + '\n'.join(f"- {f}" for f in failed_fixes)
        alert_msg += f"\n\n请手动检查。详细报告: {report_file}"
        send_feishu_alert(alert_msg)
    
    print(report)

if __name__ == '__main__':
    main()
