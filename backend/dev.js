const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting NestJS development server...\n');

// Use ts-node to run the TypeScript directly
const tsNode = spawn('node', [
  '-r', 'ts-node/register',
  '-r', 'tsconfig-paths/register',
  path.join(__dirname, 'src/main.ts')
], {
  stdio: 'inherit',
  env: { 
    ...process.env,
    NODE_ENV: 'development',
    TS_NODE_TRANSPILE_ONLY: 'true',
    TS_NODE_PROJECT: path.join(__dirname, 'tsconfig.json')
  }
});

tsNode.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

tsNode.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Server exited with code ${code}`);
  }
  process.exit(code);
});