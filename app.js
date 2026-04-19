const width = 12;
const height = 8;
const roundTimeLimit = 45;
const timePenaltyOnFall = 3;
const directions = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const players = [
  {
    id: "A",
    name: "Player A",
    className: "player-a",
    icon: "A",
    controlText: "WASD",
    spawn: { x: 0, y: 0 },
    position: { x: 0, y: 0 },
    goalReached: false,
  },
  {
    id: "B",
    name: "Player B",
    className: "player-b",
    icon: "B",
    controlText: "Arrow Keys",
    spawn: { x: 0, y: 0 },
    position: { x: 0, y: 0 },
    goalReached: false,
  },
];

const state = {
  map: [],
  bridges: [],
  level: 1,
  attempts: 1,
  deaths: 0,
  message: "A は WASD、B は矢印キーで動きます。2人ともゴールすると次へ進めます。",
  cleared: false,
  timer: roundTimeLimit,
  timerId: null,
  bestTimes: {},
  gameOver: false,
};

const ui = {
  grid: document.getElementById("grid"),
  scoreLine: document.getElementById("scoreLine"),
  subLine: document.getElementById("subLine"),
  bridgeText: document.getElementById("bridgeText"),
  messageText: document.getElementById("messageText"),
  nextStageButton: document.getElementById("nextStageButton"),
  retryButton: document.getElementById("retryButton"),
  resetButton: document.getElementById("resetButton"),
  playerAStatus: document.getElementById("playerAStatus"),
  playerBStatus: document.getElementById("playerBStatus"),
};

ui.nextStageButton.addEventListener("click", goToNextStage);
ui.retryButton.addEventListener("click", retryAttempt);
ui.resetButton.addEventListener("click", fullReset);

window.addEventListener("keydown", (event) => {
  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    retryAttempt();
    return;
  }

  if (event.key === "c" || event.key === "C") {
    event.preventDefault();
    fullReset();
    return;
  }

  if ((event.key === "n" || event.key === "N") && state.cleared) {
    event.preventDefault();
    goToNextStage();
    return;
  }

  const bindings = {
    w: { player: "A", direction: "up" },
    a: { player: "A", direction: "left" },
    s: { player: "A", direction: "down" },
    d: { player: "A", direction: "right" },
    ArrowUp: { player: "B", direction: "up" },
    ArrowLeft: { player: "B", direction: "left" },
    ArrowDown: { player: "B", direction: "down" },
    ArrowRight: { player: "B", direction: "right" },
  };

  const input = bindings[event.key];
  if (!input) {
    return;
  }

  event.preventDefault();
  movePlayer(input.player, input.direction);
});

startLevel(1);
render();

function startLevel(level) {
  state.level = level;
  state.map = generateLevel(level);
  state.bridges = [];
  state.attempts = 1;
  state.cleared = false;
  state.gameOver = false;
  state.timer = roundTimeLimit;
  syncMarkers();
  resetPlayersToSpawn();
  setMessage(
    level === 1
      ? "A は WASD、B は矢印キーです。落ちて橋を作りながら、2人ともゴールを目指します。"
      : `Level ${level} 開始。制限時間内に 2 人ともゴールすると次へ進めます。`
  );
  restartTimer();
}

function syncMarkers() {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = state.map[y][x];
      if (tile === "S") {
        players[0].spawn = { x, y };
      }
      if (tile === "T") {
        players[1].spawn = { x, y };
      }
      if (tile === "A") {
        state.goalA = { x, y };
      }
      if (tile === "B") {
        state.goalB = { x, y };
      }
    }
  }
}

function resetPlayersToSpawn() {
  players.forEach((player) => {
    player.position = { ...player.spawn };
    player.goalReached = false;
  });
}

function retryAttempt() {
  state.attempts += 1;
  state.cleared = false;
  state.gameOver = false;
  state.timer = roundTimeLimit;
  resetPlayersToSpawn();
  setMessage("この挑戦をやり直しました。橋は残るので、役割分担しながら急いで進めます。");
  restartTimer();
  render();
}

function fullReset() {
  state.bestTimes = {};
  state.deaths = 0;
  startLevel(1);
  setMessage("全部リセットしました。新しい Level 1 で最初からタイムアタックです。");
  render();
}

function goToNextStage() {
  if (!state.cleared) {
    return;
  }
  startLevel(state.level + 1);
  render();
}

function movePlayer(playerId, direction) {
  if (state.cleared || state.gameOver) {
    return;
  }

  const player = players.find((entry) => entry.id === playerId);
  if (!player || player.goalReached) {
    return;
  }

  const offsets = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const offset = offsets[direction];
  const next = {
    x: player.position.x + offset.x,
    y: player.position.y + offset.y,
  };

  if (isOutside(next.x, next.y)) {
    return;
  }

  const otherPlayer = players.find((entry) => entry.id !== playerId);
  if (otherPlayer.position.x === next.x && otherPlayer.position.y === next.y && !otherPlayer.goalReached) {
    setMessage(`${player.name} は ${otherPlayer.name} とぶつかるので、別ルートが必要です。`);
    render();
    return;
  }

  const tile = getTile(next.x, next.y);
  if (tile === "#") {
    setMessage(`${player.name} の先は壁です。`);
    render();
    return;
  }

  if (tile === "O") {
    addBridge(next.x, next.y);
    player.position = { ...player.spawn };
    state.deaths += 1;
    state.timer = Math.max(0, state.timer - timePenaltyOnFall);
    setMessage(`${player.name} が落ちて橋を作りました。残り時間は ${state.timer.toFixed(1)} 秒です。`);
    if (state.timer <= 0) {
      endByTimeout();
      return;
    }
    render();
    return;
  }

  player.position = next;

  if ((player.id === "A" && tile === "A") || (player.id === "B" && tile === "B")) {
    player.goalReached = true;
    setMessage(`${player.name} が自分のゴールに到達しました。もう 1 人を急がせましょう。`);
    checkClear();
    render();
    return;
  }

  if (tile === "=") {
    setMessage(`${player.name} は橋を渡りました。失敗が最短ルートに変わっています。`);
  } else {
    setMessage(`${player.name} が前進しました。2人の進路を分担すると速くなります。`);
  }

  render();
}

function checkClear() {
  if (!players.every((player) => player.goalReached)) {
    return;
  }

  state.cleared = true;
  clearTimer();
  const clearTime = roundTimeLimit - state.timer;
  const best = state.bestTimes[state.level];
  if (best === undefined || clearTime < best) {
    state.bestTimes[state.level] = clearTime;
  }

  setMessage(
    `Level ${state.level} クリア。タイムは ${clearTime.toFixed(1)} 秒です。次のステージへ進めます。`
  );
}

function endByTimeout() {
  state.gameOver = true;
  clearTimer();
  setMessage("時間切れです。この挑戦をやり直して、落ちる場所の役割分担を変えてみましょう。");
  render();
}

function restartTimer() {
  clearTimer();
  state.timerId = window.setInterval(() => {
    state.timer = Math.max(0, state.timer - 0.1);
    if (state.timer <= 0) {
      endByTimeout();
      return;
    }
    renderHud();
  }, 100);
}

function clearTimer() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function addBridge(x, y) {
  if (state.bridges.some((bridge) => bridge.x === x && bridge.y === y)) {
    return;
  }
  state.bridges.push({ x, y });
}

function getTile(x, y) {
  if (state.bridges.some((bridge) => bridge.x === x && bridge.y === y)) {
    return "=";
  }
  return state.map[y][x];
}

function render() {
  renderHud();
  ui.messageText.textContent = state.message;
  ui.nextStageButton.style.display = state.cleared ? "inline-flex" : "none";
  ui.grid.innerHTML = "";

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = getTile(x, y);
      const cell = document.createElement("div");
      cell.className = `tile ${tileClass(tile)}`;

      const occupyingPlayers = players.filter(
        (player) => player.position.x === x && player.position.y === y
      );

      if (occupyingPlayers.length > 0) {
        const avatars = document.createElement("div");
        avatars.className = "avatar-stack";

        occupyingPlayers.forEach((player) => {
          const avatar = document.createElement("div");
          avatar.className = `avatar ${player.className}`;
          avatar.textContent = player.icon;
          avatars.appendChild(avatar);
        });

        cell.classList.add("player");
        cell.appendChild(avatars);
      } else {
        cell.textContent = tileLabel(tile);
      }

      ui.grid.appendChild(cell);
    }
  }
}

function renderHud() {
  const distance = state.level * 100 + state.bridges.length * 9 + Math.max(0, 45 - Math.floor(state.timer));
  ui.scoreLine.textContent = `Dist: ${distance}m | Deaths: ${state.deaths}`;
  ui.subLine.textContent = `Level ${state.level} | Time ${state.timer.toFixed(1)}s | Attempt ${state.attempts} | Best ${formatBestTime()}`;
  ui.bridgeText.textContent = `Bridge: ${state.bridges.length}`;
  const best = state.bestTimes[state.level];
  ui.playerAStatus.textContent = players[0].goalReached ? "A: Goal" : "A: Racing";
  ui.playerBStatus.textContent = players[1].goalReached ? "B: Goal" : "B: Racing";
}

function formatBestTime() {
  const best = state.bestTimes[state.level];
  return best === undefined ? "--" : `${best.toFixed(1)}s`;
}

function tileClass(tile) {
  if (tile === "#") return "wall";
  if (tile === "S" || tile === "T") return "start";
  if (tile === "O") return "hole";
  if (tile === "=") return "bridge";
  if (tile === "A") return "goal goal-a";
  if (tile === "B") return "goal goal-b";
  return "floor";
}

function tileLabel(tile) {
  if (tile === "S") return "SA";
  if (tile === "T") return "SB";
  if (tile === "O") return "O";
  if (tile === "=") return "=";
  if (tile === "A") return "GA";
  if (tile === "B") return "GB";
  return "";
}

function generateLevel(level) {
  const map = Array.from({ length: height }, () => Array.from({ length: width }, () => "#"));
  const centerY = randomInt(2, height - 3);
  const topPath = buildLane(centerY - 1, level);
  const bottomPath = buildLane(centerY + 1, level);
  const connectorX = randomInt(4, width - 5);

  carvePath(map, topPath, ".");
  carvePath(map, bottomPath, ".");
  carveConnector(map, connectorX, topPath, bottomPath);

  placeHoles(map, topPath, Math.min(1 + Math.floor(level / 2), 3));
  placeHoles(map, bottomPath, Math.min(1 + Math.floor(level / 2), 3));
  addNoiseRooms(map, [...topPath, ...bottomPath], level);

  const startA = topPath[0];
  const goalA = topPath[topPath.length - 1];
  const startB = bottomPath[0];
  const goalB = bottomPath[bottomPath.length - 1];

  map[startA.y][startA.x] = "S";
  map[startB.y][startB.x] = "T";
  map[goalA.y][goalA.x] = "A";
  map[goalB.y][goalB.x] = "B";

  return map.map((row) => row.join(""));
}

function buildLane(baseY, level) {
  const path = [];
  let x = 1;
  let y = baseY;

  path.push({ x, y });

  while (x < width - 2) {
    if (Math.random() < Math.min(0.18 + level * 0.02, 0.35)) {
      const shift = Math.random() < 0.5 ? -1 : 1;
      const ny = clamp(y + shift, 1, height - 2);
      if (!path.some((point) => point.x === x && point.y === ny)) {
        y = ny;
        path.push({ x, y });
      }
    }

    x += 1;
    path.push({ x, y });
  }

  return compressPath(path);
}

function compressPath(path) {
  const unique = [];
  path.forEach((point) => {
    const last = unique[unique.length - 1];
    if (!last || last.x !== point.x || last.y !== point.y) {
      unique.push(point);
    }
  });
  return unique;
}

function carvePath(map, path, tile) {
  path.forEach((point) => {
    map[point.y][point.x] = tile;
  });
}

function carveConnector(map, x, pathA, pathB) {
  const top = pathA.find((point) => point.x >= x) || pathA[pathA.length - 1];
  const bottom = pathB.find((point) => point.x >= x) || pathB[pathB.length - 1];
  const startY = Math.min(top.y, bottom.y);
  const endY = Math.max(top.y, bottom.y);

  for (let y = startY; y <= endY; y += 1) {
    map[y][top.x] = ".";
  }
}

function placeHoles(map, path, holeCount) {
  const indexes = [];
  for (let i = 2; i < path.length - 2; i += 1) {
    indexes.push(i);
  }

  shuffleInPlace(indexes);
  let placed = 0;

  for (const index of indexes) {
    if (placed >= holeCount) {
      break;
    }
    const point = path[index];
    if (map[point.y][point.x] !== ".") {
      continue;
    }
    map[point.y][point.x] = "O";
    placed += 1;
  }
}

function addNoiseRooms(map, anchors, level) {
  const branchCount = Math.min(2 + level, 6);

  for (let i = 0; i < branchCount; i += 1) {
    const anchor = anchors[randomInt(0, anchors.length - 1)];
    const direction = directions[randomInt(0, directions.length - 1)];
    let x = anchor.x;
    let y = anchor.y;
    const length = randomInt(1, 2);

    for (let step = 0; step < length; step += 1) {
      x += direction.x;
      y += direction.y;
      if (isOutside(x, y) || x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        break;
      }
      if (map[y][x] === "#") {
        map[y][x] = Math.random() < 0.2 ? "O" : ".";
      }
    }
  }
}

function isOutside(x, y) {
  return x < 0 || y < 0 || x >= width || y >= height;
}

function setMessage(text) {
  state.message = text;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffleInPlace(values) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    const temp = values[i];
    values[i] = values[j];
    values[j] = temp;
  }
}
