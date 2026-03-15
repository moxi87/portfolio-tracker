// 实时行情模块 v2.0
const MarketData = {
    // 新浪股票 API（免费，免密钥）
    async fetchSinaQuotes(codes) {
        // 将代码转换为新浪格式
        const sinaCodes = codes.map(code => {
            if (code.startsWith('6')) return 'sh' + code; // 上海
            return 'sz' + code; // 深圳
        }).join(',');
        
        try {
            // 使用 allorigins 解决跨域
            const url = `https://hq.sinajs.cn/list=${sinaCodes}`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            
            const response = await fetch(proxyUrl);
            const data = await response.json();
            return this.parseSinaData(data.contents);
        } catch (e) {
            console.error('行情获取失败:', e);
            return null;
        }
    },
    
    parseSinaData(data) {
        const result = {};
        const lines = data.split(';');
        
        lines.forEach(line => {
            const match = line.match(/var hq_str_(\w+)="([^"]*)"/);
            if (match) {
                const code = match[1].replace(/^(sh|sz)/, '');
                const parts = match[2].split(',');
                if (parts.length >= 33) {
                    result[code] = {
                        name: parts[0],
                        open: parseFloat(parts[1]),
                        close: parseFloat(parts[2]),
                        current: parseFloat(parts[3]),
                        high: parseFloat(parts[4]),
                        low: parseFloat(parts[5]),
                        volume: parseInt(parts[8]),
                        amount: parseFloat(parts[9]),
                        change: parseFloat(parts[3]) - parseFloat(parts[2]),
                        changePercent: ((parseFloat(parts[3]) - parseFloat(parts[2])) / parseFloat(parts[2]) * 100).toFixed(2),
                        updateTime: `${parts[31]} ${parts[32]}`
                    };
                }
            }
        });
        
        return result;
    },
    
    // 更新持仓股票实时价格
    async updateStockPrices() {
        const stockCodes = portfolio.stocks.map(s => s.code);
        const quotes = await this.fetchSinaQuotes(stockCodes);
        
        if (quotes) {
            portfolio.stocks.forEach(stock => {
                const quote = quotes[stock.code];
                if (quote) {
                    stock.price = quote.current;
                    stock.change = quote.change;
                    stock.changePercent = parseFloat(quote.changePercent);
                    stock.marketValue = stock.shares * quote.current;
                    stock.high = quote.high;
                    stock.low = quote.low;
                    stock.volume = quote.volume;
                }
            });
            
            // 重新计算汇总
            this.recalculatePortfolio();
            
            // 刷新显示
            refreshDisplay();
            
            return true;
        }
        return false;
    },
    
    recalculatePortfolio() {
        const stockTotal = portfolio.stocks.reduce((s, s2) => s + s2.marketValue, 0);
        const fundTotal = portfolio.funds.reduce((s, f) => s + f.value, 0);
        const totalAssets = fundTotal + stockTotal;
        
        // 更新全局变量
        window.stockTotal = stockTotal;
        window.totalAssets = totalAssets;
        window.totalDaily = portfolio.funds.reduce((s, f) => s + f.daily, 0) + 
                           portfolio.stocks.reduce((s, s2) => s + s2.change * s2.shares, 0);
    },
    
    // 自动刷新（每30秒）
    startAutoRefresh() {
        this.updateStockPrices();
        setInterval(() => {
            this.updateStockPrices();
        }, 30000); // 30秒刷新一次
    }
};

// 新闻舆情模块
const NewsFeed = {
    // 持仓相关新闻关键词
    getKeywords() {
        return [
            { name: '比亚迪', code: '002594', keywords: ['比亚迪', 'BYD', '新能源汽车'] },
            { name: '中科曙光', code: '603019', keywords: ['中科曙光', '服务器', '芯片'] },
            { name: '电网设备', code: '601669', keywords: ['中国电建', '电网', '基建'] },
            { name: '洛阳钼业', code: '603993', keywords: ['洛阳钼业', '有色金属', '钴'] },
            { name: '新能源', keywords: ['新能源', '锂电池', '光伏'] },
            { name: '人工智能', keywords: ['人工智能', 'AI', '算力'] }
        ];
    },
    
    // 模拟新闻数据（实际可对接新闻API）
    getMockNews() {
        return [
            {
                title: '比亚迪2月销量同比增长55%，新能源车市占率继续领先',
                source: '财联社',
                time: '2小时前',
                sentiment: 'positive',
                related: ['比亚迪', '新能源汽车'],
                summary: '比亚迪2月新能源汽车销量超32万辆，同比增长55.3%，市场份额持续扩大。'
            },
            {
                title: '中科曙光：AI服务器订单饱满，国产替代加速',
                source: '证券时报',
                time: '4小时前',
                sentiment: 'positive',
                related: ['中科曙光', 'AI', '服务器'],
                summary: '公司表示AI服务器订单已排至下半年，受益于国产替代趋势，业绩有望改善。'
            },
            {
                title: '新能源板块今日领涨，宁德时代大涨5%',
                source: '华尔街见闻',
                time: '5小时前',
                sentiment: 'positive',
                related: ['新能源', '锂电池'],
                summary: '受政策利好刺激，新能源板块今日集体走强，多只龙头股涨停。'
            },
            {
                title: '有色金属板块震荡调整，洛阳钼业小幅下跌',
                source: '新浪财经',
                time: '6小时前',
                sentiment: 'neutral',
                related: ['洛阳钼业', '有色金属'],
                summary: '国际铜价波动，有色金属板块今日震荡整理，个股涨跌互现。'
            },
            {
                title: '港股恒生科技指数反弹，科技股集体回暖',
                source: '腾讯财经',
                time: '3小时前',
                sentiment: 'positive',
                related: ['恒生科技', '港股'],
                summary: '港股今日高开高走，恒生科技指数涨幅超2%，阿里巴巴、美团等大涨。'
            },
            {
                title: '专家提示：AI概念股估值偏高，需警惕回调风险',
                source: '第一财经',
                time: '8小时前',
                sentiment: 'negative',
                related: ['人工智能', '科技股'],
                summary: '分析师表示，当前AI板块估值已处于历史高位，建议谨慎追高。'
            }
        ];
    },
    
    // 渲染新闻面板
    renderNewsPanel() {
        const news = this.getMockNews();
        const sentimentColors = {
            positive: 'text-green-600 bg-green-50 border-green-100',
            negative: 'text-red-600 bg-red-50 border-red-100',
            neutral: 'text-gray-600 bg-gray-50 border-gray-100'
        };
        const sentimentLabels = {
            positive: '利好',
            negative: '利空',
            neutral: '中性'
        };
        
        return `
            <div class="space-y-4">
                <div class="flex gap-2 mb-4">
                    <button onclick="filterNews('all')" class="px-3 py-1 rounded-full text-xs font-medium bg-indigo-500 text-white">全部</button>
                    <button onclick="filterNews('positive')" class="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 hover:bg-green-100 hover:text-green-600">利好</button>
                    <button onclick="filterNews('negative')" class="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600">利空</button>
                </div>
                
                ${news.map(item => `
                    <div class="p-4 rounded-xl border ${sentimentColors[item.sentiment]} news-item" data-sentiment="${item.sentiment}">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-bold text-sm pr-4">${item.title}</h4>
                            <span class="text-xs px-2 py-1 rounded-full bg-white/50 whitespace-nowrap">${sentimentLabels[item.sentiment]}</span>
                        </div>
                        <p class="text-xs text-gray-600 mb-2">${item.summary}</p>
                        <div class="flex justify-between items-center text-xs text-gray-400">
                            <div class="flex gap-2">
                                <span>${item.source}</span>
                                <span>•</span>
                                <span>${item.time}</span>
                            </div>
                            <div class="flex gap-1">
                                ${item.related.map(tag => `<span class="px-2 py-0.5 bg-white/50 rounded">${tag}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// 新闻过滤
function filterNews(type) {
    const items = document.querySelectorAll('.news-item');
    items.forEach(item => {
        if (type === 'all' || item.dataset.sentiment === type) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// 刷新显示
function refreshDisplay() {
    // 更新总览
    const stockTotal = portfolio.stocks.reduce((s, s2) => s + s2.marketValue, 0);
    const fundTotal = portfolio.funds.reduce((s, f) => s + f.value, 0);
    const totalAssets = fundTotal + stockTotal;
    const stockDaily = portfolio.stocks.reduce((s, s2) => s + s2.change * s2.shares, 0);
    const fundDaily = portfolio.funds.reduce((s, f) => s + f.daily, 0);
    const totalDaily = fundDaily + stockDaily;
    
    document.getElementById('totalAssets').textContent = formatMoney(totalAssets);
    
    const dailyEl = document.getElementById('dailyPnL');
    dailyEl.textContent = (totalDaily >= 0 ? '+' : '-') + formatMoney(totalDaily);
    dailyEl.className = 'text-lg md:text-2xl font-bold ' + (totalDaily >= 0 ? 'trend-up' : 'trend-down');
    
    const dailyPct = document.getElementById('dailyPercent');
    dailyPct.textContent = formatPercent(totalDaily / (totalAssets - totalDaily) * 100);
    dailyPct.className = 'text-xs mt-1 ' + (totalDaily >= 0 ? 'trend-up' : 'trend-down');
    
    // 刷新股票表格
    renderStocksTab();
    
    showNotification('实时行情已更新', 'success');
}
