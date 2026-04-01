/**
 * Portfolio Pro - 数据导出模块
 * 纯前端实现，支持 JSON/CSV/Excel 格式导出
 */

const portfolioExporter = {
    // 缓存数据
    holdingsData: null,
    historyData: null,

    /**
     * 加载数据文件
     */
    async loadData() {
        try {
            // 加载 holdings.json
            const holdingsRes = await fetch('data/holdings.json?t=' + Date.now());
            this.holdingsData = await holdingsRes.json();
            
            // 加载 history.json
            const historyRes = await fetch('data/history.json?t=' + Date.now());
            this.historyData = await historyRes.json();
            
            return { holdings: this.holdingsData, history: this.historyData };
        } catch (error) {
            console.error('[Export] 加载数据失败:', error);
            showToast('数据加载失败，请稍后重试', 'error');
            throw error;
        }
    },

    /**
     * 获取当前日期字符串 (YYYYMMDD)
     */
    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    },

    /**
     * 触发文件下载
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * 导出为 JSON 格式
     */
    async exportJSON() {
        try {
            showToast('正在导出 JSON...', 'info');
            await this.loadData();
            
            const exportData = {
                exportTime: new Date().toISOString(),
                version: this.holdingsData.version || 'unknown',
                holdings: this.holdingsData,
                history: this.historyData
            };
            
            const content = JSON.stringify(exportData, null, 2);
            const filename = `portfolio_export_${this.getDateString()}.json`;
            this.downloadFile(content, filename, 'application/json');
            
            showToast('JSON 导出成功！', 'success');
        } catch (error) {
            console.error('[Export] JSON导出失败:', error);
            showToast('导出失败，请检查控制台', 'error');
        }
    },

    /**
     * 导出为 CSV 格式
     */
    async exportCSV() {
        try {
            showToast('正在导出 CSV...', 'info');
            await this.loadData();
            
            let csvContent = '\uFEFF'; // UTF-8 BOM
            
            // 1. 汇总信息
            const summary = this.holdingsData.summary || {};
            csvContent += '# 投资组合汇总\n';
            csvContent += '指标,数值\n';
            csvContent += `总资产,${summary.totalAssets || 0}\n`;
            csvContent += `基金市值,${summary.fundValue || 0}\n`;
            csvContent += `股票市值,${summary.stockValue || 0}\n`;
            csvContent += `今日盈亏,${summary.dailyPnL || 0}\n`;
            csvContent += `累计盈亏,${summary.totalPnL || 0}\n`;
            csvContent += `收益率,${summary.returnRate || 0}%\n`;
            csvContent += `最后更新,${summary.lastUpdate || ''}\n`;
            csvContent += '\n';
            
            // 2. 股票持仓
            const stocks = this.holdingsData.accounts?.[0]?.stocks || [];
            csvContent += '# 股票持仓\n';
            csvContent += '代码,名称,持股数,成本价,现价,市值,今日盈亏,累计盈亏,收益率,权重,市场\n';
            stocks.forEach(stock => {
                csvContent += `${stock.code},${stock.name},${stock.shares},${stock.cost},${stock.price},${stock.marketValue},${stock.dailyPnL},${stock.totalPnL},${stock.returnRate}%,${stock.weight}%,${stock.market}\n`;
            });
            csvContent += '\n';
            
            // 3. 基金持仓
            const funds = this.holdingsData.accounts?.[0]?.funds || [];
            csvContent += '# 基金持仓\n';
            csvContent += '代码,名称,份额,净值,市值,今日盈亏,累计盈亏,收益率,权重,市场\n';
            funds.forEach(fund => {
                csvContent += `${fund.code},${fund.name},${fund.shares},${fund.nav},${fund.marketValue},${fund.dailyPnL},${fund.totalPnL},${fund.returnRate}%,${fund.weight}%,${fund.market}\n`;
            });
            csvContent += '\n';
            
            // 4. 历史收益
            const history = this.historyData.records || [];
            csvContent += '# 历史收益\n';
            csvContent += '日期,总资产,今日盈亏\n';
            history.forEach(record => {
                csvContent += `${record.date},${record.totalAssets},${record.dailyPnL}\n`;
            });
            
            const filename = `portfolio_export_${this.getDateString()}.csv`;
            this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
            
            showToast('CSV 导出成功！', 'success');
        } catch (error) {
            console.error('[Export] CSV导出失败:', error);
            showToast('导出失败，请检查控制台', 'error');
        }
    },

    /**
     * 导出为 Excel 格式 (使用 SheetJS)
     */
    async exportExcel() {
        try {
            showToast('正在导出 Excel...', 'info');
            await this.loadData();
            
            // 检查 SheetJS 是否加载
            if (typeof XLSX === 'undefined') {
                showToast('Excel 库加载中，请稍后重试', 'warning');
                // 等待库加载
                let attempts = 0;
                while (typeof XLSX === 'undefined' && attempts < 50) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }
                if (typeof XLSX === 'undefined') {
                    throw new Error('SheetJS 库未加载');
                }
            }
            
            const wb = XLSX.utils.book_new();
            
            // 1. 汇总表
            const summary = this.holdingsData.summary || {};
            const summaryData = [
                ['指标', '数值'],
                ['总资产', summary.totalAssets || 0],
                ['基金市值', summary.fundValue || 0],
                ['股票市值', summary.stockValue || 0],
                ['今日盈亏', summary.dailyPnL || 0],
                ['累计盈亏', summary.totalPnL || 0],
                ['收益率', (summary.returnRate || 0) + '%'],
                ['最后更新', summary.lastUpdate || '']
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, '汇总');
            
            // 2. 股票持仓表
            const stocks = this.holdingsData.accounts?.[0]?.stocks || [];
            const stockHeaders = ['代码', '名称', '持股数', '成本价', '现价', '市值', '今日盈亏', '累计盈亏', '收益率(%)', '权重(%)', '市场'];
            const stockData = [stockHeaders];
            stocks.forEach(stock => {
                stockData.push([
                    stock.code,
                    stock.name,
                    stock.shares,
                    stock.cost,
                    stock.price,
                    stock.marketValue,
                    stock.dailyPnL,
                    stock.totalPnL,
                    stock.returnRate,
                    stock.weight,
                    stock.market
                ]);
            });
            const wsStocks = XLSX.utils.aoa_to_sheet(stockData);
            XLSX.utils.book_append_sheet(wb, wsStocks, '股票持仓');
            
            // 3. 基金持仓表
            const funds = this.holdingsData.accounts?.[0]?.funds || [];
            const fundHeaders = ['代码', '名称', '份额', '净值', '市值', '今日盈亏', '累计盈亏', '收益率(%)', '权重(%)', '市场'];
            const fundData = [fundHeaders];
            funds.forEach(fund => {
                fundData.push([
                    fund.code,
                    fund.name,
                    fund.shares,
                    fund.nav,
                    fund.marketValue,
                    fund.dailyPnL,
                    fund.totalPnL,
                    fund.returnRate,
                    fund.weight,
                    fund.market
                ]);
            });
            const wsFunds = XLSX.utils.aoa_to_sheet(fundData);
            XLSX.utils.book_append_sheet(wb, wsFunds, '基金持仓');
            
            // 4. 历史收益表
            const history = this.historyData.records || [];
            const historyHeaders = ['日期', '总资产', '今日盈亏'];
            const historyData = [historyHeaders];
            history.forEach(record => {
                historyData.push([record.date, record.totalAssets, record.dailyPnL]);
            });
            const wsHistory = XLSX.utils.aoa_to_sheet(historyData);
            XLSX.utils.book_append_sheet(wb, wsHistory, '历史收益');
            
            // 5. 导出信息表
            const exportInfoData = [
                ['Portfolio Pro 数据导出'],
                ['导出时间', new Date().toLocaleString('zh-CN')],
                ['数据版本', this.holdingsData.version || 'unknown'],
                [''],
                ['工作表说明'],
                ['汇总', '投资组合整体情况'],
                ['股票持仓', '股票明细数据'],
                ['基金持仓', '基金明细数据'],
                ['历史收益', '历史收益走势']
            ];
            const wsInfo = XLSX.utils.aoa_to_sheet(exportInfoData);
            XLSX.utils.book_append_sheet(wb, wsInfo, '导出信息');
            
            // 生成文件名并下载
            const filename = `portfolio_export_${this.getDateString()}.xlsx`;
            XLSX.writeFile(wb, filename);
            
            showToast('Excel 导出成功！', 'success');
        } catch (error) {
            console.error('[Export] Excel导出失败:', error);
            showToast('导出失败: ' + error.message, 'error');
        }
    }
};

// 全局导出，方便在控制台测试
window.portfolioExporter = portfolioExporter;
