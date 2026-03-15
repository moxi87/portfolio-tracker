// ============================================
// Portfolio Pro 高级功能模块
// 多账户管理 + 智能再平衡 + 收益归因 + 风险分析
// ============================================

// ============================================
// 1. 多账户管理系统
// ============================================

/**
 * 账户管理器
 * 支持多账户创建、切换、聚合视图
 */
class AccountManager {
    constructor() {
        this.accounts = this.loadAccounts();
        this.currentAccountId = localStorage.getItem('currentAccountId') || 'default';
    }

    /**
     * 加载所有账户
     */
    loadAccounts() {
        const saved = localStorage.getItem('portfolio_accounts');
        if (saved) {
            return JSON.parse(saved);
        }
        // 初始化默认账户
        return {
            'default': {
                id: 'default',
                name: '主账户',
                type: 'stock', // stock, fund, crypto, bank
                icon: 'fa-wallet',
                color: '#6366f1',
                createdAt: new Date().toISOString(),
                data: {
                    date: new Date().toISOString().split('T')[0],
                    totalAssets: 0,
                    dailyPnL: 0,
                    totalPnL: 0,
                    stocks: [],
                    funds: [],
                    cash: 0
                }
            }
        };
    }

    /**
     * 保存账户数据
     */
    saveAccounts() {
        localStorage.setItem('portfolio_accounts', JSON.stringify(this.accounts));
        localStorage.setItem('currentAccountId', this.currentAccountId);
    }

    /**
     * 获取当前账户
     */
    getCurrentAccount() {
        return this.accounts[this.currentAccountId] || this.accounts['default'];
    }

    /**
     * 获取当前账户数据
     */
    getCurrentData() {
        const account = this.getCurrentAccount();
        return account.data || portfolioData;
    }

    /**
     * 创建新账户
     */
    createAccount(name, type = 'stock', options = {}) {
        const id = 'acc_' + Date.now();
        const account = {
            id,
            name,
            type,
            icon: options.icon || this.getDefaultIcon(type),
            color: options.color || this.getDefaultColor(type),
            createdAt: new Date().toISOString(),
            data: {
                date: new Date().toISOString().split('T')[0],
                totalAssets: 0,
                dailyPnL: 0,
                totalPnL: 0,
                stocks: [],
                funds: [],
                cash: options.initialCash || 0
            }
        };
        this.accounts[id] = account;
        this.saveAccounts();
        return id;
    }

    /**
     * 删除账户
     */
    deleteAccount(id) {
        if (id === 'default') return false; // 不能删除默认账户
        delete this.accounts[id];
        if (this.currentAccountId === id) {
            this.currentAccountId = 'default';
        }
        this.saveAccounts();
        return true;
    }

    /**
     * 切换当前账户
     */
    switchAccount(id) {
        if (this.accounts[id]) {
            this.currentAccountId = id;
            this.saveAccounts();
            return true;
        }
        return false;
    }

    /**
     * 更新账户数据
     */
    updateAccountData(id, data) {
        if (this.accounts[id]) {
            this.accounts[id].data = { ...this.accounts[id].data, ...data };
            this.saveAccounts();
            return true;
        }
        return false;
    }

    /**
     * 获取所有账户列表
     */
    getAccountList() {
        return Object.values(this.accounts).map(acc => ({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            icon: acc.icon,
            color: acc.color,
            totalAssets: acc.data?.totalAssets || 0,
            dailyPnL: acc.data?.dailyPnL || 0
        }));
    }

    /**
     * 获取聚合数据（所有账户汇总）
     */
    getAggregatedData() {
        const accounts = Object.values(this.accounts);
        let totalAssets = 0;
        let dailyPnL = 0;
        let totalPnL = 0;
        let totalCash = 0;
        const allStocks = [];
        const allFunds = [];

        accounts.forEach(acc => {
            const data = acc.data || {};
            totalAssets += data.totalAssets || 0;
            dailyPnL += data.dailyPnL || 0;
            totalPnL += data.totalPnL || 0;
            totalCash += data.cash || 0;
            
            // 合并持仓（去重处理）
            if (data.stocks) {
                data.stocks.forEach(stock => {
                    const existing = allStocks.find(s => s.code === stock.code);
                    if (existing) {
                        // 合并同代码持仓
                        const totalShares = existing.shares + stock.shares;
                        const totalCost = (existing.cost || 0) * existing.shares + (stock.cost || 0) * stock.shares;
                        existing.shares = totalShares;
                        existing.cost = totalCost / totalShares;
                        existing.marketValue = (existing.marketValue || 0) + (stock.marketValue || 0);
                        existing.dailyPnL = (existing.dailyPnL || 0) + (stock.dailyPnL || 0);
                        existing.holdingPnL = (existing.holdingPnL || 0) + (stock.holdingPnL || 0);
                    } else {
                        allStocks.push({ ...stock, accountId: acc.id });
                    }
                });
            }
            
            if (data.funds) {
                data.funds.forEach(fund => {
                    const existing = allFunds.find(f => f.code === fund.code);
                    if (existing) {
                        const totalShares = existing.shares + fund.shares;
                        const totalCost = (existing.cost || 0) * existing.shares + (fund.cost || 0) * fund.shares;
                        existing.shares = totalShares;
                        existing.cost = totalCost / totalShares;
                        existing.marketValue = (existing.marketValue || 0) + (fund.marketValue || 0);
                    } else {
                        allFunds.push({ ...fund, accountId: acc.id });
                    }
                });
            }
        });

        return {
            date: new Date().toISOString().split('T')[0],
            totalAssets,
            dailyPnL,
            totalPnL,
            cash: totalCash,
            stocks: allStocks,
            funds: allFunds,
            accountCount: accounts.length
        };
    }

    /**
     * 获取默认图标
     */
    getDefaultIcon(type) {
        const icons = {
            stock: 'fa-chart-line',
            fund: 'fa-piggy-bank',
            crypto: 'fa-bitcoin',
            bank: 'fa-university',
            bond: 'fa-file-invoice-dollar',
            cash: 'fa-money-bill-wave'
        };
        return icons[type] || 'fa-wallet';
    }

    /**
     * 获取默认颜色
     */
    getDefaultColor(type) {
        const colors = {
            stock: '#6366f1',
            fund: '#10b981',
            crypto: '#f59e0b',
            bank: '#3b82f6',
            bond: '#8b5cf6',
            cash: '#6b7280'
        };
        return colors[type] || '#6366f1';
    }
}

// ============================================
// 2. 智能再平衡系统
// ============================================

/**
 * 智能再平衡引擎
 * 根据目标配置自动计算调仓建议
 */
class RebalanceEngine {
    constructor(portfolioData) {
        this.data = portfolioData;
        this.targetAllocation = this.loadTargetAllocation();
    }

    /**
     * 加载目标配置
     */
    loadTargetAllocation() {
        const saved = localStorage.getItem('target_allocation');
        if (saved) return JSON.parse(saved);
        
        // 默认配置：股债均衡
        return {
            stocks: { target: 60, min: 50, max: 70 },
            funds: { target: 30, min: 20, max: 40 },
            cash: { target: 10, min: 5, max: 15 },
            sectors: {
                '科技': { target: 25, max: 35 },
                '新能源': { target: 20, max: 30 },
                '消费': { target: 15, max: 25 },
                '医药': { target: 10, max: 20 },
                '金融': { target: 10, max: 20 },
                '其他': { target: 20, max: 30 }
            }
        };
    }

    /**
     * 保存目标配置
     */
    saveTargetAllocation(allocation) {
        localStorage.setItem('target_allocation', JSON.stringify(allocation));
        this.targetAllocation = allocation;
    }

    /**
     * 计算当前配置
     */
    calculateCurrentAllocation() {
        const total = this.data.totalAssets || 1;
        
        const stockValue = this.data.stocks?.reduce((sum, s) => sum + (s.marketValue || 0), 0) || 0;
        const fundValue = this.data.funds?.reduce((sum, f) => sum + (f.marketValue || 0), 0) || 0;
        const cashValue = this.data.cash || 0;

        // 行业分布
        const sectorDistribution = {};
        [...(this.data.stocks || []), ...(this.data.funds || [])].forEach(item => {
            const sector = item.sector || '其他';
            if (!sectorDistribution[sector]) {
                sectorDistribution[sector] = { value: 0, weight: 0, items: [] };
            }
            sectorDistribution[sector].value += item.marketValue || 0;
            sectorDistribution[sector].items.push(item);
        });

        // 计算行业权重
        Object.keys(sectorDistribution).forEach(sector => {
            sectorDistribution[sector].weight = (sectorDistribution[sector].value / total * 100).toFixed(1);
        });

        return {
            stocks: { value: stockValue, weight: (stockValue / total * 100).toFixed(1) },
            funds: { value: fundValue, weight: (fundValue / total * 100).toFixed(1) },
            cash: { value: cashValue, weight: (cashValue / total * 100).toFixed(1) },
            sectors: sectorDistribution
        };
    }

    /**
     * 生成再平衡建议
     */
    generateRebalanceSuggestions() {
        const current = this.calculateCurrentAllocation();
        const target = this.targetAllocation;
        const total = this.data.totalAssets || 1;
        
        const suggestions = [];
        const warnings = [];

        // 1. 大类资产配置检查
        Object.keys(target).forEach(assetClass => {
            if (assetClass === 'sectors') return;
            
            const targetCfg = target[assetClass];
            const currentWeight = parseFloat(current[assetClass]?.weight || 0);
            const targetWeight = targetCfg.target;
            const diff = currentWeight - targetWeight;
            const diffAmount = (diff / 100 * total).toFixed(0);

            if (currentWeight > targetCfg.max) {
                warnings.push({
                    type: 'overweight',
                    asset: assetClass,
                    current: currentWeight,
                    target: targetWeight,
                    diff: diff.toFixed(1),
                    action: `卖出 ${assetClass === 'cash' ? '现金' : assetClass === 'stocks' ? '股票' : '基金'} ${Math.abs(diffAmount)} 元`,
                    priority: 'high'
                });
            } else if (currentWeight < targetCfg.min) {
                warnings.push({
                    type: 'underweight',
                    asset: assetClass,
                    current: currentWeight,
                    target: targetWeight,
                    diff: diff.toFixed(1),
                    action: `买入 ${assetClass === 'cash' ? '现金' : assetClass === 'stocks' ? '股票' : '基金'} ${Math.abs(diffAmount)} 元`,
                    priority: 'high'
                });
            }
        });

        // 2. 行业集中度检查
        if (target.sectors) {
            Object.keys(target.sectors).forEach(sector => {
                const targetCfg = target.sectors[sector];
                const currentWeight = parseFloat(current.sectors[sector]?.weight || 0);
                
                if (currentWeight > targetCfg.max) {
                    const excess = currentWeight - targetCfg.target;
                    const excessAmount = (excess / 100 * total).toFixed(0);
                    warnings.push({
                        type: 'sector_overweight',
                        sector,
                        current: currentWeight,
                        target: targetCfg.target,
                        action: `减仓 ${sector} 板块 ${excessAmount} 元`,
                        priority: 'medium'
                    });
                }
            });
        }

        // 3. 个股集中度检查（>10%警告）
        [...(this.data.stocks || []), ...(this.data.funds || [])].forEach(item => {
            const weight = ((item.marketValue || 0) / total * 100);
            if (weight > 10) {
                warnings.push({
                    type: 'concentration',
                    name: item.name,
                    weight: weight.toFixed(1),
                    action: `${item.name} 占比 ${weight.toFixed(1)}%，建议分散风险`,
                    priority: 'medium'
                });
            }
        });

        // 4. 生成具体调仓建议
        const rebalancePlan = this.generateRebalancePlan(current, target, total);

        return {
            current,
            target,
            warnings,
            rebalancePlan,
            isBalanced: warnings.length === 0
        };
    }

    /**
     * 生成具体调仓计划
     */
    generateRebalancePlan(current, target, total) {
        const plans = [];
        
        // 计算每类资产需要调整的金额
        Object.keys(target).forEach(assetClass => {
            if (assetClass === 'sectors') return;
            
            const currentWeight = parseFloat(current[assetClass]?.weight || 0);
            const targetWeight = target[assetClass].target;
            const diffWeight = targetWeight - currentWeight;
            const diffAmount = (diffWeight / 100 * total).toFixed(0);
            
            if (Math.abs(diffWeight) > 2) { // 超过2%才建议调整
                plans.push({
                    assetClass,
                    action: diffWeight > 0 ? '买入' : '卖出',
                    amount: Math.abs(parseInt(diffAmount)),
                    reason: `当前 ${currentWeight.toFixed(1)}% → 目标 ${targetWeight}%`
                });
            }
        });

        return plans.sort((a, b) => b.amount - a.amount);
    }

    /**
     * 模拟调仓效果
     */
    simulateRebalance(changes) {
        const current = this.calculateCurrentAllocation();
        const total = this.data.totalAssets || 1;
        
        const simulation = { ...current };
        
        changes.forEach(change => {
            const asset = simulation[change.assetClass];
            if (asset) {
                const newValue = change.action === '买入' 
                    ? asset.value + change.amount 
                    : asset.value - change.amount;
                asset.value = newValue;
                asset.weight = (newValue / total * 100).toFixed(1);
            }
        });

        return simulation;
    }
}

// ============================================
// 3. 收益归因分析系统
// ============================================

/**
 * 收益归因引擎
 * 分析收益来源：行业贡献、个股贡献、择时贡献
 */
class AttributionEngine {
    constructor(portfolioData, historicalData) {
        this.data = portfolioData;
        this.history = historicalData || {};
    }

    /**
     * 计算收益归因
     */
    calculateAttribution() {
        const result = {
            bySector: [],
            byStock: [],
            byFund: [],
            byFactor: {},
            summary: {}
        };

        // 1. 行业贡献分析
        result.bySector = this.calculateSectorContribution();
        
        // 2. 个股贡献分析
        result.byStock = this.calculateStockContribution();
        
        // 3. 基金贡献分析
        result.byFund = this.calculateFundContribution();
        
        // 4. 因子贡献（风格分析）
        result.byFactor = this.calculateFactorContribution();
        
        // 5. 汇总
        result.summary = this.generateAttributionSummary(result);

        return result;
    }

    /**
     * 行业贡献分析
     */
    calculateSectorContribution() {
        const sectors = {};
        const totalPnL = this.data.totalPnL || 1;

        // 合并股票和基金
        [...(this.data.stocks || []), ...(this.data.funds || [])].forEach(item => {
            const sector = item.sector || '其他';
            if (!sectors[sector]) {
                sectors[sector] = {
                    sector,
                    holdingPnL: 0,
                    dailyPnL: 0,
                    marketValue: 0,
                    count: 0
                };
            }
            sectors[sector].holdingPnL += item.holdingPnL || 0;
            sectors[sector].dailyPnL += item.dailyPnL || 0;
            sectors[sector].marketValue += item.marketValue || 0;
            sectors[sector].count++;
        });

        return Object.values(sectors).map(s => ({
            ...s,
            contribution: ((s.holdingPnL / totalPnL) * 100).toFixed(1),
            weight: ((s.marketValue / (this.data.totalAssets || 1)) * 100).toFixed(1)
        })).sort((a, b) => b.holdingPnL - a.holdingPnL);
    }

    /**
     * 个股贡献分析
     */
    calculateStockContribution() {
        if (!this.data.stocks || this.data.stocks.length === 0) return [];
        
        const totalPnL = this.data.totalPnL || 1;
        
        return this.data.stocks.map(s => ({
            name: s.name,
            code: s.code,
            holdingPnL: s.holdingPnL || 0,
            dailyPnL: s.dailyPnL || 0,
            marketValue: s.marketValue || 0,
            weight: ((s.marketValue / (this.data.totalAssets || 1)) * 100).toFixed(1),
            contribution: ((s.holdingPnL / totalPnL) * 100).toFixed(1),
            returnRate: s.cost > 0 ? (((s.price || s.currentPrice || s.marketValue / s.shares) - s.cost) / s.cost * 100).toFixed(1) : 0
        })).sort((a, b) => b.holdingPnL - a.holdingPnL);
    }

    /**
     * 基金贡献分析
     */
    calculateFundContribution() {
        if (!this.data.funds || this.data.funds.length === 0) return [];
        
        const totalPnL = this.data.totalPnL || 1;
        
        return this.data.funds.map(f => ({
            name: f.name,
            code: f.code,
            holdingPnL: f.holdingPnL || f.totalPnL || 0,
            marketValue: f.marketValue || 0,
            weight: ((f.marketValue / (this.data.totalAssets || 1)) * 100).toFixed(1),
            contribution: (((f.holdingPnL || f.totalPnL || 0) / totalPnL) * 100).toFixed(1),
            returnRate: f.cost > 0 ? ((f.nav || f.currentNav - f.cost) / f.cost * 100).toFixed(1) : 0
        })).sort((a, b) => b.holdingPnL - a.holdingPnL);
    }

    /**
     * 因子贡献分析（风格归因）
     */
    calculateFactorContribution() {
        const factors = {
            beta: { name: 'Beta暴露', value: 0, description: '市场敏感度' },
            size: { name: '市值因子', value: 0, description: '大盘股/小盘股偏好' },
            value: { name: '价值因子', value: 0, description: '低估值/高估值偏好' },
            momentum: { name: '动量因子', value: 0, description: '追涨/杀跌倾向' }
        };

        // 基于持仓特征计算因子暴露
        const stocks = this.data.stocks || [];
        if (stocks.length === 0) return factors;

        // 简化的因子计算（实际应使用多因子模型）
        const totalValue = stocks.reduce((sum, s) => sum + (s.marketValue || 0), 0);
        
        stocks.forEach(s => {
            const weight = (s.marketValue || 0) / totalValue;
            
            // Beta暴露（基于行业）
            const beta = CONFIG.SECTOR_BETAS[s.sector] || 1.0;
            factors.beta.value += beta * weight;
            
            // 市值因子（基于价格估算）
            if (s.price > 50) factors.size.value += weight;
            
            // 价值因子（基于收益回撤比估算）
            if (s.holdingPnL && s.holdingPnL < 0) factors.value.value += weight;
            
            // 动量因子（基于当日表现）
            if (s.dailyPnL && s.dailyPnL > 0) factors.momentum.value += weight;
        });

        return factors;
    }

    /**
     * 生成归因汇总
     */
    generateAttributionSummary(result) {
        const topContributors = [...result.byStock, ...result.byFund]
            .sort((a, b) => b.contribution - a.contribution)
            .slice(0, 5);

        const topSectors = result.bySector.slice(0, 3);
        
        return {
            topContributors,
            topSectors,
            totalReturn: this.data.totalPnL || 0,
            dailyReturn: this.data.dailyPnL || 0,
            factorExposure: result.byFactor
        };
    }

    /**
     * 与基准对比归因
     */
    compareWithBenchmark(benchmarkReturn) {
        const myReturn = ((this.data.totalPnL || 0) / (this.data.totalAssets - this.data.totalPnL || 1) * 100);
        const excessReturn = myReturn - benchmarkReturn;

        return {
            myReturn: myReturn.toFixed(2),
            benchmarkReturn: benchmarkReturn.toFixed(2),
            excessReturn: excessReturn.toFixed(2),
            alpha: excessReturn > 0 ? `+${excessReturn.toFixed(2)}%` : `${excessReturn.toFixed(2)}%`,
            interpretation: excessReturn > 0 
                ? `跑赢基准 ${excessReturn.toFixed(2)}%，主要来自个股选择能力`
                : `跑输基准 ${Math.abs(excessReturn).toFixed(2)}%，需要审视持仓结构`
        };
    }
}

// ============================================
// 4. 风险分析系统升级
// ============================================

/**
 * 风险分析引擎
 * 计算夏普比率、最大回撤、VaR、波动率等指标
 */
class RiskEngine {
    constructor(portfolioData, historicalData) {
        this.data = portfolioData;
        this.history = historicalData || {};
    }

    /**
     * 计算完整风险指标
     */
    calculateRiskMetrics() {
        const returns = this.calculateReturns();
        
        return {
            volatility: this.calculateVolatility(returns),
            sharpeRatio: this.calculateSharpeRatio(returns),
            maxDrawdown: this.calculateMaxDrawdown(),
            var: this.calculateVaR(returns),
            beta: this.calculatePortfolioBeta(),
            concentration: this.calculateConcentrationRisk(),
            sectorRisk: this.calculateSectorRisk(),
            stressTest: this.runStressTest()
        };
    }

    /**
     * 计算收益率序列
     */
    calculateReturns() {
        const dates = Object.keys(this.history).sort();
        const returns = [];
        
        for (let i = 1; i < dates.length; i++) {
            const prev = this.history[dates[i-1]];
            const curr = this.history[dates[i]];
            if (prev && curr && prev > 0) {
                returns.push((curr - prev) / prev);
            }
        }
        
        return returns;
    }

    /**
     * 计算波动率（年化）
     */
    calculateVolatility(returns) {
        if (returns.length < 2) return { value: 0, level: '未知' };
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        const dailyVol = Math.sqrt(variance);
        const annualVol = dailyVol * Math.sqrt(252); // 年化
        
        let level = '低';
        if (annualVol > 0.3) level = '高';
        else if (annualVol > 0.2) level = '中等';
        
        return {
            daily: (dailyVol * 100).toFixed(2) + '%',
            annual: (annualVol * 100).toFixed(2) + '%',
            value: annualVol,
            level,
            interpretation: `年化波动率 ${(annualVol * 100).toFixed(1)}%，属于${level}波动水平`
        };
    }

    /**
     * 计算夏普比率
     */
    calculateSharpeRatio(returns) {
        if (returns.length < 2) return { value: 0, rating: 'N/A' };
        
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const riskFreeRate = 0.025 / 252; // 假设无风险利率2.5%
        const excessReturn = meanReturn - riskFreeRate;
        
        const stdDev = Math.sqrt(returns.reduce((sum, r) => {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            return sum + Math.pow(r - mean, 2);
        }, 0) / returns.length);
        
        const sharpe = stdDev > 0 ? (excessReturn / stdDev) * Math.sqrt(252) : 0;
        
        let rating = '较差';
        if (sharpe > 1.5) rating = '优秀';
        else if (sharpe > 1) rating = '良好';
        else if (sharpe > 0.5) rating = '一般';
        
        return {
            value: sharpe.toFixed(2),
            rating,
            interpretation: `夏普比率 ${sharpe.toFixed(2)}，风险调整收益${rating}`
        };
    }

    /**
     * 计算最大回撤
     */
    calculateMaxDrawdown() {
        const dates = Object.keys(this.history).sort();
        if (dates.length < 2) return { value: 0, period: 'N/A' };
        
        let maxDrawdown = 0;
        let peak = this.history[dates[0]];
        let peakDate = dates[0];
        let troughDate = dates[0];
        let tempPeakDate = dates[0];
        
        for (const date of dates) {
            const value = this.history[date];
            
            if (value > peak) {
                peak = value;
                tempPeakDate = date;
            }
            
            const drawdown = (peak - value) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
                peakDate = tempPeakDate;
                troughDate = date;
            }
        }
        
        let level = '可控';
        if (maxDrawdown > 0.3) level = '高风险';
        else if (maxDrawdown > 0.2) level = '中等风险';
        
        return {
            value: (maxDrawdown * 100).toFixed(2) + '%',
            peakDate,
            troughDate,
            level,
            interpretation: `最大回撤 ${(maxDrawdown * 100).toFixed(1)}% (${peakDate} → ${troughDate})`
        };
    }

    /**
     * 计算风险价值 VaR
     */
    calculateVaR(returns, confidence = 0.95) {
        if (returns.length < 10) return { daily: 'N/A', weekly: 'N/A', monthly: 'N/A' };
        
        const sorted = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sorted.length);
        const dailyVaR = sorted[index];
        
        const totalValue = this.data.totalAssets || 1;
        const dailyVaRAmount = Math.abs(dailyVaR * totalValue);
        const weeklyVaRAmount = dailyVaRAmount * Math.sqrt(5);
        const monthlyVaRAmount = dailyVaRAmount * Math.sqrt(21);
        
        return {
            confidence: (confidence * 100) + '%',
            daily: formatMoney(dailyVaRAmount),
            dailyPercent: (Math.abs(dailyVaR) * 100).toFixed(2) + '%',
            weekly: formatMoney(weeklyVaRAmount),
            monthly: formatMoney(monthlyVaRAmount),
            interpretation: `日VaR ${(confidence * 100)}%: 单日损失不超过 ${formatMoney(dailyVaRAmount)} 的概率为 ${(confidence * 100)}%`
        };
    }

    /**
     * 计算组合Beta
     */
    calculatePortfolioBeta() {
        const stocks = this.data.stocks || [];
        const funds = this.data.funds || [];
        const totalValue = this.data.totalAssets || 1;
        
        let weightedBeta = 0;
        
        [...stocks, ...funds].forEach(item => {
            const weight = (item.marketValue || 0) / totalValue;
            const beta = CONFIG.SECTOR_BETAS[item.sector] || 1.0;
            weightedBeta += weight * beta;
        });
        
        let interpretation = '与市场同步';
        if (weightedBeta > 1.1) interpretation = '比市场波动更大';
        else if (weightedBeta < 0.9) interpretation = '比市场波动更小';
        
        return {
            value: weightedBeta.toFixed(2),
            interpretation,
            sensitivity: `市场上涨1%，组合预计上涨 ${(weightedBeta * 100).toFixed(1)}%`
        };
    }

    /**
     * 计算集中度风险
     */
    calculateConcentrationRisk() {
        const total = this.data.totalAssets || 1;
        const allHoldings = [...(this.data.stocks || []), ...(this.data.funds || [])];
        
        // 计算前5大持仓占比
        const top5 = allHoldings
            .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
            .slice(0, 5);
        
        const top5Weight = top5.reduce((sum, h) => sum + ((h.marketValue || 0) / total), 0);
        
        // 计算Herfindahl指数
        const weights = allHoldings.map(h => (h.marketValue || 0) / total);
        const hhi = weights.reduce((sum, w) => sum + w * w, 0);
        
        let level = '分散';
        if (top5Weight > 0.7) level = '高度集中';
        else if (top5Weight > 0.5) level = '中度集中';
        
        return {
            top5Weight: (top5Weight * 100).toFixed(1) + '%',
            herfindahl: (hhi * 10000).toFixed(0), // 通常乘以10000
            level,
            topHoldings: top5.map(h => ({ name: h.name, weight: ((h.marketValue || 0) / total * 100).toFixed(1) + '%' })),
            interpretation: `前5大持仓占比 ${(top5Weight * 100).toFixed(1)}%，${level}`
        };
    }

    /**
     * 计算行业风险
     */
    calculateSectorRisk() {
        const sectors = {};
        const total = this.data.totalAssets || 1;
        
        [...(this.data.stocks || []), ...(this.data.funds || [])].forEach(item => {
            const sector = item.sector || '其他';
            if (!sectors[sector]) sectors[sector] = 0;
            sectors[sector] += (item.marketValue || 0) / total;
        });
        
        const maxSectorWeight = Math.max(...Object.values(sectors), 0);
        const sectorCount = Object.keys(sectors).length;
        
        let level = '分散';
        if (maxSectorWeight > 0.4) level = '高度集中';
        else if (maxSectorWeight > 0.25) level = '中度集中';
        
        return {
            sectorCount,
            maxSectorWeight: (maxSectorWeight * 100).toFixed(1) + '%',
            level,
            distribution: Object.entries(sectors).map(([name, weight]) => ({
                name,
                weight: (weight * 100).toFixed(1) + '%'
            })).sort((a, b) => parseFloat(b.weight) - parseFloat(a.weight)),
            interpretation: `${sectorCount} 个行业，最大占比 ${(maxSectorWeight * 100).toFixed(1)}%`
        };
    }

    /**
     * 压力测试
     */
    runStressTest() {
        const totalValue = this.data.totalAssets || 0;
        const scenarios = [
            { name: '熊市(-20%)', drop: 0.2, impact: totalValue * 0.2 },
            { name: '回调(-10%)', drop: 0.1, impact: totalValue * 0.1 },
            { name: '小跌(-5%)', drop: 0.05, impact: totalValue * 0.05 },
            { name: '科技崩盘(-30%)', drop: 0.3, sector: '科技', impact: this.calculateSectorImpact('科技', 0.3) },
            { name: '金融危机(-40%)', drop: 0.4, impact: totalValue * 0.4 }
        ];
        
        return scenarios.map(s => ({
            ...s,
            remaining: totalValue - s.impact,
            impactFormatted: formatMoney(s.impact),
            remainingFormatted: formatMoney(totalValue - s.impact)
        }));
    }

    /**
     * 计算特定行业下跌影响
     */
    calculateSectorImpact(sectorName, dropRate) {
        const sectorValue = [...(this.data.stocks || []), ...(this.data.funds || [])]
            .filter(item => item.sector === sectorName)
            .reduce((sum, item) => sum + (item.marketValue || 0), 0);
        return sectorValue * dropRate;
    }

    /**
     * 生成风险报告
     */
    generateRiskReport() {
        const metrics = this.calculateRiskMetrics();
        
        return {
            metrics,
            riskLevel: this.assessOverallRisk(metrics),
            warnings: this.generateRiskWarnings(metrics),
            recommendations: this.generateRiskRecommendations(metrics)
        };
    }

    /**
     * 评估整体风险等级
     */
    assessOverallRisk(metrics) {
        let score = 0;
        
        if (parseFloat(metrics.volatility.annual) > 30) score += 2;
        if (parseFloat(metrics.maxDrawdown.value) > 30) score += 2;
        if (parseFloat(metrics.concentration.top5Weight) > 70) score += 2;
        if (metrics.sectorRisk.level === '高度集中') score += 1;
        if (parseFloat(metrics.beta.value) > 1.3) score += 1;
        
        if (score >= 6) return { level: '高风险', color: '#ef4444', description: '需要立即调整持仓结构' };
        if (score >= 4) return { level: '中等风险', color: '#f59e0b', description: '建议关注并适当调整' };
        if (score >= 2) return { level: '低风险', color: '#3b82f6', description: '整体风险可控' };
        return { level: '安全', color: '#10b981', description: '风险分散良好' };
    }

    /**
     * 生成风险提示
     */
    generateRiskWarnings(metrics) {
        const warnings = [];
        
        if (parseFloat(metrics.volatility.annual) > 30) {
            warnings.push({ type: 'high_volatility', message: '波动率过高，建议增加稳健资产配置' });
        }
        if (parseFloat(metrics.maxDrawdown.value) > 25) {
            warnings.push({ type: 'large_drawdown', message: '历史回撤较大，注意止损设置' });
        }
        if (parseFloat(metrics.concentration.top5Weight) > 60) {
            warnings.push({ type: 'concentration', message: '持仓过于集中，建议分散投资' });
        }
        if (metrics.sectorRisk.level === '高度集中') {
            warnings.push({ type: 'sector_concentration', message: '单一行业占比过高，存在行业风险' });
        }
        if (parseFloat(metrics.beta.value) > 1.3) {
            warnings.push({ type: 'high_beta', message: 'Beta偏高，市场下跌时损失可能放大' });
        }
        
        return warnings;
    }

    /**
     * 生成风险建议
     */
    generateRiskRecommendations(metrics) {
        const recommendations = [];
        
        if (parseFloat(metrics.sharpeRatio.value) < 0.5) {
            recommendations.push('夏普比率较低，建议优化资产配置或降低交易频率');
        }
        if (metrics.concentration.level === '高度集中') {
            recommendations.push('建议将单一持仓占比控制在10%以内');
        }
        if (parseFloat(metrics.var.dailyPercent) > 3) {
            recommendations.push('日VaR偏高，建议设置止损线或对冲风险');
        }
        
        return recommendations;
    }
}

// ============================================
// 全局实例初始化
// ============================================

let accountManager = null;
let rebalanceEngine = null;
let attributionEngine = null;
let riskEngine = null;

/**
 * 初始化高级功能模块
 */
function initAdvancedModules() {
    log('🔧 初始化高级功能模块...');
    
    accountManager = new AccountManager();
    
    const currentData = accountManager.getCurrentData();
    rebalanceEngine = new RebalanceEngine(currentData);
    attributionEngine = new AttributionEngine(currentData, historicalData);
    riskEngine = new RiskEngine(currentData, historicalData);
    
    log('✅ 高级模块初始化完成');
}

/**
 * 重新加载模块数据（切换账户后）
 */
function reloadModules() {
    const currentData = accountManager.getCurrentData();
    rebalanceEngine = new RebalanceEngine(currentData);
    attributionEngine = new AttributionEngine(currentData, historicalData);
    riskEngine = new RiskEngine(currentData, historicalData);
}
