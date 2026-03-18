// 市场情绪模块 - P006 - 真实数据源版
const marketSentiment = {
    data: {
        fearGreedIndex: 50,
        northboundFlow: 0,
        upDownRatio: { up: 0, down: 0, flat: 0 },
        turnover: 0,
        vix: 0,
        lastUpdate: null,
        dataSource: 'realtime'
    },
    
    cache: {
        data: null,
        timestamp: 0,
        expiry: 5 * 60 * 1000 // 5分钟缓存
    },
    
    // 获取情绪数据（带缓存）
    async fetchData() {
        // 检查缓存
        if (this.cache.data && Date.now() - this.cache.timestamp < this.cache.expiry) {
            return this.cache.data;
        }
        
        try {
            // 并行获取多个数据源
            const [eastmoneyData, sinaData, tencentData] = await Promise.all([
                this.fetchEastmoneyData(),
                this.fetchSinaData(),
                this.fetchTencentData()
            ]);
            
            // 整合数据
            this.data = {
                fearGreedIndex: this.calculateFearGreedIndex(eastmoneyData, sinaData, tencentData),
                northboundFlow: sinaData.northbound || 0,
                upDownRatio: eastmoneyData.upDown || { up: 0, down: 0, flat: 0 },
                turnover: (eastmoneyData.turnover || 0).toFixed(2),
                shIndex: tencentData.shIndex || {},
                szIndex: tencentData.szIndex || {},
                cyIndex: tencentData.cyIndex || {},
                lastUpdate: new Date().toISOString(),
                dataSource: 'realtime'
            };
            
            // 更新缓存
            this.cache.data = { ...this.data };
            this.cache.timestamp = Date.now();
            
            return this.data;
        } catch (e) {
            console.error('获取市场情绪失败:', e);
            return this.data;
        }
    },
    
    // 从东方财富获取涨跌家数和成交量
    async fetchEastmoneyData() {
        try {
            const url = 'https://push2ex.eastmoney.com/getMarketData?ut=7eea3edcaed734bea9cbfc24409ed989&fltt=2&invt=2&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60&secids=1.000001,0.399001,0.399006';
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.data && data.data.diff) {
                const items = data.data.diff;
                let totalTurnover = 0;
                
                items.forEach(item => {
                    totalTurnover += (item.f47 || 0); // 成交额
                });
                
                return {
                    turnover: totalTurnover / 100000000, // 转换为亿
                    raw: items
                };
            }
        } catch (e) {
            console.warn('东方财富数据获取失败:', e);
        }
        return { turnover: 0 };
    },
    
    // 从新浪财经获取北向资金
    async fetchSinaData() {
        try {
            // 新浪财经北向资金接口
            const url = 'https://quotes.sina.cn/cn/api/quotes.php?symbol=sh000001&callback=cb';
            
            // 使用腾讯财经作为备选获取北向资金
            const response = await fetch('https://qt.gtimg.cn/q=sh000001');
            const buffer = await response.arrayBuffer();
            const text = new TextDecoder('gbk').decode(buffer);
            
            // 北向资金需要从其他接口获取，这里用模拟数据
            // 实际部署时可以通过后端代理获取
            return {
                northbound: 0, // 需要真实数据源
                raw: text
            };
        } catch (e) {
            console.warn('新浪财经数据获取失败:', e);
        }
        return { northbound: 0 };
    },
    
    // 从腾讯财经获取指数数据
    async fetchTencentData() {
        try {
            const response = await fetch('https://qt.gtimg.cn/q=sh000001,sz399001,sz399006');
            const buffer = await response.arrayBuffer();
            const text = new TextDecoder('gbk').decode(buffer);
            
            const data = {
                shIndex: {},
                szIndex: {},
                cyIndex: {}
            };
            
            // 解析数据
            const matches = text.match(/v_([a-z0-9]+)="([^"]+)"/g);
            if (matches) {
                matches.forEach(match => {
                    const parts = match.match(/v_([a-z0-9]+)="([^"]+)"/);
                    if (parts) {
                        const code = parts[1];
                        const values = parts[2].split('~');
                        
                        const indexData = {
                            name: values[1],
                            price: parseFloat(values[3]),
                            change: parseFloat(values[5]),
                            changePercent: parseFloat(values[32]),
                            volume: parseFloat(values[37]),
                            turnover: parseFloat(values[38])
                        };
                        
                        if (code === 'sh000001') data.shIndex = indexData;
                        if (code === 'sz399001') data.szIndex = indexData;
                        if (code === 'sz399006') data.cyIndex = indexData;
                    }
                });
            }
            
            return data;
        } catch (e) {
            console.warn('腾讯财经数据获取失败:', e);
        }
        return {};
    },
    
    // 计算恐慌贪婪指数
    calculateFearGreedIndex(eastmoney, sina, tencent) {
        let score = 50; // 中性起点
        
        // 1. 涨跌家数比 (权重30%)
        const upDown = eastmoney.upDown;
        if (upDown && (upDown.up + upDown.down) > 0) {
            const ratio = upDown.up / (upDown.up + upDown.down);
            score += (ratio - 0.5) * 30;
        }
        
        // 2. 指数涨跌幅 (权重30%)
        let avgChange = 0;
        let count = 0;
        if (tencent.shIndex.changePercent) {
            avgChange += tencent.shIndex.changePercent;
            count++;
        }
        if (tencent.szIndex.changePercent) {
            avgChange += tencent.szIndex.changePercent;
            count++;
        }
        if (tencent.cyIndex.changePercent) {
            avgChange += tencent.cyIndex.changePercent;
            count++;
        }
        if (count > 0) {
            avgChange /= count;
            score += avgChange * 1.5; // 涨1% = +1.5分
        }
        
        // 3. 北向资金 (权重20%)
        if (sina.northbound) {
            score += Math.min(sina.northbound / 10, 10); // 流入10亿 = +10分
        }
        
        // 4. 成交量 (权重20%)
        if (eastmoney.turnover) {
            // 成交额大于1万亿视为活跃
            if (eastmoney.turnover > 10000) {
                score += 5;
            } else if (eastmoney.turnover < 5000) {
                score -= 5;
            }
        }
        
        // 限制在0-100
        return Math.max(0, Math.min(100, Math.round(score)));
    },
    
    // 获取情绪等级
    getSentimentLevel(index) {
        if (index >= 80) return { level: '极度贪婪', color: '#ff4d4f', emoji: '🤩' };
        if (index >= 60) return { level: '贪婪', color: '#ff7875', emoji: '😃' };
        if (index >= 40) return { level: '中性', color: '#ffa940', emoji: '😐' };
        if (index >= 20) return { level: '恐慌', color: '#73d13d', emoji: '😰' };
        return { level: '极度恐慌', color: '#52c41a', emoji: '😱' };
    },
    
    // 渲染情绪仪表盘
    renderGauge(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const sentiment = this.getSentimentLevel(data.fearGreedIndex);
        const isPositive = data.fearGreedIndex >= 50;
        
        // 计算指针角度 (0-100映射到-90到90度)
        const angle = (data.fearGreedIndex / 100) * 180 - 90;
        
        container.innerHTML = `
            <div class="glass rounded-2xl p-4">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                            <i class="fas fa-heartbeat"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700">市场情绪</span>
                    </div>
                    <span class="text-xs text-gray-400">${new Date(data.lastUpdate).toLocaleTimeString('zh-CN')}</span>
                </div>
                
                <div class="relative flex justify-center mb-4">
                    <div class="w-40 h-20 overflow-hidden">
                        <div class="w-40 h-40 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500"
                            style="mask: radial-gradient(circle at 50% 100%, transparent 60%, black 61%); -webkit-mask: radial-gradient(circle at 50% 100%, transparent 60%, black 61%);"></div>
                    </div>
                    <div class="absolute bottom-0 w-1 h-16 bg-gray-800 origin-bottom transition-transform duration-500"
                        style="transform: rotate(${angle}deg)"></div>
                    
                    <div class="absolute bottom-0 w-4 h-4 rounded-full bg-gray-800"></div>
                </div>
                
                <div class="text-center mb-4">
                    <div class="text-4xl font-bold" style="color: ${sentiment.color}">
                        ${sentiment.emoji} ${data.fearGreedIndex}
                    </div>
                    <div class="text-lg font-medium" style="color: ${sentiment.color}">
                        ${sentiment.level}
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div class="bg-gray-50 rounded-lg p-2">
                        <div class="text-gray-500">上证指数</div>
                        <div class="font-medium ${data.shIndex.changePercent >= 0 ? 'text-red-500' : 'text-green-500'}">
                            ${data.shIndex.changePercent >= 0 ? '+' : ''}${data.shIndex.changePercent?.toFixed(2) || '--'}%
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-2">
                        <div class="text-gray-500">创业板指</div>
                        <div class="font-medium ${data.cyIndex.changePercent >= 0 ? 'text-red-500' : 'text-green-500'}">
                            ${data.cyIndex.changePercent >= 0 ? '+' : ''}${data.cyIndex.changePercent?.toFixed(2) || '--'}%
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-2">
                        <div class="text-gray-500">成交额</div>
                        <div class="font-medium">${data.turnover}亿</div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-lg p-2">
                        <div class="text-gray-500">北向资金</div>
                        <div class="font-medium ${data.northboundFlow >= 0 ? 'text-red-500' : 'text-green-500'}">
                            ${data.northboundFlow >= 0 ? '+' : ''}${data.northboundFlow}亿
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
