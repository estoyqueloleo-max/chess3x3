# Chess 3×3 — Juego de Lógica Espacial

Aplicación web **Mobile-First** de lógica espacial basada en ajedrez. Se juega en un tablero de 3×3 con exactamente 5 piezas (Rey, Reina, Torre, Alfil, Caballo). El objetivo es llevar las piezas desde su posición inicial hasta la "Tarjeta Objetivo" en el menor número de movimientos posible.

---

## 🎮 Mecánica del Juego

El juego se desarrolla en **3 fases** por ronda. Al cargar la app, se baraja el mazo de 100 tarjetas disponibles de forma aleatoria.

### Fase 1 — Observación
- Se muestra la posición inicial (Tu Tablero) y la posición objetivo (Tarjeta Objetivo).
- El tablero interactivo está **bloqueado** — solo se puede pensar.
- **Temporizador Configurable:** Puedes elegir entre 30s, 60s o infinito (∞).
- **Botón "¡Lo tengo!":** Puedes saltar la espera e ir directo a apostar si ya tienes la solución en mente.
- **Mecánica de Tarjeta Física:** Puedes darle la vuelta a la tarjeta objetivo pulsando **"Mirar reverso"** para ver dónde empezaban las piezas.

### Fase 2 — Apuesta
- El jugador introduce cuántos movimientos cree que necesita para resolver el puzzle. El juego **ya no da pistas** sobre el número óptimo.
- **Jugar Invertido:** Si aceptas la apuesta dejando la tarjeta *dada la vuelta* (viendo el reverso), el juego asumirá que quieres jugar hacia esa cara. Se te cobrará **+1 movimiento de penalización** y se intercambiarán el inicio y el objetivo.

### Fase 3 — Ejecución
- El tablero se desbloquea. Las piezas se mueven por clic o arrastrado (drag-and-drop).
- Ya no hay "Game Over" estricto: puedes mover piezas indefinidamente hasta lograr el objetivo. Al ganar, se compararán tus movimientos con tu apuesta.
- **Deshacer (Undo):** Si te equivocas, puedes pulsar "↩️ Deshacer" o simplemente **devolver físicamente** la pieza a su casilla anterior. El juego anulará la acción y te restará 1 movimiento.
- **Rotar 90º:** Tienes **1 solo uso** por partida para rotar la tarjeta objetivo 90 grados en el sentido de las agujas del reloj, cambiando tu perspectiva del objetivo.
- **Rendirse:** Si te atascas, el botón **"🏳️ Ver Solución"** reproduce una animación paso a paso mostrándote cómo resolverlo por el camino óptimo.

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
- [x] **Tabla de puntuaciones** — Registro local de mejores marcas por nivel (via `localStorage`).
- [ ] **Slider de Timeline en Replay** — Mostrar un slider durante la animación de solución para retroceder o avanzar libremente por los pasos del camino óptimo.
- [ ] **Modo oscuro/claro** — Toggle de tema.

### Modo Multijugador
Se han explorado varias opciones de integración con Pingo (P2P via PeerJS). Ver detalles completos en [`TODO_multiplayer_options.md`](TODO_multiplayer_options.md).
- **Opción A** — Plugin iframe + postMessage (✅ Recomendada para empezar).
- **Opción B** — Librería compartida Chess 3x3 con bundle propio.
- **Opción C** — Importación directa de módulos ES desde Pingo.

### Exploración Futura: Tablero 4x4
Una de las ideas más potentes para expandir el juego es aumentar el tablero a **4x4**. 
- **Dificultad Matemática:** Sería un salto masivo en complejidad. Mientras que el 3x3 con 5 piezas tiene exactamente 5.880 estados posibles, un 4x4 tendría $16! / 11! = 524.160$ combinaciones únicas (casi 100 veces más grande). La profundidad de los puzzles sería mucho mayor (puzzles de 15-20 movimientos).
- **¿Precalcular o WASM?** 
  - Para generar las tarjetas, seguiríamos usando el script precalculado en Go, ya que elegir las tarjetas óptimas por Maximin entre 500k nodos tardaría un rato.
  - Para el **motor WASM de análisis en vivo**, un BFS completo de medio millón de nodos podría dar un pequeño tirón en el móvil (unos cientos de milisegundos). Para hacerlo instantáneo, tendríamos que mejorar el algoritmo en Go pasando de un simple BFS a **BFS Bidireccional** o **A***. Con esas mejoras, el motor WASM seguiría siendo capaz de corregirte los pasos en tiempo real sin problema.

### Decisiones de diseño tomadas
- **Niveles predefinidos vs. aleatorios:** Se optó por un generador offline (Go script) para garantizar solución matemática y tiempos de carga instantáneos.
- **5.880 estados únicos:** El espacio de juego está completamente acotado; la profundidad máxima de cualquier puzzle es de **12 movimientos**.
- **Pointer Events vs. HTML5 Drag:** Se usa Pointer Events API para compatibilidad nativa con pantallas táctiles.
