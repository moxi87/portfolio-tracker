// 持仓走势分析模块 - P0
trendAnalysis: {
    // 计算移动平均线
    calculateMA(data, period) {
        const ma = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                ma.push(null);
            } else {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += data[i - j].totalAssets;
                }
                ma.push(sum / period);
            }
        }
        return ma;
    },
    
    // 计算收益率趋势
    calculateReturns(history) {
        if (history.length < 2) return [];
        
        const returns = [];
        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1].totalAssets;
            const curr = history[i].totalAssets;
            returns.push({
                date: history[i].date,
                dailyReturn: ((curr - prev) / prev * 100).toFixed(2),
                totalAssets: curr
            });
        }
        return returns;
    },
    
    // 计算波动率
    calculateVolatility(history, period = 20) {
        if (history.length < period) return 0;
        
        const returns = [];
        for (let i = 1; i < history.length; i++) {
            returns.push((history[i].totalAssets - history[i-1].totalAssets) / history[i-1].totalAssets);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * 100; // 标准差百分比
    },
    
    // 计算最大回撤
    calculateMaxDrawdown(history) {
        if (history.length < 2) return { maxDrawdown: 0, from: null, to: null };
        
        let maxValue = history[0].totalAssets;
        let maxDrawdown = 0;
        let fromDate = history[0].date;
        let toDate = history[0].date;
        let tempFrom = history[0].date;
        
        for (let i = 1; i < history.length; i++) {
            const current = history[i].totalAssets;
            
            if (current > maxValue) {
                maxValue = current;
                tempFrom = history[i].date;
            }
            
            const drawdown = (maxValue - current) / maxValue * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
                fromDate = tempFrom;
                toDate = history[i].date;
            }
        }
        
        return {
            maxDrawdown: maxDrawdown.toFixed(2),
            from: fromDate,
            to: toDate
        };
    },
    
    // 计算夏普比率
    calculateSharpeRatio(history, riskFreeRate = 0.03) {
        if (history.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < history.length; i++) {
            returns.push((history[i].totalAssets - history[i-1].totalAssets) / history[i-1].totalAssets);
        }
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length * 252; // 年化
        const volatility = this.calculateVolatility(history) / 100 * Math.sqrt(252); // 年化
        
        return volatility > 0 ? ((avgReturn - riskFreeRate) / volatility).toFixed(2) : 0;
    },
    
    // 生成走势报告
    generateReport(history) {
        if (!history || history.length === 0) {
            return { error: '暂无历史数据' };
        }
        
        const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
        const latest = sorted[sorted.length - 1];
        const first = sorted[0];
        
        return {
            period: `${first.date} 至 ${latest.date}`,
            days: sorted.length,
            totalReturn: ((latest.totalAssets - first.totalAssets) / first.totalAssets * 100).toFixed(2),
            annualizedReturn: (Math.pow(latest.totalAssets / first.totalAssets, 365 / sorted.length) - 1) * 100,
            volatility: this.calculateVolatility(sorted).toFixed(2),
            maxDrawdown: this.calculateMaxDrawdown(sorted),
            sharpeRatio: this.calculateSharpeRatio(sorted),
            ma5: this.calculateMA(sorted, 5),
            ma10: this.calculateMA(sorted, 10),
            ma20: this.calculateMA(sorted, 20)
        };
    }
}