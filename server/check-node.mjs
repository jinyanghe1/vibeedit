#!/usr/bin/env node
/**
 * Node.js 版本检查脚本
 * 确保使用兼容的 Node 版本启动开发服务器
 */

import { execSync } from 'child_process';
import process from 'process';

const REQUIRED_MAJOR = 20;
const REQUIRED_MINOR = 19;

function getNodeVersion() {
  const version = process.version; // e.g., 'v18.17.1'
  const match = version.match(/v(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    raw: version
  };
}

function checkNodeVersion() {
  const version = getNodeVersion();
  
  if (!version) {
    console.error('\x1b[31m[错误] 无法检测 Node.js 版本\x1b[0m');
    process.exit(1);
  }
  
  const { major, minor, raw } = version;
  
  // 检查主版本号
  if (major < REQUIRED_MAJOR) {
    console.error('\x1b[31m============================================\x1b[0m');
    console.error('\x1b[31m[错误] Node.js 版本不兼容\x1b[0m');
    console.error('\x1b[31m============================================\x1b[0m');
    console.error(`当前版本: \x1b[33m${raw}\x1b[0m`);
    console.error(`所需版本: \x1b[32m>= ${REQUIRED_MAJOR}.${REQUIRED_MINOR}.0\x1b[0m`);
    console.error('');
    console.error('Vite 7.x 需要 Node.js 20.19+ 或 22.12+');
    console.error('');
    console.error('\x1b[36m解决方案:\x1b[0m');
    console.error('1. 使用 nvm 升级 Node.js:');
    console.error('   \x1b[33mnvm install 20\x1b[0m');
    console.error('   \x1b[33mnvm use 20\x1b[0m');
    console.error('');
    console.error('2. 或使用 npx 临时运行（仅限开发）:');
    console.error('   \x1b[33mnpx -y node@20 npm run dev\x1b[0m');
    console.error('');
    console.error('3. 如果无法升级，可降级 Vite 到 5.x:');
    console.error('   \x1b[33mnpm install vite@5\x1b[0m');
    console.error('\x1b[31m============================================\x1b[0m');
    process.exit(1);
  }
  
  // 检查次版本号（如果是 20.x）
  if (major === REQUIRED_MAJOR && minor < REQUIRED_MINOR) {
    console.error('\x1b[31m============================================\x1b[0m');
    console.error('\x1b[31m[错误] Node.js 版本过低\x1b[0m');
    console.error('\x1b[31m============================================\x1b[0m');
    console.error(`当前版本: \x1b[33m${raw}\x1b[0m`);
    console.error(`所需版本: \x1b[32m>= ${REQUIRED_MAJOR}.${REQUIRED_MINOR}.0\x1b[0m`);
    console.error('');
    console.error('Vite 7.x 需要 Node.js 20.19+ 或 22.12+');
    console.error('');
    console.error('\x1b[36m解决方案:\x1b[0m');
    console.error('1. 升级 Node.js:');
    console.error('   \x1b[33mnvm install 20 && nvm use 20\x1b[0m');
    console.error('\x1b[31m============================================\x1b[0m');
    process.exit(1);
  }
  
  // 版本检查通过
  console.log(`\x1b[32m[✓] Node.js ${raw} 版本兼容\x1b[0m`);
  return true;
}

// 执行检查
export { checkNodeVersion };

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  checkNodeVersion();
}
