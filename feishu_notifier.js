/**
 * 飞书消息推送模块
 * 支持：文本消息、富文本卡片、交互式卡片
 */

const FeishuNotifier = {
    /**
     * Webhook 配置
     * 用户需要配置自己的飞书机器人 webhook
     */
    config: {
        webhook: '',  // 从飞书机器人设置中获取
        secret: ''     // 可选：签名密钥
    },

    /**
     * 初始化配置
     */
    init(webhook, secret = '') {
        this.config.webhook = webhook;
        this.config.secret = secret;
    },

    /**
     * 发送原始消息
     */
    async send(payload) {
        if (!this.config.webhook) {
            console.error('飞书 Webhook 未配置');
            return false;
        }

        try {
            const response = await fetch(this.config.webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            return result.code === 0;
        } catch (error) {
            console.error('飞书推送失败:', error);
            return false;
        }
    },

    /**
     * 发送每日持仓简报
     */
    async sendPortfolioSummary(portfolioData) {
        const { totalValue, totalCost, totalChange, totalChangePercent, stocks, funds, updateTime } = portfolioData;
        
        const isProfit = totalChange >= 0;
        const emoji = isProfit ? '📈' : '📉';
        const color = isProfit ? 'green' : 'red';
        
        // 构建持仓列表
        const holdingsText = [...stocks, ...funds].map(h => {
            const profitEmoji = h.profit >= 0 ? '▲' : '▼';
            return `**${h.name}** ${profitEmoji} ${h.profitPercent}% | 市值: ¥${(h.value/10000).toFixed(2)}万`;
        }).join('\n');

        const card = {
            msg_type: 'interactive',
            card: {
                config: { wide_screen_mode: true },
                header: {
                    title: {
                        tag: 'plain_text',
                        content: `${emoji} 每日持仓简报 - ${new Date().toLocaleDateString('zh-CN')}`
                    },
                    template: isProfit ? 'green' : 'red'
                },
                elements: [
                    {
                        tag: 'div',
                        text: {
                            tag: 'lark_md',
                            content: `**总资产**: ¥${(totalValue/10000).toFixed(2)}万\n**今日盈亏**: ${isProfit ? '+' : ''}¥${totalChange.toFixed(2)} (${totalChangePercent}%)\n**持仓成本**: ¥${(totalCost/10000).toFixed(2)}万`
                        }
                    },
                    { tag: 'hr' },
                    {
                        tag: 'div',
                        text: {
                            tag: 'lark_md',
                            content: `**持仓明细**\n${holdingsText}`
                        }
                    },
                    {
                        tag: 'note',
                        elements: [{
                            tag: 'plain_text',
                            content: `数据更新时间: ${updateTime || new Date().toLocaleString('zh-CN')}`
                        }]
                    }
                ]
            }
        };

        return await this.send(card);
    },

    /**
     * 发送涨跌预警
     */
    async sendAlert(holding, alertType = 'rise') {
        const isRise = alertType === 'rise';
        const emoji = isRise ? '🚀' : '⚠️';
        const title = isRise ? '涨幅预警' : '跌幅预警';
        
        const card = {
            msg_type: 'interactive',
            card: {
                header: {
                    title: {
                        tag: 'plain_text',
                        content: `${emoji} ${title} - ${holding.name}`
                    },
                    template: isRise ? 'green' : 'red'
                },
                elements: [
                    {
                        tag: 'div',
                        text: {
                            tag: 'lark_md',
                            content: `**${holding.name}** (${holding.code})\n**当前价**: ¥${holding.price || holding.estimateNav}\n**涨跌幅**: ${holding.changePercent}%\n**你的盈亏**: ${holding.profit >= 0 ? '+' : ''}${holding.profitPercent}%`
                        }
                    }
                ]
            }
        };

        return await this.send(card);
    },

    /**
     * 发送简单文本消息
     */
    async sendText(content) {
        return await this.send({
            msg_type: 'text',
            content: { text: content }
        });
    },

    /**
     * 生成设置向导
     */
    getSetupGuide() {
        return `
## 飞书机器人配置步骤

### 1. 创建群机器人
1. 打开飞书群聊 → 设置 → 群机器人
2. 点击「添加机器人」
3. 选择「自定义机器人」
4. 填写名称如「持仓助手」，完成创建

### 2. 获取 Webhook
- 复制机器人提供的 Webhook 地址
- 格式: https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx

### 3. 配置到系统
在网页设置面板中粘贴 Webhook 地址

### 4. 测试推送
点击「发送测试消息」验证配置
        `.trim();
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeishuNotifier;
}
