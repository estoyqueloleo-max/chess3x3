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
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledLevels, setShuffledLevels] = useState(generatedLevels);
  const [wasmReady, setWasmReady] = useState(false);

  // ── Récords (localStorage keyed by level.id) ─────────────────────────────
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chess3x3_records') || '{}'); }
    catch { return {}; }
  });
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [showStats, setShowStats] = useState(false);

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

  useEffect(() => { loadLevel(currentLevel); }, [currentLevel, loadLevel, shuffledLevels]);

  // ── WASM Initialization ──────────────────────────────────────────────────────
  useEffect(() => {
    if (window.Go) {
      const go = new window.Go();
      WebAssembly.instantiateStreaming(fetch('/chess_engine.wasm'), go.importObject)
        .then(result => {
          go.run(result.instance);
          setWasmReady(true);
        })
        .catch(console.error);
    }
  }, []);

  // Handle shuffle toggle
  const handleShuffleChange = useCallback((e) => {
    const checked = e.target.checked;
    setIsShuffled(checked);
    if (checked) {
      setShuffledLevels(shuffleArray(generatedLevels));
    } else {
      setShuffledLevels(generatedLevels);
    }
    setCurrentLevel(0); // Reiniciar al primer nivel
  }, []);

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
      // Save record
      const levelId = shuffledLevels[currentLevel]?.id;
      if (levelId) {
        setRecords(prev => {
          const prevBest = prev[levelId];
          const newRecord = prevBest === undefined || movesUsed < prevBest;
          setIsNewRecord(newRecord);
          const updated = newRecord ? { ...prev, [levelId]: movesUsed } : prev;
          if (newRecord) localStorage.setItem('chess3x3_records', JSON.stringify(updated));
          return updated;
        });
      }
      setPhase('VICTORY');
    }
  }, [targetBoard, shuffledLevels, currentLevel]);

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

  // ── Mecánica: REPLAY SOLUCIÓN (WASM) ───────────────────────────────────────
  const [dynamicPath, setDynamicPath] = useState(null);
  const [replayPaused, setReplayPaused] = useState(false);

  const startSolutionReplay = useCallback(() => {
    if (!wasmReady || !window.getOptimalPathWasm) return;
    
    // Si ya ganó, mostramos la solución desde el principio. Si se rindió a medias, desde donde estaba.
    const startForReplay = phase === 'VICTORY' 
      ? (isInverted ? shuffledLevels[currentLevel].targetBoard : shuffledLevels[currentLevel].startBoard)
      : currentBoard;

    const path = window.getOptimalPathWasm(startForReplay, targetBoard);
    
    if (path && path.length > 0) {
      setDynamicPath(path);
      setPhase('SOLUTION_REPLAY');
      setReplayStep(0);
    } else {
      setPhase('GAMEOVER');
    }
  }, [currentBoard, targetBoard, wasmReady, phase, currentLevel, isInverted, shuffledLevels]);

  useEffect(() => {
    if (phase === 'SOLUTION_REPLAY' && !replayPaused) {
      if (!dynamicPath || replayStep >= dynamicPath.length) {
        setPhase('GAMEOVER'); // Terminó la animación
        return;
      }

      const timer = setTimeout(() => {
        setCurrentBoard(dynamicPath[replayStep].map(p => p));
        setReplayStep(r => r + 1);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [phase, replayStep, dynamicPath, replayPaused]);

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
  const currentBest = records[level?.id];

  // Stats summary
  const totalSolved = generatedLevels.filter(l => records[l.id] !== undefined).length;
  const totalPerfect = generatedLevels.filter(l => records[l.id] !== undefined && records[l.id] <= l.optimalMoves).length;

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
          <span style={{ marginLeft: '8px', color: currentBest !== undefined ? '#f59e0b' : '#475569', fontSize: '0.78rem' }}>
            🏆 {currentBest !== undefined ? currentBest : '--'}
          </span>
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
          <label style={{ marginLeft: '10px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}>
            <input 
              type="checkbox" 
              checked={isShuffled}
              onChange={handleShuffleChange}
              style={{ marginRight: '4px' }}
            />
            Barajar
          </label>
        </div>
        <button
          onClick={() => setShowStats(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 6px', opacity: 0.7 }}
          title="Ver estadísticas"
        >🏆</button>
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
            {phase === 'SOLUTION_REPLAY'
              ? `▶ Paso ${Math.min(replayStep, dynamicPath ? dynamicPath.length - 1 : 0) + 1} / ${dynamicPath?.length ?? '?'}`
              : phase === 'OBSERVATION' ? '🔒 Observa' : '♟ Tu Tablero'}
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

          {/* ── Slider de Timeline (solo en SOLUTION_REPLAY) ── */}
          {phase === 'SOLUTION_REPLAY' && dynamicPath && (
            <div style={{ width: '100%', padding: '6px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setReplayPaused(p => !p)}
                style={{
                  flexShrink: 0,
                  background: 'rgba(30,41,59,0.8)',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {replayPaused ? '▶' : '⏸'}
              </button>
              <input
                type="range"
                min={0}
                max={dynamicPath.length - 1}
                value={Math.min(replayStep, dynamicPath.length - 1)}
                onMouseDown={() => setReplayPaused(true)}
                onTouchStart={() => setReplayPaused(true)}
                onChange={(e) => {
                  const step = parseInt(e.target.value, 10);
                  setReplayStep(step);
                  setCurrentBoard(dynamicPath[step].map(p => p));
                }}
                style={{ flex: 1, accentColor: '#3b82f6' }}
              />
            </div>
          )}
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
            {phase === 'VICTORY' && isNewRecord && (
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', padding: '6px 12px', marginBottom: '8px', color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600 }}>
                ⭐ ¡Nuevo Récord Personal!
              </div>
            )}
            <p className="modal-hint">
              {phase === 'VICTORY'
                ? `Resolviste en ${currentMovesCount} movimiento${currentMovesCount !== 1 ? 's' : ''} (apuesta: ${bidMoves})`
                : `Juego terminado. El óptimo era ${level?.optimalMoves}.`}
            </p>
            <div className="modal-buttons">
              <button onClick={() => loadLevel(currentLevel)}>Reintentar</button>
              
              {/* Botón Analizar si ganó pero fue subóptimo */}
              {phase === 'VICTORY' && currentMovesCount > level?.optimalMoves && wasmReady && (
                <button className="btn-action" onClick={startSolutionReplay} style={{ color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
                  🧠 Analizar óptimo
                </button>
              )}

              {currentLevel < shuffledLevels.length - 1 && phase === 'VICTORY' && (
                <button className="btn-success" onClick={() => setCurrentLevel(l => l + 1)}>
                  Siguiente →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel Estadísticas — pantalla completa con grid escalable */}
      {showStats && (
        <div
          onClick={() => setShowStats(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(2, 6, 23, 0.96)',
            display: 'flex', flexDirection: 'column',
            padding: '12px 12px 8px',
            boxSizing: 'border-box',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>

            {/* Cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#f1f5f9' }}>🏆 Estadísticas</h2>
              <button onClick={() => setShowStats(false)} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Contadores */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexShrink: 0 }}>
              {[
                { val: totalSolved, label: 'Resueltos', color: '#3b82f6' },
                { val: totalPerfect, label: 'Perfectos ⭐', color: '#f59e0b' },
                { val: generatedLevels.length - totalSolved, label: 'Pendientes', color: '#64748b' },
              ].map(({ val, label, color }) => (
                <div key={label} style={{ textAlign: 'center', background: 'rgba(30,41,59,0.7)', borderRadius: '10px', padding: '8px 14px' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Grid auto-escalado para llenar el espacio disponible */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(10, 1fr)',
                  gap: '3px',
                  width: 'min(100%, min(90dvh, 90dvw))',
                }}
              >
                {generatedLevels.map((lvl, i) => {
                  const best = records[lvl.id];
                  const isPerfect = best !== undefined && best <= lvl.optimalMoves;
                  const isSolved = best !== undefined;
                  return (
                    <button
                      key={lvl.id}
                      onClick={() => {
                        const idx = shuffledLevels.findIndex(l => l.id === lvl.id);
                        if (idx !== -1) { setCurrentLevel(idx); setShowStats(false); }
                      }}
                      title={isSolved ? `Mejor: ${best} mov (óptimo: ${lvl.optimalMoves})` : `Sin resolver`}
                      style={{
                        aspectRatio: '1',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: 'clamp(0.45rem, 1.5vw, 0.7rem)',
                        fontWeight: 700,
                        background: isPerfect
                          ? 'rgba(245, 158, 11, 0.85)'
                          : isSolved
                            ? 'rgba(59, 130, 246, 0.6)'
                            : 'rgba(51, 65, 85, 0.6)',
                        color: isSolved ? '#fff' : '#64748b',
                        transition: 'transform 0.1s',
                      }}
                      onPointerDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                      onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {isSolved ? best : i + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Leyenda */}
            <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#475569', flexShrink: 0 }}>
              <span style={{ color: '#f59e0b' }}>● Perfecto</span>&nbsp;&nbsp;
              <span style={{ color: '#3b82f6' }}>● Resuelto</span>&nbsp;&nbsp;
              <span style={{ color: '#475569' }}>● Pendiente</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
