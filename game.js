class InputManager {
  constructor() {
    this.left = false;
    this.right = false;
    this.pausePressed = false;
    this.keys = new Set();
    this.onChange = null;
    this.bindKeyboard();
  }

  bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      this.keys.add(event.code);
      this.syncKeys();
      this.notifyChange();
      if (event.code === "Escape" || event.code === "KeyP") {
        this.pausePressed = true;
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      this.syncKeys();
      this.notifyChange();
    });
  }

  syncKeys() {
    this.left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    this.right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
  }

  setTouch(direction, pressed) {
    if (direction === "left") this.left = pressed;
    if (direction === "right") this.right = pressed;
    this.notifyChange();
  }

  notifyChange() {
    if (this.onChange) this.onChange(this);
  }
}

class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.muted = localStorage.getItem("dtm_muted") === "true";
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.context) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.24;
    this.master.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem("dtm_muted", String(muted));
    if (this.master) this.master.gain.value = muted ? 0 : 0.24;
  }

  tone(freq, duration, type = "sine", volume = 0.35, slideTo = null) {
    this.ensure();
    if (!this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  click() {
    this.tone(520, 0.08, "triangle", 0.18, 820);
  }

  power() {
    this.tone(620, 0.11, "sine", 0.18, 1240);
    setTimeout(() => this.tone(920, 0.12, "sine", 0.14, 1480), 60);
  }

  nearMiss() {
    this.tone(980, 0.08, "square", 0.08, 1320);
  }

  explosion() {
    this.tone(140, 0.35, "sawtooth", 0.28, 42);
    setTimeout(() => this.tone(80, 0.22, "square", 0.12, 35), 90);
  }

  gameOver() {
    this.tone(280, 0.15, "triangle", 0.18, 180);
    setTimeout(() => this.tone(160, 0.22, "triangle", 0.14, 90), 150);
  }

  startMusic() {
    this.ensure();
    if (!this.context || this.musicTimer) return;
    if (this.context.state === "suspended") this.context.resume();

    const bass = [82.41, 82.41, 110, 98, 73.42, 73.42, 98, 110];
    const lead = [329.63, null, 392, null, 493.88, null, 440, null, 392, null, 329.63, null, 293.66, null, 329.63, null];
    const pad = [164.81, 196, 246.94, 329.63];
    this.musicTimer = setInterval(() => {
      if (!this.context || this.muted) return;
      const now = this.context.currentTime;
      const step = this.musicStep % 16;

      if (step % 4 === 0) {
        this.musicNote(bass[(this.musicStep / 4) % bass.length], now, 0.48, "triangle", 0.1, 360);
        this.kick(now);
      }

      if (step % 8 === 0) {
        const root = pad[(this.musicStep / 8) % pad.length];
        this.musicNote(root, now, 1.6, "sine", 0.025, 900);
        this.musicNote(root * 1.5, now + 0.03, 1.45, "sine", 0.018, 1200);
        this.musicNote(root * 2, now + 0.06, 1.35, "triangle", 0.014, 1500);
      }

      if (lead[step]) {
        this.musicNote(lead[step], now + 0.02, 0.22, "square", 0.035, 1800);
      }

      if (step % 2 === 1) this.hat(now);
      this.musicStep += 1;
    }, 260);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicStep = 0;
  }

  musicNote(freq, start, duration, type, volume, filterFreq) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFreq, start);
    filter.Q.value = 0.8;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  kick(start) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(92, start);
    osc.frequency.exponentialRampToValueAtTime(42, start + 0.16);
    gain.gain.setValueAtTime(0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(start);
    osc.stop(start + 0.2);
  }

  hat(start) {
    const bufferSize = Math.floor(this.context.sampleRate * 0.045);
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;

    const noise = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    noise.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(5200, start);
    gain.gain.setValueAtTime(0.025, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(start);
    noise.stop(start + 0.05);
  }
}

class Player {
  constructor(game) {
    this.game = game;
    this.width = 42;
    this.height = 56;
    this.x = game.width / 2;
    this.y = game.height - 96;
    this.vx = 0;
    this.maxSpeed = 936;
    this.minMoveSpeed = 228;
    this.acceleration = (this.maxSpeed - this.minMoveSpeed) / 2;
    this.brakeAcceleration = this.maxSpeed / 0.18;
    this.turnAcceleration = this.maxSpeed / 0.12;
    this.inputDirection = 0;
    this.shield = false;
    this.flamePhase = 0;
    this.bank = 0;
  }

  update(dt, input) {
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.inputDirection = direction;

    if (direction !== 0) {
      const sameDirection = Math.sign(this.vx) === direction || Math.abs(this.vx) < 1;
      if (!sameDirection) {
        this.vx = this.moveToward(this.vx, 0, this.turnAcceleration * dt);
        if (Math.abs(this.vx) < this.minMoveSpeed * 0.35) {
          this.vx = direction * this.minMoveSpeed;
        }
      } else {
        if (Math.abs(this.vx) < this.minMoveSpeed) {
          this.vx = direction * this.minMoveSpeed;
        }
        this.vx = this.moveToward(this.vx, direction * this.maxSpeed, this.acceleration * dt);
      }
    } else {
      this.vx = this.moveToward(this.vx, 0, this.brakeAcceleration * dt);
    }

    this.x += this.vx * dt;

    const minX = this.width / 2 + 8;
    const maxX = this.game.width - this.width / 2 - 8;
    if (this.x < minX) {
      this.x = minX;
      this.vx = Math.max(0, this.vx) * 0.25;
    } else if (this.x > maxX) {
      this.x = maxX;
      this.vx = Math.min(0, this.vx) * 0.25;
    }

    const targetBank = direction * 0.2;
    this.bank += (targetBank - this.bank) * Math.min(1, dt * 28);
    const mobileLift = window.matchMedia("(pointer: coarse)").matches || this.game.width < 760;
    this.y = this.game.height - (mobileLift ? 158 : Math.max(86, this.game.height * 0.13));
    this.flamePhase += dt * 18;
  }

  applyImmediateInput(input) {
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.inputDirection = direction;

    const minX = this.width / 2 + 8;
    const maxX = this.game.width - this.width / 2 - 8;

    if (direction !== 0) {
      const sameDirection = Math.sign(this.vx) === direction;
      if (!sameDirection || Math.abs(this.vx) < this.minMoveSpeed) {
        this.vx = direction * this.minMoveSpeed;
      }
    } else if (Math.abs(this.vx) < this.minMoveSpeed) {
      this.vx = 0;
    }

    this.x = Math.max(minX, Math.min(maxX, this.x));
  }

  moveToward(value, target, maxDelta) {
    if (Math.abs(target - value) <= maxDelta) return target;
    return value + Math.sign(target - value) * maxDelta;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.bank);
    ctx.scale(0.82, 0.82);

    if (this.shield) {
      const pulse = 1 + Math.sin(performance.now() / 130) * 0.04;
      ctx.strokeStyle = "rgba(49, 215, 255, 0.85)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#31d7ff";
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.ellipse(0, 2, 42 * pulse, 50 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const flame = 24 + Math.sin(this.flamePhase) * 8;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(0, 18, 2, 0, 18, 58);
    aura.addColorStop(0, "rgba(49, 215, 255, 0.45)");
    aura.addColorStop(0.42, "rgba(49, 215, 255, 0.16)");
    aura.addColorStop(1, "rgba(49, 215, 255, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 18, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const flameGradient = ctx.createLinearGradient(0, 26, 0, 72);
    flameGradient.addColorStop(0, "#f8fbff");
    flameGradient.addColorStop(0.25, "#62f3ff");
    flameGradient.addColorStop(0.62, "#158cff");
    flameGradient.addColorStop(1, "rgba(49, 215, 255, 0)");
    ctx.fillStyle = flameGradient;
    ctx.shadowColor = "#31d7ff";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(-12, 25);
    ctx.lineTo(0, 34 + flame);
    ctx.lineTo(12, 25);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = "rgba(49, 215, 255, 0.95)";
    ctx.shadowBlur = 18;
    const hull = ctx.createLinearGradient(-24, -36, 26, 34);
    hull.addColorStop(0, "#ffffff");
    hull.addColorStop(0.32, "#bcecff");
    hull.addColorStop(0.68, "#5e8bc6");
    hull.addColorStop(1, "#16264d");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -43);
    ctx.lineTo(30, 25);
    ctx.lineTo(15, 18);
    ctx.lineTo(7, 38);
    ctx.lineTo(0, 31);
    ctx.lineTo(-7, 38);
    ctx.lineTo(-15, 18);
    ctx.lineTo(-30, 25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(214, 250, 255, 0.72)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 10;
    const nose = ctx.createLinearGradient(0, -42, 0, -4);
    nose.addColorStop(0, "#ff385c");
    nose.addColorStop(1, "#7d1230");
    ctx.fillStyle = nose;
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(8, -5);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.fill();

    const glass = ctx.createRadialGradient(-3, -18, 2, 0, -14, 18);
    glass.addColorStop(0, "#f8fbff");
    glass.addColorStop(0.24, "#55e8ff");
    glass.addColorStop(0.62, "#1975ff");
    glass.addColorStop(1, "#071846");
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(0, -13, 10, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#07132f";
    ctx.fillRect(-19, 14, 10, 20);
    ctx.fillRect(9, 14, 10, 20);
    ctx.fillStyle = "#31d7ff";
    ctx.fillRect(-17, 25, 6, 10);
    ctx.fillRect(11, 25, 6, 10);
    ctx.restore();
  }

  collisionCircle() {
    return { x: this.x, y: this.y, r: 20 };
  }
}

class Meteor {
  constructor(game, spawnSpec) {
    this.reset(game, spawnSpec);
  }

  reset(game, spawnSpec = null) {
    this.game = game;
    const spec = spawnSpec || game.difficultyManager.createMeteorSpec(game.width);
    this.type = spec.type || "normal";
    this.size = spec.size || "medium";
    this.theme = this.themeForType(this.type);
    this.radius = spec.radius;
    this.x = spec.x;
    this.y = spec.y;
    this.vx = spec.vx;
    this.vy = spec.vy;
    this.rotation = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * (this.type === "fast" ? 5.2 : 3.5);
    this.flamePhase = Math.random() * Math.PI * 2;
    this.visualTilt = -0.16 + (Math.random() - 0.5) * 0.14;
    this.nearMissAwarded = false;
    this.hasTrail = spec.hasTrail;
    const tailBoost = this.type === "fast" ? 1.25 : this.type === "explosive" ? 1.12 : 1;
    this.tailLength = this.radius * (2.35 + Math.random() * 1.15) * tailBoost;
    this.tailLean = (Math.random() - 0.5) * this.radius * 0.75 - this.vx * 0.06;
    const pointCount = 10;
    this.points = Array.from({ length: pointCount }, (_, i) => {
      const a = (i / pointCount) * Math.PI * 2;
      return { a, r: this.radius * (0.72 + Math.random() * 0.38) };
    });
    this.lavaVeins = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => {
      const a = Math.random() * Math.PI * 2;
      const bend = (Math.random() - 0.5) * 0.95;
      const start = this.radius * (0.06 + Math.random() * 0.18);
      const mid = this.radius * (0.32 + Math.random() * 0.2);
      const end = this.radius * (0.58 + Math.random() * 0.26);
      return {
        width: 1.15 + Math.random() * 2.2,
        fork: Math.random() < 0.42,
        forkTurn: (Math.random() - 0.5) * 0.95,
        points: [
          { x: Math.cos(a) * start, y: Math.sin(a) * start },
          { x: Math.cos(a + bend * 0.46) * mid, y: Math.sin(a + bend * 0.46) * mid },
          { x: Math.cos(a + bend) * end, y: Math.sin(a + bend) * end },
        ],
      };
    });
    this.craters = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
      a: Math.random() * Math.PI * 2,
      d: this.radius * (0.12 + Math.random() * 0.48),
      r: this.radius * (0.08 + Math.random() * 0.13),
      shade: Math.random(),
    }));
    this.rockSprite = this.buildRockSprite();
    return this;
  }

  themeForType(type) {
    const themes = {
      normal: {
        aura0: "rgba(255, 171, 54, 0.34)",
        aura1: "rgba(255, 92, 31, 0.18)",
        aura2: "rgba(255, 37, 26, 0)",
        rim: "rgba(255, 120, 32, 0.84)",
        rimSoft: "rgba(255, 226, 137, 0.34)",
        glow: "#ff7623",
        lava0: "rgba(255, 252, 202, 0.96)",
        lava1: "rgba(255, 151, 31, 0.9)",
        lava2: "rgba(255, 54, 22, 0.16)",
      },
      fast: {
        aura0: "rgba(255, 220, 84, 0.32)",
        aura1: "rgba(255, 126, 24, 0.2)",
        aura2: "rgba(255, 40, 20, 0)",
        rim: "rgba(255, 190, 54, 0.9)",
        rimSoft: "rgba(255, 245, 168, 0.38)",
        glow: "#ffb12b",
        lava0: "rgba(255, 255, 220, 0.96)",
        lava1: "rgba(255, 177, 31, 0.9)",
        lava2: "rgba(255, 78, 22, 0.18)",
      },
      large: {
        aura0: "rgba(255, 118, 34, 0.36)",
        aura1: "rgba(255, 70, 28, 0.18)",
        aura2: "rgba(255, 20, 18, 0)",
        rim: "rgba(255, 105, 27, 0.84)",
        rimSoft: "rgba(255, 198, 120, 0.3)",
        glow: "#ff6c1f",
        lava0: "rgba(255, 240, 174, 0.94)",
        lava1: "rgba(255, 128, 30, 0.86)",
        lava2: "rgba(215, 40, 20, 0.16)",
      },
      special: {
        aura0: "rgba(168, 85, 247, 0.32)",
        aura1: "rgba(49, 215, 255, 0.16)",
        aura2: "rgba(168, 85, 247, 0)",
        rim: "rgba(168, 85, 247, 0.88)",
        rimSoft: "rgba(49, 215, 255, 0.34)",
        glow: "#a855f7",
        lava0: "rgba(235, 252, 255, 0.96)",
        lava1: "rgba(49, 215, 255, 0.84)",
        lava2: "rgba(168, 85, 247, 0.18)",
      },
      explosive: {
        aura0: "rgba(255, 77, 93, 0.34)",
        aura1: "rgba(255, 138, 31, 0.2)",
        aura2: "rgba(255, 77, 93, 0)",
        rim: "rgba(255, 77, 93, 0.88)",
        rimSoft: "rgba(255, 228, 92, 0.34)",
        glow: "#ff4d5d",
        lava0: "rgba(255, 255, 210, 0.98)",
        lava1: "rgba(255, 228, 92, 0.9)",
        lava2: "rgba(255, 77, 93, 0.22)",
      },
    };
    return themes[type] || themes.normal;
  }

  withAlpha(color, alpha) {
    if (color.startsWith("#") && color.length === 7) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color.replace(/rgba\(([^,]+),\s*([^,]+),\s*([^,]+),\s*[^)]+\)/, `rgba($1, $2, $3, ${alpha})`);
  }

  update(dt, slowFactor) {
    this.x += this.vx * slowFactor * dt;
    this.y += this.vy * slowFactor * dt;
    this.rotation += this.spin * dt;
    this.flamePhase += dt * (9 + this.vy / 80);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.visualTilt + Math.sin(this.flamePhase * 0.45) * 0.035);
    this.drawFastTrail(ctx);
    ctx.rotate(this.rotation);
    ctx.drawImage(this.rockSprite.canvas, -this.rockSprite.center, -this.rockSprite.center);
    ctx.restore();
  }

  buildRockSprite() {
    const size = Math.ceil(this.radius * 5.15);
    const center = size / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.translate(center, center);
    this.drawHeatAura(ctx);
    this.drawRockBody(ctx);
    this.drawLavaVeins(ctx);
    this.drawCraters(ctx);
    this.drawRockHighlights(ctx);
    return { canvas, center };
  }

  traceRock(ctx, scale = 1) {
    ctx.beginPath();
    this.points.forEach((p, i) => {
      const px = Math.cos(p.a) * p.r * scale;
      const py = Math.sin(p.a) * p.r * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  drawFastTrail(ctx) {
    if (!this.hasTrail) return;

    const r = this.radius;
    const pulse = 0.92 + Math.sin(this.flamePhase) * 0.08;
    const length = this.tailLength * pulse;
    const lean = this.tailLean + Math.sin(this.flamePhase * 0.8) * r * 0.22;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const gradient = ctx.createLinearGradient(0, -r * 0.3, lean, -length);
    gradient.addColorStop(0, this.withAlpha(this.theme.lava0, 0.58));
    gradient.addColorStop(0.34, this.withAlpha(this.theme.lava1, 0.38));
    gradient.addColorStop(0.72, this.withAlpha(this.theme.rim, 0.16));
    gradient.addColorStop(1, this.theme.aura2);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, -r * 0.34);
    ctx.bezierCurveTo(
      -r * 0.32,
      -r * 0.98,
      lean - r * 0.42,
      -length * 0.58,
      lean,
      -length
    );
    ctx.bezierCurveTo(
      lean + r * 0.46,
      -length * 0.62,
      r * 0.74,
      -r * 1.02,
      r * 0.68,
      -r * 0.32
    );
    ctx.quadraticCurveTo(0, -r * 0.62, -r * 0.72, -r * 0.34);
    ctx.closePath();
    ctx.fill();

    const inner = ctx.createLinearGradient(0, -r * 0.35, lean * 0.65, -length * 0.7);
    inner.addColorStop(0, "rgba(255, 255, 220, 0.64)");
    inner.addColorStop(0.48, this.withAlpha(this.theme.lava1, 0.34));
    inner.addColorStop(1, this.theme.aura2);
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, -r * 0.48);
    ctx.quadraticCurveTo(lean * 0.18, -length * 0.36, lean * 0.6, -length * 0.72);
    ctx.quadraticCurveTo(r * 0.28, -length * 0.42, r * 0.3, -r * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawHeatAura(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = this.theme.glow;
    ctx.shadowBlur = 26;
    const aura = ctx.createRadialGradient(0, 0, this.radius * 0.28, 0, 0, this.radius * 2.25);
    aura.addColorStop(0, this.theme.aura0);
    aura.addColorStop(0.46, this.theme.aura1);
    aura.addColorStop(1, this.theme.aura2);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawRockBody(ctx) {
    ctx.save();
    ctx.shadowColor = this.theme.glow;
    ctx.shadowBlur = 12;
    const rock = ctx.createRadialGradient(-this.radius * 0.36, -this.radius * 0.4, 2, this.radius * 0.24, this.radius * 0.24, this.radius * 1.18);
    rock.addColorStop(0, "#d18a5d");
    rock.addColorStop(0.17, "#9b624d");
    rock.addColorStop(0.48, "#503445");
    rock.addColorStop(0.78, "#281726");
    rock.addColorStop(1, "#100911");
    ctx.fillStyle = rock;
    this.traceRock(ctx);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = this.theme.glow;
    ctx.shadowBlur = 18;
    this.traceRock(ctx, 1.01);
    ctx.strokeStyle = this.theme.rim;
    ctx.lineWidth = Math.max(2.2, this.radius * 0.075);
    ctx.stroke();
    this.traceRock(ctx, 0.98);
    ctx.strokeStyle = this.theme.rimSoft;
    ctx.lineWidth = Math.max(1, this.radius * 0.026);
    ctx.stroke();
    ctx.restore();
  }

  drawLavaVeins(ctx) {
    ctx.save();
    this.traceRock(ctx, 0.94);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.lavaVeins.forEach((vein) => {
      const [p0, p1, p2] = vein.points;
      ctx.strokeStyle = "rgba(20, 9, 12, 0.76)";
      ctx.lineWidth = vein.width + 3.6;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      ctx.stroke();
    });

    ctx.globalCompositeOperation = "lighter";
    this.lavaVeins.forEach((vein) => {
      const [p0, p1, p2] = vein.points;
      const hot = ctx.createLinearGradient(p0.x, p0.y, p2.x, p2.y);
      hot.addColorStop(0, this.theme.lava0);
      hot.addColorStop(0.36, this.theme.lava1);
      hot.addColorStop(1, this.theme.lava2);
      ctx.strokeStyle = hot;
      ctx.lineWidth = vein.width;
      ctx.shadowColor = this.theme.glow;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      ctx.stroke();

      if (vein.fork) {
        const fx = p1.x + Math.cos(Math.atan2(p2.y - p0.y, p2.x - p0.x) + vein.forkTurn) * this.radius * 0.22;
        const fy = p1.y + Math.sin(Math.atan2(p2.y - p0.y, p2.x - p0.x) + vein.forkTurn) * this.radius * 0.22;
        ctx.lineWidth = Math.max(0.9, vein.width * 0.55);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(fx, fy);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  drawCraters(ctx) {
    ctx.save();
    this.traceRock(ctx, 0.96);
    ctx.clip();
    this.craters.forEach((crater) => {
      const a = crater.a + this.radius;
      const x = Math.cos(a) * crater.d;
      const y = Math.sin(a) * crater.d;
      const craterShade = ctx.createRadialGradient(x - crater.r * 0.3, y - crater.r * 0.36, 1, x, y, crater.r * 1.1);
      craterShade.addColorStop(0, `rgba(98, 64, 60, ${0.24 + crater.shade * 0.18})`);
      craterShade.addColorStop(0.64, "rgba(20, 12, 19, 0.7)");
      craterShade.addColorStop(1, "rgba(2, 1, 5, 0.42)");
      ctx.beginPath();
      ctx.fillStyle = craterShade;
      ctx.arc(x, y, crater.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 178, 95, 0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.restore();
  }

  drawRockHighlights(ctx) {
    ctx.save();
    this.traceRock(ctx, 0.98);
    ctx.clip();
    const highlight = ctx.createLinearGradient(-this.radius * 0.7, -this.radius * 0.65, this.radius * 0.35, this.radius * 0.5);
    highlight.addColorStop(0, "rgba(255, 232, 174, 0.28)");
    highlight.addColorStop(0.36, "rgba(255, 185, 99, 0.08)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.ellipse(-this.radius * 0.34, -this.radius * 0.38, this.radius * 0.48, this.radius * 0.22, -0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255, 225, 160, 0.22)";
    ctx.beginPath();
    ctx.ellipse(-this.radius * 0.44, -this.radius * 0.45, this.radius * 0.22, this.radius * 0.07, -0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isOffscreen() {
    return this.y - this.radius > this.game.height + 40;
  }
}

class PowerUp {
  constructor(game) {
    this.game = game;
    this.type = Math.random() < 0.55 ? "shield" : "slow";
    this.radius = 18;
    this.x = 28 + Math.random() * (game.width - 56);
    this.y = -32;
    this.vy = 120 + Math.random() * 60;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.phase += dt * 5;
  }

  draw(ctx) {
    const palette = this.type === "shield"
      ? {
        core: "#31d7ff",
        edge: "#0ea5e9",
        dark: "#06224f",
        accent: "#f8fbff",
        aura: "rgba(49, 215, 255, 0.34)",
      }
      : {
        core: "#d85cff",
        edge: "#7c3aed",
        dark: "#211044",
        accent: "#f8fbff",
        aura: "rgba(216, 92, 255, 0.32)",
      };

    ctx.save();
    ctx.translate(this.x, this.y);
    const pulse = 1 + Math.sin(this.phase) * 0.08;
    const spin = this.phase * (this.type === "shield" ? 0.7 : -0.9);

    this.drawPowerAura(ctx, palette, pulse);
    this.drawPowerCore(ctx, palette, pulse);
    if (this.type === "shield") {
      this.drawShieldIcon(ctx, palette, spin);
    } else {
      this.drawSlowIcon(ctx, palette, spin);
    }
    ctx.restore();
  }

  drawPowerAura(ctx, palette, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(0, 0, this.radius * 0.3, 0, 0, this.radius * 2.55 * pulse);
    halo.addColorStop(0, palette.aura);
    halo.addColorStop(0.48, this.withAlpha(palette.aura, 0.16));
    halo.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 2.55 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPowerCore(ctx, palette, pulse) {
    ctx.save();
    ctx.shadowColor = palette.core;
    ctx.shadowBlur = 18;
    const core = ctx.createRadialGradient(-this.radius * 0.34, -this.radius * 0.42, 1, 0, 0, this.radius * 1.18 * pulse);
    core.addColorStop(0, palette.accent);
    core.addColorStop(0.2, palette.core);
    core.addColorStop(0.6, palette.edge);
    core.addColorStop(1, palette.dark);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.withAlpha(palette.accent, 0.72);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.withAlpha(palette.core, 0.8);
    ctx.lineWidth = 1.4;
    ctx.rotate(this.phase * 0.85);
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 1.44 * pulse, this.radius * 0.56 * pulse, 0, 0.2, Math.PI * 1.45);
    ctx.stroke();
    ctx.restore();
  }

  drawShieldIcon(ctx, palette, spin) {
    ctx.save();
    ctx.rotate(spin * 0.12);
    ctx.shadowColor = palette.core;
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(2, 8, 24, 0.56)";
    ctx.strokeStyle = this.withAlpha(palette.accent, 0.86);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 0.72);
    ctx.lineTo(this.radius * 0.52, -this.radius * 0.36);
    ctx.lineTo(this.radius * 0.42, this.radius * 0.36);
    ctx.lineTo(0, this.radius * 0.72);
    ctx.lineTo(-this.radius * 0.42, this.radius * 0.36);
    ctx.lineTo(-this.radius * 0.52, -this.radius * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.withAlpha(palette.core, 0.82);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.26, -this.radius * 0.02);
    ctx.lineTo(-this.radius * 0.05, this.radius * 0.22);
    ctx.lineTo(this.radius * 0.34, -this.radius * 0.28);
    ctx.stroke();
    ctx.restore();
  }

  drawSlowIcon(ctx, palette, spin) {
    ctx.save();
    ctx.rotate(spin);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.withAlpha(palette.accent, 0.8);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.62, -0.35, Math.PI * 1.55);
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(Math.cos(-0.35) * this.radius * 0.62, Math.sin(-0.35) * this.radius * 0.62, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = palette.core;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = this.withAlpha(palette.accent, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -this.radius * 0.48);
    ctx.moveTo(0, 0);
    ctx.lineTo(this.radius * 0.4, this.radius * 0.2);
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  withAlpha(color, alpha) {
    return color.replace(/rgba\(([^,]+),\s*([^,]+),\s*([^,]+),\s*[^)]+\)/, `rgba($1, $2, $3, ${alpha})`);
  }

  isOffscreen() {
    return this.y - this.radius > this.game.height + 30;
  }
}

class Particle {
  constructor(x, y, color, speed = 260, life = 0.7, size = 4) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.25 + Math.random());
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * v;
    this.vy = Math.sin(a) * v;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size * (0.45 + Math.random());
  }

  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 220 * dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class EngineParticle {
  constructor(x = 0, y = 0) {
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x + (Math.random() - 0.5) * 14;
    this.y = y + 28 + Math.random() * 10;
    this.vx = (Math.random() - 0.5) * 34;
    this.vy = 70 + Math.random() * 95;
    this.life = 0.34 + Math.random() * 0.24;
    this.maxLife = this.life;
    this.size = 2 + Math.random() * 3.5;
    this.color = Math.random() < 0.72 ? "#31d7ff" : "#ff8a1f";
    return this;
  }

  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FloatingText {
  constructor(text, x, y, color = "#ffe45c") {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = 1;
  }

  update(dt) {
    this.life -= dt;
    this.y -= 42 * dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "700 20px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.root = document.querySelector(".game-shell");
    this.ctx = this.canvas.getContext("2d");
    this.input = new InputManager();
    this.input.onChange = () => this.applyImmediateInput();
    this.audio = new AudioSystem();
    this.difficultyManager = new DifficultyManager();
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.state = "menu";
    this.best = Number(localStorage.getItem("dtm_bestScore") || 0);
    this.lastTime = 0;
    this.scoreRemainder = 0;
    this.shake = 0;
    this.hudTimer = 0;
    this.engineEmitTimer = 0;
    this.stars = [];
    this.nebulaClouds = [];
    this.streaks = [];
    this.backgroundLayer = document.createElement("canvas");
    this.backgroundCtx = this.backgroundLayer.getContext("2d");
    this.battleBackground = new Image();
    this.battleBackground.onload = () => this.renderBackgroundLayer();
    this.battleBackground.src = "battle-background.png";
    this.battleBackgroundReady = false;
    this.engineParticlePool = [];
    this.meteorPool = [];
    this.combo = 1;
    this.comboTimer = 0;
    this.maxFrameTime = 1 / 30;
    this.bindUI();
    this.resize();
    this.resetWorld();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((time) => this.loop(time));
  }

  bindUI() {
    this.ui = {
      mainMenu: document.getElementById("mainMenu"),
      hud: document.getElementById("hud"),
      pauseMenu: document.getElementById("pauseMenu"),
      gameOver: document.getElementById("gameOverScreen"),
      instructions: document.getElementById("instructionsModal"),
      menuBest: document.getElementById("menuBestScore"),
      score: document.getElementById("scoreText"),
      best: document.getElementById("bestText"),
      time: document.getElementById("timeText"),
      combo: document.getElementById("comboText"),
      sector: document.getElementById("sectorText"),
      shield: document.getElementById("shieldStatus"),
      slow: document.getElementById("slowStatus"),
      finalScore: document.getElementById("finalScore"),
      finalBest: document.getElementById("finalBest"),
      survivalTime: document.getElementById("survivalTime"),
      mute: document.getElementById("muteButton"),
    };

    const click = (id, handler) => {
      document.getElementById(id).addEventListener("click", () => {
        this.audio.click();
        handler();
      });
    };

    click("playButton", () => this.startGame());
    click("instructionsButton", () => this.showInstructions());
    click("closeInstructionsButton", () => this.hideInstructions());
    click("pauseButton", () => this.pauseGame());
    click("resumeButton", () => this.resumeGame());
    click("restartPauseButton", () => this.startGame());
    click("mainFromPauseButton", () => this.goToMenu());
    click("playAgainButton", () => this.startGame());
    click("mainFromGameOverButton", () => this.goToMenu());

    this.ui.mute.addEventListener("click", () => {
      this.audio.setMuted(!this.audio.muted);
      this.syncMute();
    });

    [["leftButton", "left"], ["rightButton", "right"]].forEach(([id, dir]) => {
      const button = document.getElementById(id);
      const press = (event) => {
        event.preventDefault();
        if (event.pointerId !== undefined && button.setPointerCapture) {
          button.setPointerCapture(event.pointerId);
        }
        this.input.setTouch(dir, true);
      };
      const release = (event) => {
        event.preventDefault();
        if (event.pointerId !== undefined && button.releasePointerCapture && button.hasPointerCapture && button.hasPointerCapture(event.pointerId)) {
          button.releasePointerCapture(event.pointerId);
        }
        this.input.setTouch(dir, false);
      };
      if (window.PointerEvent) {
        button.addEventListener("pointerdown", press);
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
      } else {
        button.addEventListener("touchstart", press, { passive: false });
        button.addEventListener("touchend", release, { passive: false });
        button.addEventListener("mousedown", press);
        button.addEventListener("mouseup", release);
        button.addEventListener("mouseleave", release);
      }
    });

    this.syncBest();
    this.syncMute();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(320, rect.width);
    this.height = Math.max(420, rect.height);
    this.dpr = 1;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.createStars();
    if (this.player) this.player.y = this.height - 96;
  }

  applyImmediateInput() {
    if (this.state !== "playing" || !this.player) return;
    this.player.applyImmediateInput(this.input);
  }

  createStars() {
    const count = Math.floor((this.width * this.height) / 30000);
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      r: Math.random() * 1.8 + 0.28,
      speed: 12 + Math.random() * 85,
      alpha: 0.35 + Math.random() * 0.65,
      twinkle: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.18 ? "#9cc9ff" : "#f8fbff",
    }));
    this.nebulaClouds = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      rx: this.width * (0.18 + Math.random() * 0.18),
      ry: this.height * (0.14 + Math.random() * 0.18),
      color: i % 2 === 0 ? "49, 141, 255" : "168, 85, 247",
      alpha: 0.08 + Math.random() * 0.11,
      drift: 4 + Math.random() * 10,
    }));
    this.streaks = Array.from({ length: 1 }, () => this.makeStreak(true));
    this.renderBackgroundLayer();
  }

  renderBackgroundLayer() {
    const ctx = this.backgroundCtx;
    this.backgroundLayer.width = Math.max(1, Math.floor(this.width));
    this.backgroundLayer.height = Math.max(1, Math.floor(this.height));

    if (this.battleBackground.complete && this.battleBackground.naturalWidth > 0) {
      this.battleBackgroundReady = true;
      this.drawCoverImage(ctx, this.battleBackground);
      ctx.fillStyle = "rgba(0, 3, 14, 0.1)";
      ctx.fillRect(0, 0, this.width, this.height);
      this.drawStaticSpaceOverlay(ctx);
      return;
    }

    this.battleBackgroundReady = false;
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, "#02030d");
    gradient.addColorStop(0.28, "#061743");
    gradient.addColorStop(0.58, "#110735");
    gradient.addColorStop(1, "#02030a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    const fixedClouds = [
      { x: this.width * 0.18, y: this.height * 0.58, rx: this.width * 0.46, ry: this.height * 0.34, color: "25, 125, 255", alpha: 0.24 },
      { x: this.width * 0.72, y: this.height * 0.26, rx: this.width * 0.48, ry: this.height * 0.42, color: "168, 85, 247", alpha: 0.22 },
      { x: this.width * 0.52, y: this.height * 0.82, rx: this.width * 0.52, ry: this.height * 0.28, color: "22, 197, 255", alpha: 0.15 },
      { x: this.width * 0.88, y: this.height * 0.78, rx: this.width * 0.28, ry: this.height * 0.32, color: "60, 80, 255", alpha: 0.16 },
    ];

    [...fixedClouds, ...this.nebulaClouds].forEach((cloud) => {
      const g = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, Math.max(cloud.rx, cloud.ry));
      g.addColorStop(0, `rgba(${cloud.color}, ${cloud.alpha})`);
      g.addColorStop(0.5, `rgba(${cloud.color}, ${cloud.alpha * 0.42})`);
      g.addColorStop(1, `rgba(${cloud.color}, 0)`);
      ctx.save();
      ctx.scale(1, cloud.ry / cloud.rx);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y / (cloud.ry / cloud.rx), cloud.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 900; i += 1) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const dust = Math.random() * 1.2;
      ctx.globalAlpha = 0.05 + Math.random() * 0.18;
      ctx.fillStyle = Math.random() < 0.5 ? "#6ecfff" : "#c084fc";
      ctx.fillRect(x, y, dust, dust);
    }
    ctx.restore();

    for (let i = 0; i < 320; i += 1) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const r = Math.random() < 0.08 ? 1.8 + Math.random() * 2.2 : 0.35 + Math.random() * 1.1;
      const alpha = 0.18 + Math.random() * 0.72;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = Math.random() < 0.12 ? "#9cc9ff" : "#f8fbff";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = r > 1.8 ? 10 : 0;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "rgba(156, 201, 255, 0.32)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.width * 0.88, this.height * 0.18, this.width * 0.18, this.height * 0.1, 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = "rgba(84, 55, 154, 0.55)";
    ctx.beginPath();
    ctx.arc(this.width * 0.91, this.height * 0.2, this.width * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.drawStaticSpaceOverlay(ctx);
  }

  drawCoverImage(ctx, image, offsetX = 0, offsetY = 0) {
    const scale = Math.max(this.width / image.width, this.height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const extraX = Math.max(0, drawWidth - this.width);
    const extraY = Math.max(0, drawHeight - this.height);
    const x = -extraX / 2 + offsetX;
    const y = -extraY / 2 + offsetY;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  }

  drawStaticSpaceOverlay(ctx) {
    const glow = ctx.createRadialGradient(this.width * 0.5, this.height * 0.76, 0, this.width * 0.5, this.height * 0.76, this.width * 0.55);
    glow.addColorStop(0, "rgba(25, 231, 255, 0.08)");
    glow.addColorStop(0.45, "rgba(124, 58, 237, 0.05)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    const vignette = ctx.createRadialGradient(this.width * 0.5, this.height * 0.5, this.height * 0.18, this.width * 0.5, this.height * 0.5, this.width * 0.72);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  makeStreak(randomY = false) {
    return {
      x: Math.random() * this.width,
      y: randomY ? Math.random() * this.height : -80 - Math.random() * 160,
      length: 80 + Math.random() * 160,
      speed: 160 + Math.random() * 220,
      alpha: 0.22 + Math.random() * 0.4,
    };
  }

  resetWorld() {
    if (this.meteors) {
      this.meteors.forEach((meteor) => this.recycleMeteor(meteor));
    }
    this.difficultyManager.reset();
    this.player = new Player(this);
    this.meteors = [];
    this.powerUps = [];
    this.particles = [];
    this.engineParticles = [];
    this.texts = [];
    this.elapsed = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.spawnTimer = this.difficultyManager.getNextSpawnDelay();
    this.powerTimer = 7;
    this.slowTimer = 0;
    this.scoreRemainder = 0;
    this.shake = 0;
    this.hudTimer = 0;
    this.engineEmitTimer = 0;
  }

  spawnMeteor(spawnSpec) {
    const meteor = this.meteorPool.pop();
    if (meteor) {
      this.meteors.push(meteor.reset(this, spawnSpec));
      return;
    }
    this.meteors.push(new Meteor(this, spawnSpec));
  }

  recycleMeteor(meteor) {
    if (!meteor) return;
    meteor.rockSprite = null;
    if (this.meteorPool.length < 50) {
      this.meteorPool.push(meteor);
    }
  }

  startGame() {
    this.audio.ensure();
    this.audio.startMusic();
    this.resetWorld();
    this.state = "playing";
    this.root.classList.add("is-playing");
    this.hideAllScreens();
    this.ui.hud.classList.remove("hidden");
    this.syncBest();
    this.updateHud();
    this.lastTime = performance.now();
  }

  pauseGame() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.root.classList.remove("is-playing");
    this.ui.pauseMenu.classList.remove("hidden");
    this.ui.pauseMenu.classList.add("active");
  }

  resumeGame() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.root.classList.add("is-playing");
    this.ui.pauseMenu.classList.add("hidden");
    this.ui.pauseMenu.classList.remove("active");
    this.lastTime = performance.now();
  }

  goToMenu() {
    this.state = "menu";
    this.root.classList.remove("is-playing");
    this.audio.stopMusic();
    this.clearGameplayScene();
    this.hideAllScreens();
    this.ui.mainMenu.classList.remove("hidden");
    this.ui.mainMenu.classList.add("active");
    this.ui.hud.classList.add("hidden");
    this.syncBest();
  }

  clearGameplayScene() {
    if (this.meteors) {
      this.meteors.forEach((meteor) => this.recycleMeteor(meteor));
      this.meteors = [];
    }
    this.powerUps = [];
    this.particles = [];
    if (this.engineParticles) {
      this.engineParticles.forEach((particle) => {
        if (this.engineParticlePool.length < 80) this.engineParticlePool.push(particle);
      });
      this.engineParticles = [];
    }
    this.texts = [];
    this.shake = 0;
    this.slowTimer = 0;
    this.input.pausePressed = false;
    if (this.player) this.player.shield = false;
  }

  showInstructions() {
    this.ui.instructions.classList.remove("hidden");
    this.ui.instructions.classList.add("active");
  }

  hideInstructions() {
    this.ui.instructions.classList.add("hidden");
    this.ui.instructions.classList.remove("active");
  }

  hideAllScreens() {
    [this.ui.mainMenu, this.ui.pauseMenu, this.ui.gameOver, this.ui.instructions].forEach((screen) => {
      screen.classList.add("hidden");
      screen.classList.remove("active");
    });
  }

  endGame() {
    this.state = "gameover";
    this.root.classList.remove("is-playing");
    this.audio.explosion();
    setTimeout(() => this.audio.gameOver(), 260);
    this.audio.stopMusic();
    this.explode(this.player.x, this.player.y);
    this.shake = 0.45;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem("dtm_bestScore", String(this.best));
    }
    setTimeout(() => {
      this.ui.finalScore.textContent = this.score;
      this.ui.finalBest.textContent = this.best;
      this.ui.survivalTime.textContent = `${Math.floor(this.elapsed)}s`;
      this.ui.gameOver.classList.remove("hidden");
      this.ui.gameOver.classList.add("active");
      this.ui.hud.classList.add("hidden");
      this.syncBest();
    }, 650);
  }

  syncBest() {
    this.ui.menuBest.textContent = this.best;
    this.ui.best.textContent = this.best;
  }

  syncMute() {
    this.ui.mute.textContent = this.audio.muted ? "Muted" : "Sound On";
  }

  difficulty() {
    return this.difficultyManager.getSettings();
  }

  update(dt) {
    this.updateStars(dt);
    this.particles.forEach((p) => p.update(dt));
    this.engineParticles.forEach((p) => p.update(dt));
    this.texts.forEach((t) => t.update(dt));
    this.particles = this.particles.filter((p) => p.life > 0);
    for (let i = this.engineParticles.length - 1; i >= 0; i -= 1) {
      if (this.engineParticles[i].life <= 0) {
        this.engineParticlePool.push(this.engineParticles[i]);
        this.engineParticles.splice(i, 1);
      }
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.shake > 0) this.shake -= dt;

    if (this.state !== "playing") return;
    if (this.input.pausePressed) {
      this.input.pausePressed = false;
      this.pauseGame();
      return;
    }

    this.elapsed += dt;
    this.difficultyManager.update(dt, this.elapsed);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.combo = 1;
    this.scoreRemainder += dt * 10;
    if (this.scoreRemainder >= 1) {
      const gain = Math.floor(this.scoreRemainder);
      this.score += gain;
      this.scoreRemainder -= gain;
    }

    this.player.update(dt, this.input);
    this.spawnEngineExhaust(dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    const slowFactor = this.slowTimer > 0 ? 0.5 : 1;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.difficultyManager.canSpawn(this.meteors.length)) {
        const batch = this.difficultyManager.createSpawnBatch(this.width, this.meteors.length);
        batch.forEach((spawnSpec) => this.spawnMeteor(spawnSpec));
        this.spawnTimer += this.difficultyManager.getNextSpawnDelay();
      } else {
        this.spawnTimer = 0.12;
      }
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      this.powerUps.push(new PowerUp(this));
      this.powerTimer = 9 + Math.random() * 8;
    }

    this.meteors.forEach((m) => m.update(dt, slowFactor));
    this.powerUps.forEach((p) => p.update(dt));
    this.checkCollisions();
    for (let i = this.meteors.length - 1; i >= 0; i -= 1) {
      if (this.meteors[i].isOffscreen()) {
        this.recycleMeteor(this.meteors.splice(i, 1)[0]);
      }
    }
    this.powerUps = this.powerUps.filter((p) => !p.isOffscreen());
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.updateHud();
      this.hudTimer = 0.08;
    }
  }

  spawnEngineExhaust(dt) {
    this.engineEmitTimer -= dt;
    if (this.engineEmitTimer > 0) return;
    const count = Math.abs(this.player.vx) > this.player.maxSpeed * 0.55 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const particle = this.engineParticlePool.pop() || new EngineParticle();
      this.engineParticles.push(particle.reset(this.player.x, this.player.y));
    }
    this.engineEmitTimer = Math.abs(this.player.vx) > 0 ? 0.026 : 0.044;
  }

  updateStars(dt) {
    this.streaks.forEach((streak) => {
      streak.x -= streak.speed * 0.85 * dt;
      streak.y += streak.speed * 0.38 * dt;
      if (streak.x + streak.length < -80 || streak.y > this.height + 80) {
        Object.assign(streak, this.makeStreak());
        streak.x = this.width + Math.random() * this.width * 0.5;
      }
    });

    this.stars.forEach((star) => {
      star.y += star.speed * dt;
      star.twinkle += dt * 2;
      if (star.y > this.height) {
        star.y = -4;
        star.x = Math.random() * this.width;
      }
    });
  }

  checkCollisions() {
    const player = this.player.collisionCircle();
    for (const meteor of this.meteors) {
      const hitRadius = player.r + meteor.radius * 0.72;
      if (this.circleOverlap(player.x, player.y, hitRadius, meteor.x, meteor.y, 0)) {
        if (this.player.shield) {
          this.player.shield = false;
          this.shake = Math.max(this.shake, 0.28);
          this.explode(meteor.x, meteor.y, "#31d7ff");
          meteor.y = this.height + meteor.radius + 80;
          meteor.vy = Math.abs(meteor.vy) * 0.35;
          this.player.vx *= -0.35;
          this.texts.push(new FloatingText("Shield Saved You", this.player.x, this.player.y - 54, "#31d7ff"));
          this.audio.power();
        } else {
          this.endGame();
        }
        return;
      }

      const nearRadius = player.r + meteor.radius + 34;
      if (!meteor.nearMissAwarded && meteor.y > player.y - 8 && meteor.y < player.y + 58 && this.circleOverlap(player.x, player.y, nearRadius, meteor.x, meteor.y, 0)) {
        meteor.nearMissAwarded = true;
        this.combo = Math.min(9, this.combo + 1);
        this.comboTimer = 3.2;
        const bonus = 10 * this.combo;
        this.score += bonus;
        this.texts.push(new FloatingText(`Near Miss +${bonus}`, meteor.x, meteor.y, "#ffe45c"));
        this.audio.nearMiss();
      }
    }

    for (const power of this.powerUps) {
      if (this.circleOverlap(player.x, player.y, player.r + power.radius, power.x, power.y, 0)) {
        if (power.type === "shield") {
          this.player.shield = true;
          this.texts.push(new FloatingText("Shield Ready", power.x, power.y, "#31d7ff"));
        } else {
          this.slowTimer = 5;
          this.texts.push(new FloatingText("Slow Time", power.x, power.y, "#d8b4fe"));
        }
        this.score += 15;
        this.explode(power.x, power.y, power.type === "shield" ? "#31d7ff" : "#a855f7", 12);
        power.y = this.height + 80;
        this.audio.power();
      }
    }
  }

  circleOverlap(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const radius = ar + br;
    return dx * dx + dy * dy < radius * radius;
  }

  explode(x, y, color = "#ff8a1f", amount = 30) {
    for (let i = 0; i < amount; i += 1) {
      const palette = [color, "#ffe45c", "#ff4d5d", "#f8fbff"];
      this.particles.push(new Particle(x, y, palette[i % palette.length], 360, 0.75, 6));
    }
  }

  updateHud() {
    this.ui.score.textContent = this.score;
    this.ui.best.textContent = Math.max(this.best, this.score);
    const seconds = Math.floor(this.elapsed);
    this.ui.time.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    this.ui.combo.textContent = `x${this.combo}`;
    this.ui.sector.textContent = this.sectorName();
    if (this.ui.shield) {
      this.ui.shield.textContent = this.player.shield ? "Shield: Ready" : "Shield: Off";
      this.ui.shield.className = `status-chip ${this.player.shield ? "on" : "off"}`;
    }
    if (this.ui.slow) {
      this.ui.slow.textContent = this.slowTimer > 0 ? `Slow: ${this.slowTimer.toFixed(1)}s` : "Slow: Off";
      this.ui.slow.className = `status-chip ${this.slowTimer > 0 ? "slow" : "off"}`;
    }
  }

  sectorName() {
    return this.difficultyManager.phaseName;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    if (this.shake > 0) {
      const power = this.shake * 16;
      ctx.translate((Math.random() - 0.5) * power, (Math.random() - 0.5) * power);
    }

    this.drawBackground(ctx);
    if (this.state === "menu") {
      ctx.restore();
      return;
    }

    this.powerUps.forEach((p) => p.draw(ctx));
    this.meteors.forEach((m) => m.draw(ctx));
    this.engineParticles.forEach((p) => p.draw(ctx));
    if (this.state === "playing" || this.state === "paused") this.player.draw(ctx);
    this.particles.forEach((p) => p.draw(ctx));
    this.texts.forEach((t) => t.draw(ctx));
    ctx.restore();
  }

  drawBackground(ctx) {
    ctx.drawImage(this.backgroundLayer, 0, 0, this.width, this.height);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    this.streaks.forEach((streak) => {
      ctx.globalAlpha = streak.alpha;
      ctx.strokeStyle = "rgba(156, 201, 255, 0.78)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x + streak.length, streak.y - streak.length * 0.36);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    this.stars.forEach((star) => {
      ctx.globalAlpha = star.alpha * (0.65 + Math.sin(star.twinkle) * 0.25);
      ctx.fillStyle = star.hue;
      if (star.r < 1.15) {
        ctx.fillRect(star.x, star.y, star.r + 0.65, star.r + 0.65);
      } else {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  loop(time) {
    const frameDt = Math.min((time - this.lastTime) / 1000 || 0, this.maxFrameTime);
    this.lastTime = time;
    this.update(frameDt);
    this.draw();
    requestAnimationFrame((next) => this.loop(next));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.dodgeTheMeteors = new Game();
});
