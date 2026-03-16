#!/usr/bin/env python3
"""
Portfolio Pro 自动数据同步系统
数据源：腾讯财经（股票实时）+ 天天基金（基金净值）
更新策略：收盘后自动更新，支持QDII延迟更新
"""

import json
import os
import sys
import re
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import urllib.request
import urllib.error

# 持仓配置文件路径
HOLDINGS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'holdings.json')

# 数据源配置
DATA_SOURCES = {
    'tencent': {
        'name': '腾讯财经',
        'url': 'http://qt.gtimg.cn/q={codes}',
        'reliability': 0.95,
        'update_freq': 'realtime'  # 交易时间实时更新
    },
    'sina': {
        'name': '新浪财经', 
        'url': 'http://hq.sinajs.cn/list={codes}',
        'reliability': 0.90,
        'update_freq': 'realtime'
    },
    'eastmoney_fund': {
        'name': '天天基金',
        'url': 'http://fundgz.1234567.com.cn/js/{code}.js',
        'reliability': 0.88,
        'update_freq': 'daily'  # 每日净值更新
    }
}


class PortfolioSync:
    """持仓数据同步管理器"""
    
    def __init__(self):
        self.holdings = self._load_holdings()
        self.updated_stocks = []
        self.updated_funds = []
        self.errors = []
        
    def _load_holdings(self) -> Dict:
        """加载持仓数据"""
        try:
            with open(HOLDINGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ 加载持仓数据失败: {e}")
            return {}
    
    def _save_holdings(self) -> bool:
        """保存持仓数据"""
        try:
            # 更新时间戳
            self.holdings['lastUpdate'] = datetime.now().isoformat()
            self.holdings['version'] = datetime.now().strftime('%Y-%m-%d')
            
            with open(HOLDINGS_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.holdings, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"❌ 保存持仓数据失败: {e}")
            self.errors.append(f"保存失败: {e}")
            return False
    
    def _format_stock_code(self, code: str, market: str = 'A股') -> str:
        """格式化股票代码为腾讯API格式"""
        # 判断是上证还是深证
        if code.startswith('6') or code.startswith('5'):
            return f"sh{code}"  # 上海
        else:
            return f"sz{code}"  # 深圳
    
    def fetch_stock_prices_tencent(self, stocks: List[Dict]) -> Dict[str, float]:
        """
        从腾讯财经获取股票实时价格
        返回: {code: price}
        """
        if not stocks:
            return {}
        
        # 格式化股票代码
        codes = ','.join([self._format_stock_code(s['code']) for s in stocks])
        url = DATA_SOURCES['tencent']['url'].format(codes=codes)
        
        prices = {}
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'http://finance.qq.com'
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                data = response.read().decode('gbk')
                
                # 解析腾讯财经返回的数据格式
                # 格式: v_sh601006="1~名称~代码~当前价~..."
                pattern = r'v_[sh|sz]+(\d+)="([^"]+)"'
                matches = re.findall(pattern, data)
                
                for code, info in matches:
                    fields = info.split('~')
                    if len(fields) >= 3:
                        try:
                            price = float(fields[3])  # 当前价在第四个字段
                            prices[code] = price
                        except (ValueError, IndexError):
                            continue
                            
            print(f"✅ 腾讯财经: 获取 {len(prices)}/{len(stocks)} 只股票价格")
            
        except Exception as e:
            print(f"⚠️ 腾讯财经获取失败: {e}")
            self.errors.append(f"腾讯财经: {e}")
        
        return prices
    
    def fetch_fund_nav_eastmoney(self, funds: List[Dict]) -> Dict[str, Tuple[float, float]]:
        """
        从天天基金获取基金净值
        返回: {code: (nav, daily_growth)}
        """
        if not funds:
            return {}
        
        nav_data = {}
        
        for fund in funds:
            code = fund['code']
            # 跳过非基金代码（如余额宝）
            if not code.isdigit():
                continue
                
            url = DATA_SOURCES['eastmoney_fund']['url'].format(code=code)
            
            try:
                req = urllib.request.Request(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'http://fund.eastmoney.com'
                })
                with urllib.request.urlopen(req, timeout=5) as response:
                    data = response.read().decode('utf-8')
                    
                    # 解析JSONP格式: jsonpgz({"fundcode":"003984","name":"...","nav":"4.609","..."});
                    match = re.search(r'jsonpgz\((\{[^\}]+\})\)', data)
                    if match:
                        json_str = match.group(1)
                        fund_info = json.loads(json_str)
                        
                        nav = float(fund_info.get('nav', 0))
                        daily_growth = float(fund_info.get('gszzl', 0))  # 估算日涨幅
                        
                        if nav > 0:
                            nav_data[code] = (nav, daily_growth)
                            
            except Exception as e:
                print(f"⚠️ 基金 {code} 获取失败: {e}")
                continue
        
        print(f"✅ 天天基金: 获取 {len(nav_data)}/{len(funds)} 只基金净值")
        return nav_data
    
    def update_stocks(self) -> bool:
        """更新股票数据"""
        account = self.holdings.get('accounts', [{}])[0]
        stocks = account.get('stocks', [])
        
        if not stocks:
            print("ℹ️ 没有股票持仓")
            return True
        
        # 获取实时价格
        prices = self.fetch_stock_prices_tencent(stocks)
        
        if not prices:
            print("⚠️ 未能获取任何股票价格")
            return False
        
        # 更新每只股票
        total_stock_value = 0
        total_stock_daily_pnl = 0
        
        for stock in stocks:
            code = stock['code']
            if code in prices:
                old_price = stock.get('price', 0)
                new_price = prices[code]
                shares = stock.get('shares', 0)
                cost = stock.get('cost', 0)
                
                # 更新价格
                stock['price'] = new_price
                stock['marketValue'] = round(new_price * shares, 2)
                stock['totalPnL'] = round((new_price - cost) * shares, 2)
                stock['returnRate'] = round((new_price - cost) / cost * 100, 2) if cost > 0 else 0
                
                # 计算今日盈亏 (假设成本价为昨日收盘价)
                daily_change = new_price - old_price if old_price > 0 else 0
                stock['dailyPnL'] = round(daily_change * shares, 2)
                
                total_stock_value += stock['marketValue']
                total_stock_daily_pnl += stock['dailyPnL']
                
                self.updated_stocks.append({
                    'name': stock['name'],
                    'code': code,
                    'old_price': old_price,
                    'new_price': new_price,
                    'change_pct': round((new_price - old_price) / old_price * 100, 2) if old_price > 0 else 0
                })
        
        # 重新计算权重
        for stock in stocks:
            stock['weight'] = round(stock['marketValue'] / total_stock_value * 100, 2) if total_stock_value > 0 else 0
        
        # 更新汇总
        self.holdings['summary']['stockValue'] = round(total_stock_value, 2)
        self.holdings['summary']['stockDailyPnL'] = round(total_stock_daily_pnl, 2)
        
        print(f"✅ 已更新 {len(self.updated_stocks)} 只股票")
        return True
    
    def update_funds(self) -> bool:
        """更新基金数据"""
        account = self.holdings.get('accounts', [{}])[0]
        funds = account.get('funds', [])
        
        if not funds:
            print("ℹ️ 没有基金持仓")
            return True
        
        # 获取基金净值
        nav_data = self.fetch_fund_nav_eastmoney(funds)
        
        if not nav_data:
            print("⚠️ 未能获取任何基金净值")
            return False
        
        # 更新每只基金
        total_fund_value = 0
        total_fund_daily_pnl = 0
        
        for fund in funds:
            code = fund['code']
            if code in nav_data:
                old_nav = fund.get('nav', 0)
                new_nav, daily_growth = nav_data[code]
                shares = fund.get('shares', 1)  # 基金份额
                
                # 计算成本价（如果历史成本未知，用当前净值估算）
                cost_basis = fund.get('costBasis', new_nav * shares - fund.get('totalPnL', 0))
                
                # 更新净值
                fund['nav'] = new_nav
                fund['marketValue'] = round(new_nav * shares, 2)
                fund['totalPnL'] = round((new_nav * shares) - cost_basis, 2)
                fund['returnRate'] = round(fund['totalPnL'] / cost_basis * 100, 2) if cost_basis > 0 else 0
                
                # 计算今日盈亏
                fund['dailyPnL'] = round(fund['marketValue'] * daily_growth / 100, 2)
                fund['dailyGrowth'] = daily_growth
                
                total_fund_value += fund['marketValue']
                total_fund_daily_pnl += fund['dailyPnL']
                
                self.updated_funds.append({
                    'name': fund['name'],
                    'code': code,
                    'old_nav': old_nav,
                    'new_nav': new_nav,
                    'daily_growth': daily_growth
                })
        
        # 重新计算权重
        for fund in funds:
            fund['weight'] = round(fund['marketValue'] / total_fund_value * 100, 2) if total_fund_value > 0 else 0
        
        # 更新汇总
        self.holdings['summary']['fundValue'] = round(total_fund_value, 2)
        self.holdings['summary']['fundDailyPnL'] = round(total_fund_daily_pnl, 2)
        
        print(f"✅ 已更新 {len(self.updated_funds)} 只基金")
        return True
    
    def update_summary(self):
        """更新总汇总数据"""
        summary = self.holdings['summary']
        
        # 计算总资产
        summary['totalAssets'] = round(summary.get('stockValue', 0) + summary.get('fundValue', 0), 2)
        
        # 计算总今日盈亏
        summary['dailyPnL'] = round(summary.get('stockDailyPnL', 0) + summary.get('fundDailyPnL', 0), 2)
        
        # 计算总收益率（需要历史成本数据，这里简化为当前盈亏比例）
        # 实际应该从第一笔交易开始累计
        summary['returnRate'] = round(summary.get('totalPnL', 0) / (summary['totalAssets'] - summary.get('totalPnL', 0)) * 100, 2) if summary['totalAssets'] > summary.get('totalPnL', 0) else 0
    
    def add_history_record(self):
        """添加历史记录"""
        summary = self.holdings['summary']
        today = datetime.now().strftime('%Y-%m-%d')
        
        history = self.holdings.get('history', [])
        
        # 检查今天是否已有记录
        if history and history[-1].get('date') == today:
            # 更新今天的记录
            history[-1] = {
                'date': today,
                'totalAssets': summary['totalAssets'],
                'dailyPnL': summary['dailyPnL'],
                'fundValue': summary.get('fundValue', 0),
                'stockValue': summary.get('stockValue', 0)
            }
        else:
            # 添加新记录
            history.append({
                'date': today,
                'totalAssets': summary['totalAssets'],
                'dailyPnL': summary['dailyPnL'],
                'fundValue': summary.get('fundValue', 0),
                'stockValue': summary.get('stockValue', 0)
            })
        
        # 只保留最近90天记录
        self.holdings['history'] = history[-90:]
    
    def sync(self) -> Tuple[bool, str]:
        """
        执行完整同步
        返回: (是否成功, 报告文本)
        """
        print("=" * 50)
        print("📊 Portfolio Pro 自动数据同步")
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 50)
        
        if not self.holdings:
            return False, "❌ 无法加载持仓数据"
        
        # 1. 更新股票
        print("\n📈 正在更新股票数据...")
        stock_success = self.update_stocks()
        
        # 2. 更新基金
        print("\n📊 正在更新基金数据...")
        fund_success = self.update_funds()
        
        # 3. 更新汇总
        print("\n📝 正在更新汇总数据...")
        self.update_summary()
        
        # 4. 添加历史记录
        self.add_history_record()
        
        # 5. 保存数据
        print("\n💾 正在保存数据...")
        save_success = self._save_holdings()
        
        # 6. 生成报告
        report = self._generate_report()
        
        # 7. 推送到GitHub
        if save_success:
            print("\n🚀 正在推送到GitHub...")
            self._push_to_github()
        
        success = stock_success or fund_success  # 至少一个成功就算成功
        return success, report
    
    def _generate_report(self) -> str:
        """生成同步报告"""
        summary = self.holdings.get('summary', {})
        
        report = f"""
📊 **持仓数据同步报告** | {datetime.now().strftime('%Y-%m-%d %H:%M')}

**总资产**: ¥{summary.get('totalAssets', 0):,.2f}
**今日盈亏**: {'🟢' if summary.get('dailyPnL', 0) >= 0 else '🔴'} ¥{summary.get('dailyPnL', 0):,.2f}
**累计收益**: ¥{summary.get('totalPnL', 0):,.2f}

**更新明细**:
- 股票: {len(self.updated_stocks)} 只已更新
- 基金: {len(self.updated_funds)} 只已更新

**重点变动**:
"""
        # 显示涨跌幅最大的3只股票
        if self.updated_stocks:
            sorted_stocks = sorted(self.updated_stocks, key=lambda x: abs(x['change_pct']), reverse=True)[:3]
            for stock in sorted_stocks:
                emoji = '📈' if stock['change_pct'] >= 0 else '📉'
                report += f"\n{emoji} {stock['name']}: {stock['change_pct']:+.2f}%"
        
        if self.errors:
            report += f"\n\n⚠️ **警告**: {len(self.errors)} 个错误"
            for err in self.errors[:3]:
                report += f"\n- {err}"
        
        return report
    
    def _push_to_github(self) -> bool:
        """推送到GitHub"""
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            os.chdir(script_dir)
            
            # 配置git
            subprocess.run(['git', 'config', 'user.email', 'auto-sync@portfolio-pro.com'], 
                         capture_output=True, check=False)
            subprocess.run(['git', 'config', 'user.name', 'Portfolio Auto Sync'], 
                         capture_output=True, check=False)
            
            # 添加、提交、推送
            subprocess.run(['git', 'add', 'data/holdings.json'], 
                         capture_output=True, check=False)
            
            date_str = datetime.now().strftime('%Y-%m-%d %H:%M')
            result = subprocess.run(
                ['git', 'commit', '-m', f'auto: 更新持仓数据 {date_str}'],
                capture_output=True, text=True
            )
            
            if result.returncode == 0 or 'nothing to commit' in result.stdout:
                push_result = subprocess.run(['git', 'push', 'origin', 'main'], 
                                           capture_output=True, text=True, timeout=60)
                if push_result.returncode == 0:
                    print("✅ 已成功推送到GitHub")
                    return True
                else:
                    print(f"⚠️ GitHub推送失败: {push_result.stderr}")
                    return False
            
            return True
            
        except Exception as e:
            print(f"⚠️ GitHub推送异常: {e}")
            return False


def main():
    """主函数"""
    sync = PortfolioSync()
    success, report = sync.sync()
    
    print("\n" + "=" * 50)
    print(report)
    print("=" * 50)
    
    # 输出到文件供飞书推送使用
    report_file = os.path.join(os.path.dirname(__file__), 'sync_report.txt')
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
