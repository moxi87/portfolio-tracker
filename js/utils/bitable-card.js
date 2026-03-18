// Bitable同步卡片模块
const bitableCard = {
    // 构建持仓同步完成卡片
    buildSyncCompleteCard(data) {
        const { timestamp, totalAssets, fundCount, stockCount, totalReturn, returnRate } = data;
        
        const isPositive = returnRate >= 0;
        const emoji = isPositive ? '📈' : '📉';
        const color = isPositive ? 'red' : 'green';
        
        return {
            config: {
                wide_screen_mode: true
            },
            header: {
                template: color,
                title: {
                    content: `${emoji} 持仓同步完成`,
                    tag: "plain_text"
                }
            },
            elements: [
                {
                    tag: "div",
                    text: {
                        content: `**同步时间**: ${new Date(timestamp).toLocaleString('zh-CN')}`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "hr"
                },
                {
                    tag: "div",
                    text: {
                        content: `**总资产**: ¥${(totalAssets/10000).toFixed(2)}万`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**累计收益**: ${isPositive ? '+' : ''}¥${totalReturn.toLocaleString()} (${isPositive ? '+' : ''}${returnRate}%)`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**持仓数量**: ${fundCount}只基金 + ${stockCount}只股票`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "hr"
                },
                {
                    tag: "action",
                    actions: [
                        {
                            tag: "button",
                            text: { content: "🔗 查看Bitable" },
                            type: "primary",
                            url: "https://dcn9ko7ladgo.feishu.cn/base/KfXrbF5RyakQPcsMfkccSkqInTe"
                        },
                        {
                            tag: "button",
                            text: { content: "📊 查看Portfolio" },
                            type: "default",
                            url: "https://moxi87.github.io/portfolio-tracker/"
                        }
                    ]
                }
            ]
        };
    },
    
    // 构建持仓变动提醒卡片
    buildPositionChangeCard(changes) {
        const elements = [
            {
                tag: "div",
                text: {
                    content: "**持仓变动提醒**",
                    tag: "lark_md"
                }
            },
            {
                tag: "hr"
            }
        ];
        
        changes.forEach(change => {
            const emoji = change.type === 'added' ? '🟢' : change.type === 'removed' ? '🔴' : '🟡';
            elements.push({
                tag: "div",
                text: {
                    content: `${emoji} **${change.name}** (${change.code}): ${change.description}`,
                    tag: "lark_md"
                }
            });
        });
        
        return {
            config: {
                wide_screen_mode: true
            },
            header: {
                template: "orange",
                title: {
                    content: "⚠️ 持仓变动",
                    tag: "plain_text"
                }
            },
            elements: elements
        };
    },
    
    // 构建每日持仓简报卡片
    buildDailyBriefCard(data) {
        const { date, totalAssets, dailyChange, topGainer, topLoser } = data;
        
        return {
            config: {
                wide_screen_mode: true
            },
            header: {
                template: dailyChange >= 0 ? 'red' : 'green',
                title: {
                    content: `📊 持仓简报 | ${date}`,
                    tag: "plain_text"
                }
            },
            elements: [
                {
                    tag: "div",
                    text: {
                        content: `**总资产**: ¥${(totalAssets/10000).toFixed(2)}万`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**今日涨跌**: ${dailyChange >= 0 ? '+' : ''}${dailyChange}%`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "hr"
                },
                topGainer ? {
                    tag: "div",
                    text: {
                        content: `**📈 今日最佳**: ${topGainer.name} (+${topGainer.change}%)`,
                        tag: "lark_md"
                    }
                } : null,
                topLoser ? {
                    tag: "div",
                    text: {
                        content: `**📉 今日最差**: ${topLoser.name} (${topLoser.change}%)`,
                        tag: "lark_md"
                    }
                } : null,
                {
                    tag: "hr"
                },
                {
                    tag: "action",
                    actions: [
                        {
                            tag: "button",
                            text: { content: "查看详情" },
                            type: "primary",
                            url: "https://dcn9ko7ladgo.feishu.cn/base/KfXrbF5RyakQPcsMfkccSkqInTe"
                        }
                    ]
                }
            ].filter(Boolean)
        };
    }
};
