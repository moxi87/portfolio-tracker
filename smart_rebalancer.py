#!/usr/bin/env python3
"""
智能再平衡系统
功能：分析当前资产配置，生成调仓建议
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

# 配置
HOLDINGS_FILE = '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
REBALANCE_CONFIG = '/root/.openclaw/workspace/rebalance_config.json'

@dataclass
class AssetAllocation:
    """资产配置"""
    category: str  # 类别：股票/基金/现金
    current_value: float
    current_weight: float
    target_weight: float
    deviation: float  # 偏离度

@dataclass
class RebalanceSuggestion:
    """再平衡建议"""
    asset_name: str
    asset_code: str
    action: str  # BUY/SELL/HOLD
    current_value: float
    target_value: float
    adjust_value: float
    reason: str

class SmartRebalancer:
    """智能再平衡器"""
    
    # 默认目标配置
    DEFAULT_TARGETS = {
        'stocks': 0.55,      # 股票 55%
        'funds': 0.35,       # 基金 35%
        'cash': 0.10,        # 现金 10%
        'crypto': 0.00       # 加密货币 0%
    }
    
    # 行业配置目标（股票部分）
    SECTOR_TARGETS = {
        '新能源': 0.25,
        '科技': 0.20,
        '消费': 0.15,
        '医药': 0.10,
        '金融': 0.10,
        '其他': 0.20
    }
    
    # 单只持仓上限
    MAX_SINGLE_POSITION = 0.20  # 20%
    
    def __init__(self):
        self.holdings = self._load_holdings()
        self.config = self._load_config()
        self.total_assets = 0
        self.allocations = []
        self.suggestions = []
    
    def _load_holdings(self) -> Dict:
        """加载持仓数据"""
        try:
            with open(HOLDINGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Error] 加载持仓失败: {e}")
            return {}
    
    def _load_config(self) -> Dict:
        """加载再平衡配置"""
        default = {
            'targets': self.DEFAULT_TARGETS,
            'sector_targets': self.SECTOR_TARGETS,
            'max_single_position': self.MAX_SINGLE_POSITION,
            'rebalance_threshold': 0.05,  # 偏离5%触发再平衡建议
            'min_trade_amount': 5000      # 最小交易金额
        }
        
        try:
            if os.path.exists(REBALANCE_CONFIG):
                with open(REBALANCE_CONFIG, 'r', encoding='utf-8') as f:
                    return {**default, **json.load(f)}
        except Exception as e:
            print(f"[Warning] 加载配置失败: {e}")
        
        return default
    
    def calculate_current_allocation(self) -> List[AssetAllocation]:
        """计算当前资产配置"""
        accounts = self.holdings.get('accounts', [])
        
        # 按类别汇总
        category_values = {'stocks': 0, 'funds': 0, 'cash': 0, 'crypto': 0}
        
        for account in accounts:
            # 股票
            for stock in account.get('stocks', []):
                category_values['stocks'] += stock.get('marketValue', 0)
            
            # 基金
            for fund in account.get('funds', []):
                # 余额宝算现金，其他算基金
                if fund.get('code') == 'YEB':
                    category_values['cash'] += fund.get('marketValue', 0)
                else:
                    category_values['funds'] += fund.get('marketValue', 0)
        
        # 计算总资产
        self.total_assets = sum(category_values.values())
        
        if self.total_assets == 0:
            return []
        
        # 生成配置分析
        allocations = []
        targets = self.config.get('targets', self.DEFAULT_TARGETS)
        
        for category, value in category_values.items():
            weight = value / self.total_assets
            target = targets.get(category, 0)
            allocations.append(AssetAllocation(
                category=category,
                current_value=value,
                current_weight=weight,
                target_weight=target,
                deviation=weight - target
            ))
        
        self.allocations = allocations
        return allocations
    
    def check_concentration_risk(self) -> List[Dict]:
        """检查集中度风险"""
        risks = []
        max_position = self.config.get('max_single_position', 0.20)
        
        accounts = self.holdings.get('accounts', [])
        for account in accounts:
            for stock in account.get('stocks', []):
                weight = stock.get('weight', 0) / 100  # 转换为小数
                if weight > max_position:
                    risks.append({
                        'type': 'concentration',
                        'asset': stock.get('name', ''),
                        'code': stock.get('code', ''),
                        'current_weight': weight * 100,
                        'max_allowed': max_position * 100,
                        'excess': (weight - max_position) * 100
                    })
            
            for fund in account.get('funds', []):
                weight = fund.get('weight', 0) / 100
                if weight > max_position:
                    risks.append({
                        'type': 'concentration',
                        'asset': fund.get('name', ''),
                        'code': fund.get('code', ''),
                        'current_weight': weight * 100,
                        'max_allowed': max_position * 100,
                        'excess': (weight - max_position) * 100
                    })
        
        return risks
    
    def generate_rebalance_suggestions(self) -> List[RebalanceSuggestion]:
        """生成再平衡建议"""
        suggestions = []
        threshold = self.config.get('rebalance_threshold', 0.05)
        min_trade = self.config.get('min_trade_amount', 5000)
        
        # 类别再平衡
        for alloc in self.allocations:
            if abs(alloc.deviation) > threshold:
                target_value = self.total_assets * alloc.target_weight
                adjust_value = target_value - alloc.current_value
                
                if abs(adjust_value) >= min_trade:
                    action = 'ADD' if adjust_value > 0 else 'REDUCE'
                    category_names = {
                        'stocks': '股票',
                        'funds': '基金',
                        'cash': '现金',
                        'crypto': '加密货币'
                    }
                    
                    suggestions.append(RebalanceSuggestion(
                        asset_name=category_names.get(alloc.category, alloc.category),
                        asset_code=alloc.category,
                        action=action,
                        current_value=alloc.current_value,
                        target_value=target_value,
                        adjust_value=abs(adjust_value),
                        reason=f"{alloc.category}配置偏离{alloc.deviation*100:+.1f}%，建议{action}"
                    ))
        
        self.suggestions = suggestions
        return suggestions
    
    def format_report(self) -> str:
        """格式化再平衡报告"""
        lines = [
            "📊 智能再平衡报告",
            f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"总资产: {self.total_assets:,.0f}元\n",
            "=" * 40
        ]
        
        # 当前配置
        lines.append("\n📈 当前资产配置:")
        for alloc in self.allocations:
            emoji = "⚠️" if abs(alloc.deviation) > 0.05 else "✅"
            lines.append(
                f"{emoji} {alloc.category:6s}: "
                f"{alloc.current_weight*100:5.1f}% "
                f"(目标{alloc.target_weight*100:4.1f}%) "
                f"偏离{alloc.deviation*100:+.1f}%"
            )
        
        # 集中度风险
        risks = self.check_concentration_risk()
        if risks:
            lines.append("\n🚨 集中度风险:")
            for risk in risks:
                lines.append(
                    f"   {risk['asset']} ({risk['code']})\n"
                    f"   当前占比: {risk['current_weight']:.1f}% (上限{risk['max_allowed']:.1f}%)\n"
                    f"   建议减持: {risk['excess']:.1f}%"
                )
        
        # 再平衡建议
        if self.suggestions:
            lines.append("\n💡 再平衡建议:")
            for sg in self.suggestions:
                emoji = "🔺" if sg.action == 'ADD' else "🔻"
                lines.append(
                    f"{emoji} {sg.asset_name}\n"
                    f"   操作: {'增持' if sg.action == 'ADD' else '减持'} {sg.adjust_value:,.0f}元\n"
                    f"   原因: {sg.reason}"
                )
        else:
            lines.append("\n✅ 配置合理，无需再平衡")
        
        return "\n".join(lines)
    
    def run(self) -> Dict:
        """运行再平衡分析"""
        print("=" * 50)
        print("智能再平衡分析")
        print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 50)
        
        # 计算配置
        self.calculate_current_allocation()
        print(f"\n总资产: {self.total_assets:,.0f}元")
        
        # 检查风险
        risks = self.check_concentration_risk()
        if risks:
            print(f"\n发现 {len(risks)} 个集中度风险")
            for risk in risks:
                print(f"  ⚠️ {risk['asset']}: {risk['current_weight']:.1f}%")
        
        # 生成建议
        self.generate_rebalance_suggestions()
        if self.suggestions:
            print(f"\n生成 {len(self.suggestions)} 条再平衡建议")
            for sg in self.suggestions:
                print(f"  💡 {sg.asset_name}: {sg.action} {sg.adjust_value:,.0f}元")
        
        # 输出报告
        report = self.format_report()
        print("\n" + report)
        
        return {
            'success': True,
            'total_assets': self.total_assets,
            'allocations': [
                {
                    'category': a.category,
                    'current_weight': a.current_weight,
                    'target_weight': a.target_weight,
                    'deviation': a.deviation
                } for a in self.allocations
            ],
            'risks': risks,
            'suggestions': [
                {
                    'name': s.asset_name,
                    'action': s.action,
                    'amount': s.adjust_value,
                    'reason': s.reason
                } for s in self.suggestions
            ],
            'report': report
        }


def main():
    """主函数"""
    rebalancer = SmartRebalancer()
    result = rebalancer.run()
    
    if result['success']:
        print("\n✅ 再平衡分析完成")
        # 可以在这里添加保存报告到文件或发送通知的逻辑
        return result
    else:
        print("\n❌ 分析失败")
        return None


if __name__ == '__main__':
    main()
