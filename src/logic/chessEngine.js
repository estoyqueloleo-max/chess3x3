// Representación del tablero: Array de 9 posiciones (0-8)
// 0 1 2
// 3 4 5
// 6 7 8

const getCoords = (index) => ({
  row: Math.floor(index / 3),
  col: index % 3
});

const getIndex = (row, col) => row * 3 + col;

const isValidPos = (row, col) => row >= 0 && row <= 2 && col >= 0 && col <= 2;

// Obtener movimientos en línea recta (para Torre, Alfil, Reina)
const getLineMoves = (startIndex, board, directions) => {
  const moves = [];
  const startCoords = getCoords(startIndex);

  directions.forEach(([dRow, dCol]) => {
    let r = startCoords.row + dRow;
    let c = startCoords.col + dCol;

    while (isValidPos(r, c)) {
      const idx = getIndex(r, c);
      if (board[idx] !== null) {
        // En ajedrez 3x3 no hay capturas, y no se puede saltar, así que paramos
        break;
      }
      moves.push(idx);
      r += dRow;
      c += dCol;
    }
  });

  return moves;
};

export const getValidMoves = (pieceType, startIndex, board) => {
  const moves = [];
  const { row, col } = getCoords(startIndex);

  switch (pieceType) {
    case 'KNIGHT': {
      // Caballo: Movimientos en L. Puede saltar.
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      knightMoves.forEach(([dRow, dCol]) => {
        const r = row + dRow;
        const c = col + dCol;
        if (isValidPos(r, c)) {
          const idx = getIndex(r, c);
          if (board[idx] === null) {
            moves.push(idx);
          }
        }
      });
      break;
    }
    case 'ROOK': {
      // Torre: Ortogonal
      const rookDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      moves.push(...getLineMoves(startIndex, board, rookDirections));
      break;
    }
    case 'BISHOP': {
      // Alfil: Diagonal
      const bishopDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      moves.push(...getLineMoves(startIndex, board, bishopDirections));
      break;
    }
    case 'QUEEN': {
      // Reina: Ortogonal + Diagonal
      const queenDirections = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
      ];
      moves.push(...getLineMoves(startIndex, board, queenDirections));
      break;
    }
    case 'KING': {
      // Rey: 1 casilla cualquier dirección
      const kingDirections = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
      ];
      kingDirections.forEach(([dRow, dCol]) => {
        const r = row + dRow;
        const c = col + dCol;
        if (isValidPos(r, c)) {
          const idx = getIndex(r, c);
          if (board[idx] === null) {
            moves.push(idx);
          }
        }
      });
      break;
    }
  }

  return moves;
};
