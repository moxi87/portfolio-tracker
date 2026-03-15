#!/usr/bin/env python3
# Portfolio Pro API 可用性和外部依赖验证

import urllib.request
import urllib.error
import ssl
import json
import sys

def test_api(url, name, headers=None, timeout=10):
    """测试 API 可用性"""
    print(f"\n📡 测试 {name}")
    print(f"   URL: {url[:80]}...")
    
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(url, headers=headers or {})
        response = urllib.request.urlopen(req, timeout=timeout, context=ctx)
        
        status = response.getcode()
        content = response.read().decode('utf-8', errors='ignore')
        
        if status == 200:
            print(f"   ✅ HTTP {status}")
            return True, content
        else:
            print(f"   ⚠️ HTTP {status}")
            return False, content
            
    except urllib.error.HTTPError as e:
        print(f"   ❌ HTTP {e.code}: {e.reason}")
        return False, str(e)
    except urllib.error.URLError as e:
        print(f"   ❌ URL Error: {e.reason}")
        return False, str(e)
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False, str(e)

def test_cdn():
    """测试 CDN 可用性"""
    print("=" * 60)
    print("CDN 可用性测试")
    print("=" * 60)
    
    cdns = [
        ("Tailwind CSS", "https://cdn.tailwindcss.com"),
        ("Chart.js", "https://cdn.jsdelivr.net/npm/chart.js"),
        ("Font Awesome", "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"),
        ("Google Fonts", "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600,700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap"),
    ]
    
    all_ok = True
    for name, url in cdns:
        ok, _ = test_api(url, name)
        all_ok = all_ok and ok
    
    return all_ok

def test_data_apis():
    """测试数据 API"""
    print("\n" + "=" * 60)
    print("行情 API 可用性测试")
    print("=" * 60)
    
    # 测试新浪财经 API
    sina_headers = {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0'
    }
    
    # 测试比亚迪
    sina_url = "https://hq.sinajs.cn/list=sz002594"
    ok, content = test_api(sina_url, "新浪财经 - 股票行情", sina_headers)
    
    if ok:
        # 解析返回数据
        if 'var hq_str_' in content:
            print("   ✅ 返回格式正确")
            # 提取数据
            import re
            match = re.search(r'var hq_str_[^=]+="([^"]+)"', content)
            if match:
                parts = match.group(1).split(',')
                if len(parts) >= 33:
                    print(f"   📊 股票: {parts[0]}, 现价: {parts[3]}, 昨收: {parts[2]}")
        else:
            print("   ⚠️ 返回格式可能已改变")
    
    # 测试天天基金 API
    fund_url = "https://fundgz.1234567.com.cn/js/000001.js?rt=1234567890"
    ok, content = test_api(fund_url, "天天基金 - 基金净值")
    
    if ok:
        if 'jsonpgz(' in content:
            print("   ✅ 返回格式正确")
            try:
                import re
                match = re.search(r'jsonpgz\(([^)]+)\)', content)
                if match:
                    data = json.loads(match.group(1))
                    print(f"   📊 基金: {data.get('name')}, 净值: {data.get('dwjz')}")
            except:
                pass
        else:
            print("   ⚠️ 返回格式可能已改变")

def test_cors_proxy():
    """测试 CORS 代理"""
    print("\n" + "=" * 60)
    print("CORS 代理可用性测试")
    print("=" * 60)
    
    # index.html 中使用的 allorigins
    target = "https://hq.sinajs.cn/list=sh000001"
    proxy_url = f"https://api.allorigins.win/get?url={urllib.request.quote(target)}"
    
    ok, content = test_api(proxy_url, "AllOrigins CORS 代理")
    
    if ok:
        try:
            data = json.loads(content)
            if 'contents' in data:
                print("   ✅ 代理返回格式正确")
            else:
                print("   ⚠️ 代理返回格式异常")
        except:
            print("   ⚠️ 代理返回非 JSON 数据")

def check_api_usage_in_code():
    """检查代码中 API 使用情况"""
    print("\n" + "=" * 60)
    print("代码中 API 使用分析")
    print("=" * 60)
    
    with open('/root/.openclaw/workspace/portfolio-tracker-new/index.html', 'r') as f:
        html = f.read()
    
    with open('/root/.openclaw/workspace/portfolio-tracker-new/data_fetcher.js', 'r') as f:
        data_fetcher = f.read()
    
    # 检查 API 调用方式
    print("\n--- index.html 中的 API 调用 ---")
    
    # 检查是否直接使用新浪 API
    if 'hq.sinajs.cn' in html:
        print("✅ 直接调用新浪财经 API")
    
    # 检查是否使用代理
    if 'allorigins.win' in html:
        print("⚠️ 使用 allorigins 代理 (可能不稳定)")
    
    # 检查 fetch 调用
    fetch_count = html.count('fetch(')
    print(f"📊 fetch 调用次数: {fetch_count}")
    
    print("\n--- data_fetcher.js 中的 API 调用 ---")
    
    if 'hq.sinajs.cn' in data_fetcher:
        print("✅ 新浪财经 API 配置")
    
    if 'fundgz.1234567.com.cn' in data_fetcher:
        print("✅ 天天基金 API 配置")
    
    if 'allorigins.win' in data_fetcher:
        print("⚠️ 使用 allorigins 代理")
    
    # 检查错误处理
    if '.catch(' in data_fetcher:
        print("✅ 有 catch 错误处理")
    else:
        print("❌ 缺少 catch 错误处理")

def analyze_potential_issues():
    """分析潜在问题"""
    print("\n" + "=" * 60)
    print("潜在问题分析")
    print("=" * 60)
    
    issues = []
    
    # 1. 跨域问题
    issues.append({
        'level': 'HIGH',
        'category': '跨域',
        'issue': '直接使用新浪财经 API 会遇到 CORS 限制',
        'impact': '浏览器端无法直接获取数据',
        'solution': '使用 CORS 代理或服务器端转发'
    })
    
    # 2. 代理可靠性
    issues.append({
        'level': 'MEDIUM',
        'category': '可靠性',
        'issue': 'allorigins.win 是免费公共服务，可能不稳定或限速',
        'impact': '实时行情功能可能间歇性失效',
        'solution': '使用自建代理或备用代理服务'
    })
    
    # 3. API 变更风险
    issues.append({
        'level': 'MEDIUM',
        'category': '兼容性',
        'issue': '新浪财经和天天基金 API 是非官方接口，可能随时变更',
        'impact': '数据抓取功能可能突然失效',
        'solution': '监控 API 返回格式，准备备用数据源'
    })
    
    # 4. GitHub Actions 依赖
    issues.append({
        'level': 'LOW',
        'category': '部署',
        'issue': 'GitHub Actions 定时任务可能有延迟（几分钟到几小时）',
        'impact': '数据更新可能不及时',
        'solution': '添加手动触发选项（已存在）或备用更新机制'
    })
    
    # 5. 本地存储限制
    issues.append({
        'level': 'LOW',
        'category': '存储',
        'issue': 'localStorage 有 5MB 限制',
        'impact': '长期历史数据可能无法存储',
        'solution': '考虑 IndexedDB 或云端存储'
    })
    
    for issue in issues:
        emoji = '🔴' if issue['level'] == 'HIGH' else '🟡' if issue['level'] == 'MEDIUM' else '🟢'
        print(f"\n{emoji} [{issue['level']}] {issue['category']}")
        print(f"   问题: {issue['issue']}")
        print(f"   影响: {issue['impact']}")
        print(f"   建议: {issue['solution']}")

def main():
    print("Portfolio Pro API 和外部依赖验证")
    print("=" * 60)
    
    # 测试 CDN
    cdn_ok = test_cdn()
    
    # 测试数据 API
    test_data_apis()
    
    # 测试 CORS 代理
    test_cors_proxy()
    
    # 分析代码中的 API 使用
    check_api_usage_in_code()
    
    # 分析潜在问题
    analyze_potential_issues()
    
    print("\n" + "=" * 60)
    print("验证完成")
    print("=" * 60)

if __name__ == '__main__':
    main()
