// Agent工作日志系统 - A006
const agentWorkLogger = {
    // 当前工作状态
    currentState: {
        status: 'idle', // idle, working, paused, error
        currentTask: null,
        startTime: null,
        taskType: null // agent | portfolio
    },
    
    // 今日工作记录
    todayLog: [],
    
    // 初始化
    init() {
        this.loadTodayLog();
        this.startHeartbeat();
        console.log('[AgentWorkLogger] 工作日志系统已启动');
    },
    
    // 开始任务
    startTask(taskId, taskTitle, taskType) {
        this.currentState = {
            status: 'working',
            currentTask: { id: taskId, title: taskTitle },
            startTime: Date.now(),
            taskType: taskType
        };
        
        this.logEvent('start', { taskId, taskTitle, taskType });
        this.saveState();
    },
    
    // 完成任务
    completeTask(result = {}) {
        if (!this.currentState.currentTask) return;
        
        const duration = Date.now() - this.currentState.startTime;
        const record = {
            timestamp: new Date().toISOString(),
            taskId: this.currentState.currentTask.id,
            taskTitle: this.currentState.currentTask.title,
            taskType: this.currentState.taskType,
            duration: duration,
            status: 'completed',
            result: result
        };
        
        this.todayLog.push(record);
        this.logEvent('complete', record);
        
        // 重置状态
        this.currentState = { status: 'idle', currentTask: null, startTime: null, taskType: null };
        this.saveTodayLog();
        this.saveState();
        
        return record;
    },
    
    // 任务失败
    failTask(error) {
        if (!this.currentState.currentTask) return;
        
        const duration = Date.now() - this.currentState.startTime;
        const record = {
            timestamp: new Date().toISOString(),
            taskId: this.currentState.currentTask.id,
            taskTitle: this.currentState.currentTask.title,
            taskType: this.currentState.taskType,
            duration: duration,
            status: 'failed',
            error: error.message || error
        };
        
        this.todayLog.push(record);
        this.logEvent('fail', record);
        
        this.currentState = { status: 'idle', currentTask: null, startTime: null, taskType: null };
        this.saveTodayLog();
        this.saveState();
        
        return record;
    },
    
    // 记录事件
    logEvent(type, data) {
        const event = {
            type,
            timestamp: new Date().toISOString(),
            data
        };
        console.log(`[AgentWork] ${type}:`, data);
    },
    
    // 保存到localStorage
    saveTodayLog() {
        try {
            localStorage.setItem('agent_work_log_' + this.getTodayKey(), JSON.stringify(this.todayLog));
        } catch (e) {
            console.warn('保存工作日志失败:', e);
        }
    },
    
    // 加载今日日志
    loadTodayLog() {
        try {
            const saved = localStorage.getItem('agent_work_log_' + this.getTodayKey());
            if (saved) {
                this.todayLog = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('加载工作日志失败:', e);
        }
    },
    
    // 保存当前状态
    saveState() {
        try {
            localStorage.setItem('agent_work_state', JSON.stringify(this.currentState));
        } catch (e) {
            console.warn('保存工作状态失败:', e);
        }
    },
    
    // 获取今日统计
    getTodayStats() {
        const completed = this.todayLog.filter(r => r.status === 'completed');
        const failed = this.todayLog.filter(r => r.status === 'failed');
        
        const agentTasks = completed.filter(r => r.taskType === 'agent');
        const portfolioTasks = completed.filter(r => r.taskType === 'portfolio');
        
        const totalDuration = completed.reduce((sum, r) => sum + r.duration, 0);
        
        return {
            total: this.todayLog.length,
            completed: completed.length,
            failed: failed.length,
            successRate: this.todayLog.length > 0 ? (completed.length / this.todayLog.length * 100).toFixed(1) : 0,
            agentTasks: agentTasks.length,
            portfolioTasks: portfolioTasks.length,
            totalDuration: totalDuration,
            totalDurationMinutes: Math.round(totalDuration / 60000)
        };
    },
    
    // 获取当前状态文本
    getCurrentStatusText() {
        if (this.currentState.status === 'idle') {
            return '空闲中，等待下一任务';
        }
        if (this.currentState.status === 'working' && this.currentState.currentTask) {
            const elapsed = Math.round((Date.now() - this.currentState.startTime) / 60000);
            return `执行中: ${this.currentState.currentTask.title} (${elapsed}分钟)`;
        }
        return '状态未知';
    },
    
    // 生成飞书卡片内容
    generateFeishuCard() {
        const stats = this.getTodayStats();
        const current = this.getCurrentStatusText();
        
        return {
            header: {
                template: "blue",
                title: {
                    content: "🤖 Agent工作实况",
                    tag: "plain_text"
                }
            },
            elements: [
                {
                    tag: "div",
                    text: {
                        content: `**当前状态**: ${current}`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**今日战绩**: 完成${stats.completed}个任务，成功率${stats.successRate}%`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**时间分配**: Portfolio开发 ${stats.portfolioTasks}个 | Agent进化 ${stats.agentTasks}个`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**总用时**: ${stats.totalDurationMinutes}分钟`,
                        tag: "lark_md"
                    }
                }
            ]
        };
    },
    
    // 生成Markdown日志
    generateMarkdownLog() {
        const stats = this.getTodayStats();
        const now = new Date().toLocaleString('zh-CN');
        
        let md = `## Agent工作日志 | ${new Date().toLocaleDateString('zh-CN')}\n\n`;
        md += `**更新时间**: ${now}\n\n`;
        md += `### 今日统计\n\n`;
        md += `- 完成任务: ${stats.completed}个\n`;
        md += `- 失败任务: ${stats.failed}个\n`;
        md += `- 成功率: ${stats.successRate}%\n`;
        md += `- Portfolio任务: ${stats.portfolioTasks}个\n`;
        md += `- Agent任务: ${stats.agentTasks}个\n`;
        md += `- 总用时: ${stats.totalDurationMinutes}分钟\n\n`;
        md += `### 当前状态\n\n`;
        md += `${this.getCurrentStatusText()}\n\n`;
        md += `### 详细记录\n\n`;
        md += `| 时间 | 任务 | 类型 | 状态 | 用时 |\n`;
        md += `|------|------|------|------|------|\n`;
        
        this.todayLog.forEach(record => {
            const time = new Date(record.timestamp).toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'});
            const type = record.taskType === 'agent' ? 'Agent' : 'Portfolio';
            const status = record.status === 'completed' ? '✅' : '❌';
            const duration = Math.round(record.duration / 60000) + 'min';
            md += `| ${time} | ${record.taskTitle} | ${type} | ${status} | ${duration} |\n`;
        });
        
        return md;
    },
    
    // 获取今日键值
    getTodayKey() {
        return new Date().toISOString().split('T')[0];
    },
    
    // 心跳：定期保存状态
    startHeartbeat() {
        setInterval(() => {
            if (this.currentState.status === 'working') {
                this.saveState();
            }
        }, 60000); // 每分钟保存一次
    }
};

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    agentWorkLogger.init();
});
