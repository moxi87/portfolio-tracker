/**
 * 行情数据抓取模块
 * 支持：股票(新浪财经)、基金(天天基金)
 */

const DataFetcher = {
    /**
     * 获取股票实时行情
     * @param {string} code - 股票代码 (如: sh600519, sz000001)
     */
    async fetchStockQuote(code) {
        try {
            const response = await fetch(`https://hq.sinajs.cn/list=${code}`, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn'
                }
            });
            const text = await response.text();
            return this.parseSinaStockData(code, text);
        } catch (error) {
            console.error(`获取股票 ${code} 失败:`, error);
            return null;
        }
    },

    /**
     * 解析新浪股票数据
     */
    parseSinaStockData(code, text) {
        const match = text.match(/var hq_str_[^=]+="([^"]+)"/);
        if (!match || !match[1]) return null;
        
        const parts = match[1].split(',');
        if (parts.length < 33) return null;

        const isSh = code.startsWith('sh');
        return {
            code: code,
            name: parts[0],
            price: parseFloat(parts[3]),           // 当前价
            open: parseFloat(parts[1]),            // 开盘价
            high: parseFloat(parts[4]),            // 最高价
            low: parseFloat(parts[5]),             // 最低价
            prevClose: parseFloat(parts[2]),       // 昨收
            volume: parseInt(parts[8]),            // 成交量
            amount: parseFloat(parts[9]),          // 成交额
            change: parseFloat(parts[3]) - parseFloat(parts[2]),
            changePercent: ((parseFloat(parts[3]) - parseFloat(parts[2])) / parseFloat(parts[2]) * 100).toFixed(2),
            updateTime: `${parts[30]} ${parts[31]}`,
            market: isSh ? 'SH' : 'SZ'
        };
    },

    /**
     * 获取基金实时净值
     * @param {string} code - 基金代码 (如: 000001)
     */
    async fetchFundNav(code) {
        try {
            const timestamp = Date.now();
            const response = await fetch(`https://fundgz.1234567.com.cn/js/${code}.js?rt=${timestamp}`);
            const text = await response.text();
            return this.parseFundData(code, text);
        } catch (error) {
            console.error(`获取基金 ${code} 失败:`, error);
            return null;
        }
    },

    /**
     * 解析基金数据
     */
    parseFundData(code, text) {
        const match = text.match(/jsonpgz\(([^)]+)\)/);
        if (!match) return null;
        
        try {
            const data = JSON.parse(match[1]);
            const nav = parseFloat(data.dwjz);      // 单位净值
            const accNav = parseFloat(data.gsz);     // 估算净值
            const prevNav = parseFloat(data.dwjz);   // 昨日净值
            
            return {
                code: code,
                name: data.name,
                nav: nav,                            // 单位净值
                accNav: accNav,                      // 累计净值/估算
                estimateNav: accNav,                 // 盘中估算
                change: accNav - nav,
                changePercent: data.gszzl,           // 估算涨跌幅
                date: data.jzrq,                     // 净值日期
                estimateTime: data.gztime,           // 估算时间
                isEstimating: accNav !== nav         // 是否盘中估算
            };
        } catch (e) {
            console.error('解析基金数据失败:', e);
            return null;
        }
    },

    /**
     * 批量获取持仓数据
     * @param {Array} holdings - 持仓列表 [{code, type, shares}]
     */
    async fetchPortfolio(holdings) {
        const results = {
            stocks: [],
            funds: [],
            errors: [],
            totalValue: 0,
            totalCost: 0,
            totalChange: 0
        };

        for (const item of holdings) {
            if (item.type === 'stock') {
                const quote = await this.fetchStockQuote(item.code);
                if (quote) {
                    const value = quote.price * item.shares;
                    const cost = item.cost * item.shares;
                    results.stocks.push({
                        ...item,
                        ...quote,
                        value: value,
                        profit: value - cost,
                        profitPercent: ((value - cost) / cost * 100).toFixed(2)
                    });
                    results.totalValue += value;
                    results.totalCost += cost;
                } else {
                    results.errors.push({ code: item.code, name: item.name, reason: '获取失败' });
                }
            } else if (item.type === 'fund') {
                const nav = await this.fetchFundNav(item.code);
                if (nav) {
                    const value = nav.estimateNav * item.shares;
                    const cost = item.cost * item.shares;
                    results.funds.push({
                        ...item,
                        ...nav,
                        value: value,
                        profit: value - cost,
                        profitPercent: ((value - cost) / cost * 100).toFixed(2)
                    });
                    results.totalValue += value;
                    results.totalCost += cost;
                } else {
                    results.errors.push({ code: item.code, name: item.name, reason: '获取失败' });
                }
            }
            
            // 避免请求过快
            await new Promise(r => setTimeout(r, 100));
        }

        results.totalChange = results.totalValue - results.totalCost;
        results.totalChangePercent = results.totalCost > 0 
            ? (results.totalChange / results.totalCost * 100).toFixed(2) 
            : 0;

        return results;
    },

    /**
     * 检查是否在交易时间
     */
    isMarketOpen() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const time = hours * 100 + minutes;
        
        // 周一至周五
        if (now.getDay() === 0 || now.getDay() === 6) {
            return false;
        }
        
        // 上午 9:30-11:30, 下午 13:00-15:00
        return (time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500);
    },

    /**
     * 获取市场状态描述
     */
    getMarketStatus() {
        if (this.isMarketOpen()) {
            return { open: true, text: '交易中' };
        }
        
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const time = hours * 100 + minutes;
        
        if (time < 930) return { open: false, text: '开盘前' };
        if (time < 1300) return { open: false, text: '午间休市' };
        if (time >= 1500) return { open: false, text: '已收盘' };
        return { open: false, text: '休市' };
    }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataFetcher;
}
