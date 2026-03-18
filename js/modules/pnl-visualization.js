// 盈亏可视化模块 - P0 - 修复任务6
const pnlVisualization = {
    // 渲染盈亏瀑布图
    renderWaterfall(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const account = portfolioData.accounts?.default?.data;
        if (!account) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400">暂无数据</div>';
            return;
        }
        
        // 合并持仓并计算盈亏
        const positions = [];
        
        // 股票
        (account.stocks || []).forEach(stock => {
            const cost = stock.cost || stock.price;
            const pnl = (stock.price - cost) * stock.shares;
            const returnRate = cost > 0 ? ((stock.price - cost) / cost * 100) : 0;
            positions.push({
                name: stock.name,
                code: stock.code,
                pnl: pnl,
                returnRate: returnRate,
                marketValue: stock.marketValue || 0,
                category: '股票'
            });
        });
        
        // 基金
        (account.funds || []).forEach(fund => {
            const cost = fund.cost || fund.nav;
            const pnl = (fund.nav - cost) * fund.shares;
            const returnRate = cost > 0 ? ((fund.nav - cost) / cost * 100) : 0;
            positions.push({
                name: fund.name,
                code: fund.code,
                pnl: pnl,
                returnRate: returnRate,
                marketValue: fund.marketValue || 0,
                category: '基金'
            });
        });
        
        // 按盈亏排序（盈利在前）
        positions.sort((a, b) => b.pnl - a.pnl);
        
        // 计算统计
        const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
        const winCount = positions.filter(p => p.pnl > 0).length;
        const loseCount = positions.filter(p => p.pnl < 0).length;
        const maxPnL = Math.max(...positions.map(p => Math.abs(p.pnl)), 1);
        
        // 生成HTML
        let html = `
            <div class="glass rounded-2xl p-4">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white">
                            <i class="fas fa-chart-waterfall"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700">持仓盈亏排行</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs">
                        <span class="px-2 py-1 bg-red-100 text-red-600 rounded-full">${winCount} 盈利</span>
                        <span class="px-2 py-1 bg-green-100 text-green-600 rounded-full">${loseCount} 亏损</span>
                    </div>
                </div>
                
                <div class="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">总盈亏</span>
                        <span class="text-xl font-bold ${totalPnL >= 0 ? 'text-red-500' : 'text-green-500'}">
                            ${totalPnL >= 0 ? '+' : ''}${(totalPnL/10000).toFixed(2)}万
                        </span>
                    </div>
                </div>
                
                <div class="space-y-3 max-h-80 overflow-y-auto">
        `;
        
        positions.forEach(pos => {
            const isProfit = pos.pnl >= 0;
            const width = maxPnL > 0 ? (Math.abs(pos.pnl) / maxPnL * 100) : 0;
            const colorClass = isProfit ? 'bg-red-500' : 'bg-green-500';
            const textColor = isProfit ? 'text-red-500' : 'text-green-500';
            
            html += `
                <div class="relative">
                    <div class="flex items-center gap-3">
                        <div class="w-16 text-xs text-gray-600 truncate">${pos.name}</div>
                        <div class="flex-1 relative h-8 bg-gray-100 rounded-full overflow-hidden">
                            <div class="absolute top-0 ${isProfit ? 'left-1/2' : 'right-1/2'} h-full ${colorClass} rounded-full flex items-center justify-${isProfit ? 'start' : 'end'} px-2"
                                 style="width: ${Math.min(width/2, 50)}%; ${isProfit ? '' : 'transform: translateX(100%);'}">
                                <span class="text-xs text-white font-medium whitespace-nowrap">${isProfit ? '+' : ''}${(pos.pnl/10000).toFixed(1)}万</span>
                            </div>
                            <div class="absolute inset-0 flex items-center justify-center">
                                <div class="w-px h-full bg-gray-300"></div>
                            </div>
                        </div>
                        <div class="w-14 text-xs ${textColor} text-right">${isProfit ? '+' : ''}${pos.returnRate.toFixed(1)}%</div>
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
    
    // 渲染盈亏分布饼图
    renderDistribution(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const account = portfolioData.accounts?.default?.data;
        if (!account) return;
        
        // 计算盈亏分布
        let totalProfit = 0;
        let totalLoss = 0;
        
        (account.stocks || []).forEach(stock => {
            const cost = stock.cost || stock.price;
            const pnl = (stock.price - cost) * stock.shares;
            if (pnl > 0) totalProfit += pnl;
            else totalLoss += Math.abs(pnl);
        });
        
        (account.funds || []).forEach(fund => {
            const cost = fund.cost || fund.nav;
            const pnl = (fund.nav - cost) * fund.shares;
            if (pnl > 0) totalProfit += pnl;
            else totalLoss += Math.abs(pnl);
        });
        
        const total = totalProfit + totalLoss;
        const profitPercent = total > 0 ? (totalProfit / total * 100).toFixed(1) : 0;
        const lossPercent = total > 0 ? (totalLoss / total * 100).toFixed(1) : 0;
        
        const html = `
            <div class="glass rounded-2xl p-4">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white">
                        <i class="fas fa-chart-pie"></i>
                    </div>
                    <span class="text-sm font-medium text-gray-700">盈亏分布</span>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between text-sm mb-1">
                            <span class="text-gray-600">盈利贡献</span>
                            <span class="text-red-500 font-medium">+${(totalProfit/10000).toFixed(2)}万 (${profitPercent}%)</span>
                        </div>
                        <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full bg-red-500 rounded-full" style="width: ${profitPercent}%"></div>
                        </div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between text-sm mb-1">
                            <span class="text-gray-600">亏损部分</span>
                            <span class="text-green-500 font-medium">-${(totalLoss/10000).toFixed(2)}万 (${lossPercent}%)</span>
                        </div>
                        <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full bg-green-500 rounded-full" style="width: ${lossPercent}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = pnlVisualization;
}