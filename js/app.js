/**
 * MINIMAL CHESS — Core Controller
 * Handles board rendering, legal move dots, turn-based rotation,
 * touch/mouse dragging, move history stepping (Back/Forward),
 * material calculations, avatars, and checkmate dialogs.
 */

(function () {
  'use strict';

  // --- Game State ---
  let game = new Chess();
  let selectedSquare = null;
  let legalMovesForSelected = [];
  let pendingPromotionMove = null;

  // Move History Stepping (Back/Forward navigation)
  let historyFens = [game.fen()];
  let historyMoves = [];
  let currentViewIndex = 0;

  // Cached DOM elements for 64 squares (prevents DOM recreation, enables buttery smooth transitions)
  const squareElements = {};

  // Configuration & Preferences (persisted in localStorage)
  // Board auto-flip is OFF by default; Piece-flip on turn is ON by default
  let autoFlipEnabled = localStorage.getItem('minchess_autoflip_v2') === 'true'; // default false
  let pieceFlipEnabled = localStorage.getItem('minchess_pieceflip_v2') !== 'false'; // default true
  let isTabletopMode = localStorage.getItem('minchess_tabletop') === 'true';
  let manualBoardFlipped = false;

  let playerProfiles = {
    w: {
      name: localStorage.getItem('minchess_name_w') || 'White',
      avatar: localStorage.getItem('minchess_avatar_w') || 'k'
    },
    b: {
      name: localStorage.getItem('minchess_name_b') || 'Black',
      avatar: localStorage.getItem('minchess_avatar_b') || 'k'
    }
  };

  // Dragging state
  let isDragging = false;
  let draggedSquare = null;
  let dragElement = null;

  // DOM Elements
  const chessboardEl = document.getElementById('chessboard');
  const boardContainerEl = document.getElementById('board-container');
  const btnAudio = document.getElementById('btn-audio');
  const soundOnIcon = btnAudio.querySelector('.sound-on');
  const soundOffIcon = btnAudio.querySelector('.sound-off');
  const btnPieceFlip = document.getElementById('btn-pieceflip');
  const btnAutoFlip = document.getElementById('btn-autoflip');
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnUndo = document.getElementById('btn-undo');
  const btnTabletop = document.getElementById('btn-tabletop');
  const btnNewGame = document.getElementById('btn-new-game');
  const btnHistory = document.getElementById('btn-history');
  const historyOverlay = document.getElementById('history-overlay');
  const btnCloseHistory = document.getElementById('btn-close-history');
  const historyList = document.getElementById('history-list');

  // Promotion modal
  const promotionModal = document.getElementById('promotion-modal');
  const promotionChoices = document.getElementById('promotion-choices');

  // Game over modal
  const gameOverModal = document.getElementById('game-over-modal');
  const gameOverAvatar = document.getElementById('game-over-avatar');
  const gameOverTitle = document.getElementById('game-over-title');
  const gameOverWinner = document.getElementById('game-over-winner');
  const statMoves = document.getElementById('stat-moves');
  const statOutcome = document.getElementById('stat-outcome');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnDismissModal = document.getElementById('btn-dismiss-modal');

  // Name modal
  const nameModal = document.getElementById('name-modal');
  const nameInput = document.getElementById('name-input');
  const btnSaveName = document.getElementById('btn-save-name');
  const btnCancelName = document.getElementById('btn-cancel-name');
  let activeEditingPlayer = null;

  // Avatar modal
  const avatarModal = document.getElementById('avatar-modal');
  const avatarChoices = document.getElementById('avatar-choices');
  const avatarModalPlayerDesc = document.getElementById('avatar-modal-player-desc');
  const btnCloseAvatarModal = document.getElementById('btn-close-avatar-modal');
  let activeAvatarPlayer = null;

  // --- Initial Setup ---
  function init() {
    createBoardGrid();
    updateAudioUI();
    updateAutoFlipUI();
    updatePieceFlipUI();
    updateTabletopUI();
    updateHistoryNavButtons();
    renderPlayerProfiles();
    renderBoard();
    updateStatus();
    setupEventListeners();
  }

  // Create 64 squares ONCE in the DOM
  function createBoardGrid() {
    chessboardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const file = String.fromCharCode('a'.charCodeAt(0) + c);
        const rank = 8 - r;
        const squareId = `${file}${rank}`;

        const sqEl = document.createElement('div');
        sqEl.className = 'square';
        sqEl.dataset.square = squareId;
        chessboardEl.appendChild(sqEl);
        squareElements[squareId] = sqEl;
      }
    }
  }

  function isViewingLive() {
    return currentViewIndex === historyFens.length - 1;
  }

  // --- Board Grid Rendering (Preserves DOM elements for buttery smooth piece rotation) ---
  function renderBoard(activeGame = (isViewingLive() ? game : new Chess(historyFens[currentViewIndex]))) {
    const boardState = activeGame.board(); // 8x8 array
    const lastMove = getDisplayedLastMove();

    // Check if current turn king is in check
    let checkSquare = null;
    if (activeGame.in_check()) {
      checkSquare = findKingSquare(activeGame.turn(), activeGame);
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const file = String.fromCharCode('a'.charCodeAt(0) + c);
        const rank = 8 - r;
        const squareId = `${file}${rank}`;
        const sqEl = squareElements[squareId];
        if (!sqEl) continue;

        // Reset classes
        sqEl.className = 'square';
        if (lastMove && (lastMove.from === squareId || lastMove.to === squareId)) {
          sqEl.classList.add('last-move');
        }
        if (checkSquare === squareId) {
          sqEl.classList.add('in-check');
        }
        if (selectedSquare === squareId) {
          sqEl.classList.add('selected');
        }

        // Clean up old indicator dots/rings
        const oldDots = sqEl.querySelectorAll('.playable-dot, .capture-ring');
        oldDots.forEach(d => d.remove());

        // Piece element preservation
        const piece = boardState[r][c];
        const existingImg = sqEl.querySelector('.chess-piece');

        if (piece) {
          const prefix = piece.color;
          const pieceName = PIECE_NAME_MAP[piece.type];
          const pieceKey = `${prefix}_${pieceName}`;
          const expectedSrc = `assets/pieces/${pieceKey}.png`;

          if (existingImg && existingImg.dataset && existingImg.dataset.pieceKey === pieceKey) {
            // Re-use existing DOM image so CSS transition is uninterrupted!
            if (isTabletopMode && piece.color === 'b') {
              existingImg.classList.add('top-player-piece');
            } else {
              existingImg.classList.remove('top-player-piece');
            }
          } else {
            if (existingImg) existingImg.remove();
            const pieceImg = document.createElement('img');
            pieceImg.src = expectedSrc;
            pieceImg.dataset.pieceKey = pieceKey;
            pieceImg.className = 'chess-piece';
            pieceImg.alt = `${prefix} ${pieceName}`;
            pieceImg.draggable = false;
            if (isTabletopMode && piece.color === 'b') {
              pieceImg.classList.add('top-player-piece');
            }
            sqEl.appendChild(pieceImg);
          }
        } else {
          if (existingImg) existingImg.remove();
        }

        // Move indicators (dots & capture rings) — only active when on live move
        if (selectedSquare && isViewingLive()) {
          const move = legalMovesForSelected.find(m => m.to === squareId);
          if (move) {
            if (piece || move.flags.includes('e')) {
              // Capture ring around opponent piece
              const ring = document.createElement('div');
              ring.className = 'capture-ring';
              sqEl.appendChild(ring);
            } else {
              // Centered dot on empty square
              const dot = document.createElement('div');
              dot.className = 'playable-dot';
              sqEl.appendChild(dot);
            }
          }
        }
      }
    }

    applyBoardOrientation(activeGame);
  }

  // Find square of active player's King
  function findKingSquare(color, activeGame = game) {
    const board = activeGame.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === color) {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }

  function getDisplayedLastMove() {
    if (isViewingLive()) {
      return historyMoves.length > 0 ? historyMoves[historyMoves.length - 1] : null;
    }
    return currentViewIndex > 0 ? historyMoves[currentViewIndex - 1] : null;
  }

  // --- Board Orientation & Turn Rotation ---
  function applyBoardOrientation(activeGame = (isViewingLive() ? game : new Chess(historyFens[currentViewIndex]))) {
    const activeTurn = activeGame.turn();

    // 1. Board rotation (Auto-flip whole board):
    let shouldFlipBoard = manualBoardFlipped;
    if (autoFlipEnabled) {
      shouldFlipBoard = (activeTurn === 'b');
    }

    if (shouldFlipBoard) {
      boardContainerEl.classList.add('flipped');
    } else {
      boardContainerEl.classList.remove('flipped');
    }

    // 2. Piece rotation for Black player (opposite player sitting across phone):
    const topPlayerCard = document.getElementById('player-top');
    if (isTabletopMode) {
      chessboardEl.classList.add('tabletop-mode');
      chessboardEl.classList.remove('pieces-facing-black');
      if (topPlayerCard) topPlayerCard.classList.add('facing-opponent');
    } else {
      chessboardEl.classList.remove('tabletop-mode');
      if (pieceFlipEnabled && activeTurn === 'b') {
        chessboardEl.classList.add('pieces-facing-black');
        if (topPlayerCard) topPlayerCard.classList.add('facing-opponent');
      } else {
        chessboardEl.classList.remove('pieces-facing-black');
        if (topPlayerCard) topPlayerCard.classList.remove('facing-opponent');
      }
    }
  }

  // --- Move History Stepping (Back / Forward) ---
  function stepBack() {
    if (currentViewIndex > 0) {
      currentViewIndex--;
      selectedSquare = null;
      legalMovesForSelected = [];
      renderView();
      chessAudio.playMove();
    }
  }

  function stepForward() {
    if (currentViewIndex < historyFens.length - 1) {
      currentViewIndex++;
      selectedSquare = null;
      legalMovesForSelected = [];
      renderView();
      chessAudio.playMove();
    }
  }

  function renderView() {
    const activeGame = isViewingLive() ? game : new Chess(historyFens[currentViewIndex]);
    renderBoard(activeGame);
    updateStatusForGame(activeGame, historyMoves.slice(0, currentViewIndex));
    updateHistoryNavButtons();
  }

  function updateHistoryNavButtons() {
    if (btnBack) {
      btnBack.disabled = (currentViewIndex <= 0);
    }
    if (btnForward) {
      btnForward.disabled = (currentViewIndex >= historyFens.length - 1);
    }
  }

  // --- Interaction: Selection & Move Execution ---
  function handleSquareClick(squareId) {
    if (game.game_over()) return;

    // If viewing an earlier historical position, jump to live position first!
    if (!isViewingLive()) {
      currentViewIndex = historyFens.length - 1;
      renderBoard(game);
      updateStatus();
      updateHistoryNavButtons();
    }

    const piece = game.get(squareId);
    const currentTurn = game.turn();

    // If square contains active player's piece -> select it
    if (piece && piece.color === currentTurn) {
      if (selectedSquare === squareId) {
        // Toggle off
        selectedSquare = null;
        legalMovesForSelected = [];
      } else {
        selectedSquare = squareId;
        legalMovesForSelected = game.moves({ square: squareId, verbose: true });
      }
      renderBoard(game);
      return;
    }

    // If already have a selected piece and user tapped a destination
    if (selectedSquare) {
      const move = legalMovesForSelected.find(m => m.to === squareId);
      if (move) {
        // Check for promotion
        if (move.flags.includes('p')) {
          showPromotionModal(move);
          return;
        }

        executeMove({ from: selectedSquare, to: squareId });
      } else {
        // Clicked invalid destination: deselect
        selectedSquare = null;
        legalMovesForSelected = [];
        renderBoard(game);
      }
    }
  }

  function executeMove(moveObj) {
    const fromPiece = game.get(moveObj.from);
    const isCapture = Boolean(game.get(moveObj.to) || (fromPiece && fromPiece.type === 'p' && moveObj.from[0] !== moveObj.to[0]));

    const result = game.move(moveObj);
    if (!result) return;

    // Append to historical FENs and moves
    historyFens.push(game.fen());
    historyMoves.push(result);
    currentViewIndex = historyFens.length - 1;

    // Sound effect
    if (game.in_checkmate()) {
      chessAudio.playVictory();
    } else if (game.in_check()) {
      chessAudio.playCheck();
    } else if (isCapture) {
      chessAudio.playCapture();
    } else {
      chessAudio.playMove();
    }

    selectedSquare = null;
    legalMovesForSelected = [];

    renderBoard(game);
    updateStatus();
    updateHistoryNavButtons();

    // Check for game over
    checkGameOver();
  }

  // --- Drag and Drop (Touch & Mouse) & Tap Handling ---
  let pointerStartX = 0;
  let pointerStartY = 0;
  let hasDragged = false;
  let suppressClick = false;

  function setupDragAndDrop() {
    function onPointerDown(e) {
      if (game.game_over()) return;

      // If viewing history, jump to live move
      if (!isViewingLive()) {
        currentViewIndex = historyFens.length - 1;
        renderBoard(game);
        updateStatus();
        updateHistoryNavButtons();
      }

      const targetSquareEl = e.target.closest('.square');
      if (!targetSquareEl) return;

      const squareId = targetSquareEl.dataset.square;
      const piece = game.get(squareId);
      if (!piece || piece.color !== game.turn()) return;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      pointerStartX = clientX;
      pointerStartY = clientY;
      hasDragged = false;
      draggedSquare = squareId;
      isDragging = true;

      window.addEventListener('mousemove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isDragging || !draggedSquare) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dist = Math.hypot(clientX - pointerStartX, clientY - pointerStartY);

      // Only enter active drag if pointer moved more than 8 pixels
      if (dist > 8) {
        if (!hasDragged) {
          hasDragged = true;
          // Show selection & legal dots for dragged piece
          selectedSquare = draggedSquare;
          legalMovesForSelected = game.moves({ square: draggedSquare, verbose: true });
          renderBoard(game);

          // Create floating drag clone
          const sqEl = squareElements[draggedSquare];
          const pieceImg = sqEl ? sqEl.querySelector('.chess-piece') : null;
          if (pieceImg) {
            dragElement = pieceImg.cloneNode(true);
            dragElement.classList.add('dragging-piece');
            if (chessboardEl.classList.contains('pieces-facing-black')) {
              dragElement.classList.add('facing-black');
            }
            dragElement.style.width = `${pieceImg.offsetWidth}px`;
            dragElement.style.height = `${pieceImg.offsetHeight}px`;
            document.body.appendChild(dragElement);
          }
        }

        if (dragElement) {
          e.preventDefault();
          dragElement.style.left = `${clientX}px`;
          dragElement.style.top = `${clientY}px`;
        }
      }
    }

    function onPointerUp(e) {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

      if (dragElement) {
        dragElement.remove();
        dragElement = null;
      }

      if (hasDragged && draggedSquare) {
        // Suppress the click event dispatched right after mouseup/touchend
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 200);

        const dropEl = document.elementFromPoint(clientX, clientY);
        const targetSquareEl = dropEl ? dropEl.closest('.square') : null;

        if (targetSquareEl) {
          const destSquare = targetSquareEl.dataset.square;
          if (destSquare && destSquare !== draggedSquare) {
            const move = legalMovesForSelected.find(m => m.to === destSquare);
            if (move) {
              if (move.flags.includes('p')) {
                showPromotionModal(move);
                draggedSquare = null;
                hasDragged = false;
                isDragging = false;
                return;
              }
              executeMove({ from: draggedSquare, to: destSquare });
              draggedSquare = null;
              hasDragged = false;
              isDragging = false;
              return;
            }
          }
        }
        renderBoard(game);
      }

      draggedSquare = null;
      hasDragged = false;
      isDragging = false;
    }

    chessboardEl.addEventListener('mousedown', onPointerDown);
    chessboardEl.addEventListener('touchstart', onPointerDown, { passive: false });
  }

  // --- Pawn Promotion Modal ---
  function showPromotionModal(move) {
    pendingPromotionMove = move;
    promotionChoices.innerHTML = '';

    const color = game.turn();
    const pieces = ['q', 'n', 'r', 'b'];

    pieces.forEach(pType => {
      const choice = document.createElement('div');
      choice.className = 'promotion-choice';
      choice.title = `Promote to ${PIECE_NAME_MAP[pType]}`;
      choice.innerHTML = getPieceElement(pType, color);
      choice.onclick = () => {
        promotionModal.style.display = 'none';
        if (pendingPromotionMove) {
          executeMove({
            from: pendingPromotionMove.from,
            to: pendingPromotionMove.to,
            promotion: pType
          });
          pendingPromotionMove = null;
        }
      };
      promotionChoices.appendChild(choice);
    });

    promotionModal.style.display = 'flex';
  }

  // --- Material Advantage & Captured Trays (Chess.com Style) ---
  function updateStatus() {
    updateStatusForGame(game, historyMoves);
  }

  function updateStatusForGame(activeGame, moveHistory) {
    const currentTurn = activeGame.turn();

    // Turn indicator cards
    const topCard = document.getElementById('player-top');
    const bottomCard = document.getElementById('player-bottom');

    if (currentTurn === 'w') {
      bottomCard.classList.add('active-turn');
      topCard.classList.remove('active-turn');
    } else {
      topCard.classList.add('active-turn');
      bottomCard.classList.remove('active-turn');
    }

    // Calculate captured pieces
    const capturedByWhite = [];
    const capturedByBlack = [];
    let whiteScore = 0;
    let blackScore = 0;

    moveHistory.forEach(move => {
      if (move.captured) {
        const val = PIECE_VALUES[move.captured] || 0;
        if (move.color === 'w') {
          capturedByWhite.push({ type: move.captured, color: 'b' });
          whiteScore += val;
        } else {
          capturedByBlack.push({ type: move.captured, color: 'w' });
          blackScore += val;
        }
      }
    });

    // Render trays
    renderCapturedList('captured-bottom', capturedByWhite);
    renderCapturedList('captured-top', capturedByBlack);

    // Render material advantage badges (+1, +3, +9)
    const advBottom = document.getElementById('advantage-bottom');
    const advTop = document.getElementById('advantage-top');

    const diff = whiteScore - blackScore;
    if (diff > 0) {
      advBottom.textContent = `+${diff}`;
      advBottom.classList.add('visible');
      advTop.classList.remove('visible');
    } else if (diff < 0) {
      advTop.textContent = `+${Math.abs(diff)}`;
      advTop.classList.add('visible');
      advBottom.classList.remove('visible');
    } else {
      advBottom.classList.remove('visible');
      advTop.classList.remove('visible');
    }

    updateHistoryList(moveHistory);
  }

  function renderCapturedList(containerId, pieces) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    // Sort pieces by value descending (Queen, Rook, Bishop, Knight, Pawn)
    pieces.sort((a, b) => (PIECE_VALUES[b.type] || 0) - (PIECE_VALUES[a.type] || 0));

    pieces.forEach(p => {
      const item = document.createElement('span');
      item.className = 'captured-item';
      item.innerHTML = getPieceElement(p.type, p.color);
      container.appendChild(item);
    });
  }

  // --- Move History Drawer ---
  function updateHistoryList(history) {
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No moves yet. Start playing!</div>';
      return;
    }

    historyList.innerHTML = '';
    for (let i = 0; i < history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = history[i].san;
      const blackMove = history[i + 1] ? history[i + 1].san : '';

      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `
        <span class="history-num">${moveNum}.</span>
        <span class="history-move">${whiteMove}</span>
        <span class="history-move">${blackMove}</span>
      `;
      historyList.appendChild(row);
    }
  }

  // --- Checkmate & Game Over Handling ---
  function checkGameOver() {
    if (!game.game_over()) return;

    let title = 'Game Over';
    let winnerText = '';
    let outcome = '1/2 - 1/2';
    let winningColor = null;

    if (game.in_checkmate()) {
      title = 'Checkmate';
      if (game.turn() === 'b') {
        winnerText = `${playerProfiles.w.name} won the game`;
        outcome = '1 - 0';
        winningColor = 'w';
      } else {
        winnerText = `${playerProfiles.b.name} won the game`;
        outcome = '0 - 1';
        winningColor = 'b';
      }
    } else if (game.in_stalemate()) {
      title = 'Stalemate';
      winnerText = 'Game drawn by stalemate';
    } else if (game.in_threefold_repetition()) {
      title = 'Draw';
      winnerText = 'Threefold repetition';
    } else if (game.insufficient_material()) {
      title = 'Draw';
      winnerText = 'Insufficient material';
    } else if (game.in_draw()) {
      title = 'Draw';
      winnerText = '50-move rule';
    }

    gameOverTitle.textContent = title;
    gameOverWinner.textContent = winnerText;
    statMoves.textContent = Math.ceil(game.history().length / 2);
    statOutcome.textContent = outcome;

    if (winningColor) {
      const avatarType = playerProfiles[winningColor].avatar;
      gameOverAvatar.innerHTML = getPieceSvg(avatarType, PIECE_COLORS[winningColor], 40);
    } else {
      gameOverAvatar.innerHTML = getPieceSvg('k', '#888888', 40);
    }

    setTimeout(() => {
      gameOverModal.style.display = 'flex';
    }, 400);
  }

  // --- Player Customization: Names & Avatars ---
  function renderPlayerProfiles() {
    document.getElementById('name-top').textContent = playerProfiles.b.name;
    document.getElementById('name-bottom').textContent = playerProfiles.w.name;

    const avatarTop = document.getElementById('avatar-top');
    avatarTop.innerHTML = getPieceSvg(playerProfiles.b.avatar, PIECE_COLORS.b, 26);

    const avatarBottom = document.getElementById('avatar-bottom');
    avatarBottom.innerHTML = getPieceSvg(playerProfiles.w.avatar, PIECE_COLORS.w, 26);
  }

  function openNameEditor(playerKey) {
    activeEditingPlayer = playerKey;
    nameInput.value = playerProfiles[playerKey].name;
    nameModal.style.display = 'flex';
    nameInput.focus();
  }

  function saveNameEditor() {
    const val = nameInput.value.trim();
    if (val && activeEditingPlayer) {
      playerProfiles[activeEditingPlayer].name = val;
      localStorage.setItem(`minchess_name_${activeEditingPlayer}`, val);
      renderPlayerProfiles();
      updateStatus();
    }
    nameModal.style.display = 'none';
  }

  function openAvatarPicker(playerKey) {
    activeAvatarPlayer = playerKey;
    const colorHex = PIECE_COLORS[playerKey];
    avatarModalPlayerDesc.textContent = `Choose an avatar for ${playerProfiles[playerKey].name}`;
    avatarChoices.innerHTML = '';

    AVAILABLE_AVATARS.forEach(pType => {
      const btn = document.createElement('div');
      btn.className = 'avatar-choice';
      if (playerProfiles[playerKey].avatar === pType) {
        btn.classList.add('selected');
      }
      btn.innerHTML = getPieceSvg(pType, colorHex, 36);
      btn.onclick = () => {
        playerProfiles[playerKey].avatar = pType;
        localStorage.setItem(`minchess_avatar_${playerKey}`, pType);
        renderPlayerProfiles();
        avatarModal.style.display = 'none';
      };
      avatarChoices.appendChild(btn);
    });

    avatarModal.style.display = 'flex';
  }

  // --- Controls & Toggles ---
  function updateAudioUI() {
    const isMuted = chessAudio.isMuted();
    soundOnIcon.style.display = isMuted ? 'none' : 'block';
    soundOffIcon.style.display = isMuted ? 'block' : 'none';
  }

  function updateAutoFlipUI() {
    if (btnAutoFlip) {
      if (autoFlipEnabled) {
        btnAutoFlip.classList.add('active');
      } else {
        btnAutoFlip.classList.remove('active');
      }
    }
  }

  function updatePieceFlipUI() {
    if (btnPieceFlip) {
      if (pieceFlipEnabled) {
        btnPieceFlip.classList.add('active');
      } else {
        btnPieceFlip.classList.remove('active');
      }
    }
  }

  function updateTabletopUI() {
    if (btnTabletop) {
      if (isTabletopMode) {
        btnTabletop.classList.add('active');
      } else {
        btnTabletop.classList.remove('active');
      }
    }
  }

  function setupEventListeners() {
    // Square click
    chessboardEl.addEventListener('click', e => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const sq = e.target.closest('.square');
      if (sq) {
        handleSquareClick(sq.dataset.square);
      }
    });

    setupDragAndDrop();

    // Audio toggle
    btnAudio.addEventListener('click', () => {
      chessAudio.toggleMute();
      updateAudioUI();
    });

    // Piece flip toggle (active player piece rotation)
    if (btnPieceFlip) {
      btnPieceFlip.addEventListener('click', () => {
        pieceFlipEnabled = !pieceFlipEnabled;
        localStorage.setItem('minchess_pieceflip_v2', pieceFlipEnabled);
        updatePieceFlipUI();
        applyBoardOrientation();
      });
    }

    // Auto-flip board toggle
    if (btnAutoFlip) {
      btnAutoFlip.addEventListener('click', () => {
        autoFlipEnabled = !autoFlipEnabled;
        localStorage.setItem('minchess_autoflip_v2', autoFlipEnabled);
        updateAutoFlipUI();
        applyBoardOrientation();
      });
    }

    // Move history Back & Forward buttons
    if (btnBack) {
      btnBack.addEventListener('click', stepBack);
    }
    if (btnForward) {
      btnForward.addEventListener('click', stepForward);
    }

    // Tabletop mode toggle
    if (btnTabletop) {
      btnTabletop.addEventListener('click', () => {
        isTabletopMode = !isTabletopMode;
        localStorage.setItem('minchess_tabletop', isTabletopMode);
        updateTabletopUI();
        renderBoard();
      });
    }

    // Undo move
    btnUndo.addEventListener('click', () => {
      if (game.history().length > 0) {
        game.undo();
        historyFens.pop();
        historyMoves.pop();
        currentViewIndex = historyFens.length - 1;
        selectedSquare = null;
        legalMovesForSelected = [];
        renderBoard(game);
        updateStatus();
        updateHistoryNavButtons();
        chessAudio.playMove();
      }
    });

    // Reset / New game
    btnNewGame.addEventListener('click', () => {
      if (confirm('Start a new game?')) {
        startNewGame();
      }
    });

    // History drawer
    btnHistory.addEventListener('click', () => {
      historyOverlay.style.display = 'flex';
    });

    btnCloseHistory.addEventListener('click', () => {
      historyOverlay.style.display = 'none';
    });

    historyOverlay.addEventListener('click', e => {
      if (e.target === historyOverlay) {
        historyOverlay.style.display = 'none';
      }
    });

    // Game over actions
    btnPlayAgain.addEventListener('click', () => {
      gameOverModal.style.display = 'none';
      startNewGame();
    });

    btnDismissModal.addEventListener('click', () => {
      gameOverModal.style.display = 'none';
    });

    // Name editing triggers
    document.getElementById('name-top').addEventListener('click', () => openNameEditor('b'));
    document.getElementById('player-top').querySelector('.btn-edit-name').addEventListener('click', () => openNameEditor('b'));
    document.getElementById('name-bottom').addEventListener('click', () => openNameEditor('w'));
    document.getElementById('player-bottom').querySelector('.btn-edit-name').addEventListener('click', () => openNameEditor('w'));

    btnSaveName.addEventListener('click', saveNameEditor);
    btnCancelName.addEventListener('click', () => {
      nameModal.style.display = 'none';
    });
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveNameEditor();
      if (e.key === 'Escape') nameModal.style.display = 'none';
    });

    // Avatar triggers
    document.getElementById('avatar-top').addEventListener('click', () => openAvatarPicker('b'));
    document.getElementById('avatar-bottom').addEventListener('click', () => openAvatarPicker('w'));
    btnCloseAvatarModal.addEventListener('click', () => {
      avatarModal.style.display = 'none';
    });
  }

  function startNewGame() {
    game = new Chess();
    historyFens = [game.fen()];
    historyMoves = [];
    currentViewIndex = 0;
    selectedSquare = null;
    legalMovesForSelected = [];
    manualBoardFlipped = false;
    renderBoard(game);
    updateStatus();
    updateHistoryNavButtons();
    chessAudio.playMove();
  }

  // Launch!
  init();
})();
