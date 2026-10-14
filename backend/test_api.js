// Compatibility entry point for the original project test command.
const { spawnSync } = require('child_process');
const path = require('path');
const result = spawnSync(process.execPath, ['--test', path.join(__dirname, 'tests/integration.test.js')], { stdio: 'inherit', windowsHide: true });
process.exitCode = result.status || (result.error ? 1 : 0);
