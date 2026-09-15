(() => {
  "use strict";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const restartBtn = document.getElementById("restart-btn");
  const muteBtn = document.getElementById("mute-btn");
  const diffBtns = Array.from(document.querySelectorAll(".diff-btn"));

  const COLS = 22;
  const ROWS = 22;
  const CELL = canvas.width / COLS; // 440 / 22 = 20

  const DIFF = {
    easy: { step: 165, label: "简单" },
    normal: { step: 120, label: "普通" },
    hard: { step: 82, label: "困难" },
  };

  const STATE = { READY: "ready", RUNNING: "running", PAUSED: "paused", OVER: "over" };

  let snake, prevSnake, dir, nextDir, food, score, best, state;
  let stepInterval, elapsed, lastTime, particles, floaters, shake, rafId;

  best = Number(localStorage.getItem("snake2_best") || 0);
  bestEl.textContent = best;

  // ---- 音效（WebAudio，无需外部文件）----
  let audioCtx = null;
  let muted = false;
  function beep(freq, dur, type, vol) {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = vol || 0.05;
      o.connect(g);
      g.connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      o.start(t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.1));
      o.stop(t + (dur || 0.1));
    } catch (e) { /* 忽略音频错误 */ }
  }
  const sndEat = () => beep(680, 0.08, "square", 0.045);
  const sndDie = () => { beep(220, 0.3, "sawtooth", 0.06); setTimeout(() => beep(120, 0.45, "sawtooth", 0.06), 130); };
  const sndStart = () => beep(520, 0.12, "sine", 0.04);

  function rand(n) { return Math.floor(Math.random() * n); }

  function currentDiff() {
    const active = document.querySelector(".diff-btn.active");
    return DIFF[active ? active.dataset.diff : "normal"].step;
  }

  function reset() {
    snake = [
      { x: 10, y: 11 },
      { x: 9, y: 11 },
      { x: 8, y: 11 },
    ];
    prevSnake = snake.map((s) => ({ ...s }));
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    elapsed = 0;
    lastTime = 0;
    particles = [];
    floaters = [];
    shake = 0;
    stepInterval = currentDiff();
    scoreEl.textContent = score;
    placeFood();
    draw();
  }

  function placeFood() {
    let p;
    do {
      p = { x: rand(COLS), y: rand(ROWS) };
    } while (snake.some((s) => s.x === p.x && s.y === p.y));
    food = p;
  }

  function step() {
    prevSnake = snake.map((s) => ({ ...s }));
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
    if (snake.some((s) => s.x === head.x && s.y === head.y)) return gameOver();

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreEl.textContent = score;
      spawnParticles(food.x, food.y);
      floaters.push({ x: food.x * CELL + CELL / 2, y: food.y * CELL, text: "+10", life: 1 });
      sndEat();
      if (score > best) {
        best = score;
        bestEl.textContent = best;
        localStorage.setItem("snake2_best", best);
      }
      placeFood();
    } else {
      snake.pop();
    }
  }

  function spawnParticles(cx, cy) {
    const px = cx * CELL + CELL / 2;
    const py = cy * CELL + CELL / 2;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      particles.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
  }

  function updateEffects() {
    particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.035; });
    particles = particles.filter((p) => p.life > 0);
    floaters.forEach((f) => { f.y -= 0.7; f.life -= 0.022; });
    floaters = floaters.filter((f) => f.life > 0);
    if (shake > 0) shake -= 1;
  }

  function loop(ts) {
    if (state === STATE.RUNNING) {
      if (!lastTime) lastTime = ts;
      elapsed += ts - lastTime;
      lastTime = ts;
      let guard = 0;
      while (elapsed >= stepInterval && state === STATE.RUNNING && guard < 5) {
        elapsed -= stepInterval;
        step();
        guard++;
      }
      updateEffects();
    } else {
      lastTime = ts;
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function draw() {
    const t = state === STATE.RUNNING ? Math.min(elapsed / stepInterval, 1) : 1;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // 背景
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, "#0c0a24");
    bg.addColorStop(1, "#161336");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 网格
    ctx.strokeStyle = "rgba(139, 92, 246, 0.10)";
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height);
      ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL);
      ctx.stroke();
    }

    // 食物：发光红果
    const fx = food.x * CELL + CELL / 2;
    const fy = food.y * CELL + CELL / 2;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);
    ctx.save();
    ctx.shadowColor = "#fb7185";
    ctx.shadowBlur = 14 + pulse * 10;
    const grd = ctx.createRadialGradient(fx, fy, 1, fx, fy, CELL / 2);
    grd.addColorStop(0, "#ffd1dc");
    grd.addColorStop(0.5, "#fb7185");
    grd.addColorStop(1, "#e11d48");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(fx, fy, CELL / 2 - 3 + pulse * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 蛇身：霓虹渐变 + 平滑插值
    const n = snake.length;
    for (let i = n - 1; i >= 0; i--) {
      const cur = snake[i];
      const prev = prevSnake[i] || cur;
      const rx = prev.x + (cur.x - prev.x) * t;
      const ry = prev.y + (cur.y - prev.y) * t;
      const x = rx * CELL;
      const y = ry * CELL;
      const mix = i / Math.max(n - 1, 1);
      // 头亮绿 -> 尾青
      const col = lerpColor([74, 222, 128], [34, 211, 238], mix);
      ctx.save();
      ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.8)`;
      ctx.shadowBlur = i === 0 ? 16 : 8;
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 6);
      ctx.fill();
      ctx.restore();

      if (i === 0) drawEyes(x, y);
    }

    // 粒子
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = "#fda4af";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 飘字 +10
    floaters.forEach((f) => {
      ctx.globalAlpha = Math.max(f.life, 0);
      ctx.fillStyle = "#86efac";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawEyes(x, y) {
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const off = 4;
    // 眼睛朝向移动方向
    const dx = dir.x, dy = dir.y;
    const ex = cx + dx * 3;
    const ey = cy + dy * 3;
    const perpX = -dy, perpY = dx;
    ctx.fillStyle = "#04140b";
    ctx.beginPath();
    ctx.arc(ex + perpX * off, ey + perpY * off, 2, 0, Math.PI * 2);
    ctx.arc(ex - perpX * off, ey - perpY * off, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  function start() {
    reset();
    state = STATE.RUNNING;
    pauseBtn.textContent = "暂停";
    hideOverlay();
    sndStart();
    cancelAnimationFrame(rafId);
    lastTime = 0;
    rafId = requestAnimationFrame(loop);
  }

  function gameOver() {
    state = STATE.OVER;
    shake = 14;
    sndDie();
    showOverlay("游戏结束 💥", "本局得分 " + score + "，点击再来一局");
  }

  function togglePause() {
    if (state === STATE.RUNNING) {
      state = STATE.PAUSED;
      showOverlay("已暂停 ⏸", "点击继续");
      pauseBtn.textContent = "继续";
    } else if (state === STATE.PAUSED) {
      state = STATE.RUNNING;
      hideOverlay();
      pauseBtn.textContent = "暂停";
    }
  }

  function showOverlay(title, text) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlay.classList.remove("hidden");
  }
  function hideOverlay() { overlay.classList.add("hidden"); }

  // ---- 输入：键盘 ----
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    const map = {
      arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
      arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
      arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
    };
    if (map[k]) {
      e.preventDefault();
      const nd = map[k];
      if (nd.x === -dir.x && nd.y === -dir.y) return; // 不能直接掉头
      nextDir = nd;
      if (state === STATE.READY || state === STATE.OVER) start();
      else if (state === STATE.PAUSED) togglePause();
      return;
    }
    if (k === " " || k === "spacebar") {
      e.preventDefault();
      if (state === STATE.RUNNING || state === STATE.PAUSED) togglePause();
    }
  });

  // ---- 输入：触摸滑动 ----
  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => { e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const tt = e.changedTouches[0];
    const dx = tt.clientX - touchStart.x;
    const dy = tt.clientY - touchStart.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    let nd;
    if (Math.abs(dx) > Math.abs(dy)) nd = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    else nd = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    if (!(nd.x === -dir.x && nd.y === -dir.y)) nextDir = nd;
    if (state === STATE.READY || state === STATE.OVER) start();
    else if (state === STATE.PAUSED) togglePause();
    touchStart = null;
  });

  // ---- 按钮 ----
  startBtn.addEventListener("click", () => {
    if (state === STATE.PAUSED) togglePause();
    else start();
  });
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", start);
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.textContent = muted ? "🔇" : "🔊";
  });

  // ---- 难度 ----
  diffBtns.forEach((b) => {
    b.addEventListener("click", () => {
      diffBtns.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      stepInterval = currentDiff();
      if (state === STATE.READY || state === STATE.OVER) reset();
    });
  });

  // 初始画面
  reset();
  state = STATE.READY;
  showOverlay("准备好了吗？", "方向键 / WASD 控制，吃到 🍎 得分");
  rafId = requestAnimationFrame(loop);
})();
