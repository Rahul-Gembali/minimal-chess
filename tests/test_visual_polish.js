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
  const parsedUrl = new URL(req.url, 'http://localhost:8096');
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
  await new Promise(r => server.listen(8096, r));
  console.log('Test server listening on 8096');

  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9454',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=375,812',
    'http://localhost:8096/index.html'
  ]);

  let connected = false;
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const list = await fetchJson('http://localhost:9454/json');
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

  await sleep(1000);

  // 1. Initial mobile header & board (Light mode)
  await takeShot('polished_mobile_header_light.png');

  // 2. Open Timer Modal
  await evalJs(`document.getElementById('btn-timer').click()`);
  await sleep(400);
  await takeShot('polished_timer_modal_light.png');
  await evalJs(`document.getElementById('btn-cancel-timer').click()`);
  await sleep(300);

  // 3. Open Multiplayer Modal
  await evalJs(`document.getElementById('btn-multiplayer').click()`);
  await sleep(400);
  await takeShot('polished_multiplayer_modal_light.png');
  await evalJs(`document.getElementById('btn-mp-cancel').click()`);
  await sleep(300);

  // 4. Switch to Dark Mode
  await evalJs(`document.getElementById('btn-theme').click()`);
  await sleep(500);
  await takeShot('polished_mobile_header_dark.png');

  // 5. Open Timer Modal in Dark Mode
  await evalJs(`document.getElementById('btn-timer').click()`);
  await sleep(400);
  await takeShot('polished_timer_modal_dark.png');
  await evalJs(`document.getElementById('btn-cancel-timer').click()`);
  await sleep(300);

  // 6. Test on desktop width (480x850)
  await sendCdp('Emulation.setDeviceMetricsOverride', {
    width: 480,
    height: 850,
    deviceScaleFactor: 2,
    mobile: false
  });
  await sleep(500);
  await takeShot('polished_desktop_view_dark.png');

  console.log('--- ALL VISUAL POLISH SCREENSHOTS CAPTURED SUCCESSFULLY! ---');
  edge.kill();
  server.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
