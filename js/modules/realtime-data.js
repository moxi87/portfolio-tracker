// 实时数据刷新模块 - 修复任务1
const realtimeData = {
    isRefreshing: false,
    lastRefreshTime: null,
    
    // 初始化
    init() {
        // 页面加载后自动刷新一次
        setTimeout(() => this.refresh(), 1000);
        // 每30秒自动刷新
        setInterval(() => this.refresh(), 30000);
    },
    
    // 刷新数据
    async refresh() {
        if (this.isRefreshing) return;
        
        this.isRefreshing = true;
        this.updateRefreshButton(true);
        
        try {
            await this.fetchRealtimeQuotes();
            this.lastRefreshTime = new Date();
            this.showToast('数据已更新', 'success');
            
            // 刷新显示
            if (typeof renderDashboard === 'function') {
                renderDashboard();
            }
            
            // 更新最后刷新时间显示
            this.updateLastRefreshTime();
        } catch (e) {
            console.error('刷新失败:', e);
            this.showToast('更新失败: ' + e.message, 'error');
        } finally {
            this.isRefreshing = false;
            this.updateRefreshButton(false);
        }
    },
    
    // 获取实时行情
    async fetchRealtimeQuotes() {
        const account = portfolioData.accounts?.default?.data;
        if (!account) {
            throw new Error('未找到账户数据');
        }
        
        // 构建股票代码列表
        const stockCodes = [];
        (account.stocks || []).forEach(stock => {
            const code = stock.code;
            if (code.startsWith('6')) {
                stockCodes.push(`sh${code}`);
            } else if (code.startsWith('0') || code.startsWith('3')) {
                stockCodes.push(`sz${code}`);
            } else if (code.startsWith('4') || code.startsWith('8')) {
                stockCodes.push(`bj${code}`);
            }
        });
        
        // 基金代码需要特殊处理
        const fundCodes = [];
        (account.funds || []).forEach(fund => {
            // 基金使用新浪财经接口
            fundCodes.push(fund.code);
        });
        
        // 获取股票实时数据
        if (stockCodes.length > 0) {
            await this.fetchStockQuotes(stockCodes, account);
        }
        
        // 获取基金实时数据
        if (fundCodes.length > 0) {
            await this.fetchFundQuotes(fundCodes, account);
        }
        
        // 重新计算总资产和盈亏
        this.recalculatePortfolio(account);
    },
    
    // 获取股票实时行情
    async fetchStockQuotes(codes, account) {
        const codeStr = codes.join(',');
        const url = `https://qt.gtimg.cn/q=${codeStr}`;
        
        try {
            const response = await fetch(url);
            const text = await response.text();
            
            // 解析腾讯财经数据
            const lines = text.split(';');
            const quotes = {};
            
            lines.forEach(line => {
                const match = line.match(/v_([a-z0-9]+)="([^"]+)"/);
                if (match) {
                    const code = match[1];
                    const values = match[2].split('~');
                    if (values.length > 45) {
                        quotes[code] = {
                            name: values[1],
                            price: parseFloat(values[3]),
                            change: parseFloat(values[5]),
                            changePercent: parseFloat(values[32]),
                            open: parseFloat(values[4]),
                            high: parseFloat(values[33]),
                            low: parseFloat(values[34]),
                            volume: parseFloat(values[36]) / 10000 // 转换为万股
                        };
                    }
                }
            });
            
            // 更新持仓数据
            (account.stocks || []).forEach(stock => {
                let codeKey;
                if (stock.code.startsWith('6')) {
                    codeKey = `sh${stock.code}`;
                } else if (stock.code.startsWith('0') || stock.code.startsWith('3')) {
                    codeKey = `sz${stock.code}`;
                } else if (stock.code.startsWith('4') || stock.code.startsWith('8')) {
                    codeKey = `bj${stock.code}`;
                }
                
                const quote = quotes[codeKey];
                if (quote && quote.price > 0) {
                    stock.price = quote.price;
                    stock.dailyChange = quote.changePercent;
                    stock.marketValue = stock.shares * quote.price;
                    stock.dailyPnL = stock.shares * quote.price * quote.changePercent / 100;
                }
            });
            
        } catch (e) {
            console.error('获取股票行情失败:', e);
            throw e;
        }
    },
    
    // 获取基金实时净值
    async fetchFundQuotes(codes, account) {
        // 基金使用天天基金接口
        try {
            for (const fund of (account.funds || [])) {
                const code = fund.code;
                const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
                
                try {
                    const response = await fetch(url);
                    const text = await response.text();
                    
                    // 解析天天基金数据
                    const match = text.match(/jsonpgz\((.*)\)/);
                    if (match) {
                        const data = JSON.parse(match[1]);
                        if (data.gsz) { // 估算净值
                            const nav = parseFloat(data.gsz);
                            const changePercent = parseFloat(data.gszzl);
                            
                            fund.nav = nav;
                            fund.dailyChange = changePercent;
                            fund.marketValue = fund.shares * nav;
                            fund.dailyPnL = fund.shares * nav * changePercent / 100;
                        }
                    }
                } catch (e) {
                    console.warn(`获取基金 ${code} 数据失败:`, e);
                }
            }
        } catch (e) {
            console.error('获取基金行情失败:', e);
        }
    },
    
    // 重新计算组合数据
    recalculatePortfolio(account) {
        let totalAssets = 0;
        let totalDailyPnL = 0;
        let totalCost = 0;
        
        // 股票
        (account.stocks || []).forEach(stock => {
            totalAssets += stock.marketValue || 0;
            totalDailyPnL += stock.dailyPnL || 0;
            totalCost += stock.cost ? stock.cost * stock.shares : 0;
        });
        
        // 基金
        (account.funds || []).forEach(fund => {
            totalAssets += fund.marketValue || 0;
            totalDailyPnL += fund.dailyPnL || 0;
            totalCost += fund.cost ? fund.cost * fund.shares : 0;
        });
        
        // 现金
        totalAssets += account.cash || 0;
        
        // 更新账户数据
        account.totalAssets = totalAssets;
        account.totalDailyPnL = totalDailyPnL;
        account.totalPnL = totalCost > 0 ? totalAssets - totalCost : 0;
        
        // 计算权重
        const totalValue = totalAssets - (account.cash || 0);
        (account.stocks || []).forEach(stock => {
            stock.weight = totalValue > 0 ? ((stock.marketValue || 0) / totalValue * 100).toFixed(2) : 0;
        });
        (account.funds || []).forEach(fund => {
            fund.weight = totalValue > 0 ? ((fund.marketValue || 0) / totalValue * 100).toFixed(2) : 0;
        });
    },
    
    // 更新刷新按钮状态
    updateRefreshButton(isRefreshing) {
        const btn = document.getElementById('refreshBtn');
        if (btn) {
            if (isRefreshing) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                btn.classList.add('opacity-50');
            } else {
                btn.innerHTML = '<i class="fas fa-sync"></i>';
                btn.classList.remove('opacity-50');
            }
        }
    },
    
    // 更新最后刷新时间
    updateLastRefreshTime() {
        const el = document.getElementById('lastRefreshTime');
        if (el && this.lastRefreshTime) {
            const timeStr = this.lastRefreshTime.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            el.textContent = `更新于 ${timeStr}`;
        }
    },
    
    // 显示提示
    showToast(message, type = 'info') {
        // 移除旧的提示
        const oldToast = document.querySelector('.realtime-toast');
        if (oldToast) oldToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `realtime-toast fixed top-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-white z-50 text-sm ${
            type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    realtimeData.init();
});
