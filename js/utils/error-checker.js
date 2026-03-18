// 错误自检机制 - A005
const errorChecker = {
    // 检查配置
    config: {
        checkInterval: 5 * 60 * 1000, // 5分钟检查一次
        autoFix: true, // 自动修复
        notify: true // 通知用户
    },
    
    // 自检项目清单
    checkList: {
        data: {
            name: '持仓数据完整性',
            check: async () => {
                try {
                    const data = JSON.parse(localStorage.getItem('portfolio_data') || '{}');
                    const issues = [];
                    
                    // 检查必要字段
                    if (!data.accounts) issues.push('缺少accounts字段');
                    if (!data.summary) issues.push('缺少summary字段');
                    if (!data.version) issues.push('缺少version字段');
                    
                    // 检查数值有效性
                    const summary = data.summary || {};
                    if (summary.totalAssets < 0) issues.push('总资产为负数');
                    if (summary.returnRate > 1000 || summary.returnRate < -100) {
                        issues.push('收益率异常');
                    }
                    
                    return {
                        status: issues.length === 0 ? 'ok' : 'warning',
                        issues: issues,
                        data: { totalAssets: summary.totalAssets, returnRate: summary.returnRate }
                    };
                } catch (e) {
                    return { status: 'error', error: e.message };
                }
            },
            fix: async () => {
                // 尝试修复数据
                try {
                    const data = JSON.parse(localStorage.getItem('portfolio_data') || '{}');
                    
                    // 修复缺失字段
                    if (!data.summary) data.summary = {};
                    if (!data.accounts) data.accounts = { default: { data: { funds: [], stocks: [] } } };
                    if (!data.version) data.version = '1.0.0';
                    
                    localStorage.setItem('portfolio_data', JSON.stringify(data));
                    return { success: true };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }
        },
        
        storage: {
            name: '本地存储空间',
            check: async () => {
                try {
                    let totalSize = 0;
                    for (let key in localStorage) {
                        totalSize += localStorage[key].length * 2; // UTF-16
                    }
                    
                    const usedMB = (totalSize / 1024 / 1024).toFixed(2);
                    const isWarning = totalSize > 4 * 1024 * 1024; // 4MB警告
                    
                    return {
                        status: isWarning ? 'warning' : 'ok',
                        data: { usedMB: usedMB, limitMB: 5 },
                        message: `已使用 ${usedMB}MB / 5MB`
                    };
                } catch (e) {
                    return { status: 'error', error: e.message };
                }
            },
            fix: async () => {
                // 清理旧数据
                try {
                    // 清理超过30天的历史记录
                    const data = JSON.parse(localStorage.getItem('portfolio_data') || '{}');
                    if (data.history && data.history.length > 30) {
                        data.history = data.history.slice(-30);
                        localStorage.setItem('portfolio_data', JSON.stringify(data));
                    }
                    return { success: true, message: '已清理30天前的历史数据' };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }
        },
        
        api: {
            name: '数据源连接',
            check: async () => {
                const results = [];
                
                // 测试腾讯财经
                try {
                    const response = await fetch('https://qt.gtimg.cn/q=sh000001', { 
                        method: 'HEAD',
                        cache: 'no-cache'
                    });
                    results.push({ name: '腾讯财经', status: response.ok ? 'ok' : 'error' });
                } catch (e) {
                    results.push({ name: '腾讯财经', status: 'error', error: e.message });
                }
                
                // 测试东方财富
                try {
                    const response = await fetch('https://push2.eastmoney.com/api/qt/stock/get?secid=1.000001', {
                        method: 'HEAD',
                        cache: 'no-cache'
                    });
                    results.push({ name: '东方财富', status: response.ok ? 'ok' : 'error' });
                } catch (e) {
                    results.push({ name: '东方财富', status: 'error', error: e.message });
                }
                
                const allOk = results.every(r => r.status === 'ok');
                return {
                    status: allOk ? 'ok' : 'warning',
                    data: results
                };
            },
            fix: null // 网络问题无法自动修复
        },
        
        github: {
            name: 'GitHub同步状态',
            check: async () => {
                // 检查本地提交状态
                // 由于浏览器环境无法直接访问git，通过检查本地存储的lastSync
                const lastSync = localStorage.getItem('github_last_sync');
                const pending = localStorage.getItem('github_pending_commits');
                
                if (!lastSync) {
                    return { status: 'warning', message: '从未同步到GitHub' };
                }
                
                const lastSyncDate = new Date(lastSync);
                const hoursSince = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);
                
                if (hoursSince > 24) {
                    return { 
                        status: 'warning', 
                        message: `上次同步: ${Math.floor(hoursSince)}小时前`,
                        data: { pending: pending ? JSON.parse(pending).length : 0 }
                    };
                }
                
                return { 
                    status: 'ok', 
                    message: `上次同步: ${Math.floor(hoursSince)}小时前`,
                    data: { pending: pending ? JSON.parse(pending).length : 0 }
                };
            },
            fix: null
        }
    },
    
    // 执行全部检查
    async runAllChecks() {
        const results = {};
        const startTime = Date.now();
        
        for (const [key, checker] of Object.entries(this.checkList)) {
            try {
                const result = await checker.check();
                results[key] = {
                    name: checker.name,
                    ...result
                };
                
                // 自动修复
                if (result.status !== 'ok' && this.config.autoFix && checker.fix) {
                    const fixResult = await checker.fix();
                    results[key].fixResult = fixResult;
                    if (fixResult.success) {
                        results[key].status = 'fixed';
                    }
                }
            } catch (e) {
                results[key] = {
                    name: checker.name,
                    status: 'error',
                    error: e.message
                };
            }
        }
        
        const duration = Date.now() - startTime;
        
        return {
            timestamp: new Date().toISOString(),
            duration: duration,
            results: results,
            summary: this.generateSummary(results)
        };
    },
    
    // 生成检查摘要
    generateSummary(results) {
        const counts = { ok: 0, warning: 0, error: 0, fixed: 0 };
        
        Object.values(results).forEach(r => {
            counts[r.status] = (counts[r.status] || 0) + 1;
        });
        
        let overall = 'ok';
        if (counts.error > 0) overall = 'error';
        else if (counts.warning > 0) overall = 'warning';
        
        return {
            overall,
            counts,
            message: this.getSummaryMessage(overall, counts)
        };
    },
    
    // 获取摘要消息
    getSummaryMessage(overall, counts) {
        if (overall === 'ok') return '✅ 所有检查通过，系统运行正常';
        if (overall === 'fixed') return `✅ 自动修复了 ${counts.fixed} 个问题`;
        if (overall === 'warning') return `⚠️ 发现 ${counts.warning} 个警告，建议关注`;
        return `❌ 发现 ${counts.error} 个错误，需要处理`;
    },
    
    // 渲染检查结果
    renderReport(containerId, report) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const statusColors = {
            ok: 'text-green-500',
            warning: 'text-yellow-500',
            error: 'text-red-500',
            fixed: 'text-blue-500'
        };
        
        const statusIcons = {
            ok: '✅',
            warning: '⚠️',
            error: '❌',
            fixed: '🔧'
        };
        
        let html = `
            <div class="glass rounded-2xl p-4">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white">
                            <i class="fas fa-stethoscope"></i>
                        </div>
                        <span class="text-sm font-medium text-gray-700">系统自检</span>
                    </div>
                    <span class="text-xs text-gray-400">${new Date(report.timestamp).toLocaleTimeString()}</span>
                </div>
                
                <div class="mb-4 p-3 rounded-xl ${report.summary.overall === 'ok' ? 'bg-green-50' : report.summary.overall === 'warning' ? 'bg-yellow-50' : 'bg-red-50'}">
                    <div class="font-medium ${statusColors[report.summary.overall]}">
                        ${statusIcons[report.summary.overall]} ${report.summary.message}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                        检查耗时: ${report.duration}ms
                    </div>
                </div>
                
                <div class="space-y-2">
        `;
        
        Object.entries(report.results).forEach(([key, result]) => {
            html += `
                <div class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div class="flex items-center gap-2">
                        <span class="${statusColors[result.status]}">${statusIcons[result.status]}</span>
                        <span class="text-sm">${result.name}</span>
                    </div>
                    <div class="text-xs text-gray-500">
                        ${result.message || result.status}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                
                <div class="mt-4 pt-3 border-t border-gray-100">
                    <button onclick="errorChecker.runAllChecks().then(r => errorChecker.renderReport('error-check-container', r))" 
                        class="w-full py-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                        <i class="fas fa-sync-alt mr-1"></i>重新检查
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // 启动定时自检
    startAutoCheck(interval = this.config.checkInterval) {
        console.log(`[ErrorChecker] 启动定时自检，间隔: ${interval}ms`);
        
        setInterval(async () => {
            const report = await this.runAllChecks();
            console.log('[ErrorChecker] 定时自检完成:', report.summary);
            
            // 如果有问题，推送到飞书
            if (report.summary.overall !== 'ok' && this.config.notify) {
                this.pushToFeishu(report);
            }
        }, interval);
    },
    
    // 推送到飞书
    async pushToFeishu(report) {
        // 这里应该调用飞书推送功能
        console.log('[ErrorChecker] 推送检查结果到飞书:', report.summary);
    }
};
