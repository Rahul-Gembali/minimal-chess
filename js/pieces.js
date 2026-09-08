// Custom minimal chess piece graphics & avatars
// Based on exact reference silhouettes

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

// SVG Paths extracted from reference silhouettes
const PIECE_PATHS = {
  pawn: "M 22.0,9.0 L 27.0,10.0 L 29.0,12.0 L 30.0,16.0 L 28.0,20.0 L 25.0,22.0 L 26.0,24.0 L 29.0,27.0 L 30.0,32.0 L 29.0,36.0 L 25.0,37.0 L 20.0,37.0 L 15.0,36.0 L 14.0,32.0 L 15.0,27.0 L 18.0,24.0 L 19.0,22.0 L 16.0,20.0 L 14.0,16.0 L 15.0,12.0 L 17.0,10.0 Z",
  rook: "M 15.0,10.0 L 19.0,10.0 L 19.0,13.0 L 21.0,13.0 L 21.0,10.0 L 27.0,10.0 L 27.0,13.0 L 29.0,13.0 L 29.0,10.0 L 33.0,10.0 L 34.0,16.0 L 31.0,22.0 L 29.0,24.0 L 29.0,28.0 L 32.0,32.0 L 33.0,36.0 L 30.0,38.0 L 18.0,38.0 L 15.0,36.0 L 16.0,32.0 L 19.0,28.0 L 19.0,24.0 L 17.0,22.0 L 14.0,16.0 Z",
  knight: "M 22.0,9.0 L 28.0,11.0 L 32.0,15.0 L 34.0,20.0 L 33.0,27.0 L 31.0,32.0 L 30.0,37.0 L 27.0,38.0 L 19.0,38.0 L 16.0,36.0 L 17.0,32.0 L 20.0,29.0 L 22.0,26.0 L 21.0,24.0 L 16.0,22.0 L 14.0,19.0 L 14.0,16.0 L 17.0,13.0 Z",
  bishop: "M 22.0,7.0 L 24.0,8.0 L 24.0,10.0 L 22.0,11.0 L 20.0,10.0 L 20.0,8.0 Z M 21.0,13.0 L 26.0,16.0 L 28.0,20.0 L 28.0,24.0 L 26.0,28.0 L 28.0,30.0 L 28.0,34.0 L 25.0,37.0 L 19.0,37.0 L 16.0,34.0 L 16.0,30.0 L 18.0,28.0 L 16.0,24.0 L 16.0,20.0 L 18.0,16.0 Z",
  queen: "M 22.0,7.0 L 24.0,8.0 L 24.0,11.0 L 22.0,12.0 L 20.0,11.0 L 20.0,8.0 Z M 11.0,16.0 L 15.0,16.0 L 17.0,19.0 L 22.0,21.0 L 27.0,19.0 L 29.0,16.0 L 33.0,16.0 L 32.0,22.0 L 29.0,26.0 L 27.0,30.0 L 26.0,36.0 L 18.0,36.0 L 17.0,30.0 L 15.0,26.0 L 12.0,22.0 Z",
  king: "M 21.0,7.0 L 23.0,7.0 L 23.0,9.0 L 25.0,9.0 L 25.0,11.0 L 23.0,11.0 L 23.0,13.0 L 21.0,13.0 L 21.0,11.0 L 19.0,11.0 L 19.0,9.0 L 21.0,9.0 Z M 14.0,16.0 L 30.0,16.0 L 33.0,20.0 L 31.0,25.0 L 28.0,28.0 L 26.0,31.0 L 25.0,37.0 L 19.0,37.0 L 18.0,31.0 L 16.0,28.0 L 13.0,25.0 L 11.0,20.0 Z"
};

const PIECE_NAME_MAP = {
  p: 'pawn',
  r: 'rook',
  n: 'knight',
  b: 'bishop',
  q: 'queen',
  k: 'king'
};

const PIECE_COLORS = {
  b: '#262626', // Charcoal / Black
  w: '#a8a8a8'  // Soft Matte Grey / White
};

/**
 * Returns an HTML string representing the chess piece.
 * Uses crisp retina PNG assets with direct SVG fallback.
 */
function getPieceElement(type, color, className = 'chess-piece') {
  const name = PIECE_NAME_MAP[type.toLowerCase()] || 'pawn';
  const prefix = color.toLowerCase() === 'w' ? 'w' : 'b';
  const assetPath = `assets/pieces/${prefix}_${name}.png`;
  
  return `<img src="${assetPath}" class="${className}" alt="${prefix} ${name}" draggable="false" />`;
}

/**
 * Returns inline SVG for profile avatars or small UI indicators
 */
function getPieceSvg(type, colorHex = '#262626', size = 32) {
  const name = PIECE_NAME_MAP[type.toLowerCase()] || type.toLowerCase();
  const path = PIECE_PATHS[name] || PIECE_PATHS.pawn;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 44 44" fill="${colorHex}" xmlns="http://www.w3.org/2000/svg">
      <path d="${path}" fill-rule="evenodd" clip-rule="evenodd" />
    </svg>
  `;
}

// Available avatar choices
const AVAILABLE_AVATARS = ['k', 'q', 'n', 'b', 'r', 'p'];

// Global export for browsers
if (typeof window !== 'undefined') {
  window.PIECE_VALUES = PIECE_VALUES;
  window.PIECE_PATHS = PIECE_PATHS;
  window.PIECE_NAME_MAP = PIECE_NAME_MAP;
  window.PIECE_COLORS = PIECE_COLORS;
  window.getPieceElement = getPieceElement;
  window.getPieceSvg = getPieceSvg;
  window.AVAILABLE_AVATARS = AVAILABLE_AVATARS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PIECE_VALUES,
    PIECE_PATHS,
    PIECE_NAME_MAP,
    PIECE_COLORS,
    getPieceElement,
    getPieceSvg,
    AVAILABLE_AVATARS
  };
}
