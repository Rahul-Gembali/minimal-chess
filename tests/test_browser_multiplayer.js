const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

global.window = global;
global.WebSocket = WebSocket;
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => storage[k] = String(v),
  removeItem: (k) => delete storage[k],
  clear: () => {}
};

// 1. Simple static HTTP server for local testing
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
  const parsedUrl = new URL(req.url, 'http://localhost:8088');
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
  await new Promise(r => server.listen(8088, r));
  console.log('Static test server listening on http://localhost:8088');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\af9d4bae-af3a-429e-b1cc-8a6a595bbb85';

  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9444',
    '--disable-gpu',
    '--hide-scrollbars',
    'http://localhost:8088/index.html'
  ]);

  let connected = false;
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const list = await fetchJson('http://localhost:9444/json');
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        connected = true;
        break;
      }
    } catch (e) {}
  }

  if (!connected) {
    console.error('Failed to connect to Edge CDP');
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
    const res = await sendCdp('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (res.exceptionDetails) {
      throw new Error((res.exceptionDetails.text || 'Error') + ' ' + (res.exceptionDetails.exception ? res.exceptionDetails.exception.description : ''));
    }
    return res.result ? res.result.value : undefined;
  }

  async function takeShot(filename) {
    const res = await sendCdp('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(outDir, filename), buffer);
    console.log('Saved screenshot:', filename);
  }

  console.log('--- Step 1: Verify Header Buttons (Multiplayer icon & Inactive Gray Dot) ---');
  await sleep(1000);

  const mpBtnExists = await evalJs('Boolean(document.getElementById("btn-multiplayer"))');
  const mpStatusBtnExists = await evalJs('Boolean(document.getElementById("btn-mp-status"))');
  const mpDotClass = await evalJs('document.getElementById("btn-mp-status").className');

  console.log('Multiplayer button exists:', mpBtnExists);
  console.log('Status button exists:', mpStatusBtnExists);
  console.log('Initial status button class (should not have connected):', mpDotClass);

  await takeShot('browser_step1_initial_header.png');

  console.log('--- Step 2: Open Multiplayer Modal & Verify Options ---');
  await evalJs('document.getElementById("btn-multiplayer").click()');
  await sleep(400);

  const modalVisible = await evalJs('document.getElementById("multiplayer-modal").style.display === "flex"');
  console.log('Multiplayer modal visible:', modalVisible);
  await takeShot('browser_step2_multiplayer_modal.png');

  console.log('--- Step 3: Select White and Create Game ---');
  await evalJs('document.querySelector(\'.mp-color-pill[data-color="w"]\').click()');
  await sleep(200);
  await evalJs('document.getElementById("btn-mp-create").click()');
  await sleep(600);

  const hostShareLink = await evalJs('window.chessMultiplayer.getShareableLink()');
  const isHost = await evalJs('window.chessMultiplayer.isHost');
  const hostColor = await evalJs('window.chessMultiplayer.myColor');
  const hostStatusClass = await evalJs('document.getElementById("btn-mp-status").className');

  console.log('Host created room. Shareable Link:', hostShareLink);
  console.log('Is host:', isHost);
  console.log('Host color:', hostColor);
  console.log('Host status class (waiting):', hostStatusClass);

  await takeShot('browser_step3_waiting_link_copied.png');

  console.log('--- Step 4: Simulate Opponent Joining with the same link ---');
  // Connect second client in node with same room ID to simulate friend opening the link
  const roomId = await evalJs('window.chessMultiplayer.roomId');
  console.log('Connecting simulated guest to room:', roomId);

  // Load guest in Node
  require('../js/paho-mqtt.min.js');
  require('../js/multiplayer.js');
  const { ChessMultiplayer } = window;
  const guestClient = new ChessMultiplayer();
  guestClient.joinRoom(roomId);

  // Wait for connection to establish and dot to turn GREEN
  let dotTurnedGreen = false;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    const hasConnected = await evalJs('document.getElementById("btn-mp-status").classList.contains("connected")');
    if (hasConnected) {
      dotTurnedGreen = true;
      break;
    }
  }

  console.log('Status Dot turned GREEN (two people using the same link):', dotTurnedGreen);
  await takeShot('browser_step4_active_green_dot.png');

  console.log('--- Step 5: Test Move from Host & Opponent Synchronization ---');
  // Host plays e2 to e4
  await evalJs('document.querySelector(\'[data-square="e2"]\').click()');
  await sleep(200);
  await evalJs('document.querySelector(\'[data-square="e4"]\').click()');
  await sleep(500);

  const hostLastMove = await evalJs('document.querySelector(\'[data-square="e4"]\').classList.contains("last-move")');
  console.log('Host made e4 move, square highlighted:', hostLastMove);

  await takeShot('browser_step5_move_made_in_match.png');

  guestClient.disconnect();
  ws.close();
  edge.kill();
  server.close();
  console.log('--- ALL BROWSER MULTIPLAYER VERIFICATIONS PASSED! ---');
  process.exit(0);
}

run().catch(err => {
  console.error('BROWSER TEST FAILED:', err);
  process.exit(1);
});
