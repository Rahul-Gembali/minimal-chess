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
  let currentTheme = localStorage.getItem('minchess_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
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
  const btnTheme = document.getElementById('btn-theme');
  const themeMoonIcon = btnTheme ? btnTheme.querySelector('.theme-moon') : null;
  const themeSunIcon = btnTheme ? btnTheme.querySelector('.theme-sun') : null;
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
  const btnReviewGamePrompt = document.getElementById('btn-review-game-prompt');

  // Game Review & Move Analysis Modal DOM Elements
  const reviewModal = document.getElementById('review-modal');
  const reviewCalcState = document.getElementById('review-calc-state');
  const reviewResultsState = document.getElementById('review-results-state');
  const reviewProgressBar = document.getElementById('review-progress-bar');
  const reviewProgressText = document.getElementById('review-progress-text');
  const reviewOutcomeText = document.getElementById('review-outcome-text');
  const reviewNameW = document.getElementById('review-name-w');
  const reviewNameB = document.getElementById('review-name-b');
  const reviewAccW = document.getElementById('review-acc-w');
  const reviewAccB = document.getElementById('review-acc-b');
  const breakdownHeaderW = document.getElementById('breakdown-header-w');
  const breakdownHeaderB = document.getElementById('breakdown-header-b');
  const btnReviewInspect = document.getElementById('btn-review-inspect');
  const btnReviewPlayAgain = document.getElementById('btn-review-play-again');
  const btnReviewClose = document.getElementById('btn-review-close');

  const moveReviewBanner = document.getElementById('move-review-banner');
  const reviewBannerBadge = document.getElementById('review-banner-badge');
  const bannerBadgeIcon = document.getElementById('banner-badge-icon');
  const bannerBadgeLabel = document.getElementById('banner-badge-label');
  const reviewBannerInfo = document.getElementById('review-banner-info');
  const btnReopenReview = document.getElementById('btn-reopen-review');

  let currentReviewData = null;
  let isReviewModeActive = false;

  const CLASSIFICATION_META = {
    brilliant: { icon: '💎', label: 'Brilliant', class: 'badge-brilliant' },
    best: { icon: '🎯', label: 'Best', class: 'badge-best' },
    good: { icon: '👍', label: 'Good', class: 'badge-good' },
    book: { icon: '📖', label: 'Book', class: 'badge-book' },
    inaccuracy: { icon: '❓', label: 'Inaccuracy', class: 'badge-inaccuracy' },
    mistake: { icon: '❓❓', label: 'Mistake', class: 'badge-mistake' },
    blunder: { icon: '❌', label: 'Blunder', class: 'badge-blunder' }
  };

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

  // --- Multiplayer State & DOM Elements ---
  let isOnlineMatch = false;
  let onlineMyColor = 'w'; // 'w' or 'b'
  let onlineRoomId = null;
  let onlineSelectedColorChoice = 'random';
  let isOnlinePeerConnected = false;

  const btnMultiplayer = document.getElementById('btn-multiplayer');
  const btnMpStatus = document.getElementById('btn-mp-status');
  const mpStatusDot = document.getElementById('mp-status-dot');
  const multiplayerModal = document.getElementById('multiplayer-modal');
  const mpModalTitle = document.getElementById('mp-modal-title');
  const mpModalSubtitle = document.getElementById('mp-modal-subtitle');
  const mpCreateSection = document.getElementById('mp-create-section');
  const mpActiveSection = document.getElementById('mp-active-section');
  const mpColorChoices = document.getElementById('mp-color-choices');
  const btnMpCreate = document.getElementById('btn-mp-create');
  const btnMpCancel = document.getElementById('btn-mp-cancel');
  const btnMpCopyLink = document.getElementById('btn-mp-copy-link');
  const btnMpLeave = document.getElementById('btn-mp-leave');
  const btnMpClose = document.getElementById('btn-mp-close');
  const mpLinkInput = document.getElementById('mp-link-input');
  const mpRoomStatusText = document.getElementById('mp-room-status-text');
  const mpModalStatusDot = document.getElementById('mp-modal-status-dot');
  const mpMySide = document.getElementById('mp-my-side');
  const mpActiveTimer = document.getElementById('mp-active-timer');
  const mpTimerPresets = document.getElementById('mp-timer-presets');
  const mpTimerCustomRow = document.getElementById('mp-timer-custom-row');
  const mpStepperDec = document.getElementById('mp-stepper-dec');
  const mpStepperInc = document.getElementById('mp-stepper-inc');
  const mpStepperVal = document.getElementById('mp-stepper-val');

  let mpSelectedTime = 'infinite';
  let mpIsCustom = false;
  let mpCustomMins = 5;

  // Game Timers State & Elements
  let playerTimeSettings = { w: 'infinite', b: 'infinite' };
  let playerIsCustom = { w: false, b: false };
  let modalStepperMins = { w: 5, b: 5 };

  try {
    const savedTimersV3 = localStorage.getItem('minchess_timer_settings_v3');
    if (savedTimersV3) {
      const parsed = JSON.parse(savedTimersV3);
      if (parsed && typeof parsed === 'object') {
        if (parsed.settings) {
          playerTimeSettings = parsed.settings;
          if (parsed.isCustom) playerIsCustom = parsed.isCustom;
          if (parsed.stepperMins) modalStepperMins = parsed.stepperMins;
        }
      }
    } else {
      const savedTimers = localStorage.getItem('minchess_timer_settings_v2');
      if (savedTimers) {
        const parsed = JSON.parse(savedTimers);
        if (parsed && typeof parsed === 'object') {
          playerTimeSettings = {
            w: parsed.w !== undefined ? parsed.w : 'infinite',
            b: parsed.b !== undefined ? parsed.b : 'infinite'
          };
          if (typeof playerTimeSettings.w === 'number' && ![60, 180, 600].includes(playerTimeSettings.w)) {
            playerIsCustom.w = true;
            modalStepperMins.w = Math.round(playerTimeSettings.w / 60);
          }
          if (typeof playerTimeSettings.b === 'number' && ![60, 180, 600].includes(playerTimeSettings.b)) {
            playerIsCustom.b = true;
            modalStepperMins.b = Math.round(playerTimeSettings.b / 60);
          }
        }
      }
    }
  } catch (e) {}

  let playerTimeLeft = {
    w: playerTimeSettings.w === 'infinite' ? Infinity : Number(playerTimeSettings.w),
    b: playerTimeSettings.b === 'infinite' ? Infinity : Number(playerTimeSettings.b)
  };
  let clockInterval = null;
  let lastClockTimestamp = null;

  const btnTimer = document.getElementById('btn-timer');
  const timerPillLabel = document.getElementById('timer-pill-label');
  const clockTop = document.getElementById('clock-top');
  const clockBottom = document.getElementById('clock-bottom');
  const timerModal = document.getElementById('timer-modal');
  const timerSyncToggle = document.getElementById('timer-sync-toggle');
  const timerNameW = document.getElementById('timer-name-w');
  const timerNameB = document.getElementById('timer-name-b');
  const btnApplyTimer = document.getElementById('btn-apply-timer');
  const btnCancelTimer = document.getElementById('btn-cancel-timer');

  // Staged state for modal
  let modalTimeSettings = { w: playerTimeSettings.w, b: playerTimeSettings.b };
  let modalIsCustom = { w: playerIsCustom.w, b: playerIsCustom.b };

  // --- Initial Setup ---
  function init() {
    applyTheme(currentTheme);
    createBoardGrid();
    updateAudioUI();
    updateAutoFlipUI();
    updatePieceFlipUI();
    updateTabletopUI();
    updateHistoryNavButtons();
    renderPlayerProfiles();
    resetClocks();
    renderBoard();
    updateStatus();
    setupEventListeners();
    setupMultiplayer();
    checkUrlForGame();
  }

  // Create 64 squares ONCE in the DOM
  function createBoardGrid() {
    chessboardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const file = String.fromCharCode('a'.charCodeAt(0) + c);
        const rank = 8 - r;
        const squareId = `${file}${rank}`;
        const isLight = (r + c) % 2 === 0;

        const sqEl = document.createElement('div');
        sqEl.className = `square ${isLight ? 'light' : 'dark'}`;
        sqEl.dataset.square = squareId;
        sqEl.dataset.color = isLight ? 'light' : 'dark';
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

        const isLight = (r + c) % 2 === 0;

        // Reset classes while preserving alternating light/dark square tile
        sqEl.className = `square ${isLight ? 'light' : 'dark'}`;
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
    if (isOnlineMatch) {
      // In online match: player's assigned color is permanently at the bottom
      if (onlineMyColor === 'b') {
        boardContainerEl.classList.add('flipped');
      } else {
        boardContainerEl.classList.remove('flipped');
      }
      chessboardEl.classList.remove('pieces-facing-black');
      chessboardEl.classList.remove('tabletop-mode');
      const topPlayerCard = document.getElementById('player-top');
      if (topPlayerCard) topPlayerCard.classList.remove('facing-opponent');
      return;
    }

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
      stopClock();
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
      if (isViewingLive() && !game.game_over() && historyMoves.length >= 1) {
        startClock();
      }
    }
  }

  function renderView() {
    const activeGame = isViewingLive() ? game : new Chess(historyFens[currentViewIndex]);
    renderBoard(activeGame);
    updateStatusForGame(activeGame, historyMoves.slice(0, currentViewIndex));
    updateHistoryNavButtons();
    updateMoveReviewBanner();
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

    // In online match: player can only move on their turn
    if (isOnlineMatch && game.turn() !== onlineMyColor) {
      showToast("Waiting for opponent's move...");
      return;
    }

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
      if (isOnlineMatch && piece.color !== onlineMyColor) return;

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

  function executeMove(moveObj, isFromRemote = false) {
    const fromPiece = game.get(moveObj.from);
    const isCapture = Boolean(game.get(moveObj.to) || (fromPiece && fromPiece.type === 'p' && moveObj.from[0] !== moveObj.to[0]));

    const result = game.move(moveObj);
    if (!result) return;

    // Append to historical FENs and moves
    historyFens.push(game.fen());
    historyMoves.push(result);
    currentViewIndex = historyFens.length - 1;

    // Sound effect & Minimal tactile haptic feedback
    if (game.in_checkmate()) {
      chessAudio.playVictory();
      if (typeof chessHaptics !== 'undefined') chessHaptics.timeout();
    } else if (game.in_check()) {
      chessAudio.playCheck();
      if (typeof chessHaptics !== 'undefined') chessHaptics.check();
    } else if (isCapture) {
      chessAudio.playCapture();
      if (typeof chessHaptics !== 'undefined') chessHaptics.capture();
    } else {
      chessAudio.playMove();
      if (typeof chessHaptics !== 'undefined') chessHaptics.move();
    }

    selectedSquare = null;
    legalMovesForSelected = [];

    renderBoard(game);
    updateStatus();
    updateHistoryNavButtons();

    // Start or continue clocks
    if (!game.game_over()) {
      if (historyMoves.length === 1) {
        startClock();
      } else if (!clockInterval && (playerTimeSettings.w !== 'infinite' || playerTimeSettings.b !== 'infinite')) {
        startClock();
      }
    }

    // Broadcast move to remote opponent if we made this move locally
    if (isOnlineMatch && !isFromRemote && typeof chessMultiplayer !== 'undefined') {
      chessMultiplayer.sendMove(moveObj, game.fen(), playerTimeLeft);
    }

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

      // In online match: player cannot drag pieces if it's not their turn
      if (isOnlineMatch && game.turn() !== onlineMyColor) return;

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
      if (isOnlineMatch && piece.color !== onlineMyColor) return;

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

    if (isOnlineMatch) {
      if (currentTurn === onlineMyColor) {
        bottomCard.classList.add('active-turn');
        topCard.classList.remove('active-turn');
      } else {
        topCard.classList.add('active-turn');
        bottomCard.classList.remove('active-turn');
      }
    } else {
      if (currentTurn === 'w') {
        bottomCard.classList.add('active-turn');
        topCard.classList.remove('active-turn');
      } else {
        topCard.classList.add('active-turn');
        bottomCard.classList.remove('active-turn');
      }
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

    const advBottom = document.getElementById('advantage-bottom');
    const advTop = document.getElementById('advantage-top');

    if (isOnlineMatch && onlineMyColor === 'b') {
      // Perspective locked to Black at bottom:
      renderCapturedList('captured-bottom', capturedByBlack);
      renderCapturedList('captured-top', capturedByWhite);

      const diff = blackScore - whiteScore;
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
    } else {
      // Standard / White at bottom:
      renderCapturedList('captured-bottom', capturedByWhite);
      renderCapturedList('captured-top', capturedByBlack);

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

      let whiteBadgeHtml = '';
      let blackBadgeHtml = '';

      if (currentReviewData && currentReviewData.moveReviews) {
        const revW = currentReviewData.moveReviews[i];
        if (revW && CLASSIFICATION_META[revW.classification]) {
          const metaW = CLASSIFICATION_META[revW.classification];
          whiteBadgeHtml = `<span class="move-eval-badge ${metaW.class}" title="${metaW.label}">${metaW.icon}</span>`;
        }
        if (history[i + 1]) {
          const revB = currentReviewData.moveReviews[i + 1];
          if (revB && CLASSIFICATION_META[revB.classification]) {
            const metaB = CLASSIFICATION_META[revB.classification];
            blackBadgeHtml = `<span class="move-eval-badge ${metaB.class}" title="${metaB.label}">${metaB.icon}</span>`;
          }
        }
      }

      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `
        <span class="history-num">${moveNum}.</span>
        <span class="history-move" data-move-idx="${i}">${whiteMove} ${whiteBadgeHtml}</span>
        <span class="history-move" data-move-idx="${i + 1}">${blackMove} ${blackBadgeHtml}</span>
      `;
      historyList.appendChild(row);
    }
  }

  // --- Checkmate & Game Over Handling ---
  function checkGameOver() {
    if (!game.game_over()) return;
    stopClock();

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
      const isDark = currentTheme === 'dark';
      const colorHex = isDark ? '#e6e6e6' : PIECE_COLORS[winningColor];
      gameOverAvatar.innerHTML = getPieceSvg(avatarType, colorHex, 40);
    } else {
      gameOverAvatar.innerHTML = getPieceSvg('k', '#888888', 40);
    }

    setTimeout(() => {
      gameOverModal.style.display = 'flex';
      if (historyMoves.length > 0) {
        startAutomaticGameReview(title, winnerText, outcome);
      }
    }, 400);
  }

  // --- Player Customization: Names & Avatars ---
  function renderPlayerProfiles() {
    const isDark = currentTheme === 'dark';
    const avatarTop = document.getElementById('avatar-top');
    const avatarBottom = document.getElementById('avatar-bottom');

    if (isOnlineMatch) {
      const whitePieceColor = isDark ? '#c9c8c8' : PIECE_COLORS.w;
      const blackPieceColor = isDark ? '#e6e6e6' : PIECE_COLORS.b;

      if (onlineMyColor === 'b') {
        document.getElementById('name-top').textContent = 'Opponent (White)';
        document.getElementById('name-bottom').textContent = `${playerProfiles.b.name || 'You'} (Black)`;

        avatarTop.innerHTML = getPieceSvg(playerProfiles.w.avatar, whitePieceColor, 26);
        avatarBottom.innerHTML = getPieceSvg(playerProfiles.b.avatar, blackPieceColor, 26);
      } else {
        document.getElementById('name-top').textContent = 'Opponent (Black)';
        document.getElementById('name-bottom').textContent = `${playerProfiles.w.name || 'You'} (White)`;

        avatarTop.innerHTML = getPieceSvg(playerProfiles.b.avatar, blackPieceColor, 26);
        avatarBottom.innerHTML = getPieceSvg(playerProfiles.w.avatar, whitePieceColor, 26);
      }
    } else {
      document.getElementById('name-top').textContent = playerProfiles.b.name;
      document.getElementById('name-bottom').textContent = playerProfiles.w.name;

      const topColor = isDark ? '#e6e6e6' : PIECE_COLORS.b;
      const bottomColor = isDark ? '#c9c8c8' : PIECE_COLORS.w;

      avatarTop.innerHTML = getPieceSvg(playerProfiles.b.avatar, topColor, 26);
      avatarBottom.innerHTML = getPieceSvg(playerProfiles.w.avatar, bottomColor, 26);
    }
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
    const isDark = currentTheme === 'dark';
    const colorHex = isDark ? '#e6e6e6' : PIECE_COLORS[playerKey];
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

  // --- Theme Management (Light / Dark Mode) ---
  function safeSetStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  function applyTheme(theme) {
    currentTheme = theme;
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
      if (themeMoonIcon) themeMoonIcon.style.display = 'none';
      if (themeSunIcon) themeSunIcon.style.display = 'block';
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.removeAttribute('data-theme');
      if (themeMoonIcon) themeMoonIcon.style.display = 'block';
      if (themeSunIcon) themeSunIcon.style.display = 'none';
    }
    safeSetStorage('minchess_theme', theme);
    renderPlayerProfiles();
  }

  let isThemeToggling = false;
  function toggleTheme(e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    if (isThemeToggling) return;
    isThemeToggling = true;
    setTimeout(() => { isThemeToggling = false; }, 250);

    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  // Expose globally for console, debug, and test access
  window.toggleTheme = toggleTheme;
  window.applyTheme = applyTheme;
  window.startNewGame = startNewGame;
  window.openTimerModal = openTimerModal;
  window.closeTimerModal = closeTimerModal;
  window.setModalPlayerTime = setModalPlayerTime;
  window.applyTimerSettings = applyTimerSettings;

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

  // --- Game Timers & Clocks Mechanics ---
  function formatClockDisplay(seconds) {
    if (seconds === Infinity || seconds === 'infinite' || seconds === undefined) {
      return '<span class="infinity-symbol">∞</span>';
    }
    if (seconds <= 0) return '0:00';
    if (seconds < 10) return seconds.toFixed(1) + 's';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function getTimerSummaryLabel() {
    function formatSetting(val) {
      if (val === 'infinite') return '<span class="infinity-symbol">∞</span>';
      const m = Math.round(Number(val) / 60);
      return `${m}m`;
    }
    if (playerTimeSettings.w === playerTimeSettings.b) {
      return formatSetting(playerTimeSettings.w);
    }
    return `${formatSetting(playerTimeSettings.w)}/${formatSetting(playerTimeSettings.b)}`;
  }

  function updateClockDisplays() {
    const myTime = (isOnlineMatch && onlineMyColor === 'b') ? playerTimeLeft.b : playerTimeLeft.w;
    const oppTime = (isOnlineMatch && onlineMyColor === 'b') ? playerTimeLeft.w : playerTimeLeft.b;

    if (clockBottom) clockBottom.innerHTML = formatClockDisplay(myTime);
    if (clockTop) clockTop.innerHTML = formatClockDisplay(oppTime);
    if (timerPillLabel) timerPillLabel.innerHTML = getTimerSummaryLabel();

    // Critical low-time warning (last 10 seconds, non-infinite): red color styling
    if (clockBottom) {
      if (myTime !== Infinity && myTime <= 10 && myTime > 0) {
        clockBottom.classList.add('critical-time');
        clockBottom.classList.add('low-time');
      } else {
        clockBottom.classList.remove('critical-time');
        clockBottom.classList.remove('low-time');
      }
    }
    if (clockTop) {
      if (oppTime !== Infinity && oppTime <= 10 && oppTime > 0) {
        clockTop.classList.add('critical-time');
        clockTop.classList.add('low-time');
      } else {
        clockTop.classList.remove('critical-time');
        clockTop.classList.remove('low-time');
      }
    }
  }

  function resetClocks() {
    stopClock();
    playerTimeLeft.w = playerTimeSettings.w === 'infinite' ? Infinity : Number(playerTimeSettings.w);
    playerTimeLeft.b = playerTimeSettings.b === 'infinite' ? Infinity : Number(playerTimeSettings.b);
    updateClockDisplays();
  }

  function startClock() {
    if (clockInterval) return;
    if (game.game_over()) return;
    // Clocks start counting down once White has made move 1
    if (historyMoves.length === 0) return;

    lastClockTimestamp = performance.now();
    clockInterval = setInterval(tickClock, 100);
  }

  function stopClock() {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  }

  function tickClock() {
    if (game.game_over() || !isViewingLive()) {
      stopClock();
      return;
    }

    const now = performance.now();
    const elapsedSeconds = (now - lastClockTimestamp) / 1000;
    lastClockTimestamp = now;

    const currentTurn = game.turn(); // 'w' or 'b'
    if (playerTimeLeft[currentTurn] !== Infinity) {
      const prevInt = Math.floor(playerTimeLeft[currentTurn]);
      playerTimeLeft[currentTurn] = Math.max(0, playerTimeLeft[currentTurn] - elapsedSeconds);
      const currInt = Math.floor(playerTimeLeft[currentTurn]);

      // Last 10 seconds: greater haptic feedback & soft audio tick on integer second boundary
      if (currInt <= 10 && currInt > 0 && currInt !== prevInt) {
        if (typeof chessAudio !== 'undefined') {
          chessAudio.playTick();
        }
        if (typeof chessHaptics !== 'undefined') {
          chessHaptics.countdownTick(); // Greater haptic feedback!
        }
      }

      updateClockDisplays();

      if (playerTimeLeft[currentTurn] <= 0) {
        handleTimeout(currentTurn);
      }
    }
  }

  function handleTimeout(timedOutColor) {
    stopClock();
    if (typeof chessHaptics !== 'undefined') {
      chessHaptics.timeout();
    }
    const winningColor = timedOutColor === 'w' ? 'b' : 'w';
    const winningPlayer = playerProfiles[winningColor].name;

    // FIDE Article 6.9: if opponent has insufficient mating material, outcome is a draw
    const hasMaterial = hasSufficientMaterialToMate(winningColor);

    let title = 'Time Out';
    let winnerText = '';
    let outcome = '1/2 - 1/2';

    if (hasMaterial) {
      winnerText = `${winningPlayer} won on time`;
      outcome = winningColor === 'w' ? '1 - 0' : '0 - 1';
    } else {
      title = 'Draw';
      winnerText = 'Time out vs Insufficient Material';
      outcome = '1/2 - 1/2';
    }

    if (typeof chessAudio !== 'undefined') {
      chessAudio.playTimeout();
    }

    gameOverTitle.textContent = title;
    gameOverWinner.textContent = winnerText;
    statMoves.textContent = Math.ceil(game.history().length / 2);
    statOutcome.textContent = outcome;

    const avatarType = playerProfiles[winningColor].avatar;
    const isDark = currentTheme === 'dark';
    const colorHex = isDark ? '#e6e6e6' : PIECE_COLORS[winningColor];
    gameOverAvatar.innerHTML = getPieceSvg(avatarType, colorHex, 40);

    setTimeout(() => {
      gameOverModal.style.display = 'flex';
      if (historyMoves.length > 0) {
        startAutomaticGameReview(title, winnerText, outcome);
      }
    }, 300);
  }

  function hasSufficientMaterialToMate(color) {
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

  // --- Game Review & Move Analysis Handling ---
  function closeReviewModal() {
    if (reviewModal) reviewModal.style.display = 'none';
  }

  async function startAutomaticGameReview(title = 'Game Over', winnerText = '', outcome = '') {
    if (gameOverModal) gameOverModal.style.display = 'none';
    if (!reviewModal || historyMoves.length === 0) return;

    reviewModal.style.display = 'flex';
    if (reviewCalcState) reviewCalcState.style.display = 'block';
    if (reviewResultsState) reviewResultsState.style.display = 'none';
    if (reviewProgressBar) reviewProgressBar.style.width = '0%';
    if (reviewProgressText) reviewProgressText.textContent = 'Initializing Stockfish engine...';

    const gameOutcomeLabel = winnerText ? `${winnerText} (${outcome})` : title;
    if (reviewOutcomeText) reviewOutcomeText.textContent = gameOutcomeLabel;

    try {
      if (typeof chessAnalysisEngine === 'undefined') {
        throw new Error('Analysis engine not loaded');
      }

      const report = await chessAnalysisEngine.analyzeGame(historyFens, historyMoves, (curr, total, pct) => {
        if (reviewProgressBar) reviewProgressBar.style.width = pct + '%';
        if (reviewProgressText) reviewProgressText.textContent = `Analyzing move ${curr}/${total} (${pct}%)...`;
      });

      currentReviewData = report;

      if (reviewNameW) reviewNameW.textContent = playerProfiles.w.name;
      if (reviewNameB) reviewNameB.textContent = playerProfiles.b.name;
      if (breakdownHeaderW) breakdownHeaderW.textContent = playerProfiles.w.name;
      if (breakdownHeaderB) breakdownHeaderB.textContent = playerProfiles.b.name;

      if (reviewAccW) reviewAccW.textContent = `${report.whiteAccuracy}%`;
      if (reviewAccB) reviewAccB.textContent = `${report.blackAccuracy}%`;

      const setBadgeCount = (id, count) => {
        const el = document.getElementById(id);
        if (el) el.textContent = count || 0;
      };

      setBadgeCount('count-w-brilliant', report.counts.w.brilliant);
      setBadgeCount('count-b-brilliant', report.counts.b.brilliant);
      setBadgeCount('count-w-best', report.counts.w.best);
      setBadgeCount('count-b-best', report.counts.b.best);
      setBadgeCount('count-w-good', report.counts.w.good);
      setBadgeCount('count-b-good', report.counts.b.good);
      setBadgeCount('count-w-book', report.counts.w.book);
      setBadgeCount('count-b-book', report.counts.b.book);
      setBadgeCount('count-w-inaccuracy', report.counts.w.inaccuracy);
      setBadgeCount('count-b-inaccuracy', report.counts.b.inaccuracy);
      setBadgeCount('count-w-mistake', report.counts.w.mistake);
      setBadgeCount('count-b-mistake', report.counts.b.mistake);
      setBadgeCount('count-w-blunder', report.counts.w.blunder);
      setBadgeCount('count-b-blunder', report.counts.b.blunder);

      updateHistoryList(historyMoves);

      if (reviewCalcState) reviewCalcState.style.display = 'none';
      if (reviewResultsState) reviewResultsState.style.display = 'block';

      if (typeof chessAudio !== 'undefined') chessAudio.playCheck();
      if (typeof chessHaptics !== 'undefined') chessHaptics.capture();
    } catch (err) {
      console.error('Game analysis error:', err);
      closeReviewModal();
      if (gameOverModal) gameOverModal.style.display = 'flex';
      showToast('Game review could not be completed.');
    }
  }

  function updateMoveReviewBanner() {
    if (!moveReviewBanner) return;
    if (!currentReviewData || !isReviewModeActive || currentViewIndex === 0) {
      moveReviewBanner.style.display = 'none';
      return;
    }

    const moveIndex = currentViewIndex - 1;
    const review = currentReviewData.moveReviews[moveIndex];
    if (!review) {
      moveReviewBanner.style.display = 'none';
      return;
    }

    const meta = CLASSIFICATION_META[review.classification] || CLASSIFICATION_META.good;
    if (bannerBadgeIcon) bannerBadgeIcon.textContent = meta.icon;
    if (bannerBadgeLabel) bannerBadgeLabel.textContent = meta.label;
    if (reviewBannerBadge) {
      reviewBannerBadge.className = 'review-banner-badge ' + meta.class;
    }

    let evalText = '';
    if (review.evalCp !== undefined && review.evalCp !== null) {
      const evalVal = (review.evalCp / 100).toFixed(1);
      evalText = ` • Eval: ${evalVal > 0 ? '+' : ''}${evalVal}`;
    }

    if (reviewBannerInfo) {
      const moveName = review.san || review.uci;
      reviewBannerInfo.textContent = `${moveName} • Accuracy ${review.accuracy}%${evalText}`;
    }

    moveReviewBanner.style.display = 'flex';
  }

  // --- Floating Toast Notification ---
  let toastTimeout = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2400);
  }

  // --- Centered Timer Modal Controller ---
  function openTimerModal() {
    // Cannot modify timer mid-game
    if (historyMoves.length > 0 && !game.game_over()) {
      showToast('Timer locked during active match. Tap Reset to change.');
      if (typeof chessHaptics !== 'undefined') {
        chessHaptics.tap();
      }
      return;
    }

    modalTimeSettings = { ...playerTimeSettings };
    modalIsCustom = { ...playerIsCustom };
    modalStepperMins = {
      w: typeof modalTimeSettings.w === 'number' ? Math.max(1, Math.round(modalTimeSettings.w / 60)) : 5,
      b: typeof modalTimeSettings.b === 'number' ? Math.max(1, Math.round(modalTimeSettings.b / 60)) : 5
    };

    if (timerNameW) timerNameW.textContent = playerProfiles.w.name;
    if (timerNameB) timerNameB.textContent = playerProfiles.b.name;

    const areSynced = modalTimeSettings.w === modalTimeSettings.b && modalIsCustom.w === modalIsCustom.b;
    if (timerSyncToggle) timerSyncToggle.checked = areSynced;

    renderModalPlayerTimer('w');
    renderModalPlayerTimer('b');

    if (timerModal) timerModal.style.display = 'flex';
    if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
  }

  function closeTimerModal() {
    if (timerModal) timerModal.style.display = 'none';
    if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
  }

  function renderModalPlayerTimer(player) {
    const currentVal = modalTimeSettings[player];
    const isCustom = modalIsCustom[player];
    const container = document.querySelector(`.timer-presets[data-player="${player}"]`);
    if (!container) return;

    const pills = container.querySelectorAll('.preset-pill');
    pills.forEach(pill => {
      const dataTime = pill.dataset.time;
      let active = false;
      if (isCustom) {
        active = (dataTime === 'custom');
      } else if (dataTime === 'infinite' && currentVal === 'infinite') {
        active = true;
      } else if (!isCustom && String(currentVal) === dataTime) {
        active = true;
      }

      if (active) pill.classList.add('active');
      else pill.classList.remove('active');
    });

    const customRow = document.getElementById(`timer-custom-row-${player}`);
    const stepperVal = document.getElementById(`stepper-val-${player}`);
    if (customRow && stepperVal) {
      if (isCustom) {
        customRow.style.display = 'flex';
        stepperVal.textContent = modalStepperMins[player];
      } else {
        customRow.style.display = 'none';
      }
    }
  }

  function setModalPlayerTime(player, value, isCustomMode = false) {
    modalTimeSettings[player] = value;
    modalIsCustom[player] = isCustomMode;
    if (timerSyncToggle && timerSyncToggle.checked) {
      const other = player === 'w' ? 'b' : 'w';
      modalTimeSettings[other] = value;
      modalIsCustom[other] = isCustomMode;
      modalStepperMins[other] = modalStepperMins[player];
      renderModalPlayerTimer(other);
    }
    renderModalPlayerTimer(player);
  }

  function adjustStepper(player, delta) {
    let current = modalStepperMins[player] + delta;
    if (current < 1) current = 1;
    if (current > 180) current = 180;
    modalStepperMins[player] = current;
    modalIsCustom[player] = true;
    setModalPlayerTime(player, current * 60, true);
    if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
  }

  function applyTimerSettings() {
    playerTimeSettings = { ...modalTimeSettings };
    playerIsCustom = { ...modalIsCustom };
    try {
      localStorage.setItem('minchess_timer_settings_v3', JSON.stringify({
        settings: playerTimeSettings,
        isCustom: playerIsCustom,
        stepperMins: modalStepperMins
      }));
    } catch (e) {}

    resetClocks();
    closeTimerModal();

    if (historyMoves.length >= 1 && !game.game_over()) {
      startClock();
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
      if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
      chessAudio.toggleMute();
      updateAudioUI();
    });

    // Theme toggle (Dark / Light)
    if (btnTheme) {
      btnTheme.addEventListener('click', (e) => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        toggleTheme(e);
      });
    }

    // Piece flip toggle (active player piece rotation)
    if (btnPieceFlip) {
      btnPieceFlip.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        pieceFlipEnabled = !pieceFlipEnabled;
        localStorage.setItem('minchess_pieceflip_v2', pieceFlipEnabled);
        updatePieceFlipUI();
        applyBoardOrientation();
      });
    }

    // Auto-flip board toggle
    if (btnAutoFlip) {
      btnAutoFlip.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        autoFlipEnabled = !autoFlipEnabled;
        localStorage.setItem('minchess_autoflip_v2', autoFlipEnabled);
        updateAutoFlipUI();
        applyBoardOrientation();
      });
    }

    // Move history Back & Forward buttons
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        stepBack();
      });
    }
    if (btnForward) {
      btnForward.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        stepForward();
      });
    }

    // Tabletop mode toggle
    if (btnTabletop) {
      btnTabletop.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        isTabletopMode = !isTabletopMode;
        localStorage.setItem('minchess_tabletop', isTabletopMode);
        updateTabletopUI();
        renderBoard();
      });
    }

    // Undo move
    btnUndo.addEventListener('click', () => {
      if (game.history().length > 0) {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        game.undo();
        historyFens.pop();
        historyMoves.pop();
        currentViewIndex = historyFens.length - 1;
        selectedSquare = null;
        legalMovesForSelected = [];
        if (historyMoves.length === 0) {
          resetClocks();
        }
        renderBoard(game);
        updateStatus();
        updateHistoryNavButtons();
        chessAudio.playMove();
      }
    });

    // Reset / New game
    btnNewGame.addEventListener('click', () => {
      if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
      if (confirm('Start a new game?')) {
        startNewGame();
      }
    });

    // Timer triggers
    if (btnTimer) btnTimer.addEventListener('click', openTimerModal);
    if (clockTop) clockTop.addEventListener('click', openTimerModal);
    if (clockBottom) clockBottom.addEventListener('click', openTimerModal);
    if (btnApplyTimer) btnApplyTimer.addEventListener('click', () => {
      if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
      applyTimerSettings();
    });
    if (btnCancelTimer) btnCancelTimer.addEventListener('click', () => {
      if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
      closeTimerModal();
    });

    if (timerModal) {
      timerModal.addEventListener('click', e => {
        if (e.target === timerModal) closeTimerModal();
      });
    }

    // Timer presets
    document.querySelectorAll('.timer-presets .preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        const player = btn.parentElement.dataset.player;
        const timeVal = btn.dataset.time;
        if (timeVal === 'infinite') {
          setModalPlayerTime(player, 'infinite', false);
        } else if (timeVal === 'custom') {
          setModalPlayerTime(player, modalStepperMins[player] * 60, true);
        } else {
          setModalPlayerTime(player, Number(timeVal), false);
        }
      });
    });

    // Timer minute steppers
    const decW = document.getElementById('stepper-dec-w');
    const incW = document.getElementById('stepper-inc-w');
    const decB = document.getElementById('stepper-dec-b');
    const incB = document.getElementById('stepper-inc-b');
    if (decW) decW.addEventListener('click', () => adjustStepper('w', -1));
    if (incW) incW.addEventListener('click', () => adjustStepper('w', 1));
    if (decB) decB.addEventListener('click', () => adjustStepper('b', -1));
    if (incB) incB.addEventListener('click', () => adjustStepper('b', 1));

    if (timerSyncToggle) {
      timerSyncToggle.addEventListener('change', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        if (timerSyncToggle.checked) {
          setModalPlayerTime('w', modalTimeSettings.w, modalIsCustom.w);
        }
      });
    }

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
      if (isOnlineMatch && typeof chessMultiplayer !== 'undefined') {
        chessMultiplayer.requestRematch();
        showToast('Rematch request sent to opponent...');
      } else {
        startNewGame();
      }
    });

    btnDismissModal.addEventListener('click', () => {
      gameOverModal.style.display = 'none';
    });

    if (btnReviewGamePrompt) {
      btnReviewGamePrompt.addEventListener('click', () => {
        gameOverModal.style.display = 'none';
        startAutomaticGameReview(gameOverTitle.textContent, gameOverWinner.textContent, statOutcome.textContent);
      });
    }

    if (btnReviewInspect) {
      btnReviewInspect.addEventListener('click', () => {
        closeReviewModal();
        isReviewModeActive = true;
        currentViewIndex = historyMoves.length;
        renderView();
        showToast('Use Back/Forward buttons or Move History to review moves.');
      });
    }

    if (btnReviewPlayAgain) {
      btnReviewPlayAgain.addEventListener('click', () => {
        closeReviewModal();
        if (isOnlineMatch && typeof chessMultiplayer !== 'undefined') {
          chessMultiplayer.requestRematch();
        } else {
          startNewGame();
        }
      });
    }

    if (btnReviewClose) {
      btnReviewClose.addEventListener('click', closeReviewModal);
    }

    if (btnReopenReview) {
      btnReopenReview.addEventListener('click', () => {
        if (reviewModal && currentReviewData) {
          if (reviewCalcState) reviewCalcState.style.display = 'none';
          if (reviewResultsState) reviewResultsState.style.display = 'block';
          reviewModal.style.display = 'flex';
        }
      });
    }

    if (historyList) {
      historyList.addEventListener('click', (e) => {
        const moveSpan = e.target.closest('.history-move');
        if (moveSpan && moveSpan.dataset.moveIdx !== undefined) {
          const idx = parseInt(moveSpan.dataset.moveIdx, 10);
          if (!isNaN(idx) && idx + 1 < historyFens.length) {
            currentViewIndex = idx + 1;
            renderView();
            if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
          }
        }
      });
    }

    // Multiplayer triggers
    if (btnMultiplayer) {
      btnMultiplayer.addEventListener('click', openMultiplayerModal);
    }
    if (btnMpStatus) {
      btnMpStatus.addEventListener('click', openMultiplayerModal);
    }
    if (btnMpCreate) {
      btnMpCreate.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();

        // Apply synchronized time control to both players ("same for both")
        const chosenTime = mpIsCustom ? (mpCustomMins * 60) : mpSelectedTime;
        playerTimeSettings = { w: chosenTime, b: chosenTime };
        playerIsCustom = { w: mpIsCustom, b: mpIsCustom };
        modalStepperMins = { w: mpCustomMins, b: mpCustomMins };
        resetClocks();

        const roomId = chessMultiplayer.createRoom(onlineSelectedColorChoice, playerTimeSettings);
        onlineRoomId = roomId;
        isOnlineMatch = true;
        onlineMyColor = chessMultiplayer.myColor;
        document.body.classList.add('in-online-match');

        const shareUrl = chessMultiplayer.getShareableLink();
        copyToClipboard(shareUrl);
        window.history.replaceState({}, '', shareUrl);

        applyBoardOrientation();
        renderPlayerProfiles();

        closeMultiplayerModal();
        showToast('Link copied to clipboard! Share it with your opponent.');
      });
    }
    if (mpTimerPresets) {
      mpTimerPresets.addEventListener('click', (e) => {
        const pill = e.target.closest('.preset-pill');
        if (!pill) return;
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();

        const timeVal = pill.dataset.time;
        if (timeVal === 'custom') {
          mpIsCustom = true;
          mpSelectedTime = mpCustomMins * 60;
        } else if (timeVal === 'infinite') {
          mpIsCustom = false;
          mpSelectedTime = 'infinite';
        } else {
          mpIsCustom = false;
          mpSelectedTime = Number(timeVal);
        }
        syncMpModalTimerUi();
      });
    }
    if (mpStepperDec) {
      mpStepperDec.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        if (mpCustomMins > 1) {
          mpCustomMins--;
          mpSelectedTime = mpCustomMins * 60;
          if (mpStepperVal) mpStepperVal.textContent = String(mpCustomMins);
        }
      });
    }
    if (mpStepperInc) {
      mpStepperInc.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        if (mpCustomMins < 60) {
          mpCustomMins++;
          mpSelectedTime = mpCustomMins * 60;
          if (mpStepperVal) mpStepperVal.textContent = String(mpCustomMins);
        }
      });
    }
    if (btnMpCancel) {
      btnMpCancel.addEventListener('click', closeMultiplayerModal);
    }
    if (btnMpClose) {
      btnMpClose.addEventListener('click', closeMultiplayerModal);
    }
    if (btnMpCopyLink) {
      btnMpCopyLink.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        const shareUrl = chessMultiplayer.getShareableLink();
        copyToClipboard(shareUrl);
        showToast('Link copied to clipboard!');
      });
    }
    if (btnMpLeave) {
      btnMpLeave.addEventListener('click', () => {
        if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
        if (confirm('Leave online match and return to local pass-and-play?')) {
          leaveOnlineMatch();
        }
      });
    }
    if (mpColorChoices) {
      mpColorChoices.querySelectorAll('.mp-color-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
          mpColorChoices.querySelectorAll('.mp-color-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          onlineSelectedColorChoice = pill.dataset.color;
        });
      });
    }
    if (multiplayerModal) {
      multiplayerModal.addEventListener('click', e => {
        if (e.target === multiplayerModal) closeMultiplayerModal();
      });
    }

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

  // --- Multiplayer Integration Logic ---
  function setupMultiplayer() {
    if (typeof chessMultiplayer === 'undefined') return;

    // Status change listener (disconnected, waiting, connected)
    chessMultiplayer.onStatusChange = (status) => {
      isOnlinePeerConnected = (status === 'connected');

      if (btnMpStatus) {
        if (status === 'connected') {
          // Connected state: Turn GREEN! (Image 2)
          btnMpStatus.className = 'icon-btn circle-btn mp-status-btn connected';
          btnMpStatus.title = 'Multiplayer: Opponent Connected (Active match)';
          if (mpModalStatusDot) mpModalStatusDot.className = 'mp-status-dot active';
          if (mpRoomStatusText) mpRoomStatusText.textContent = 'Opponent connected!';
        } else if (status === 'waiting') {
          // Waiting state: Amber pulse
          btnMpStatus.className = 'icon-btn circle-btn mp-status-btn waiting';
          btnMpStatus.title = 'Multiplayer: Waiting for opponent to join...';
          if (mpModalStatusDot) mpModalStatusDot.className = 'mp-status-dot waiting';
          if (mpRoomStatusText) mpRoomStatusText.textContent = 'Waiting for friend to join...';
        } else {
          // Inactive / local play: Neutral gray
          btnMpStatus.className = 'icon-btn circle-btn mp-status-btn';
          btnMpStatus.title = 'Multiplayer: Local play';
          if (mpModalStatusDot) mpModalStatusDot.className = 'mp-status-dot';
          if (mpRoomStatusText) mpRoomStatusText.textContent = 'Local game';
        }
      }
    };

    // When opponent joins room
    chessMultiplayer.onPeerJoin = () => {
      chessAudio.playCheck();
      if (typeof chessHaptics !== 'undefined') chessHaptics.capture();

      if (chessMultiplayer.isHost) {
        showToast('Opponent joined! Game started.');
        // Host synchronizes authoritative game state to guest
        chessMultiplayer.sendSyncState({
          fen: game.fen(),
          moves: historyMoves,
          turn: game.turn(),
          timeSettings: playerTimeSettings,
          timeLeft: playerTimeLeft,
          historyMoves: historyMoves
        });
      } else {
        onlineMyColor = chessMultiplayer.myColor;
        if (data && data.timeSettings) {
          playerTimeSettings = data.timeSettings;
          resetClocks();
        }
        applyBoardOrientation();
        renderPlayerProfiles();
        showToast(`Connected! You play as ${onlineMyColor === 'w' ? 'White' : 'Black'}.`);
      }
    };

    // When opponent leaves / disconnects
    chessMultiplayer.onPeerLeave = () => {
      showToast('Opponent disconnected. Waiting for them to rejoin...');
    };

    // Move received from opponent
    chessMultiplayer.onMoveReceived = (data) => {
      if (data && data.move) {
        if (data.clocks) {
          playerTimeLeft = data.clocks;
          updateClockDisplays();
        }
        executeMove(data.move, true);
      }
    };

    // Full state synchronization
    chessMultiplayer.onSyncReceived = (data) => {
      if (!chessMultiplayer.isHost) {
        if (chessMultiplayer.myColor) {
          onlineMyColor = chessMultiplayer.myColor;
        }
        applyBoardOrientation();

        if (data.timeSettings) {
          playerTimeSettings = data.timeSettings;
        }
        if (data.timeLeft) {
          playerTimeLeft = data.timeLeft;
        }
        if (data.fen && data.fen !== game.fen()) {
          game = new Chess(data.fen);
          historyFens = [game.fen()];
          if (data.historyMoves) {
            historyMoves = data.historyMoves;
          }
          currentViewIndex = historyFens.length - 1;
        }

        renderBoard(game);
        renderPlayerProfiles();
        updateStatus();
        updateClockDisplays();
        if (historyMoves.length >= 1 && !game.game_over()) {
          startClock();
        }
      }
    };

    // Rematch triggers
    chessMultiplayer.onRematchRequested = () => {
      showToast('Opponent requested a rematch. Tap Play Again to accept.');
    };

    chessMultiplayer.onRematchAccepted = (data) => {
      showToast('Rematch accepted! Starting new game...');
      if (!chessMultiplayer.isHost && data.guestColor) {
        onlineMyColor = data.guestColor;
      }
      startNewGame(false);
      applyBoardOrientation();
      renderPlayerProfiles();
    };
  }

  function checkUrlForGame() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const gameParam = urlParams.get('game');
      if (gameParam) {
        joinOnlineMatch(gameParam);
      }
    } catch (e) {}
  }

  function joinOnlineMatch(roomId) {
    isOnlineMatch = true;
    onlineRoomId = roomId;
    document.body.classList.add('in-online-match');

    if (btnMpStatus) {
      btnMpStatus.className = 'icon-btn circle-btn mp-status-btn waiting';
      btnMpStatus.title = 'Multiplayer: Connecting to room...';
    }
    showToast(`Joining room ${roomId}...`);

    chessMultiplayer.joinRoom(roomId);
  }

  function syncMpModalTimerUi() {
    if (!mpTimerPresets) return;
    const pills = mpTimerPresets.querySelectorAll('.preset-pill');
    pills.forEach(pill => {
      const dataTime = pill.dataset.time;
      if (mpIsCustom) {
        pill.classList.toggle('active', dataTime === 'custom');
      } else {
        pill.classList.toggle('active', dataTime === String(mpSelectedTime));
      }
    });

    if (mpTimerCustomRow) {
      mpTimerCustomRow.style.display = mpIsCustom ? 'flex' : 'none';
    }
    if (mpStepperVal) {
      mpStepperVal.textContent = String(mpCustomMins);
    }
  }

  function openMultiplayerModal() {
    if (!isOnlineMatch) {
      if (mpCreateSection) mpCreateSection.style.display = 'block';
      if (mpActiveSection) mpActiveSection.style.display = 'none';
      if (mpModalTitle) mpModalTitle.textContent = 'Play with a Friend';
      if (mpModalSubtitle) mpModalSubtitle.textContent = 'Share a link to play together on two devices';
      syncMpModalTimerUi();
    } else {
      if (mpCreateSection) mpCreateSection.style.display = 'none';
      if (mpActiveSection) mpActiveSection.style.display = 'block';
      if (mpModalTitle) mpModalTitle.textContent = 'Active Match';
      if (mpModalSubtitle) mpModalSubtitle.textContent = `Room Code: ${onlineRoomId}`;
      if (mpLinkInput) mpLinkInput.value = chessMultiplayer.getShareableLink();
      if (mpMySide) {
        mpMySide.innerHTML = `Playing as: <strong>${onlineMyColor === 'w' ? 'White' : 'Black'}</strong>`;
      }
      if (mpActiveTimer) {
        let label = '∞';
        if (playerTimeSettings.w !== 'infinite') {
          label = `${Math.round(Number(playerTimeSettings.w) / 60)} min`;
        }
        mpActiveTimer.innerHTML = `Timer: <strong>${label}</strong>`;
      }
    }
    if (multiplayerModal) multiplayerModal.style.display = 'flex';
    if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
  }

  function closeMultiplayerModal() {
    if (multiplayerModal) multiplayerModal.style.display = 'none';
    if (typeof chessHaptics !== 'undefined') chessHaptics.tap();
  }

  function leaveOnlineMatch() {
    chessMultiplayer.disconnect(true);
    isOnlineMatch = false;
    onlineMyColor = 'w';
    onlineRoomId = null;
    document.body.classList.remove('in-online-match');
    window.history.replaceState({}, '', window.location.pathname);
    closeMultiplayerModal();
    startNewGame(false);
    showToast('Returned to local pass-and-play.');
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function startNewGame(playSound = true) {
    currentReviewData = null;
    isReviewModeActive = false;
    if (moveReviewBanner) moveReviewBanner.style.display = 'none';
    if (reviewModal) reviewModal.style.display = 'none';
    if (typeof chessAnalysisEngine !== 'undefined') {
      chessAnalysisEngine.terminate();
    }
    game = new Chess();
    historyFens = [game.fen()];
    historyMoves = [];
    currentViewIndex = 0;
    selectedSquare = null;
    legalMovesForSelected = [];
    manualBoardFlipped = false;
    resetClocks();
    applyBoardOrientation();
    renderBoard(game);
    updateStatus();
    updateHistoryNavButtons();
    updateHistoryList([]);
    if (playSound) chessAudio.playMove();
  }

  // Expose helpers for testing & debug
  window.joinOnlineMatch = joinOnlineMatch;
  window.leaveOnlineMatch = leaveOnlineMatch;
  window.openMultiplayerModal = openMultiplayerModal;
  window.startAutomaticGameReview = startAutomaticGameReview;
  window.closeReviewModal = closeReviewModal;

  // Launch!
  init();
})();
