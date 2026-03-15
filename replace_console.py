#!/usr/bin/env python3
import re

# 读取文件
with open('/root/.openclaw/workspace/portfolio-tracker-new/index.html', 'r') as f:
    content = f.read()

# 统计原始console数量
original_count = len(re.findall(r'console\.(log|warn|error)', content))
print(f'原始 console 语句数量: {original_count}')

# 替换策略：保留错误日志，将log/warn替换为条件日志
# 1. console.error 保留（用于真正的错误）
# 2. console.log 和 console.warn 替换为条件版本

# 替换 console.log( -> log(
content = re.sub(r'(?<!\w)console\.log\(', 'log(', content)

# 替换 console.warn( -> warn(
content = re.sub(r'(?<!\w)console\.warn\(', 'warn(', content)

# 不替换 console.error，但统计
error_count = len(re.findall(r'console\.error', content))
print(f'保留 console.error 数量: {error_count}')

# 检查是否还有未替换的console.log/warn
remaining_log = len(re.findall(r'(?<!\w)console\.log\(', content))
remaining_warn = len(re.findall(r'(?<!\w)console\.warn\(', content))
print(f'剩余未替换: console.log={remaining_log}, console.warn={remaining_warn}')

# 写入文件
with open('/root/.openclaw/workspace/portfolio-tracker-new/index.html', 'w') as f:
    f.write(content)

print('✅ Console 替换完成')

# 统计新的log/warn调用
new_log = len(re.findall(r'(?<!\w)log\(', content))
new_warn = len(re.findall(r'(?<!\w)warn\(', content))
print(f'新的 log() 调用: {new_log}')
print(f'新的 warn() 调用: {new_warn}')
