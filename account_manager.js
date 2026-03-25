/**
 * 多账户管理模块
 * 支持账户切换、添加、删除
 */

class AccountManager {
    constructor() {
        this.currentAccountId = 'default';
        this.accounts = {};
        this.switchCallbacks = [];
    }

    /**
     * 初始化账户数据
     */
    init(accountsData) {
        this.accounts = accountsData || {};
        
        // 如果没有账户，创建默认账户
        if (Object.keys(this.accounts).length === 0) {
            this.accounts['default'] = this.createDefaultAccount();
        }
        
        // 从localStorage恢复上次选中的账户
        const savedAccountId = localStorage.getItem('currentAccountId');
        if (savedAccountId && this.accounts[savedAccountId]) {
            this.currentAccountId = savedAccountId;
        } else {
            this.currentAccountId = Object.keys(this.accounts)[0];
        }
        
        this.renderAccountSwitcher();
        return this.currentAccountId;
    }

    /**
     * 创建默认账户
     */
    createDefaultAccount() {
        return {
            id: 'default',
            name: '主账户',
            type: 'mixed',
            icon: 'fa-wallet',
            color: '#6366f1',
            data: {
                date: new Date().toISOString().split('T')[0],
                totalAssets: 0,
                dailyPnL: 0,
                totalPnL: 0,
                stocks: [],
                funds: []
            }
        };
    }

    /**
     * 获取当前账户
     */
    getCurrentAccount() {
        return this.accounts[this.currentAccountId];
    }

    /**
     * 获取当前账户ID
     */
    getCurrentAccountId() {
        return this.currentAccountId;
    }

    /**
     * 获取所有账户
     */
    getAllAccounts() {
        return Object.values(this.accounts);
    }

    /**
     * 切换账户
     */
    switchAccount(accountId) {
        if (!this.accounts[accountId]) {
            console.error(`账户不存在: ${accountId}`);
            return false;
        }
        
        this.currentAccountId = accountId;
        localStorage.setItem('currentAccountId', accountId);
        
        // 更新UI
        this.updateActiveState();
        
        // 触发回调
        this.switchCallbacks.forEach(cb => cb(accountId, this.accounts[accountId]));
        
        return true;
    }

    /**
     * 注册切换回调
     */
    onSwitch(callback) {
        this.switchCallbacks.push(callback);
    }

    /**
     * 添加新账户
     */
    addAccount(name, type = 'mixed') {
        const id = 'acc_' + Date.now();
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        const icons = ['fa-wallet', 'fa-briefcase', 'fa-piggy-bank', 'fa-chart-line', 'fa-coins', 'fa-building'];
        
        const accountIndex = Object.keys(this.accounts).length;
        
        this.accounts[id] = {
            id: id,
            name: name,
            type: type,
            icon: icons[accountIndex % icons.length],
            color: colors[accountIndex % colors.length],
            data: {
                date: new Date().toISOString().split('T')[0],
                totalAssets: 0,
                dailyPnL: 0,
                totalPnL: 0,
                stocks: [],
                funds: []
            }
        };
        
        this.renderAccountSwitcher();
        return id;
    }

    /**
     * 删除账户
     */
    deleteAccount(accountId) {
        if (Object.keys(this.accounts).length <= 1) {
            alert('至少需要保留一个账户');
            return false;
        }
        
        delete this.accounts[accountId];
        
        // 如果删除的是当前账户，切换到第一个账户
        if (this.currentAccountId === accountId) {
            this.currentAccountId = Object.keys(this.accounts)[0];
            localStorage.setItem('currentAccountId', this.currentAccountId);
        }
        
        this.renderAccountSwitcher();
        return true;
    }

    /**
     * 重命名账户
     */
    renameAccount(accountId, newName) {
        if (this.accounts[accountId]) {
            this.accounts[accountId].name = newName;
            this.renderAccountSwitcher();
            return true;
        }
        return false;
    }

    /**
     * 渲染账户切换器
     */
    renderAccountSwitcher() {
        const container = document.getElementById('accountSwitcher');
        if (!container) return;
        
        const accounts = this.getAllAccounts();
        const currentAccount = this.getCurrentAccount();
        
        if (accounts.length <= 1) {
            // 单账户时显示简洁版本
            container.innerHTML = `
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background: ${currentAccount?.color || '#6366f1'}20">
                    <i class="fas ${currentAccount?.icon || 'fa-wallet'}" style="color: ${currentAccount?.color || '#6366f1'}"></i>
                    <span class="text-sm font-medium">${currentAccount?.name || '主账户'}</span>
                </div>
            `;
            return;
        }
        
        // 多账户下拉菜单
        let html = `
            <div class="relative">
                <button id="accountDropdownBtn" class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center" style="background: ${currentAccount?.color || '#6366f1'}20">
                        <i class="fas ${currentAccount?.icon || 'fa-wallet'} text-xs" style="color: ${currentAccount?.color || '#6366f1'}"></i>
                    </div>
                    <span class="text-sm font-medium">${currentAccount?.name || '主账户'}</span>
                    <i class="fas fa-chevron-down text-xs text-gray-400"></i>
                </button>
                <div id="accountDropdownMenu" class="hidden absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
        `;
        
        accounts.forEach(acc => {
            const isActive = acc.id === this.currentAccountId;
            html += `
                <button class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors ${isActive ? 'bg-indigo-50' : ''}" 
                        onclick="accountManager.switchAccount('${acc.id}')">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background: ${acc.color}20">
                        <i class="fas ${acc.icon}" style="color: ${acc.color}"></i>
                    </div>
                    <div class="flex-1 text-left">
                        <div class="text-sm font-medium">${acc.name}</div>
                        <div class="text-xs text-gray-500">${this.getAccountTypeLabel(acc.type)}</div>
                    </div>
                    ${isActive ? '<i class="fas fa-check text-indigo-600 text-xs"></i>' : ''}
                </button>
            `;
        });
        
        html += `
                    <div class="border-t border-gray-200 my-1"></div>
                    <button class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-gray-600 transition-colors" 
                            onclick="accountManager.showAddAccountDialog()">
                        <i class="fas fa-plus text-gray-400"></i>
                        <span class="text-sm">添加账户</span>
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // 绑定下拉菜单事件
        const btn = document.getElementById('accountDropdownBtn');
        const menu = document.getElementById('accountDropdownMenu');
        
        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('hidden');
            });
            
            document.addEventListener('click', () => {
                menu.classList.add('hidden');
            });
        }
    }

    /**
     * 更新活跃状态
     */
    updateActiveState() {
        this.renderAccountSwitcher();
    }

    /**
     * 获取账户类型标签
     */
    getAccountTypeLabel(type) {
        const labels = {
            'stock': '股票账户',
            'fund': '基金账户',
            'mixed': '混合账户',
            'crypto': '加密账户',
            'bank': '银行理财'
        };
        return labels[type] || '其他';
    }

    /**
     * 显示添加账户对话框
     */
    showAddAccountDialog() {
        const name = prompt('请输入账户名称:', '新账户');
        if (name && name.trim()) {
            const type = confirm('是基金账户吗?\n(确定=基金账户, 取消=股票账户)') ? 'fund' : 'stock';
            const id = this.addAccount(name.trim(), type);
            this.switchAccount(id);
            
            // 触发数据保存
            if (window.DataManager && window.DataManager.saveAccounts) {
                window.DataManager.saveAccounts(this.accounts);
            }
        }
    }

    /**
     * 从原始数据转换多账户格式
     */
    static transformFromRaw(data) {
        const accounts = {};
        
        if (data.accounts && Array.isArray(data.accounts)) {
            // 处理数组格式
            data.accounts.forEach((acc, index) => {
                const id = acc.id || `account_${index}`;
                accounts[id] = {
                    id: id,
                    name: acc.name || `账户${index + 1}`,
                    type: acc.type || 'mixed',
                    icon: acc.icon || 'fa-wallet',
                    color: acc.color || '#6366f1',
                    data: {
                        date: data.lastUpdate || new Date().toISOString(),
                        totalAssets: acc.marketValue || 0,
                        dailyPnL: acc.dailyPnL || 0,
                        totalPnL: acc.totalPnL || 0,
                        stocks: acc.stocks || [],
                        funds: acc.funds || []
                    }
                };
            });
        } else if (data.accounts && typeof data.accounts === 'object') {
            // 已经是对象格式
            return data.accounts;
        }
        
        // 如果没有账户，创建默认账户
        if (Object.keys(accounts).length === 0) {
            accounts['default'] = {
                id: 'default',
                name: '主账户',
                type: 'mixed',
                icon: 'fa-wallet',
                color: '#6366f1',
                data: {
                    date: data.lastUpdate || new Date().toISOString(),
                    totalAssets: data.summary?.totalAssets || 0,
                    dailyPnL: data.summary?.dailyPnL || 0,
                    totalPnL: data.summary?.totalPnL || 0,
                    stocks: [],
                    funds: []
                }
            };
        }
        
        return accounts;
    }
}

// 全局实例
const accountManager = new AccountManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AccountManager, accountManager };
}
