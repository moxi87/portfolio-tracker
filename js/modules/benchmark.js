// 收益对标模块 - P002 - 真实历史数据版
const benchmark = {
    // 指数代码映射
    indices: {
        'sh000001': { name: '上证指数', code: 'sh000001', fullCode: 'sh000001' },
        'sh000300': { name: '沪深300', code: 'sh000300', fullCode: 'sh000300' },
        'sz399001': { name: '深证成指', code: 'sz399001', fullCode: 'sz399001' },
        'sz399006': { name: '创业板指', code: 'sz399006', fullCode: 'sz399006' },
        'sh000905': { name: '中证500', code: 'sh000905', fullCode: 'sh000905' },
        'sh000016': { name: '上证50', code: 'sh000016', fullCode: 'sh000016' }
    },
    
    // 缓存
    cache: {
        indices: {},
        history: {},
        lastUpdate: null
    },
    
    // 获取指数实时数据
    async fetchIndexData(indexCode) {
        try {
            // 使用腾讯财经API
            const response = await fetch(`https://qt.gtimg.cn/q=${indexCode}`);
            const buffer = await response.arrayBuffer();
            const decoder = new TextDecoder('gbk');
            const text = decoder.decode(buffer);
            
            const match = text.match(/v_([a-z0-9]+)="([^"]+)"/);
            if (match) {
                const values = match[2].split('~');
                return {
                    code: indexCode,
                    name: values[1],
                    price: parseFloat(values[3]),
                    prevClose: parseFloat(values[4]),
                    change: parseFloat(values[5]),
                    changePercent: parseFloat(values[32]),
                    volume: parseFloat(values[37]),
                    turnover: parseFloat(values[38]),
                    updateTime: values[30]
                };
            }
        } catch (e) {
            console.error(`获取 ${indexCode} 数据失败:`, e);
        }
        return null;
    },
    
    // 获取指数历史数据（使用新浪API）
    async fetchIndexHistory(indexCode, days = 30) {
        const cacheKey = `${indexCode}_${days}`;
        if (this.cache.history[cacheKey] && 
            Date.now() - this.cache.history[cacheKey].timestamp < 5 * 60 * 1000) {
            return this.cache.history[cacheKey].data;
        }
        
        try {
            // 使用东方财富历史数据API
            const market = indexCode.startsWith('sh') ? '1' : '0';
            const code = indexCode.substring(2);
            
            const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${market}.${code}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&end=20500101&limit=${days}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.data && data.data.klines) {
                const history = data.data.klines.map(line => {
                    const parts = line.split(',');
                    return {
                        date: parts[0],
                        open: parseFloat(parts[1]),
                        close: parseFloat(parts[2]),
                        high: parseFloat(parts[3]),
                        low: parseFloat(parts[4]),
                        volume: parseFloat(parts[5]),
                        amount: parseFloat(parts[6]),
                        amplitude: parseFloat(parts[7]),
                        changePercent: parseFloat(parts[8]),
                        change: parseFloat(parts[9]),
                        turnover: parseFloat(parts[10])
                    };
                });
                
                this.cache.history[cacheKey] = {
                    data: history,
                    timestamp: Date.now()
                };
                
                return history;
            }
        } catch (e) {
            console.error(`获取 ${indexCode} 历史数据失败:`, e);
        }
        
        return null;
    },
    
    // 计算指数期间收益
    calculateIndexReturn(history, days) {
        if (!history || history.length < days) return null;
        
        const recent = history.slice(-days);
        const startPrice = recent[0].close;
        const endPrice = recent[recent.length - 1].close;
        
        return {
            startPrice,
            endPrice,
            return: ((endPrice - startPrice) / startPrice * 100),
            days,
            startDate: recent[0].date,
            endDate: recent[recent.length - 1].date
        };
    },
    
    // 获取所有指数数据（实时+历史）
    async fetchAllIndices(withHistory = false, historyDays = 30) {
        const results = {};
        
        for (const [key, index] of Object.entries(this.indices)) {
            const realTime = await this.fetchIndexData(index.code);
            let history = null;
            let periodReturn = null;
            
            if (withHistory) {
                history = await this.fetchIndexHistory(index.code, historyDays);
                periodReturn = this.calculateIndexReturn(history, historyDays);
            }
            
            results[key] = {
                ...index,
                realTime,
                history,
                periodReturn
            };
            
            // 延迟避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.cache.indices = results;
        this.cache.lastUpdate = Date.now();
        
        return results;
    },
    
    // 计算持仓期间收益
    calculatePortfolioReturn(portfolioData, days = 30) {
        const history = portfolioData.history || [];
        
        if (history.length >= 2) {
            // 使用历史数据计算
            const recent = history.slice(-Math.min(days, history.length));
            const start = recent[0];
            const end = recent[recent.length - 1];
            
            return {
                startAssets: start.totalAssets,
                endAssets: end.totalAssets,
                return: ((end.totalAssets - start.totalAssets) / start.totalAssets * 100),
                days: recent.length - 1,
                startDate: start.date,
                endDate: end.date
            };
        }
        
        // 使用持仓成本计算累计收益
        const account = portfolioData.accounts?.default?.data;
        if (!account) return null;
        
        let totalCost = 0;
        let totalValue = 0;
        
        (account.stocks || []).forEach(stock => {
            const cost = stock.cost || stock.price;
            totalCost += cost * stock.shares;
            totalValue += stock.price * stock.shares;
        });
        
        (account.funds || []).forEach(fund => {
            const cost = fund.cost || fund.nav;
            totalCost += cost * fund.shares;
            totalValue += fund.nav * fund.shares;
        });
        
        if (totalCost > 0) {
            return {
                startAssets: totalCost,
                endAssets: totalValue,
                return: ((totalValue - totalCost) / totalCost * 100),
                days: 0,
                startDate: '建仓日',
                endDate: new Date().toISOString().split('T')[0]
            };
        }
        
        return null;
    },
    
    // 生成完整对标报告
    async generateReport(portfolioData, options = {}) {
        const { withHistory = true, historyDays = 30 } = options;
        
        // 获取指数数据
        const indices = await this.fetchAllIndices(withHistory, historyDays);
        
        // 计算组合收益
        const portfolioReturn = this.calculatePortfolioReturn(portfolioData, historyDays);
        
        if (!portfolioReturn) {
            return {
                error: '数据不足',
                period: '暂无数据',
                indices: indices
            };
        }
        
        // 计算对标结果
        const comparisons = [];
        for (const [key, index] of Object.entries(indices)) {
            if (!index.realTime) continue;
            
            let indexReturn, comparisonPeriod;
            
            if (withHistory && index.periodReturn) {
                // 使用历史期间收益
                indexReturn = index.periodReturn.return;
                comparisonPeriod = `${index.periodReturn.startDate} 至 ${index.periodReturn.endDate}`;
            } else {
                // 使用当日涨跌
                indexReturn = index.realTime.changePercent || 0;
                comparisonPeriod = '今日实时';
            }
            
            const relativeReturn = portfolioReturn.return - indexReturn;
            
            comparisons.push({
                name: index.name,
                code: key,
                indexReturn: indexReturn.toFixed(2),
                portfolioReturn: portfolioReturn.return.toFixed(2),
                relativeReturn: relativeReturn.toFixed(2),
                status: relativeReturn >= 0 ? 'win' : 'lose',
                period: comparisonPeriod,
                history: index.history,
                periodData: index.periodReturn
            });
        }
        
        // 排序：跑赢的在前
        comparisons.sort((a, b) => parseFloat(b.relativeReturn) - parseFloat(a.relativeReturn));
        
        return {
            period: portfolioReturn.days > 0 
                ? `${portfolioReturn.startDate} 至 ${portfolioReturn.endDate} (${portfolioReturn.days}天)`
                : '累计收益',
            days: portfolioReturn.days,
            portfolioReturn: portfolioReturn.return.toFixed(2),
            portfolioStart: portfolioReturn.startAssets.toFixed(2),
            portfolioEnd: portfolioReturn.endAssets.toFixed(2),
            comparisons: comparisons,
            winCount: comparisons.filter(c => c.status === 'win').length,
            totalCount: comparisons.length,
            indices: indices,
            withHistory
        };
    },
    
    // 渲染对标卡片
    renderCard(containerId, report) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (report.error && (!report.comparisons || report.comparisons.length === 0)) {
            container.innerHTML = `
                <div class="glass rounded-2xl p-4">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                            <i class="fas fa-chart-bar"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700">收益对标</span>
                    </div>
                    <div class="text-center py-6 text-gray-400">
                        <i class="fas fa-chart-line text-3xl mb-2"></i>
                        <p>暂无对标数据</p>
                        <p class="text-xs mt-1">请添加持仓历史数据</p>
                    </div>
                </div>
            `;
            return;
        }
        
        const portfolioUp = parseFloat(report.portfolioReturn) >= 0;
        
        let html = `
            <div class="glass rounded-2xl p-4">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                            <i class="fas fa-chart-bar"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700">收益对标</span>
                    </div>
                    <div class="text-xs text-gray-400">${report.period}</div>
                </div>
                
                <div class="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl">
                    <div>
                        <div class="text-xs text-gray-500 mb-1">我的组合</div>
                        <div class="text-2xl font-bold ${portfolioUp ? 'text-red-500' : 'text-green-500'}">
                            ${portfolioUp ? '+' : ''}${report.portfolioReturn}%
                        </div>
                        <div class="text-xs text-gray-400 mt-1">¥${parseFloat(report.portfolioEnd).toLocaleString()}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-500 mb-1">跑赢指数</div>
                        <div class="text-2xl font-bold">
                            <span class="text-red-500">${report.winCount}</span>
                            <span class="text-gray-400">/${report.totalCount}</span>
                        </div>
                    </div>
                </div>
                
                <div class="space-y-2">
        `;
        
        report.comparisons.forEach(c => {
            const isWin = c.status === 'win';
            const indexUp = parseFloat(c.indexReturn) >= 0;
            
            html += `
                <div class="flex items-center justify-between p-2 rounded-lg ${isWin ? 'bg-red-50' : 'bg-green-50'}">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-gray-700">${c.name}</span>
                        <span class="text-xs ${indexUp ? 'text-red-500' : 'text-green-500'}">
                            ${indexUp ? '+' : ''}${c.indexReturn}%
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">${isWin ? '跑赢' : '跑输'}</span>
                        <span class="text-sm font-bold ${isWin ? 'text-red-500' : 'text-green-500'}">
                            ${isWin ? '+' : ''}${c.relativeReturn}%
                        </span>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                
                ${report.withHistory ? `
                <div class="mt-4 pt-3 border-t border-gray-100">
                    <button onclick="benchmark.renderTrendChart('${containerId}')" class="w-full py-2 text-sm text-blue-600 hover:text-blue-700">
                        <i class="fas fa-chart-line mr-1"></i>查看走势对比
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // 渲染走势对比图（简化版）
    renderTrendChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        alert('走势对比图功能开发中...\n\n将展示：\n- 组合净值曲线\n- 各指数走势曲线\n- 相对强弱对比');
    }
};
