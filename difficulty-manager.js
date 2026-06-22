class DifficultyManager {
  constructor() {
    this.maxMeteorSpeed = 700;
    this.minSpawnInterval = 0.35;
    this.phases = [
      {
        name: "Training Zone",
        start: 0,
        settings: {
          spawnInterval: 3,
          speedMin: 120,
          speedMax: 160,
          minActive: 2,
          maxActive: 4,
          sizeWeights: { small: 0.8, medium: 0.2, large: 0 },
          typeWeights: { normal: 1, fast: 0, large: 0, special: 0, explosive: 0 },
          groups: false,
          waves: false,
          diagonal: false,
        },
      },
      {
        name: "Beginner Challenge",
        start: 12,
        settings: {
          spawnInterval: 2,
          speedMin: 160,
          speedMax: 220,
          minActive: 4,
          maxActive: 7,
          sizeWeights: { small: 0.62, medium: 0.3, large: 0.08 },
          typeWeights: { normal: 0.8, fast: 0.15, large: 0.05, special: 0, explosive: 0 },
          groups: false,
          waves: false,
          diagonal: false,
        },
      },
      {
        name: "Medium Survival",
        start: 45,
        settings: {
          spawnInterval: 1.3,
          speedMin: 220,
          speedMax: 320,
          minActive: 7,
          maxActive: 12,
          sizeWeights: { small: 0.5, medium: 0.34, large: 0.16 },
          typeWeights: { normal: 0.6, fast: 0.2, large: 0.15, special: 0.05, explosive: 0 },
          groups: false,
          waves: false,
          diagonal: false,
        },
      },
      {
        name: "Hard Mode",
        start: 120,
        settings: {
          spawnInterval: 0.8,
          speedMin: 320,
          speedMax: 450,
          minActive: 12,
          maxActive: 18,
          sizeWeights: { small: 0.38, medium: 0.38, large: 0.24 },
          typeWeights: { normal: 0.45, fast: 0.25, large: 0.2, special: 0.1, explosive: 0 },
          groups: true,
          waves: false,
          diagonal: true,
        },
      },
      {
        name: "Extreme Survival",
        start: 300,
        settings: {
          spawnInterval: 0.5,
          speedMin: 450,
          speedMax: 600,
          minActive: 18,
          maxActive: 25,
          sizeWeights: { small: 0.32, medium: 0.4, large: 0.28 },
          typeWeights: { normal: 0.3, fast: 0.25, large: 0.2, special: 0.15, explosive: 0.1 },
          groups: true,
          waves: true,
          diagonal: true,
        },
      },
    ];
    this.reset();
  }

  reset() {
    this.survivalTime = 0;
    this.current = this.cloneSettings(this.phases[0].settings);
    this.phaseName = this.phases[0].name;
    this.groupCooldown = 0;
    this.waveCooldown = 0;
    this.patternIndex = 0;
  }

  update(dt, survivalTime) {
    this.survivalTime = survivalTime;
    this.groupCooldown = Math.max(0, this.groupCooldown - dt);
    this.waveCooldown = Math.max(0, this.waveCooldown - dt);

    const target = this.getTargetSettings(survivalTime);
    const blend = Math.min(1, 1 - Math.exp(-dt * 0.82));
    this.current.spawnInterval = this.lerp(this.current.spawnInterval, target.spawnInterval, blend);
    this.current.speedMin = this.lerp(this.current.speedMin, target.speedMin, blend);
    this.current.speedMax = this.lerp(this.current.speedMax, target.speedMax, blend);
    this.current.minActive = this.lerp(this.current.minActive, target.minActive, blend);
    this.current.maxActive = this.lerp(this.current.maxActive, target.maxActive, blend);
    this.current.sizeWeights = this.lerpWeights(this.current.sizeWeights, target.sizeWeights, blend);
    this.current.typeWeights = this.lerpWeights(this.current.typeWeights, target.typeWeights, blend);
    this.current.groups = target.groups;
    this.current.waves = target.waves;
    this.current.diagonal = target.diagonal;
    this.phaseName = target.phaseName;
  }

  getSettings() {
    return {
      phaseName: this.phaseName,
      spawnInterval: Math.max(this.minSpawnInterval, this.current.spawnInterval),
      speedMin: this.current.speedMin,
      speedMax: Math.min(this.maxMeteorSpeed, this.current.speedMax),
      minActive: this.current.minActive,
      maxActive: this.current.maxActive,
      sizeWeights: { ...this.current.sizeWeights },
      typeWeights: { ...this.current.typeWeights },
      groups: this.current.groups,
      waves: this.current.waves,
      diagonal: this.current.diagonal,
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
      target.speedMin = Math.min(this.maxMeteorSpeed * 0.82, target.speedMin * speedScale);
      target.speedMax = Math.min(this.maxMeteorSpeed, target.speedMax * speedScale);
      target.spawnInterval = Math.max(this.minSpawnInterval, target.spawnInterval / speedScale);
      target.typeWeights.special += extraMinutes * 0.02;
      target.typeWeights.normal = Math.max(0.08, target.typeWeights.normal - extraMinutes * 0.02);
      target.typeWeights = this.normalizeWeights(target.typeWeights);
      target.phaseName = "Infinite Storm";
    }

    return target;
  }

  canSpawn(activeCount) {
    return activeCount < Math.round(this.current.maxActive);
  }

  getNextSpawnDelay() {
    return Math.max(this.minSpawnInterval, this.current.spawnInterval);
  }

  createSpawnBatch(width, activeCount) {
    const settings = this.getSettings();
    const availableSlots = Math.max(0, Math.round(settings.maxActive) - activeCount);
    if (availableSlots <= 0) return [];

    let pattern = "single";
    let count = 1;

    if (settings.waves && this.waveCooldown <= 0 && availableSlots >= 4) {
      pattern = "wave";
      count = Math.min(availableSlots, 4 + (this.patternIndex % 3));
      this.waveCooldown = 8.5;
    } else if (settings.groups && this.groupCooldown <= 0 && availableSlots >= 2) {
      pattern = "group";
      count = Math.min(availableSlots, this.survivalTime >= 300 ? 3 : 2);
      this.groupCooldown = this.survivalTime >= 300 ? 3.6 : 4.8;
    }

    this.patternIndex += 1;
    return Array.from({ length: count }, (_, index) => this.createMeteorSpec(width, pattern, index, count));
  }

  createMeteorSpec(width, pattern = "single", index = 0, count = 1) {
    const settings = this.getSettings();
    const type = this.pickWeighted(settings.typeWeights);
    let size = this.pickWeighted(settings.sizeWeights);

    if (type === "large" || type === "explosive") size = "large";
    if (type === "fast" && size === "large") size = "small";

    const radius = this.radiusForSize(size);
    const x = this.xForPattern(width, radius, pattern, index, count);
    const y = -radius - 24 - index * 18;
    const speed = this.speedForType(type, settings);
    const diagonalChance = settings.diagonal ? (type === "fast" ? 0.72 : 0.42) : 0;
    const vx = Math.random() < diagonalChance
      ? (Math.random() < 0.5 ? -1 : 1) * (38 + Math.random() * (type === "fast" ? 118 : 78))
      : (Math.random() - 0.5) * 34;

    return {
      type,
      size,
      radius,
      x,
      y,
      vx,
      vy: speed,
      hasTrail: type === "fast" || type === "explosive" || Math.random() < 0.42,
    };
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
      fast: 1.16,
      large: 0.88,
      special: 1.06,
      explosive: 0.98,
    }[type] || 1;
    return Math.min(this.maxMeteorSpeed, base * multiplier);
  }

  xForPattern(width, radius, pattern, index, count) {
    const minX = radius + 12;
    const maxX = Math.max(minX, width - radius - 12);
    if (pattern === "wave") {
      const spacing = (maxX - minX) / Math.max(1, count - 1);
      const direction = this.patternIndex % 2 === 0 ? 1 : -1;
      const lane = direction === 1 ? index : count - index - 1;
      return minX + lane * spacing;
    }
    if (pattern === "group") {
      const center = minX + Math.random() * (maxX - minX);
      const offset = (index - (count - 1) / 2) * (radius * 2.25 + 28);
      return Math.max(minX, Math.min(maxX, center + offset));
    }
    return minX + Math.random() * (maxX - minX);
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
      sizeWeights: { ...settings.sizeWeights },
      typeWeights: { ...settings.typeWeights },
      groups: settings.groups,
      waves: settings.waves,
      diagonal: settings.diagonal,
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

window.DifficultyManager = DifficultyManager;
