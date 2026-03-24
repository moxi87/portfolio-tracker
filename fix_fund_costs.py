#!/usr/bin/env python3
"""
从Bitable同步基金成本数据
修复 holdings.json 中的 cost 字段
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, '/root/.openclaw/workspace')

# 基金成本数据 (从Bitable导出)
FUND_COSTS = {
    "003984": {"cost": 25704.66, "name": "嘉实新能源新材料股票A"},
    "008586": {"cost": 14000.00, "name": "华夏人工智能ETF联接D"},
    "000043": {"cost": 33000.00, "name": "嘉实美国成长股票(QDII)"},
    "007904": {"cost": 16000.00, "name": "华宝海外新能源汽车(QDII)A"},
    "016440": {"cost": 10591.89, "name": "华夏中证红利质量ETF联接A"},
    "007467": {"cost": 10427.77, "name": "华泰柏瑞中证红利低波动ETF联接C"},
    "013231": {"cost": 9712.34, "name": "博时智选量化多因子股票C"},
    "015283": {"cost": 12004.32, "name": "华安恒生科技ETF联接(QDII)C"},
    "YEB": {"cost": 363.45, "name": "余额宝"},
}

def fix_fund_costs():
    """修复基金成本数据"""
    data_file = Path("/root/.openclaw/workspace/portfolio-tracker/data/holdings.json")
    
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print("修复基金成本数据...")
    
    for fund in data['accounts'][0]['funds']:
        code = fund['code']
        if code in FUND_COSTS:
            cost = FUND_COSTS[code]['cost']
            mv = fund['marketValue']
            
            # 设置成本
            fund['cost'] = cost
            
            # 重新计算收益
            fund['totalPnL'] = round(mv - cost, 2)
            fund['returnRate'] = round((mv - cost) / cost * 100, 2) if cost > 0 else 0
            
            print(f"  ✓ {code}: cost={cost}, MV={mv}, PnL={fund['totalPnL']}, ret={fund['returnRate']}%")
    
    # 保存
    with open(data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("\n✅ 基金成本数据已修复")
    return data

if __name__ == "__main__":
    fix_fund_costs()
