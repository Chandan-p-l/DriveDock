// Renders promo/video.html to MP4 frame-by-frame (deterministic) using headless Chrome + ffmpeg.
// usage: node render.mjs [out.mp4] [fps] [startSec] [endSec]
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(here, 'video-silent.mp4');
const FPS = +(process.argv[3] || 30);
const START = +(process.argv[4] || 0);
const PORT = 9333;
const W = 1920, H = 1080;

const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, '--hide-scrollbars',
  '--force-device-scale-factor=1', '--disable-gpu-vsync', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'ddv-'))}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
  } catch { await sleep(100); }
}
if (!wsUrl) throw new Error('Chrome did not start');

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file://' + path.join(here, 'video.html') });
for (let i = 0; i < 100; i++) { if (await evalJs('document.readyState==="complete" && typeof render==="function"').catch(() => false)) break; await sleep(100); }
await evalJs('document.fonts.ready.then(() => true)');
const TOTAL = await evalJs('window.TOTAL');
const END = +(process.argv[5] || TOTAL);
const frames = Math.round((END - START) * FPS);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-tune', 'animation',
  '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const t = START + f / FPS;
  await evalJs(`render(${t}); new Promise(r => requestAnimationFrame(() => r(1)))`);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const buf = Buffer.from(data, 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
ws.close(); chrome.kill();
console.log(`\nwrote ${OUT} (${frames} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
