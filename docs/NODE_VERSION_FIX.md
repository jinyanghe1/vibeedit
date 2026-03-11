# Node.js 版本兼容性修复指南

## 问题

Vite 7.x 需要 Node.js 20.19+ 或 22.12+，但当前环境使用的是 Node 18.17.1。

错误信息：
```
TypeError: crypto.hash is not a function
```

## 解决方案

### 方案 1: 升级 Node.js（推荐）

使用 nvm 升级 Node.js 版本：

```bash
# 安装 Node.js 20
nvm install 20

# 使用 Node.js 20
nvm use 20

# 验证版本
node --version  # 应显示 v20.x.x

# 重新安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 方案 2: 使用 npx 临时运行（快速测试）

```bash
npx -y node@20 npm run dev
```

### 方案 3: 降级 Vite 到 5.x（兼容 Node 18）

如果无法升级 Node.js，可以降级 Vite：

```bash
# 降级 Vite 和相关依赖
npm install vite@5 @vitejs/plugin-react@4 --save-dev

# 然后正常启动
npm run dev
```

**注意**：降级 Vite 可能会失去一些新功能，但作为临时解决方案是可行的。

## 检查

运行以下命令检查 Node 版本：

```bash
node server/check-node.mjs
```

如果版本兼容，会输出：
```
[✓] Node.js v20.x.x 版本兼容
```

如果版本不兼容，会显示详细的错误信息和解决方案。

## 已应用的修复

1. ✅ 在 `package.json` 中添加了 `engines` 字段
2. ✅ 创建了 `server/check-node.mjs` 版本检查脚本
3. ✅ 修改了 `server/dev.mjs` 在启动前自动检查版本

## 参考

- [Vite 官方文档 - 环境要求](https://vitejs.dev/guide/#environment-support)
