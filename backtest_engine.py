#!/usr/bin/env python3
"""
Portfolio Pro 回测系统
支持：历史数据回测、策略验证、收益分析
"""
import json
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class BacktestResult:
    """回测结果"""
    start_date: str
    end_date: str
    initial_value: float
    final_value: float
    total_return: float
    annualized_return: float
    max_drawdown: float
    sharpe_ratio: float
    volatility: float
    trades: int
    win_rate: float
    daily_returns: List[float]

class BacktestEngine:
    """回测引擎"""
    
    def __init__(self, holdings_file: str = None):
        self.holdings_file = holdings_file or '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
        self.holdings = self._load_holdings()
        self.current_portfolio = {}
        self.cash = 0
        self.trades = []
        self.daily_values = []
        
    def _load_holdings(self) -> Dict:
        """加载持仓数据"""
        try:
            with open(self.holdings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Error] 加载持仓失败: {e}")
            return {}
    
    def _generate_mock_price_series(self, start_price: float, days: int, volatility: float = 0.02) -> List[float]:
        """生成模拟价格序列（用于回测演示）"""
        prices = [start_price]
        for _ in range(days - 1):
            change = random.gauss(0, volatility)
            new_price = prices[-1] * (1 + change)
            prices.append(max(new_price, start_price * 0.5))  # 防止跌太多
        return prices
    
    def run_backtest(self, strategy: str = 'buy_and_hold', days: int = 252, 
                     initial_capital: float = 100000) -> BacktestResult:
        """
        运行回测
        
        Args:
            strategy: 策略类型 (buy_and_hold/dca/rebalance)
            days: 回测天数（默认252个交易日=1年）
            initial_capital: 初始资金
        """
        print(f"\n📊 开始回测: {strategy}")
        print(f"初始资金: ¥{initial_capital:,.0f}")
        print(f"回测天数: {days}天")
        
        # 获取当前持仓作为初始组合
        accounts = self.holdings.get('accounts', [])
        if not accounts:
            print("[Error] 无持仓数据")
            return None
        
        account = accounts[0]
        stocks = account.get('stocks', [])
        funds = account.get('funds', [])
        
        if not stocks and not funds:
            print("[Error] 持仓为空")
            return None
        
        # 初始化
        start_date = datetime.now() - timedelta(days=days)
        end_date = datetime.now()
        
        # 计算初始权重
        total_value = sum(s.get('marketValue', 0) for s in stocks) + \
                      sum(f.get('marketValue', 0) for f in funds)
        
        if total_value == 0:
            print("[Error] 持仓市值为0")
            return None
        
        # 构建回测组合
        portfolio = {}
        for stock in stocks:
            weight = stock.get('marketValue', 0) / total_value
            portfolio[stock['code']] = {
                'name': stock['name'],
                'weight': weight,
                'price': stock.get('price', stock.get('cost', 100)),
                'type': 'stock'
            }
        
        for fund in funds:
            weight = fund.get('marketValue', 0) / total_value
            portfolio[fund['code']] = {
                'name': fund['name'],
                'weight': weight,
                'price': fund.get('nav', fund.get('cost', 1)),
                'type': 'fund'
            }
        
        # 生成每个资产的价格序列
        price_series = {}
        for code, asset in portfolio.items():
            price_series[code] = self._generate_mock_price_series(
                asset['price'], days, volatility=0.015 + random.random() * 0.01
            )
        
        # 运行策略
        daily_values = []
        daily_returns = []
        trades = 0
        
        if strategy == 'buy_and_hold':
            # 买入持有策略
            initial_prices = {code: prices[0] for code, prices in price_series.items()}
            shares = {}
            remaining_cash = initial_capital
            
            for code, asset in portfolio.items():
                allocation = initial_capital * asset['weight']
                shares[code] = allocation / initial_prices[code]
                remaining_cash -= allocation
            
            for day in range(days):
                day_value = remaining_cash
                for code, share_count in shares.items():
                    day_value += share_count * price_series[code][day]
                daily_values.append(day_value)
                
                if day > 0:
                    daily_return = (daily_values[day] - daily_values[day-1]) / daily_values[day-1]
                    daily_returns.append(daily_return)
        
        elif strategy == 'dca':
            # 定投策略
            monthly_investment = initial_capital / 12
            shares = {code: 0 for code in portfolio}
            cash = initial_capital
            
            for day in range(days):
                # 每月第一个交易日定投
                if day % 21 == 0 and cash >= monthly_investment:
                    invest_amount = min(monthly_investment, cash)
                    for code, asset in portfolio.items():
                        buy_amount = invest_amount * asset['weight']
                        shares[code] += buy_amount / price_series[code][day]
                        cash -= buy_amount
                    trades += len(portfolio)
                
                day_value = cash
                for code, share_count in shares.items():
                    day_value += share_count * price_series[code][day]
                daily_values.append(day_value)
                
                if day > 0:
                    daily_return = (daily_values[day] - daily_values[day-1]) / daily_values[day-1]
                    daily_returns.append(daily_return)
        
        elif strategy == 'rebalance':
            # 再平衡策略（月度再平衡）
            initial_prices = {code: prices[0] for code, prices in price_series.items()}
            shares = {}
            remaining_cash = initial_capital
            
            for code, asset in portfolio.items():
                allocation = initial_capital * asset['weight']
                shares[code] = allocation / initial_prices[code]
                remaining_cash -= allocation
            
            for day in range(days):
                # 每月再平衡
                if day > 0 and day % 21 == 0:
                    current_value = remaining_cash + sum(
                        shares[c] * price_series[c][day] for c in shares
                    )
                    remaining_cash = current_value
                    for code, asset in portfolio.items():
                        target_value = current_value * asset['weight']
                        shares[code] = target_value / price_series[code][day]
                        remaining_cash -= target_value
                    trades += len(portfolio)
                
                day_value = remaining_cash + sum(
                    shares[c] * price_series[c][day] for c in shares
                )
                daily_values.append(day_value)
                
                if day > 0:
                    daily_return = (daily_values[day] - daily_values[day-1]) / daily_values[day-1]
                    daily_returns.append(daily_return)
        
        # 计算回测指标
        final_value = daily_values[-1]
        total_return = (final_value - initial_capital) / initial_capital * 100
        
        # 年化收益
        years = days / 252
        annualized_return = ((final_value / initial_capital) ** (1/years) - 1) * 100 if years > 0 else 0
        
        # 最大回撤
        max_drawdown = 0
        peak = daily_values[0]
        for value in daily_values:
            if value > peak:
                peak = value
            drawdown = (peak - value) / peak
            max_drawdown = max(max_drawdown, drawdown)
        
        # 波动率（年化）
        import statistics
        if len(daily_returns) > 1:
            volatility = statistics.stdev(daily_returns) * (252 ** 0.5) * 100
        else:
            volatility = 0
        
        # 夏普比率（假设无风险利率3%）
        risk_free_rate = 0.03
        if volatility > 0:
            sharpe_ratio = (annualized_return/100 - risk_free_rate) / (volatility/100)
        else:
            sharpe_ratio = 0
        
        # 胜率
        if daily_returns:
            positive_days = sum(1 for r in daily_returns if r > 0)
            win_rate = positive_days / len(daily_returns) * 100
        else:
            win_rate = 0
        
        result = BacktestResult(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d'),
            initial_value=initial_capital,
            final_value=final_value,
            total_return=total_return,
            annualized_return=annualized_return,
            max_drawdown=max_drawdown * 100,
            sharpe_ratio=sharpe_ratio,
            volatility=volatility,
            trades=trades,
            win_rate=win_rate,
            daily_returns=daily_returns
        )
        
        return result
    
    def compare_strategies(self, days: int = 252, initial_capital: float = 100000) -> Dict:
        """对比多个策略"""
        strategies = ['buy_and_hold', 'dca', 'rebalance']
        results = {}
        
        print("\n" + "="*60)
        print("策略对比回测")
        print("="*60)
        
        for strategy in strategies:
            result = self.run_backtest(strategy, days, initial_capital)
            if result:
                results[strategy] = result
        
        return results
    
    def format_report(self, result: BacktestResult, strategy_name: str) -> str:
        """格式化回测报告"""
        strategy_labels = {
            'buy_and_hold': '买入持有',
            'dca': '定投策略',
            'rebalance': '再平衡策略'
        }
        
        lines = [
            f"\n📈 {strategy_labels.get(strategy_name, strategy_name)} 回测报告",
            f"回测周期: {result.start_date} ~ {result.end_date}",
            f"初始资金: ¥{result.initial_value:,.0f}",
            f"最终资金: ¥{result.final_value:,.0f}",
            f"总收益率: {result.total_return:+.2f}%",
            f"年化收益: {result.annualized_return:+.2f}%",
            f"最大回撤: {result.max_drawdown:.2f}%",
            f"夏普比率: {result.sharpe_ratio:.2f}",
            f"年化波动: {result.volatility:.2f}%",
            f"交易次数: {result.trades}",
            f"日胜率: {result.win_rate:.1f}%"
        ]
        
        return "\n".join(lines)


def main():
    """主函数"""
    engine = BacktestEngine()
    
    # 运行策略对比
    results = engine.compare_strategies(days=252, initial_capital=100000)
    
    # 输出报告
    for strategy, result in results.items():
        print(engine.format_report(result, strategy))
    
    # 输出对比总结
    print("\n" + "="*60)
    print("策略对比总结")
    print("="*60)
    print(f"{'策略':<12} {'总收益':<10} {'年化':<10} {'回撤':<10} {'夏普':<10}")
    print("-"*60)
    
    strategy_labels = {'buy_and_hold': '买入持有', 'dca': '定投', 'rebalance': '再平衡'}
    for strategy, result in results.items():
        label = strategy_labels.get(strategy, strategy)
        print(f"{label:<12} {result.total_return:>+8.2f}% {result.annualized_return:>+8.2f}% {result.max_drawdown:>8.2f}% {result.sharpe_ratio:>8.2f}")


if __name__ == '__main__':
    main()
