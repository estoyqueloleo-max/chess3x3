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

const LOCI_EMOJIS = ['🚗','🍎','🎸','🐶','⏰','🚀','🍔','🎩','☂️','⚽','🔑','💎','📚','🌻','🎁','🎈','📷','💡','🐘','🦋','🚲','🍕','🎲','🎹','🍩','🏆','🧩','🧸','🧶','🥑','🍉','🍍','🍒','🍓','🥕','🌽','🍞','🥞','🍟','🌮','🍣','🍦','🍪','🍫','☕','🍷','🍹','🍺','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🏸','🥊','🥋','🎿','🏂','🏋️','🤺','🧘','🏄','🏊','🚣','🚁','🛶','⛵','🚤','🛳️','⛴️','🛥️','🚢','✈️','🛫','🛬','🪂','💺','🚟','🚠','🚡','🛰️','🪐','🌙','⭐','🌟','🌠','🌌','☁️','⛅','⛈️','🌤️','🌥️','🌦️','🌧️','🌨️','🌩️','🌪️','🌫️','🌬️'];

const getPieceDisplay = (piece) => {
  if (!piece) return '';
  if (piece.type === 'LOCI') return piece.emoji;
  return PIECE_SYMBOLS[piece.type] || '?';
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
  useNumbers,
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
                {getPieceDisplay(piece)}
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
      {getPieceDisplay(piece)}
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
  const [isError, setIsError] = useState(false);

  const [bidMoves, setBidMoves] = useState(0);
  const [currentMovesCount, setCurrentMovesCount] = useState(0);
  const [bidInput, setBidInput] = useState('');
  const [moveHistory, setMoveHistory] = useState([]);
  const [rotateUsesLeft, setRotateUsesLeft] = useState(1);
  const [replayStep, setReplayStep] = useState(0);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [draggingFrom, setDraggingFrom] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const boardRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartPos = useRef(null);

  // ── Persistent Settings ────────────────────────────────────────────────────
  const [settings, setSettings] = useState(() => {
    const defaults = {
      timerSetting: 30,
      memorySetting: 0,
      lociMemorySetting: 0,
      gameMode: 'chess', // 'chess' | 'loci'
      lociDifficulty: 5, // 3, 5, 9
    };
    try {
      const saved = localStorage.getItem('chess3x3_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaults,
          ...parsed,
          timerSetting: parsed.timerSetting === 'inf' || parsed.timerSetting === null ? Infinity : Number(parsed.timerSetting ?? defaults.timerSetting),
          memorySetting: Number(parsed.memorySetting ?? defaults.memorySetting),
          lociMemorySetting: Number(parsed.lociMemorySetting ?? defaults.lociMemorySetting),
          lociDifficulty: Number(parsed.lociDifficulty ?? defaults.lociDifficulty)
        };
      }
    } catch {}
    return defaults;
  });

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: typeof value === 'function' ? value(prev[key]) : value };
      const toSave = { ...updated };
      if (toSave.timerSetting === Infinity) toSave.timerSetting = 'inf';
      localStorage.setItem('chess3x3_settings', JSON.stringify(toSave));
      return updated;
    });
  }, []);

  const timerSetting = settings.timerSetting;
  const setTimerSetting = useCallback((val) => updateSetting('timerSetting', val), [updateSetting]);
  const memorySetting = settings.memorySetting;
  const setMemorySetting = useCallback((val) => updateSetting('memorySetting', val), [updateSetting]);
  const lociMemorySetting = settings.lociMemorySetting;
  const setLociMemorySetting = useCallback((val) => updateSetting('lociMemorySetting', val), [updateSetting]);
  const gameMode = settings.gameMode;
  const setGameMode = useCallback((val) => updateSetting('gameMode', val), [updateSetting]);
  const lociDifficulty = settings.lociDifficulty;
  const setLociDifficulty = useCallback((val) => updateSetting('lociDifficulty', val), [updateSetting]);

  // ── Memory Mode State ──────────────────────────────────────────────────────
  const [reconstructedBoard, setReconstructedBoard] = useState(Array(9).fill(null));
  const [memoryPalette, setMemoryPalette] = useState([]);
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState(null);
  const [isMemoryReady, setIsMemoryReady] = useState(false);
  const [lociStartTime, setLociStartTime] = useState(null);
  const [lociErrors, setLociErrors] = useState(0);
  const [activeTip, setActiveTip] = useState(null);
  const [lociStats, setLociStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chess3x3_loci_stats') || '{}'); }
    catch { return {}; }
  });

  const [showSettings, setShowSettings] = useState(false);
  const challengeSequential = settings.challengeSequential;
  const challengeNoise = settings.challengeNoise;
  const challengeDualTask = settings.challengeDualTask;
  const setChallengeSequential = useCallback((val) => updateSetting('challengeSequential', val), [updateSetting]);
  const setChallengeNoise = useCallback((val) => updateSetting('challengeNoise', val), [updateSetting]);
  const setChallengeDualTask = useCallback((val) => updateSetting('challengeDualTask', val), [updateSetting]);

  const [dualTaskQuestion, setDualTaskQuestion] = useState(null);
  const [dualTaskAnswer, setDualTaskAnswer] = useState('');
  const [dualTaskCorrectAnswer, setDualTaskCorrectAnswer] = useState(null);
  const [seqIndex, setSeqIndex] = useState(0);
  const [noisePieces, setNoisePieces] = useState({});

  // ── Level loading ──────────────────────────────────────────────────────────
  const loadLevel = useCallback((levelIndex) => {
    let currentLociMode = gameMode === 'loci';
    let targetB = Array(9).fill(null);
    let startB = Array(9).fill(null);

    if (currentLociMode) {
      const items = [...LOCI_EMOJIS].sort(() => Math.random() - 0.5).slice(0, lociDifficulty);
      const positions = [0,1,2,3,4,5,6,7,8].sort(() => Math.random() - 0.5).slice(0, lociDifficulty);
      positions.forEach((pos, i) => {
        targetB[pos] = { type: 'LOCI', id: `loci_${i}`, emoji: items[i] };
      });
    } else {
      const level = shuffledLevels[levelIndex];
      targetB = level.targetBoard;
      startB = level.startBoard;
    }

    setTargetBoard(targetB);
    setCurrentBoard(startB);
    
    const activeMemorySetting = currentLociMode ? lociMemorySetting : memorySetting;
    if (currentLociMode || activeMemorySetting > 0) {
      setPhase('MEMORY_OBSERVATION');
      setTimeRemaining(activeMemorySetting > 0 ? activeMemorySetting : Infinity);
      setReconstructedBoard(Array(9).fill(null));
      const pieces = targetB.filter(p => p !== null);
      setMemoryPalette([...pieces].sort(() => Math.random() - 0.5));
      setSelectedPaletteIdx(null);
      setIsMemoryReady(false);
    } else {
      setPhase('OBSERVATION');
      setTimeRemaining(timerSetting);
    }

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
    setIsError(false);
    setDualTaskQuestion(null);
    setSeqIndex(0);
    setNoisePieces({});
  }, [shuffledLevels, memorySetting, lociMemorySetting, timerSetting, gameMode, lociDifficulty]);

  useEffect(() => { loadLevel(currentLevel); }, [currentLevel, loadLevel]);

  // ── WASM Initialization ──────────────────────────────────────────────────────
  useEffect(() => {
    if (window.Go) {
      const go = new window.Go();
      WebAssembly.instantiateStreaming(fetch(`${import.meta.env.BASE_URL}chess_engine.wasm`), go.importObject)
        .then(result => {
          go.run(result.instance);
          setWasmReady(true);
        })
        .catch(console.error);
    }
  }, []);

  // ── Modificadores Loci ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'MEMORY_OBSERVATION' && isMemoryReady && challengeDualTask && gameMode === 'loci') {
      const initialTime = lociMemorySetting;
      if (initialTime > 0) {
        const timer = setTimeout(() => {
          const a = Math.floor(Math.random() * 9) + 1;
          const b = Math.floor(Math.random() * 9) + 1;
          setDualTaskQuestion(`${a} + ${b} = ?`);
          setDualTaskCorrectAnswer(a + b);
          setDualTaskAnswer('');
        }, (initialTime * 1000) / 2);
        return () => clearTimeout(timer);
      }
    }
  }, [phase, isMemoryReady, challengeDualTask, gameMode, lociMemorySetting]);

  useEffect(() => {
    if (phase === 'MEMORY_OBSERVATION' && isMemoryReady && challengeSequential && gameMode === 'loci') {
      const activePiecesCount = targetBoard.filter(p => p !== null).length;
      if (activePiecesCount > 0) {
        const timer = setInterval(() => {
          setSeqIndex(s => (s + 1) % activePiecesCount);
        }, 1000);
        return () => { clearInterval(timer); setSeqIndex(0); };
      }
    }
  }, [phase, isMemoryReady, challengeSequential, gameMode, targetBoard]);

  useEffect(() => {
    if (phase === 'MEMORY_OBSERVATION' && isMemoryReady && challengeNoise && gameMode === 'loci') {
      const timer = setInterval(() => {
        const emptyIndices = targetBoard.map((p, i) => p === null ? i : null).filter(i => i !== null);
        if (emptyIndices.length > 0) {
          const numNoise = Math.random() > 0.5 ? 1 : 2;
          const selected = [];
          for (let i = 0; i < numNoise; i++) {
            const idx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            if (!selected.includes(idx)) selected.push(idx);
          }
          const newNoise = {};
          selected.forEach(idx => {
            const randomEmoji = LOCI_EMOJIS[Math.floor(Math.random() * LOCI_EMOJIS.length)];
            newNoise[idx] = { type: 'LOCI', emoji: randomEmoji, isNoise: true };
          });
          setNoisePieces(newNoise);
          setTimeout(() => setNoisePieces({}), 300);
        }
      }, 800);
      return () => { clearInterval(timer); setNoisePieces({}); };
    }
  }, [phase, isMemoryReady, challengeNoise, gameMode, targetBoard]);

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



  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    const isReady = phase === 'MEMORY_OBSERVATION' ? isMemoryReady : true;
    if (isReady && timeRemaining > 0 && timeRemaining !== Infinity && (phase === 'OBSERVATION' || phase === 'MEMORY_OBSERVATION')) {
      timer = setTimeout(() => setTimeRemaining(t => t - 1), 1000);
    } else if (isReady && timeRemaining === 0) {
      if (phase === 'MEMORY_OBSERVATION') {
        setPhase('MEMORY_RECONSTRUCTION');
        if (gameMode === 'loci') {
          setLociStartTime(Date.now());
          setLociErrors(0);
        }
      } else if (phase === 'OBSERVATION') {
        setPhase('BIDDING');
      }
    }
    return () => clearTimeout(timer);
  }, [phase, timeRemaining, isMemoryReady, gameMode]);

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

  // ── Mecánica: REPLAY SOLUCIÓN Y REVISIÓN DE JUGADAS (WASM) ───────────────
  const [dynamicPath, setDynamicPath] = useState(null);
  const [replayPaused, setReplayPaused] = useState(false);
  const [reviewAnalysis, setReviewAnalysis] = useState([]);
  const [phaseBeforeReview, setPhaseBeforeReview] = useState(null);

  const startMoveReview = useCallback(() => {
    if (!wasmReady || !window.getOptimalPathWasm) return;
    
    const fullHistory = [...moveHistory, currentBoard];
    const analysis = fullHistory.map((state) => {
      const path = window.getOptimalPathWasm(state, targetBoard);
      return { state, optimalMoves: path ? path.length - 1 : Infinity };
    });
    
    setReviewAnalysis(analysis);
    setPhaseBeforeReview(phase);
    setPhase('REVIEW_MOVES');
    setReplayStep(0);
    setCurrentBoard(fullHistory[0]);
  }, [wasmReady, moveHistory, currentBoard, targetBoard]);

  const startSolutionReplay = useCallback(() => {
    if (!wasmReady || !window.getOptimalPathWasm) return;
    
    // Si ya ganó, mostramos la solución desde el principio. Si se rindió a medias, desde donde estaba.
    const startForReplay = phase === 'VICTORY' 
      ? (isInverted ? shuffledLevels[currentLevel].targetBoard : shuffledLevels[currentLevel].startBoard)
      : currentBoard;

    const path = window.getOptimalPathWasm(startForReplay, targetBoard);
    
    if (path && path.length > 0) {
      setDynamicPath(path);
      setPhaseBeforeReview(phase === 'EXECUTION' ? 'GAMEOVER' : phase);
      setPhase('SOLUTION_REPLAY');
      setReplayStep(0);
    } else {
      setPhase('GAMEOVER');
    }
  }, [currentBoard, targetBoard, wasmReady, phase, currentLevel, isInverted, shuffledLevels]);

  useEffect(() => {
    if (!replayPaused) {
      if (phase === 'SOLUTION_REPLAY' && dynamicPath) {
        if (replayStep >= dynamicPath.length - 1) {
          setReplayPaused(true);
          return;
        }
        const timer = setTimeout(() => {
          setReplayStep(r => {
            const next = r + 1;
            setCurrentBoard(dynamicPath[next].map(p => p));
            return next;
          });
        }, 700);
        return () => clearTimeout(timer);
      } else if (phase === 'REVIEW_MOVES' && reviewAnalysis) {
        if (replayStep >= reviewAnalysis.length - 1) {
          setReplayPaused(true);
          return;
        }
        const timer = setTimeout(() => {
          setReplayStep(r => {
            const next = r + 1;
            setCurrentBoard(reviewAnalysis[next].state.map(p => p));
            return next;
          });
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [phase, replayStep, dynamicPath, reviewAnalysis, replayPaused]);

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

  // ── Memory Reconstruction Handler ──────────────────────────────────────────
  const handleReconstructCellClick = useCallback((index) => {
    if (phase !== 'MEMORY_RECONSTRUCTION') return;

    if (reconstructedBoard[index]) {
      const piece = reconstructedBoard[index];
      setMemoryPalette(prev => [...prev, piece]);
      const newBoard = [...reconstructedBoard];
      newBoard[index] = null;
      setReconstructedBoard(newBoard);
      setSelectedPaletteIdx(null);
    } else if (selectedPaletteIdx !== null) {
      const piece = memoryPalette[selectedPaletteIdx];
      const newBoard = [...reconstructedBoard];
      newBoard[index] = piece;
      setReconstructedBoard(newBoard);
      
      const newPalette = [...memoryPalette];
      newPalette.splice(selectedPaletteIdx, 1);
      setMemoryPalette(newPalette);
      setSelectedPaletteIdx(null);
      
      if (newPalette.length === 0) {
        const isMatch = newBoard.every((p, i) => {
          const tp = targetBoard[i];
          if (p === null && tp === null) return true;
          if (p !== null && tp !== null) return p.id === tp.id;
          return false;
        });
        if (isMatch) {
          if (gameMode === 'loci') {
            const timeMs = lociStartTime ? Date.now() - lociStartTime : 0;
            const timeS = (timeMs / 1000).toFixed(1);
            setLociStats(prev => {
              const diffStats = prev[lociDifficulty] || [];
              const newStats = { time: timeS, errors: lociErrors, date: Date.now() };
              const updated = { ...prev, [lociDifficulty]: [newStats, ...diffStats].slice(0, 10) };
              localStorage.setItem('chess3x3_loci_stats', JSON.stringify(updated));
              return updated;
            });
            setPhase('LOCI_SUCCESS');
            setCurrentMovesCount(0);
            setTimeout(() => {
              loadLevel(currentLevel); 
            }, 1200);
          } else {
            setPhase('OBSERVATION');
            setTimeRemaining(timerSetting);
          }
        } else {
          setLociErrors(e => e + 1);
          setIsError(true);
          setTimeout(() => setIsError(false), 800);
        }
      }
    }
  }, [phase, reconstructedBoard, selectedPaletteIdx, memoryPalette, targetBoard, timerSetting, gameMode, lociStartTime, lociErrors, lociDifficulty]);

  const handleTip = useCallback(() => {
    if (phase !== 'MEMORY_RECONSTRUCTION') return;
    const emptyIndices = [];
    reconstructedBoard.forEach((p, i) => {
      if (p === null && targetBoard[i] !== null) emptyIndices.push(i);
    });
    if (emptyIndices.length > 0) {
      const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      setActiveTip({ index: randomIdx, emoji: targetBoard[randomIdx].emoji });
      setLociErrors(e => e + 3);
      setTimeout(() => setActiveTip(null), 1000);
    }
  }, [phase, reconstructedBoard, targetBoard]);

  const handleResetLoci = useCallback(() => {
    setPhase('MEMORY_OBSERVATION');
    setTimeRemaining(lociMemorySetting > 0 ? lociMemorySetting : Infinity);
    setReconstructedBoard(Array(9).fill(null));
    const pieces = targetBoard.filter(p => p !== null);
    setMemoryPalette([...pieces].sort(() => Math.random() - 0.5));
    setSelectedPaletteIdx(null);
    setIsMemoryReady(false);
    setIsError(false);
  }, [lociMemorySetting, targetBoard]);

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

  const displayTargetBoard = useMemo(() => {
    if (phase !== 'MEMORY_OBSERVATION' || gameMode !== 'loci') return targetBoard;
    
    let board = [...targetBoard];

    // Apply sequential filtering
    if (challengeSequential && isMemoryReady) {
      const piecesIndices = board.map((p, i) => p !== null ? i : null).filter(i => i !== null);
      if (piecesIndices.length > 0) {
        const visibleIdx = piecesIndices[seqIndex % piecesIndices.length];
        board = board.map((p, i) => i === visibleIdx ? p : null);
      }
    }

    // Apply noise
    if (challengeNoise && isMemoryReady) {
      Object.entries(noisePieces).forEach(([idx, piece]) => {
        board[idx] = piece;
      });
    }

    return board;
  }, [phase, targetBoard, challengeSequential, isMemoryReady, seqIndex, challengeNoise, noisePieces, gameMode]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <header className="header">
        <div 
          className="header-title"
          onClick={() => setGameMode(m => m === 'chess' ? 'loci' : 'chess')}
          style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', width: '130px', perspective: '600px' }}
          title="Haz clic para cambiar de modo"
        >
          <div style={{ 
            transition: 'transform 0.5s', 
            transformStyle: 'preserve-3d',
            transform: gameMode === 'loci' ? 'rotateX(180deg)' : 'rotateX(0deg)',
            position: 'relative'
          }}>
            <div style={{ backfaceVisibility: 'hidden' }}>
              Chess 3×3
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', backfaceVisibility: 'hidden', transform: 'rotateX(180deg)', color: '#8b5cf6' }}>
              Loci Trainer
            </div>
          </div>
        </div>
        <div className="header-meta" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>

          {gameMode === 'chess' && (
            <>
              <span>
                Nivel {currentLevel + 1}
                <span style={{ marginLeft: '8px', color: currentBest !== undefined ? '#f59e0b' : '#475569', fontSize: '0.78rem' }}>
                  🏆 {currentBest !== undefined ? currentBest : '--'}
                </span>
              </span>
              <select 
                value={timerSetting === Infinity ? 'inf' : timerSetting} 
                onChange={(e) => {
                  const val = e.target.value === 'inf' ? Infinity : parseInt(e.target.value, 10);
                  setTimerSetting(val);
                }}
                className="timer-select"
                style={{ background: 'transparent', color: '#94a3b8', border: 'none', outline: 'none', cursor: 'pointer' }}
              >
                <option value="30">30s</option>
                <option value="60">60s</option>
                <option value="inf">∞</option>
              </select>
              <select 
                value={memorySetting} 
                onChange={(e) => setMemorySetting(parseInt(e.target.value, 10))}
                className="timer-select"
                style={{ background: 'transparent', color: '#10b981', border: 'none', outline: 'none', cursor: 'pointer' }}
                title="Modo Memoria"
              >
                <option value="0">Mem: Off</option>
                <option value="1">Mem: 1s</option>
                <option value="2">Mem: 2s</option>
                <option value="3">Mem: 3s</option>
                <option value="5">Mem: 5s</option>
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}>
                <input 
                  type="checkbox" 
                  checked={isShuffled}
                  onChange={handleShuffleChange}
                  style={{ marginRight: '4px' }}
                />
                Barajar
              </label>
            </>
          )}

          {gameMode === 'loci' && (
            <span style={{ color: '#8b5cf6', fontSize: '0.8rem', fontWeight: 600 }}>
              {lociDifficulty} Objetos
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => setShowStats(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 6px', opacity: 0.7 }}
            title="Ver estadísticas"
          >🏆</button>
          <button
            onClick={() => setShowSettings(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 6px', opacity: 0.7 }}
            title="Ajustes y Retos"
          >⚙️</button>
        </div>
        <div className="header-timer">
          {(phase === 'OBSERVATION' || phase === 'MEMORY_OBSERVATION') && timeRemaining === Infinity && `∞`}
          {(phase === 'OBSERVATION' || phase === 'MEMORY_OBSERVATION') && timeRemaining !== Infinity && `${timeRemaining.toString().padStart(2, '0')}s`}
          {phase === 'MEMORY_RECONSTRUCTION' && '🧩'}
          {phase === 'EXECUTION' && `${currentMovesCount} / ${bidMoves}`}
          {phase === 'BIDDING' && '—'}
          {(phase === 'VICTORY' || phase === 'GAMEOVER' || phase === 'SOLUTION_REPLAY' || phase === 'REVIEW_MOVES') && '—'}
        </div>
      </header>

      <main className="game-area" ref={boardRef} style={gameMode === 'loci' ? { justifyContent: 'flex-start' } : undefined}>
        
        {phase === 'MEMORY_OBSERVATION' && !isMemoryReady ? (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <button
              onClick={() => setIsMemoryReady(true)}
              style={{
                fontSize: '2rem',
                padding: '20px 40px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                fontWeight: 'bold'
              }}
            >
              ▶ Empezar
            </button>
          </div>
        ) : (
          <>
            {/* ── Tablero de Juego (Reverso) ── */}
            {gameMode !== 'loci' && (
              <div className={`board-container play-container ${isInverted ? 'inverted-active' : ''}`}>
              <span className="board-label">
            {phase === 'SOLUTION_REPLAY'
              ? `▶ Paso ${Math.min(replayStep, dynamicPath ? dynamicPath.length - 1 : 0) + 1} / ${dynamicPath?.length ?? '?'}`
              : phase === 'REVIEW_MOVES'
              ? `🔍 Revisión: Mov ${replayStep} / ${Math.max(0, reviewAnalysis.length - 1)}`
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

          {/* ── Slider de Timeline (solo en SOLUTION_REPLAY o REVIEW_MOVES) ── */}
          {(phase === 'SOLUTION_REPLAY' && dynamicPath) || (phase === 'REVIEW_MOVES' && reviewAnalysis.length > 0) ? (
            <div style={{ width: '100%', padding: '6px 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(phase === 'SOLUTION_REPLAY' || phase === 'REVIEW_MOVES') && (
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
                )}
                <input
                  type="range"
                  min={0}
                  max={phase === 'SOLUTION_REPLAY' ? dynamicPath.length - 1 : reviewAnalysis.length - 1}
                  value={Math.min(replayStep, phase === 'SOLUTION_REPLAY' ? dynamicPath.length - 1 : reviewAnalysis.length - 1)}
                  onMouseDown={() => setReplayPaused(true)}
                  onTouchStart={() => setReplayPaused(true)}
                  onChange={(e) => {
                    const step = parseInt(e.target.value, 10);
                    setReplayStep(step);
                    if (phase === 'SOLUTION_REPLAY') setCurrentBoard(dynamicPath[step].map(p => p));
                    else if (phase === 'REVIEW_MOVES') setCurrentBoard(reviewAnalysis[step].state.map(p => p));
                  }}
                  style={{ flex: 1, accentColor: phase === 'REVIEW_MOVES' ? '#8b5cf6' : '#3b82f6' }}
                />
              </div>
              {phase === 'REVIEW_MOVES' && (
                <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#e2e8f0', background: 'rgba(30,41,59,0.6)', padding: '4px', borderRadius: '4px' }}>
                  Distancia al objetivo: <strong>{reviewAnalysis[replayStep]?.optimalMoves}</strong>
                  {replayStep > 0 && (
                    <span style={{ marginLeft: '10px' }}>
                      {reviewAnalysis[replayStep].optimalMoves < reviewAnalysis[replayStep - 1].optimalMoves 
                        ? <span style={{ color: '#10b981' }}>✅ Buen movimiento</span>
                        : reviewAnalysis[replayStep].optimalMoves === reviewAnalysis[replayStep - 1].optimalMoves
                          ? <span style={{ color: '#f59e0b' }}>⚠️ Imprecisión</span>
                          : <span style={{ color: '#ef4444' }}>❌ Error</span>}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
        )}

        {/* ── Barra de acciones de tarjeta ── */}
        <div className="board-actions">
          {/* Volver desde Replay/Review */}
          {(phase === 'SOLUTION_REPLAY' || phase === 'REVIEW_MOVES') && (
            <button
              className="btn-action"
              onClick={() => {
                setReplayPaused(true);
                setPhase(phaseBeforeReview || 'GAMEOVER');
              }}
              style={{ color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)' }}
              title="Volver a la pantalla final"
            >
              🔙 Volver
            </button>
          )}
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
          {(phase === 'OBSERVATION' || phase === 'BIDDING') && (
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
        <div 
          className={`board-container target-container ${isInverted ? 'inverted-active' : ''} ${isError ? 'error-shake' : ''}`}
          style={{ marginTop: gameMode === 'loci' ? '8vh' : '0' }}
        >
          <span className="board-label" style={{ color: phase === 'LOCI_SUCCESS' ? '#10b981' : undefined }}>
            {phase === 'MEMORY_OBSERVATION' ? '🧠 Memoriza el Objetivo' :
             phase === 'MEMORY_RECONSTRUCTION' ? '🧩 Reconstruye el Objetivo' :
             phase === 'LOCI_SUCCESS' ? '✨ ¡Correcto! Siguiente...' :
             isInverted ? '🔄 Invertido — Objetivo' : '🎯 Posición Objetivo'}
          </span>

          {phase === 'MEMORY_RECONSTRUCTION' || phase === 'LOCI_SUCCESS' ? (
            <>
              <Board
                board={reconstructedBoard.map((p, i) => activeTip && i === activeTip.index ? { type: 'LOCI', emoji: activeTip.emoji } : p)}
                isInteractive={true}
                selectedCell={null}
                validMoves={[]}
                onCellClick={handleReconstructCellClick}
               
              />
              <div className="memory-palette" style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {memoryPalette.map((piece, i) => (
                  <div 
                    key={i}
                    className={`cell ${selectedPaletteIdx === i ? 'selected' : ''}`}
                    onClick={() => setSelectedPaletteIdx(selectedPaletteIdx === i ? null : i)}
                    style={{ cursor: 'pointer', width: 'clamp(30px, 12vw, 55px)', aspectRatio: '1', border: '1px dashed #3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    <span className="piece">{getPieceDisplay(piece)}</span>
                  </div>
                ))}
              </div>
              
              {gameMode === 'loci' && (
                <div className="board-actions" style={{ marginTop: '20px' }}>
                  {phase === 'MEMORY_RECONSTRUCTION' && (
                    <button 
                      className="btn-action" 
                      onClick={handleTip}
                      style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                      title="Muestra una posición correcta temporalmente por +3 errores"
                    >
                      💡 Pista (+3 Errores)
                    </button>
                  )}
                  <button 
                    className="btn-action" 
                    onClick={handleResetLoci}
                    title="Volver a intentar memorizar esta misma combinación"
                  >
                    🔄 Reintentar
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {dualTaskQuestion && phase === 'MEMORY_OBSERVATION' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.95)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                  <h3 style={{ color: '#ef4444', fontSize: '1.2rem', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>¡Doble Tarea!</h3>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '15px' }}>{dualTaskQuestion}</div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (parseInt(dualTaskAnswer, 10) === dualTaskCorrectAnswer) {
                      setDualTaskQuestion(null);
                    } else {
                      setDualTaskAnswer('');
                    }
                  }}>
                    <input type="number" value={dualTaskAnswer} onChange={e => setDualTaskAnswer(e.target.value)} autoFocus style={{ fontSize: '1.8rem', width: '100px', textAlign: 'center', borderRadius: '8px', border: '2px solid #3b82f6', background: '#1e293b', color: '#fff', outline: 'none' }} />
                  </form>
                </div>
              )}
              <FlippableBoard
                frontBoard={displayTargetBoard}
                backBoard={flipBackBoardEffective}
                isFlipped={isFlipped}
                isInteractive={false}
                selectedCell={null}
                validMoves={[]}
              />
            </>
          )}
        </div>
        </>
        )}
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
              {phase === 'VICTORY' && gameMode === 'chess'
                ? `Resolviste en ${currentMovesCount} movimiento${currentMovesCount !== 1 ? 's' : ''} (apuesta: ${bidMoves})`
                : phase === 'VICTORY' && gameMode === 'loci'
                ? `¡Memorizaste ${lociDifficulty} objetos a la perfección!`
                : `Juego terminado. El óptimo era ${level?.optimalMoves}.`}
            </p>
            <div className="modal-buttons">
              <button onClick={() => loadLevel(currentLevel)}>Reintentar</button>
              
              {/* Botón Analizar si ganó pero fue subóptimo */}
              {phase === 'VICTORY' && currentMovesCount > level?.optimalMoves && wasmReady && (
                <button className="btn-action" onClick={startSolutionReplay} style={{ color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
                  🧠 Solución óptima
                </button>
              )}

              {/* Botón Revisar jugadas */}
              {(phase === 'VICTORY' || phase === 'GAMEOVER') && moveHistory.length > 0 && wasmReady && (
                <button className="btn-action" onClick={startMoveReview} style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)', marginLeft: '8px' }}>
                  🔍 Mis Jugadas
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

            {gameMode === 'loci' ? (
              <div style={{ flex: 1, overflowY: 'auto', marginTop: '20px' }}>
                {Object.keys(lociStats).length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}>No hay estadísticas todavía.</div>
                ) : (
                  Object.keys(lociStats).sort((a, b) => b - a).map(diff => (
                    <div key={diff} style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: '#8b5cf6', margin: '0 0 10px 0', fontSize: '1rem' }}>Objetos: {diff}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {lociStats[diff].map((stat, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(30,41,59,0.5)', padding: '8px 12px', borderRadius: '6px' }}>
                            <span style={{ color: '#e2e8f0' }}>⏱️ {stat.time}s</span>
                            <span style={{ color: stat.errors === 0 ? '#10b981' : '#ef4444' }}>❌ {stat.errors} errores</span>
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{new Date(stat.date).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Ajustes (Retos y Configuraciones) */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(2, 6, 23, 0.96)', display: 'flex', flexDirection: 'column', padding: '12px', boxSizing: 'border-box' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', margin: 'auto', maxWidth: '400px', width: '100%', color: '#f8fafc', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f1f5f9' }}>⚙️ Ajustes</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>✕</button>
            </div>
            
            {gameMode === 'loci' && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1rem', color: '#8b5cf6', marginBottom: '10px' }}>Modificadores de Concentración</h3>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={challengeSequential} onChange={e => setChallengeSequential(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Aparición Secuencial</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Los iconos aparecen de uno en uno.</div>
                  </div>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={challengeNoise} onChange={e => setChallengeNoise(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Ruido Visual</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Aparecen iconos fantasma intermitentes para distraerte.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={challengeDualTask} onChange={e => setChallengeDualTask(e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Doble Tarea (Problema Matemático)</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Un problema interrumpe tu visión a mitad de tiempo. ¡Resuélvelo rápido!</div>
                  </div>
                </label>
              </div>
            )}
            
            <div>
              <h3 style={{ fontSize: '1rem', color: '#10b981', marginBottom: '10px' }}>Configuración General</h3>
              {gameMode === 'loci' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Objetos:</span>
                    <select value={lociDifficulty} onChange={(e) => setLociDifficulty(parseInt(e.target.value, 10))} style={{ background: '#334155', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px' }}>
                      <option value="5">5 Objs</option>
                      <option value="6">6 Objs</option>
                      <option value="7">7 Objs</option>
                      <option value="8">8 Objs</option>
                      <option value="9">9 Objs</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Tiempo de Observación:</span>
                    <select value={lociMemorySetting} onChange={(e) => setLociMemorySetting(parseInt(e.target.value, 10))} style={{ background: '#334155', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px' }}>
                      <option value="0">∞</option>
                      <option value="1">1s</option>
                      <option value="2">2s</option>
                      <option value="3">3s</option>
                      <option value="5">5s</option>
                      <option value="10">10s</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Tiempo:</span>
                    <select value={timerSetting === Infinity ? 'inf' : timerSetting} onChange={(e) => {
                      const val = e.target.value === 'inf' ? Infinity : parseInt(e.target.value, 10);
                      setTimerSetting(val);
                    }} style={{ background: '#334155', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px' }}>
                      <option value="30">30s</option>
                      <option value="60">60s</option>
                      <option value="inf">∞</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export default App;
