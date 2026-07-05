# Chess 3x3 Multijugador Remoto: Opciones de Integración con Pingo

## Contexto

**Chess 3x3** es una PWA React (Vite) con juego local de puzzle.  
**Pingo** es una PWA vanilla JS con P2P via PeerJS usando:
- Servidor de señalización propio: `peerjs-server.accreativos.com`
- STUN/TURN con Coturn opcional via Cloudflare Worker
- `registerDataHandler(type, handler)` — **sistema de plugin ya existente** 🎉
- IDs de peer derivados de passphrase + salt

---

## Las 3 Opciones

---

### Opción A — "Plugin iframe + postMessage" ✅ Recomendada para empezar

```
┌─────────────────────────────────────────┐
│              PINGO (PWA)                │
│                                         │
│  [Mapa] [Chat] [Agenda] [▶ Chess 3x3]  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   <iframe src="chess3x3">       │   │
│  │                                 │   │
│  │   Chess 3x3 (React PWA)        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  peer-manager.js                        │
│    registerDataHandler('chess-move', ···)│
│    ↕ postMessage bridge                │
└─────────────────────────────────────────┘
```

**Cómo funciona:**

1. Pingo abre Chess 3x3 en un `<iframe>` (o panel expandible)
2. Pingo registra un handler: `registerDataHandler('chess-move', handler)`
3. El iframe se comunica con Pingo via `window.postMessage`
4. Pingo hace de **relay**: recibe moves del iframe → los envía via PeerJS al peer remoto → los recibe y los reenvía al iframe del otro jugador

```
Jugador A (Chess3x3 iframe) 
  → postMessage('chess-move', {from, to})
  → Pingo A (peer-manager)
  → PeerJS data channel
  → Pingo B (peer-manager)
  → postMessage a Chess3x3 iframe B
  → Chess3x3 aplica el move remoto
```

**Pros:**
- ✅ Chess 3x3 sigue siendo independiente (su propia URL, su PWA)
- ✅ Zero cambios en peer-manager.js de Pingo (usa `registerDataHandler` existente)
- ✅ La infra STUN/TURN/señalización de Pingo funciona sin tocarla
- ✅ Se puede abrir Chess 3x3 como "mini-app" dentro de Pingo
- ✅ Los jugadores ya están "contactados" via Pingo (la agenda de peers)

**Contras:**
- ⚠️ Requiere que ambos jugadores tengan Pingo abierto + conectados
- ⚠️ Hay latencia extra por el doble bridge (iframe ↔ Pingo ↔ PeerJS)
- ⚠️ CORS / `same-origin` en iframe puede complicar si están en dominios distintos
  (Solución: `allow-scripts allow-same-origin` en sandbox, o mismo dominio)

**Cambios mínimos necesarios:**

En **Chess 3x3** (`App.jsx`): ~50 líneas
```js
// En chess3x3: escuchar moves remotos
window.addEventListener('message', (e) => {
  if (e.data.type === 'chess-remote-move') {
    applyRemoteMove(e.data.from, e.data.to);
  }
});
// Al ejecutar un move propio:
window.parent.postMessage({ type: 'chess-move', from, to }, '*');
```

En **Pingo** (`peer-manager.js` o nuevo `chess-bridge.js`): ~30 líneas
```js
registerDataHandler('chess-move', (peerId, data) => {
  chessIframe.contentWindow.postMessage({
    type: 'chess-remote-move', ...data
  }, '*');
});
```

---

### Opción B — "SDK Standalone: Chess 3x3 se conecta directo"

```
┌──────────────────┐        ┌──────────────────┐
│   Chess 3x3      │        │   Chess 3x3      │
│   (React PWA)    │        │   (React PWA)    │
│                  │        │                  │
│  useChessP2P()   │◄──────►│  useChessP2P()   │
│  (PeerJS directo)│ WebRTC │  (PeerJS directo)│
└──────────────────┘        └──────────────────┘
          ↑                           ↑
          │    Mismo signaling server │
          └──────────────────────────┘
           peerjs-server.accreativos.com
```

**Cómo funciona:**

Chess 3x3 instala su propia instancia de PeerJS, apuntando al **mismo servidor de señalización** de Pingo. Los dos jugadores se identifican por su Peer ID (que pueden compartir via un "Room Code").

```js
// En chess3x3: nuevo hook usePeerChess.js
import { Peer } from 'peerjs';
const peer = new Peer(undefined, {
  host: 'peerjs-server.accreativos.com',
  port: 443, path: '/', secure: true
});
```

**Pros:**
- ✅ Chess 3x3 es completamente autónoma (sin necesidad de Pingo abierto)
- ✅ Reutiliza la infra del servidor de señalización de Pingo
- ✅ Puedes añadir un "Room Code" simple (6 dígitos) para conectarse
- ✅ Misma fiabilidad NAT que Pingo (STUN configurado igual)

**Contras:**
- ⚠️ Duplica la lógica de PeerJS (no hay "reuso" real del código de Pingo)
- ⚠️ Sin TURN/relay automático (necesitarías replicar la lógica de Coturn)
- ⚠️ Los jugadores necesitan comunicar su Peer ID fuera de banda

---

### Opción C — "Integración Nativa: Chess 3x3 vive dentro de Pingo"

```
┌─────────────────────────────────────────────────┐
│                  PINGO (PWA)                    │
│                                                 │
│  [Mapa]  [Chat]  [♟ Chess]  [Agenda]           │
│                     ↓                           │
│            ┌─────────────────┐                  │
│            │  ChessView.js   │ (nuevo módulo)   │
│            │  (vanilla JS)   │                  │
│            └────────┬────────┘                  │
│                     │ usa directamente           │
│            peer-manager.connectToPeer()         │
│            peer-manager.registerDataHandler()   │
└─────────────────────────────────────────────────┘
```

**Cómo funciona:**

El juego de ajedrez se reescribe como un módulo vanilla JS y se integra dentro del bundle de Pingo, usando directamente `peer-manager.js`.

**Pros:**
- ✅ Integración más profunda y fluida
- ✅ Usa la agenda de contactos de Pingo (seleccionar a quién retar)
- ✅ Puede usar el chat de Pingo para notificaciones ("¡Te reto!")

**Contras:**
- ❌ Hay que reescribir el UI de Chess 3x3 en vanilla JS (o añadir React a Pingo)
- ❌ Los dos proyectos se acoplan fuertemente
- ❌ Mucho más trabajo, pierdes la independencia de chess3x3

---

## Recomendación

```
Empezar con B si quieres chess3x3 autónoma.
Empezar con A si quieres "reto desde Pingo" y la experiencia social.
```

### Mi favorita: **Opción A mejorada** — "Deep Link + Pingo Bridge"

1. En Pingo: botón en la agenda de un contacto → **"Retar al ajedrez"**
2. Pingo abre Chess 3x3 en un panel lateral/modal con el Peer ID del rival ya pre-configurado
3. Chess 3x3 detecta `?peerHost=...&rivalId=XXX` en la URL y auto-conecta
4. Los moves viajan por el canal de datos de Pingo ya establecido

Esto combina lo mejor de A y B:
- Chess 3x3 puede abrirse standalone (Opción B) o desde Pingo (Opción A)
- Solo necesitas un `useChessP2P.js` hook en Chess 3x3 + un bridge en Pingo

---

## Protocolo de mensajes sugerido

```json
// Move del jugador local
{ "type": "chess-move", "from": 3, "to": 7, "piece": "ROOK" }

// Inicio/aceptación de partida
{ "type": "chess-invite", "levelId": "level_042", "color": "white" }
{ "type": "chess-accept", "levelId": "level_042" }

// Sincronización de estado completo (reconexión)
{ "type": "chess-state", "board": [...], "phase": "EXECUTION", "moves": 2 }

// Chat del juego
{ "type": "chess-chat", "text": "¡Buen movimiento!" }
```

---

## Plan de implementación (Opción A + B híbrida)

1. **`src/hooks/usePeerChess.js`** en Chess 3x3 — gestión P2P standalone
2. **`src/components/MultiplayerModal.jsx`** — UI para invitar/conectar
3. **`App.jsx`** — modo "vs Remoto" que aplica moves del peer
4. **`chess-bridge.js`** en Pingo — `registerDataHandler` + postMessage relay

Estimación: ~4-6h de trabajo para un MVP funcional.
