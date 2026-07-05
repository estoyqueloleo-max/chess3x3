# Chess 3×3 — Juego de Lógica Espacial

Aplicación web **Mobile-First** de lógica espacial basada en ajedrez. Se juega en un tablero de 3×3 con exactamente 5 piezas (Rey, Reina, Torre, Alfil, Caballo). El objetivo es llevar las piezas desde su posición inicial hasta la "Tarjeta Objetivo" en el menor número de movimientos posible.

---

## 🎮 Mecánica del Juego

El juego se desarrolla en **3 fases** por ronda:

### Fase 1 — Observación
- Se muestra la posición inicial (tablero inferior) y la posición objetivo (tarjeta superior).
- El tablero interactivo está **bloqueado** — solo se puede pensar.
- Un temporizador de 30 segundos cuenta hacia atrás.

### Fase 2 — Apuesta
- Al terminar el tiempo (o al pulsar "¡Lo tengo!"), aparece un modal.
- El jugador introduce cuántos movimientos cree que necesita para resolver el puzzle.

### Fase 3 — Ejecución
- El tablero se desbloquea. Las piezas se mueven por clic o arrastrado (drag-and-drop).
- Un contador muestra los movimientos realizados vs. el límite apostado.
- **Victoria:** La posición coincide con la tarjeta objetivo dentro del límite de movimientos.
- **Derrota:** Se supera el límite sin alcanzar el objetivo.

---

## ♟️ Reglas de Movimiento (tablero 3×3)

| Pieza | Símbolo | Movimiento |
|-------|---------|------------|
| Rey | ♚ | 1 casilla en cualquier dirección |
| Reina | ♛ | Ortogonal + Diagonal, bloqueada por piezas |
| Torre | ♜ | Ortogonal en línea recta, bloqueada por piezas |
| Alfil | ♝ | Diagonal en línea recta, bloqueado por piezas |
| Caballo | ♞ | Salto en "L" — **única pieza que puede saltar** |

> No hay capturas. Las piezas solo se mueven a casillas vacías.

---

## 🏗️ Arquitectura del Proyecto

```
chess3x3/
├── src/                        # Frontend React (Vite)
│   ├── App.jsx                 # Máquina de estados principal del juego
│   ├── index.css               # Estilos globales (Mobile-First, tema oscuro)
│   └── logic/
│       ├── chessEngine.js      # Motor de validación de movimientos
│       └── generated_levels.json  # Tarjetas generadas por el motor Go
│
└── generator/                  # Motor generador de tarjetas (Go)
    ├── engine.go               # Lógica de movimientos en Go
    ├── bfs.go                  # Exploración BFS del espacio de estados
    └── main.go                 # Generación y exportación de tarjetas a JSON
```

### Frontend (React + Vite)
- **Vanilla CSS** — sin frameworks de UI.
- **Mobile-First** — diseño adaptado a pantallas de móvil sin scroll.
- **Drag-and-Drop** — implementado con Pointer Events API para compatibilidad táctil/ratón.
- **Interacción por clic** — como alternativa al drag, mantenida en paralelo.

### Motor Generador (Go)
El generador explora el **grafo completo** de posiciones jugables (~5.880 estados únicos) y selecciona tarjetas usando un algoritmo **Maximin** para maximizar la diversidad entre puzzles seleccionados:

1. **Exploración total:** BFS desde un tablero semilla clasifica todos los estados por profundidad.
2. **Distribución proporcional:** 20 tarjetas fáciles (3–5 mov.) / 50 medias (6–8) / 30 difíciles (9–12).
3. **Selección Maximin:** En cada paso, se elige la tarjeta que maximiza la distancia media al conjunto ya seleccionado, garantizando variedad visual y de dificultad.

---

## 🚀 Cómo Ejecutar

### Frontend (desarrollo)
```bash
npm install
npm run dev
```

### Generar nuevas tarjetas
```bash
cd generator
go run .
# Genera src/logic/generated_levels.json con 100 tarjetas seleccionadas
```

---

## 📋 Backlog de Mejoras

### Pendiente
- [ ] **Temporizador configurable** — Selector en la cabecera para 30s / 60s / ∞.
- [ ] **"Ver la Solución"** — Al perder, animar la solución óptima (requiere guardar el camino BFS en el JSON).
- [ ] **Botón "¡Lo tengo!"** — Saltar el temporizador manualmente en la Fase de Observación.
- [ ] **Tabla de puntuaciones** — Registro local de mejores marcas por nivel.
- [ ] **Modo oscuro/claro** — Toggle de tema.
- [ ] **Modo 2 jugadores local** — Turnos alternativos, cada uno apuesta sus movimientos.

### Decisiones de diseño tomadas
- **Niveles predefinidos vs. aleatorios:** Se optó por un generador offline (Go script) para garantizar solución matemática y tiempos de carga instantáneos.
- **5.880 estados únicos:** El espacio de juego está completamente acotado; la profundidad máxima de cualquier puzzle es de **12 movimientos**.
- **Pointer Events vs. HTML5 Drag:** Se usa Pointer Events API para compatibilidad nativa con pantallas táctiles.
