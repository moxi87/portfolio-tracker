
// 实时行情模块 - 接入新浪财经API
const RealtimeQuotes = {
    // 股票实时行情
    async fetchStockQuote(code) {
        // 使用新浪财经API（免密钥）
        const url = `https://hq.sinajs.cn/list=sh${code.slice(0, 6) === '60' || code.slice(0, 6) === '68' ? code : 'sz' + code}`;
        try {
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            return this.parseSinaData(data.contents, code);
        } catch (e) {
            console.error('Failed to fetch quote:', e);
            return null;
        }
    },
    
    parseSinaData(data, code) {
        // 新浪返回格式: var hq_str_sh601669="中国电建,2.100,2.115,2.110,2.120,2.095,2.105,2.110,12345678,25987654,2.105,5400,2.104,10000...";
        const match = data.match(/var hq_str_\w+="([^"]+)"/);
        if (!match) return null;
        
        const parts = match[1].split(',');
        if (parts.length < 33) return null;
        
        return {
            name: parts[0],
            open: parseFloat(parts[1]),
            close: parseFloat(parts[2]),
            current: parseFloat(parts[3]),
            high: parseFloat(parts[4]),
            low: parseFloat(parts[5]),
            change: parseFloat(parts[3]) - parseFloat(parts[2]),
            changePercent: ((parseFloat(parts[3]) - parseFloat(parts[2])) / parseFloat(parts[2]) * 100).toFixed(2)
        };
    },
    
    // 更新所有股票实时价格
    async updateAllStocks() {
        const stocks = portfolio.stocks;
        for (let stock of stocks) {
            const quote = await this.fetchStockQuote(stock.code);
            if (quote) {
                stock.currentPrice = quote.current;
                stock.change = quote.change;
                stock.changePercent = parseFloat(quote.changePercent);
                stock.marketValue = stock.shares * quote.current;
            }
        }
        this.refreshDisplay();
    },
    
    refreshDisplay() {
        // 触发页面刷新
        init();
        showNotification('实时行情已更新', 'success');
    }
};

// 调仓模拟器
const RebalanceSimulator = {
    scenarios: [],
    
    // 添加调仓方案
    addScenario(name, trades) {
        const scenario = {
            name,
            trades,
            before: this.calculatePortfolio(),
            after: null
        };
        
        // 计算调仓后状态
        let tempPortfolio = JSON.parse(JSON.stringify(portfolio));
        for (let trade of trades) {
            this.applyTrade(tempPortfolio, trade);
        }
        scenario.after = this.calculatePortfolio(tempPortfolio);
        scenario.impact = {
            assetsChange: scenario.after.totalAssets - scenario.before.totalAssets,
            riskChange: scenario.after.beta - scenario.before.beta,
            concentrationChange: scenario.after.maxPosition - scenario.before.maxPosition
        };
        
        this.scenarios.push(scenario);
        return scenario;
    },
    
    applyTrade(portfolio, trade) {
        const { type, code, action, amount, price } = trade;
        
        if (type === 'stock') {
            const stock = portfolio.stocks.find(s => s.code === code);
            if (stock) {
                if (action === 'sell') {
                    stock.shares -= amount;
                    stock.marketValue = stock.shares * price;
                } else if (action === 'buy') {
                    stock.shares += amount;
                    stock.marketValue = stock.shares * price;
                } else if (action === 'close') {
                    // 清仓
                    stock.shares = 0;
                    stock.marketValue = 0;
                }
            }
        }
    },
    
    calculatePortfolio(portfolioData = portfolio) {
        const fundTotal = portfolioData.funds.reduce((s, f) => s + f.marketValue, 0);
        const stockTotal = portfolioData.stocks.reduce((s, s2) => s + s2.value, 0);
        const totalAssets = fundTotal + stockTotal;
        
        // 计算最大持仓占比
        const allPositions = [...portfolioData.funds, ...portfolioData.stocks];
        const maxPosition = Math.max(...allPositions.map(p => p.marketValue / totalAssets));
        
        // 计算Beta
        const betas = { '新能源': 1.3, '科技': 1.4, '汽车': 1.2, '有色': 1.1, '基建': 0.9, '红利': 0.7 };
        let weightedBeta = 0;
        allPositions.forEach(p => {
            const beta = betas[p.sector] || 1;
            weightedBeta += beta * (p.marketValue / totalAssets);
        });
        
        return {
            totalAssets,
            fundTotal,
            stockTotal,
            maxPosition,
            beta: weightedBeta
        };
    },
    
    // 生成预设调仓方案
    generatePresets() {
        return [
            {
                name: '方案A：减仓比亚迪至30%',
                desc: '卖出1400股比亚迪，释放约13.5万资金',
                trades: [
                    { type: 'stock', code: '002594', action: 'sell', amount: 1400, price: 96.60 }
                ],
                risk: '低',
                expectedReturn: '降低波动，分散风险'
            },
            {
                name: '方案B：止损中科曙光',
                desc: '清仓中科曙光，止损约7700元',
                trades: [
                    { type: 'stock', code: '603019', action: 'close', amount: 100, price: 88.19 }
                ],
                risk: '中',
                expectedReturn: '释放资金，降低风险敞口'
            },
            {
                name: '方案C：加仓红利低波',
                desc: '用卖出比亚迪资金加仓红利ETF',
                trades: [
                    { type: 'stock', code: '002594', action: 'sell', amount: 700, price: 96.60 },
                    { type: 'fund', code: '007467', action: 'buy', amount: 67620 }
                ],
                risk: '低',
                expectedReturn: '降低组合Beta，提高分红收益'
            }
        ];
    }
};

// 预警系统
const AlertSystem = {
    alerts: [],
    
    // 检查预警条件
    checkAlerts() {
        const newAlerts = [];
        
        // 检查个股涨跌幅
        portfolio.stocks.forEach(stock => {
            if (Math.abs(stock.changePercent) > 5) {
                newAlerts.push({
                    type: 'price',
                    level: 'high',
                    title: `${stock.name} 异动提醒`,
                    message: `当前涨跌幅 ${stock.changePercent > 0 ? '+' : ''}${stock.changePercent}%，超过5%阈值`,
                    time: new Date().toLocaleString('zh-CN')
                });
            }
        });
        
        // 检查持仓集中度
        const totalAssets = portfolio.funds.reduce((s, f) => s + f.marketValue, 0) + 
                           portfolio.stocks.reduce((s, s2) => s + s2.value, 0);
        const byd = portfolio.stocks.find(s => s.code === '002594');
        if (byd && byd.value / totalAssets > 0.5) {
            newAlerts.push({
                type: 'risk',
                level: 'high',
                title: '持仓集中度预警',
                message: `比亚迪占比 ${(byd.value / totalAssets * 100).toFixed(1)}%，建议减仓分散风险`,
                time: new Date().toLocaleString('zh-CN')
            });
        }
        
        // 检查止损线
        portfolio.stocks.forEach(stock => {
            if (stock.return < -30) {
                newAlerts.push({
                    type: 'stoploss',
                    level: 'medium',
                    title: `${stock.name} 触及止损线`,
                    message: `当前浮亏 ${stock.return}%，建议评估是否止损`,
                    time: new Date().toLocaleString('zh-CN')
                });
            }
        });
        
        this.alerts = newAlerts;
        return newAlerts;
    },
    
    // 渲染预警面板
    renderAlertPanel() {
        const alerts = this.checkAlerts();
        if (alerts.length === 0) {
            return `
                <div class="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                    <i class="fas fa-check-circle text-green-500 text-xl"></i>
                    <div>
                        <div class="font-bold text-green-800">暂无预警</div>
                        <div class="text-sm text-green-600">所有指标正常</div>
                    </div>
                </div>
            `;
        }
        
        return alerts.map(alert => `
            <div class="p-4 ${alert.level === 'high' ? 'bg-red-50 border-red-100' : 'bg-yellow-50 border-yellow-100'} rounded-xl border flex items-start gap-3">
                <i class="fas ${alert.type === 'price' ? 'fa-chart-line' : alert.type === 'risk' ? 'fa-exclamation-triangle' : 'fa-hand-paper'} ${alert.level === 'high' ? 'text-red-500' : 'text-yellow-500'} text-xl mt-0.5"></i>
                <div class="flex-1">
                    <div class="font-bold ${alert.level === 'high' ? 'text-red-800' : 'text-yellow-800'}">${alert.title}</div>
                    <div class="text-sm ${alert.level === 'high' ? 'text-red-600' : 'text-yellow-600'} mt-1">${alert.message}</div>
                    <div class="text-xs text-gray-400 mt-2">${alert.time}</div>
                </div>
            </div>
        `).join('');
    }
};

// 指数对比
const IndexComparison = {
    indices: [
        { name: '沪深300', code: '000300', return: -2.3 },
        { name: '创业板指', code: '399006', return: -5.1 },
        { name: '上证指数', code: '000001', return: -1.8 },
        { name: '恒生指数', code: 'HSI', return: -8.2 }
    ],
    
    getMyReturn() {
        const totalAssets = 394589.49;
        const totalPnL = 24104.66;
        return (totalPnL / (totalAssets - totalPnL) * 100).toFixed(2);
    },
    
    renderComparison() {
        const myReturn = parseFloat(this.getMyReturn());
        
        return `
            <div class="space-y-3">
                <div class="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">我</div>
                        <div>
                            <div class="font-bold text-indigo-800">我的组合</div>
                            <div class="text-xs text-indigo-600">今年以来</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold ${myReturn >= 0 ? 'text-red-500' : 'text-green-500'}">${myReturn > 0 ? '+' : ''}${myReturn}%</div>
                        <div class="text-xs text-indigo-500">跑赢 ${this.indices.filter(i => myReturn > i.return).length}/4 指数</div>
                    </div>
                </div>
                
                ${this.indices.map(idx => {
                    const beat = myReturn > idx.return;
                    return `
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div class="font-medium text-gray-700">${idx.name}</div>
                            <div class="flex items-center gap-3">
                                <span class="text-sm ${idx.return >= 0 ? 'text-red-500' : 'text-green-500'}">${idx.return > 0 ? '+' : ''}${idx.return}%</span>
                                <span class="text-xs ${beat ? 'text-green-500' : 'text-gray-400'}">${beat ? '✓ 跑赢' : '✗ 跑输'}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
};

// 通知系统
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 p-4 rounded-xl shadow-lg z-50 animate-slide-in ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-indigo-500 text-white'
    }`;
    notification.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-times' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}
