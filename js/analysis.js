/**
 * MINIMAL CHESS — Game Review & Move Analysis Engine
 * Uses in-browser Stockfish Web Worker for zero-server, zero-budget game analysis.
 * Classifies moves into: Brilliant (💎), Best (🎯), Good (👍), Book (📖), Inaccuracy (❓), Mistake (❓❓), Blunder (❌).
 */

(function () {
  'use strict';

  // Standard opening book dictionary (move sequences mapped to acceptable replies)
  const OPENING_BOOK = {
    "": ["e2e4", "d2d4", "c2c4", "g1f3", "g2g3", "b2b3", "f2f4", "d2d3", "b1c3"],
    "e2e4": ["e7e5", "c7c5", "e7e6", "c7c6", "d7d5", "g8f6", "d7d6", "g7g6"],
    "d2d4": ["d7d5", "g8f6", "e7e6", "f7f5", "c7c5", "g7g6"],
    "c2c4": ["e7e5", "c7c5", "g8f6", "e7e6"],
    "g1f3": ["d7d5", "g8f6", "c7c5"],
    "e2e4 e7e5": ["g1f3", "f2f4", "b1c3", "d2d4", "f1c4"],
    "e2e4 e7e5 g1f3": ["b8c6", "g8f6", "d7d6", "f7f5"],
    "e2e4 e7e5 g1f3 b8c6": ["f1b5", "f1c4", "d2d4", "b1c3", "c2c3"],
    "e2e4 e7e5 g1f3 b8c6 f1b5": ["a7a6", "g8f6", "f8c5", "d7d6", "f7f5", "g7g6"],
    "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6": ["b5a4", "b5c6"],
    "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4": ["g8f6", "d7d6", "b7b5"],
    "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6": ["e1g1", "d2d3", "b1c3"],
    "e2e4 e7e5 g1f3 b8c6 f1c4": ["f8c5", "g8f6", "f8e7", "d7d6"],
    "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5": ["c2c3", "d2d3", "b2b4", "e1g1", "d2d4"],
    "e2e4 e7e5 f1c4": ["g8f6", "b8c6", "f8c5", "c7c6", "d7d6"],
    "e2e4 e7e5 f1c4 g8f6": ["d2d3", "b1c3", "g1f3"],
    "e2e4 e7e5 f1c4 b8c6": ["g1f3", "d2d4", "b1c3", "c2c3", "d1h5"],
    "e2e4 e7e5 f1c4 f8c5": ["c2c3", "d2d3", "g1f3", "d1h5"],
    "e2e4 c7c5": ["g1f3", "b1c3", "c2c3", "d2d4", "f2f4", "g2g3"],
    "e2e4 c7c5 g1f3": ["d7d6", "b8c6", "e7e6", "g7g6", "a7a6"],
    "e2e4 c7c5 g1f3 d7d6": ["d2d4", "f1b5", "c2c3"],
    "e2e4 c7c5 g1f3 d7d6 d2d4": ["c5d4"],
    "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4": ["f3d4"],
    "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4": ["g8f6"],
    "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6": ["b1c3"],
    "e2e4 e7e6": ["d2d4", "d2d3", "c2c4"],
    "e2e4 e7e6 d2d4": ["d7d5"],
    "e2e4 e7e6 d2d4 d7d5": ["b1c3", "e4e5", "e4d5", "b1d2"],
    "e2e4 c7c6": ["d2d4", "b1c3", "g1f3"],
    "e2e4 c7c6 d2d4": ["d7d5"],
    "e2e4 c7c6 d2d4 d7d5": ["e4e5", "b1c3", "e4d5"],
    "d2d4 d7d5": ["c2c4", "g1f3", "e2e3", "c1f4"],
    "d2d4 d7d5 c2c4": ["e7e6", "c7c6", "d5c4", "g8f6"],
    "d2d4 g8f6": ["c2c4", "g1f3", "c1g5", "c1f4"]
  };

  const PIECE_VALUES = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0
  };

  function toUci(move) {
    if (!move) return '';
    const promo = move.promotion ? move.promotion.toLowerCase() : '';
    return `${move.from}${move.to}${promo}`;
  }

  function centipawnsToWinPercent(cp) {
    if (cp === undefined || cp === null) return 50;
    // Standard Lichess centipawn to win-probability curve
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }

  function winLossToAccuracy(winLoss) {
    const loss = Math.max(0, winLoss);
    const raw = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
    return Math.min(100, Math.max(0, Math.round(raw * 10) / 10));
  }

  class ChessAnalysisEngine {
    constructor(workerPath = 'js/stockfish.js') {
      this.workerPath = workerPath;
      this.worker = null;
      this.isReady = false;
      this.isAnalyzing = false;
    }

    async initWorker() {
      if (this.worker && this.isReady) return this.worker;

      if (!this.worker) {
        try {
          this.worker = new Worker(this.workerPath);
        } catch (e) {
          this.worker = new Worker('./js/stockfish.js');
        }
      }

      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        const onInit = (e) => {
          const line = typeof e.data === 'string' ? e.data : '';
          if (line.includes('readyok')) {
            clearTimeout(timeout);
            this.worker.removeEventListener('message', onInit);
            this.isReady = true;
            resolve();
          }
        };
        this.worker.addEventListener('message', onInit);
        this.worker.postMessage('uci');
        this.worker.postMessage('isready');
      });

      return this.worker;
    }

    terminate() {
      if (this.worker) {
        try {
          this.worker.terminate();
        } catch (e) {}
        this.worker = null;
        this.isReady = false;
      }
      this.isAnalyzing = false;
    }

    /**
     * Evaluates a single FEN position using Stockfish
     */
    evaluatePosition(fen, depth = 7) {
      return new Promise(async (resolve) => {
        const worker = await this.initWorker();
        if (!worker) {
          return resolve({ cp: 0, bestmove: null, mate: null });
        }

        // Check if FEN is terminal checkmate or draw
        if (typeof Chess !== 'undefined') {
          try {
            const c = new Chess(fen);
            if (c.in_checkmate()) {
              return resolve({ cp: -10000, mate: -1, bestmove: null });
            }
            if (c.in_draw() || c.in_stalemate()) {
              return resolve({ cp: 0, mate: null, bestmove: null });
            }
          } catch (e) {}
        }

        let latestCp = 0;
        let latestMate = null;
        let bestmove = null;

        const onMsg = (event) => {
          const line = typeof event.data === 'string' ? event.data : '';

          if (line.includes('score cp ')) {
            const match = line.match(/score cp (-?\d+)/);
            if (match) latestCp = parseInt(match[1], 10);
            latestMate = null;
          } else if (line.includes('score mate ')) {
            const match = line.match(/score mate (-?\d+)/);
            if (match) {
              latestMate = parseInt(match[1], 10);
              latestCp = latestMate > 0 ? 10000 - latestMate * 100 : -10000 - latestMate * 100;
            }
          }

          if (line.startsWith('bestmove')) {
            clearTimeout(timer);
            worker.removeEventListener('message', onMsg);
            const parts = line.split(' ');
            bestmove = parts[1] || null;
            resolve({ cp: latestCp, mate: latestMate, bestmove });
          }
        };

        const timer = setTimeout(() => {
          worker.removeEventListener('message', onMsg);
          resolve({ cp: latestCp, mate: latestMate, bestmove });
        }, 1200);

        worker.addEventListener('message', onMsg);
        worker.postMessage('stop');
        worker.postMessage('position fen ' + fen);
        worker.postMessage('go depth ' + depth);
      });
    }

    /**
     * Full game review: analyzes every move, calculates accuracy, and awards classifications
     */
    async analyzeGame(fens, moves, onProgress = null) {
      this.isAnalyzing = true;
      const totalPositions = fens.length;
      const evals = [];

      // 1. Evaluate every position (from initial board to final position)
      for (let i = 0; i < totalPositions; i++) {
        if (!this.isAnalyzing) break;
        const evalResult = await this.evaluatePosition(fens[i], 7);
        evals.push(evalResult);

        if (onProgress) {
          const percent = Math.round(((i + 1) / totalPositions) * 100);
          onProgress(i + 1, totalPositions, percent);
        }
      }

      // 2. Classify each move
      const moveReviews = [];
      const counts = {
        w: { brilliant: 0, best: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
        b: { brilliant: 0, best: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
      };
      const accuracies = { w: [], b: [] };
      const uciHistory = [];

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const player = (i % 2 === 0) ? 'w' : 'b';
        const uci = toUci(move);
        const evalBefore = evals[i] || { cp: 0 };
        const evalAfter = evals[i + 1] || { cp: 0 };

        // Normalize cp to moving player's point of view:
        const playerCpBefore = evalBefore.cp;
        const playerCpAfter = -evalAfter.cp;

        const winBefore = centipawnsToWinPercent(playerCpBefore);
        const winAfter = centipawnsToWinPercent(playerCpAfter);
        let winLoss = Math.max(0, winBefore - winAfter);

        // Check opening book
        const bookList = OPENING_BOOK[uciHistory.join(' ')];
        const isBook = Boolean(bookList && bookList.includes(uci));
        uciHistory.push(uci);

        // Check if piece sacrificed (for Brilliant)
        let isSacrifice = false;
        if (!isBook && move.piece && move.piece !== 'p' && move.piece !== 'k') {
          try {
            const nextFen = fens[i + 1];
            if (nextFen && typeof Chess !== 'undefined') {
              const cNext = new Chess(nextFen);
              if (!cNext.in_checkmate()) {
                const movingVal = PIECE_VALUES[move.piece.toLowerCase()] || 0;
                const capturedVal = move.captured ? (PIECE_VALUES[move.captured.toLowerCase()] || 0) : 0;
                const opponentMoves = cNext.moves({ verbose: true });
                const attackedByEqualOrLess = opponentMoves.some(m => m.to === move.to && (PIECE_VALUES[m.piece] || 0) <= movingVal);
                if (attackedByEqualOrLess && capturedVal < movingVal && winLoss <= 1.5 && winAfter >= 45) {
                  isSacrifice = true;
                }
              }
            }
          } catch (e) {}
        }

        const isEngineBest = Boolean(evalBefore.bestmove && evalBefore.bestmove === uci);

        // Determine badge classification & calibrated move accuracy
        let classification = 'good';
        let moveAcc = 100;

        if (isBook) {
          classification = 'book';
          winLoss = 0;
          moveAcc = 100;
        } else if (isSacrifice) {
          classification = 'brilliant';
          winLoss = 0;
          moveAcc = 100;
        } else if (isEngineBest || winLoss <= 1.5) {
          classification = 'best';
          winLoss = 0;
          moveAcc = 100;
        } else if (winLoss <= 6.0) {
          classification = 'good';
          moveAcc = winLossToAccuracy(winLoss);
        } else if (winLoss <= 16.0) {
          classification = 'inaccuracy';
          moveAcc = winLossToAccuracy(winLoss);
        } else if (winLoss <= 28.0) {
          classification = 'mistake';
          moveAcc = winLossToAccuracy(winLoss);
        } else {
          classification = 'blunder';
          moveAcc = winLossToAccuracy(winLoss);
        }

        counts[player][classification]++;
        accuracies[player].push(moveAcc);

        // Standard chess eval: positive for White advantage, negative for Black advantage
        const evalDisplayWhitePerspective = player === 'w' ? playerCpAfter : -playerCpAfter;

        moveReviews.push({
          index: i,
          move: move,
          uci: uci,
          san: move.san || uci,
          player: player,
          classification: classification,
          evalCp: evalDisplayWhitePerspective,
          bestmove: evalBefore.bestmove,
          accuracy: moveAcc,
          winLoss: winLoss
        });
      }

      // Calculate overall accuracy
      const calcAverage = (arr) => {
        if (!arr.length) return 100;
        const sum = arr.reduce((acc, v) => acc + v, 0);
        return Math.round((sum / arr.length) * 10) / 10;
      };

      const finalReport = {
        whiteAccuracy: calcAverage(accuracies.w),
        blackAccuracy: calcAverage(accuracies.b),
        counts: counts,
        moveReviews: moveReviews,
        evals: evals
      };

      this.isAnalyzing = false;
      return finalReport;
    }
  }

  window.ChessAnalysisEngine = ChessAnalysisEngine;
  window.chessAnalysisEngine = new ChessAnalysisEngine('js/stockfish.js');
})();
