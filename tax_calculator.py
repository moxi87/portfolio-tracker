#!/usr/bin/env python3
"""
Portfolio Pro 税务计算模块
支持：股票交易税费、基金分红税、印花税计算
"""
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class TaxRecord:
    """税务记录"""
    date: str
    type: str  # stamp_duty/transfer_fee/brokerage/dividend_tax
    amount: float
    description: str

@dataclass
class TradeTax:
    """交易税费"""
    stamp_duty: float  # 印花税
    transfer_fee: float  # 过户费
    brokerage: float  # 佣金
    total: float

class TaxCalculator:
    """税务计算器"""
    
    # 税率配置（中国A股现行税率）
    TAX_RATES = {
        'stamp_duty': 0.001,  # 印花税：卖出时千分之一（单边）
        'transfer_fee_sh': 0.00002,  # 上海过户费：成交金额的十万分之二（双边）
        'transfer_fee_sz': 0.00002,  # 深圳过户费：成交金额的十万分之二（双边）
        'brokerage_min': 5.0,  # 最低佣金5元
        'brokerage_rate': 0.00025,  # 佣金率：万分之2.5（双边）
        'dividend_tax_1month': 0.20,  # 持股≤1个月：20%
        'dividend_tax_1year': 0.10,   # 1个月<持股≤1年：10%
        'dividend_tax_long': 0.00,    # 持股>1年：免税
    }
    
    def __init__(self, holdings_file: str = None):
        self.holdings_file = holdings_file or '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
        self.holdings = self._load_holdings()
        self.tax_records = []
    
    def _load_holdings(self) -> Dict:
        """加载持仓数据"""
        try:
            with open(self.holdings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Error] 加载失败: {e}")
            return {}
    
    def calculate_trade_tax(self, amount: float, is_sell: bool, market: str = 'sh') -> TradeTax:
        """
        计算单笔交易税费
        
        Args:
            amount: 成交金额
            is_sell: 是否卖出（卖出才收印花税）
            market: 市场（sh/sz）
        """
        rates = self.TAX_RATES
        
        # 印花税（卖出单边收取）
        stamp_duty = amount * rates['stamp_duty'] if is_sell else 0
        
        # 过户费（双边）
        transfer_fee = amount * rates[f'transfer_fee_{market}']
        
        # 佣金（双边，最低5元）
        brokerage = max(amount * rates['brokerage_rate'], rates['brokerage_min'])
        
        total = stamp_duty + transfer_fee + brokerage
        
        return TradeTax(
            stamp_duty=round(stamp_duty, 2),
            transfer_fee=round(transfer_fee, 2),
            brokerage=round(brokerage, 2),
            total=round(total, 2)
        )
    
    def calculate_dividend_tax(self, dividend_amount: float, holding_days: int) -> float:
        """
        计算分红税
        
        Args:
            dividend_amount: 分红金额
            holding_days: 持股天数
        """
        rates = self.TAX_RATES
        
        if holding_days <= 30:
            tax_rate = rates['dividend_tax_1month']
        elif holding_days <= 365:
            tax_rate = rates['dividend_tax_1year']
        else:
            tax_rate = rates['dividend_tax_long']
        
        return round(dividend_amount * tax_rate, 2)
    
    def estimate_annual_taxes(self, annual_turnover: float = None) -> Dict:
        """
        估算年度税费
        
        Args:
            annual_turnover: 年度成交额（如果未提供则基于当前持仓估算）
        """
        accounts = self.holdings.get('accounts', [])
        
        # 估算年度成交额（如果未提供）
        if annual_turnover is None:
            total_value = 0
            for account in accounts:
                for stock in account.get('stocks', []):
                    total_value += stock.get('marketValue', 0)
                for fund in account.get('funds', []):
                    total_value += fund.get('marketValue', 0)
            
            # 假设年换手率150%（买卖各一次算200%）
            annual_turnover = total_value * 1.5
        
        # 假设买卖各半
        sell_amount = annual_turnover * 0.5
        buy_amount = annual_turnover * 0.5
        
        # 计算税费
        # 买入税费
        buy_tax = self.calculate_trade_tax(buy_amount, is_sell=False)
        
        # 卖出税费
        sell_tax = self.calculate_trade_tax(sell_amount, is_sell=True)
        
        total_tax = buy_tax.total + sell_tax.total
        
        return {
            'annual_turnover': annual_turnover,
            'buy_tax': buy_tax,
            'sell_tax': sell_tax,
            'stamp_duty': sell_tax.stamp_duty,  # 只有卖出有印花税
            'transfer_fee': buy_tax.transfer_fee + sell_tax.transfer_fee,
            'brokerage': buy_tax.brokerage + sell_tax.brokerage,
            'total_tax': total_tax,
            'tax_rate_on_turnover': (total_tax / annual_turnover * 100) if annual_turnover > 0 else 0
        }
    
    def analyze_tax_efficiency(self) -> Dict:
        """分析税收效率"""
        accounts = self.holdings.get('accounts', [])
        
        stock_trades = []
        fund_trades = []
        
        for account in accounts:
            # 统计股票
            for stock in account.get('stocks', []):
                market_value = stock.get('marketValue', 0)
                if market_value > 0:
                    stock_trades.append({
                        'name': stock['name'],
                        'market_value': market_value,
                        'estimated_tax_rate': 0.0015  # 约千分之1.5
                    })
            
            # 统计基金（基金交易费用更低）
            for fund in account.get('funds', []):
                market_value = fund.get('marketValue', 0)
                if market_value > 0:
                    fund_trades.append({
                        'name': fund['name'],
                        'market_value': market_value,
                        'estimated_tax_rate': 0.0005  # 约万分之5
                    })
        
        total_stock_value = sum(t['market_value'] for t in stock_trades)
        total_fund_value = sum(t['market_value'] for t in fund_trades)
        total_value = total_stock_value + total_fund_value
        
        # 估算税收效率
        if total_value > 0:
            stock_ratio = total_stock_value / total_value
            fund_ratio = total_fund_value / total_value
            weighted_tax_rate = stock_ratio * 0.0015 + fund_ratio * 0.0005
        else:
            weighted_tax_rate = 0
        
        return {
            'stock_value': total_stock_value,
            'fund_value': total_fund_value,
            'stock_ratio': stock_ratio * 100 if total_value > 0 else 0,
            'fund_ratio': fund_ratio * 100 if total_value > 0 else 0,
            'weighted_tax_rate': weighted_tax_rate * 100,
            'tax_efficiency_score': max(0, 100 - weighted_tax_rate * 10000)  # 分数越高越省税
        }
    
    def generate_tax_report(self) -> str:
        """生成税务报告"""
        annual_estimate = self.estimate_annual_taxes()
        efficiency = self.analyze_tax_efficiency()
        
        lines = [
            "\n💰 税务分析报告",
            "=" * 50,
            "\n【年度税费估算】",
            f"估算年成交额: ¥{annual_estimate['annual_turnover']:,.0f}",
            f"印花税: ¥{annual_estimate['stamp_duty']:,.2f}",
            f"过户费: ¥{annual_estimate['transfer_fee']:,.2f}",
            f"佣金: ¥{annual_estimate['brokerage']:,.2f}",
            f"总税费: ¥{annual_estimate['total_tax']:,.2f}",
            f"税费率: {annual_estimate['tax_rate_on_turnover']:.3f}%",
            "\n【税收效率分析】",
            f"股票占比: {efficiency['stock_ratio']:.1f}% (交易成本高)",
            f"基金占比: {efficiency['fund_ratio']:.1f}% (交易成本低)",
            f"加权费率: {efficiency['weighted_tax_rate']:.3f}%",
            f"税收效率分: {efficiency['tax_efficiency_score']:.1f}/100",
            "\n【节税建议】",
            "1. 减少频繁交易，降低佣金支出",
            "2. 基金持有期超过1年可免赎回费",
            "3. 持股超过1年分红免税",
            "4. 优先选择场内ETF替代股票，降低交易成本"
        ]
        
        return "\n".join(lines)
    
    def calculate_holding_period(self, buy_date: str, sell_date: str = None) -> int:
        """计算持股天数"""
        buy = datetime.strptime(buy_date, '%Y-%m-%d')
        sell = datetime.strptime(sell_date, '%Y-%m-%d') if sell_date else datetime.now()
        return (sell - buy).days


def main():
    """主函数"""
    calculator = TaxCalculator()
    print(calculator.generate_tax_report())
    
    # 示例：计算单笔交易税费
    print("\n【单笔交易示例】")
    print("买入10万元股票:")
    buy_tax = calculator.calculate_trade_tax(100000, is_sell=False)
    print(f"  过户费: ¥{buy_tax.transfer_fee}")
    print(f"  佣金: ¥{buy_tax.brokerage}")
    print(f"  合计: ¥{buy_tax.total}")
    
    print("\n卖出10万元股票:")
    sell_tax = calculator.calculate_trade_tax(100000, is_sell=True)
    print(f"  印花税: ¥{sell_tax.stamp_duty}")
    print(f"  过户费: ¥{sell_tax.transfer_fee}")
    print(f"  佣金: ¥{sell_tax.brokerage}")
    print(f"  合计: ¥{sell_tax.total}")


if __name__ == '__main__':
    main()
