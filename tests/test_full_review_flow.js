const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost:8095');
  let filePath = path.join(__dirname, '..', parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function run() {
  await new Promise(r => server.listen(8095, r));
  console.log('Test server listening on 8095');

  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9453',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=375,812',
    'http://localhost:8095/index.html'
  ]);

  let connected = false;
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const list = await fetchJson('http://localhost:9453/json');
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        connected = true;
        break;
      }
    } catch (e) {}
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
    fs.writeFileSync(path.join('C:\\Users\\DELL\\.gemini\\antigravity\\brain\\af9d4bae-af3a-429e-b1cc-8a6a595bbb85', filename), buffer);
    console.log('Saved screenshot:', filename);
  }

  await sendCdp('Page.enable');
  await sendCdp('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  });

  await sleep(1500);

  console.log('1. Playing Scholar Mate moves...');
  // Play Scholar's mate moves via user square clicks or direct moves
  const moveResult = await evalJs(`
    (() => {
      const moves = [
        { from: 'e2', to: 'e4' },
        { from: 'e7', to: 'e5' },
        { from: 'f1', to: 'c4' },
        { from: 'b8', to: 'c6' },
        { from: 'd1', to: 'h5' },
        { from: 'g8', to: 'f6' },
        { from: 'h5', to: 'f7' }
      ];

      for (const m of moves) {
        document.querySelector('[data-square="' + m.from + '"]').click();
        document.querySelector('[data-square="' + m.to + '"]').click();
      }

      return {
        isGameOver: document.getElementById('game-over-modal').style.display !== 'none' || Boolean(document.getElementById('review-modal')),
        historyLength: document.querySelectorAll('.history-row').length
      };
    })()
  `);
  console.log('Move execution:', moveResult);

  // Allow checkmate check & auto review trigger
  await sleep(600);

  // Take screenshot of Calculating modal
  await takeShot('review_modal_step1_calculating.png');

  console.log('2. Waiting for Game Review calculation to complete...');
  let completed = false;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const resultsVisible = await evalJs(`document.getElementById('review-results-state').style.display !== 'none'`);
    if (resultsVisible) {
      completed = true;
      break;
    }
  }

  if (!completed) {
    throw new Error('Game Review analysis did not complete within timeout');
  }

  const whiteAcc = await evalJs(`document.getElementById('review-acc-w').textContent`);
  const blackAcc = await evalJs(`document.getElementById('review-acc-b').textContent`);
  console.log(`✓ Analysis complete! White Accuracy: ${whiteAcc}, Black Accuracy: ${blackAcc}`);

  const counts = await evalJs(`({
    brilliantW: document.getElementById('count-w-brilliant').textContent,
    blunderB: document.getElementById('count-b-blunder').textContent
  })`);
  console.log('✓ Classifications:', counts);

  await takeShot('review_modal_step2_results.png');

  console.log('3. Clicking "Review Moves on Board"...');
  await evalJs(`document.getElementById('btn-review-inspect').click()`);
  await sleep(400);

  const bannerText = await evalJs(`document.getElementById('review-banner-info').textContent`);
  console.log('✓ On-board Review banner text:', bannerText);

  await takeShot('review_modal_step3_board_inspection.png');

  console.log('--- ALL GAME REVIEW FLOW TESTS PASSED! ---');
  edge.kill();
  server.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
