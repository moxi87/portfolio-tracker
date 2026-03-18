// 首屏性能优化 - P012
const firstScreenOptimizer = {
    // 关键资源预加载列表
    criticalResources: [
        'css/styles.css',
        'js/core.js',
        'data/holdings.json'
    ],
    
    // 懒加载资源列表
    lazyResources: [
        'js/modules/benchmark.js',
        'js/modules/market-sentiment.js',
        'js/modules/portfolio-trend.js',
        'js/utils/bitable-card.js'
    ],
    
    // 初始化
    init() {
        this.preloadCriticalResources();
        this.setupLazyLoading();
        this.optimizeImages();
        this.deferNonCritical();
        this.setupSkeletonScreen();
    },
    
    // 预加载关键资源
    preloadCriticalResources() {
        this.criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            
            if (resource.endsWith('.css')) {
                link.as = 'style';
            } else if (resource.endsWith('.js')) {
                link.as = 'script';
            } else if (resource.endsWith('.json')) {
                link.as = 'fetch';
                link.crossOrigin = 'anonymous';
            }
            
            link.href = resource;
            document.head.appendChild(link);
        });
    },
    
    // 设置懒加载
    setupLazyLoading() {
        // 延迟加载非关键JS
        if ('IntersectionObserver' in window) {
            const scriptObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const script = entry.target;
                        this.loadScript(script.dataset.src);
                        scriptObserver.unobserve(script);
                    }
                });
            });
            
            // 标记懒加载脚本
            document.querySelectorAll('script[data-lazy]').forEach(script => {
                scriptObserver.observe(script);
            });
        } else {
            // 降级处理：直接加载
            this.lazyResources.forEach(src => this.loadScript(src));
        }
    },
    
    // 加载脚本
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    },
    
    // 图片优化
    optimizeImages() {
        // 懒加载图片
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
        
        // 响应式图片
        document.querySelectorAll('img').forEach(img => {
            img.loading = 'lazy';
            img.decoding = 'async';
        });
    },
    
    // 延迟非关键资源
    deferNonCritical() {
        // 延迟加载非关键CSS
        const nonCriticalCSS = [
            'css/mobile-responsive.css',
            'css/animations.css'
        ];
        
        setTimeout(() => {
            nonCriticalCSS.forEach(href => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
            });
        }, 100);
    },
    
    // 骨架屏
    setupSkeletonScreen() {
        // 隐藏骨架屏，显示内容
        window.addEventListener('load', () => {
            const skeleton = document.querySelector('.skeleton-screen');
            const content = document.querySelector('.main-content');
            
            if (skeleton && content) {
                skeleton.style.display = 'none';
                content.style.opacity = '1';
            }
        });
    },
    
    // 监控首屏性能
    monitorFirstScreen() {
        // 使用 Performance API
        if (window.performance) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const timing = performance.timing;
                    const firstScreenTime = timing.domContentLoadedEventEnd - timing.navigationStart;
                    
                    console.log(`[FirstScreen] 首屏加载时间: ${firstScreenTime}ms`);
                    
                    // 如果超过3秒，记录警告
                    if (firstScreenTime > 3000) {
                        console.warn('[FirstScreen] 首屏加载较慢，建议优化');
                    }
                }, 0);
            });
        }
    }
};

// 在DOM加载前执行关键优化
document.addEventListener('DOMContentLoaded', () => {
    firstScreenOptimizer.init();
});
