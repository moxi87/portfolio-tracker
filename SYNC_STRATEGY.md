# Portfolio Pro 自动同步方案

## 📋 方案概述

**目标**: 实现持仓数据全自动同步，无需手动操作  
**策略**: 收盘后自动抓取股票实时价格 + 基金净值，自动推送到GitHub  
**数据源**: 腾讯财经(股票) + 天天基金(基金净值)

---

## 🔧 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    定时任务调度层 (Cron)                      │
├─────────────────────────────────────────────────────────────┤
│  15:30  │  股票数据同步    │  trading_days                  │
│  20:00  │  A股基金同步     │  trading_days                  │
│  20:30  │  QDII基金同步    │  trading_days+1                │
└─────────┴──────────────────┴────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据抓取层 (Python)                       │
├─────────────────────────────────────────────────────────────┤
│  auto_sync.py        │  核心同步逻辑                        │
│  ├─ fetch_stock_prices_tencent()                           │
│  └─ fetch_fund_nav_eastmoney()                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据存储层 (GitHub)                       │
├─────────────────────────────────────────────────────────────┤
│  data/holdings.json  │  持仓数据文件                        │
│  GitHub Pages        │  自动部署展示                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    通知推送层 (飞书)                         │
├─────────────────────────────────────────────────────────────┤
│  同步报告             │  推送到飞书                         │
│  异常告警             │  失败时提醒                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📅 定时任务配置

### 1. 股票数据同步 (15:30)
```json
{
  "name": "portfolio-sync-stocks",
  "schedule": {
    "kind": "cron",
    "expr": "30 15 * * 1-5",
    "tz": "Asia/Shanghai"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "执行持仓股票数据同步。运行: cd /root/.openclaw/workspace/portfolio-tracker && python3 cron_sync.py"
  },
  "sessionTarget": "isolated",
  "enabled": true
}
```

### 2. A股基金同步 (20:00)
```json
{
  "name": "portfolio-sync-funds-a",
  "schedule": {
    "kind": "cron", 
    "expr": "0 20 * * 1-5",
    "tz": "Asia/Shanghai"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "执行A股基金净值同步。运行: cd /root/.openclaw/workspace/portfolio-tracker && python3 auto_sync.py"
  },
  "sessionTarget": "isolated",
  "enabled": true
}
```

### 3. QDII基金同步 (20:30)
```json
{
  "name": "portfolio-sync-funds-qdii",
  "schedule": {
    "kind": "cron",
    "expr": "30 20 * * 2-6",
    "tz": "Asia/Shanghai"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "执行QDII基金净值同步(T+2)。运行: cd /root/.openclaw/workspace/portfolio-tracker && python3 auto_sync.py"
  },
  "sessionTarget": "isolated",
  "enabled": true
}
```

---

## 📊 数据源对比

| 数据源 | 类型 | 更新频率 | 可靠性 | 延迟 |
|--------|------|----------|--------|------|
| 腾讯财经 | 股票 | 实时 | 95% | <1秒 |
| 新浪财经 | 股票 | 实时 | 90% | <1秒 |
| 天天基金 | A股基金 | T+1日 | 88% | 18:00后 |
| 天天基金 | QDII基金 | T+2日 | 85% | 次日 |

---

## 🎯 持仓标的覆盖

### 股票 (4只)
- 比亚迪 002594 (深圳)
- 电网设备 601669 (上海)  
- 中科曙光 603019 (上海)
- 洛阳钼业 603993 (上海)

### 基金 (9只)
**A股基金 (5只)** - T+1更新
- 嘉实新能源新材料 003984
- 华夏人工智能 008586
- 华夏中证红利质量 016440
- 华泰柏瑞红利低波动 007467
- 博时智选量化多因子 013231

**QDII基金 (3只)** - T+2更新
- 嘉实美国成长 000043 (美股)
- 华宝海外新能源汽车 007904 (海外)
- 华安恒生科技 015283 (港股)

**现金 (1只)**
- 余额宝 YEB

---

## 🔄 同步流程

```python
# 1. 加载当前持仓	holdings = load_holdings()

# 2. 更新股票价格
for stock in holdings.stocks:
    price = fetch_tencent(stock.code)
    stock.price = price
    stock.marketValue = price * stock.shares
    stock.dailyPnL = (price - yesterday_price) * stock.shares

# 3. 更新基金净值  
for fund in holdings.funds:
    nav = fetch_eastmoney(fund.code)
    fund.nav = nav
    fund.marketValue = nav * fund.shares
    fund.dailyPnL = calculate_daily_pnl(fund)

# 4. 重新计算权重和汇总
recalculate_weights()
update_summary()

# 5. 添加历史记录
add_history_record()

# 6. 保存并推送
save_holdings()
push_to_github()
push_to_feishu()
```

---

## ⚠️ 错误处理

### 网络超时
- 重试3次，间隔5分钟
- 使用备用数据源

### 数据缺失
- 保留上次有效数据
- 标记为"待更新"状态

### GitHub推送失败
- 本地保存成功即算成功
- 下次同步时重试推送

---

## 📱 推送通知

### 每日同步报告
```
📊 持仓数据同步报告 | 2026-03-16 15:30

总资产: ¥394,589.49
今日盈亏: 🟢 +¥3,055.86 (+0.78%)

更新明细:
- 股票: 4只已更新
- 基金: 9只已更新

重点变动:
📈 比亚迪: +2.15%
📉 中科曙光: -5.66%
📈 嘉实新能源: +1.89%
```

### 异常提醒
- 单只标的涨跌超过5%
- 同步失败
- 数据源异常

---

## 🚀 部署步骤

### 1. 添加定时任务
```bash
# 查看现有任务
openclaw cron list

# 添加股票同步任务
openclaw cron add --json '{
  "name": "portfolio-sync-stocks",
  "schedule": {"kind": "cron", "expr": "30 15 * * 1-5", "tz": "Asia/Shanghai"},
  "payload": {"kind": "agentTurn", "message": "执行持仓股票数据同步。运行: cd /root/.openclaw/workspace/portfolio-tracker && python3 cron_sync.py"},
  "sessionTarget": "isolated",
  "enabled": true
}'

# 添加基金同步任务
openclaw cron add --json '{
  "name": "portfolio-sync-funds",
  "schedule": {"kind": "cron", "expr": "0 20 * * 1-5", "tz": "Asia/Shanghai"},
  "payload": {"kind": "agentTurn", "message": "执行基金净值同步。运行: cd /root/.openclaw/workspace/portfolio-tracker && python3 auto_sync.py"},
  "sessionTarget": "isolated",
  "enabled": true
}'
```

### 2. 测试运行
```bash
cd /root/.openclaw/workspace/portfolio-tracker
python3 auto_sync.py
```

### 3. 验证GitHub
- 检查 data/holdings.json 是否更新
- 检查 GitHub Pages 是否显示最新数据

---

## 📈 后续优化

### Phase 1 (已完成)
- ✅ 基础同步脚本
- ✅ 腾讯财经数据源
- ✅ 天天基金数据源
- ✅ GitHub自动推送
- ✅ 飞书通知

### Phase 2 (规划中)
- [ ] 多源交叉验证
- [ ] 异常数据检测
- [ ] 智能成本计算
- [ ] 分红送股处理

### Phase 3 (未来)
- [ ] 实时WebSocket推送
- [ ] 多账户支持
- [ ] 策略回测数据
- [ ] 税务计算
