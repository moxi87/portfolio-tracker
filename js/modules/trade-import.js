// 交易记录批量导入模块 - P008
const tradeImport = {
    // 支持的导入格式
    supportedFormats: ['xlsx', 'csv', 'json'],
    
    // 字段映射模板（支持多种格式）
    fieldMappings: {
        // 标准格式
        standard: {
            date: ['日期', '成交日期', 'time', 'date', '成交时间'],
            code: ['代码', '股票代码', '基金代码', 'code', 'symbol'],
            name: ['名称', '股票名称', '基金名称', 'name'],
            type: ['类型', '操作', '买卖', 'type', 'action'],
            price: ['价格', '成交价', 'price', '成交价格'],
            shares: ['数量', '成交量', 'shares', 'volume', '成交数量'],
            amount: ['金额', '成交额', 'amount', '成交金额'],
            fee: ['手续费', '佣金', 'fee', 'commission'],
            account: ['账户', '账号', 'account']
        }
    },
    
    // 解析CSV
    parseCSV(content) {
        const lines = content.trim().split('\n');
        const headers = this.parseCSVLine(lines[0]);
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index]?.trim();
                });
                data.push(row);
            }
        }
        
        return { headers, data };
    },
    
    // 解析CSV单行（处理引号）
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    },
    
    // 自动识别字段映射
    autoMapFields(headers) {
        const mapping = {};
        const standardMap = this.fieldMappings.standard;
        
        headers.forEach(header => {
            const lowerHeader = header.toLowerCase().trim();
            for (const [field, aliases] of Object.entries(standardMap)) {
                if (aliases.some(alias => 
                    lowerHeader.includes(alias.toLowerCase()) ||
                    alias.toLowerCase().includes(lowerHeader)
                )) {
                    mapping[header] = field;
                    break;
                }
            }
        });
        
        return mapping;
    },
    
    // 标准化交易记录
    normalizeRecord(rawRecord, fieldMapping) {
        const record = {};
        
        // 映射字段
        for (const [rawField, value] of Object.entries(rawRecord)) {
            const standardField = fieldMapping[rawField];
            if (standardField) {
                record[standardField] = value;
            }
        }
        
        // 解析日期
        if (record.date) {
            record.date = this.parseDate(record.date);
        }
        
        // 解析代码（统一格式）
        if (record.code) {
            record.code = this.normalizeCode(record.code);
        }
        
        // 解析类型（买入/卖出）
        if (record.type) {
            record.type = this.normalizeType(record.type);
        }
        
        // 解析数字
        ['price', 'shares', 'amount', 'fee'].forEach(field => {
            if (record[field]) {
                record[field] = this.parseNumber(record[field]);
            }
        });
        
        // 计算缺失值
        if (!record.amount && record.price && record.shares) {
            record.amount = record.price * record.shares;
        }
        if (!record.shares && record.amount && record.price && record.price > 0) {
            record.shares = record.amount / record.price;
        }
        
        return record;
    },
    
    // 解析日期
    parseDate(dateStr) {
        // 尝试多种格式
        const formats = [
            /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,  // 2024-03-19 或 2024/03/19
            /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,  // 19-03-2024
            /(\d{8})/                              // 20240319
        ];
        
        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                if (match[0].length === 8) {
                    return `${match[0].slice(0,4)}-${match[0].slice(4,6)}-${match[0].slice(6,8)}`;
                }
                if (match[1].length === 4) {
                    return `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
                } else {
                    return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
                }
            }
        }
        
        return dateStr;
    },
    
    // 标准化代码
    normalizeCode(code) {
        // 移除空格和字母前缀
        code = code.replace(/\s/g, '').replace(/^[a-zA-Z]+/, '');
        
        // 补齐6位
        code = code.padStart(6, '0');
        
        return code;
    },
    
    // 标准化类型
    normalizeType(type) {
        const lower = type.toLowerCase();
        if (lower.includes('buy') || lower.includes('买') || lower.includes('入')) {
            return 'buy';
        }
        if (lower.includes('sell') || lower.includes('卖') || lower.includes('出')) {
            return 'sell';
        }
        return lower;
    },
    
    // 解析数字
    parseNumber(numStr) {
        if (typeof numStr === 'number') return numStr;
        
        // 移除千分位逗号和货币符号
        const cleaned = numStr.toString()
            .replace(/,/g, '')
            .replace(/[¥$￥]/g, '')
            .trim();
        
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    },
    
    // 验证记录
    validateRecord(record) {
        const errors = [];
        
        if (!record.date) errors.push('缺少日期');
        if (!record.code) errors.push('缺少代码');
        if (!record.name) errors.push('缺少名称');
        if (!record.type) errors.push('缺少类型');
        if (!record.price || record.price <= 0) errors.push('价格无效');
        if (!record.shares || record.shares <= 0) errors.push('数量无效');
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    // 处理导入
    async processImport(fileContent, fileType = 'csv') {
        let rawData;
        
        // 解析文件
        if (fileType === 'csv') {
            rawData = this.parseCSV(fileContent);
        } else if (fileType === 'json') {
            const parsed = JSON.parse(fileContent);
            rawData = {
                headers: Object.keys(parsed[0] || {}),
                data: parsed
            };
        } else {
            throw new Error(`不支持的文件类型: ${fileType}`);
        }
        
        // 自动字段映射
        const fieldMapping = this.autoMapFields(rawData.headers);
        
        // 检查未映射的字段
        const unmapped = rawData.headers.filter(h => !fieldMapping[h]);
        
        // 标准化记录
        const records = [];
        const errors = [];
        
        rawData.data.forEach((row, index) => {
            try {
                const record = this.normalizeRecord(row, fieldMapping);
                const validation = this.validateRecord(record);
                
                if (validation.valid) {
                    records.push(record);
                } else {
                    errors.push({
                        row: index + 2, // +2 because header is row 1
                        data: row,
                        errors: validation.errors
                    });
                }
            } catch (e) {
                errors.push({
                    row: index + 2,
                    data: row,
                    errors: [e.message]
                });
            }
        });
        
        return {
            success: true,
            total: rawData.data.length,
            imported: records.length,
            failed: errors.length,
            records: records,
            errors: errors,
            fieldMapping: fieldMapping,
            unmappedFields: unmapped
        };
    },
    
    // 合并到持仓数据
    mergeToPortfolio(records, portfolioData) {
        const account = portfolioData.accounts.default;
        if (!account.data.trades) {
            account.data.trades = [];
        }
        
        // 去重：基于日期+代码+类型
        const existingKeys = new Set(
            account.data.trades.map(t => `${t.date}_${t.code}_${t.type}`)
        );
        
        const newRecords = records.filter(r => {
            const key = `${r.date}_${r.code}_${r.type}`;
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
        });
        
        account.data.trades.push(...newRecords);
        
        // 更新持仓计算
        this.updatePositionsFromTrades(account.data);
        
        return {
            added: newRecords.length,
            duplicates: records.length - newRecords.length,
            totalTrades: account.data.trades.length
        };
    },
    
    // 从交易记录更新持仓
    updatePositionsFromTrades(data) {
        const positions = {};
        
        // 按时间排序交易
        const sortedTrades = [...(data.trades || [])].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );
        
        sortedTrades.forEach(trade => {
            if (!positions[trade.code]) {
                positions[trade.code] = {
                    code: trade.code,
                    name: trade.name,
                    shares: 0,
                    totalCost: 0
                };
            }
            
            const pos = positions[trade.code];
            
            if (trade.type === 'buy') {
                pos.shares += trade.shares;
                pos.totalCost += trade.amount + (trade.fee || 0);
            } else if (trade.type === 'sell') {
                // 先进先出计算成本
                const avgCost = pos.shares > 0 ? pos.totalCost / pos.shares : 0;
                pos.shares -= trade.shares;
                pos.totalCost -= trade.shares * avgCost;
            }
        });
        
        // 同步到持仓列表
        Object.values(positions).forEach(pos => {
            if (pos.shares > 0) {
                const cost = pos.totalCost / pos.shares;
                
                // 查找或创建持仓
                let stock = data.stocks?.find(s => s.code === pos.code);
                if (!stock) {
                    stock = {
                        code: pos.code,
                        name: pos.name,
                        shares: 0,
                        cost: 0
                    };
                    if (!data.stocks) data.stocks = [];
                    data.stocks.push(stock);
                }
                
                stock.shares = pos.shares;
                stock.cost = cost;
            }
        });
    },
    
    // 生成导入模板
    generateTemplate() {
        return `日期,代码,名称,类型,价格,数量,金额,手续费,账户
2024-03-19,000001,平安银行,买入,10.50,1000,10500,5,主账户
2024-03-19,000001,平安银行,卖出,11.20,500,5600,3,主账户
2024-03-20,600519,贵州茅台,买入,1680.00,100,168000,50,主账户`;
    },
    
    // 导出持仓为交易记录
    exportTrades(portfolioData) {
        const account = portfolioData.accounts.default;
        const trades = account.data.trades || [];
        
        const headers = ['日期', '代码', '名称', '类型', '价格', '数量', '金额', '手续费', '账户'];
        const rows = trades.map(t => [
            t.date,
            t.code,
            t.name,
            t.type === 'buy' ? '买入' : '卖出',
            t.price,
            t.shares,
            t.amount,
            t.fee || 0,
            t.account || '主账户'
        ]);
        
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
};
