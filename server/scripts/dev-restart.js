const { spawnSync, spawn } = require('child_process');

function killPort5000Windows() {
  const list = spawnSync('cmd', ['/c', 'netstat -ano | findstr :5000'], {
    encoding: 'utf8',
  });

  if (!list.stdout) return;
  const pids = new Set();
  list.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/\s+/);
      const state = parts[3];
      const pid = parts[4];
      if (state === 'LISTENING' && /^\d+$/.test(pid)) {
        pids.add(pid);
      }
    });

  for (const pid of pids) {
    spawnSync('taskkill', ['/PID', pid, '/F'], { stdio: 'inherit' });
  }
}

function startDev() {
  const child = spawn(process.execPath, ['--watch', 'server.js'], {
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code || 0));
}

if (process.platform === 'win32') {
  killPort5000Windows();
}
startDev();

