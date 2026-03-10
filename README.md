# 个人持仓跟踪系统

📊 实时追踪基金和股票持仓，自动计算收益、Beta值和风险分析。

## 在线预览

部署后访问: `https://你的用户名.github.io/portfolio-tracker/`

## 功能特性

- 📈 **实时总览**: 总资产、今日盈亏、累计盈亏
- 📊 **资产配置**: 基金/股票饼图 + 分类收益柱状图
- 📉 **风险分析**: Beta值估算 + 市场分布
- 📝 **交互编辑**: 支持在线修改持仓数据
- 🔄 **自动更新**: 可配置定时任务更新数据

## 快速部署指南

### 第一步：Fork/创建仓库

1. 登录 [GitHub](https://github.com)
2. 点击右上角 **+** → **New repository**
3. 仓库名称填: `portfolio-tracker`
4. 选择 **Public** (或 Private，但需要 GitHub Pro 才能部署 Pages)
5. 勾选 **Add a README file**
6. 点击 **Create repository**

### 第二步：上传文件

1. 打开新创建的仓库页面
2. 点击 **Add file** → **Upload files**
3. 拖拽 `index.html` 到上传区域
4. 填写提交信息: "Initial commit"
5. 点击 **Commit changes**

### 第三步：开启 GitHub Pages

1. 进入仓库 **Settings** 标签
2. 左侧菜单选择 **Pages**
3. **Source** 选择 **Deploy from a branch**
4. **Branch** 选择 **main** / **root**
5. 点击 **Save**
6. 等待 1-2 分钟，访问显示的链接

## 数据更新方式

### 方式一：手动编辑（推荐初期）

直接在网页上点击「编辑」按钮修改数据，数据保存在浏览器本地存储中。

### 方式二：自动定时更新

我已为你配置好 `.github/workflows/update-data.yml`，每日 20:30 自动抓取最新数据。

需要配置 GitHub Secrets:
1. 进入仓库 **Settings** → **Secrets and variables** → **Actions**
2. 添加以下 Secrets:
   - `FEISHU_USER_ID`: 你的飞书用户 ID
   - `DATA_SOURCE_URL`: 数据源接口（如有）

### 方式三：我帮你推送更新

每天晚上 8 点后，你可以直接问我：
> "今天持仓更新了吗？"

我会抓取当日收盘价，生成新的 `data.json` 并推送到你的仓库。

## 持仓数据结构

数据存储在 `portfolio-data.json`：

```json
{
  "lastUpdate": "2026-03-10",
  "funds": [...],
  "stocks": [...]
}
```

## 隐私说明

- 数据存储在 GitHub 私有仓库中（如设为 Private）
- 网页部署后任何人可访问，但数据只有你提供给我时才会更新
- 建议不要在代码中提交真实账户密码等敏感信息

## 后续优化计划

- [ ] 对接真实行情 API（新浪财经、东方财富等）
- [ ] 飞书机器人每日推送
- [ ] 历史收益曲线
- [ ] 多账户管理

## 联系我

有问题随时飞书找我，或提交 GitHub Issue。
