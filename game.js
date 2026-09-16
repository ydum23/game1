(() => {
  "use strict";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayScore = document.getElementById("overlay-score");
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

  const STATE = { READY: "ready", RUNNING: "running", PAUSED: "paused", OVER: "over", COUNTDOWN: "countdown" };

  let snake, prevSnake, dir, nextDir, food, score, best, state;
  let stepInterval, elapsed, lastTime, particles, floaters, shake, rafId, countdownText = "", countdownToken = 0;
  let newRecordThisGame = false;

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
  // 吃食物：清脆短音
  const sndEat = () => beep(680, 0.08, "square", 0.045);
  // 撞击墙壁 / 游戏结束：低沉撞击声（先“咚”后“咔”）
  const sndCrash = () => {
    beep(170, 0.16, "sawtooth", 0.07);
    setTimeout(() => beep(85, 0.34, "square", 0.07), 90);
  };
  // 倒计时数字
  const sndStart = () => beep(520, 0.12, "sine", 0.04);
  // 倒计时 GO!
  const sndGo = () => beep(880, 0.14, "square", 0.05);

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
    newRecordThisGame = false;
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

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver("wall");
    if (snake.some((s) => s.x === head.x && s.y === head.y)) return gameOver("self");

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
        newRecordThisGame = true;
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

    // 食物：发光红果 + 呼吸式脉冲动画
    const fx = food.x * CELL + CELL / 2;
    const fy = food.y * CELL + CELL / 2;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);
    ctx.save();
    // 外圈光晕（动画）
    ctx.globalAlpha = 0.25 + 0.25 * pulse;
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.arc(fx, fy, CELL / 2 + 4 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 主体
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

    // 倒计时：3 / 2 / 1 / GO!
    if (countdownText) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const scale = 1 + 0.25 * Math.abs(Math.sin(Date.now() / 140));
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(scale, scale);
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 26;
      ctx.fillStyle = countdownText === "GO!" ? "#fbbf24" : "#4ade80";
      ctx.font = "bold 84px sans-serif";
      ctx.fillText(countdownText, 0, 0);
      ctx.restore();
    }

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

  // ---- 开始流程：选难度 -> 倒计时 -> 进入游戏 ----
  function beginGame() {
    reset();
    state = STATE.COUNTDOWN;
    countdownText = "";
    hideOverlay();
    startCountdown(3, ++countdownToken);
  }

  function startCountdown(n, token) {
    if (token !== countdownToken) return; // 旧的倒计时已失效，直接丢弃
    countdownText = n > 0 ? String(n) : "GO!";
    if (n > 0) {
      sndStart();
      setTimeout(() => startCountdown(n - 1, token), 700);
    } else {
      sndGo();
      setTimeout(() => {
        if (token !== countdownToken) return;
        countdownText = "";
        state = STATE.RUNNING;
        lastTime = 0;
      }, 600);
    }
  }

  function backToMenu() {
    countdownToken++; // 让任何进行中的倒计时失效
    countdownText = "";
    state = STATE.READY;
    reset();
    showOverlay("准备好了吗？", "选择一个难度，然后开始");
  }

  function gameOver(reason) {
    state = STATE.OVER;
    shake = 14;
    sndCrash(); // 撞击墙壁 / 游戏结束音效
    showGameOver(reason);
  }

  function showGameOver(reason) {
    const reasonText =
      reason === "wall" ? "蛇撞到了墙 🧱" :
      reason === "self" ? "蛇咬到了自己 💫" : "";
    overlayTitle.textContent = "游戏结束 💥";
    overlayText.textContent =
      (reasonText ? reasonText + " · " : "") + "重新选择难度，再来一局";
    // 弹窗内展示：本局得分 + 历史最高
    let html =
      '<div class="stat"><span>本局得分</span><b>' + score + "</b></div>" +
      '<div class="stat"><span>历史最高</span><b>' + best + "</b></div>";
    if (newRecordThisGame) html += '<div class="record">🏆 新纪录！</div>';
    overlayScore.innerHTML = html;
    overlay.classList.remove("hidden");
  }

  function togglePause() {
    if (state === STATE.RUNNING) {
      state = STATE.PAUSED;
      showOverlay("已暂停 ⏸", "点击继续，或按空格");
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
    overlayScore.innerHTML = ""; // 非结束态不显示分数芯片
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
      if (state === STATE.READY || state === STATE.OVER) beginGame();
      else if (state === STATE.PAUSED) togglePause();
      return;
    }
    if (k === " " || k === "spacebar") {
      e.preventDefault();
      if (state === STATE.RUNNING || state === STATE.PAUSED) togglePause();
    }
  });

  // ---- 输入：触摸滑动（手机控制蛇方向）----
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
    if (state === STATE.READY || state === STATE.OVER) beginGame();
    else if (state === STATE.PAUSED) togglePause();
    touchStart = null;
  });

  // ---- 按钮 ----
  startBtn.addEventListener("click", () => {
    if (state === STATE.PAUSED) togglePause();
    else if (state === STATE.READY || state === STATE.OVER) beginGame();
  });
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", backToMenu);
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
  showOverlay("准备好了吗？", "选择一个难度，然后开始");
  rafId = requestAnimationFrame(loop);
})();
