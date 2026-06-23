class MeteorPatternManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.patternIndex = 0;
    this.groupCooldown = 0;
    this.waveCooldown = 0;
    this.stormCooldown = 0;
  }

  update(dt) {
    this.groupCooldown = Math.max(0, this.groupCooldown - dt);
    this.waveCooldown = Math.max(0, this.waveCooldown - dt);
    this.stormCooldown = Math.max(0, this.stormCooldown - dt);
  }

  createBatch(manager, width, settings, activeCount) {
    const availableSlots = Math.max(0, Math.round(settings.maxActive) - activeCount);
    if (availableSlots <= 0) return [];

    const pressureNeeded = Math.max(0, Math.ceil(settings.minActive - activeCount));
    const pattern = this.choosePattern(settings, availableSlots);
    const count = Math.min(availableSlots, this.countForPattern(pattern, settings, pressureNeeded));
    const placements = this.createPlacements(width, pattern, count, settings);
    this.patternIndex += 1;

    return placements.map((placement, index) => manager.createMeteorSpec(width, placement, index, placements.length));
  }

  choosePattern(settings, availableSlots) {
    const weights = { ...settings.patternWeights };
    if (availableSlots < 2 || this.groupCooldown > 0) weights.group = 0;
    if (availableSlots < 4 || this.waveCooldown > 0) weights.wave = 0;
    if (availableSlots < 3 || this.stormCooldown > 0) weights.diagonalRain *= 0.35;

    const pattern = this.pickWeighted(weights);
    if (pattern === "group") this.groupCooldown = settings.groupCooldown;
    if (pattern === "wave") this.waveCooldown = settings.waveCooldown;
    if (pattern === "diagonalRain") this.stormCooldown = settings.stormCooldown;
    return pattern;
  }

  countForPattern(pattern, settings, pressureNeeded) {
    const pressureCount = Math.min(3, Math.max(1, pressureNeeded));
    if (pattern === "group") return Math.max(2, pressureCount);
    if (pattern === "diagonalRain") return Math.max(2, Math.min(settings.maxBatch, pressureCount + 1));
    if (pattern === "wave") return Math.min(settings.maxBatch, Math.max(4, pressureCount + 2));
    if (pattern === "mixed") return Math.min(settings.maxBatch, Math.max(2, pressureCount + 1));
    return pressureNeeded > 0 ? pressureCount : 1;
  }

  createPlacements(width, pattern, count, settings) {
    if (pattern === "group") return this.group(width, count);
    if (pattern === "diagonalRain") return this.diagonalRain(count);
    if (pattern === "wave") return this.wave(width, count);
    if (pattern === "mixed") return this.mixed(width, count, settings);
    return this.verticalRain(width, count);
  }

  verticalRain(width, count) {
    return Array.from({ length: count }, (_, index) => ({
      pattern: "verticalRain",
      direction: "vertical",
      xRatio: Math.random(),
      yOffset: index * 30,
    }));
  }

  group(width, count) {
    const centerRatio = 0.18 + Math.random() * 0.64;
    return Array.from({ length: count }, (_, index) => ({
      pattern: "group",
      direction: "vertical",
      xRatio: centerRatio,
      groupOffset: (index - (count - 1) / 2) * (34 + Math.random() * 18),
      yOffset: index * 18,
    }));
  }

  diagonalRain(count) {
    return Array.from({ length: count }, (_, index) => ({
      pattern: "diagonalRain",
      direction: "diagonalRight",
      edgeBias: Math.random() * 0.34,
      angle: 20 + Math.random() * 25,
      yOffset: index * 34,
    }));
  }

  wave(width, count) {
    const laneCount = Math.max(6, count + 1);
    const safeLane = Math.floor(Math.random() * laneCount);
    const direction = this.patternIndex % 2 === 0 ? 1 : -1;
    const lanes = [];

    for (let lane = 0; lane < laneCount && lanes.length < count; lane += 1) {
      const directedLane = direction === 1 ? lane : laneCount - lane - 1;
      if (directedLane === safeLane) continue;
      lanes.push(directedLane);
    }

    return lanes.map((lane, index) => ({
      pattern: "wave",
      direction: Math.random() < 0.22 ? "diagonalRight" : "vertical",
      lane,
      laneCount,
      yOffset: index * 22,
    }));
  }

  mixed(width, count, settings) {
    return Array.from({ length: count }, (_, index) => {
      const diagonal = Math.random() < settings.diagonalChance;
      return {
        pattern: "mixed",
        direction: diagonal ? "diagonalRight" : "vertical",
        xRatio: Math.random(),
        angle: 20 + Math.random() * 25,
        yOffset: index * 26,
      };
    });
  }

  pickWeighted(weights) {
    const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    let roll = Math.random() * total;

    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[0]?.[0] || "verticalRain";
  }
}

class DifficultyManager {
  constructor() {
    this.maxMeteorSpeed = 960;
    this.minSpawnInterval = 0.18;
    this.patternManager = new MeteorPatternManager();
    this.phases = [
      {
        name: "Training Zone",
        start: 0,
        settings: {
          spawnInterval: 0.38,
          speedMin: 300,
          speedMax: 420,
          minActive: 14,
          maxActive: 24,
          maxBatch: 4,
          diagonalChance: 0,
          sizeWeights: { small: 0.38, medium: 0.4, large: 0.22 },
          typeWeights: { normal: 0.4, fast: 0.38, large: 0.22, special: 0, explosive: 0 },
          patternWeights: { verticalRain: 1, group: 0, diagonalRain: 0, wave: 0, mixed: 0 },
          groupCooldown: 99,
          waveCooldown: 99,
          stormCooldown: 99,
        },
      },
      {
        name: "Beginner Challenge",
        start: 20,
        settings: {
          spawnInterval: 0.25,
          speedMin: 430,
          speedMax: 600,
          minActive: 22,
          maxActive: 34,
          maxBatch: 5,
          diagonalChance: 0,
          sizeWeights: { small: 0.3, medium: 0.42, large: 0.28 },
          typeWeights: { normal: 0.28, fast: 0.36, large: 0.25, special: 0.11, explosive: 0 },
          patternWeights: { verticalRain: 0.42, group: 0.58, diagonalRain: 0, wave: 0, mixed: 0 },
          groupCooldown: 2.4,
          waveCooldown: 99,
          stormCooldown: 99,
        },
      },
      {
        name: "Medium Survival",
        start: 45,
        settings: {
          spawnInterval: 0.2,
          speedMin: 570,
          speedMax: 760,
          minActive: 32,
          maxActive: 48,
          maxBatch: 7,
          diagonalChance: 0,
          sizeWeights: { small: 0.24, medium: 0.42, large: 0.34 },
          typeWeights: { normal: 0.22, fast: 0.34, large: 0.27, special: 0.17, explosive: 0 },
          patternWeights: { verticalRain: 0.34, group: 0.66, diagonalRain: 0, wave: 0, mixed: 0 },
          groupCooldown: 1.8,
          waveCooldown: 99,
          stormCooldown: 99,
        },
      },
      {
        name: "Hard Mode",
        start: 120,
        settings: {
          spawnInterval: 0.18,
          speedMin: 700,
          speedMax: 900,
          minActive: 44,
          maxActive: 64,
          maxBatch: 8,
          diagonalChance: 0.55,
          sizeWeights: { small: 0.18, medium: 0.4, large: 0.42 },
          typeWeights: { normal: 0.14, fast: 0.34, large: 0.27, special: 0.18, explosive: 0.07 },
          patternWeights: { verticalRain: 0.12, group: 0.22, diagonalRain: 0.3, wave: 0, mixed: 0.36 },
          groupCooldown: 1.4,
          waveCooldown: 99,
          stormCooldown: 2.5,
        },
      },
      {
        name: "Extreme Survival",
        start: 300,
        settings: {
          spawnInterval: 0.18,
          speedMin: 820,
          speedMax: 960,
          minActive: 56,
          maxActive: 78,
          maxBatch: 10,
          diagonalChance: 0.68,
          sizeWeights: { small: 0.14, medium: 0.36, large: 0.5 },
          typeWeights: { normal: 0.1, fast: 0.3, large: 0.24, special: 0.2, explosive: 0.16 },
          patternWeights: { verticalRain: 0.05, group: 0.14, diagonalRain: 0.34, wave: 0.22, mixed: 0.25 },
          groupCooldown: 1.1,
          waveCooldown: 3.8,
          stormCooldown: 1.9,
        },
      },
    ];
    this.reset();
  }

  reset() {
    this.survivalTime = 0;
    this.current = this.cloneSettings(this.phases[0].settings);
    this.phaseName = this.phases[0].name;
    this.firstDelayPending = true;
    this.wasDiagonalStorm = false;
    this.patternManager.reset();
  }

  update(dt, survivalTime) {
    this.survivalTime = survivalTime;
    this.patternManager.update(dt);

    const target = this.getTargetSettings(survivalTime);
    const blend = Math.min(1, 1 - Math.exp(-dt * 0.92));
    this.current.spawnInterval = this.lerp(this.current.spawnInterval, target.spawnInterval, blend);
    this.current.speedMin = this.lerp(this.current.speedMin, target.speedMin, blend);
    this.current.speedMax = this.lerp(this.current.speedMax, target.speedMax, blend);
    this.current.minActive = this.lerp(this.current.minActive, target.minActive, blend);
    this.current.maxActive = this.lerp(this.current.maxActive, target.maxActive, blend);
    this.current.maxBatch = this.lerp(this.current.maxBatch, target.maxBatch, blend);
    this.current.sizeWeights = this.lerpWeights(this.current.sizeWeights, target.sizeWeights, blend);
    this.current.typeWeights = this.lerpWeights(this.current.typeWeights, target.typeWeights, blend);

    const patternBlend = target.forceDiagonalOnly || this.wasDiagonalStorm ? 1 : blend;
    this.current.diagonalChance = this.lerp(this.current.diagonalChance, target.diagonalChance, patternBlend);
    this.current.patternWeights = this.lerpWeights(this.current.patternWeights, target.patternWeights, patternBlend);
    this.current.groupCooldown = this.lerp(this.current.groupCooldown, target.groupCooldown, patternBlend);
    this.current.waveCooldown = this.lerp(this.current.waveCooldown, target.waveCooldown, patternBlend);
    this.current.stormCooldown = this.lerp(this.current.stormCooldown, target.stormCooldown, patternBlend);
    this.phaseName = target.phaseName;
    this.wasDiagonalStorm = Boolean(target.forceDiagonalOnly);
  }

  getSettings() {
    return {
      phaseName: this.phaseName,
      spawnInterval: Math.max(this.minSpawnInterval, this.current.spawnInterval),
      speedMin: this.current.speedMin,
      speedMax: Math.min(this.maxMeteorSpeed, this.current.speedMax),
      minActive: this.current.minActive,
      maxActive: this.current.maxActive,
      maxBatch: Math.round(this.current.maxBatch),
      diagonalChance: Math.min(0.86, this.current.diagonalChance),
      sizeWeights: { ...this.current.sizeWeights },
      typeWeights: { ...this.current.typeWeights },
      patternWeights: { ...this.current.patternWeights },
      groupCooldown: this.current.groupCooldown,
      waveCooldown: this.current.waveCooldown,
      stormCooldown: this.current.stormCooldown,
    };
  }

  getTargetSettings(time) {
    let phase = this.phases[0];
    for (let i = this.phases.length - 1; i >= 0; i -= 1) {
      if (time >= this.phases[i].start) {
        phase = this.phases[i];
        break;
      }
    }

    const target = this.cloneSettings(phase.settings);
    target.phaseName = phase.name;

    if (time >= 600) {
      const extraMinutes = Math.max(0, (time - 600) / 60);
      const speedScale = Math.pow(1.05, extraMinutes);
      target.speedMin = Math.min(this.maxMeteorSpeed * 0.86, target.speedMin * speedScale);
      target.speedMax = Math.min(this.maxMeteorSpeed, target.speedMax * speedScale);
      target.spawnInterval = Math.max(this.minSpawnInterval, target.spawnInterval / speedScale);
      target.typeWeights.special += extraMinutes * 0.02;
      target.typeWeights.normal = Math.max(0.08, target.typeWeights.normal - extraMinutes * 0.02);
      target.patternWeights.diagonalRain += extraMinutes * 0.01;
      target.patternWeights.mixed += extraMinutes * 0.01;
      target.patternWeights.verticalRain = Math.max(0.06, target.patternWeights.verticalRain - extraMinutes * 0.01);
      target.typeWeights = this.normalizeWeights(target.typeWeights);
      target.patternWeights = this.normalizeWeights(target.patternWeights);
      target.phaseName = "Infinite Storm";
    }

    const stormTarget = this.applyMinuteDiagonalStorm(time, target);
    const reducedTarget = this.applyGlobalDifficultyReduction(stormTarget);
    return this.applyFirstMinuteDifficultyEase(time, reducedTarget);
  }

  applyGlobalDifficultyReduction(target) {
    const reducedTarget = this.cloneSettings(target);
    reducedTarget.phaseName = target.phaseName;
    reducedTarget.forceDiagonalOnly = target.forceDiagonalOnly;
    reducedTarget.spawnInterval = Math.max(this.minSpawnInterval, target.spawnInterval * 1.2);
    reducedTarget.speedMin = Math.max(1, target.speedMin * 0.8);
    reducedTarget.speedMax = Math.max(reducedTarget.speedMin, target.speedMax * 0.8);
    reducedTarget.minActive = Math.max(1, target.minActive * 0.8);
    reducedTarget.maxActive = Math.max(reducedTarget.minActive + 1, target.maxActive * 0.8);
    reducedTarget.maxBatch = Math.max(1, target.maxBatch * 0.8);
    return reducedTarget;
  }

  applyFirstMinuteDifficultyEase(time, target) {
    if (time >= 60) return target;

    const easedTarget = this.cloneSettings(target);
    easedTarget.phaseName = target.phaseName;
    easedTarget.forceDiagonalOnly = target.forceDiagonalOnly;
    easedTarget.spawnInterval = Math.max(this.minSpawnInterval, target.spawnInterval * 1.1);
    easedTarget.speedMin = Math.max(1, target.speedMin * 0.9);
    easedTarget.speedMax = Math.max(easedTarget.speedMin, target.speedMax * 0.9);
    easedTarget.minActive = Math.max(1, target.minActive * 0.9);
    easedTarget.maxActive = Math.max(easedTarget.minActive + 1, target.maxActive * 0.9);
    return easedTarget;
  }

  applyMinuteDiagonalStorm(time, target) {
    const shiftedTime = time - 30;
    if (shiftedTime < 0 || shiftedTime % 60 >= 10) return target;

    const minute = Math.floor(shiftedTime / 60) + 1;
    const stormTarget = this.cloneSettings(target);
    stormTarget.phaseName = `Diagonal Storm ${minute}`;
    stormTarget.forceDiagonalOnly = true;
    stormTarget.spawnInterval = Math.max(this.minSpawnInterval, target.spawnInterval * 0.86);
    stormTarget.speedMin = Math.min(this.maxMeteorSpeed * 0.82, target.speedMin * 1.05);
    stormTarget.speedMax = Math.min(this.maxMeteorSpeed, target.speedMax * 1.08);
    stormTarget.minActive = Math.min(target.minActive + 1, target.maxActive + 2);
    stormTarget.maxActive = target.maxActive + 2;
    stormTarget.maxBatch = Math.max(3, target.maxBatch);
    stormTarget.diagonalChance = 1;
    stormTarget.patternWeights = { verticalRain: 0, group: 0, diagonalRain: 1, wave: 0, mixed: 0 };
    stormTarget.groupCooldown = 99;
    stormTarget.waveCooldown = 99;
    stormTarget.stormCooldown = 0;

    if (minute === 1) {
      stormTarget.phaseName = "Intro Diagonal Storm";
      stormTarget.spawnInterval = Math.max(0.62, target.spawnInterval * 2.3);
      stormTarget.speedMin = Math.min(this.maxMeteorSpeed * 0.7, target.speedMin * 0.72);
      stormTarget.speedMax = Math.min(this.maxMeteorSpeed * 0.72, target.speedMax * 0.76);
      stormTarget.minActive = Math.min(target.minActive, 16);
      stormTarget.maxActive = target.maxActive + 1;
      stormTarget.maxBatch = 2;
      stormTarget.sizeWeights = { small: 0.62, medium: 0.3, large: 0.08 };
      stormTarget.typeWeights = { normal: 0.7, fast: 0.2, large: 0.1, special: 0, explosive: 0 };
    }

    return stormTarget;
  }

  canSpawn(activeCount) {
    return activeCount < Math.round(this.current.maxActive);
  }

  getNextSpawnDelay() {
    if (this.firstDelayPending) {
      this.firstDelayPending = false;
      return 0.29;
    }
    return Math.max(this.minSpawnInterval, this.current.spawnInterval);
  }

  createSpawnBatch(width, activeCount) {
    return this.patternManager.createBatch(this, width, this.getSettings(), activeCount);
  }

  createMeteorSpec(width, placement = {}, index = 0, count = 1) {
    const settings = this.getSettings();
    const type = this.pickWeighted(settings.typeWeights);
    let size = this.pickWeighted(settings.sizeWeights);

    if (type === "large" || type === "explosive") size = "large";
    if (type === "fast" && size === "large") size = "small";

    const radius = this.radiusForSize(size);
    const speed = this.speedForType(type, settings);
    const movement = this.resolveMovement(width, radius, speed, placement, settings);

    return {
      type,
      size,
      radius,
      x: movement.x,
      y: -radius - 24 - (placement.yOffset || index * 18),
      vx: movement.vx,
      vy: speed,
      hasTrail: type === "fast" || type === "explosive" || movement.direction !== "vertical" || Math.random() < 0.38,
    };
  }

  resolveMovement(width, radius, speed, placement, settings) {
    const direction = placement.direction || (Math.random() < settings.diagonalChance
      ? "diagonalRight"
      : "vertical");

    if (direction === "diagonalLeft" || direction === "diagonalRight") {
      const angle = (placement.angle || (20 + Math.random() * 25)) * (Math.PI / 180);
      const side = direction === "diagonalRight" ? "left" : "right";
      const edgeRange = width * (0.14 + Math.random() * 0.22);
      const x = side === "left"
        ? -radius - 16 + (placement.edgeBias || Math.random()) * edgeRange
        : width + radius + 16 - (placement.edgeBias || Math.random()) * edgeRange;
      const vx = Math.tan(angle) * speed * (side === "left" ? 1 : -1);
      return { x, vx, direction };
    }

    return {
      x: this.xForPlacement(width, radius, placement),
      vx: (Math.random() - 0.5) * 42,
      direction,
    };
  }

  xForPlacement(width, radius, placement) {
    const minX = radius + 12;
    const maxX = Math.max(minX, width - radius - 12);

    if (Number.isFinite(placement.lane) && placement.laneCount > 1) {
      const t = placement.lane / (placement.laneCount - 1);
      return minX + (maxX - minX) * t;
    }

    const base = Number.isFinite(placement.xRatio)
      ? minX + (maxX - minX) * placement.xRatio
      : minX + Math.random() * (maxX - minX);
    return Math.max(minX, Math.min(maxX, base + (placement.groupOffset || 0)));
  }

  radiusForSize(size) {
    if (size === "small") return 16 + Math.random() * 8;
    if (size === "large") return 36 + Math.random() * 16;
    return 25 + Math.random() * 9;
  }

  speedForType(type, settings) {
    const base = settings.speedMin + Math.random() * Math.max(1, settings.speedMax - settings.speedMin);
    const multiplier = {
      normal: 1,
      fast: 1.14,
      large: 0.9,
      special: 1.06,
      explosive: 0.98,
    }[type] || 1;
    const adjusted = base * multiplier;
    return Math.min(this.maxMeteorSpeed, settings.speedMax, Math.max(settings.speedMin, adjusted));
  }

  pickWeighted(weights) {
    const normalized = this.normalizeWeights(weights);
    let roll = Math.random();
    let fallback = "normal";
    for (const [key, weight] of Object.entries(normalized)) {
      fallback = key;
      roll -= weight;
      if (roll <= 0) return key;
    }
    return fallback;
  }

  cloneSettings(settings) {
    return {
      spawnInterval: settings.spawnInterval,
      speedMin: settings.speedMin,
      speedMax: settings.speedMax,
      minActive: settings.minActive,
      maxActive: settings.maxActive,
      maxBatch: settings.maxBatch,
      diagonalChance: settings.diagonalChance,
      sizeWeights: { ...settings.sizeWeights },
      typeWeights: { ...settings.typeWeights },
      patternWeights: { ...settings.patternWeights },
      groupCooldown: settings.groupCooldown,
      waveCooldown: settings.waveCooldown,
      stormCooldown: settings.stormCooldown,
    };
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  lerpWeights(a, b, t) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const result = {};
    keys.forEach((key) => {
      result[key] = this.lerp(a[key] || 0, b[key] || 0, t);
    });
    return this.normalizeWeights(result);
  }

  normalizeWeights(weights) {
    const result = { ...weights };
    const total = Object.values(result).reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
    Object.keys(result).forEach((key) => {
      result[key] = Math.max(0, result[key]) / total;
    });
    return result;
  }
}

window.MeteorPatternManager = MeteorPatternManager;
window.DifficultyManager = DifficultyManager;
