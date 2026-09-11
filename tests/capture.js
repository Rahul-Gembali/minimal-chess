const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\eede4d2e-5d34-408e-b70b-d2692150e32c';
  
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9333',
    '--disable-gpu',
    '--hide-scrollbars',
    'http://localhost:8085/index.html'
  ]);

  let connected = false;
  let wsUrl = '';
  for (let i = 0; i < 30; i++) {
    await sleep(300);
    try {
      const list = await fetchJson('http://localhost:9333/json');
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

  async function takeShot(filename) {
    const res = await sendCdp('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(outDir, filename), buffer);
    console.log('Saved:', filename);
  }

  // 1. Mobile (390 x 844) Viewport
  await sendCdp('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(600);
  await takeShot('mobile_verified_gameplay.png');

  // Open timer modal on mobile
  await sendCdp('Runtime.evaluate', { expression: 'document.getElementById("btn-timer").click()' });
  await sleep(400);
  await takeShot('mobile_verified_timer_modal.png');

  // Close modal
  await sendCdp('Runtime.evaluate', { expression: 'document.getElementById("btn-cancel-timer").click()' });
  await sleep(300);

  // 2. Desktop (1280 x 720) Viewport
  await sendCdp('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(600);
  await takeShot('desktop_verified_gameplay.png');

  // Open timer modal on desktop
  await sendCdp('Runtime.evaluate', { expression: 'document.getElementById("btn-timer").click()' });
  await sleep(400);
  await takeShot('desktop_verified_timer_modal.png');

  // Set 3m timer and make move
  await sendCdp('Runtime.evaluate', { expression: 'document.querySelector(\'.timer-presets[data-player="w"] [data-time="180"]\').click(); document.getElementById("btn-apply-timer").click();' });
  await sleep(400);
  // Play e2 to e4
  await sendCdp('Runtime.evaluate', { expression: 'document.querySelector(\'[data-square="e2"]\').click();' });
  await sleep(300);
  await sendCdp('Runtime.evaluate', { expression: 'document.querySelector(\'[data-square="e4"]\').click();' });
  await sleep(1500);
  await takeShot('desktop_verified_active_countdown.png');

  // Toggle dark mode
  await sendCdp('Runtime.evaluate', { expression: 'document.getElementById("btn-theme").click()' });
  await sleep(500);
  await takeShot('desktop_verified_dark_countdown.png');

  ws.close();
  edge.kill();
  console.log('Done all captures!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
