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
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost:8089');
  let filePath = path.join(__dirname, '..', parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

async function run() {
  await new Promise(r => server.listen(8089, r));
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\af9d4bae-af3a-429e-b1cc-8a6a595bbb85';

  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9555',
    '--disable-gpu',
    '--hide-scrollbars',
    'http://localhost:8089/index.html'
  ]);

  await new Promise(r => setTimeout(r, 1200));
  const list = await (await fetch('http://localhost:9555/json')).json();
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let idCounter = 1;
  function sendCdp(method, params = {}) {
    return new Promise(resolve => {
      const id = idCounter++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) { ws.removeEventListener('message', handler); resolve(msg.result); }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Set Mobile Viewport (360 x 740)
  await sendCdp('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 740,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 800));

  // Evaluate directly
  const evalRes = await sendCdp('Runtime.evaluate', {
    expression: `(() => {
      const mp = document.getElementById("btn-multiplayer");
      const st = document.getElementById("btn-mp-status");
      const pf = document.getElementById("btn-pieceflip");
      const af = document.getElementById("btn-autoflip");
      const hi = document.getElementById("btn-history");
      const rect = mp.getBoundingClientRect();
      const rectHi = hi.getBoundingClientRect();
      return {
        mpLeft: Math.round(rect.left),
        mpWidth: Math.round(rect.width),
        mpVisibleOnScreen: rect.left >= 0,
        historyRight: Math.round(rectHi.right),
        pfText: pf.innerText.trim(),
        afText: af.innerText.trim()
      };
    })()`,
    returnByValue: true
  });

  console.log('Mobile Check Results on 360px viewport:', evalRes.result.value);

  // Take screenshot of mobile 360px header
  const res1 = await sendCdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'verified_mobile_360_header.png'), Buffer.from(res1.data, 'base64'));
  console.log('Saved verified_mobile_360_header.png');

  ws.close();
  edge.kill();
  server.close();
  process.exit(0);
}
run();
