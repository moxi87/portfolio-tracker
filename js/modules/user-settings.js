// 用户设置模块 - P0
userSettings: {
    defaults: {
        // 显示设置
        display: {
            theme: 'light', // 'light' | 'dark'
            defaultTab: 'dashboard',
            showDetails: true,
            chartType: 'line' // 'line' | 'bar'
        },
        
        // 预警设置
        alerts: {
            stockDropPercent: 5, // 个股跌幅预警 (%)
            portfolioDropPercent: 3, // 组合跌幅预警 (%)
            concentrationLimit: 50, // 集中度预警 (%)
            enabled: true
        },
        
        // 数据同步
        sync: {
            autoSync: true,
            syncTime: '15:30',
            githubRepo: 'moxi87/portfolio-tracker'
        },
        
        // 通知设置
        notifications: {
            marketOpen: true,
            marketClose: true,
            abnormalChange: true,
            dailyReport: true
        }
    },
    
    settings: {},
    
    // 初始化
    init() {
        this.load();
        this.applyTheme();
    },
    
    // 加载设置
    load() {
        const saved = localStorage.getItem('portfolio_settings');
        this.settings = saved ? { ...this.defaults, ...JSON.parse(saved) } : { ...this.defaults };
    },
    
    // 保存设置
    save() {
        localStorage.setItem('portfolio_settings', JSON.stringify(this.settings));
    },
    
    // 获取设置
    get(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.settings);
    },
    
    // 设置值
    set(key, value) {
        const keys = key.split('.');
        let obj = this.settings;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        this.save();
        
        // 应用特殊设置
        if (key === 'display.theme') {
            this.applyTheme();
        }
    },
    
    // 应用主题
    applyTheme() {
        const theme = this.get('display.theme');
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    },
    
    // 重置设置
    reset() {
        this.settings = { ...this.defaults };
        this.save();
        this.applyTheme();
    },
    
    // 导出设置
    export() {
        return JSON.stringify(this.settings, null, 2);
    },
    
    // 导入设置
    import(jsonStr) {
        try {
            const imported = JSON.parse(jsonStr);
            this.settings = { ...this.defaults, ...imported };
            this.save();
            this.applyTheme();
            return true;
        } catch (e) {
            console.error('导入设置失败:', e);
            return false;
        }
    },
    
    // 检查预警条件
    checkAlerts(stock, portfolio) {
        const alerts = [];
        
        if (!this.get('alerts.enabled')) return alerts;
        
        // 个股跌幅预警
        if (stock.dailyChange <= -this.get('alerts.stockDropPercent')) {
            alerts.push({
                type: 'stock_drop',
                level: 'high',
                message: `${stock.name} 跌幅超过 ${this.get('alerts.stockDropPercent')}%`
            });
        }
        
        // 集中度预警
        if (stock.weight > this.get('alerts.concentrationLimit')) {
            alerts.push({
                type: 'concentration',
                level: 'medium',
                message: `${stock.name} 集中度 ${stock.weight}% 超过 ${this.get('alerts.concentrationLimit')}%`
            });
        }
        
        return alerts;
    }
}