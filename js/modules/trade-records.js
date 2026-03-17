// 交易记录功能模块 - P0
tradeRecords: {
    records: [],
    
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
}