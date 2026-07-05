import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { getValidMoves } from './logic/chessEngine';
import generatedLevels from './logic/generated_levels.json';

const PIECE_SYMBOLS = {
  KING: '♚',
  QUEEN: '♛',
  ROOK: '♜',
  BISHOP: '♝',
  KNIGHT: '♞'
};

// ── Board Component ──────────────────────────────────────────────────────────
const Board = ({
  board,
  isInteractive,
  selectedCell,
  validMoves,
  onCellClick,
  // Drag props
  draggingFrom,
  onDragStart,
  onDragEnter,
  onDragEnd,
  dragOverCell,
}) => {
  return (
    <div className={`board ${isInteractive ? 'interactive' : 'locked'}`}>
      {board.map((piece, index) => {
        const isSelected = selectedCell === index || draggingFrom === index;
        const isValidMove = validMoves.includes(index);
        const isDragOver = dragOverCell === index && isValidMove;

        return (
          <div
            key={index}
            className={[
              'cell',
              isSelected ? 'selected' : '',
              isValidMove ? 'valid-move' : '',
              isDragOver ? 'drag-over' : '',
              draggingFrom === index ? 'dragging-source' : '',
            ].join(' ')}
            onClick={() => isInteractive && onCellClick && onCellClick(index)}
            onPointerEnter={() => isInteractive && onDragEnter && onDragEnter(index)}
          >
            {piece && (
              <span
                className={`piece ${isSelected ? 'selected' : ''}`}
                onPointerDown={(e) => {
                  if (!isInteractive) return;
                  onDragStart && onDragStart(e, index);
                }}
              >
                {PIECE_SYMBOLS[piece.type]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Ghost piece that follows pointer ─────────────────────────────────────────
const DragGhost = ({ piece, pos }) => {
  if (!piece || !pos) return null;
  return (
    <div
      className="drag-ghost"
      style={{ left: pos.x, top: pos.y }}
    >
      {PIECE_SYMBOLS[piece.type]}
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [phase, setPhase] = useState('OBSERVATION');
  const [timeRemaining, setTimeRemaining] = useState(30);

  const [targetBoard, setTargetBoard] = useState(Array(9).fill(null));
  const [currentBoard, setCurrentBoard] = useState(Array(9).fill(null));

  const [selectedCell, setSelectedCell] = useState(null);
  const [validMoves, setValidMoves] = useState([]);

  const [bidMoves, setBidMoves] = useState(0);
  const [currentMovesCount, setCurrentMovesCount] = useState(0);
  const [bidInput, setBidInput] = useState('');

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [draggingFrom, setDraggingFrom] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const boardRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartPos = useRef(null);

  // ── Level loading ──────────────────────────────────────────────────────────
  const loadLevel = useCallback((levelIndex) => {
    const level = generatedLevels[levelIndex];
    setTargetBoard(level.targetBoard);
    setCurrentBoard(level.startBoard);
    setPhase('OBSERVATION');
    setTimeRemaining(30);
    setBidMoves(0);
    setCurrentMovesCount(0);
    setSelectedCell(null);
    setValidMoves([]);
    setDraggingFrom(null);
    setDragPos(null);
    setDragOverCell(null);
  }, []);

  useEffect(() => { loadLevel(currentLevel); }, [currentLevel, loadLevel]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    if (phase === 'OBSERVATION' && timeRemaining > 0) {
      timer = setTimeout(() => setTimeRemaining(t => t - 1), 1000);
    } else if (phase === 'OBSERVATION' && timeRemaining === 0) {
      setPhase('BIDDING');
    }
    return () => clearTimeout(timer);
  }, [phase, timeRemaining]);

  // ── Win condition ──────────────────────────────────────────────────────────
  const checkWinCondition = useCallback((board, movesUsed) => {
    const isMatch = board.every((piece, i) => {
      const tp = targetBoard[i];
      if (piece === null && tp === null) return true;
      if (piece !== null && tp !== null) return piece.id === tp.id;
      return false;
    });

    if (isMatch) {
      setPhase('VICTORY');
    } else if (movesUsed >= bidMoves) {
      setPhase('GAMEOVER');
    }
  }, [targetBoard, bidMoves]);

  // ── Execute a move ─────────────────────────────────────────────────────────
  const executeMove = useCallback((fromIdx, toIdx) => {
    if (!getValidMoves(currentBoard[fromIdx].type, fromIdx, currentBoard).includes(toIdx)) return;

    const newBoard = [...currentBoard];
    newBoard[toIdx] = newBoard[fromIdx];
    newBoard[fromIdx] = null;
    setCurrentBoard(newBoard);

    const nextCount = currentMovesCount + 1;
    setCurrentMovesCount(nextCount);
    setSelectedCell(null);
    setValidMoves([]);
    checkWinCondition(newBoard, nextCount);
  }, [currentBoard, currentMovesCount, checkWinCondition]);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleCellClick = useCallback((index) => {
    if (phase !== 'EXECUTION') return;
    if (isDragging.current) return; // ignore click if it was a drag

    if (selectedCell === null) {
      if (currentBoard[index]) {
        setSelectedCell(index);
        setValidMoves(getValidMoves(currentBoard[index].type, index, currentBoard));
      }
    } else {
      if (validMoves.includes(index)) {
        executeMove(selectedCell, index);
      } else if (currentBoard[index]) {
        setSelectedCell(index);
        setValidMoves(getValidMoves(currentBoard[index].type, index, currentBoard));
      } else {
        setSelectedCell(null);
        setValidMoves([]);
      }
    }
  }, [phase, selectedCell, currentBoard, validMoves, executeMove]);

  // ── Drag handlers (Pointer Events API) ────────────────────────────────────
  const handleDragStart = useCallback((e, fromIdx) => {
    if (phase !== 'EXECUTION') return;
    e.target.setPointerCapture(e.pointerId);
    isDragging.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    setDraggingFrom(fromIdx);
    setSelectedCell(fromIdx);
    setValidMoves(getValidMoves(currentBoard[fromIdx].type, fromIdx, currentBoard));

    setDragPos({ x: e.clientX, y: e.clientY });

    const onMove = (ev) => {
      const dx = ev.clientX - dragStartPos.current.x;
      const dy = ev.clientY - dragStartPos.current.y;
      if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) > 8) {
        isDragging.current = true;
      }
      if (isDragging.current) {
        setDragPos({ x: ev.clientX, y: ev.clientY });
      }
    };

    const onUp = (ev) => {
      e.target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      if (isDragging.current) {
        // Determine target cell from pointer position
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const cellEl = el && el.closest('.cell');
        if (cellEl) {
          const board = cellEl.closest('.board');
          if (board) {
            const cells = Array.from(board.querySelectorAll('.cell'));
            const toIdx = cells.indexOf(cellEl);
            if (toIdx !== -1 && toIdx !== fromIdx) {
              setDraggingFrom(null);
              setDragPos(null);
              setDragOverCell(null);
              isDragging.current = false;
              executeMove(fromIdx, toIdx);
              return;
            }
          }
        }
      }

      // Not a drag — treat as click (state already set above)
      setDraggingFrom(null);
      setDragPos(null);
      setDragOverCell(null);
      isDragging.current = false;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [phase, currentBoard, executeMove]);

  const handleDragEnter = useCallback((index) => {
    setDragOverCell(index);
  }, []);

  // ── Bid submit ─────────────────────────────────────────────────────────────
  const handleBidSubmit = (e) => {
    e.preventDefault();
    const bid = parseInt(bidInput, 10);
    if (!isNaN(bid) && bid > 0) {
      setBidMoves(bid);
      setPhase('EXECUTION');
      setBidInput('');
    }
  };

  const level = generatedLevels[currentLevel];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <header className="header">
        <div className="header-title">Chess 3×3</div>
        <div className="header-meta">
          Nivel {currentLevel + 1}
          {level && <span className="header-optimal"> · óptimo: {level.optimalMoves}</span>}
        </div>
        <div className="header-timer">
          {phase === 'OBSERVATION' && `${timeRemaining.toString().padStart(2, '0')}s`}
          {phase === 'EXECUTION' && `${currentMovesCount} / ${bidMoves}`}
          {phase === 'BIDDING' && '—'}
          {(phase === 'VICTORY' || phase === 'GAMEOVER') && '—'}
        </div>
      </header>

      <main className="game-area" ref={boardRef}>
        <div className="board-container">
          <span className="board-label">🎯 Posición Objetivo</span>
          <Board
            board={targetBoard}
            isInteractive={false}
            selectedCell={null}
            validMoves={[]}
          />
        </div>

        <div className="board-container">
          <span className="board-label">
            {phase === 'OBSERVATION' ? '🔒 Observa' : '♟ Tu Tablero'}
          </span>
          <Board
            board={currentBoard}
            isInteractive={phase === 'EXECUTION'}
            selectedCell={selectedCell}
            validMoves={validMoves}
            onCellClick={handleCellClick}
            draggingFrom={draggingFrom}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            dragOverCell={dragOverCell}
          />
        </div>
      </main>

      {/* Ghost pieza arrastrando */}
      {draggingFrom !== null && dragPos && isDragging.current && (
        <DragGhost piece={currentBoard[draggingFrom]} pos={dragPos} />
      )}

      {/* Modal Apuesta */}
      {phase === 'BIDDING' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>¿En cuántos movimientos?</h2>
            <p className="modal-hint">El óptimo es {level?.optimalMoves} movimientos</p>
            <form onSubmit={handleBidSubmit}>
              <input
                type="number"
                min="1"
                value={bidInput}
                onChange={e => setBidInput(e.target.value)}
                placeholder="Introduce un número"
                autoFocus
              />
              <button type="submit">¡Lo tengo!</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fin de juego */}
      {(phase === 'VICTORY' || phase === 'GAMEOVER') && (
        <div className="modal-overlay">
          <div className="modal-content">
            {phase === 'VICTORY' ? (
              <h2 className="victory-text">¡Victoria! 🎉</h2>
            ) : (
              <h2 className="defeat-text">Fin del juego 💀</h2>
            )}
            <p className="modal-hint">
              {phase === 'VICTORY'
                ? `Resuelto en ${currentMovesCount} movimiento${currentMovesCount !== 1 ? 's' : ''} (óptimo: ${level?.optimalMoves})`
                : `Te has quedado sin movimientos. El óptimo era ${level?.optimalMoves}.`}
            </p>
            <div className="modal-buttons">
              <button onClick={() => loadLevel(currentLevel)}>Reintentar</button>
              {currentLevel < generatedLevels.length - 1 && phase === 'VICTORY' && (
                <button className="btn-success" onClick={() => setCurrentLevel(l => l + 1)}>
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
