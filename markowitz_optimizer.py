#!/usr/bin/env python3
"""
Portfolio Pro 组合优化模块（马科维茨均值-方差模型）
支持：有效前沿计算、最优组合推荐、风险收益分析
"""
import json
import random
import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

# 可选：numpy用于矩阵计算
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    print("[Warning] numpy未安装，使用简化计算")

@dataclass
class OptimalPortfolio:
    """最优组合"""
    expected_return: float
    volatility: float
    sharpe_ratio: float
    weights: Dict[str, float]

class MarkowitzOptimizer:
    """马科维茨组合优化器"""
    
    def __init__(self, holdings_file: str = None):
        self.holdings_file = holdings_file or '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
        self.holdings = self._load_holdings()
        self.assets = []
        self.returns = {}
        self.covariance = {}
        
    def _load_holdings(self) -> Dict:
        """加载持仓"""
        try:
            with open(self.holdings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Error] 加载失败: {e}")
            return {}
    
    def _extract_assets(self) -> List[Dict]:
        """提取资产列表"""
        assets = []
        accounts = self.holdings.get('accounts', [])
        
        for account in accounts:
            for stock in account.get('stocks', []):
                assets.append({
                    'code': stock['code'],
                    'name': stock['name'],
                    'type': 'stock',
                    'current_weight': stock.get('weight', 0) / 100,
                    'return_rate': stock.get('returnRate', 0),
                    'market_value': stock.get('marketValue', 0)
                })
            
            for fund in account.get('funds', []):
                if fund.get('code') != 'YEB':  # 排除余额宝
                    assets.append({
                        'code': fund['code'],
                        'name': fund['name'],
                        'type': 'fund',
                        'current_weight': fund.get('weight', 0) / 100,
                        'return_rate': fund.get('returnRate', 0),
                        'market_value': fund.get('marketValue', 0)
                    })
        
        return assets
    
    def _estimate_returns_and_risks(self, assets: List[Dict]) -> Tuple[Dict, Dict]:
        """
        估算收益率和风险（简化版）
        实际应用中应使用历史数据计算
        """
        returns = {}
        risks = {}
        
        for asset in assets:
            code = asset['code']
            # 使用累计收益率作为期望收益率（年化）
            current_return = asset.get('return_rate', 0)
            # 假设持有期约1年，年化
            returns[code] = current_return / 100
            
            # 估算风险（股票风险高于基金）
            if asset['type'] == 'stock':
                base_risk = 0.25  # 25%波动率
            else:
                base_risk = 0.15  # 15%波动率
            
            # 根据收益表现调整风险估计
            risks[code] = base_risk * (1 + abs(current_return) / 100)
        
        return returns, risks
    
    def _estimate_correlation(self, assets: List[Dict]) -> Dict[Tuple, float]:
        """
        估算资产间相关性（简化版）
        同类资产相关性高，不同类资产相关性低
        """
        correlations = {}
        
        for i, asset1 in enumerate(assets):
            for j, asset2 in enumerate(assets):
                if i >= j:
                    continue
                
                code1, code2 = asset1['code'], asset2['code']
                type1, type2 = asset1['type'], asset2['type']
                
                # 简化相关性估计
                if type1 == type2:
                    # 同类资产，相关性较高
                    corr = 0.7 + random.random() * 0.2
                else:
                    # 不同类资产，相关性较低
                    corr = 0.3 + random.random() * 0.3
                
                correlations[(code1, code2)] = corr
                correlations[(code2, code1)] = corr
        
        return correlations
    
    def calculate_efficient_frontier(self, num_portfolios: int = 100) -> List[OptimalPortfolio]:
        """
        计算有效前沿
        
        Returns:
            有效前沿上的最优组合列表
        """
        assets = self._extract_assets()
        if len(assets) < 2:
            print("[Error] 资产数量不足，无法进行组合优化")
            return []
        
        print(f"\n📊 组合优化分析")
        print(f"资产数量: {len(assets)}")
        
        returns, risks = self._estimate_returns_and_risks(assets)
        correlations = self._estimate_correlation(assets)
        
        asset_codes = [a['code'] for a in assets]
        n = len(asset_codes)
        
        # 生成随机权重组合
        portfolios = []
        
        for _ in range(num_portfolios * 10):  # 生成更多组合，筛选有效前沿
            # 生成随机权重（总和为1）
            weights = [random.random() for _ in range(n)]
            total = sum(weights)
            weights = [w / total for w in weights]
            
            weight_dict = {code: w for code, w in zip(asset_codes, weights)}
            
            # 计算组合收益
            portfolio_return = sum(
                weights[i] * returns.get(code, 0) 
                for i, code in enumerate(asset_codes)
            )
            
            # 计算组合风险（简化版）
            portfolio_variance = 0
            for i, code1 in enumerate(asset_codes):
                for j, code2 in enumerate(asset_codes):
                    if i == j:
                        portfolio_variance += weights[i] ** 2 * risks.get(code1, 0.2) ** 2
                    elif i < j:
                        corr = correlations.get((code1, code2), 0.5)
                        cov = corr * risks.get(code1, 0.2) * risks.get(code2, 0.2)
                        portfolio_variance += 2 * weights[i] * weights[j] * cov
            
            portfolio_risk = math.sqrt(portfolio_variance)
            
            # 计算夏普比率（假设无风险利率3%）
            risk_free = 0.03
            sharpe = (portfolio_return - risk_free) / portfolio_risk if portfolio_risk > 0 else 0
            
            portfolios.append(OptimalPortfolio(
                expected_return=portfolio_return * 100,
                volatility=portfolio_risk * 100,
                sharpe_ratio=sharpe,
                weights=weight_dict
            ))
        
        # 筛选有效前沿（每个风险水平下收益最高的组合）
        portfolios.sort(key=lambda p: p.volatility)
        
        efficient_portfolios = []
        max_return_so_far = -float('inf')
        
        for p in portfolios:
            if p.expected_return > max_return_so_far:
                efficient_portfolios.append(p)
                max_return_so_far = p.expected_return
        
        # 选择代表性组合
        if len(efficient_portfolios) > num_portfolios:
            step = len(efficient_portfolios) // num_portfolios
            efficient_portfolios = efficient_portfolios[::step][:num_portfolios]
        
        return efficient_portfolios
    
    def find_optimal_portfolios(self) -> Dict[str, OptimalPortfolio]:
        """找到几种最优组合策略"""
        frontier = self.calculate_efficient_frontier()
        if not frontier:
            return {}
        
        results = {}
        
        # 最大夏普比率组合（风险调整后收益最高）
        max_sharpe = max(frontier, key=lambda p: p.sharpe_ratio)
        results['max_sharpe'] = max_sharpe
        
        # 最小风险组合
        min_risk = min(frontier, key=lambda p: p.volatility)
        results['min_risk'] = min_risk
        
        # 最大收益组合
        max_return = max(frontier, key=lambda p: p.expected_return)
        results['max_return'] = max_return
        
        # 目标收益10%的最小风险组合
        target_return = 10.0
        candidates = [p for p in frontier if p.expected_return >= target_return]
        if candidates:
            target_portfolio = min(candidates, key=lambda p: p.volatility)
            results['target_10'] = target_portfolio
        
        return results
    
    def generate_rebalance_suggestions(self) -> List[Dict]:
        """生成调仓建议（基于马科维茨优化）"""
        optimal = self.find_optimal_portfolios()
        if not optimal or 'max_sharpe' not in optimal:
            return []
        
        assets = self._extract_assets()
        optimal_weights = optimal['max_sharpe'].weights
        
        suggestions = []
        
        for asset in assets:
            code = asset['code']
            current = asset['current_weight']
            target = optimal_weights.get(code, 0)
            diff = target - current
            
            if abs(diff) > 0.02:  # 差异超过2%才建议调整
                action = '增持' if diff > 0 else '减持'
                suggestions.append({
                    'code': code,
                    'name': asset['name'],
                    'current_weight': current * 100,
                    'target_weight': target * 100,
                    'diff': diff * 100,
                    'action': action,
                    'market_value': asset['market_value']
                })
        
        # 按调整幅度排序
        suggestions.sort(key=lambda x: abs(x['diff']), reverse=True)
        return suggestions
    
    def format_report(self) -> str:
        """格式化优化报告"""
        optimal = self.find_optimal_portfolios()
        if not optimal:
            return "无法进行组合优化分析"
        
        lines = [
            "\n🎯 马科维茨组合优化报告",
            "=" * 50,
            "\n【最优组合对比】"
        ]
        
        strategy_names = {
            'max_sharpe': '最大夏普比率',
            'min_risk': '最小风险',
            'max_return': '最大收益',
            'target_10': '目标收益10%'
        }
        
        lines.append(f"{'策略':<15} {'预期收益':<10} {'波动率':<10} {'夏普':<10}")
        lines.append("-" * 50)
        
        for key, portfolio in optimal.items():
            name = strategy_names.get(key, key)
            lines.append(
                f"{name:<15} {portfolio.expected_return:>8.2f}% "
                f"{portfolio.volatility:>8.2f}% {portfolio.sharpe_ratio:>8.2f}"
            )
        
        # 调仓建议
        suggestions = self.generate_rebalance_suggestions()
        if suggestions:
            lines.extend([
                "\n【调仓建议】（基于最大夏普比率组合）",
                f"{'资产':<20} {'当前':<8} {'目标':<8} {'调整':<8} {'操作':<6}",
                "-" * 60
            ])
            
            for s in suggestions[:10]:  # 显示前10条
                lines.append(
                    f"{s['name'][:18]:<20} {s['current_weight']:>6.1f}% "
                    f"{s['target_weight']:>6.1f}% {s['diff']:>+6.1f}% {s['action']:<6}"
                )
        
        return "\n".join(lines)


def main():
    """主函数"""
    optimizer = MarkowitzOptimizer()
    print(optimizer.format_report())


if __name__ == '__main__':
    main()
