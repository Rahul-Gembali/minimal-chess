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
  const parsedUrl = new URL(req.url, 'http://localhost:8092');
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
  await new Promise(r => server.listen(8092, r));
  console.log('Server listening on 8092');

  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9450',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=375,812',
    'http://localhost:8092/index.html'
  ]);

  let connected = false;
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const list = await fetchJson('http://localhost:9450/json');
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
    const res = await sendCdp('Runtime.evaluate', { expression: expr, returnByValue: true });
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

  await sleep(1500); // Allow full DOM & CSS rendering

  // 1. Open modal
  await evalJs("document.getElementById('btn-multiplayer').click()");
  await sleep(400);

  // 2. Select 3m
  await evalJs("document.querySelector('#mp-timer-presets [data-time=\"180\"]').click()");
  await sleep(300);

  const activePill3m = await evalJs("document.querySelector('#mp-timer-presets .active').dataset.time");
  console.log('Active pill after 3m click:', activePill3m);
  await takeShot('browser_mp_modal_3m_active.png');

  // 3. Select Custom & Stepper
  await evalJs("document.querySelector('#mp-timer-presets [data-time=\"custom\"]').click()");
  await sleep(300);
  await evalJs("document.getElementById('mp-stepper-inc').click()");
  await evalJs("document.getElementById('mp-stepper-inc').click()");
  const stepperVal = await evalJs("document.getElementById('mp-stepper-val').textContent");
  console.log('Custom stepper value:', stepperVal);
  await takeShot('browser_mp_modal_custom_7m_active.png');

  // 4. Click Create & Copy Link and verify clocks update to 7m (7:00) on the live board!
  await evalJs("document.getElementById('btn-mp-create').click()");
  await sleep(400);

  const clockBottomText = await evalJs("document.getElementById('clock-bottom').textContent.trim()");
  const clockTopText = await evalJs("document.getElementById('clock-top').textContent.trim()");
  console.log('Live Clock Bottom:', clockBottomText);
  console.log('Live Clock Top:', clockTopText);
  await takeShot('browser_mp_live_board_with_7m_clocks.png');

  edge.kill();
  server.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
