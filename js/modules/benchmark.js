// 收益对标模块 - P0 - 修复版
const benchmark = {
    // 指数代码映射
    indices: {
        'sh000001': { name: '上证指数', code: 'sh000001' },
        'sh000300': { name: '沪深300', code: 'sh000300' },
        'sz399001': { name: '深证成指', code: 'sz399001' },
        'sz399006': { name: '创业板指', code: 'sz399006' },
        'sh000905': { name: '中证500', code: 'sh000905' },
        'sh000016': { name: '上证50', code: 'sh000016' }
    },
    
    // 获取指数数据
    async fetchIndexData(indexCode) {
        try {
            // 使用腾讯财经API
            const response = await fetch(`https://qt.gtimg.cn/q=${indexCode}`);
            const buffer = await response.arrayBuffer();
            // 解码GBK编码
            const decoder = new TextDecoder('gbk');
            const text = decoder.decode(buffer);
            
            // 解析数据
            const match = text.match(/v_([a-z0-9]+)="([^"]+)"/);
            if (match) {
                const values = match[2].split('~');
                return {
                    code: indexCode,
                    name: values[1],
                    price: parseFloat(values[3]),
                    change: parseFloat(values[5]),
                    changePercent: parseFloat(values[32]),
                    volume: parseFloat(values[37]),
                    updateTime: values[30]
                };
            }
        } catch (e) {
            console.error(`获取 ${indexCode} 数据失败:`, e);
        }
        return null;
    },
    
    // 获取所有指数数据
    async fetchAllIndices() {
        const results = {};
        for (const [key, index] of Object.entries(this.indices)) {
            results[key] = await this.fetchIndexData(index.code);
        }
        return results;
    },
    
    // 计算相对收益
    calculateRelativeReturn(portfolioReturn, indexReturn) {
        return portfolioReturn - indexReturn;
    },
    
    // 生成对标报告
    async generateReport(portfolioData) {
        const account = portfolioData.accounts?.default?.data;
        const history = portfolioData.history || [];
        
        // 如果没有历史数据，使用当前持仓数据计算
        if (!account) {
            return { 
                error: '数据不足',
                period: '暂无数据',
                days: 0,
                portfolioReturn: '0.00',
                comparisons: [],
                winCount: 0,
                totalCount: 6
            };
        }
        
        // 计算组合收益
        let portfolioReturn = 0;
        if (history.length >= 2) {
            const first = history[0];
            const latest = history[history.length - 1];
            portfolioReturn = ((latest.totalAssets - first.totalAssets) / first.totalAssets * 100);
        } else {
            // 使用持仓的累计收益率（基于成本）
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
                portfolioReturn = ((totalValue - totalCost) / totalCost * 100);
            }
        }
        
        // 获取指数数据
        const indices = await this.fetchAllIndices();
        
        // 计算各指数期间收益（简化：使用当日涨跌作为参考）
        const comparisons = [];
        for (const [key, index] of Object.entries(indices)) {
            if (index) {
                // 使用当日涨跌作为对比基准
                const indexReturn = index.changePercent || 0;
                const relativeReturn = (portfolioReturn - indexReturn).toFixed(2);
                
                comparisons.push({
                    name: index.name,
                    code: key,
                    indexReturn: indexReturn.toFixed(2),
                    portfolioReturn: portfolioReturn.toFixed(2),
                    relativeReturn: relativeReturn,
                    status: parseFloat(relativeReturn) >= 0 ? 'win' : 'lose'
                });
            }
        }
        
        // 排序：跑赢的在前
        comparisons.sort((a, b) => parseFloat(b.relativeReturn) - parseFloat(a.relativeReturn));
        
        const firstDate = history.length > 0 ? history[0].date : new Date().toISOString().split('T')[0];
        const latestDate = history.length > 0 ? history[history.length - 1].date : new Date().toISOString().split('T')[0];
        
        return {
            period: history.length >= 2 ? `${firstDate} 至 ${latestDate}` : '今日实时对比',
            days: history.length,
            portfolioReturn: portfolioReturn.toFixed(2),
            comparisons: comparisons,
            winCount: comparisons.filter(c => c.status === 'win').length,
            totalCount: comparisons.length
        };
    },
    
    // 渲染对标卡片
    renderCard(containerId, report) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // 如果有错误但有比较数据，仍然显示
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
        
        let html = `
            <div class="glass rounded-2xl p-4">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                            <i class="fas fa-chart-bar"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700">收益对标</span>
                    </div>
                    <span class="text-xs text-gray-400">${report.period}</span>
                </div>
                
                <div class="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl">
                    <div>
                        <div class="text-xs text-gray-500 mb-1">我的组合</div>
                        <div class="text-2xl font-bold ${parseFloat(report.portfolioReturn) >= 0 ? 'text-red-500' : 'text-green-500'}">
                            ${parseFloat(report.portfolioReturn) >= 0 ? '+' : ''}${report.portfolioReturn}%
                        </div>
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
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // 渲染详细对标表格
    renderTable(containerId, report) {
        const container = document.getElementById(containerId);
        if (!container || report.error) return;
        
        let html = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-gray-500 border-b border-gray-200">
                            <th class="text-left py-2">指数</th>
                            <th class="text-right">指数涨跌</th>
                            <th class="text-right">我的组合</th>
                            <th class="text-right">相对收益</th>
                            <th class="text-center">状态</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        report.comparisons.forEach(c => {
            const isWin = c.status === 'win';
            html += `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-3 font-medium">${c.name}</td>
                    <td class="text-right ${parseFloat(c.indexReturn) >= 0 ? 'text-red-500' : 'text-green-500'}">
                        ${parseFloat(c.indexReturn) >= 0 ? '+' : ''}${c.indexReturn}%
                    </td>
                    <td class="text-right ${parseFloat(report.portfolioReturn) >= 0 ? 'text-red-500' : 'text-green-500'}">
                        ${parseFloat(report.portfolioReturn) >= 0 ? '+' : ''}${report.portfolioReturn}%
                    </td>
                    <td class="text-right font-bold ${isWin ? 'text-red-500' : 'text-green-500'}">
                        ${isWin ? '+' : ''}${c.relativeReturn}%
                    </td>
                    <td class="text-center">
                        <span class="px-2 py-1 rounded-full text-xs ${isWin ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">
                            ${isWin ? '跑赢' : '跑输'}
                        </span>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
    }
};