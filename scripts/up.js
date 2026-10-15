#!/usr/bin/env node
// One command to go live: starts an ngrok tunnel (if one is not already running)
// and then the server.   npm run up
import { spawn } from 'node:child_process';
import { config } from '../src/config.js';

async function tunnelUp() {
  try {
    const r = await fetch('http://127.0.0.1:4040/api/tunnels');
    const { tunnels } = await r.json();
    return tunnels.some((t) => t.public_url?.startsWith('https://'));
  } catch { return false; }
}

if (!config.publicUrl && !(await tunnelUp())) {
  console.log(`Starting ngrok tunnel to port ${config.port}…`);
  // NGROK_DOMAIN (your free static domain) keeps the webhook URL the same across restarts.
  const domain = (process.env.NGROK_DOMAIN || '').trim().replace(/^https?:\/\//, '');
  const args = ['http', String(config.port), '--log', 'stderr', '--log-level', 'warn', ...(domain ? [`--url=https://${domain}`] : [])];
  const ngrok = spawn('ngrok', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  ngrok.on('error', () => {
    console.error('Could not start ngrok. Install it and add your authtoken (docs/en/03-ngrok.md), or set PUBLIC_URL.');
    process.exit(1);
  });
  process.on('exit', () => ngrok.kill());
  for (let i = 0; i < 40 && !(await tunnelUp()); i += 1) await new Promise((r) => setTimeout(r, 250));
}

await import('../src/server.js');
