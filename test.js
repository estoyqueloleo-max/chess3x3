const assert = require('assert');

let memorySetting = 3;
let phase = 'OBSERVATION';
let timeRemaining = 30;

function loadLevel() {
  if (memorySetting > 0) {
    phase = 'MEMORY_OBSERVATION';
    timeRemaining = memorySetting > 0 ? memorySetting : Infinity;
  } else {
    phase = 'OBSERVATION';
    timeRemaining = 30;
  }
}

loadLevel();
console.log({ phase, timeRemaining });
