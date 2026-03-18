// 持仓趋势模块 - P007 - 交互优化版
const portfolioTrend = {
    chart: null,
    currentRange: '1M', // 1M, 3M, 6M, 1Y, ALL
    
    // 时间范围配置
    ranges: {
        '1M': { days: 30, label: '近1月' },
        '3M': { days: 90, label: '近3月' },
        '6M': { days: 180, label: '近6月' },
        '1Y': { days: 365, label: '近1年' },
        'ALL': { days: 9999, label: '全部' }
    },
    
    // 初始化图表
    initChart(containerId, portfolioData) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // 准备数据
        const history = portfolioData.history || [];
        if (history.length < 2) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400">历史数据不足</div>';
            return;
        }
        
        // 根据当前范围过滤数据
        const filteredData = this.filterDataByRange(history, this.currentRange);
        
        // 渲染图表
        this.renderChart(container, filteredData);
        
        // 渲染时间范围选择器
        this.renderRangeSelector(container);
    },
    
    // 根据时间范围过滤数据
    filterDataByRange(history, range) {
        const days = this.ranges[range].days;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        
        return history.filter(h => new Date(h.date) >= cutoff);
    },
    
    // 渲染图表
    renderChart(container, data) {
        const labels = data.map(h => h.date);
        const values = data.map(h => h.totalAssets);
        
        // 计算收益率曲线
        const baseValue = values[0];
        const returns = values.map(v => ((v - baseValue) / baseValue * 100));
        
        // 计算最大最小值
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const minReturn = Math.min(...returns);
        const maxReturn = Math.max(...returns);
        
        // 创建SVG图表
        const width = container.clientWidth || 600;
        const height = 300;
        const padding = { top: 40, right: 60, bottom: 40, left: 60 };
        
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // 生成路径
        const points = values.map((v, i) => {
            const x = padding.left + (i / (values.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((v - minValue) / (maxValue - minValue)) * chartHeight;
            return `${x},${y}`;
        });
        
        // 生成区域路径
        const areaPoints = [
            `${padding.left},${padding.top + chartHeight}`,
            ...points,
            `${padding.left + chartWidth},${padding.top + chartHeight}`
        ];
        
        // 当前值
        const currentValue = values[values.length - 1];
        const currentReturn = returns[returns.length - 1];
        const isPositive = currentReturn >= 0;
        
        container.innerHTML = `
            <div class="trend-chart-container">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <div class="text-sm text-gray-500">总资产走势</div>
                        <div class="text-2xl font-bold ${isPositive ? 'text-red-500' : 'text-green-500'}">
                            ¥${(currentValue/10000).toFixed(2)}万
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm text-gray-500">期间收益</div>
                        <div class="text-xl font-bold ${isPositive ? 'text-red-500' : 'text-green-500'}">
                            ${isPositive ? '+' : ''}${currentReturn.toFixed(2)}%
                        </div>
                    </div>
                </div>
                
                <div class="relative" style="height: ${height}px">
                    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}"
                        class="trend-chart"
                    >
                        <!-- 背景网格 -->
                        <g class="grid">
                            ${[0, 1, 2, 3, 4].map(i => {
                                const y = padding.top + (chartHeight / 4) * i;
                                return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
                                    stroke="#e5e7eb" stroke-dasharray="4,4" stroke-width="1"/>
                                <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9ca3af">
                                    ${((maxValue - (maxValue - minValue) * (i/4))/10000).toFixed(1)}万
                                </text>
                                `;
                            }).join('')}
                        </g>
                        
                        <!-- 渐变定义 -->
                        <defs>
                            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:${isPositive ? '#ff4d4f' : '#52c41a'};stop-opacity:0.3"/>
                                <stop offset="100%" style="stop-color:${isPositive ? '#ff4d4f' : '#52c41a'};stop-opacity:0.05"/>
                            </linearGradient>
                        </defs>
                        
                        <!-- 填充区域 -->
                        <polygon points="${areaPoints.join(' ')}" fill="url(#areaGradient)"/>
                        
                        <!-- 折线 -->
                        <polyline points="${points.join(' ')}" 
                            fill="none" 
                            stroke="${isPositive ? '#ff4d4f' : '#52c41a'}" 
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                        
                        <!-- 数据点 -->
                        ${points.map((p, i) => {
                            if (i === 0 || i === points.length - 1 || i % Math.ceil(points.length/10) === 0) {
                                const [x, y] = p.split(',');
                                return `<circle cx="${x}" cy="${y}" r="3" 
                                    fill="${isPositive ? '#ff4d4f' : '#52c41a'}" 
                                    stroke="white" stroke-width="2"
                                    class="chart-point" data-index="${i}"
                                />`;
                            }
                            return '';
                        }).join('')}
                        
                        <!-- 当前值指示线 -->
                        <line x1="${padding.left}" y1="${points[points.length-1].split(',')[1]}" 
                            x2="${width - padding.right}" y2="${points[points.length-1].split(',')[1]}" 
                            stroke="${isPositive ? '#ff4d4f' : '#52c41a'}" stroke-width="1" stroke-dasharray="5,5" opacity="0.5"/>
                    </svg>
                    
                    <!-- 悬停提示 -->
                    <div class="chart-tooltip hidden absolute bg-white rounded-lg shadow-lg p-2 text-xs border"
                        style="pointer-events: none;"
                    >
                        <div class="font-medium" id="tooltip-date"></div>
                        <div id="tooltip-value"></div>
                        <div id="tooltip-return"></div>
                    </div>
                </div>
                
                <div class="flex justify-between text-xs text-gray-400 mt-2 px-4">
                    <span>${labels[0]}</span>
                    <span>${labels[Math.floor(labels.length/2)]}</span>
                    <span>${labels[labels.length-1]}</span>
                </div>
            </div>
        `;
        
        // 添加交互
        this.addChartInteractions(container, data);
    },
    
    // 添加图表交互
    addChartInteractions(container, data) {
        const svg = container.querySelector('svg');
        const tooltip = container.querySelector('.chart-tooltip');
        
        if (!svg || !tooltip) return;
        
        svg.addEventListener('mousemove', (e) => {
            const rect = svg.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            const padding = { left: 60, right: 60 };
            
            const chartWidth = width - padding.left - padding.right;
            const relativeX = Math.max(0, Math.min(1, (x - padding.left) / chartWidth));
            const index = Math.round(relativeX * (data.length - 1));
            
            if (index >= 0 && index < data.length) {
                const item = data[index];
                const baseValue = data[0].totalAssets;
                const returnRate = ((item.totalAssets - baseValue) / baseValue * 100);
                const isPositive = returnRate >= 0;
                
                tooltip.querySelector('#tooltip-date').textContent = item.date;
                tooltip.querySelector('#tooltip-value').textContent = `资产: ¥${(item.totalAssets/10000).toFixed(2)}万`;
                tooltip.querySelector('#tooltip-return').textContent = `收益: ${isPositive ? '+' : ''}${returnRate.toFixed(2)}%`;
                tooltip.querySelector('#tooltip-return').className = isPositive ? 'text-red-500' : 'text-green-500';
                
                tooltip.style.left = `${x}px`;
                tooltip.style.top = '20px';
                tooltip.classList.remove('hidden');
            }
        });
        
        svg.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });
    },
    
    // 渲染时间范围选择器
    renderRangeSelector(container) {
        const existing = container.querySelector('.range-selector');
        if (existing) existing.remove();
        
        const selector = document.createElement('div');
        selector.className = 'range-selector flex justify-center gap-2 mt-4';
        
        selector.innerHTML = Object.entries(this.ranges).map(([key, config]) => `
            <button 
                onclick="portfolioTrend.setRange('${key}')"
                class="px-3 py-1 text-xs rounded-full transition-colors ${
                    this.currentRange === key 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }"
            >
                ${config.label}
            </button>
        `).join('');
        
        container.appendChild(selector);
    },
    
    // 设置时间范围
    setRange(range) {
        this.currentRange = range;
        // 重新初始化图表
        const container = document.querySelector('.trend-chart-container')?.parentElement;
        if (container) {
            const portfolioData = JSON.parse(localStorage.getItem('portfolio_data') || '{}');
            this.initChart(container.id, portfolioData);
        }
    }
};
