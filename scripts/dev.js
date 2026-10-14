const path = require('path');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const children = [
  spawn(process.execPath, [path.join(root, 'backend/index.js')], { cwd: root, stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js')], { cwd: path.join(root, 'frontend'), stdio: 'inherit', windowsHide: true })
];
let stopping = false;
function stop() { if (stopping) return; stopping = true; children.forEach(child => child.kill()); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
children.forEach(child => child.on('exit', code => { if (!stopping) { process.exitCode = code || 0; stop(); } }));
