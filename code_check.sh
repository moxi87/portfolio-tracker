#!/bin/bash
# Portfolio Pro 代码质量检查脚本

echo "========================================"
echo "Portfolio Pro 代码质量检查"
echo "========================================"

cd /root/.openclaw/workspace/portfolio-tracker-new

echo ""
echo "1. HTML 文件基础检查"
echo "----------------------------------------"

# 检查文件大小
FILE_SIZE=$(stat -c%s "index.html")
echo "📄 index.html 大小: $FILE_SIZE bytes ($(echo "scale=2; $FILE_SIZE/1024" | bc) KB)"

# 检查关键标签
if grep -q "<!DOCTYPE html>" index.html; then
    echo "✅ DOCTYPE 声明存在"
else
    echo "❌ 缺少 DOCTYPE 声明"
fi

if grep -q "<html lang=\"zh-CN\">" index.html; then
    echo "✅ 语言设置正确 (zh-CN)"
else
    echo "❌ 语言设置不正确"
fi

if grep -q "<meta charset=\"UTF-8\">" index.html; then
    echo "✅ UTF-8 编码设置正确"
else
    echo "❌ 编码设置不正确"
fi

if grep -q "<meta name=\"viewport\"" index.html; then
    echo "✅ Viewport 设置存在"
else
    echo "❌ 缺少 Viewport 设置"
fi

echo ""
echo "2. JavaScript 语法检查 (关键函数)"
echo "----------------------------------------"

# 检查关键函数定义
FUNCTIONS=("init" "loadFromJSON" "loadFromLocalStorage" "renderData" "renderPerformanceChart" "renderStocksTab" "submitDailyUpdate" "syncData" "isMarketOpen")
for func in "${FUNCTIONS[@]}"; do
    if grep -q "function $func(" index.html; then
        echo "✅ 函数 $func 已定义"
    else
        echo "❌ 函数 $func 未定义"
    fi
done

echo ""
echo "3. DOM 元素 ID 检查"
echo "----------------------------------------"

# 检查关键 DOM 元素
ELEMENTS=("totalAssets" "dailyPnL" "totalPnL" "dataDate" "performanceChart" "tab-stocks" "tab-funds" "tab-history" "marketStatus")
for elem in "${ELEMENTS[@]}"; do
    if grep -q "id=\"$elem\"" index.html || grep -q "id='$elem'" index.html; then
        echo "✅ DOM 元素 #$elem 存在"
    else
        echo "❌ DOM 元素 #$elem 缺失"
    fi
done

echo ""
echo "4. 外部依赖检查"
echo "----------------------------------------"

# 检查 CDN 引用
CDNS=("tailwindcss.com" "chart.js" "font-awesome" "googleapis.com")
for cdn in "${CDNS[@]}"; do
    if grep -q "$cdn" index.html; then
        echo "✅ CDN 引用: $cdn"
    else
        echo "❌ 缺少 CDN: $cdn"
    fi
done

echo ""
echo "5. 版本一致性检查"
echo "----------------------------------------"

HTML_VERSION=$(grep -oP 'APP_VERSION = '\''\K[^'\''"]+' index.html || echo "未找到")
echo "📌 HTML 中的版本: $HTML_VERSION"

MENU_VERSION=$(grep -oP '版本: v[0-9.]+' index.html | head -1 || echo "未找到")
echo "📌 菜单中的版本: $MENU_VERSION"

echo ""
echo "6. JSON 数据文件检查"
echo "----------------------------------------"

if [ -f "portfolio-data.json" ]; then
    echo "✅ portfolio-data.json 存在"
    
    # 检查 JSON 格式
    if python3 -c "import json; json.load(open('portfolio-data.json'))" 2>/dev/null; then
        echo "✅ JSON 格式有效"
    else
        echo "❌ JSON 格式无效"
    fi
    
    # 检查必要字段
    if grep -q '"lastUpdate"' portfolio-data.json; then
        echo "✅ lastUpdate 字段存在"
    else
        echo "❌ lastUpdate 字段缺失"
    fi
    
    if grep -q '"funds"' portfolio-data.json; then
        echo "✅ funds 字段存在"
    else
        echo "❌ funds 字段缺失"
    fi
    
    if grep -q '"stocks"' portfolio-data.json; then
        echo "✅ stocks 字段存在"
    else
        echo "❌ stocks 字段缺失"
    fi
    
    if grep -q '"summary"' portfolio-data.json; then
        echo "✅ summary 字段存在"
    else
        echo "❌ summary 字段缺失"
    fi
else
    echo "❌ portfolio-data.json 不存在"
fi

echo ""
echo "7. GitHub Actions 工作流检查"
echo "----------------------------------------"

if [ -f ".github/workflows/update-data.yml" ]; then
    echo "✅ update-data.yml 存在"
    
    if grep -q "schedule:" .github/workflows/update-data.yml; then
        echo "✅ 定时任务配置存在"
    else
        echo "❌ 定时任务配置缺失"
    fi
    
    if grep -q "workflow_dispatch:" .github/workflows/update-data.yml; then
        echo "✅ 手动触发配置存在"
    else
        echo "❌ 手动触发配置缺失"
    fi
else
    echo "❌ GitHub Actions 工作流不存在"
fi

echo ""
echo "========================================"
echo "代码质量检查完成"
echo "========================================"
