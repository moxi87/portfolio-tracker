// ============================================
// Portfolio Pro 配置文件
// ============================================
const CONFIG = {
    // 应用版本
    APP_VERSION: '5.7.0',
    
    // 调试模式
    DEBUG: false,
    
    // 默认数据（仅用于首次加载或数据缺失时）
    DEFAULTS: {
        INITIAL_ASSETS: 400000,  // 默认初始资产（仅作为placeholder提示）
        INITIAL_HISTORY_VALUE: 370000  // 历史数据起始值
    },
    
    // API 配置
    API: {
        SINA_QUOTE: 'https://hq.sinajs.cn/list={code}',
        FUND_NAV: 'https://fundgz.1234567.com.cn/js/{code}.js?rt={timestamp}',
        CORS_PROXIES: [
            'https://api.allorigins.win/get?url={url}',
            'https://corsproxy.io/?{url}'
        ]
    },
    
    // 市场时间配置
    MARKET: {
        OPEN_MORNING: { start: '09:30', end: '11:30' },
        OPEN_AFTERNOON: { start: '13:00', end: '15:00' },
        TIMEZONE: 'Asia/Shanghai'
    },
    
    // 指数基准（用于收益对标）
    BENCHMARKS: {
        HS300: { name: '沪深300', code: '000300' },
        CYB: { name: '创业板指', code: '399006' },
        SH: { name: '上证指数', code: '000001' },
        HSI: { name: '恒生指数', code: 'HSI' }
    },
    
    // 行业Beta值（用于风险分析）
    SECTOR_BETAS: {
        '新能源': 1.3,
        '科技': 1.4,
        '汽车': 1.2,
        '有色': 1.1,
        '基建': 0.9,
        '红利': 0.7,
        'ETF': 1.0,
        '现金': 0.0,
        '默认': 1.0
    }
};

// 日志工具（受DEBUG控制）
function log(...args) { if (CONFIG.DEBUG) console.log(...args); }
function warn(...args) { if (CONFIG.DEBUG) console.warn(...args); }
function error(...args) { if (CONFIG.DEBUG) console.error(...args); }
