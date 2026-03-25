#!/usr/bin/env python3
"""
Portfolio Pro 行业配置分析模块
支持：行业分类、集中度分析、偏离度计算
"""
import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class SectorAllocation:
    """行业配置"""
    sector: str
    current_weight: float
    target_weight: float
    deviation: float
    assets: List[Dict]

class SectorAnalyzer:
    """行业分析器"""
    
    # 行业分类映射（简化版）
    SECTOR_MAP = {
        # 新能源
        '比亚迪': '新能源',
        '新能源': '新能源',
        '光伏': '新能源',
        '储能': '新能源',
        # 科技
        '人工智能': '科技',
        'AI': '科技',
        '半导体': '科技',
        '芯片': '科技',
        '科技': '科技',
        '恒生科技': '科技',
        # 金融
        '银行': '金融',
        '保险': '金融',
        '证券': '金融',
        # 消费
        '消费': '消费',
        '白酒': '消费',
        '食品饮料': '消费',
        # 医药
        '医药': '医药',
        '医疗': '医药',
        '生物科技': '医药',
        # 原材料
        '有色': '原材料',
        '洛阳钼业': '原材料',
        '化工': '原材料',
        # 地产
        '地产': '地产',
        '建筑': '地产',
        # 能源
        '能源': '能源',
        '石油': '能源',
        '煤炭': '能源',
        # 红利/价值
        '红利': '红利价值',
        '低波': '红利价值',
        '质量': '红利价值',
        # 美股
        '美国成长': '美股',
        '纳斯达克': '美股',
        '标普': '美股',
        # 港股
        '港股': '港股',
        '恒生': '港股',
        # 海外
        '海外': '海外',
        'QDII': '海外',
        # 债券
        '债券': '债券',
        '余额宝': '现金',
        '货币': '现金'
    }
    
    # 目标行业配置
    TARGET_SECTORS = {
        '新能源': 0.15,
        '科技': 0.20,
        '红利价值': 0.15,
        '美股': 0.10,
        '港股': 0.10,
        '原材料': 0.05,
        '债券': 0.10,
        '现金': 0.10,
        '其他': 0.05
    }
    
    def __init__(self, holdings_file: str = None):
        self.holdings_file = holdings_file or '/root/.openclaw/workspace/portfolio-tracker/data/holdings.json'
        self.holdings = self._load_holdings()
        self.sector_allocations = {}
    
    def _load_holdings(self) -> Dict:
        """加载持仓"""
        try:
            with open(self.holdings_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Error] 加载失败: {e}")
            return {}
    
    def _classify_sector(self, name: str) -> str:
        """根据名称分类行业"""
        name_lower = name.lower()
        
        for keyword, sector in self.SECTOR_MAP.items():
            if keyword.lower() in name_lower:
                return sector
        
        return '其他'
    
    def analyze_sector_allocation(self) -> Dict[str, SectorAllocation]:
        """分析行业配置"""
        accounts = self.holdings.get('accounts', [])
        
        # 按行业汇总
        sector_values = defaultdict(lambda: {'value': 0, 'assets': []})
        total_value = 0
        
        for account in accounts:
            # 股票
            for stock in account.get('stocks', []):
                sector = self._classify_sector(stock.get('name', ''))
                value = stock.get('marketValue', 0)
                sector_values[sector]['value'] += value
                sector_values[sector]['assets'].append({
                    'name': stock['name'],
                    'code': stock['code'],
                    'type': 'stock',
                    'value': value,
                    'return_rate': stock.get('returnRate', 0)
                })
                total_value += value
            
            # 基金
            for fund in account.get('funds', []):
                sector = self._classify_sector(fund.get('name', ''))
                value = fund.get('marketValue', 0)
                sector_values[sector]['value'] += value
                sector_values[sector]['assets'].append({
                    'name': fund['name'],
                    'code': fund['code'],
                    'type': 'fund',
                    'value': value,
                    'return_rate': fund.get('returnRate', 0)
                })
                total_value += value
        
        # 计算配置
        allocations = {}
        for sector, data in sector_values.items():
            current_weight = data['value'] / total_value if total_value > 0 else 0
            target_weight = self.TARGET_SECTORS.get(sector, 0.05)
            
            allocations[sector] = SectorAllocation(
                sector=sector,
                current_weight=current_weight * 100,
                target_weight=target_weight * 100,
                deviation=(current_weight - target_weight) * 100,
                assets=data['assets']
            )
        
        self.sector_allocations = allocations
        return allocations
    
    def calculate_concentration_risk(self) -> Dict:
        """计算行业集中度风险"""
        allocations = self.analyze_sector_allocation()
        
        if not allocations:
            return {}
        
        # 赫芬达尔指数（HHI）
        hhi = sum((alloc.current_weight / 100) ** 2 for alloc in allocations.values())
        
        # 前三大行业占比
        sorted_sectors = sorted(allocations.values(), key=lambda x: x.current_weight, reverse=True)
        top3_weight = sum(s.current_weight for s in sorted_sectors[:3])
        
        # 最大单一行业
        max_sector = sorted_sectors[0] if sorted_sectors else None
        
        # 风险评级
        if max_sector and max_sector.current_weight > 40:
            risk_level = '高风险'
        elif max_sector and max_sector.current_weight > 30:
            risk_level = '中高风险'
        elif top3_weight > 70:
            risk_level = '中等风险'
        else:
            risk_level = '低风险'
        
        return {
            'hhi': hhi * 10000,  # 标准化到0-10000
            'top3_weight': top3_weight,
            'max_sector': max_sector.sector if max_sector else '',
            'max_sector_weight': max_sector.current_weight if max_sector else 0,
            'risk_level': risk_level,
            'sector_count': len(allocations)
        }
    
    def generate_rebalance_suggestions(self) -> List[Dict]:
        """生成行业调仓建议"""
        allocations = self.analyze_sector_allocation()
        suggestions = []
        
        for sector, alloc in allocations.items():
            if abs(alloc.deviation) > 5:  # 偏离超过5%
                action = '超配' if alloc.deviation > 0 else '低配'
                suggestions.append({
                    'sector': sector,
                    'current': alloc.current_weight,
                    'target': alloc.target_weight,
                    'deviation': alloc.deviation,
                    'action': '减持' if alloc.deviation > 0 else '增持',
                    'priority': '高' if abs(alloc.deviation) > 10 else '中'
                })
        
        # 按偏离度排序
        suggestions.sort(key=lambda x: abs(x['deviation']), reverse=True)
        return suggestions
    
    def format_report(self) -> str:
        """格式化行业分析报告"""
        allocations = self.analyze_sector_allocation()
        concentration = self.calculate_concentration_risk()
        suggestions = self.generate_rebalance_suggestions()
        
        lines = [
            "\n🏭 行业配置分析报告",
            "=" * 60,
            "\n【行业配置对比】",
            f"{'行业':<12} {'当前':<8} {'目标':<8} {'偏离':<8} {'状态':<6}",
            "-" * 60
        ]
        
        # 按当前权重排序
        sorted_allocs = sorted(allocations.values(), key=lambda x: x.current_weight, reverse=True)
        
        for alloc in sorted_allocs:
            status = "⚠️" if abs(alloc.deviation) > 5 else "✅"
            lines.append(
                f"{alloc.sector:<12} {alloc.current_weight:>6.1f}% {alloc.target_weight:>6.1f}% "
                f"{alloc.deviation:>+6.1f}% {status}"
            )
        
        # 集中度分析
        lines.extend([
            "\n【集中度风险】",
            f"行业数量: {concentration.get('sector_count', 0)}",
            f"赫芬达尔指数(HHI): {concentration.get('hhi', 0):.0f} (越高越集中)",
            f"前三大行业占比: {concentration.get('top3_weight', 0):.1f}%",
            f"最大单一行业: {concentration.get('max_sector', '')} ({concentration.get('max_sector_weight', 0):.1f}%)",
            f"集中度风险: {concentration.get('risk_level', '未知')}"
        ])
        
        # 调仓建议
        if suggestions:
            lines.extend([
                "\n【调仓建议】",
                f"{'行业':<12} {'操作':<6} {'偏离':<8} {'优先级':<6}",
                "-" * 40
            ])
            for sg in suggestions[:5]:
                lines.append(
                    f"{sg['sector']:<12} {sg['action']:<6} {sg['deviation']:>+6.1f}% {sg['priority']:<6}"
                )
        
        # 行业详情
        lines.append("\n【行业详情】")
        for alloc in sorted_allocs[:5]:
            lines.append(f"\n{alloc.sector} (权重: {alloc.current_weight:.1f}%)")
            for asset in alloc.assets[:3]:
                lines.append(f"  • {asset['name'][:20]}: ¥{asset['value']:,.0f}")
        
        return "\n".join(lines)


def main():
    """主函数"""
    analyzer = SectorAnalyzer()
    print(analyzer.format_report())


if __name__ == '__main__':
    main()
