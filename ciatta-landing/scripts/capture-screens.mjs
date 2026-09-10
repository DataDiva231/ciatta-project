/**
 * Export each of the seven product screens as its own PNG.
 *
 * The screens are React, not images, so the only faithful way to get a picture
 * of one is to render it and photograph it. This drives the local dev server
 * through Chrome's DevTools Protocol: no Playwright, no Puppeteer, nothing to
 * install beyond the Chrome already on the machine.
 *
 * Each screen is brought to the centre slot first. That matters: the six
 * screens behind the centre carry a brightness filter, so capturing one where
 * it stands would export it dimmed. Centre is also the only slot at full size.
 *
 * The phone is forced to 402pt wide, its real iPhone 17 Pro width, and shot at
 * deviceScaleFactor 3, so every PNG lands at 1206px across and the interiors
 * keep the proportions they were designed at.
 *
 *   node scripts/capture-screens.mjs [outDir] [url]
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = resolve(process.argv[2] ?? '../ciatta-app-screens');
const URL_ = process.argv[3] ?? 'http://localhost:5173/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCALE = 3;
const PHONE_PT = 402;          // iPhone 17 Pro width
const CENTRE_SCALE = 1.75;     // .ps-slot centre slot scale, from ProductShowcase

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal CDP client: one WebSocket, id-matched replies, awaited events. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const n = ++id;
      pending.set(n, { res, rej });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

/** Evaluate in the page and return the value, surfacing thrown errors. */
async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'page threw');
  return result.value;
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  await mkdir(OUT, { recursive: true });
  const profile = join(tmpdir(), `ciatta-shot-${Date.now()}`);

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1600,1200',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  // Chrome prints the DevTools endpoint to stderr once it is listening.
  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    const t = setTimeout(() => rej(new Error('Chrome did not report a debug port')), 20000);
    chrome.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(t); res(m[0]); }
    });
    chrome.on('exit', (c) => { clearTimeout(t); rej(new Error(`Chrome exited (${c})`)); });
  });

  // Chrome reports the browser-level endpoint, which has no Page domain. The
  // page target's own socket does, and /json/list is the way to find it.
  const port = new URL(wsUrl).port;
  let pageWs = null;
  for (let tries = 0; tries < 40 && !pageWs; tries++) {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    pageWs = targets.find(t => t.type === 'page')?.webSocketDebuggerUrl ?? null;
    if (!pageWs) await sleep(250);
  }
  if (!pageWs) throw new Error('no page target to attach to');

  const cdp = connect(pageWs);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1200, deviceScaleFactor: SCALE, mobile: false,
  });

  await cdp.send('Page.navigate', { url: URL_ });
  await sleep(3500);

  // Life-size phone, and no auto-advance stealing the screen mid-capture.
  const names = await evaluate(cdp, `(() => {
    const sc = document.querySelector('.showcase');
    sc.style.setProperty('--ps-w', '${PHONE_PT / CENTRE_SCALE}px');
    sc.querySelector('.showcase-stage')
      .dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    return [...document.querySelectorAll('.ps-source')].map(b => b.textContent.trim());
  })()`);

  if (!names?.length) throw new Error('no screens found — is the dev server running?');

  const written = [];
  for (let i = 0; i < names.length; i++) {
    const box = await evaluate(cdp, `(async () => {
      const btns = [...document.querySelectorAll('.ps-source')];
      btns[${i}].click();
      await new Promise(r => setTimeout(r, 1300));            // slot transition
      const stage = document.querySelector('.showcase-stage');
      stage.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      const phone = document.querySelector('.ps-slot.is-centre .ps-phone');
      phone.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise(r => setTimeout(r, 450));
      const r = phone.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height,
               title: document.querySelector('.ps-slot.is-centre .ps-nav-title').textContent };
    })()`);

    // CDP's clip rectangle disagrees with getBoundingClientRect about which
    // coordinate space it means, and lands wrong either way. A full-viewport
    // capture is reliable, so the crop happens in the page instead: the phone's
    // rect is known exactly, and a canvas cuts it out with no ambiguity.
    const full = await cdp.send('Page.captureScreenshot', { format: 'png' });
    if (process.env.DEBUG_SHOT) {
      await writeFile(join(OUT, `debug-${i + 1}-viewport.png`), Buffer.from(full.data, 'base64'));
      console.log('   rect', JSON.stringify(box));
    }
    const cropped = await evaluate(cdp, `(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + ${JSON.stringify(full.data)};
      await img.decode();
      const s = ${SCALE};
      const c = document.createElement('canvas');
      c.width  = Math.round(${box.width} * s);
      c.height = Math.round(${box.height} * s);
      c.getContext('2d').drawImage(
        img,
        Math.round(${box.x} * s), Math.round(${box.y} * s), c.width, c.height,
        0, 0, c.width, c.height,
      );
      return c.toDataURL('image/png');
    })()`);
    const data = cropped.split(',')[1];

    const file = join(OUT, `${String(i + 1).padStart(2, '0')}-${slug(names[i])}.png`);
    await writeFile(file, Buffer.from(data, 'base64'));
    written.push({ file, name: names[i], title: box.title,
                   px: `${Math.round(box.width * SCALE)}x${Math.round(box.height * SCALE)}` });
    console.log(`  ${String(i + 1).padStart(2, '0')}  ${names[i].padEnd(22)} ${written.at(-1).px}`);
  }

  cdp.close();
  chrome.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  console.log(`\n  ${written.length} screens -> ${OUT}`);
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
