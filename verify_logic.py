#!/usr/bin/env python3
# Portfolio Pro 数据流和功能逻辑验证

import json
import os
import re

def check_json_data():
    """验证 portfolio-data.json 数据完整性"""
    print("=" * 60)
    print("数据文件验证")
    print("=" * 60)
    
    with open('/root/.openclaw/workspace/portfolio-tracker-new/portfolio-data.json', 'r') as f:
        data = json.load(f)
    
    # 检查顶层字段
    required_fields = ['lastUpdate', 'lastSync', 'funds', 'stocks', 'summary']
    for field in required_fields:
        if field in data:
            print(f"✅ {field} 存在")
        else:
            print(f"❌ {field} 缺失")
    
    print("\n--- 基金数据检查 ---")
    funds = data.get('funds', [])
    print(f"📊 基金数量: {len(funds)}")
    
    fund_required = ['name', 'code', 'marketValue']
    for i, fund in enumerate(funds[:3]):  # 检查前3条
        print(f"\n  基金 {i+1}: {fund.get('name', 'N/A')}")
        for field in fund_required:
            if field in fund:
                print(f"    ✅ {field}: {fund[field]}")
            else:
                print(f"    ❌ {field} 缺失")
    
    print("\n--- 股票数据检查 ---")
    stocks = data.get('stocks', [])
    print(f"📊 股票数量: {len(stocks)}")
    
    stock_required = ['name', 'code', 'marketValue']
    for i, stock in enumerate(stocks[:3]):  # 检查前3条
        print(f"\n  股票 {i+1}: {stock.get('name', 'N/A')}")
        for field in stock_required:
            if field in stock:
                print(f"    ✅ {field}: {stock[field]}")
            else:
                print(f"    ❌ {field} 缺失")
    
    print("\n--- 汇总数据检查 ---")
    summary = data.get('summary', {})
    summary_fields = ['totalAssets', 'fundValue', 'stockValue', 'dailyPnL', 'totalPnL']
    for field in summary_fields:
        if field in summary:
            print(f"  ✅ {field}: {summary[field]:,.2f}")
        else:
            print(f"  ❌ {field} 缺失")
    
    # 数据一致性检查
    print("\n--- 数据一致性验证 ---")
    calc_fund_value = sum(f.get('marketValue', 0) for f in funds)
    calc_stock_value = sum(s.get('marketValue', 0) for s in stocks)
    calc_total = calc_fund_value + calc_stock_value
    
    stored_total = summary.get('totalAssets', 0)
    stored_fund = summary.get('fundValue', 0)
    stored_stock = summary.get('stockValue', 0)
    
    if abs(calc_total - stored_total) < 0.01:
        print(f"✅ 总资产一致: 计算值={calc_total:,.2f}, 存储值={stored_total:,.2f}")
    else:
        print(f"❌ 总资产不一致: 计算值={calc_total:,.2f}, 存储值={stored_total:,.2f}")
    
    if abs(calc_fund_value - stored_fund) < 0.01:
        print(f"✅ 基金总值一致: 计算值={calc_fund_value:,.2f}, 存储值={stored_fund:,.2f}")
    else:
        print(f"❌ 基金总值不一致: 计算值={calc_fund_value:,.2f}, 存储值={stored_fund:,.2f}")
    
    if abs(calc_stock_value - stored_stock) < 0.01:
        print(f"✅ 股票总值一致: 计算值={calc_stock_value:,.2f}, 存储值={stored_stock:,.2f}")
    else:
        print(f"❌ 股票总值不一致: 计算值={calc_stock_value:,.2f}, 存储值={stored_stock:,.2f}")

def check_javascript_logic():
    """检查 JavaScript 逻辑问题"""
    print("\n" + "=" * 60)
    print("JavaScript 逻辑验证")
    print("=" * 60)
    
    with open('/root/.openclaw/workspace/portfolio-tracker-new/index.html', 'r') as f:
        html = f.read()
    
    # 提取 script 部分
    script_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
    if not script_match:
        print("❌ 找不到 script 标签")
        return
    
    js = script_match.group(1)
    
    # 检查潜在问题
    issues = []
    
    # 1. 检查重复 ID 定义
    if js.count("document.getElementById('dataDate')") > 2:
        issues.append("⚠️ dataDate 元素被多次获取，可能影响性能")
    
    # 2. 检查空数组处理
    if "data.stocks || []" in js:
        print("✅ 股票数组有空值保护")
    else:
        issues.append("⚠️ 股票数组可能缺少空值保护")
    
    if "data.funds || []" in js:
        print("✅ 基金数组有空值保护")
    else:
        issues.append("⚠️ 基金数组可能缺少空值保护")
    
    # 3. 检查错误处理
    try_catch_count = len(re.findall(r'try\s*\{', js))
    print(f"📊 try-catch 块数量: {try_catch_count}")
    
    # 4. 检查 console.log 遗留
    console_logs = len(re.findall(r'console\.(log|error|warn)', js))
    print(f"📊 console 语句数量: {console_logs} (生产环境建议移除)")
    
    # 5. 检查 fetch 错误处理
    fetch_calls = len(re.findall(r'fetch\(', js))
    fetch_catches = len(re.findall(r'\.catch\(', js))
    print(f"📊 fetch 调用: {fetch_calls}, catch 处理: {fetch_catches}")
    if fetch_calls > fetch_catches:
        issues.append(f"⚠️ 部分 fetch 调用缺少 catch 处理 ({fetch_calls - fetch_catches} 处)")
    
    # 6. 检查 hardcoded 数据
    if "394589.49" in js or "370000" in js:
        issues.append("⚠️ 发现硬编码数值 (如 394589.49, 370000)")
    
    # 7. 检查 Beta 值计算
    if "betas = {" in js:
        print("✅ Beta 值计算有行业映射")
    
    # 8. 检查 localStorage 使用
    localstorage_sets = len(re.findall(r'localStorage\.setItem', js))
    localstorage_gets = len(re.findall(r'localStorage\.getItem', js))
    print(f"📊 localStorage.setItem: {localstorage_sets}, getItem: {localstorage_gets}")
    
    for issue in issues:
        print(issue)

def check_modules():
    """检查模块文件"""
    print("\n" + "=" * 60)
    print("模块文件验证")
    print("=" * 60)
    
    modules = ['data_fetcher.js', 'feishu_notifier.js', 'modules.js', 'realtime.js']
    
    for module in modules:
        path = f'/root/.openclaw/workspace/portfolio-tracker-new/{module}'
        if os.path.exists(path):
            with open(path, 'r') as f:
                content = f.read()
            
            # 检查模块导出
            has_export = 'module.exports' in content or 'export ' in content or 'const ' in content
            
            # 检查是否被 index.html 引用
            with open('/root/.openclaw/workspace/portfolio-tracker-new/index.html', 'r') as html_file:
                html = html_file.read()
            is_referenced = module in html
            
            size = len(content)
            print(f"\n📄 {module} ({size} bytes)")
            print(f"   {'✅' if has_export else '⚠️'} 模块定义")
            print(f"   {'✅' if is_referenced else '❌'} 被 index.html 引用")
            
            if not is_referenced:
                print(f"   ⚠️ 警告: {module} 未被主页面引用，代码可能冗余")
        else:
            print(f"❌ {module} 不存在")

def check_github_actions():
    """检查 GitHub Actions 配置"""
    print("\n" + "=" * 60)
    print("GitHub Actions 验证")
    print("=" * 60)
    
    workflow_path = '/root/.openclaw/workspace/portfolio-tracker-new/.github/workflows/update-data.yml'
    
    with open(workflow_path, 'r') as f:
        workflow = f.read()
    
    # 检查关键配置
    checks = [
        ('定时触发', "schedule:"),
        ('手动触发', "workflow_dispatch:"),
        ('Node.js 20', "node-version: '20'"),
        ('Git 配置', "git config"),
        ('自动提交', "git commit"),
        ('自动推送', "github-push-action"),
    ]
    
    for name, pattern in checks:
        if pattern in workflow:
            print(f"✅ {name}")
        else:
            print(f"❌ {name} 缺失")
    
    # 检查 cron 时间
    cron_match = re.search(r"cron:\s*'([^']+)'", workflow)
    if cron_match:
        cron = cron_match.group(1)
        print(f"\n📅 定时设置: {cron}")
        if cron == '30 12 * * 1-5':
            print("   ✅ 工作日 20:30 (UTC+8) 运行")
        else:
            print("   ⚠️ 请确认时间设置是否正确")
    
    # 检查数据源 API
    apis = [
        ('新浪财经 API', 'hq.sinajs.cn'),
        ('天天基金 API', 'fundgz.1234567.com.cn'),
    ]
    
    print("\n📡 数据源配置:")
    for name, api in apis:
        if api in workflow:
            print(f"   ✅ {name} ({api})")
        else:
            print(f"   ❌ {name} 未配置")

def main():
    check_json_data()
    check_javascript_logic()
    check_modules()
    check_github_actions()
    
    print("\n" + "=" * 60)
    print("验证完成")
    print("=" * 60)

if __name__ == '__main__':
    main()
