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

  // Wait for initial page load
  await sleep(1200);
  const readyState = await evalJs('document.readyState');
  console.log('Page readyState:', readyState);

  console.log('--- Step 1: Testing Custom button in modal ---');
  // Open modal
  await evalJs('document.getElementById("btn-timer").click()');
  await sleep(500);
  
  // Click Custom button for White
  await evalJs('document.querySelector(\'.timer-presets[data-player="w"] [data-time="custom"]\').click()');
  await sleep(300);

  const customRowVisible = await evalJs('document.getElementById("timer-custom-row-w").style.display === "flex"');
  const customPillActive = await evalJs('document.querySelector(\'.timer-presets[data-player="w"] [data-time="custom"]\').classList.contains("active")');
  const initialMins = await evalJs('document.getElementById("stepper-val-w").textContent');

  console.log('Custom row visible:', customRowVisible);
  console.log('Custom pill active:', customPillActive);
  console.log('Custom minutes initial:', initialMins);

  if (!customRowVisible || !customPillActive) {
    throw new Error('Custom button did not open stepper row or activate pill!');
  }

  // Increment stepper by 2
  await evalJs('document.getElementById("stepper-inc-w").click()');
  await sleep(100);
  await evalJs('document.getElementById("stepper-inc-w").click()');
  await sleep(100);
  const updatedMins = await evalJs('document.getElementById("stepper-val-w").textContent');
  console.log('Custom minutes after +2:', updatedMins);

  // Take screenshot of Custom mode in action
  await takeShot('modal_custom_stepper_active.png');

  // Apply timers
  await evalJs('document.getElementById("btn-apply-timer").click()');
  await sleep(300);

  const timerSummary = await evalJs('document.getElementById("timer-pill-label").textContent');
  console.log('Timer summary label after custom apply:', timerSummary);

  console.log('--- Step 2: Testing Mid-Game Timer Lock ---');
  // Play e2 to e4
  await evalJs('document.querySelector(\'[data-square="e2"]\').click()');
  await sleep(200);
  await evalJs('document.querySelector(\'[data-square="e4"]\').click()');
  await sleep(400);

  // Attempt to open timer modal mid-game
  await evalJs('document.getElementById("btn-timer").click()');
  await sleep(200);

  const modalOpenAttempt = await evalJs('document.getElementById("timer-modal").style.display === "flex"');
  const toastVisible = await evalJs('document.getElementById("toast").classList.contains("visible")');
  const toastText = await evalJs('document.getElementById("toast").textContent');

  console.log('Modal opened mid-game (should be false):', modalOpenAttempt);
  console.log('Toast visible (should be true):', toastVisible);
  console.log('Toast text:', toastText);

  if (modalOpenAttempt || !toastVisible) {
    throw new Error('Mid-game timer lock failed! Modal was opened or toast was not shown.');
  }

  // Take screenshot of toast notification
  await takeShot('gameplay_timer_locked_toast.png');

  console.log('--- Step 3: Testing Reset / Restart Re-unlocks Timer ---');
  // Click Reset (startNewGame)
  await evalJs('startNewGame()');
  await sleep(300);

  // Attempt to open timer modal after reset
  await evalJs('document.getElementById("btn-timer").click()');
  await sleep(200);

  const modalOpenAfterReset = await evalJs('document.getElementById("timer-modal").style.display === "flex"');
  console.log('Modal opened after reset (should be true):', modalOpenAfterReset);

  if (!modalOpenAfterReset) {
    throw new Error('Timer customization was not unlocked after game reset!');
  }

  console.log('--- Step 4: Testing Last 10 Seconds Red Clock Styling & Countdown ---');
  // Set White to 8 seconds, Black to 8 seconds
  await evalJs('setModalPlayerTime("w", 8, true); setModalPlayerTime("b", 8, true); applyTimerSettings();');
  await sleep(300);

  // Play e2 to e4 so clock starts ticking for Black
  await evalJs('document.querySelector(\'[data-square="e2"]\').click()');
  await sleep(200);
  await evalJs('document.querySelector(\'[data-square="e4"]\').click()');
  await sleep(900);

  const blackClockHasRed = await evalJs('document.getElementById("clock-top").classList.contains("critical-time")');
  const blackClockText = await evalJs('document.getElementById("clock-top").textContent');
  console.log('Black clock has critical-time class (red):', blackClockHasRed);
  console.log('Black clock countdown reading:', blackClockText);

  if (!blackClockHasRed) {
    throw new Error('Clock did not receive critical-time class in last 10 seconds!');
  }

  // Take screenshot of red clock
  await takeShot('gameplay_last_10s_red_clock.png');

  ws.close();
  edge.kill();
  console.log('--- ALL AUTOMATED VERIFICATIONS PASSED SUCCESSFULLY! ---');
}

run().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
