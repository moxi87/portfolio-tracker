// 交易记录功能模块 - P0 - 修复版（支持GitHub存储）
const tradeRecords = {
    records: [],
    githubSyncEnabled: true,
    
    // 添加交易记录
    add(record) {
        const newRecord = {
            id: Date.now(),
            date: record.date || new Date().toISOString().split('T')[0],
            type: record.type, // 'buy' | 'sell'
            category: record.category, // 'stock' | 'fund'
            code: record.code,
            name: record.name,
            shares: record.shares,
            price: record.price,
            amount: record.shares * record.price,
            fee: record.fee || 0,
            notes: record.notes || ''
        };
        this.records.unshift(newRecord);
        this.save();
        this.syncToGitHub(); // 同步到GitHub
        return newRecord;
    },
    
    // 获取所有记录
    getAll() {
        return this.records;
    },
    
    // 按标的筛选
    getByCode(code) {
        return this.records.filter(r => r.code === code);
    },
    
    // 保存到本地
    save() {
        localStorage.setItem('portfolio_trade_records', JSON.stringify(this.records));
    },
    
    // 从本地加载
    load() {
        const saved = localStorage.getItem('portfolio_trade_records');
        if (saved) {
            this.records = JSON.parse(saved);
        }
    },
    
    // 从GitHub加载
    async loadFromGitHub() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/moxi87/portfolio-tracker/main/data/trade-records.json?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                if (data.records && data.records.length > 0) {
                    // 合并GitHub数据和本地数据（去重）
                    const githubRecords = data.records;
                    const localIds = new Set(this.records.map(r => r.id));
                    
                    githubRecords.forEach(record => {
                        if (!localIds.has(record.id)) {
                            this.records.push(record);
                        }
                    });
                    
                    // 按日期排序
                    this.records.sort((a, b) => new Date(b.date) - new Date(a.date));
                    this.save();
                    
                    console.log('已从GitHub同步交易记录:', githubRecords.length, '条');
                    return true;
                }
            }
        } catch (e) {
            console.error('从GitHub加载交易记录失败:', e);
        }
        return false;
    },
    
    // 同步到GitHub（通过提示用户手动提交）
    syncToGitHub() {
        if (!this.githubSyncEnabled) return;
        
        // 生成JSON数据
        const data = {
            version: '1.0',
            lastUpdate: new Date().toISOString(),
            recordCount: this.records.length,
            records: this.records
        };
        
        // 保存到localStorage，用于导出
        localStorage.setItem('portfolio_trade_records_github', JSON.stringify(data));
        
        // 显示提示
        console.log('交易记录已更新，请手动同步到GitHub');
        
        // 可以在这里添加自动下载功能
        // this.downloadForGitHub(data);
    },
    
    // 下载用于GitHub提交的JSON文件
    downloadForGitHub() {
        const data = {
            version: '1.0',
            lastUpdate: new Date().toISOString(),
            recordCount: this.records.length,
            records: this.records
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'trade-records.json';
        link.click();
        
        alert('交易记录已下载，请上传到 GitHub: data/trade-records.json');
    },
    
    // 初始化时从GitHub加载
    async init() {
        this.load();
        await this.loadFromGitHub();
    },
    
    // 计算持仓成本
    calculateCost(code) {
        const trades = this.getByCode(code);
        let totalShares = 0;
        let totalCost = 0;
        
        trades.forEach(t => {
            if (t.type === 'buy') {
                totalShares += t.shares;
                totalCost += t.amount + t.fee;
            } else {
                // 卖出按先进先出计算
                const sellShares = Math.min(t.shares, totalShares);
                const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
                totalShares -= sellShares;
                totalCost -= sellShares * avgCost;
            }
        });
        
        return {
            shares: totalShares,
            cost: totalCost,
            avgPrice: totalShares > 0 ? totalCost / totalShares : 0
        };
    },
    
    // 导出CSV
    exportCSV() {
        const headers = ['日期', '类型', '类别', '代码', '名称', '数量', '价格', '金额', '手续费', '备注'];
        const rows = this.records.map(r => [
            r.date,
            r.type === 'buy' ? '买入' : '卖出',
            r.category === 'stock' ? '股票' : '基金',
            r.code,
            r.name,
            r.shares,
            r.price,
            r.amount,
            r.fee,
            r.notes
        ]);
        
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `交易记录_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    tradeRecords.init();
});