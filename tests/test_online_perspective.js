const assert = require('assert');
global.window = global;
global.WebSocket = WebSocket;
global.location = { href: 'http://localhost:8080/index.html' };
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => storage[k] = String(v),
  removeItem: (k) => delete storage[k],
  clear: () => {}
};

require('../js/paho-mqtt.min.js');
require('../js/multiplayer.js');

console.log('--- Testing Online Perspective & Board Orientation Rules ---');

// Test Host selects Black (Host is Black, Guest is White)
const host = new ChessMultiplayer();
host.createRoom('b');
assert.strictEqual(host.myColor, 'b', 'Host should be Black');
assert.strictEqual(host.assignedGuestColor, 'w', 'Guest should be White');

// Test Host selects White (Host is White, Guest is Black)
const host2 = new ChessMultiplayer();
host2.createRoom('w');
assert.strictEqual(host2.myColor, 'w', 'Host should be White');
assert.strictEqual(host2.assignedGuestColor, 'b', 'Guest should be Black');

host.disconnect();
host2.disconnect();

console.log('✓ Color role assignment rules verified');
console.log('--- ALL PERSPECTIVE TESTS PASSED! ---');
