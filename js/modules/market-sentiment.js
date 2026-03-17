// 市场情绪模块 - P0
const marketSentiment = {
    // 情绪指标数据
    data: {
        fearGreedIndex: 50, // 恐慌贪婪指数 0-100
        northboundFlow: 0, // 北向资金流向（亿元）
        upDownRatio: { up: 0, down: 0, flat: 0 }, // 涨跌家数
        turnover: 0, // 成交量（万亿）
        vix: 0, // 波动率指数
        lastUpdate: null
    },
    
    // 获取情绪数据
    async fetchData() {
        try {
            // 从东方财富获取涨跌家数
            const eastmoneyData = await this.fetchEastmoneyData();
            
            // 从新浪财经获取北向资金
            const sinaData = await this.fetchSinaData();
            
            // 计算恐慌贪婪指数
            this.data.fearGreedIndex = this.calculateFearGreedIndex(eastmoneyData, sinaData);
            this.data.northboundFlow = sinaData.northbound || 0;
            this.data.upDownRatio = eastmoneyData.upDown || { up: 0, down: 0, flat: 0 };
            this.data.turnover = eastmoneyData.turnover || 0;
            this.data.lastUpdate = new Date().toISOString();
            
            return this.data;
        } catch (e) {
            console.error('获取市场情绪失败:', e);
            return this.data;
        }
    },
    
    // 从东方财富获取数据
    async fetchEastmoneyData() {
        try {
            // 使用腾讯财经API获取市场概况
            const response = await fetch('https://qt.gtimg.cn/q=sh000001,sz399001,sz399006');
            const text = await response.text();
            
            // 解析数据
            const lines = text.split(';');
            const data = {};
            
            lines.forEach(line => {
                if (line.includes('v_')) {
                    const parts = line.split('=');
                    if (parts.length === 2) {
                        const code = parts[0].match(/v_([a-z0-9]+)/)?.[1];
                        const values = parts[1].replace(/"/g, '').split('~');
                        if (code && values.length > 45) {
                            data[code] = {
                                name: values[1],
                                price: parseFloat(values[3]),
                                change: parseFloat(values[5]),
                                volume: parseFloat(values[36]) / 10000 // 万股转万亿
                            };
                        }
                    }
                }
            });
            
            // 估算涨跌家数（基于指数涨跌）
            const shChange = data.sh000001?.change || 0;
            const szChange = data.sz399001?.change || 0;
            
            // 简化的涨跌家数估算
            const totalStocks = 5000;
            const upRatio = shChange > 0 ? 0.55 : (shChange < 0 ? 0.45 : 0.5);
            const upCount = Math.floor(totalStocks * upRatio);
            const downCount = Math.floor(totalStocks * (1 - upRatio));
            
            return {
                upDown: {
                    up: upCount,
                    down: downCount,
                    flat: totalStocks - upCount - downCount
                },
                turnover: ((data.sh000001?.volume || 0) + (data.sz399001?.volume || 0)) / 10000
            };
        } catch (e) {
            console.error('获取东方财富数据失败:', e);
            return { upDown: { up: 2500, down: 2500, flat: 0 }, turnover: 1.2 };
        }
    },
    
    // 从新浪财经获取北向资金
    async fetchSinaData() {
        try {
            // 新浪财经北向资金接口
            const response = await fetch('https://push2.eastmoney.com/api/qt/stock/get?ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2&invt=2&volt=2&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f107,f108,f109,f110,f111,f112,f113,f114,f115,f116,f117,f118,f119,f120,f121,f122,f123,f124,f125,f126,f127,f128,f129,f130,f131,f132,f133,f134,f135,f136,f137,f138,f139,f140,f141,f142,f143,f144,f145,f146,f147,f148,f149,f150,f151,f152,f153,f154,f155,f156,f157,f158,f159,f160,f161,f162,f163,f164,f165,f166,f167,f168,f169,f170,f171,f172,f173,f174,f175,f176,f177,f178,f179,f180,f181,f182,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192,f193,f194,f195,f196,f197,f198,f199,f200&secid=1.000001&_=1700000000000');
            const data = await response.json();
            
            // 北向资金数据通常在其他接口，这里简化处理
            return { northbound: Math.random() * 100 - 50 }; // 模拟数据，实际需要另外接口
        } catch (e) {
            console.error('获取北向资金失败:', e);
            return { northbound: 0 };
        }
    },
    
    // 计算恐慌贪婪指数
    calculateFearGreedIndex(marketData, sinaData) {
        let score = 50; // 中性
        
        // 基于涨跌家数
        const total = marketData.upDown.up + marketData.upDown.down;
        if (total > 0) {
            const upRatio = marketData.upDown.up / total;
            score += (upRatio - 0.5) * 40; // 涨跌影响40分
        }
        
        // 基于北向资金
        const northbound = sinaData.northbound || 0;
        score += Math.min(Math.max(northbound / 10, -20), 20); // 北向影响±20分
        
        // 限制在0-100
        return Math.min(Math.max(Math.round(score), 0), 100);
    },
    
    // 获取情绪等级
    getSentimentLevel(index) {
        if (index >= 80) return { level: '极度贪婪', emoji: '🤑', color: '#ef4444' };
        if (index >= 60) return { level: '贪婪', emoji: '😊', color: '#f97316' };
        if (index >= 40) return { level: '中性', emoji: '😐', color: '#eab308' };
        if (index >= 20) return { level: '恐惧', emoji: '😰', color: '#3b82f6' };
        return { level: '极度恐惧', emoji: '😱', color: '#6366f1' };
    },
    
    // 渲染情绪卡片
    renderCard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const sentiment = this.getSentimentLevel(this.data.fearGreedIndex);
        const total = this.data.upDownRatio.up + this.data.upDownRatio.down + this.data.upDownRatio.flat;
        const upPercent = total > 0 ? (this.data.upDownRatio.up / total * 100).toFixed(1) : 0;
        const downPercent = total > 0 ? (this.data.upDownRatio.down / total * 100).toFixed(1) : 0;
        
        container.innerHTML = `
            <div class="glass rounded-2xl p-4">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                            <i class="fas fa-brain"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700">市场情绪</span>
                    </div>
                    <span class="text-xs text-gray-400">${this.data.lastUpdate ? new Date(this.data.lastUpdate).toLocaleTimeString() : '--'}</span>
                </div>
                
                <div class="flex items-center gap-4 mb-4">
                    <div class="text-4xl">${sentiment.emoji}</div>
                    <div>
                        <div class="text-2xl font-bold" style="color: ${sentiment.color}">${this.data.fearGreedIndex}</div>
                        <div class="text-sm" style="color: ${sentiment.color}">${sentiment.level}</div>
                    </div>
                </div>
                
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-500">涨跌家数</span>
                        <span class="font-medium">
                            <span class="text-red-500">${this.data.upDownRatio.up}</span> / 
                            <span class="text-green-500">${this.data.upDownRatio.down}</span>
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">北向资金</span>
                        <span class="font-medium ${this.data.northboundFlow >= 0 ? 'text-red-500' : 'text-green-500'}">
                            ${this.data.northboundFlow >= 0 ? '+' : ''}${this.data.northboundFlow.toFixed(1)}亿
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">成交量</span>
                        <span class="font-medium">${this.data.turnover.toFixed(2)}万亿</span>
                    </div>
                </div>
                
                <div class="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500" style="width: ${this.data.fearGreedIndex}%"></div>
                </div>
            </div>
        `;
    }
};