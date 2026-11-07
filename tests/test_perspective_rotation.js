const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 8098;
const CDP_PORT = 9458;
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  let filePath = path.join(ROOT_DIR, reqUrl === '/' ? 'index.html' : reqUrl);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + reqUrl);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function run() {
  await new Promise(r => server.listen(PORT, r));
  console.log(`Test server listening on ${PORT}`);

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  const edgePath = edgePaths.find(p => fs.existsSync(p));

  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=390,844',
    `http://localhost:${PORT}/index.html`
  ]);

  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const list = await fetchJson(`http://localhost:${CDP_PORT}/json`);
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error('Could not obtain CDP wsUrl');
    edge.kill();
    server.close();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);

  let idCounter = 1;
  function sendCdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evalJs(expr) {
    const res = await sendCdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error((res.exceptionDetails.text || 'Error') + ' ' + (res.exceptionDetails.exception ? res.exceptionDetails.exception.description : ''));
    }
    return res.result ? res.result.value : undefined;
  }

  async function takeShot(filename) {
    const res = await sendCdp('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(ROOT_DIR, filename), buffer);
    console.log(`Saved screenshot: ${filename}`);
  }

  try {
    await sleep(800);
    console.log('1. Checking initial White turn orientation...');
    const initialStatus = await evalJs(`
      (() => {
        const top = document.getElementById('player-top');
        const bottom = document.getElementById('player-bottom');
        const topStyle = window.getComputedStyle(top);
        const bottomStyle = window.getComputedStyle(bottom);
        return {
          topHasClass: top.classList.contains('facing-black-perspective'),
          bottomHasClass: bottom.classList.contains('facing-black-perspective'),
          topTransform: topStyle.transform,
          bottomTransform: bottomStyle.transform
        };
      })()
    `);
    console.log('Initial state:', initialStatus);
    if (initialStatus.topHasClass || initialStatus.bottomHasClass) {
      throw new Error('Cards should not have facing-black-perspective on White turn');
    }
    await takeShot('tests_screen_1_white_turn.png');

    console.log('2. Executing White move e4...');
    await evalJs(`
      (() => {
        const e2 = document.querySelector('[data-square="e2"]');
        const e4 = document.querySelector('[data-square="e4"]');
        if (e2) e2.click();
        if (e4) e4.click();
      })()
    `);

    await sleep(700);

    console.log('3. Checking Black turn orientation (BOTH cards must rotate to Black perspective)...');
    const blackTurnStatus = await evalJs(`
      (() => {
        const top = document.getElementById('player-top');
        const bottom = document.getElementById('player-bottom');
        const topStyle = window.getComputedStyle(top);
        const bottomStyle = window.getComputedStyle(bottom);
        const activeTurn = document.querySelector('.player-card.active-turn')?.id;
        return {
          activeTurn,
          topHasClass: top.classList.contains('facing-black-perspective'),
          bottomHasClass: bottom.classList.contains('facing-black-perspective'),
          topTransform: topStyle.transform,
          bottomTransform: bottomStyle.transform,
          topTransition: topStyle.transition
        };
      })()
    `);
    console.log('Black turn state:', blackTurnStatus);

    if (!blackTurnStatus.topHasClass || !blackTurnStatus.bottomHasClass) {
      throw new Error('BOTH cards must have facing-black-perspective on Black turn!');
    }
    console.log('✓ BOTH cards have .facing-black-perspective on Black turn!');

    await takeShot('tests_screen_2_black_turn_rotated.png');

    console.log('4. Executing Black move e5...');
    await evalJs(`
      (() => {
        const e7 = document.querySelector('[data-square="e7"]');
        const e5 = document.querySelector('[data-square="e5"]');
        if (e7) e7.click();
        if (e5) e5.click();
      })()
    `);

    await sleep(700);

    console.log('5. Checking White turn orientation (BOTH cards rotate back to White perspective)...');
    const returnWhiteStatus = await evalJs(`
      (() => {
        const top = document.getElementById('player-top');
        const bottom = document.getElementById('player-bottom');
        const topStyle = window.getComputedStyle(top);
        const bottomStyle = window.getComputedStyle(bottom);
        const activeTurn = document.querySelector('.player-card.active-turn')?.id;
        return {
          activeTurn,
          topHasClass: top.classList.contains('facing-black-perspective'),
          bottomHasClass: bottom.classList.contains('facing-black-perspective'),
          topTransform: topStyle.transform,
          bottomTransform: bottomStyle.transform
        };
      })()
    `);
    console.log('Returned White turn state:', returnWhiteStatus);

    if (returnWhiteStatus.topHasClass || returnWhiteStatus.bottomHasClass) {
      throw new Error('BOTH cards must have facing-black-perspective removed on White turn!');
    }
    console.log('✓ BOTH cards smoothly returned to White perspective (0 degrees)!');

    await takeShot('tests_screen_3_white_turn_returned.png');

    console.log('--- ALL PERSPECTIVE ROTATION TESTS PASSED 100% ---');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    ws.close();
    edge.kill();
    server.close();
    process.exit(process.exitCode || 0);
  }
}

run();
