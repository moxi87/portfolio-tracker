// 记忆压缩算法模块 - A001
const memoryCompressor = {
    // 压缩配置
    config: {
        maxTokensPerQuery: 4000,
        summaryThreshold: 1000, // 超过此字数需要摘要
        contextWindow: 10, // 保留最近多少条对话
        compressionRatio: 0.3 // 压缩后保留30%核心信息
    },
    
    // 关键词提取
    extractKeywords(text, maxKeywords = 10) {
        // 停用词
        const stopWords = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '可以', '就是', '现在', '但是', '还是', '这个', '那个']);
        
        // 提取中文词汇（简化版）
        const words = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
        const wordFreq = {};
        
        words.forEach(word => {
            if (!stopWords.has(word) && word.length >= 2) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        // 按频率排序返回
        return Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxKeywords)
            .map(([word, count]) => ({ word, count }));
    },
    
    // 提取关键句（基于关键词密度）
    extractKeySentences(text, maxSentences = 3) {
        const sentences = text.match(/[^。！？.!?]+[。！？.!?]+/g) || [text];
        const keywords = this.extractKeywords(text, 20).map(k => k.word);
        
        const scored = sentences.map(sentence => {
            let score = 0;
            keywords.forEach(keyword => {
                if (sentence.includes(keyword)) {
                    score += 1;
                }
            });
            // 句子长度惩罚（太长或太短都不好）
            const lengthPenalty = sentence.length > 100 ? 0.5 : sentence.length < 10 ? 0.3 : 1;
            return { sentence: sentence.trim(), score: score * lengthPenalty };
        });
        
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSentences)
            .map(s => s.sentence);
    },
    
    // 智能摘要
    generateSummary(text, maxLength = 200) {
        if (text.length <= maxLength) return text;
        
        const keySentences = this.extractKeySentences(text, 3);
        let summary = keySentences.join(' ');
        
        // 如果还太长，截断并添加省略号
        if (summary.length > maxLength) {
            summary = summary.substring(0, maxLength - 3) + '...';
        }
        
        // 提取关键词作为标签
        const keywords = this.extractKeywords(text, 5).map(k => k.word);
        
        return {
            summary,
            keywords,
            originalLength: text.length,
            compressedLength: summary.length,
            compressionRatio: (summary.length / text.length).toFixed(2)
        };
    },
    
    // 对话历史压缩
    compressConversation(messages) {
        if (!messages || messages.length === 0) return [];
        
        // 保留最近的完整对话
        const recentMessages = messages.slice(-this.config.contextWindow);
        
        // 对更早的对话进行压缩
        const olderMessages = messages.slice(0, -this.config.contextWindow);
        
        if (olderMessages.length === 0) {
            return recentMessages;
        }
        
        // 按主题分组压缩
        const compressed = this.compressByTopic(olderMessages);
        
        // 合并保留
        return [
            { type: 'system', content: `[已压缩 ${olderMessages.length} 条历史对话，保留关键信息]` },
            ...compressed,
            ...recentMessages
        ];
    },
    
    // 按主题分组压缩
    compressByTopic(messages) {
        // 简单的主题聚类（基于关键词相似度）
        const topics = [];
        let currentTopic = { keywords: new Set(), messages: [] };
        
        messages.forEach(msg => {
            const keywords = new Set(this.extractKeywords(msg.content || '', 5).map(k => k.word));
            
            // 计算与当前主题的相似度
            const similarity = this.calculateSimilarity(currentTopic.keywords, keywords);
            
            if (similarity > 0.3 || currentTopic.messages.length === 0) {
                // 同一主题
                currentTopic.messages.push(msg);
                keywords.forEach(k => currentTopic.keywords.add(k));
            } else {
                // 新主题
                if (currentTopic.messages.length > 0) {
                    topics.push(currentTopic);
                }
                currentTopic = { keywords, messages: [msg] };
            }
        });
        
        if (currentTopic.messages.length > 0) {
            topics.push(currentTopic);
        }
        
        // 压缩每个主题
        return topics.map(topic => {
            const combined = topic.messages.map(m => m.content).join('\n');
            const summary = this.generateSummary(combined, 150);
            
            return {
                type: 'compressed',
                topic: Array.from(topic.keywords).slice(0, 3).join(', '),
                summary: summary.summary,
                keywords: summary.keywords,
                messageCount: topic.messages.length,
                timestamp: topic.messages[topic.messages.length - 1].timestamp
            };
        });
    },
    
    // 计算关键词相似度
    calculateSimilarity(set1, set2) {
        if (set1.size === 0 || set2.size === 0) return 0;
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    },
    
    // 为memory_search优化查询
    optimizeSearchQuery(query) {
        // 提取核心关键词
        const keywords = this.extractKeywords(query, 8);
        
        // 构建优化后的查询
        const optimized = {
            original: query,
            keywords: keywords.map(k => k.word),
            expanded: this.expandQuery(keywords),
            priority: this.determinePriority(query)
        };
        
        return optimized;
    },
    
    // 扩展查询（同义词、相关词）
    expandQuery(keywords) {
        const expansions = {
            '持仓': ['portfolio', 'position', '股票', '基金', '投资'],
            '收益': ['return', 'profit', '盈亏', '赚钱', '亏损'],
            '任务': ['task', 'todo', '工作', '进化', '开发'],
            '数据': ['data', '信息', '行情', '价格'],
            '同步': ['sync', '更新', '推送', '上传'],
            '错误': ['error', 'bug', '问题', '失败'],
            '权限': ['permission', '授权', 'access', 'bitable'],
            '飞书': ['feishu', 'lark', '消息', '推送']
        };
        
        const expanded = new Set(keywords.map(k => k.word));
        
        keywords.forEach(k => {
            const word = k.word;
            if (expansions[word]) {
                expansions[word].forEach(syn => expanded.add(syn));
            }
            // 反向查找
            Object.entries(expansions).forEach(([key, syns]) => {
                if (syns.includes(word)) {
                    expanded.add(key);
                }
            });
        });
        
        return Array.from(expanded);
    },
    
    // 确定查询优先级
    determinePriority(query) {
        const highPriority = ['错误', '失败', '问题', 'bug', '修复', '紧急'];
        const mediumPriority = ['任务', '完成', '提交', '更新', '同步'];
        
        if (highPriority.some(w => query.includes(w))) return 'high';
        if (mediumPriority.some(w => query.includes(w))) return 'medium';
        return 'low';
    },
    
    // 构建memory_search的优化参数
    buildSearchParams(query, options = {}) {
        const optimized = this.optimizeSearchQuery(query);
        
        return {
            query: optimized.expanded.join(' '),
            maxResults: options.maxResults || 5,
            minScore: options.minScore || 0.6,
            priority: optimized.priority,
            keywords: optimized.keywords,
            context: options.context || null
        };
    },
    
    // 压缩文件内容（用于大文件）
    compressFileContent(content, maxTokens = 3000) {
        const estimatedTokens = content.length / 2; // 粗略估计
        
        if (estimatedTokens <= maxTokens) {
            return { content, compressed: false };
        }
        
        // 需要压缩
        const summary = this.generateSummary(content, maxTokens);
        
        return {
            content: summary.summary,
            keywords: summary.keywords,
            originalLength: content.length,
            compressedLength: summary.summary.length,
            compressionRatio: summary.compressionRatio,
            compressed: true
        };
    },
    
    // 生成记忆标签
    generateTags(text) {
        const keywords = this.extractKeywords(text, 8);
        
        // 识别特定标签
        const tagPatterns = {
            '持仓': /持仓|股票|基金|portfolio|position/,
            '收益': /收益|盈亏|return|profit|pnl/,
            '任务': /任务|task|todo|进化|开发|完成/,
            '错误': /错误|失败|error|bug|修复/,
            '数据': /数据|同步|更新|data|sync/,
            '系统': /系统|定时|cron|看门狗|watchdog/,
            '飞书': /飞书|feishu|lark|消息|推送/,
            'GitHub': /github|git|提交|commit|推送/
        };
        
        const tags = [];
        Object.entries(tagPatterns).forEach(([tag, pattern]) => {
            if (pattern.test(text)) {
                tags.push(tag);
            }
        });
        
        return {
            systemTags: tags,
            keywords: keywords.map(k => k.word),
            allTags: [...tags, ...keywords.map(k => k.word)]
        };
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = memoryCompressor;
}
