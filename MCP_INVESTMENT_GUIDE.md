# 📊 投研 MCP 服务配置指南

本配置文件包含了 3 个热门的**免费**投研相关 MCP 服务。

---

## 🚀 已配置的 MCP 服务

### 1️⃣ Yahoo Finance MCP（完全免费）
- **用途**: 获取全球股票实时报价、历史数据、公司基本面信息
- **特点**: 
  - ✅ 完全免费，无需注册
  - ✅ 无需 API Key
  - ✅ 支持美股、港股、A股（通过 Yahoo 代码）
  - ✅ 支持实时价格、历史 K 线、市盈率、股息等
- **安装**: `npx -y yahoo-finance-mcp`
- **使用示例**:
  - "查询苹果公司(AAPL)的当前股价"
  - "获取特斯拉过去一个月的日线数据"
  - "对比微软和谷歌的市盈率"

### 2️⃣ 实时股票分析 MCP（中文市场，完全免费）
- **用途**: 中文 A股、港股、美股实时数据分析
- **数据源**: 东方财富
- **特点**:
  - ✅ 完全免费，免登录
  - ✅ 支持 A股、B股、港股、美股
  - ✅ 34个工具：K线、技术指标(MA/MACD/BOLL/RSI)、基本面、估值分析
  - ✅ 资金流向、行业对比、智能研报
- **安装**: `uvx real-time-stock-mcp-service`
- **GitHub**: https://github.com/DannyWongIsAvailable/real-time-stock-mcp-service
- **在线体验**: https://modelscope.cn/mcp/servers/DannyWong/real-time-stock-mcp
- **使用示例**:
  - "查询贵州茅台(600519)的实时行情"
  - "分析比亚迪的技术指标"
  - "查看新能源板块的资金流向"

### 3️⃣ Alpha Vantage MCP（免费版 25次/天）
- **用途**: 专业级技术分析和基本面数据
- **特点**:
  - ✅ 60+ 技术指标（RSI、MACD、布林带、随机指标等）
  - ✅ 全球经济数据（GDP、通胀、失业率）
  - ✅ 全球覆盖：股票、外汇、加密货币
  - ⚠️ 免费版限制：25次 API 调用/天
- **安装**: `npx -y @berlinbra/alpha-vantage-mcp`
- **申请 API Key**: https://www.alphavantage.co/support/#api-key
- **使用示例**:
  - "计算 AAPL 的 14 日 RSI 和移动平均线"
  - "获取美元指数的最新走势"
  - "分析最新的通胀数据对科技股的影响"

---

## 🔧 各客户端配置方式

### Claude Desktop
1. 打开配置文件：
   - **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
   - **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. 将 `claude_desktop_config.json` 的内容复制进去
3. 重启 Claude Desktop

### Cursor
1. 打开 Cursor 设置 → MCP
2. 或者直接将 `.cursor/mcp.json` 的内容粘贴到 Cursor MCP 配置中
3. 重启 Cursor

### VSCode (Cline 插件)
1. 安装 Cline 插件
2. 打开 Cline 设置 → MCP 配置
3. 将 `.vscode/mcp.json` 的内容粘贴进去

### Cherry Studio
1. 设置 → MCP 服务器
2. 添加配置（SSE 或 Stdio 模式）

---

## 💡 投研使用场景示例

### 早盘市场扫描
```
"帮我查看今天涨幅前 10 的科技股，并分析它们的技术面"
```

### 个股深度分析
```
"分析宁德时代(300750)的基本面：营收增长、利润率、现金流情况"
```

### 行业对比
```
"对比白酒行业三大龙头：茅台、五粮液、泸州老窖的估值水平和成长性"
```

### 技术指标策略
```
"找出 RSI 低于 30 的超卖股票，并计算它们的布林带位置"
```

### 全球市场监控
```
"查看美股三大指数、美元指数、黄金价格的最新走势"
```

---

## ⚠️ 注意事项

1. **Alpha Vantage 免费限制**: 每天 25 次调用，建议用于关键分析
2. **数据延迟**: 免费数据源可能有 15-20 分钟延迟，不适合高频交易
3. **投资建议**: MCP 提供的数据仅供参考，不构成投资建议
4. **合规使用**: 请遵守各数据源的使用条款

---

## 📚 更多资源

- [MCP 官方文档](https://modelcontextprotocol.io/introduction)
- [MCP 服务市场](https://mcp.so/)
- [ModelScope MCP](https://modelscope.cn/mcp)

---

*配置文件生成时间: 2026-03-04*
