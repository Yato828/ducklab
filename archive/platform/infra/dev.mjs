import { spawn } from 'node:child_process';
const children = [spawn('npm', ['run', 'dev:web'], { stdio: 'inherit' }), spawn('npm', ['run', 'dev:api'], { stdio: 'inherit' })];
for (const event of ['SIGINT', 'SIGTERM']) process.on(event, () => { for (const child of children) child.kill(event); });
for (const child of children) child.on('exit', code => { if (code) { for (const other of children) other.kill('SIGTERM'); process.exitCode = code; } });
