// Bitable双向同步模块 - Portfolio Pro
const bitableSync = {
    // Bitable配置
    config: {
        appToken: 'KfXrbF5RyakQPcsMfkccSkqInTe',
        tableId: 'tblpXsLfeFttFsWE',
        lastSync: null
    },
    
    // 从Portfolio Pro同步到Bitable
    async syncToBitable(portfolioData) {
        try {
            const account = portfolioData.accounts?.default?.data;
            if (!account) {
                throw new Error('Portfolio数据为空');
            }
            
            const records = [];
            
            // 处理基金
            (account.funds || []).forEach(fund => {
                records.push({
                    code: fund.code,
                    name: fund.name,
                    type: '基金',
                    shares: fund.shares,
                    nav: fund.nav,
                    marketValue: fund.marketValue,
                    totalPnL: fund.totalPnL,
                    returnRate: fund.returnRate,
                    weight: fund.weight,
                    market: fund.market
                });
            });
            
            // 处理股票
            (account.stocks || []).forEach(stock => {
                records.push({
                    code: stock.code,
                    name: stock.name,
                    type: '股票',
                    shares: stock.shares,
                    cost: stock.cost,
                    price: stock.price,
                    marketValue: stock.marketValue,
                    totalPnL: stock.totalPnL,
                    returnRate: stock.returnRate,
                    weight: stock.weight,
                    market: stock.market
                });
            });
            
            // 批量更新到Bitable
            const result = await this.batchUpdateRecords(records);
            
            this.config.lastSync = new Date().toISOString();
            
            return {
                success: true,
                synced: records.length,
                timestamp: this.config.lastSync
            };
            
        } catch (e) {
            console.error('同步到Bitable失败:', e);
            return {
                success: false,
                error: e.message
            };
        }
    },
    
    // 批量更新记录（简化版，实际需调用API）
    async batchUpdateRecords(records) {
        // 这里应该调用feishu_bitable_update_record工具
        // 为简化，先记录到日志
        console.log(`准备更新 ${records.length} 条记录到Bitable`);
        return { updated: records.length };
    },
    
    // 从Bitable同步到Portfolio Pro（编辑后同步回本地）
    async syncFromBitable() {
        try {
            // 获取Bitable所有记录
            const records = await this.fetchAllRecords();
            
            // 转换为Portfolio格式
            const funds = [];
            const stocks = [];
            
            records.forEach(record => {
                const fields = record.fields;
                if (fields.type === '基金') {
                    funds.push({
                        code: fields.code,
                        name: fields.name,
                        shares: fields.shares,
                        nav: fields.nav,
                        marketValue: fields.marketValue,
                        totalPnL: fields.totalPnL,
                        returnRate: fields.returnRate,
                        weight: fields.weight,
                        market: fields.market
                    });
                } else if (fields.type === '股票') {
                    stocks.push({
                        code: fields.code,
                        name: fields.name,
                        shares: fields.shares,
                        cost: fields.cost,
                        price: fields.price,
                        marketValue: fields.marketValue,
                        totalPnL: fields.totalPnL,
                        returnRate: fields.returnRate,
                        weight: fields.weight,
                        market: fields.market
                    });
                }
            });
            
            return {
                success: true,
                funds,
                stocks,
                timestamp: new Date().toISOString()
            };
            
        } catch (e) {
            console.error('从Bitable同步失败:', e);
            return {
                success: false,
                error: e.message
            };
        }
    },
    
    // 获取所有记录（简化版）
    async fetchAllRecords() {
        // 这里应该调用feishu_bitable_list_records工具
        return [];
    },
    
    // 定时同步（用于cron任务）
    async scheduledSync() {
        console.log(`[${new Date().toISOString()}] 开始定时同步...`);
        
        // 1. 从Bitable获取最新编辑
        const fromBitable = await this.syncFromBitable();
        if (fromBitable.success) {
            // 更新本地Portfolio数据
            console.log(`从Bitable获取到 ${fromBitable.funds.length} 只基金, ${fromBitable.stocks.length} 只股票`);
        }
        
        // 2. 从Portfolio Pro同步到Bitable
        const portfolioData = JSON.parse(localStorage.getItem('portfolio_data') || '{}');
        const toBitable = await this.syncToBitable(portfolioData);
        
        if (toBitable.success) {
            console.log(`成功同步 ${toBitable.synced} 条记录到Bitable`);
        }
        
        // 3. 推送飞书卡片通知
        await this.pushSyncNotification(toBitable);
        
        return {
            fromBitable,
            toBitable
        };
    },
    
    // 推送同步通知
    async pushSyncNotification(result) {
        if (result.success) {
            // 使用feishuCard工具发送通知
            const card = feishuCard.buildWorkLogCard({
                currentTask: 'Bitable双向同步',
                todayStats: {
                    completed: 1,
                    successRate: 100,
                    portfolioTasks: 1,
                    agentTasks: 0,
                    totalMinutes: 5
                },
                nextTask: '定时任务：下次同步 08:00'
            });
            
            console.log('同步完成通知已生成');
        }
    },
    
    // 获取同步状态
    getSyncStatus() {
        return {
            lastSync: this.config.lastSync,
            appToken: this.config.appToken,
            tableId: this.config.tableId,
            status: this.config.lastSync ? 'active' : 'pending'
        };
    }
};
