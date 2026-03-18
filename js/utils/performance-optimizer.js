// 响应延迟优化模块 - A004
const performanceOptimizer = {
    // 性能配置
    config: {
        cacheExpiry: {
            price: 30 * 1000,      // 价格数据30秒
            index: 60 * 1000,      // 指数数据60秒
            history: 5 * 60 * 1000, // 历史数据5分钟
            sentiment: 5 * 60 * 1000 // 情绪数据5分钟
        },
        batchSize: 5, // 批量请求大小
        debounceMs: 300, // 防抖时间
        throttleMs: 100  // 节流时间
    },
    
    // 请求缓存
    cache: new Map(),
    
    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // 节流函数
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // 带缓存的请求
    async cachedFetch(url, options = {}) {
        const cacheKey = `${url}_${JSON.stringify(options)}`;
        const cached = this.cache.get(cacheKey);
        
        // 检查缓存是否有效
        if (cached && Date.now() - cached.timestamp < (options.cacheTime || 60000)) {
            return cached.data;
        }
        
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            
            // 存入缓存
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            return data;
        } catch (e) {
            // 如果请求失败但有缓存，返回缓存数据
            if (cached) {
                console.warn('请求失败，使用缓存数据:', url);
                return cached.data;
            }
            throw e;
        }
    },
    
    // 批量请求
    async batchRequests(requests) {
        const results = [];
        const batchSize = this.config.batchSize;
        
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(req => this.cachedFetch(req.url, req.options))
            );
            results.push(...batchResults);
            
            // 批次间延迟，避免请求过快
            if (i + batchSize < requests.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return results;
    },
    
    // 预加载关键数据
    async preloadCriticalData() {
        const startTime = performance.now();
        
        // 并行预加载关键数据
        const preloadTasks = [
            this.preloadPortfolioData(),
            this.preloadMarketData(),
            this.preloadIndexData()
        ];
        
        await Promise.all(preloadTasks);
        
        const duration = performance.now() - startTime;
        console.log(`[Performance] 关键数据预加载完成，耗时: ${duration.toFixed(2)}ms`);
    },
    
    // 预加载持仓数据
    async preloadPortfolioData() {
        const data = localStorage.getItem('portfolio_data');
        if (data) {
            window.preloadedPortfolio = JSON.parse(data);
        }
    },
    
    // 预加载市场数据
    async preloadMarketData() {
        try {
            const response = await fetch('https://qt.gtimg.cn/q=sh000001', {
                cache: 'force-cache'
            });
            // 预加载完成
        } catch (e) {
            console.warn('市场数据预加载失败');
        }
    },
    
    // 预加载指数数据
    async preloadIndexData() {
        const indices = ['sh000001', 'sh000300', 'sz399001', 'sz399006'];
        const requests = indices.map(code => ({
            url: `https://qt.gtimg.cn/q=${code}`,
            options: { cacheTime: this.config.cacheExpiry.index }
        }));
        
        try {
            await this.batchRequests(requests);
        } catch (e) {
            console.warn('指数数据预加载失败');
        }
    },
    
    // 清理过期缓存
    cleanupCache() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, value] of this.cache.entries()) {
            // 清理超过1小时的缓存
            if (now - value.timestamp > 60 * 60 * 1000) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[Performance] 清理了 ${cleaned} 条过期缓存`);
        }
    },
    
    // 性能监控
    monitorPerformance() {
        // 监控页面加载时间
        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = performance.timing;
                const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
                const domReadyTime = timing.domComplete - timing.domLoading;
                
                console.log(`[Performance] 页面加载时间: ${pageLoadTime}ms`);
                console.log(`[Performance] DOM就绪时间: ${domReadyTime}ms`);
                
                // 如果加载时间过长，记录日志
                if (pageLoadTime > 3000) {
                    console.warn('[Performance] 页面加载缓慢，建议优化');
                }
            }, 0);
        });
        
        // 定期清理缓存
        setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // 每5分钟
    },
    
    // 优化渲染性能
    optimizeRender() {
        // 使用 requestAnimationFrame 优化动画
        const originalRAF = window.requestAnimationFrame;
        window.optimizedRAF = (callback) => {
            return originalRAF(() => {
                const start = performance.now();
                callback();
                const duration = performance.now() - start;
                
                if (duration > 16.67) { // 超过一帧时间(60fps)
                    console.warn(`[Performance] 渲染帧耗时过长: ${duration.toFixed(2)}ms`);
                }
            });
        };
    },
    
    // 初始化优化
    init() {
        // 页面加载完成后预加载数据
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.preloadCriticalData();
                this.monitorPerformance();
                this.optimizeRender();
            });
        } else {
            this.preloadCriticalData();
            this.monitorPerformance();
            this.optimizeRender();
        }
        
        console.log('[Performance] 性能优化模块已初始化');
    }
};

// 初始化
performanceOptimizer.init();
