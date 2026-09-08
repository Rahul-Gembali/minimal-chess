# Minimal Chess ♟️

A clean, distraction-free, two-player pass-and-play chess game designed for mobile phones and laptops on a single device. Built with pure vanilla web technologies, custom silhouette pieces, and fluid animations.

🌐 **Live Demo**: [https://rahul-gembali.github.io/minimal-chess/](https://rahul-gembali.github.io/minimal-chess/)

---

## ✨ Highlights & Features

- **Minimalist Aesthetic**: Borderless canvas (`#fdfdfd`), soft gray move indicators, pastel blue move highlights (`#dbeafe`), and clean silhouette pieces in Charcoal (`#262626`) and Soft Grey (`#a8a8a8`).
- **Pass-and-Play Ergonomics**:
  - Designed for two players sitting across each other on a table with a phone or laptop.
  - **In-Place Component Rotation**: When Black's turn comes, board pieces, avatar silhouettes, player name, and turn badge smoothly rotate 180° in place so the opposite player views everything right-side up. Zero disorienting card swings.
  - **Stationary Board**: Board remains stationary between players (board auto-flip can be toggled if desired).
  - **Tabletop Mode**: Dual-facing piece orientation where top pieces permanently face across the table.
- **Move History Stepping**:
  - **Back (`<`)** & **Forward (`>`)** buttons in the footer allow browsing earlier moves at any time.
  - Tapping any piece while reviewing immediately returns to the live board so you can make your move without interruption.
- **Player Customization**:
  - Editable player names with instant local persistence.
  - Custom piece profile avatars (King, Queen, Knight, Bishop, Rook, or Pawn).
- **Chess.com-Style Material Score**:
  - Automatic piece difference counting (+1, +3, +9) displayed with captured piece trays.
- **Full FIDE Engine Support**:
  - Castling (kingside and queenside).
  - En passant captures.
  - Pawn promotion selector modal (Queen, Knight, Rook, Bishop).
  - Checkmate, stalemate, 50-move rule, and 3-fold repetition detection.
- **Natural Audio & Zero Dependencies**:
  - Web Audio API synthesizer for move clicks, captures, check chimes, and victory fanfare. No audio asset downloads required.
  - Pure static HTML5, CSS3, and modern JavaScript.

---

## 🚀 Getting Started

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Rahul-Gembali/minimal-chess.git
   cd minimal-chess
   ```

2. Open `index.html` in any browser, or start a lightweight local server:
   ```bash
   # Using Python 3
   python -m http.server 8080

   # Or using Node.js npx
   npx serve .
   ```

3. Open your browser to `http://localhost:8080`.

### Running Tests

Automated chess rules and mechanics tests are included in `tests/test_chess.js`:
```bash
node tests/test_chess.js
```

---

## 🛠️ Tech Stack

- **HTML5 & CSS3**: Responsive grid layout, CSS 3D perspective transforms, and mobile touch optimization (`touch-action: manipulation`).
- **JavaScript (ES6+)**: Custom game state controller, event unification (touch & pointer drag-and-drop), and history management.
- **Chess Engine**: Cleaned client-side chess rule validator.
- **Web Audio API**: Synthetic organic acoustic sounds for pieces.

---

## 📄 License

MIT License. Free to use, modify, and distribute.
