import audio from './audio.js';
import { applyChromaKey } from './chromakey.js';
import * as procedural from './procedural.js';

// Setup screen constants
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const GAME_SPEED = 4; // Scroll speed

// Stage time in seconds for each stage
const STAGE_TIME = 120; // normal play duration

// Asset loading helper
class AssetLoader {
  constructor() {
    this.images = {};
    this.loadedCount = 0;
    this.totalCount = 0;
    this.fallbackMode = false;
  }

  load(name, path, useChromaKey = false) {
    this.totalCount++;
    const img = new Image();
    img.src = path;
    img.onload = () => {
      if (useChromaKey) {
        applyChromaKey(img, (processedImg) => {
          this.images[name] = processedImg;
          this.loadedCount++;
        });
      } else {
        this.images[name] = img;
        this.loadedCount++;
      }
    };
    img.onerror = () => {
      console.warn(`Failed to load asset: ${path}. Enabling fallback mode.`);
      this.fallbackMode = true;
      this.loadedCount++;
    };
  }

  isReady() {
    return this.fallbackMode || (this.loadedCount >= this.totalCount && this.totalCount > 0);
  }
}

const assets = new AssetLoader();
assets.load('playerShip', '/player_ship.png', true);
assets.load('enemyShip', '/enemy_ship.png', true);
assets.load('bossShip', '/boss_ship.png', true);
assets.load('bgSpace', '/bg_space.png');
assets.load('bgFortress', '/bg_fortress.png');
assets.load('bgNebula', '/bg_nebula.png');

// Game Engine / State
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Game state flags
    this.state = 'TITLE'; // TITLE, PLAYING, GAMEOVER, CLEAR
    this.stage = 1;       // 1, 2, 3
    this.stageTimer = 0;  // in seconds
    this.distance = 0;    // scroll distance tracker
    
    // Core game entities
    this.player = null;
    this.bullets = [];
    this.lasers = [];
    this.missiles = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.capsules = [];
    this.particles = [];
    this.gimmicks = [];
    this.boss = null;
    
    // Rank System (Realtime difficulty adjustment)
    this.rank = 0.1; // 0.0 to 1.0
    
    // Death tracking for Warnings
    this.deathHistory = []; // { x, y, stage, reason, textX }
    this.loadDeathHistory();
    
    // Input state
    this.keys = {};
    this.mouse = { x: 0, y: 0, isDown: false, active: false };
    
    // Touch controls state
    this.touch = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      joystickActive: false
    };

    // Cache CSS variables to prevent Layout Thrashing in render loop
    this.colors = {
      neonBlue: '#00f3ff' // Fallback, will attempt to read custom property below
    };

    // Allocate reusable offscreen canvas for boss hit flash frames to prevent garbage collection churn
    this.bossFlashCanvas = document.createElement('canvas');
    this.bossFlashCtx = this.bossFlashCanvas.getContext('2d');

    // Auto-fire interval
    this.fireTimer = 0;
    this.frameCount = 0;
    this.score = 0;
    this.lives = 3;
    
    // Power-up Grid options (Gradius style)
    // Speed, Missile, Double, Spread, Laser, Option, Shield
    this.powerUpIndex = -1; // -1 means none selected
    this.powerUpNames = ['SPEED', 'MISSILE', 'DOUBLE', 'SPREAD', 'LASER', 'OPTION', 'SHIELD'];

    // Human-friendly descriptions for HUD when a power-up is selected/activated (日本語表示)
    this.powerDescriptions = {
      SPEED: '移動速度と操作性が向上します。',
      MISSILE: '高威力の地上ミサイルを使用可能にします。',
      DOUBLE: '斜め弾を追加し、射撃範囲が拡大します。',
      SPREAD: '3方向の散弾で複数の敵に当てやすくなります。',
      LASER: '貫通レーザーで敵を継続的に貫きます。',
      OPTION: '自機を模倣するドローンを追加します（最大4体）。',
      SHIELD: '多段ヒットを吸収するシールドを付与します。'
    };

    // 表示用の日本語名称（内部識別子は英字のまま）
    this.powerDisplayNames = {
      SPEED: 'スピード',
      MISSILE: 'ミサイル',
      DOUBLE: 'ダブル',
      SPREAD: 'スプレッド',
      LASER: 'レーザー',
      OPTION: 'オプション',
      SHIELD: 'シールド'
    };
    
    this.setupEventListeners();
    this.initMenus();
    this.loop();
  }

  loadDeathHistory() {
    try {
      const data = localStorage.getItem('aegis_death_history');
      if (data) {
        this.deathHistory = JSON.parse(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  saveDeathHistory(reason) {
    if (!this.player) return;
    
    // Record relative x to the stage scroll start
    const record = {
      x: this.distance + this.player.x,
      y: this.player.y,
      stage: this.stage,
      reason: reason
    };
    
    this.deathHistory.push(record);
    try {
      localStorage.setItem('aegis_death_history', JSON.stringify(this.deathHistory));
    } catch (e) {
      console.error(e);
    }
  }

  initMenus() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.startGame();
    });
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.continueGame();
    });
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.showTitle();
    });
    
    // Virtual control buttons
    const btnFire = document.getElementById('btn-fire');
    const btnPower = document.getElementById('btn-power');
    
    // Fire button
    btnFire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.keys['Space'] = true;
    });
    btnFire.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.keys['Space'] = false;
    });
    
    // Power button
    btnPower.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.activatePowerUp();
    });
  }

  setupEventListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys[code] = true;
      
      // Prevent default browser scrolling
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }

      // Activate Power Up
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Enter' || code === 'KeyZ') {
        this.activatePowerUp();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse Controls
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      // Translate to Canvas logical resolution (1280x720)
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
      this.mouse.active = true;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state === 'PLAYING') {
        this.mouse.isDown = true;
        this.keys['Space'] = true;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
      this.keys['Space'] = false;
    });

    // Touch events for drag-movement
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING') return;
      this.touch.active = true;
      this.mouse.active = false;
      
      // Determine if touch is on left side (virtual joystick)
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const touchX = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
      
      if (touchX < CANVAS_WIDTH / 2) {
        this.touch.joystickActive = true;
        this.touch.startX = clientX;
        this.touch.startY = clientY;
        this.touch.currentX = clientX;
        this.touch.currentY = clientY;
        document.getElementById('virtual-joystick-area').style.left = `${clientX - 75}px`;
        document.getElementById('virtual-joystick-area').style.bottom = `${window.innerHeight - clientY - 75}px`;
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.touch.active) return;
      const touch = e.touches[0];
      
      if (this.touch.joystickActive) {
        this.touch.currentX = touch.clientX;
        this.touch.currentY = touch.clientY;
        
        // Calculate offsets
        const dx = this.touch.currentX - this.touch.startX;
        const dy = this.touch.currentY - this.touch.startY;
        const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 50); // clamp to max 50px stick movement
        const angle = Math.atan2(dy, dx);
        
        // Render stick movement visual
        const stick = document.getElementById('virtual-joystick-stick');
        stick.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
        
        // Apply inputs to simulated keys
        const threshold = 15;
        this.keys['KeyW'] = dy < -threshold;
        this.keys['KeyS'] = dy > threshold;
        this.keys['KeyA'] = dx < -threshold;
        this.keys['KeyD'] = dx > threshold;
      }
    });

    this.canvas.addEventListener('touchend', (e) => {
      this.touch.active = false;
      this.touch.joystickActive = false;
      this.keys['KeyW'] = false;
      this.keys['KeyS'] = false;
      this.keys['KeyA'] = false;
      this.keys['KeyD'] = false;
      
      const stick = document.getElementById('virtual-joystick-stick');
      stick.style.transform = 'translate(0px, 0px)';
    });
  }

  showTitle() {
    this.state = 'TITLE';
    document.getElementById('title-screen').classList.add('active');
    document.getElementById('gameover-screen').classList.remove('active');
    document.getElementById('clear-screen').classList.remove('active');
    audio.stopBGM();
  }

  startGame() {
    document.getElementById('title-screen').classList.remove('active');
    this.state = 'PLAYING';
    // Resolve and cache CSS variable colors once to prevent Layout Thrashing in rendering loops
    this.colors.neonBlue = varColor('--neon-blue') || '#00f3ff';
    this.stage = 1;
    this.score = 0;
    this.lives = 3;
    this.distance = 0;
    this.rank = 0.1;
    this.resetEntities();
    this.initPlayer();
    this.startStage(1);
    
    // Check if mobile device and show virtual controls
    if ('ontouchstart' in window) {
      document.getElementById('virtual-controls').style.display = 'block';
    }
  }

  continueGame() {
    document.getElementById('gameover-screen').classList.remove('active');
    this.state = 'PLAYING';
    this.lives = 3;
    this.rank = 0.0; // Reset rank on continue for relief
    this.resetEntities();
    this.initPlayer();
    this.startStage(this.stage);
  }

  startStage(stageNum) {
    this.stage = stageNum;
    this.stageTimer = 0;
    this.boss = null;
    
    // Clear hazards, bullets and enemies
    this.enemies = [];
    this.enemyBullets = [];
    this.bullets = [];
    this.lasers = [];
    this.missiles = [];
    this.gimmicks = [];
    this.capsules = [];
    
    // Display Stage Title UI Overlay
    const overlay = document.getElementById('stage-intro');
    const titleText = document.getElementById('stage-title-text');
    const subText = document.getElementById('stage-sub-text');
    
    titleText.textContent = `STAGE ${stageNum}`;
    if (stageNum === 1) subText.textContent = "THE VOID FRONTIER";
    else if (stageNum === 2) subText.textContent = "IRON CLAD FORTRESS";
    else subText.textContent = "IONIZED NEBULA STRAW";
    
    overlay.style.opacity = '1';
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, 3000);
    
    // Play synthesis BGM
    audio.startBGM(`stage${stageNum}`);
  }

  initPlayer() {
    this.player = {
      x: 100,
      y: CANVAS_HEIGHT / 2,
      w: 64,
      h: 40,
      speedLevel: 1,
      missileLevel: 0,
      doubleLevel: 0,
      spreadLevel: 0,
      laserLevel: 0,
      optionCount: 0,
      shieldHp: 0,
      isInvincible: 120, // 2s starting shield invincibility
      trail: [], // position history for bank afterimages
      optionTrail: [], // delayed coords for option alignment
      bank: 0,
      idleHover: 0, // Micro-hover oscillation counter
      deathTimer: 0,
      attackSpeed: 1.0 // multiplicative attack speed (1.0 = normal)
    };
    this.powerUpIndex = -1;
  }

  resetEntities() {
    this.bullets = [];
    this.lasers = [];
    this.missiles = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.capsules = [];
    this.particles = [];
    this.gimmicks = [];
    this.boss = null;
  }

  activatePowerUp() {
    if (!this.player || this.powerUpIndex === -1) return;
    
    const powerUp = this.powerUpNames[this.powerUpIndex];
    let activated = false;
    
    switch (powerUp) {
      case 'SPEED':
        if (this.player.speedLevel < 4) {
          this.player.speedLevel++;
          activated = true;
        }
        break;
      case 'MISSILE':
        this.player.missileLevel = (this.player.missileLevel || 0) + 1; // additive
        activated = true;
        break;
      case 'DOUBLE':
        this.player.doubleLevel = (this.player.doubleLevel || 0) + 1; // additive stacking
        activated = true;
        break;
      case 'SPREAD':
        this.player.spreadLevel = (this.player.spreadLevel || 0) + 1; // additive stacking
        activated = true;
        break;
      case 'LASER':
        this.player.laserLevel = (this.player.laserLevel || 0) + 1; // additive stacking
        activated = true;
        break;
      case 'OPTION':
        if (this.player.optionCount < 4) {
          this.player.optionCount++;
          activated = true;
        }
        break;
      case 'SHIELD':
        if (this.player.shieldHp < 3) {
          this.player.shieldHp = 3;
          activated = true;
        }
        break;
    }
    
    if (activated) {
      audio.playSFX('powerup_activate');
      // Visual feedback: floating text indicating activation
      this.spawnFloatingText(`${this.powerDisplayNames[powerUp] || powerUp} を発動しました`, this.player.x + this.player.w/2, this.player.y - 24, '#00ffcc');

      // Extra immediate effects for clarity and stronger feel
      if (powerUp === 'OPTION') {
        // ensure option positions exist immediately so player sees drones
        const fillCount = 60; // provide trailing points
        const last = this.player.optionTrail[0] || { x: this.player.x, y: this.player.y };
        for (let k = 0; k < fillCount; k++) {
          this.player.optionTrail.unshift({ x: last.x, y: last.y });
        }
        // Clamp length
        if (this.player.optionTrail.length > 300) this.player.optionTrail.length = 300;
      }

      if (powerUp === 'SHIELD') {
        // add shield HP (additive)
        this.player.shieldHp = Math.min((this.player.shieldHp || 0) + 3, 10);
      }

      this.powerUpIndex = -1; // reset selection
      this.updateRank();
    }
  }

  collectCapsule(isFake) {
    if (isFake) {
      // Fake Capsule penalty: wipe powerups + trigger warning/damage
      audio.playSFX('player_death');
      this.player.speedLevel = 1;
      this.player.missileLevel = 0;
      this.player.doubleLevel = 0;
      this.player.spreadLevel = 0;
      this.player.laserLevel = 0;
      this.player.optionCount = 0;
      this.player.shieldHp = 0;
      this.player.attackSpeed = 1.0; // reset attack speed on fake
      this.powerUpIndex = -1;
      
      this.spawnExplosion(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#00ccff');
      
      // Spawn floating visual warning text
      this.spawnFloatingText("DESTRUCTIVE ERROR!", this.player.x, this.player.y - 20, '#00ccff');
    } else {
      audio.playSFX('powerup_pickup');
      this.powerUpIndex = (this.powerUpIndex + 1) % this.powerUpNames.length;
      // Immediate feedback of which power-up is selected
      const sel = this.powerUpNames[this.powerUpIndex];
      this.spawnFloatingText(`選択: ${this.powerDisplayNames[sel] || sel}`, this.player.x + this.player.w/2, this.player.y - 14, '#ffffff');

      // Apply attack speed multiplicatively for any non-fake (青)カプセル拾得
      const prev = this.player.attackSpeed || 1.0;
      const next = prev * 1.1; // 10% multiplicative stacking
      this.player.attackSpeed = next;
      this.spawnFloatingText(`攻撃速度 x${next.toFixed(2)}`, this.player.x + this.player.w/2, this.player.y - 34, '#00ccff');
      audio.playSFX('powerup_activate');
    }
    this.updateRank();
  }

  updateRank() {
    if (!this.player) return;
    
    // Rank logic: speed, option count, shields, lasers/doubles and lives increase rank
    let rankScore = 0.1;
    rankScore += (this.player.speedLevel - 1) * 0.1;
    rankScore += this.player.optionCount * 0.15;
    rankScore += this.player.shieldHp * 0.1;
    // Add rank contributions from additive power-up levels
    rankScore += (this.player.laserLevel || 0) * 0.2;
    rankScore += (this.player.doubleLevel || 0) * 0.15;
    rankScore += (this.player.spreadLevel || 0) * 0.18;
    rankScore += (this.player.missileLevel || 0) * 0.1;
    rankScore += (this.lives - 1) * 0.05;
    
    this.rank = Math.min(Math.max(rankScore, 0.0), 1.0);
  }

  die(reason) {
    if (this.player.isInvincible > 0) return;
    
    audio.playSFX('player_death');
    this.spawnExplosion(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#33ccff', true);
    
    this.saveDeathHistory(reason);
    
    this.lives--;
    if (this.lives < 0) {
      this.triggerGameOver();
    } else {
      // Respawn protocol
      this.initPlayer();
      this.player.isInvincible = 180; // 3s respawn invincibility
      this.powerUpIndex = -1;
      this.updateRank();
    }
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    audio.stopBGM();
    document.getElementById('gameover-stats').innerHTML = `
      STAGE REACHED: ${this.stage}<br>
      FINAL SCORE: ${this.score.toLocaleString()}<br>
      RECORDED ACCIDENTS: ${this.deathHistory.filter(h => h.stage === this.stage).length} IN STAGE ${this.stage}
    `;
    document.getElementById('gameover-screen').classList.add('active');
  }

  triggerGameClear() {
    this.state = 'CLEAR';
    audio.stopBGM();
    document.getElementById('clear-stats').innerHTML = `
      ALL COSMIC SECTORS DEFENDED<br>
      FINAL SCORE: ${this.score.toLocaleString()}<br>
      TOTAL ACCIDENTS IN LOGS: ${this.deathHistory.length}
    `;
    document.getElementById('clear-screen').classList.add('active');
  }

  // --- Spawning Logic ---
  spawnEnemy() {
    // Enemy spawning proportional to Rank difficulty adjustment
    const spawnRate = 0.015 + this.rank * 0.02;
    if (Math.random() < spawnRate && !this.boss) {
      // Pick random type
      const roll = Math.random();
      let type = 0; // standard
      if (roll > 0.8) type = 2;      // heavy bomber
      else if (roll > 0.55) type = 1; // fast interceptor
      
      const eh = type === 2 ? 80 : 36;
      const ew = type === 2 ? 90 : 48;
      
      // Calculate HP based on type
      let hp = 1;
      if (type === 1) hp = 1;
      if (type === 2) hp = 6;
      
      this.enemies.push({
        x: CANVAS_WIDTH + ew,
        y: Math.random() * (CANVAS_HEIGHT - eh - 150) + 50,
        w: ew,
        h: eh,
        type: type,
        hp: hp,
        maxHp: hp,
        shootTimer: Math.random() * 60,
        velX: type === 1 ? -6 - this.rank * 4 : -3 - this.rank * 2,
        velY: type === 1 ? Math.sin(this.frameCount * 0.1) * 2 : 0
      });
    }

    // Spawn Stage Specific Hazard/Gimmicks
    this.spawnStageGimmicks();
  }

  spawnStageGimmicks() {
    if (this.boss) return; // No minor hazards during Boss battles

    // STAGE 1: Giant falling space debris / rocks
    if (this.stage === 1 && Math.random() < 0.006) {
      const rockW = 80 + Math.random() * 80;
      this.gimmicks.push({
        type: 'FALLING_ROCK',
        x: Math.random() * (CANVAS_WIDTH - 200) + 200 + this.player.x, // spawn ahead
        y: -100,
        w: rockW,
        h: rockW,
        hp: Math.ceil(rockW / 20), // destructible
        maxHp: Math.ceil(rockW / 20),
        velX: -2,
        velY: 3 + Math.random() * 4,
        spawnDist: this.distance
      });
    }

    // STAGE 2: Press Compressors (horizontal terrains with moving crushing pillars)
    // Spawn press walls periodically along the distance track
    if (this.stage === 2 && this.frameCount % 240 === 0 && this.stageTimer < STAGE_TIME - 15) {
      // Top press pillar
      this.gimmicks.push({
        type: 'PRESS_WALL_TOP',
        x: CANVAS_WIDTH + 100,
        y: -300, // moves down
        w: 120,
        h: 400,
        hp: Infinity, // Indestructible
        state: 'IDLE', // IDLE, CRUSHING, RETRACTING
        timer: 60,
        startY: -300,
        targetY: -50,
        spawnDist: this.distance
      });
      // Bottom press pillar
      this.gimmicks.push({
        type: 'PRESS_WALL_BOTTOM',
        x: CANVAS_WIDTH + 100,
        y: CANVAS_HEIGHT - 100, // moves up
        w: 120,
        h: 400,
        hp: Infinity,
        state: 'IDLE',
        timer: 60,
        startY: CANVAS_HEIGHT - 100,
        targetY: CANVAS_HEIGHT - 350,
        spawnDist: this.distance
      });
    }

    // STAGE 3: Back-side Assaulters (ambush jet squads) & Fake Capsules
    if (this.stage === 3) {
      // Rear ambush jets (screaming in from the left side of screen)
      if (Math.random() < 0.005) {
        this.gimmicks.push({
          type: 'REAR_ASSAULT',
          x: -80,
          y: Math.random() * (CANVAS_HEIGHT - 250) + 100,
          w: 48,
          h: 36,
          hp: 1,
          velX: 9 + this.rank * 5, // Extremely fast
          velY: 0,
          spawnDist: this.distance,
          warningTriggered: false
        });
      }

      // Deceptive Fake Capsules (rarely spawned in place of normal capsules)
      if (Math.random() < 0.003) {
        this.capsules.push({
          x: CANVAS_WIDTH + 30,
          y: Math.random() * (CANVAS_HEIGHT - 200) + 100,
          w: 32,
          h: 32,
          isFake: true,
          velX: -2.5
        });
      }
    }
  }

  spawnExplosion(x, y, color = '#00ccff', isLarge = false) {
    const numParticles = isLarge ? 50 : 15;
    
    // 1. Shrapnel / Fire particles
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (isLarge ? 2 : 1) + Math.random() * (isLarge ? 8 : 4);
      this.particles.push({
        type: 'SHRAPNEL',
        x: x,
        y: y,
        velX: Math.cos(angle) * speed,
        velY: Math.sin(angle) * speed,
        w: 2 + Math.random() * 4,
        h: 2 + Math.random() * 4,
        color: color,
        life: 30 + Math.random() * 30
      });
    }
    
    // 2. Smoke rings / shockwave
    this.particles.push({
      type: 'SHOCKWAVE',
      x: x,
      y: y,
      radius: 5,
      maxRadius: isLarge ? 120 : 45,
      color: color === '#00ccff' ? 'rgba(0, 204, 255, 0.4)' : 'rgba(255, 60, 0, 0.4)',
      life: 25
    });

    // 3. Smoke clouds
    for (let i = 0; i < (isLarge ? 10 : 3); i++) {
      this.particles.push({
        type: 'SMOKE',
        x: x + (Math.random() * 20 - 10),
        y: y + (Math.random() * 20 - 10),
        radius: (isLarge ? 15 : 6) + Math.random() * (isLarge ? 20 : 8),
        velX: -1 + Math.random() * 2,
        velY: -1 + Math.random() * 2,
        life: 40 + Math.random() * 20
      });
    }
  }

  spawnMuzzleFlash(x, y) {
    this.particles.push({
      type: 'MUZZLE',
      x: x,
      y: y,
      life: 5
    });
  }

  spawnFloatingText(text, x, y, color = '#ffffff') {
    this.particles.push({
      type: 'TEXT',
      text: text,
      x: x,
      y: y,
      velY: -1,
      color: color,
      life: 60
    });
  }

  // --- Logic Update loop ---
  update() {
    this.frameCount++;
    this.distance += GAME_SPEED;
    
    if (this.state === 'PLAYING') {
      this.stageTimer += 1 / 60;
      
      // Transition to Boss phase once timer reaches STAGE_TIME
      if (this.stageTimer >= STAGE_TIME && !this.boss) {
        this.spawnBoss();
      }
      
      this.updatePlayer();
      this.updateBullets();
      this.updateEnemies();
      this.updateCapsules();
      this.updateGimmicks();
      this.updateParticles();
      this.checkCollisions();
      this.spawnEnemy();
    }
  }

  spawnBoss() {
    this.boss = {
      stage: this.stage,
      x: CANVAS_WIDTH + 200,
      y: CANVAS_HEIGHT / 2 - 150,
      w: 320,
      h: 300,
      hp: this.stage === 1 ? 150 : (this.stage === 2 ? 250 : 400),
      maxHp: this.stage === 1 ? 150 : (this.stage === 2 ? 250 : 400),
      shootTimer: 0,
      state: 'INTRO', // INTRO, FIGHTING, DYING
      introTimer: 180,
      hitFlash: 0,
      // Target position
      targetX: CANVAS_WIDTH - 380,
      targetY: CANVAS_HEIGHT / 2 - 150,
      // Weakness coordinates (relative to boss x, y)
      // Standard layout: core situated at center front
      weakCore: {
        relX: 80,
        relY: 150,
        radius: 40
      }
    };
    
    // Play transition boss warning text
    this.spawnFloatingText("警告！大規模な脅威を検出しました！", CANVAS_WIDTH / 2 - 200, CANVAS_HEIGHT / 2, '#00ccff');
    audio.startBGM('boss');
  }

  updatePlayer() {
    if (!this.player) return;
    
    // Recovery timers
    if (this.player.isInvincible > 0) this.player.isInvincible--;
    
    // Banks (Tilt animation)
    let currentBank = 0;
    
    // 1. Move Physics
    let dx = 0;
    let dy = 0;
    const speed = (4 + this.player.speedLevel * 2.0); // stronger, more responsive speed scaling
    
    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      dy = -1;
      currentBank = -1; // bank up
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      dy = 1;
      currentBank = 1; // bank down
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx = 1;
    
    // Apply speed vector
    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }
    
    // Mouse relative tracking
    if (this.mouse.active) {
      const targetX = this.mouse.x - this.player.w / 2;
      const targetY = this.mouse.y - this.player.h / 2;
      
      const mdx = targetX - this.player.x;
      const mdy = targetY - this.player.y;
      const dist = Math.sqrt(mdx*mdx + mdy*mdy);
      
      if (dist > 5) {
        this.player.x += (mdx / dist) * speed;
        this.player.y += (mdy / dist) * speed;
        currentBank = mdy < -5 ? -1 : (mdy > 5 ? 1 : 0);
      }
    } else {
      // Apply keyboard movement
      this.player.x += dx * speed;
      this.player.y += dy * speed;
    }
    
    // Screen bounds locking
    this.player.x = Math.max(20, Math.min(CANVAS_WIDTH - this.player.w - 20, this.player.x));
    this.player.y = Math.max(50, Math.min(CANVAS_HEIGHT - this.player.h - 80, this.player.y));
    
    // Idle micro-hover oscillation (subtle up-down float when stationary)
    this.player.idleHover += 0.04;
    if (dx === 0 && dy === 0 && !this.mouse.active) {
      this.player.y += Math.sin(this.player.idleHover) * 0.6;
    }
    
    // Bank smoothing
    this.player.bank += (currentBank - this.player.bank) * 0.15;
    
    // Record Trail points for Banks & Options
    this.player.trail.unshift({ x: this.player.x, y: this.player.y, bank: this.player.bank });
    if (this.player.trail.length > 30) this.player.trail.pop();
    
    // Options delayed path coordinates tracking (Options follow behind player)
    this.player.optionTrail.unshift({ x: this.player.x, y: this.player.y });
    if (this.player.optionTrail.length > 100) this.player.optionTrail.pop();
    
    // 2. Weapon Systems Auto-firing
    this.fireTimer++;
    if (this.keys['Space'] || this.mouse.isDown) {
      const baseCooldown = (this.player.laserLevel && this.player.laserLevel > 0) ? 4 : 10;
      const cooldown = baseCooldown / (this.player.attackSpeed || 1.0);
      if (this.fireTimer >= cooldown) {
        this.fireWeapon();
        this.fireTimer = 0;
      }
    }
  }

  fireWeapon() {
    if (!this.player) return;
    
    const gunX = this.player.x + this.player.w - 5;
    const gunY = this.player.y + this.player.h / 2;
    
    // Dynamic Muzzle flash
    this.spawnMuzzleFlash(gunX, gunY);
    
    // Always fire base bullet
    audio.playSFX('shoot');
    this.bullets.push({
      x: gunX,
      y: gunY - 3,
      w: 22,
      h: 6,
      velX: 18,
      velY: 0,
      isEnemy: false
    });

    // Double level: add additional diagonal bullets per level
    const dLevel = this.player.doubleLevel || 0;
    for (let d = 0; d < dLevel; d++) {
      const spreadOffset = 4 + d * 3;
      this.bullets.push({
        x: gunX,
        y: gunY - (5 + d * 2),
        w: 20,
        h: 6,
        velX: 16 - d * 1.0,
        velY: - (8 + d * 2),
        isEnemy: false
      });
    }

    // Spread level: create pairs of angled shots; each level increases spread count
    const sLevel = this.player.spreadLevel || 0;
    for (let s = 0; s < sLevel; s++) {
      const vy = 6 + s * 2;
      this.bullets.push({ x: gunX, y: gunY - (6 + s*2), w: 18, h:5, velX: 15 - s*0.5, velY: -vy, isEnemy:false });
      this.bullets.push({ x: gunX, y: gunY + (6 + s*2), w: 18, h:5, velX: 15 - s*0.5, velY: vy, isEnemy:false });
    }

    // Laser level: if present, fire laser(s) in addition to bullets
    const lLevel = this.player.laserLevel || 0;
    if (lLevel > 0) {
      audio.playSFX('laser');
      // single laser with damage scaling by level
      this.lasers.push({ x: gunX, y: gunY - 4, w: CANVAS_WIDTH - gunX, h: 12, damage: 1.0 + 0.6 * lLevel, life: 5 });
      // Options also fire lasers
      this.fireOptionWeapons('laser');
    } else {
      this.fireOptionWeapons('bullet');
    }

    // Missile level: spawn missiles equal to level every interval
    const mLevel = this.player.missileLevel || 0;
    if (mLevel > 0 && this.frameCount % 25 === 0) {
      audio.playSFX('missile');
      for (let mi = 0; mi < mLevel; mi++) {
        this.missiles.push({ x: this.player.x + this.player.w / 2 + mi*6, y: this.player.y + this.player.h, w:18, h:10, velX:4, velY:5, state:'FALLING' });
      }
    }
  }

  fireOptionWeapons(type) {
    if (this.player.optionCount <= 0) return;
    
    for (let i = 0; i < this.player.optionCount; i++) {
      const idx = (i + 1) * 15; // 15 frames delay per option
      const coord = this.player.optionTrail[idx] || this.player.optionTrail[this.player.optionTrail.length - 1];
      if (!coord) continue;
      
      const optX = coord.x + this.player.w / 2;
      const optY = coord.y + this.player.h / 2;
      
      this.spawnMuzzleFlash(optX + 15, optY);
      
      if (type === 'laser') {
        const lLevel = this.player.laserLevel || 0;
        this.lasers.push({ x: optX + 15, y: optY - 3, w: CANVAS_WIDTH - (optX + 15), h: 8, damage: 0.6 * lLevel, life: 5 });
      } else {
        this.bullets.push({ x: optX + 15, y: optY - 3, w: 18, h: 6, velX: 18, velY: 0, isEnemy: false });
        
        const dLevel = this.player.doubleLevel || 0;
        for (let d = 0; d < dLevel; d++) {
          this.bullets.push({ x: optX + 15, y: optY - (5 + d*2), w: 16, h: 6, velX: 16 - d*1.0, velY: -(8 + d*2), isEnemy: false });
        }
      }
    }
  }

  updateBullets() {
    // 1. Regular Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.velX;
      b.y += b.velY;
      
      // Spawn bullet trail particles (every 3rd frame to limit particle count)
      if (!b.isEnemy && this.frameCount % 3 === 0) {
        this.particles.push({
          type: 'BULLET_TRAIL',
          x: b.x - b.velX * 0.3,
          y: b.y + b.h / 2,
          radius: 3 + Math.random() * 2,
          color: '#00f3ff',
          life: 8
        });
      }
      
      // bounds check
      if (b.x < -50 || b.x > CANVAS_WIDTH + 50 || b.y < -50 || b.y > CANVAS_HEIGHT + 50) {
        this.bullets.splice(i, 1);
      }
    }
    
    // 2. Lasers (life check)
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.life--;
      if (l.life <= 0) {
        this.lasers.splice(i, 1);
      }
    }

    // 3. Ground Missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      if (m.state === 'FALLING') {
        m.x += m.velX;
        m.y += m.velY;
        
        // Ground impact checks
        if (m.y >= CANVAS_HEIGHT - 80) {
          m.y = CANVAS_HEIGHT - 80;
          m.state = 'SLIDING';
          m.velX = 8;
          m.velY = 0;
        }
      } else {
        m.x += m.velX; // slide forward fast
      }

      // Spawning trail smoke
      if (this.frameCount % 3 === 0) {
        this.particles.push({
          type: 'SMOKE',
          x: m.x,
          y: m.y + m.h / 2,
          radius: 3 + Math.random() * 3,
          velX: -2,
          velY: Math.random() * 0.6 - 0.3,
          life: 20
        });
      }

      if (m.x > CANVAS_WIDTH + 50) {
        this.missiles.splice(i, 1);
      }
    }

    // 4. Enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.velX;
      eb.y += eb.velY;
      
      if (eb.x < -50 || eb.x > CANVAS_WIDTH + 50 || eb.y < -50 || eb.y > CANVAS_HEIGHT + 50) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  updateEnemies() {
    // 1. Regular Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.x += e.velX;
      e.y += e.velY;
      
      // Fire AI
      e.shootTimer--;
      if (e.shootTimer <= 0 && e.x < CANVAS_WIDTH - 100) {
        this.enemyShoot(e);
        e.shootTimer = 70 + Math.random() * 90 - this.rank * 40;
      }
      
      if (e.x < -e.w - 50) {
        this.enemies.splice(i, 1);
      }
    }

    // 2. Boss updates
    if (this.boss) {
      const b = this.boss;
      
      if (b.state === 'FIGHTING' && b.hp <= 0) {
        this.bossKilled(b);
      }
      
      if (b.state === 'INTRO') {
        b.introTimer--;
        b.x += (b.targetX - b.x) * 0.03; // Smooth entrance drift
        b.y += (b.targetY - b.y) * 0.03;
        
        if (b.introTimer <= 0) {
          b.state = 'FIGHTING';
        }
      } else if (b.state === 'FIGHTING') {
        // Vertical hover animation
        b.y = b.targetY + Math.sin(this.frameCount * 0.03) * 80;
        
        // Attack routine
        b.shootTimer--;
        if (b.shootTimer <= 0) {
          this.bossShoot(b);
          b.shootTimer = 80 - this.rank * 40; // faster at higher ranks
        }
      } else if (b.state === 'DYING') {
        // Explode continuously
        if (this.frameCount % 10 === 0) {
          this.spawnExplosion(
            b.x + Math.random() * b.w,
            b.y + Math.random() * b.h,
            '#ff3300',
            false
          );
        }
        
        b.x -= 1; // drift away
        
        if (b.introTimer <= 0) {
          this.boss = null;
          // Trigger stage cleared state
          if (this.stage < 3) {
            this.startStage(this.stage + 1);
          } else {
            this.triggerGameClear();
          }
        } else {
          b.introTimer--; // recycle timer for dying duration
        }
      }
      
      if (b.hitFlash > 0) b.hitFlash--;
    }
  }

  enemyShoot(e) {
    if (!this.player) return;
    
    // Shoot direction aimed at player
    const angle = Math.atan2(
      (this.player.y + this.player.h/2) - (e.y + e.h/2),
      (this.player.x + this.player.w/2) - (e.x + e.w/2)
    );
    const speed = 4 + this.rank * 4;
    
    this.enemyBullets.push({
      x: e.x,
      y: e.y + e.h / 2,
      w: 12,
      h: 12,
      velX: Math.cos(angle) * speed,
      velY: Math.sin(angle) * speed
    });
  }

  bossShoot(b) {
    if (!this.player) return;
    
    const coreX = b.x + b.weakCore.relX;
    const coreY = b.y + b.weakCore.relY + Math.sin(this.frameCount * 0.03) * 80;
    
    // Stage 1 boss: 3-way spread shots
    if (b.stage === 1) {
      const angles = [-0.2, 0, 0.2];
      angles.forEach(offsetAngle => {
        const baseAngle = Math.atan2(
          (this.player.y + this.player.h/2) - coreY,
          (this.player.x + this.player.w/2) - coreX
        );
        const bulletSpeed = 5 + this.rank * 4;
        this.enemyBullets.push({
          x: coreX,
          y: coreY,
          w: 16,
          h: 16,
          velX: Math.cos(baseAngle + offsetAngle) * bulletSpeed,
          velY: Math.sin(baseAngle + offsetAngle) * bulletSpeed
        });
      });
    } 
    // Stage 2 boss: Spiral spray + tracking lasers
    else if (b.stage === 2) {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (this.frameCount * 0.05);
        this.enemyBullets.push({
          x: coreX,
          y: coreY,
          w: 14,
          h: 14,
          velX: Math.cos(angle) * 4,
          velY: Math.sin(angle) * 4
        });
      }
    } 
    // Stage 3 Final Boss: Dense targeted sprays + extreme tracking
    else {
      // 5-way ring shots towards player
      const spread = 5;
      const baseAngle = Math.atan2(
        (this.player.y + this.player.h/2) - coreY,
        (this.player.x + this.player.w/2) - coreX
      );
      for (let i = 0; i < spread; i++) {
        const offset = (i - (spread - 1) / 2) * 0.15;
        this.enemyBullets.push({
          x: coreX,
          y: coreY,
          w: 16,
          h: 16,
          velX: Math.cos(baseAngle + offset) * (6 + this.rank * 5),
          velY: Math.sin(baseAngle + offset) * (6 + this.rank * 5)
        });
      }
    }
  }

  updateCapsules() {
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.x += c.velX;
      
      // Floating wave animation
      c.y += Math.sin(this.frameCount * 0.05 + i) * 1.5;
      
      if (c.x < -50) {
        this.capsules.splice(i, 1);
      }
    }
  }

  updateGimmicks() {
    for (let i = this.gimmicks.length - 1; i >= 0; i--) {
      const g = this.gimmicks[i];
      
      // Position tracking based on speed scroll
      g.x -= GAME_SPEED;
      
      // Update by individual gimmick mechanics
      if (g.type === 'FALLING_ROCK') {
        g.x += g.velX;
        g.y += g.velY;
        
        // spin rock
        g.rotation = (g.rotation || 0) + 0.03;
        
        if (g.y > CANVAS_HEIGHT + 100 || g.x < -100) {
          this.gimmicks.splice(i, 1);
        }
      } 
      else if (g.type === 'PRESS_WALL_TOP' || g.type === 'PRESS_WALL_BOTTOM') {
        // Move pillars down/up depending on states
        if (g.state === 'IDLE') {
          g.timer--;
          if (g.timer <= 0) {
            g.state = 'CRUSHING';
          }
        } else if (g.state === 'CRUSHING') {
          // Rapid fall down/rise up
          g.y += (g.targetY - g.y) * 0.08;
          if (Math.abs(g.y - g.targetY) < 5) {
            g.y = g.targetY;
            g.state = 'RETRACTING';
            g.timer = 45; // wait at full extension
          }
        } else if (g.state === 'RETRACTING') {
          g.timer--;
          if (g.timer <= 0) {
            g.y += (g.startY - g.y) * 0.04;
            if (Math.abs(g.y - g.startY) < 5) {
              g.y = g.startY;
              g.state = 'IDLE';
              g.timer = 120; // recharge loop
            }
          }
        }
        
        if (g.x < -g.w - 100) {
          this.gimmicks.splice(i, 1);
        }
      } 
      else if (g.type === 'REAR_ASSAULT') {
        g.x += g.velX; // rushes right
        g.y += g.velY;
        
        if (g.x > CANVAS_WIDTH + 100) {
          this.gimmicks.splice(i, 1);
        }
      }
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life--;
      
      if (p.type === 'SHRAPNEL') {
        p.x += p.velX;
        p.y += p.velY;
        p.velY += 0.1; // gravity pull
      } else if (p.type === 'SMOKE') {
        p.x += p.velX;
        p.y += p.velY;
        p.radius += 0.4;
      } else if (p.type === 'SHOCKWAVE') {
        p.radius += (p.maxRadius - p.radius) * 0.08;
      } else if (p.type === 'TEXT') {
        p.y += p.velY;
      }
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // --- Collision Detection & Resolution ---
  checkCollisions() {
    if (!this.player) return;
    
    const p = this.player;
    
    // Player bounds Box
    const pBox = { x: p.x + 8, y: p.y + 4, w: p.w - 16, h: p.h - 8 };

    // 1. Capsules vs Player
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      if (this.rectIntersect(pBox, c)) {
        this.collectCapsule(c.isFake);
        this.capsules.splice(i, 1);
      }
    }

    // 2. Enemy Bullets vs Player
    if (p.isInvincible <= 0) {
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const eb = this.enemyBullets[i];
        if (this.rectIntersect(pBox, eb)) {
          this.enemyBullets.splice(i, 1);
          
          if (p.shieldHp > 0) {
            p.shieldHp--;
            p.isInvincible = 30; // brief recovery grace
            audio.playSFX('hit');
            this.spawnExplosion(eb.x, eb.y, '#00ffff');
          } else {
            this.die('ENEMY_BULLET');
            return; // Exit check if player is dead
          }
        }
      }
    }

    // 3. Enemies and Hazards vs Player
    if (p.isInvincible <= 0) {
      // Minor enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (this.rectIntersect(pBox, e)) {
          if (p.shieldHp > 0) {
            p.shieldHp = 0; // Collisions strip shields completely
            p.isInvincible = 60;
            audio.playSFX('hit');
            this.spawnExplosion(e.x + e.w/2, e.y + e.h/2, '#ffaa00');
            this.enemies.splice(i, 1);
          } else {
            this.die('ENEMY_COLLISION');
            return;
          }
        }
      }

      // Stage Gimmicks / Obstacles
      for (let i = this.gimmicks.length - 1; i >= 0; i--) {
        const g = this.gimmicks[i];
        if (this.rectIntersect(pBox, g)) {
          if (p.shieldHp > 0) {
            p.shieldHp = 0;
            p.isInvincible = 90;
            audio.playSFX('hit');
            
            // Remove rock, but press-walls are indestructible
            if (g.type === 'FALLING_ROCK' || g.type === 'REAR_ASSAULT') {
              this.spawnExplosion(g.x + g.w/2, g.y + g.h/2, '#ffffff');
              this.gimmicks.splice(i, 1);
            }
          } else {
            this.die(g.type);
            return;
          }
        }
      }

      // Boss Contact check
      if (this.boss && this.boss.state === 'FIGHTING') {
        const bBox = { x: this.boss.x + 30, y: this.boss.y + 30, w: this.boss.w - 60, h: this.boss.h - 60 };
        if (this.rectIntersect(pBox, bBox)) {
          this.die('BOSS_COLLISION');
          return;
        }
      }
    }

    // 4. Player Bullets/Weapons vs Enemies/Hazards/Boss
    // Loop through bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let bulletRemoved = false;
      
      // Bullets vs Gimmicks (Destructible Rock & Rear Assault)
      for (let j = this.gimmicks.length - 1; j >= 0; j--) {
        const g = this.gimmicks[j];
        if (g.hp !== Infinity && this.rectIntersect(b, g)) {
          g.hp--;
          this.bullets.splice(i, 1);
          bulletRemoved = true;
          this.spawnExplosion(b.x, b.y, '#ffcc00');
          
          if (g.hp <= 0) {
            this.spawnExplosion(g.x + g.w/2, g.y + g.h/2, '#00ccff', true);
            this.gimmicks.splice(j, 1);
            this.score += 250;
          }
          break;
        }
      }
      if (bulletRemoved) continue; // Skip to next bullet immediately if already destroyed

      // Bullets vs Enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (this.rectIntersect(b, e)) {
          e.hp--;
          this.bullets.splice(i, 1);
          bulletRemoved = true;
          this.spawnExplosion(b.x, b.y, '#ffcc00');
          
          if (e.hp <= 0) {
            this.enemyKilled(e);
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
      if (bulletRemoved) continue;

      // Bullets vs Boss Core
      if (this.boss && this.boss.state === 'FIGHTING') {
        const bossObj = this.boss;
        const coreX = bossObj.x + bossObj.weakCore.relX;
        const coreY = bossObj.y + bossObj.weakCore.relY;
        
        // Calculate circle intersection with bullet coordinate (using local bullet copy b)
        const dist = Math.sqrt(Math.pow(b.x - coreX, 2) + Math.pow(b.y - coreY, 2));
        if (dist <= bossObj.weakCore.radius) {
          bossObj.hp--;
          bossObj.hitFlash = 5; // Trigger visual hit flash
          this.bullets.splice(i, 1);
          this.spawnExplosion(b.x, b.y, '#ffffff');
          
          if (bossObj.hp <= 0) {
            this.bossKilled(bossObj);
          }
        }
      }
    }

    // 5. Lasers vs Enemies/Hazards/Boss (Lasers penetrate and hit per-frame, so lower damage rate)
    if (this.lasers.length > 0) {
      this.lasers.forEach(l => {
        // Laser vs Enemies - Fixed with backward loop to prevent index skipping
        for (let idx = this.enemies.length - 1; idx >= 0; idx--) {
          const e = this.enemies[idx];
          // Check horizontal cross overlap
          if (l.y + l.h > e.y && l.y < e.y + e.h) {
            e.hp -= l.damage;
            if (this.frameCount % 5 === 0) {
              this.spawnExplosion(e.x + Math.random()*e.w, l.y + 6, '#ffffff');
            }
            if (e.hp <= 0) {
              this.enemyKilled(e);
              this.enemies.splice(idx, 1);
            }
          }
        }
        
        // Laser vs Gimmicks - Fixed with backward loop to prevent index skipping
        for (let idx = this.gimmicks.length - 1; idx >= 0; idx--) {
          const g = this.gimmicks[idx];
          if (g.hp !== Infinity && l.y + l.h > g.y && l.y < g.y + g.h && g.x < CANVAS_WIDTH) {
            g.hp -= l.damage;
            if (this.frameCount % 5 === 0) {
              this.spawnExplosion(g.x + Math.random()*g.w, l.y + 6, '#ffffff');
            }
            if (g.hp <= 0) {
              this.spawnExplosion(g.x + g.w/2, g.y + g.h/2, '#00ccff', true);
              this.gimmicks.splice(idx, 1);
              this.score += 250;
            }
          }
        }

        // Laser vs Boss Core
        if (this.boss && this.boss.state === 'FIGHTING') {
          const bossObj = this.boss;
          const coreX = bossObj.x + bossObj.weakCore.relX;
          const coreY = bossObj.y + bossObj.weakCore.relY;
          
          if (l.y + l.h > coreY - bossObj.weakCore.radius && l.y < coreY + bossObj.weakCore.radius) {
            bossObj.hp -= l.damage;
            bossObj.hitFlash = 3;
            if (this.frameCount % 6 === 0) {
              this.spawnExplosion(coreX - 10 + Math.random()*20, coreY - 10 + Math.random()*20, '#ffffff');
            }
            if (bossObj.hp <= 0) {
              this.bossKilled(bossObj);
            }
          }
        }
      });
    }

    // 6. Missiles vs Ground Hazards / Enemies
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      
      // Missile vs Enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (this.rectIntersect(m, e)) {
          e.hp -= 3; // high impact damage
          this.missiles.splice(i, 1);
          this.spawnExplosion(m.x, m.y, '#00ccff', true);
          
          if (e.hp <= 0) {
            this.enemyKilled(e);
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
    }
  }

  enemyKilled(e) {
    audio.playSFX('kill');
    this.spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, e.type === 2 ? '#ffaa00' : '#00ccff', e.type === 2);
    
    // Add Score
    this.score += e.type === 2 ? 500 : 100;
    
    // Frequent capsule drops to avoid monotonous loops
    // 45% drop rate
    if (Math.random() < 0.45) {
      this.capsules.push({
        x: e.x,
        y: e.y + e.h / 2 - 16,
        w: 32,
        h: 32,
        isFake: false,
        velX: -2
      });
    }
  }

  bossKilled(b) {
    b.state = 'DYING';
    b.introTimer = 180; // intro timer (frames)
    audio.playSFX('boss_death');
    this.spawnExplosion(b.x + b.w / 2, b.y + b.h / 2, '#ffcc00', true);
    this.score += 5000;
  }

  rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.w || 
             r2.x + r2.w < r1.x || 
             r2.y > r1.y + r1.h ||
             r2.y + r2.h < r1.y);
  }

  // --- Rendering Functions ---
  draw() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 1. Draw multi-layered Parallax Backgrounds
    this.drawBackgrounds();
    
    // 2. Draw warning beacons before historical death coordinate threats
    this.drawHistoricalWarnings();

    if (this.state === 'PLAYING') {
      // 3. Draw game entities
      this.drawGimmicks();
      this.drawCapsules();
      this.drawEnemies();
      this.drawBoss();
      this.drawPlayer();
      this.drawOptionPods();
      this.drawBullets();
      this.drawLasers();
      this.drawParticles();
      
      // 4. Draw HUD (lives, score, rank difficulty meter, power-up queue)
      this.drawHUD();
    }
  }

  drawBackgrounds() {
    let bgImg = null;
    if (this.stage === 1) bgImg = assets.images.bgSpace;
    else if (this.stage === 2) bgImg = assets.images.bgFortress;
    else bgImg = assets.images.bgNebula;

    if (bgImg && !assets.fallbackMode) {
      // Multi-layer Parallax logic
      // Deep distant background (stars/nebula) scroll slowly
      const farScroll = (this.distance * 0.1) % CANVAS_WIDTH;
      this.ctx.drawImage(bgImg, -farScroll, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.ctx.drawImage(bgImg, -farScroll + CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Stage 2 Fortress structure additional mid-ground layers
      if (this.stage === 2) {
        this.ctx.fillStyle = 'rgba(10, 10, 18, 0.4)';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
        this.ctx.fillRect(0, CANVAS_HEIGHT - 80, CANVAS_WIDTH, 80);
      }
    } else {
      // Clean high-res procedural background drawing
      this.ctx.fillStyle = '#050510';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Starfield simulation
      this.ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const starX = (Math.sin(i * 123.4) * 0.5 + 0.5) * CANVAS_WIDTH;
        const starY = (Math.cos(i * 567.8) * 0.5 + 0.5) * CANVAS_HEIGHT;
        const size = (Math.sin(this.frameCount * 0.05 + i) * 0.5 + 0.5) * 2;
        this.ctx.fillRect(starX, starY, size, size);
      }
      
      if (this.stage === 2) {
        // Draw steel girder structures
        this.ctx.fillStyle = '#1c1b24';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
        this.ctx.fillRect(0, CANVAS_HEIGHT - 80, CANVAS_WIDTH, 80);
      }
    }
  }

  drawHistoricalWarnings() {
    if (!this.player) return;
    
    // Warning UI is shown when player is approaching a coordinate where they previously died.
    // Display warnings ~350px before the coordinate.
    this.deathHistory.forEach(record => {
      if (record.stage === this.stage) {
        // Calculate relative distance
        const relativeX = record.x - this.distance;
        
        // Show warnings if player is near (between 250px and 750px ahead of coordinate)
        if (relativeX > 100 && relativeX < 700) {
          this.ctx.save();
          
          // Flash colors
          const pulse = Math.floor(this.frameCount / 8) % 2 === 0;
          this.ctx.fillStyle = pulse ? 'rgba(0, 204, 255, 0.9)' : 'rgba(255, 255, 255, 0.9)';
          this.ctx.strokeStyle = pulse ? '#00ccff' : '#ffffff';
          this.ctx.lineWidth = 2;
          
          // Outer panel box
          this.ctx.fillStyle = 'rgba(20, 5, 10, 0.65)';
          this.ctx.fillRect(CANVAS_WIDTH / 2 - 250, 80, 500, 55);
          this.ctx.strokeRect(CANVAS_WIDTH / 2 - 250, 80, 500, 55);
          
          // Warning Icon
          this.ctx.font = '900 20px Orbitron';
          this.ctx.fillStyle = '#00ccff';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('⚠️ 致命的ビーコン警報 ⚠️', CANVAS_WIDTH / 2, 104);
          
          // Subtext depends on the cause recorded (日本語)
          let alertText = '警告：不明な異常領域です！';
          if (record.reason === 'FALLING_ROCK') alertText = '注意：落下する天体デブリに注意！';
          else if (record.reason === 'REAR_ASSAULT') alertText = '注意：背後からの奇襲機が接近しています！';
          else if (record.reason.startsWith('PRESS_WALL')) alertText = '警告：圧縮プレートが作動中です！';
          else if (record.reason === 'FAKE_CAPSULE') alertText = '注意：偽のデコイカプセルが検出されました！';
          else if (record.reason === 'ENEMY_BULLET') alertText = '注意：敵弾が集中する危険地帯です！';
          
          this.ctx.font = '700 13px Orbitron';
          this.ctx.fillStyle = '#ffffff';
          this.ctx.fillText(alertText, CANVAS_WIDTH / 2, 126);
          
          // Draw indicator arrow pointing down to relative hazard coordinate
          
          this.ctx.restore();
        }
      }
    });
  }

  drawPlayer() {
    if (!this.player) return;
    
    const p = this.player;
    
    // Draw trail afterimages
    if (this.frameCount % 2 === 0) {
      for (let i = 2; i < p.trail.length; i += 3) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.15 / (i / 2);
        
        // draw shadow offset
        if (assets.images.playerShip && !assets.fallbackMode) {
          this.ctx.translate(p.trail[i].x + p.w/2, p.trail[i].y + p.h/2);
          this.ctx.rotate(p.trail[i].bank * 0.15);
          this.ctx.drawImage(assets.images.playerShip, -p.w/2, -p.h/2, p.w, p.h);
        } else {
          procedural.drawPlayerFallback(this.ctx, p.trail[i].x, p.trail[i].y, p.w, p.h, p.trail[i].bank, this.frameCount);
        }
        this.ctx.restore();
      }
    }

    // Main Ship Draw
    this.ctx.save();
    // Start transparency cycle for invincibility flickering
    if (p.isInvincible > 0 && Math.floor(p.isInvincible / 4) % 2 === 0) {
      this.ctx.globalAlpha = 0.3;
    }
    
    if (assets.images.playerShip && !assets.fallbackMode) {
      // Dynamic Bank animation
      this.ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      this.ctx.rotate(p.bank * 0.15);
      
      // Engine flame pulse rendering
      const pulseWidth = 14 + Math.sin(this.frameCount * 0.4) * 6;
      this.ctx.fillStyle = 'rgba(0, 243, 255, 0.8)';
      this.ctx.beginPath();
      this.ctx.arc(-p.w / 2, 0, pulseWidth / 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.drawImage(assets.images.playerShip, -p.w/2, -p.h/2, p.w, p.h);
    } else {
      procedural.drawPlayerFallback(this.ctx, p.x, p.y, p.w, p.h, p.bank, this.frameCount);
    }
    
    this.ctx.restore();

    // Shield bubble
    if (p.shieldHp > 0) {
      procedural.drawShieldFallback(this.ctx, p.x, p.y, p.w, p.h, p.shieldHp);
    }
  }

  drawOptionPods() {
    if (this.player.optionCount <= 0) return;
    
    for (let i = 0; i < this.player.optionCount; i++) {
      const idx = (i + 1) * 15; // 15 frames trailing delay
      const coord = this.player.optionTrail[idx] || this.player.optionTrail[this.player.optionTrail.length - 1];
      if (!coord) continue;
      
      this.ctx.save();
      
      // Floating pulse pod layout
      const size = 18;
      const optX = coord.x + this.player.w / 2;
      const optY = coord.y + this.player.h / 2;
      
      // Outer neon rings
      const glowGrad = this.ctx.createRadialGradient(optX, optY, 2, optX, optY, size);
      glowGrad.addColorStop(0, '#ff9900');
      glowGrad.addColorStop(0.5, 'rgba(255, 60, 0, 0.3)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      this.ctx.fillStyle = glowGrad;
      this.ctx.beginPath();
      this.ctx.arc(optX, optY, size, 0, Math.PI*2);
      this.ctx.fill();
      
      // Core pod
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#00ccff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(optX, optY, 6, 0, Math.PI*2);
      this.ctx.fill();
      this.ctx.stroke();
      
      this.ctx.restore();
    }
  }

  drawBullets() {
    this.ctx.save();
    // Blend mode additive for glow effects
    this.ctx.globalCompositeOperation = 'screen';
    
    // Player normal bullets
    this.bullets.forEach(b => {
      if (!b.isEnemy) {
        // Multi layered laser capsule
        const bulletGrad = this.ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y);
        bulletGrad.addColorStop(0, 'rgba(0, 243, 255, 0.1)');
        bulletGrad.addColorStop(0.5, '#ffffff');
        bulletGrad.addColorStop(1, 'rgba(0, 243, 255, 0.9)');
        
        this.ctx.fillStyle = bulletGrad;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#00f3ff';
        
        this.ctx.beginPath();
        this.ctx.roundRect(b.x, b.y, b.w, b.h, 3);
        this.ctx.fill();
      }
    });

    // Enemy bullets
    this.enemyBullets.forEach(eb => {
      const redGrad = this.ctx.createRadialGradient(eb.x + eb.w/2, eb.y + eb.h/2, 1, eb.x + eb.w/2, eb.y + eb.h/2, eb.w/2);
      redGrad.addColorStop(0, '#ffffff');
      redGrad.addColorStop(0.3, '#00ccff');
      redGrad.addColorStop(1, 'rgba(0, 204, 255, 0)');
      
      this.ctx.fillStyle = redGrad;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = '#00ccff';
      
      this.ctx.beginPath();
      this.ctx.arc(eb.x + eb.w/2, eb.y + eb.h/2, eb.w/2, 0, Math.PI*2);
      this.ctx.fill();
    });

    // Reset shadow
    this.ctx.shadowBlur = 0;
    this.ctx.restore();

    // Ground sliding missiles
    this.missiles.forEach(m => {
      this.ctx.save();
      // Draw missile shape
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#00ccff';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.roundRect(m.x, m.y, m.w, m.h, 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Flame tail
      this.ctx.fillStyle = '#ff6600';
      this.ctx.fillRect(m.x - 5, m.y + 2, 5, m.h - 4);
      this.ctx.restore();
    });
  }

  drawLasers() {
    this.lasers.forEach(l => {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      
      // Flickering outer glow
      const flicker = Math.random() * 4 + 8;
      
      this.ctx.shadowBlur = flicker;
      this.ctx.shadowColor = '#ff00aa';
      
      // Core white laser beam
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(l.x, l.y + l.h/3, l.w, l.h/3);
      
      // Outer purple border laser
      this.ctx.fillStyle = 'rgba(255, 0, 170, 0.45)';
      this.ctx.fillRect(l.x, l.y, l.w, l.h);
      
      this.ctx.restore();
    });
  }

  drawEnemies() {
    this.enemies.forEach(e => {
      this.ctx.save();
      
      if (assets.images.enemyShip && !assets.fallbackMode) {
        // Draw image facing left
        this.ctx.drawImage(assets.images.enemyShip, e.x, e.y, e.w, e.h);
      } else {
        procedural.drawEnemyFallback(this.ctx, e.x, e.y, e.w, e.h, e.type, this.frameCount);
      }
      
      // Heavy bomber health bar (tiny indicator)
      if (e.type === 2 && e.hp < e.maxHp) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(e.x, e.y - 8, e.w, 4);
        this.ctx.fillStyle = '#39ff14';
        this.ctx.fillRect(e.x, e.y - 8, e.w * (e.hp / e.maxHp), 4);
      }
      
      this.ctx.restore();
    });
  }

  drawBoss() {
    if (!this.boss) return;
    
    const b = this.boss;
    this.ctx.save();
    
    // Calculate core position coordinates
    const coreX = b.x + b.weakCore.relX;
    const coreY = b.y + b.weakCore.relY + Math.sin(this.frameCount * 0.03) * 80;
    
    // Draw Boss Ship
    if (assets.images.bossShip && !assets.fallbackMode) {
      if (b.hitFlash > 0) {
        // Red flash filter using cached offscreen canvas to avoid GC allocations in render loop
        const buffer = this.bossFlashCanvas;
        if (buffer.width !== b.w || buffer.height !== b.h) {
          buffer.width = b.w;
          buffer.height = b.h;
        }
        const bCtx = this.bossFlashCtx;
        bCtx.clearRect(0, 0, b.w, b.h);
        
        bCtx.drawImage(assets.images.bossShip, 0, 0, b.w, b.h);
        bCtx.globalCompositeOperation = 'source-in';
        bCtx.fillStyle = b.hitFlash % 2 === 0 ? '#ffffff' : '#00ccff';
        bCtx.fillRect(0, 0, b.w, b.h);
        
        this.ctx.drawImage(buffer, b.x, b.y);
      } else {
        this.ctx.drawImage(assets.images.bossShip, b.x, b.y, b.w, b.h);
      }
    } else {
      procedural.drawBossFallback(this.ctx, b.x, b.y, b.w, b.h, b.stage, this.frameCount, b.hitFlash > 0);
    }
    
    // Always draw Glowing vulnerable Core indicator explicitly (for clear target guidelines)
    this.ctx.globalCompositeOperation = 'screen';
    const pulse = Math.sin(this.frameCount * 0.2) * 5;
    const coreGlow = this.ctx.createRadialGradient(coreX, coreY, 2, coreX, coreY, b.weakCore.radius + pulse);
    
    if (b.stage === 1) {
      coreGlow.addColorStop(0, '#ffffff');
      coreGlow.addColorStop(0.3, '#00ccff');
      coreGlow.addColorStop(1, 'rgba(0, 204, 255, 0)');
    } else if (b.stage === 2) {
      coreGlow.addColorStop(0, '#ffffff');
      coreGlow.addColorStop(0.3, '#ccff00');
      coreGlow.addColorStop(1, 'rgba(200, 255, 0, 0)');
    } else {
      coreGlow.addColorStop(0, '#ffffff');
      coreGlow.addColorStop(0.3, '#00ffff');
      coreGlow.addColorStop(1, 'rgba(0, 255, 255, 0)');
    }
    
    this.ctx.fillStyle = coreGlow;
    this.ctx.beginPath();
    this.ctx.arc(coreX, coreY, b.weakCore.radius + pulse, 0, Math.PI*2);
    this.ctx.fill();
    
    this.ctx.restore();
  }

  drawCapsules() {
    this.capsules.forEach(c => {
      procedural.drawCapsuleFallback(this.ctx, c.x, c.y, c.w, c.h, c.isFake, this.frameCount);
    });
  }

  drawGimmicks() {
    this.gimmicks.forEach(g => {
      this.ctx.save();
      
      if (g.type === 'FALLING_ROCK') {
        // Draw rocky circle
        this.ctx.translate(g.x + g.w/2, g.y + g.h/2);
        this.ctx.rotate(g.rotation || 0);
        
        const rockGrad = this.ctx.createRadialGradient(0, 0, 5, 0, 0, g.w/2);
        rockGrad.addColorStop(0, '#665544');
        rockGrad.addColorStop(0.7, '#3d3023');
        rockGrad.addColorStop(1, '#110c08');
        
        this.ctx.fillStyle = rockGrad;
        this.ctx.strokeStyle = '#aa8866';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        // jagged rock outline
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2;
          const r = g.w/2 - 5 + Math.sin(i * 123.4) * 8;
          const rx = Math.cos(angle) * r;
          const ry = Math.sin(angle) * r;
          if (i === 0) this.ctx.moveTo(rx, ry);
          else this.ctx.lineTo(rx, ry);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      } 
      else if (g.type === 'PRESS_WALL_TOP' || g.type === 'PRESS_WALL_BOTTOM') {
        // Draw metal piston block
        const blockGrad = this.ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y);
        blockGrad.addColorStop(0, '#2b2a33');
        blockGrad.addColorStop(0.5, '#484752');
        blockGrad.addColorStop(1, '#18171f');
        
        this.ctx.fillStyle = blockGrad;
        this.ctx.fillRect(g.x, g.y, g.w, g.h);
        
        // Hazard warning yellow/black strips
        this.ctx.fillStyle = '#ffcc00';
        const stripY = g.type === 'PRESS_WALL_TOP' ? g.y + g.h - 15 : g.y;
        this.ctx.fillRect(g.x, stripY, g.w, 15);
        
        this.ctx.fillStyle = '#000000';
        for (let idx = 0; idx < g.w; idx += 20) {
          this.ctx.beginPath();
          this.ctx.moveTo(g.x + idx, stripY);
          this.ctx.lineTo(g.x + idx + 10, stripY);
          this.ctx.lineTo(g.x + idx, stripY + 15);
          this.ctx.closePath();
          this.ctx.fill();
        }
        
        // Outline
        this.ctx.strokeStyle = '#5f5e6b';
        this.ctx.strokeRect(g.x, g.y, g.w, g.h);
      } 
      else if (g.type === 'REAR_ASSAULT') {
        // Fast small jets
        procedural.drawEnemyFallback(this.ctx, g.x, g.y, g.w, g.h, 1, this.frameCount);
      }
      
      this.ctx.restore();
    });
  }

  drawParticles() {
    this.particles.forEach(p => {
      this.ctx.save();
      
      if (p.type === 'SHRAPNEL') {
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x, p.y, p.w, p.h);
      } else if (p.type === 'SMOKE') {
        // Expand/Fade smoke particles
        this.ctx.globalAlpha = p.life / 60;
        this.ctx.fillStyle = 'rgba(80, 80, 90, 0.45)';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        this.ctx.fill();
      } else if (p.type === 'SHOCKWAVE') {
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.globalAlpha = p.life / 25;
        this.ctx.strokeStyle = p.color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        this.ctx.stroke();
      } else if (p.type === 'MUZZLE') {
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 10 + Math.random()*5, 0, Math.PI*2);
        this.ctx.fill();
      } else if (p.type === 'TEXT') {
        this.ctx.globalAlpha = p.life / 60;
        this.ctx.fillStyle = p.color;
        this.ctx.font = 'bold 15px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(p.text, p.x, p.y);
      }
      
      this.ctx.restore();
    });
  }

  drawHUD() {
    this.ctx.save();
    
    // Top Bar Panel
    this.ctx.fillStyle = 'rgba(5, 5, 15, 0.65)';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, 48);
    this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 48);
    this.ctx.lineTo(CANVAS_WIDTH, 48);
    this.ctx.stroke();

    // 1. Text Info (Score, Lives, Stage)
    this.ctx.font = 'bold 16px Orbitron';
    this.ctx.fillStyle = '#ffffff';
    
    // Score
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`SCORE: ${this.score.toLocaleString()}`, 25, 30);
    
    // Lives
    this.ctx.fillText(`SHIPS: `, 280, 30);
    this.ctx.fillStyle = this.colors.neonBlue;
    for (let i = 0; i < this.lives; i++) {
      this.ctx.fillRect(360 + i * 22, 17, 14, 14); // Mini ship boxes
    }
    
    // Stage Timer Progress bar or Boss HP
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#ffffff';
    if (this.boss) {
      // Draw Boss HP Bar
      const b = this.boss;
      const barW = 400;
      const barX = CANVAS_WIDTH / 2 - barW / 2;
      
      this.ctx.fillText(`BOSS`, CANVAS_WIDTH / 2, 20);
      
      // Outer slot
      this.ctx.fillStyle = 'rgba(0, 204, 255, 0.2)';
      this.ctx.fillRect(barX, 26, barW, 12);
      this.ctx.strokeStyle = '#00ccff';
      this.ctx.strokeRect(barX, 26, barW, 12);
      
      // Inside fill
      this.ctx.fillStyle = '#00ccff';
      const currentFill = Math.max(0, barW * (b.hp / b.maxHp));
      this.ctx.fillRect(barX, 26, currentFill, 12);
    } else {
      // Draw Stage scroll progress
      const stagePct = Math.min(1.0, this.stageTimer / STAGE_TIME);
      const barW = 300;
      const barX = CANVAS_WIDTH / 2 - barW / 2;
      
      this.ctx.fillText(`STAGE ${this.stage}`, CANVAS_WIDTH / 2, 20);
      this.ctx.fillStyle = 'rgba(0, 243, 255, 0.15)';
      this.ctx.fillRect(barX, 26, barW, 8);
      this.ctx.fillStyle = '#00f3ff';
      this.ctx.fillRect(barX, 26, barW * stagePct, 8);
    }
    
    // Rank (Realtime Difficulty adjust HUD display)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`RANK:`, CANVAS_WIDTH - 150, 30);
    
    // Draw Rank meter
    const rankX = CANVAS_WIDTH - 90;
    const rankW = 60;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.fillRect(rankX, 19, rankW, 12);
    
    // color shifts to hue (green->red) as rank grows
    const rColor = `hsl(${120 - this.rank * 120}, 100%, 50%)`;
    this.ctx.fillStyle = rColor;
    this.ctx.fillRect(rankX, 19, rankW * this.rank, 12);

    // Attack speed numeric display (multiplicative stack visible)
    if (this.player) {
    const atk = (this.player.attackSpeed || 1.0).toFixed(2);
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#00ccff';
    this.ctx.fillText(`攻撃速度: x${atk}`, CANVAS_WIDTH - 260, 30);
    }

    this.ctx.restore();

    // 2. Gradius Style Power Up selection grid (Canvas Bottom)
    this.drawPowerUpGrid();
  }

  drawPowerUpGrid() {
    this.ctx.save();
    
    const numItems = this.powerUpNames.length; // 7 items
    const cellW = 88;
    const cellH = 34;
    const gap = 10;
    const totalW = (cellW * numItems) + (gap * (numItems - 1));
    const startX = CANVAS_WIDTH / 2 - totalW / 2;
    const gridY = CANVAS_HEIGHT - cellH - 20;

    // Background panel
    this.ctx.fillStyle = 'rgba(5, 5, 20, 0.85)';
    this.ctx.fillRect(startX - 15, gridY - 8, totalW + 30, cellH + 16);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.strokeRect(startX - 15, gridY - 8, totalW + 30, cellH + 16);

    for (let i = 0; i < numItems; i++) {
      const cellX = startX + i * (cellW + gap);
      const isSelected = this.powerUpIndex === i;
      
      // Cell Background slots
      this.ctx.fillStyle = isSelected ? 'rgba(0, 243, 255, 0.25)' : 'rgba(10, 10, 26, 0.5)';
      this.ctx.strokeStyle = isSelected ? '#00f3ff' : 'rgba(0, 243, 255, 0.2)';
      this.ctx.lineWidth = isSelected ? 2 : 1;
      
      this.ctx.beginPath();
      this.ctx.roundRect(cellX, gridY, cellW, cellH, 4);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Cell text
      this.ctx.font = 'bold 12px Orbitron';
      this.ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(this.powerUpNames[i], cellX + cellW / 2, gridY + cellH / 2);
    }

    // If a power-up is currently highlighted, draw a one-line description for clarity
    if (this.powerUpIndex !== -1) {
      const desc = this.powerDescriptions[this.powerUpNames[this.powerUpIndex]] || '';
      this.ctx.font = '700 13px Orbitron';
      this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(desc, CANVAS_WIDTH / 2, gridY - 10);
    }
    
    this.ctx.restore();
  }

  // --- Helper utility ---
  loop() {
    // 通常のフレーム更新（テスト用高速化は削除）
    const logicUpdates = 1;
    for (let i = 0; i < logicUpdates; i++) {
      this.update();
    }
    this.draw();
    // Use requestAnimationFrame for smooth play, setTimeout for headless test reliability
    requestAnimationFrame(() => this.loop());
  }
}

// Helpers
function varColor(variableName) {
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

// Start game instance on load
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
});
