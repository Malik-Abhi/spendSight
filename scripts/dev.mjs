import net from 'node:net';
import { spawn } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

loadEnv();

const target = process.argv[2] || 'web';
const serverPort = Number(process.env.PORT || 4000);

const commands = {
  app: ['npx', ['expo', 'start', 'app', '--port', '8081']],
  android: ['npx', ['expo', 'start', 'app', '--android', '--port', '8081']],
  ios: ['npx', ['expo', 'start', 'app', '--ios', '--port', '8081']],
  web: ['npx', ['vite', '--host', '0.0.0.0']]
};

if (!commands[target]) {
  console.error(`Unknown dev target "${target}". Use app, android, ios, or web.`);
  process.exit(1);
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  });

  child.once('exit', (code, signal) => {
    if (signal) {
      console.log(`${name} stopped with ${signal}`);
      return;
    }
    if (code && code !== 0) {
      console.log(`${name} exited with ${code}`);
    }
  });

  return child;
}

const children = [];
const serverAlreadyRunning = await isPortOpen(serverPort);

if (serverAlreadyRunning) {
  console.log(`API already running on http://localhost:${serverPort}`);
} else {
  children.push(run('api', 'npm', ['--prefix', 'server', 'run', 'dev']));
}

const [command, args] = commands[target];
children.push(run(target, command, args));

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.once('SIGINT', () => {
  stopAll();
  process.exit(0);
});

process.once('SIGTERM', () => {
  stopAll();
  process.exit(0);
});
