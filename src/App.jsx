import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { getValidMoves } from './logic/chessEngine';
import generatedLevels from './logic/generated_levels.json';

// Barajar los niveles al inicio de la aplicación
const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const shuffledLevels = shuffleArray(generatedLevels);

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

// ── Flippable board wrapper (3D CSS flip) ────────────────────────────────────
const FlippableBoard = ({ frontBoard, backBoard, isFlipped, ...boardProps }) => (
  <div className="board-flip-wrapper">
    <div className={`board-flip-inner ${isFlipped ? 'flipped' : ''}`}>
      <div className="board-flip-front">
        <Board board={frontBoard} {...boardProps} />
      </div>
      <div className="board-flip-back">
        <Board board={backBoard} isInteractive={false} selectedCell={null} validMoves={[]} />
      </div>
    </div>
  </div>
);

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

  // ── Mecánica de tarjeta física ───────────────────────────────────────────
  // isInverted: los tableros han sido intercambiados (start ↔ target)
  const [isInverted, setIsInverted] = useState(false);
  // isFlipped: toggle visual — muestra el reverso de la tarjeta objetivo con flip 3D
  const [isFlipped, setIsFlipped] = useState(false);

  const [selectedCell, setSelectedCell] = useState(null);
  const [validMoves, setValidMoves] = useState([]);

  const [bidMoves, setBidMoves] = useState(0);
  const [currentMovesCount, setCurrentMovesCount] = useState(0);
  const [bidInput, setBidInput] = useState('');
  const [moveHistory, setMoveHistory] = useState([]);
  const [rotateUsesLeft, setRotateUsesLeft] = useState(1);
  const [timerSetting, setTimerSetting] = useState(30); // 30, 60, Infinity
  const [replayStep, setReplayStep] = useState(0);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [draggingFrom, setDraggingFrom] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const boardRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartPos = useRef(null);

  // ── Level loading ──────────────────────────────────────────────────────────
  const loadLevel = useCallback((levelIndex) => {
    const level = shuffledLevels[levelIndex];
    setTargetBoard(level.targetBoard);
    setCurrentBoard(level.startBoard);
    setPhase('OBSERVATION');
    setTimeRemaining(timerSetting);
    setBidMoves(0);
    setCurrentMovesCount(0);
    setMoveHistory([]);
    setSelectedCell(null);
    setValidMoves([]);
    setDraggingFrom(null);
    setDragPos(null);
    setDragOverCell(null);
    setIsInverted(false);
    setIsFlipped(false);
    setRotateUsesLeft(1);
  }, []);

  useEffect(() => { loadLevel(currentLevel); }, [currentLevel, loadLevel]);

  // Actualizar timer inicial si se cambia la configuración en fase OBSERVATION antes de empezar
  useEffect(() => {
    if (phase === 'OBSERVATION') {
      setTimeRemaining(timerSetting);
    }
  }, [timerSetting]); // omit phase so it only triggers on setting change (or unmount/mount)

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    if (phase === 'OBSERVATION' && timeRemaining > 0 && timeRemaining !== Infinity) {
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
    }
  }, [targetBoard]);

  // ── Execute a move ─────────────────────────────────────────────────────────
  const executeMove = useCallback((fromIdx, toIdx) => {
    if (!getValidMoves(currentBoard[fromIdx].type, fromIdx, currentBoard).includes(toIdx)) return;

    const newBoard = [...currentBoard];
    newBoard[toIdx] = newBoard[fromIdx];
    newBoard[fromIdx] = null;

    // Detectar retroceso manual (el jugador devuelve la pieza a donde estaba)
    if (moveHistory.length > 0) {
      const lastState = moveHistory[moveHistory.length - 1];
      const isUndo = newBoard.every((p, i) => {
        if (p === null && lastState[i] === null) return true;
        if (p !== null && lastState[i] !== null) return p.id === lastState[i].id;
        return false;
      });

      if (isUndo) {
        // Es un deshacer físico: restaurar tablero, restar contador y limpiar último historial
        setCurrentBoard(newBoard);
        setCurrentMovesCount(Math.max(0, currentMovesCount - 1));
        setMoveHistory(prev => prev.slice(0, -1));
        setSelectedCell(null);
        setValidMoves([]);
        return;
      }
    }

    setCurrentBoard(newBoard);
    setMoveHistory(prev => [...prev, currentBoard]); // Guardar estado ANTES de mover

    const nextCount = currentMovesCount + 1;
    setCurrentMovesCount(nextCount);
    setSelectedCell(null);
    setValidMoves([]);
    checkWinCondition(newBoard, nextCount);
  }, [currentBoard, currentMovesCount, checkWinCondition, moveHistory]);

  // ── Mecánica: INVERTIR tableros ────────────────────────────────────────────
  // En OBSERVATION/BIDDING: gratuito (sin coste de movimiento)
  // En EXECUTION: +1 movimiento (como acción física de elegir el reverso)
  const handleInvertCorrect = useCallback(() => {
    setIsFlipped(false);

    // Primera vez que cargamos el nivel, guardamos el target original
    const level = shuffledLevels[currentLevel];
    const origTarget = level.targetBoard;
    const origStart = level.startBoard;

    if (!isInverted) {
      // Elegir el reverso: empezamos desde la posición objetivo, queremos llegar al inicio
      setCurrentBoard(origTarget.map(p => p));
      setTargetBoard(origStart.map(p => p));
      setIsInverted(true);
    } else {
      // Deshacer inversión
      setCurrentBoard(origStart.map(p => p));
      setTargetBoard(origTarget.map(p => p));
      setIsInverted(false);
    }

    setSelectedCell(null);
    setValidMoves([]);

    if (phase === 'EXECUTION') {
      const nextCount = currentMovesCount + 1;
      setCurrentMovesCount(nextCount);
      setMoveHistory([]); // Al invertir se pierde el historial porque cambian los objetivos
    }
  }, [isInverted, phase, currentLevel, currentMovesCount]);

  // ── Mecánica: VER REVERSO (solo toggle visual en fase inicial) ─────────────
  const handleToggleFlip = useCallback(() => {
    if (phase !== 'EXECUTION') {
      setIsFlipped(f => !f);
    }
  }, [phase]);

  // ── Mecánica: ROTAR CARTA (1 uso en ejecución) ─────────────────────────────
  const handleRotate = useCallback(() => {
    if (phase !== 'EXECUTION' || rotateUsesLeft <= 0) return;
    
    // Rotar 90 grados en sentido horario
    const rotated = Array(9).fill(null);
    rotated[0] = targetBoard[6];
    rotated[1] = targetBoard[3];
    rotated[2] = targetBoard[0];
    rotated[3] = targetBoard[7];
    rotated[4] = targetBoard[4];
    rotated[5] = targetBoard[1];
    rotated[6] = targetBoard[8];
    rotated[7] = targetBoard[5];
    rotated[8] = targetBoard[2];

    setTargetBoard(rotated);
    setRotateUsesLeft(0);
  }, [phase, rotateUsesLeft, targetBoard]);

  // ── Mecánica: DESHACER (automático por botón) ─────────────────────────────
  const handleUndo = useCallback(() => {
    if (phase !== 'EXECUTION' || moveHistory.length === 0) return;
    
    const lastState = moveHistory[moveHistory.length - 1];
    setCurrentBoard(lastState);
    setCurrentMovesCount(Math.max(0, currentMovesCount - 1));
    setMoveHistory(prev => prev.slice(0, -1));
    setSelectedCell(null);
    setValidMoves([]);
  }, [phase, moveHistory, currentMovesCount]);

  // ── Mecánica: REPLAY SOLUCIÓN ──────────────────────────────────────────────
  const startSolutionReplay = useCallback(() => {
    setPhase('SOLUTION_REPLAY');
    setReplayStep(0);
    
    // Si estamos invertidos, el origen de la animación es el Target
    const lvl = shuffledLevels[currentLevel];
    setCurrentBoard(isInverted ? lvl.targetBoard.map(p => p) : lvl.startBoard.map(p => p));
  }, [currentLevel, isInverted]);

  useEffect(() => {
    if (phase === 'SOLUTION_REPLAY') {
      const basePath = shuffledLevels[currentLevel].solutionPath;
      if (!basePath) {
        setPhase('GAMEOVER');
        return;
      }
      
      const path = isInverted ? [...basePath].reverse() : basePath;

      if (replayStep >= path.length) {
        setPhase('GAMEOVER'); // Terminó la animación
        return;
      }

      const timer = setTimeout(() => {
        setCurrentBoard(path[replayStep].map(p => p));
        setReplayStep(r => r + 1);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [phase, replayStep, currentLevel, isInverted]);

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

      // Si la dejamos en el reverso, cobramos movimiento y empezamos invertidos
      if (isFlipped) {
        setIsFlipped(false);
        setIsInverted(true);
        setCurrentMovesCount(1);
        
        const lvl = shuffledLevels[currentLevel];
        setCurrentBoard(lvl.targetBoard.map(p => p));
        setTargetBoard(lvl.startBoard.map(p => p));
      }
    }
  };

  const level = shuffledLevels[currentLevel];

  // El "reverso" que veremos al hacer flip del tablero objetivo es el estado inicial original
  const flipBackBoard = shuffledLevels[currentLevel]?.startBoard ?? Array(9).fill(null);
  // Si está invertido, el reverso del objetivo (que es el start original) es el target original
  const flipBackBoardEffective = isInverted
    ? (shuffledLevels[currentLevel]?.targetBoard ?? Array(9).fill(null))
    : flipBackBoard;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <header className="header">
        <div className="header-title">Chess 3×3</div>
        <div className="header-meta">
          Nivel {currentLevel + 1}
          <select 
            value={timerSetting === Infinity ? 'inf' : timerSetting} 
            onChange={(e) => {
              const val = e.target.value === 'inf' ? Infinity : parseInt(e.target.value, 10);
              setTimerSetting(val);
            }}
            className="timer-select"
            style={{ marginLeft: '10px', background: 'transparent', color: '#94a3b8', border: 'none', outline: 'none', cursor: 'pointer' }}
          >
            <option value="30">30s</option>
            <option value="60">60s</option>
            <option value="inf">∞</option>
          </select>
        </div>
        <div className="header-timer">
          {phase === 'OBSERVATION' && timeRemaining === Infinity && `∞`}
          {phase === 'OBSERVATION' && timeRemaining !== Infinity && `${timeRemaining.toString().padStart(2, '0')}s`}
          {phase === 'EXECUTION' && `${currentMovesCount} / ${bidMoves}`}
          {phase === 'BIDDING' && '—'}
          {(phase === 'VICTORY' || phase === 'GAMEOVER' || phase === 'SOLUTION_REPLAY') && '—'}
        </div>
      </header>

      <main className="game-area" ref={boardRef}>
        
        {/* ── Tablero de Juego (Reverso) ── */}
        <div className={`board-container play-container ${isInverted ? 'inverted-active' : ''}`}>
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

        {/* ── Barra de acciones de tarjeta ── */}
        <div className="board-actions">
          {/* Botón ¡Lo tengo! rápido */}
          {phase === 'OBSERVATION' && (
            <button
              className="btn-action"
              onClick={() => setPhase('BIDDING')}
              style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              ⚡ ¡Lo tengo!
            </button>
          )}

          {/* Deshacer — solo si hay historial en EXECUTION */}
          {phase === 'EXECUTION' && moveHistory.length > 0 && (
            <button
              className="btn-action"
              onClick={handleUndo}
              title="Deshacer último movimiento"
            >
              ↩️ Deshacer
            </button>
          )}

          {/* Invertir — solo en EXECUTION (oculto por ahora, se hace auto en bid) */}

          {/* Ver reverso (solo en fase inicial) */}
          {phase !== 'EXECUTION' && (
            <button
              className={`btn-action ${isFlipped ? 'active' : ''}`}
              onClick={handleToggleFlip}
              title="Girar la tarjeta para ver la posición inicial"
            >
              🔄 {isFlipped ? 'Anverso' : 'Mirar reverso'}
            </button>
          )}

          {/* Rotar carta (1 uso en Ejecución) */}
          {phase === 'EXECUTION' && rotateUsesLeft > 0 && (
            <button
              className="btn-action"
              onClick={handleRotate}
              title="Rotar tarjeta 90º (1 solo uso)"
            >
              ↻ Rotar 90º (1 uso)
            </button>
          )}

          {/* Rendirse y ver solución */}
          {phase === 'EXECUTION' && (
            <button
              className="btn-action"
              onClick={startSolutionReplay}
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              title="Rendirse y ver la animación de la solución"
            >
              🏳️ Ver Solución
            </button>
          )}
        </div>

        {/* ── Tablero Objetivo (Anverso) ── */}
        <div className={`board-container target-container ${isInverted ? 'inverted-active' : ''}`}>
          <span className="board-label">
            {isInverted ? '🔄 Invertido — Objetivo' : '🎯 Posición Objetivo'}
          </span>

          <FlippableBoard
            frontBoard={targetBoard}
            backBoard={flipBackBoardEffective}
            isFlipped={isFlipped}
            isInteractive={false}
            selectedCell={null}
            validMoves={[]}
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
              <h2 className="defeat-text">Solución 🏳️</h2>
            )}
            <p className="modal-hint">
              {phase === 'VICTORY'
                ? `Resolviste en ${currentMovesCount} movimiento${currentMovesCount !== 1 ? 's' : ''} (apuesta: ${bidMoves})`
                : `Juego terminado. El óptimo era ${level?.optimalMoves}.`}
            </p>
            <div className="modal-buttons">
              <button onClick={() => loadLevel(currentLevel)}>Reintentar</button>
              {currentLevel < shuffledLevels.length - 1 && phase === 'VICTORY' && (
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
