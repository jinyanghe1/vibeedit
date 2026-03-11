import { spawn } from 'node:child_process';
import { checkNodeVersion } from './check-node.mjs';

// 首先检查 Node.js 版本
const isVersionOK = checkNodeVersion();
if (!isVersionOK) {
  process.exit(1);
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function spawnProcess(scriptName) {
  const child = spawn(npmCmd, ['run', scriptName], {
    stdio: 'inherit',
    env: process.env
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(0), 200);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const api = spawnProcess('dev:api');
const web = spawnProcess('dev:web');

for (const child of [api, web]) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown();
      process.exit(code);
    }
  });
}

