const assert = require('assert');
const { Chess } = require('../js/chess.js');

console.log('--- Running Chess Engine & Logic Tests ---');

// 1. Double pawn advance & single pawn advance
{
  const game = new Chess();
  const e2Moves = game.moves({ square: 'e2', verbose: true });
  assert.strictEqual(e2Moves.length, 2, 'e2 pawn should have 2 moves initially (e3, e4)');
  const destinations = e2Moves.map(m => m.to).sort();
  assert.deepStrictEqual(destinations, ['e3', 'e4'], 'e2 pawn should move to e3 or e4');
  console.log('✓ Initial pawn moves verified');
}

// 2. Scholar's Mate (White wins by Checkmate)
{
  const game = new Chess();
  game.move('e4');
  game.move('e5');
  game.move('Qh5');
  game.move('Nc6');
  game.move('Bc4');
  game.move('Nf6');
  game.move('Qxf7#');

  assert.strictEqual(game.in_checkmate(), true, 'Game should be in checkmate');
  assert.strictEqual(game.turn(), 'b', 'Turn should be black, meaning White delivered checkmate');
  console.log("✓ Scholar's Mate (White won by checkmate) verified");
}

// 3. Fool's Mate (Black wins by Checkmate)
{
  const game = new Chess();
  game.move('f3');
  game.move('e5');
  game.move('g4');
  game.move('Qh4#');

  assert.strictEqual(game.in_checkmate(), true, 'Game should be in checkmate');
  assert.strictEqual(game.turn(), 'w', 'Turn should be white, meaning Black delivered checkmate');
  console.log("✓ Fool's Mate (Black won by checkmate) verified");
}

// 4. En Passant
{
  const game = new Chess();
  game.move('e4');
  game.move('a6');
  game.move('e5');
  game.move('d5');
  
  const moves = game.moves({ square: 'e5', verbose: true });
  const epMove = moves.find(m => m.flags.includes('e'));
  assert.ok(epMove, 'En passant move should be available for white on d6');
  assert.strictEqual(epMove.to, 'd6');
  game.move('exd6');
  assert.strictEqual(game.get('d5'), null, 'Captured black pawn on d5 should be removed');
  assert.strictEqual(game.get('d6').type, 'p', 'White pawn should now be on d6');
  console.log('✓ En Passant mechanics verified');
}

// 5. Castling Kingside
{
  const game = new Chess();
  game.move('e4'); game.move('e5');
  game.move('Nf3'); game.move('Nc6');
  game.move('Bc4'); game.move('Bc5');
  const castleMove = game.moves({ square: 'e1', verbose: true }).find(m => m.flags.includes('k'));
  assert.ok(castleMove, 'White should be able to castle kingside (O-O)');
  game.move('O-O');
  assert.strictEqual(game.get('g1').type, 'k', 'White king should be on g1');
  assert.strictEqual(game.get('f1').type, 'r', 'White rook should be on f1');
  console.log('✓ Castling verified');
}

// 6. Pawn Promotion
{
  const game = new Chess('8/4P3/8/8/8/8/8/4K2k w - - 0 1');
  const promoMoves = game.moves({ square: 'e7', verbose: true });
  assert.strictEqual(promoMoves.length, 4, 'Pawn on 7th rank should have 4 promotion options (q, r, b, n)');
  game.move({ from: 'e7', to: 'e8', promotion: 'q' });
  assert.strictEqual(game.get('e8').type, 'q', 'Promoted piece should be queen');
  console.log('✓ Pawn Promotion verified');
}

// 7. Stalemate
{
  const staleGame = new Chess('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1');
  assert.strictEqual(staleGame.in_check(), false, 'Black king is not in check');
  assert.strictEqual(staleGame.in_stalemate(), true, 'Black is in stalemate');
  console.log('✓ Stalemate verified');
}

// 8. Material Advantage Calculation (Chess.com style)
{
  const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function calculateAdvantage(history) {
    let whiteScore = 0;
    let blackScore = 0;
    for (const move of history) {
      if (move.captured) {
        const val = PIECE_VALUES[move.captured] || 0;
        if (move.color === 'w') {
          whiteScore += val;
        } else {
          blackScore += val;
        }
      }
    }
    const diff = whiteScore - blackScore;
    return {
      whiteScore,
      blackScore,
      whiteAdvantage: diff > 0 ? diff : 0,
      blackAdvantage: diff < 0 ? Math.abs(diff) : 0,
    };
  }

  const game = new Chess();
  game.move('e4'); game.move('d5');
  game.move('exd5'); // White captures pawn (+1)
  game.move('Qxd5'); // Black captures pawn (+1)
  game.move('Nf3');  // White knight to f3
  game.move('Qe6+'); // Black queen to e6
  
  let adv = calculateAdvantage(game.history({ verbose: true }));
  assert.strictEqual(adv.whiteAdvantage, 0);
  assert.strictEqual(adv.blackAdvantage, 0);

  // Black makes a blunder move:
  game.move('Be2');
  game.move('a6');
  // White castles
  game.move('O-O');
  game.move('h6');
  // Re1 pins queen to king
  game.move('Re1');
  game.move('Qg6');
  // Bd3
  game.move('Bd3');
  game.move('Qh5');
  // h3
  game.move('h3');
  game.move('Bxh3'); // Black captures pawn (+1)
  game.move('gxh3'); // White captures bishop (+3)
  // Let's test capture of Queen
  // Instead of long sequence, let's test directly with a simple FEN position where White can capture black queen!
  const captureGame = new Chess('rnb1kbnr/pppp1ppp/8/4q3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
  // White queen captures black queen on e5
  // wait, White d1 Queen can capture on e5 if d-pawn moved or Qe2/d4
  const testFen = new Chess('4k3/8/8/4q3/4Q3/8/8/4K3 w - - 0 1');
  testFen.move('Qxe5+'); // captures Queen!
  adv = calculateAdvantage(testFen.history({ verbose: true }));
  assert.strictEqual(adv.whiteScore, 9);
  assert.strictEqual(adv.blackScore, 0);
  assert.strictEqual(adv.whiteAdvantage, 9);
  assert.strictEqual(adv.blackAdvantage, 0);
  console.log('✓ Material Advantage (+9) verified');
}

console.log('--- ALL TESTS PASSED! ---');
