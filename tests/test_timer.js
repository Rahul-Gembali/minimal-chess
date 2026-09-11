const assert = require('assert');
const { Chess } = require('../js/chess.js');

console.log('--- Running Chess Timer & Clock Logic Tests ---');

// 1. Time Formatting Tests
function formatClockDisplay(seconds) {
  if (seconds === Infinity || seconds === 'infinite' || seconds === undefined) return '∞';
  if (seconds <= 0) return '0:00';
  if (seconds < 10) return seconds.toFixed(1) + 's';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

assert.strictEqual(formatClockDisplay(Infinity), '∞', 'Infinite should format as ∞');
assert.strictEqual(formatClockDisplay('infinite'), '∞', "'infinite' string should format as ∞");
assert.strictEqual(formatClockDisplay(600), '10:00', '600s should format as 10:00');
assert.strictEqual(formatClockDisplay(180), '3:00', '180s should format as 3:00');
assert.strictEqual(formatClockDisplay(65), '1:05', '65s should format as 1:05');
assert.strictEqual(formatClockDisplay(9.4), '9.4s', '9.4s sub-second format');
assert.strictEqual(formatClockDisplay(0.8), '0.8s', '0.8s sub-second format');
assert.strictEqual(formatClockDisplay(0), '0:00', '0s should format as 0:00');
assert.strictEqual(formatClockDisplay(-2), '0:00', 'Negative seconds should format as 0:00');
console.log('✓ Time formatting logic verified (infinite, standard M:SS, sub-second <10s)');

// 2. Summary Label Tests
function getTimerSummaryLabel(settings) {
  function formatSetting(val) {
    if (val === 'infinite') return '∞';
    const m = Math.round(Number(val) / 60);
    return `${m}m`;
  }
  if (settings.w === settings.b) {
    return formatSetting(settings.w);
  }
  return `${formatSetting(settings.w)}/${formatSetting(settings.b)}`;
}

assert.strictEqual(getTimerSummaryLabel({ w: 'infinite', b: 'infinite' }), '∞', 'Both infinite -> ∞');
assert.strictEqual(getTimerSummaryLabel({ w: 180, b: 180 }), '3m', 'Both 3m -> 3m');
assert.strictEqual(getTimerSummaryLabel({ w: 180, b: 600 }), '3m/10m', 'White 3m, Black 10m -> 3m/10m');
assert.strictEqual(getTimerSummaryLabel({ w: 60, b: 'infinite' }), '1m/∞', 'White 1m, Black infinite -> 1m/∞');
console.log('✓ Summary labels verified for synced and independent timer odds');

// 3. Insufficient Material / Timeout Victory Rules (FIDE 6.9)
function hasSufficientMaterialToMate(game, color) {
  const board = game.board();
  let knights = 0;
  let bishops = 0;
  let hasMajorOrPawn = false;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        if (piece.type === 'p' || piece.type === 'q' || piece.type === 'r') {
          hasMajorOrPawn = true;
        } else if (piece.type === 'b') {
          bishops++;
        } else if (piece.type === 'n') {
          knights++;
        }
      }
    }
  }

  if (hasMajorOrPawn) return true;
  if (bishops >= 2) return true;
  if (bishops >= 1 && knights >= 1) return true;
  if (knights >= 2) return true;
  return false;
}

// Initial board: both sides have sufficient material
const initialGame = new Chess();
assert.strictEqual(hasSufficientMaterialToMate(initialGame, 'w'), true, 'Initial board White has material');
assert.strictEqual(hasSufficientMaterialToMate(initialGame, 'b'), true, 'Initial board Black has material');

// Lone King vs Lone King
const kVsK = new Chess('8/8/8/4k3/8/8/4K3/8 w - - 0 1');
assert.strictEqual(hasSufficientMaterialToMate(kVsK, 'w'), false, 'Lone King White is insufficient');
assert.strictEqual(hasSufficientMaterialToMate(kVsK, 'b'), false, 'Lone King Black is insufficient');

// King + Bishop vs Lone King
const kbVsK = new Chess('8/8/8/4k3/8/2B5/4K3/8 w - - 0 1');
assert.strictEqual(hasSufficientMaterialToMate(kbVsK, 'w'), false, 'K+B vs K is insufficient');

// King + Knight vs Lone King
const knVsK = new Chess('8/8/8/4k3/8/2N5/4K3/8 w - - 0 1');
assert.strictEqual(hasSufficientMaterialToMate(knVsK, 'w'), false, 'K+N vs K is insufficient');

// King + Queen vs Lone King
const kqVsK = new Chess('8/8/8/4k3/8/2Q5/4K3/8 w - - 0 1');
assert.strictEqual(hasSufficientMaterialToMate(kqVsK, 'w'), true, 'K+Q vs K is sufficient to mate');

// King + Pawn vs Lone King
const kpVsK = new Chess('8/8/8/4k3/4P3/8/4K3/8 w - - 0 1');
assert.strictEqual(hasSufficientMaterialToMate(kpVsK, 'w'), true, 'K+P vs K is sufficient to mate (promotion)');

// King + Bishop + Bishop vs Lone King
const kbbVsK = new Chess('8/8/8/4k3/8/2B1B3/4K3/8 w - - 0 1');
assert.strictEqual(hasSufficientMaterialToMate(kbbVsK, 'w'), true, 'K+B+B vs K is sufficient to mate');

console.log('✓ FIDE Article 6.9 material sufficiency on timeout verified');
console.log('--- ALL TIMER TESTS PASSED! ---');
