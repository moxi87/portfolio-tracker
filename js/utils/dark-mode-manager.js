// 深色模式持久化模块 - P013
const darkModeManager = {
    // 配置
    config: {
        storageKey: 'portfolio_dark_mode',
        defaultMode: 'light', // light, dark, auto
        autoSwitchHour: { start: 18, end: 6 } // 自动切换时间
    },
    
    // 当前模式
    currentMode: 'light',
    
    // 初始化
    init() {
        // 读取保存的模式
        const savedMode = localStorage.getItem(this.config.storageKey);
        
        if (savedMode) {
            this.setMode(savedMode, false);
        } else {
            // 检测系统偏好
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setMode(prefersDark ? 'dark' : 'light', false);
        }
        
        // 监听系统主题变化
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.currentMode === 'auto') {
                this.applyMode(e.matches ? 'dark' : 'light');
            }
        });
        
        // 自动模式定时检查
        if (this.currentMode === 'auto') {
            this.startAutoSwitch();
        }
        
        // 添加切换按钮
        this.addToggleButton();
        
        console.log('[DarkMode] 初始化完成，当前模式:', this.currentMode);
    },
    
    // 设置模式
    setMode(mode, save = true) {
        if (!['light', 'dark', 'auto'].includes(mode)) {
            console.warn('[DarkMode] 无效的模式:', mode);
            return;
        }
        
        this.currentMode = mode;
        
        if (save) {
            localStorage.setItem(this.config.storageKey, mode);
        }
        
        if (mode === 'auto') {
            this.applyAutoMode();
            this.startAutoSwitch();
        } else {
            this.applyMode(mode);
            this.stopAutoSwitch();
        }
        
        // 更新按钮状态
        this.updateToggleButton();
        
        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('darkmodechange', { 
            detail: { mode: mode, isDark: this.isDark() } 
        }));
    },
    
    // 应用模式
    applyMode(mode) {
        const html = document.documentElement;
        
        if (mode === 'dark') {
            html.classList.add('dark');
            document.body.style.backgroundColor = '#0f172a';
            document.body.style.color = '#e2e8f0';
        } else {
            html.classList.remove('dark');
            document.body.style.backgroundColor = '#f8fafc';
            document.body.style.color = '#1e293b';
        }
        
        // 更新图表主题（如果有）
        this.updateChartsTheme(mode === 'dark');
        
        console.log('[DarkMode] 应用模式:', mode);
    },
    
    // 应用自动模式
    applyAutoMode() {
        const hour = new Date().getHours();
        const isDarkTime = hour >= this.config.autoSwitchHour.start || hour < this.config.autoSwitchHour.end;
        
        this.applyMode(isDarkTime ? 'dark' : 'light');
    },
    
    // 启动自动切换
    startAutoSwitch() {
        // 每分钟检查一次
        this.autoSwitchInterval = setInterval(() => {
            if (this.currentMode === 'auto') {
                this.applyAutoMode();
            }
        }, 60 * 1000);
    },
    
    // 停止自动切换
    stopAutoSwitch() {
        if (this.autoSwitchInterval) {
            clearInterval(this.autoSwitchInterval);
            this.autoSwitchInterval = null;
        }
    },
    
    // 检查当前是否为深色模式
    isDark() {
        return document.documentElement.classList.contains('dark');
    },
    
    // 切换模式
    toggle() {
        const newMode = this.isDark() ? 'light' : 'dark';
        this.setMode(newMode);
        return newMode;
    },
    
    // 添加切换按钮
    addToggleButton() {
        // 检查是否已存在
        if (document.getElementById('dark-mode-toggle')) return;
        
        const button = document.createElement('button');
        button.id = 'dark-mode-toggle';
        button.className = 'fixed bottom-4 right-4 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center text-lg z-50 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700';
        button.innerHTML = this.isDark() ? '☀️' : '🌙';
        button.title = '切换深色/浅色模式';
        
        button.addEventListener('click', () => {
            const newMode = this.toggle();
            button.innerHTML = newMode === 'dark' ? '☀️' : '🌙';
        });
        
        document.body.appendChild(button);
    },
    
    // 更新切换按钮
    updateToggleButton() {
        const button = document.getElementById('dark-mode-toggle');
        if (button) {
            button.innerHTML = this.isDark() ? '☀️' : '🌙';
        }
    },
    
    // 更新图表主题
    updateChartsTheme(isDark) {
        // 更新所有图表的颜色配置
        if (window.portfolioTrend && window.portfolioTrend.chart) {
            // 重新渲染图表以应用新主题
            const portfolioData = JSON.parse(localStorage.getItem('portfolio_data') || '{}');
            window.portfolioTrend.initChart('trendChart', portfolioData);
        }
        
        // 可以在这里添加其他图表的更新逻辑
    },
    
    // 获取当前模式
    getMode() {
        return this.currentMode;
    },
    
    // 重置为默认
    reset() {
        localStorage.removeItem(this.config.storageKey);
        this.setMode(this.config.defaultMode);
    }
};

// CSS变量定义（需要在主样式表中添加）
const darkModeStyles = `
    :root {
        --bg-primary: #f8fafc;
        --bg-secondary: #f1f5f9;
        --bg-card: #ffffff;
        --text-primary: #1e293b;
        --text-secondary: #64748b;
        --border-color: #e2e8f0;
        --accent-color: #3b82f6;
    }
    
    .dark {
        --bg-primary: #0f172a;
        --bg-secondary: #1e293b;
        --bg-card: #1e293b;
        --text-primary: #e2e8f0;
        --text-secondary: #94a3b8;
        --border-color: #334155;
        --accent-color: #60a5fa;
    }
    
    /* 全局过渡效果 */
    body, .glass, .card {
        transition: background-color 0.3s ease, color 0.3s ease;
    }
`;

// 注入样式
const styleSheet = document.createElement('style');
styleSheet.textContent = darkModeStyles;
document.head.appendChild(styleSheet);

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    darkModeManager.init();
});
