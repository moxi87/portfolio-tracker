// 飞书富文本卡片Skill - A002
const feishuCard = {
    // 构建持仓晨报卡片
    buildMorningReportCard(data) {
        const { date, totalAssets, dailyPnL, dailyPercent, holdings, marketSentiment } = data;
        
        const pnlColor = dailyPnL >= 0 ? 'red' : 'green';
        const pnlIcon = dailyPnL >= 0 ? '📈' : '📉';
        
        return {
            config: {
                wide_screen_mode: true
            },
            header: {
                template: dailyPnL >= 0 ? 'red' : 'green',
                title: {
                    content: `${pnlIcon} 持仓晨报 | ${date}`,
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
                        content: `**今日盈亏**: ${dailyPnL >= 0 ? '+' : ''}¥${dailyPnL.toLocaleString()} (${dailyPercent}%)`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "hr"
                },
                {
                    tag: "div",
                    text: {
                        content: "**持仓TOP3**:",
                        tag: "lark_md"
                    }
                },
                {
                    tag: "table",
                    children: [
                        {
                            tag: "tr",
                            children: [
                                { tag: "th", text: { content: "名称" } },
                                { tag: "th", text: { content: "市值" } },
                                { tag: "th", text: { content: "涨跌" } }
                            ]
                        },
                        ...holdings.slice(0, 3).map(h => ({
                            tag: "tr",
                            children: [
                                { tag: "td", text: { content: h.name } },
                                { tag: "td", text: { content: `¥${(h.marketValue/10000).toFixed(1)}万` } },
                                { tag: "td", text: { content: `${h.change >= 0 ? '+' : ''}${h.change}%`, style: { color: h.change >= 0 ? 'red' : 'green' } } }
                            ]
                        }))
                    ]
                },
                {
                    tag: "hr"
                },
                {
                    tag: "div",
                    text: {
                        content: `市场情绪: ${marketSentiment}`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "action",
                    actions: [
                        {
                            tag: "button",
                            text: { content: "👍 有用" },
                            type: "primary",
                            value: { action: "feedback", type: "useful", report: "morning" }
                        },
                        {
                            tag: "button",
                            text: { content: "👎 无用" },
                            type: "default",
                            value: { action: "feedback", type: "useless", report: "morning" }
                        }
                    ]
                }
            ]
        };
    },
    
    // 构建工作日志卡片
    buildWorkLogCard(data) {
        const { currentTask, todayStats, nextTask } = data;
        
        return {
            config: {
                wide_screen_mode: true
            },
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
                        content: `**当前状态**: ${currentTask ? `执行中: ${currentTask}` : '空闲中'}`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**今日战绩**: 完成${todayStats.completed}个任务，成功率${todayStats.successRate}%`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**时间分配**: Portfolio ${todayStats.portfolioTasks}个 | Agent ${todayStats.agentTasks}个`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**总用时**: ${todayStats.totalMinutes}分钟`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "hr"
                },
                {
                    tag: "div",
                    text: {
                        content: nextTask ? `**下一任务**: ${nextTask}` : '暂无待执行任务',
                        tag: "lark_md"
                    }
                }
            ]
        };
    },
    
    // 构建任务完成通知卡片
    buildTaskCompleteCard(task, result) {
        const statusColor = result.success ? 'green' : 'red';
        const statusIcon = result.success ? '✅' : '❌';
        
        return {
            config: {
                wide_screen_mode: true
            },
            header: {
                template: statusColor,
                title: {
                    content: `${statusIcon} 任务完成 | ${task.title}`,
                    tag: "plain_text"
                }
            },
            elements: [
                {
                    tag: "div",
                    text: {
                        content: `**任务ID**: ${task.id}`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**类型**: ${task.type === 'agent' ? 'Agent进化' : 'Portfolio进化'}`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**用时**: ${result.duration}分钟`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `**结果**: ${result.success ? '成功' : '失败'}`,
                        tag: "lark_md"
                    }
                },
                result.commit ? {
                    tag: "div",
                    text: {
                        content: `**提交**: \`${result.commit}\``,
                        tag: "lark_md"
                    }
                } : null,
                result.message ? {
                    tag: "div",
                    text: {
                        content: `**详情**: ${result.message}`,
                        tag: "lark_md"
                    }
                } : null
            ].filter(Boolean)
        };
    },
    
    // 构建待决策任务卡片
    buildDecisionCard(tasks) {
        const elements = [
            {
                tag: "div",
                text: {
                    content: "**需要您决策的任务**",
                    tag: "lark_md"
                }
            },
            {
                tag: "hr"
            }
        ];
        
        tasks.forEach((task, index) => {
            elements.push({
                tag: "div",
                text: {
                    content: `${index + 1}. **${task.title}** (${task.estimatedMinutes}分钟)\n   ${task.description}`,
                    tag: "lark_md"
                }
            });
        });
        
        elements.push({
            tag: "hr"
        });
        
        elements.push({
            tag: "div",
            text: {
                content: "**请回复**: 确认任务编号，如 \"确认1,2\" 或 \"全部确认\"",
                tag: "lark_md"
            }
        });
        
        return {
            config: {
                wide_screen_mode: true
            },
            header: {
                template: "orange",
                title: {
                    content: "⚠️ 待决策",
                    tag: "plain_text"
                }
            },
            elements: elements
        };
    },
    
    // 构建音频播客卡片
    buildPodcastCard(data) {
        const { date, title, duration, topics, audioUrl } = data;
        
        return {
            config: {
                wide_screen_mode: true
            },
            header: {
                template: "purple",
                title: {
                    content: "🎧 乐活播客",
                    tag: "plain_text"
                }
            },
            elements: [
                {
                    tag: "div",
                    text: {
                        content: `**${date} | ${title}**`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `预计收听: ${duration}分钟 | 适合: 开车通勤`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: "**本期话题**:",
                        tag: "lark_md"
                    }
                },
                ...topics.map(t => ({
                    tag: "div",
                    text: {
                        content: `• ${t}`,
                        tag: "lark_md"
                    }
                })),
                {
                    tag: "hr"
                },
                {
                    tag: "a",
                    text: {
                        content: "🔗 点击收听",
                        tag: "plain_text"
                    },
                    href: audioUrl
                },
                {
                    tag: "action",
                    actions: [
                        {
                            tag: "button",
                            text: { content: "👍 有用" },
                            type: "primary",
                            value: { action: "feedback", type: "useful", report: "podcast" }
                        },
                        {
                            tag: "button",
                            text: { content: "👎 无用" },
                            type: "default",
                            value: { action: "feedback", type: "useless", report: "podcast" }
                        }
                    ]
                }
            ]
        };
    },
    
    // 构建新闻推送卡片
    buildNewsCard(news) {
        const sentimentEmoji = {
            positive: '🟢',
            negative: '🔴',
            neutral: '⚪'
        };
        
        const sentimentText = {
            positive: '利好',
            negative: '利空',
            neutral: '中性'
        };
        
        return {
            config: {
                wide_screen_mode: true
            },
            header: {
                template: news.sentiment === 'positive' ? 'red' : news.sentiment === 'negative' ? 'green' : 'grey',
                title: {
                    content: `${sentimentEmoji[news.sentiment]} 持仓相关新闻`,
                    tag: "plain_text"
                }
            },
            elements: [
                {
                    tag: "div",
                    text: {
                        content: `**${news.title}**`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `关联持仓: ${news.name} | 关联度: ${news.relevance}%`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "div",
                    text: {
                        content: `情绪: ${sentimentText[news.sentiment]} | 来源: ${news.source}`,
                        tag: "lark_md"
                    }
                },
                {
                    tag: "a",
                    text: {
                        content: "🔗 阅读全文",
                        tag: "plain_text"
                    },
                    href: news.url
                }
            ]
        };
    }
};
