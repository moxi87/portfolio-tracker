#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音频修复工具 - 手动补生成缺失的TTS音频
使用方法: python3 fix_audio.py [finance|podcast|all]
"""

import sys
import os
import datetime
import subprocess

def generate_audio_with_tts_tool(text_content, output_path):
    """使用OpenClaw的tts工具生成音频"""
    # 由于无法直接导入tts模块，创建一个临时脚本来执行
    temp_script = '/tmp/generate_tts.py'
    
    script_content = f'''
import sys
sys.path.insert(0, '/usr/lib/node_modules/openclaw')

# 尝试直接调用tts功能
try:
    # 写入文本到临时文件
    with open('/tmp/tts_text.txt', 'w', encoding='utf-8') as f:
        f.write("""{text_content}""")
    
    print("TTS文本已准备，请使用以下方式生成音频:")
    print(f"输出路径: {output_path}")
except Exception as e:
    print(f"错误: {{e}}")
'''
    
    with open(temp_script, 'w', encoding='utf-8') as f:
        f.write(script_content)
    
    print("TTS生成需要人工干预，请手动执行以下步骤:")
    print(f"1. 检查文本内容: /tmp/tts_text.txt")
    print(f"2. 使用 openclaw tts 工具生成音频")
    print(f"3. 保存到: {output_path}")
    
    return False

def fix_finance_audio():
    """修复财经晨报音频"""
    date_str = datetime.datetime.now().strftime('%Y%m%d')
    report_file = f'/root/.openclaw/workspace/reports/finance_report_{date_str}.md'
    audio_file = f'/root/.openclaw/workspace/portfolio-tracker/audio/finance_{date_str}.mp3'
    
    if not os.path.exists(report_file):
        print(f"❌ 报告文件不存在: {report_file}")
        print("请先运行: python3 finance_report.py")
        return False
    
    print(f"📄 读取报告: {report_file}")
    with open(report_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取核心内容
    lines = content.split('\n')
    core_lines = []
    for line in lines[:100]:  # 取前100行
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('---'):
            core_lines.append(line)
    
    text = '\n'.join(core_lines[:60])  # 约5分钟内容
    
    print(f"🎯 生成音频: {audio_file}")
    print("\n" + "="*60)
    print("请复制以下内容，使用 OpenClaw TTS 工具生成音频:")
    print("="*60)
    print(text[:2000])  # 显示部分内容
    print("...")
    print(f"\n完整内容已保存到: /tmp/fix_audio_text.txt")
    
    with open('/tmp/fix_audio_text.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    
    return True

def fix_podcast_audio():
    """修复乐活播客音频"""
    date_str = datetime.datetime.now().strftime('%Y%m%d')
    script_file = f'/root/.openclaw/workspace/agile_podcasts/audio_script_{date_str}.txt'
    audio_file = f'/root/.openclaw/workspace/portfolio-tracker/audio/podcast_{date_str}.mp3'
    
    if not os.path.exists(script_file):
        print(f"❌ 播客脚本不存在: {script_file}")
        print("请先运行: python3 agile_podcast.py")
        return False
    
    print(f"📄 读取脚本: {script_file}")
    with open(script_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取核心内容
    lines = content.split('\n')
    core_lines = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith('=') and not line.startswith('【') and not line.startswith('http'):
            core_lines.append(line)
    
    text = '\n'.join(core_lines[:80])  # 约5-7分钟内容
    
    print(f"🎯 生成音频: {audio_file}")
    print("\n" + "="*60)
    print("请复制以下内容，使用 OpenClaw TTS 工具生成音频:")
    print("="*60)
    print(text[:2000])
    print("...")
    print(f"\n完整内容已保存到: /tmp/fix_audio_text.txt")
    
    with open('/tmp/fix_audio_text.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    
    return True

def update_manifest(date_str, title, audio_type, filename, duration, description):
    """更新音频清单"""
    import json
    
    manifest_path = '/root/.openclaw/workspace/portfolio-tracker/audio/audio-manifest.json'
    
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    else:
        manifest = []
    
    # 检查是否已存在
    existing = [m for m in manifest if m.get('date') == date_str and m.get('type') == audio_type]
    if existing:
        for item in manifest:
            if item.get('date') == date_str and item.get('type') == audio_type:
                item['createdAt'] = datetime.datetime.now().isoformat()
                break
    else:
        manifest.append({
            'date': date_str,
            'title': title,
            'type': audio_type,
            'file': filename,
            'duration': duration,
            'description': description,
            'createdAt': datetime.datetime.now().isoformat()
        })
    
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Manifest已更新")

def push_to_github():
    """推送到GitHub"""
    try:
        os.chdir('/root/.openclaw/workspace/portfolio-tracker')
        subprocess.run(['git', 'add', '-A'], check=True)
        subprocess.run(
            ['git', 'commit', '-m', f'修复: 补生成音频 {datetime.datetime.now().strftime("%Y-%m-%d %H:%M")}'],
            capture_output=True
        )
        subprocess.run(['git', 'push', 'origin', 'main'], check=True)
        print("✅ GitHub推送成功")
        return True
    except Exception as e:
        print(f"⚠️ GitHub推送失败: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("用法: python3 fix_audio.py [finance|podcast|all]")
        print("")
        print("选项:")
        print("  finance  - 修复财经晨报音频")
        print("  podcast  - 修复乐活播客音频")
        print("  all      - 修复所有缺失音频")
        return
    
    target = sys.argv[1]
    date_str = datetime.datetime.now().strftime('%Y%m%d')
    date_display = datetime.datetime.now().strftime('%m月%d日')
    
    if target in ['finance', 'all']:
        print("="*60)
        print("🔧 修复财经晨报音频")
        print("="*60)
        if fix_finance_audio():
            # 提示用户手动生成后更新manifest
            print("\n⚠️ 请手动生成音频后，运行以下命令更新清单和推送:")
            print(f"  python3 -c \"import fix_audio; fix_audio.update_manifest('{date_str}', '财经晨报 | {date_display}', 'finance', 'finance_{date_str}.mp3', '约5分钟', '市场情绪分析+主题解读')\"")
            print(f"  python3 -c \"import fix_audio; fix_audio.push_to_github()\"")
    
    if target in ['podcast', 'all']:
        print("\n" + "="*60)
        print("🔧 修复乐活播客音频")
        print("="*60)
        if fix_podcast_audio():
            print("\n⚠️ 请手动生成音频后，运行以下命令更新清单和推送:")
            print(f"  python3 -c \"import fix_audio; fix_audio.update_manifest('{date_str}', '乐活播客 | {date_display}', 'podcast', 'podcast_{date_str}.mp3', '约5分钟', '两篇文章深度解读')\"")
            print(f"  python3 -c \"import fix_audio; fix_audio.push_to_github()\"")

if __name__ == '__main__':
    main()
