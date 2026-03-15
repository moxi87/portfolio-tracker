# Portfolio Pro 纯前端架构 v2.0

## 核心原则
- **无后端依赖**: 纯前端，GitHub Pages 直接托管
- **数据存储**: GitHub 仓库 JSON 文件（数据即代码）
- **跨设备同步**: 任何设备访问都是最新数据
- **本地缓存**: localStorage 仅作为离线降级

## 数据架构

```
GitHub Repository (moxi87/portfolio-tracker)
├── index.html              # 主应用
├── data/                   # 数据目录
│   ├── holdings.json      # 持仓数据（写死的真实持仓）
│   ├── history.json       # 历史收益曲线
│   ├── trades.json        # 交易记录
│   └── config.json        # 用户配置
├── .github/
│   └── workflows/
│       ├── update-data.yml    # 定时更新股价数据
│       ├── sync-feishu.yml    # 飞书同步
│       └── backup-daily.yml   # 每日备份
└── scripts/
    ├── fetch_stock_data.py    # 获取实时股价
    └── update_json.py         # 更新JSON数据
```

## 数据文件格式

### holdings.json - 持仓数据
```json
{
  "version": "2026-03-15",
  "lastUpdate": "2026-03-15T15:00:00+08:00",
  "accounts": [
    {
      "id": "default",
      "name": "主账户",
      "type": "stock",
      "holdings": [
        {
          "code": "002594",
          "name": "比亚迪",
          "shares": 2100,
          "cost": 104.80,
          "addedDate": "2025-06-15",
          "lastPrice": 99.67,
          "lastUpdate": "2026-03-15T15:00:00+08:00"
        }
      ]
    }
  ]
}
```

### history.json - 历史数据
```json
{
  "records": [
    {"date": "2026-03-15", "totalAssets": 400500, "dailyPnL": 961},
    {"date": "2026-03-14", "totalAssets": 399539, "dailyPnL": -520}
  ]
}
```

### prices.json - 实时价格（GitHub Actions 自动更新）
```json
{
  "lastUpdate": "2026-03-15T15:00:03+08:00",
  "source": "sina+tencent",
  "stocks": {
    "002594": {"price": 99.67, "change": -0.85, "validated": true},
    "603019": {"price": 89.10, "change": 1.23, "validated": true}
  }
}
```

## 前端数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ 加载页面    │───►│ 读取 data/    │───►│ 渲染持仓     │   │
│  └─────────────┘    │ holdings.json  │    └──────────────┘   │
│                     └──────────────┘                         │
│                            │                                │
│                     ┌──────▼──────┐                         │
│                     │ 读取 prices  │ 实时价格（缓存）         │
│                     │   .json     │                         │
│                     └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    GitHub Raw Content CDN
```

## GitHub Actions 自动化

### 1. update-data.yml - 每日更新股价
```yaml
name: Update Stock Prices
on:
  schedule:
    - cron: '*/5 9-15 * * 1-5'  # 交易日每5分钟
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: pip install requests
      - run: python scripts/fetch_stock_data.py
      - run: |
          git config user.name "GitHub Action"
          git config user.email "action@github.com"
          git add data/prices.json
          git commit -m "Update stock prices $(date +%Y-%m-%d_%H:%M)"
          git push
```

### 2. 前端读取数据
```javascript
// 从 GitHub Raw 读取数据
async function loadData() {
  const base = 'https://raw.githubusercontent.com/moxi87/portfolio-tracker/main/data';
  
  const [holdings, prices] = await Promise.all([
    fetch(`${base}/holdings.json`).then(r => r.json()),
    fetch(`${base}/prices.json`).then(r => r.json())
  ]);
  
  // 合并计算
  const portfolio = calculatePortfolio(holdings, prices);
  renderDashboard(portfolio);
}
```

## 优势

1. **真正纯前端**: 无需服务器，GitHub Pages 直接托管
2. **数据一致性**: 所有设备看到的数据完全一致
3. **版本控制**: 数据变更有 Git 历史记录
4. **自动更新**: GitHub Actions 定时更新股价
5. **离线可用**: localStorage 缓存上次数据

## 实施步骤

1. [ ] 创建 data/ 目录结构
2. [ ] 迁移现有持仓数据到 holdings.json
3. [ ] 创建 GitHub Actions 工作流
4. [ ] 修改前端从 GitHub Raw 读取数据
5. [ ] 添加数据更新钩子（可选飞书推送）
