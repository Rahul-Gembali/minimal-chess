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
    for (let i = 0; i < 20; i++) {
      const ready = await evalJs(`Boolean(document.getElementById('player-top') && document.getElementById('player-bottom'))`);
      if (ready) break;
      await sleep(200);
    }
    console.log('1. Checking initial White turn state...');
    const initialStatus = await evalJs(`
      (() => {
        const top = document.getElementById('player-top');
        const bottom = document.getElementById('player-bottom');
        const nameTop = document.getElementById('name-top')?.textContent;
        const nameBottom = document.getElementById('name-bottom')?.textContent;
        const topStyle = window.getComputedStyle(top);
        const bottomStyle = window.getComputedStyle(bottom);
        const activeTurn = document.querySelector('.player-card.active-turn')?.id;
        return {
          nameTop,
          nameBottom,
          activeTurn,
          topTransform: topStyle.transform,
          bottomTransform: bottomStyle.transform
        };
      })()
    `);
    console.log('Initial state:', initialStatus);
    if (initialStatus.nameBottom !== 'White' || initialStatus.nameTop !== 'Black') {
      throw new Error(`Expected White at bottom and Black at top, got: bottom=${initialStatus.nameBottom}, top=${initialStatus.nameTop}`);
    }
    if (initialStatus.topTransform.includes('matrix(-1') || initialStatus.bottomTransform.includes('matrix(-1')) {
      throw new Error('Rotation detected! Cards must NEVER rotate on Z-axis');
    }
    await takeShot('test_zero_rot_1_white_turn.png');

    console.log('2. Executing White move e4...');
    await evalJs(`
      (() => {
        const e2 = document.querySelector('[data-square="e2"]');
        const e4 = document.querySelector('[data-square="e4"]');
        if (e2) e2.click();
        if (e4) e4.click();
      })()
    `);

    await sleep(600);

    console.log('3. Checking Black turn state (Names flipped smoothly without any rotation)...');
    const blackTurnStatus = await evalJs(`
      (() => {
        const top = document.getElementById('player-top');
        const bottom = document.getElementById('player-bottom');
        const nameTop = document.getElementById('name-top')?.textContent;
        const nameBottom = document.getElementById('name-bottom')?.textContent;
        const topStyle = window.getComputedStyle(top);
        const bottomStyle = window.getComputedStyle(bottom);
        const activeTurn = document.querySelector('.player-card.active-turn')?.id;
        return {
          nameTop,
          nameBottom,
          activeTurn,
          topTransform: topStyle.transform,
          bottomTransform: bottomStyle.transform
        };
      })()
    `);
    console.log('Black turn state:', blackTurnStatus);

    if (blackTurnStatus.nameBottom !== 'Black' || blackTurnStatus.nameTop !== 'White') {
      throw new Error(`Names should have flipped to Black at bottom, got: bottom=${blackTurnStatus.nameBottom}, top=${blackTurnStatus.nameTop}`);
    }
    if (blackTurnStatus.topTransform.includes('matrix(-1') || blackTurnStatus.bottomTransform.includes('matrix(-1') ||
        blackTurnStatus.topTransform.includes('rotate') || blackTurnStatus.bottomTransform.includes('rotate')) {
      throw new Error('Rotation detected on Black turn! Cards must remain horizontal without spinning over chessboard.');
    }
    console.log('✓ Names flipped: Active player Black is at bottom, opponent White is at top!');
    console.log('✓ ZERO rotation confirmed on both cards! Pure horizontal placement.');

    await takeShot('test_zero_rot_2_black_turn.png');

    console.log('4. Executing Black move e5...');
    await evalJs(`
      (() => {
        const e7 = document.querySelector('[data-square="e7"]');
        const e5 = document.querySelector('[data-square="e5"]');
        if (e7) e7.click();
        if (e5) e5.click();
      })()
    `);

    await sleep(600);

    console.log('5. Checking White turn state (Names smoothly flipped back to White at bottom)...');
    const returnWhiteStatus = await evalJs(`
      (() => {
        const top = document.getElementById('player-top');
        const bottom = document.getElementById('player-bottom');
        const nameTop = document.getElementById('name-top')?.textContent;
        const nameBottom = document.getElementById('name-bottom')?.textContent;
        const topStyle = window.getComputedStyle(top);
        const bottomStyle = window.getComputedStyle(bottom);
        const activeTurn = document.querySelector('.player-card.active-turn')?.id;
        return {
          nameTop,
          nameBottom,
          activeTurn,
          topTransform: topStyle.transform,
          bottomTransform: bottomStyle.transform
        };
      })()
    `);
    console.log('Returned White turn state:', returnWhiteStatus);

    if (returnWhiteStatus.nameBottom !== 'White' || returnWhiteStatus.nameTop !== 'Black') {
      throw new Error(`Names should have flipped back to White at bottom, got: bottom=${returnWhiteStatus.nameBottom}, top=${returnWhiteStatus.nameTop}`);
    }
    if (returnWhiteStatus.topTransform.includes('matrix(-1') || returnWhiteStatus.bottomTransform.includes('matrix(-1')) {
      throw new Error('Rotation detected! Cards must remain horizontal without spinning.');
    }
    console.log('✓ Names flipped back smoothly to White at bottom!');
    console.log('✓ ZERO rotation confirmed!');

    await takeShot('test_zero_rot_3_white_turn.png');

    console.log('--- ALL ZERO-ROTATION NAME FLIP TESTS PASSED 100% ---');
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
