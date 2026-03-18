// 持仓新闻模块 - P0
const positionNews = {
    newsCache: {},
    
    // 获取持仓标的的新闻
    async fetchNewsForPosition(code, name, category) {
        const cacheKey = `${code}_${new Date().toDateString()}`;
        if (this.newsCache[cacheKey]) {
            return this.newsCache[cacheKey];
        }
        
        try {
            // 根据类型选择搜索关键词
            const keyword = category === 'fund' ? name.replace(/[A-Z]/g, '') : name;
            
            // 使用东方财富新闻搜索
            const news = await this.fetchEastmoneyNews(keyword, code);
            
            this.newsCache[cacheKey] = news;
            return news;
        } catch (e) {
            console.error(`获取 ${name} 新闻失败:`, e);
            return [];
        }
    },
    
    // 从东方财富获取新闻
    async fetchEastmoneyNews(keyword, code) {
        try {
            // 由于跨域限制，这里返回模拟数据
            // 实际部署时需要通过后端代理或使用其他方案
            return this.generateMockNews(keyword, code);
        } catch (e) {
            console.error('获取新闻失败:', e);
            return [];
        }
    },
    
    // 生成模拟新闻（实际开发时替换为真实数据）
    generateMockNews(keyword, code) {
        const sentiments = ['positive', 'negative', 'neutral'];
        const templates = {
            positive: [
                `${keyword}业绩超预期，机构看好后市`,
                `${keyword}获主力增持，资金持续流入`,
                `${keyword}行业景气度提升，政策利好`,
                `${keyword}新产品发布，市场预期乐观`
            ],
            negative: [
                `${keyword}短期承压，需关注回调风险`,
                `${keyword}遭机构减持，资金流出明显`,
                `${keyword}行业竞争加剧，盈利预期下调`,
                `${keyword}技术面走弱，支撑位考验`
            ],
            neutral: [
                `${keyword}震荡整理，等待方向选择`,
                `${keyword}成交量萎缩，观望情绪浓厚`,
                `${keyword}跟随大盘波动，无明显异动`,
                `${keyword} analysts维持评级，目标价不变`
            ]
        };
        
        const news = [];
        const count = Math.floor(Math.random() * 3) + 2; // 2-4条
        
        for (let i = 0; i < count; i++) {
            const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
            const titles = templates[sentiment];
            const title = titles[Math.floor(Math.random() * titles.length)];
            
            news.push({
                id: `${code}_${i}`,
                title: title,
                source: ['财联社', '证券时报', '上海证券报', '华尔街见闻'][Math.floor(Math.random() * 4)],
                time: this.getRandomTime(),
                sentiment: sentiment,
                url: `#`,
                relevance: Math.floor(Math.random() * 30) + 70 // 70-100相关度
            });
        }
        
        return news.sort((a, b) => new Date(b.time) - new Date(a.time));
    },
    
    // 获取随机时间
    getRandomTime() {
        const now = new Date();
        const hours = Math.floor(Math.random() * 24);
        const minutes = Math.floor(Math.random() * 60);
        return `${now.toDateString()} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    },
    
    // 分析新闻情绪
    analyzeSentiment(text) {
        const positiveWords = ['利好', '上涨', '增持', '买入', '超预期', '景气', '突破', '强势'];
        const negativeWords = ['利空', '下跌', '减持', '卖出', '不及预期', '承压', '回调', '弱势'];
        
        let score = 0;
        positiveWords.forEach(w => { if (text.includes(w)) score++; });
        negativeWords.forEach(w => { if (text.includes(w)) score--; });
        
        if (score > 0) return 'positive';
        if (score < 0) return 'negative';
        return 'neutral';
    },
    
    // 获取所有持仓新闻
    async fetchAllPositionNews(portfolioData) {
        const allNews = [];
        const account = portfolioData.accounts?.default?.data;
        
        if (!account) return allNews;
        
        // 获取股票新闻
        if (account.stocks) {
            for (const stock of account.stocks) {
                const news = await this.fetchNewsForPosition(stock.code, stock.name, 'stock');
                news.forEach(n => {
                    n.code = stock.code;
                    n.name = stock.name;
                    n.category = '股票';
                    allNews.push(n);
                });
            }
        }
        
        // 获取基金新闻
        if (account.funds) {
            for (const fund of account.funds) {
                const news = await this.fetchNewsForPosition(fund.code, fund.name, 'fund');
                news.forEach(n => {
                    n.code = fund.code;
                    n.name = fund.name;
                    n.category = '基金';
                    allNews.push(n);
                });
            }
        }
        
        // 按时间排序
        return allNews.sort((a, b) => new Date(b.time) - new Date(a.time));
    },
    
    // 渲染新闻列表
    renderNewsList(containerId, news) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // 演示数据提示横幅
        const demoBanner = `
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <div class="flex items-center gap-2 text-amber-700">
                    <i class="fas fa-flask"></i>
                    <span class="text-sm font-medium">演示数据</span>
                    <span class="text-xs text-amber-600">- 真实新闻接入开发中</span>
                </div>
            </div>
        `;
        
        if (!news || news.length === 0) {
            container.innerHTML = demoBanner + '<div class="text-center py-8 text-gray-400">暂无新闻</div>';
            return;
        }
        
        const sentimentEmoji = {
            positive: '🟢',
            negative: '🔴',
            neutral: '⚪'
        };
        
        const sentimentClass = {
            positive: 'text-red-500',
            negative: 'text-green-500',
            neutral: 'text-gray-500'
        };
        
        let html = demoBanner + '<div class="space-y-3">';
        
        news.forEach(item => {
            html += `
                <div class="glass rounded-xl p-3 hover:bg-gray-50 transition-colors cursor-pointer" onclick="window.open('${item.url}', '_blank')">
                    <div class="flex items-start gap-3">
                        <div class="text-lg">${sentimentEmoji[item.sentiment]}</div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium text-gray-800 line-clamp-2">${item.title}</div>
                            <div class="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <span class="px-1.5 py-0.5 bg-gray-100 rounded">${item.category}</span>
                                <span>${item.name}</span>
                                <span>${item.source}</span>
                                <span>${item.time.split(' ')[1] || item.time}</span>
                                <span class="${sentimentClass[item.sentiment]}">相关度 ${item.relevance}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    // 获取重要新闻（利好/利空）
    getImportantNews(news) {
        return news.filter(n => n.sentiment !== 'neutral' && n.relevance >= 80);
    },
    
    // 生成飞书推送消息
    generateFeishuMessage(news) {
        const important = this.getImportantNews(news).slice(0, 5);
        if (important.length === 0) return null;
        
        let text = '📰 持仓重要新闻\n';
        text += '━'.repeat(28) + '\n\n';
        
        important.forEach(item => {
            const emoji = item.sentiment === 'positive' ? '🟢' : '🔴';
            text += `${emoji} ${item.name}\n`;
            text += `   ${item.title}\n`;
            text += `   来源: ${item.source} | 相关度: ${item.relevance}%\n\n`;
        });
        
        return text;
    }
};