/**
 * Measure the landing page at every viewport class it has to survive.
 *
 * Nothing here judges: it reports numbers a design review can cite. Contrast is
 * computed from the resolved colours against the first opaque ancestor, not
 * estimated by eye, and line length is measured in characters at the rendered
 * font size rather than assumed from a max-width.
 *
 *   node scripts/audit-responsive.mjs [url]
 *   SHOTS=1 node scripts/audit-responsive.mjs      # also write a PNG per width
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const URL_ = process.argv[2] ?? 'http://localhost:5173/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT_DIR = '/tmp/ciatta-audit';

const WIDTHS = [
  { w: 1920, h: 1080, label: 'wide desktop' },
  { w: 1440, h: 900,  label: 'wide desktop' },
  { w: 1366, h: 900,  label: 'laptop' },
  { w: 1024, h: 800,  label: 'laptop' },
  { w: 834,  h: 1112, label: 'tablet' },
  { w: 768,  h: 1024, label: 'tablet' },
  { w: 430,  h: 932,  label: 'mobile' },
  { w: 375,  h: 812,  label: 'mobile' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const n = ++id;
      pending.set(n, { res, rej });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'page threw');
  return result.value;
}

/** Injected into the page: everything a layout and contrast review needs. */
const PROBE = `(() => {
  const lin = c => { c /= 255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const L = ([r,g,b]) => 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
  const ratio = (a,b) => { const x=L(a), y=L(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const rgb = s => { const m = String(s).match(/[\\d.]+/g); return m ? m.map(Number) : null; };
  const opaqueBg = el => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = rgb(getComputedStyle(n).backgroundColor);
      if (c && (c[3] === undefined || c[3] > 0.95)) return c.slice(0,3);
      n = n.parentElement;
    }
    return rgb(getComputedStyle(document.body).backgroundColor).slice(0,3);
  };
  const px = v => Math.round(parseFloat(v) * 10) / 10;

  // one representative element per text role
  const roles = {
    'body copy':      '.section-intro p',
    'statement':      '.statement',
    'section h2':     '.section-head h2',
    'section num':    '.section-num',
    'card title':     '.value-card .title',
    'card body':      '.value-card p',
    'note':           '.note',
    'hero lede':      '.hero-lede',
    'hero title':     '.hero-title',
    'showcase lede':  '.showcase-lede',
    'showcase sub':   '.showcase-sub',
    'prepared dt':    '.prepared-row dt',
    'prepared dd':    '.prepared-row dd',
    'eyebrow':        '.eyebrow',
    'chain label':    '.chain-what',
    'footer':         'footer p, .foot p',
  };

  const text = {};
  for (const [name, sel] of Object.entries(roles)) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const fg = rgb(cs.color).slice(0,3);
    const size = px(cs.fontSize);
    const r = el.getBoundingClientRect();
    // characters per line at the rendered size: 0.5em is a fair average advance
    const ch = Math.round(r.width / (size * 0.5));
    text[name] = {
      px: size,
      weight: cs.fontWeight,
      lh: Math.round((parseFloat(cs.lineHeight) / size) * 100) / 100,
      contrast: Math.round(ratio(fg, opaqueBg(el)) * 100) / 100,
      needs: (size >= 24 || +cs.fontWeight >= 700) ? 3 : 4.5,
      widthPx: Math.round(r.width),
      ch,
    };
  }

  const shell = document.querySelector('.shell');
  const shellRect = shell?.getBoundingClientRect();
  const sections = [...document.querySelectorAll('.section')];
  const gaps = [];
  for (let i = 1; i < sections.length; i++) {
    gaps.push(Math.round(
      sections[i].getBoundingClientRect().top - sections[i-1].getBoundingClientRect().bottom));
  }
  const secCS = sections[0] ? getComputedStyle(sections[0]) : null;

  // interactive hit areas
  const hits = [...document.querySelectorAll('a, button, input, [role=button]')]
    .map(el => { const r = el.getBoundingClientRect(); return { t: (el.textContent||el.tagName).trim().slice(0,24), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(x => x.h > 0 && x.h < 44);

  return {
    vw: innerWidth,
    hOverflow: document.documentElement.scrollWidth > innerWidth,
    pageHeight: Math.round(document.documentElement.scrollHeight),
    shellWidth: shellRect ? Math.round(shellRect.width) : null,
    sideMargin: shellRect ? Math.round(shellRect.left) : null,
    sectionPadTop: secCS ? px(secCS.paddingTop) : null,
    sectionPadBottom: secCS ? px(secCS.paddingBottom) : null,
    sectionGaps: gaps,
    text,
    smallHits: hits,
  };
})()`;

async function main() {
  const profile = join(tmpdir(), `ciatta-audit-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--hide-scrollbars', '--window-size=1920,1080',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    const t = setTimeout(() => rej(new Error('no debug port')), 20000);
    chrome.stderr.on('data', d => {
      buf += d;
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(t); res(m[0]); }
    });
  });

  const port = new URL(wsUrl).port;
  let pageWs = null;
  for (let i = 0; i < 40 && !pageWs; i++) {
    const t = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
    pageWs = t.find(x => x.type === 'page')?.webSocketDebuggerUrl ?? null;
    if (!pageWs) await sleep(250);
  }

  const cdp = connect(pageWs);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  if (process.env.SHOTS) await mkdir(SHOT_DIR, { recursive: true });

  for (const { w, h, label } of WIDTHS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: w < 768,
    });
    await cdp.send('Page.navigate', { url: URL_ });
    await sleep(2800);
    const r = await evaluate(cdp, PROBE);

    console.log(`\n${'='.repeat(72)}\n${w}x${h}  ${label}`);
    console.log(`  shell ${r.shellWidth}px, side margin ${r.sideMargin}px, page ${r.pageHeight}px` +
                `${r.hOverflow ? '   *** HORIZONTAL OVERFLOW ***' : ''}`);
    console.log(`  section padding ${r.sectionPadTop}/${r.sectionPadBottom}px` +
                `, gaps between sections: ${r.sectionGaps.join(', ') || 'n/a'}`);
    console.log(`  ${'role'.padEnd(15)}${'px'.padStart(5)}${'wt'.padStart(5)}${'lh'.padStart(6)}${'ch'.padStart(5)}${'contrast'.padStart(10)}`);
    for (const [name, t] of Object.entries(r.text)) {
      const flagC = t.contrast < t.needs ? ` FAIL<${t.needs}` : '';
      const flagCh = t.ch > 80 ? ' long' : '';
      console.log(`  ${name.padEnd(15)}${String(t.px).padStart(5)}${String(t.weight).padStart(5)}${String(t.lh).padStart(6)}${String(t.ch).padStart(5)}${String(t.contrast).padStart(10)}${flagC}${flagCh}`);
    }
    if (r.smallHits.length) {
      console.log(`  hit areas under 44px: ${r.smallHits.slice(0,6).map(x => `"${x.t}" ${x.w}x${x.h}`).join(', ')}`);
    }

    if (process.env.SHOTS) {
      // SHOT_AT scrolls to a selector first, so a review can look at the part
      // of the page under discussion rather than only the fold.
      const at = process.env.SHOT_AT;
      if (at) {
        await evaluate(cdp, `(() => {
          const el = document.querySelector(${JSON.stringify(at)});
          if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 24);
          return true;
        })()`);
        await sleep(700);
      }
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(SHOT_DIR, `${w}${at ? '-at' : ''}.png`), Buffer.from(data, 'base64'));
    }
  }

  cdp.close();
  chrome.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

main().catch(e => { console.error('failed:', e.message); process.exit(1); });
