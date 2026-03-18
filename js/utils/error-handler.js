// 错误处理工具 - P009
const errorHandler = {
    // 错误分类
    categories: {
        NETWORK: 'network',      // 网络错误
        DATA: 'data',            // 数据错误
        RENDER: 'render',        // 渲染错误
        API: 'api',              // API错误
        UNKNOWN: 'unknown'       // 未知错误
    },
    
    // 错误日志
    logs: [],
    maxLogs: 50,
    
    // 记录错误
    log(error, context = {}) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            message: error.message || error,
            stack: error.stack,
            category: this.categorize(error),
            context: context,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.logs.push(errorInfo);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // 控制台输出
        console.error('[ErrorHandler]', errorInfo);
        
        // 保存到localStorage
        this.saveToStorage();
        
        return errorInfo;
    },
    
    // 错误分类
    categorize(error) {
        const msg = (error.message || error).toLowerCase();
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
            return this.categories.NETWORK;
        }
        if (msg.includes('json') || msg.includes('parse') || msg.includes('undefined')) {
            return this.categories.DATA;
        }
        if (msg.includes('render') || msg.includes('dom') || msg.includes('element')) {
            return this.categories.RENDER;
        }
        if (msg.includes('api') || msg.includes('http') || msg.includes('status')) {
            return this.categories.API;
        }
        return this.categories.UNKNOWN;
    },
    
    // 保存到localStorage
    saveToStorage() {
        try {
            localStorage.setItem('portfolio_error_logs', JSON.stringify(this.logs));
        } catch (e) {
            console.warn('保存错误日志失败:', e);
        }
    },
    
    // 从localStorage加载
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('portfolio_error_logs');
            if (saved) {
                this.logs = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('加载错误日志失败:', e);
        }
    },
    
    // 获取错误统计
    getStats() {
        const stats = {};
        this.logs.forEach(log => {
            stats[log.category] = (stats[log.category] || 0) + 1;
        });
        return stats;
    },
    
    // 清空日志
    clear() {
        this.logs = [];
        localStorage.removeItem('portfolio_error_logs');
    },
    
    // 包装异步函数
    async wrap(asyncFn, context = {}) {
        try {
            return await asyncFn();
        } catch (error) {
            this.log(error, context);
            throw error;
        }
    },
    
    // 带重试的fetch
    async fetchWithRetry(url, options = {}, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response;
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            } catch (error) {
                if (i === maxRetries - 1) {
                    this.log(error, { url, attempt: i + 1 });
                    throw error;
                }
                // 指数退避
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
            }
        }
    },
    
    // 渲染错误边界
    renderError(elementId, error, fallbackHtml = '') {
        this.log(error, { elementId });
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = fallbackHtml || `
                <div class="p-4 text-center text-gray-400">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>加载失败，请刷新重试</p>
                </div>
            `;
        }
    },
    
    // 初始化全局错误监听
    init() {
        this.loadFromStorage();
        
        // 监听未捕获的错误
        window.addEventListener('error', (event) => {
            this.log(event.error || event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // 监听未处理的Promise错误
        window.addEventListener('unhandledrejection', (event) => {
            this.log(event.reason, { type: 'unhandledrejection' });
        });
        
        console.log('[ErrorHandler] 已初始化');
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    errorHandler.init();
});
