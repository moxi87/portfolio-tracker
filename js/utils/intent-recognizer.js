// 用户意图识别模块 - A003
const intentRecognizer = {
    // 意图类型定义
    intents: {
        QUERY_PORTFOLIO: {
            keywords: ['持仓', '资产', '收益', '盈亏', '市值', 'portfolio', 'position'],
            priority: 1
        },
        QUERY_STOCK: {
            keywords: ['股票', '基金', '代码', '价格', '走势', '行情'],
            priority: 1
        },
        SYNC_DATA: {
            keywords: ['同步', '更新', '刷新', '上传', '下载', 'sync'],
            priority: 2
        },
        ADD_POSITION: {
            keywords: ['添加', '买入', '新增', '建仓', '加仓', 'add'],
            priority: 1
        },
        REMOVE_POSITION: {
            keywords: ['删除', '卖出', '清仓', '减仓', '移除', 'remove'],
            priority: 1
        },
        MODIFY_POSITION: {
            keywords: ['修改', '编辑', '调整', '更新成本', 'change'],
            priority: 1
        },
        QUERY_REPORT: {
            keywords: ['报告', '分析', '对标', '归因', 'report', 'analysis'],
            priority: 2
        },
        SETTINGS: {
            keywords: ['设置', '配置', '参数', '偏好', 'setting', 'config'],
            priority: 3
        },
        HELP: {
            keywords: ['帮助', '怎么用', '说明', '文档', 'help', 'doc'],
            priority: 3
        },
        GREETING: {
            keywords: ['你好', 'hello', 'hi', '在吗', '在不在'],
            priority: 4
        },
        TASK_MANAGEMENT: {
            keywords: ['任务', '进化', '开发', 'todo', 'task', 'backlog'],
            priority: 2
        }
    },
    
    // 识别用户意图
    recognize(input) {
        if (!input || typeof input !== 'string') {
            return { intent: 'UNKNOWN', confidence: 0, params: {} };
        }
        
        const normalized = input.toLowerCase().trim();
        const scores = [];
        
        // 计算每种意图的匹配分数
        for (const [intentType, config] of Object.entries(this.intents)) {
            let score = 0;
            let matchedKeywords = [];
            
            for (const keyword of config.keywords) {
                if (normalized.includes(keyword.toLowerCase())) {
                    score += 1;
                    matchedKeywords.push(keyword);
                }
            }
            
            // 根据匹配数量和优先级计算最终分数
            if (score > 0) {
                scores.push({
                    intent: intentType,
                    score: score * (10 - config.priority), // 优先级越高，权重越大
                    matchedKeywords,
                    priority: config.priority
                });
            }
        }
        
        // 排序并选择最佳匹配
        scores.sort((a, b) => b.score - a.score);
        
        if (scores.length === 0) {
            return { intent: 'UNKNOWN', confidence: 0, params: {} };
        }
        
        const best = scores[0];
        const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
        const confidence = best.score / totalScore;
        
        // 提取参数
        const params = this.extractParams(normalized, best.intent);
        
        return {
            intent: best.intent,
            confidence: confidence,
            params: params,
            alternatives: scores.slice(1, 3).map(s => s.intent),
            matchedKeywords: best.matchedKeywords
        };
    },
    
    // 根据意图提取参数
    extractParams(input, intent) {
        const params = {};
        
        // 提取代码
        const codeMatch = input.match(/(\d{6})/);
        if (codeMatch) {
            params.code = codeMatch[1];
        }
        
        // 提取金额
        const amountMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:万|w)?/i);
        if (amountMatch) {
            params.amount = parseFloat(amountMatch[1]);
            if (input.includes('万') || input.includes('w')) {
                params.amount *= 10000;
            }
        }
        
        // 提取价格
        const priceMatch = input.match(/(\d+(?:\.\d+)?)\s*元?/);
        if (priceMatch && !input.includes('万')) {
            params.price = parseFloat(priceMatch[1]);
        }
        
        // 提取数量
        const quantityMatch = input.match(/(\d+)\s*(?:股|份|手)?/);
        if (quantityMatch) {
            params.quantity = parseInt(quantityMatch[1]);
        }
        
        // 根据意图类型提取特定参数
        switch (intent) {
            case 'ADD_POSITION':
            case 'REMOVE_POSITION':
                params.action = intent === 'ADD_POSITION' ? 'buy' : 'sell';
                break;
            case 'QUERY_STOCK':
                if (params.code) {
                    params.type = 'single';
                } else {
                    params.type = 'all';
                }
                break;
            case 'QUERY_PORTFOLIO':
                if (input.includes('今日') || input.includes('今天')) {
                    params.period = 'today';
                } else if (input.includes('本周') || input.includes('这周')) {
                    params.period = 'week';
                } else if (input.includes('本月')) {
                    params.period = 'month';
                } else {
                    params.period = 'all';
                }
                break;
        }
        
        return params;
    },
    
    // 生成回复建议
    generateResponse(intentResult, portfolioData) {
        const { intent, params, confidence } = intentResult;
        
        if (confidence < 0.3) {
            return {
                type: 'clarification',
                message: '我不太确定你的意思。你是想查看持仓、添加股票，还是其他操作？',
                suggestions: ['查看持仓', '添加股票', '查看收益', '查看报告']
            };
        }
        
        switch (intent) {
            case 'QUERY_PORTFOLIO':
                return {
                    type: 'action',
                    action: 'showPortfolio',
                    params: params,
                    message: '正在为你查询持仓信息...'
                };
            
            case 'QUERY_STOCK':
                if (params.code) {
                    return {
                        type: 'action',
                        action: 'showStockDetail',
                        params: params,
                        message: `正在查询 ${params.code} 的详细信息...`
                    };
                } else {
                    return {
                        type: 'action',
                        action: 'showAllStocks',
                        message: '正在显示所有持仓股票...'
                    };
                }
            
            case 'ADD_POSITION':
                return {
                    type: 'action',
                    action: 'openAddDialog',
                    params: params,
                    message: params.code 
                        ? `准备添加代码为 ${params.code} 的持仓...` 
                        : '请提供要添加的股票/基金代码'
                };
            
            case 'SYNC_DATA':
                return {
                    type: 'action',
                    action: 'syncData',
                    message: '正在同步最新数据...'
                };
            
            case 'QUERY_REPORT':
                return {
                    type: 'action',
                    action: 'showReport',
                    params: params,
                    message: '正在生成分析报告...'
                };
            
            case 'HELP':
                return {
                    type: 'info',
                    message: '我可以帮你：\n1. 查看持仓和收益\n2. 添加/删除股票基金\n3. 查看分析报告\n4. 同步最新数据\n\n直接告诉我你想做什么！'
                };
            
            case 'GREETING':
                return {
                    type: 'greeting',
                    message: '你好！有什么可以帮你的吗？'
                };
            
            default:
                return {
                    type: 'unknown',
                    message: '抱歉，我不太理解。试试说"查看持仓"或"添加股票 000001"'
                };
        }
    },
    
    // 学习用户习惯（简单版）
    learnFromInteraction(input, intent, wasCorrect) {
        // 可以在这里添加机器学习逻辑
        // 例如：记录用户的输入模式和偏好
        const learning = JSON.parse(localStorage.getItem('intent_learning') || '{}');
        
        if (!learning[intent]) {
            learning[intent] = [];
        }
        
        learning[intent].push({
            input: input,
            correct: wasCorrect,
            timestamp: new Date().toISOString()
        });
        
        // 只保留最近100条学习记录
        if (learning[intent].length > 100) {
            learning[intent] = learning[intent].slice(-100);
        }
        
        localStorage.setItem('intent_learning', JSON.stringify(learning));
    }
};
