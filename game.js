/**
 * ============================================================================
 * VOLCANO RUNNER - Complete 2D Platformer Game
 * ============================================================================
 * Features:
 * - Pure HTML5 Canvas + Vanilla JavaScript (No external libraries or images)
 * - Floating brick platforms, moving bricks, triggered bricks
 * - Procedural Mario-style character with full running & jumping animations
 * - Animated multi-layered wavy lava at the bottom with bubbles & heat embers
 * - Automatic extending wooden bridge before the final gate
 * - Sound synthesizer powered by Web Audio API (zero audio files needed)
 * - Fixed timestep game loop (60 FPS) with requestAnimationFrame
 * - 3 progressively challenging levels defined as clean data structures
 * - Responsive canvas scaling with keyboard and mobile touch controls
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS & CONFIGURATION
  // ==========================================================================
  const VIRTUAL_WIDTH = 960;
  const VIRTUAL_HEIGHT = 540;
  const FIXED_TIMESTEP = 1 / 60; // 60 FPS fixed physics step
  const LAVA_SURFACE_Y = 475; // Y coordinate where deadly lava begins

  // Physics constants
  const GRAVITY = 1100; // pixels / second^2
  const MOVE_SPEED = 280; // pixels / second
  const ACCELERATION = 1800; // pixels / second^2
  const FRICTION = 1400; // pixels / second^2
  const JUMP_VELOCITY = -520; // initial jump impulse
  const MIN_JUMP_VELOCITY = -200; // when jump key released early
  const COYOTE_TIME = 0.12; // seconds player can jump after leaving ledge
  const JUMP_BUFFER = 0.12; // seconds jump input is remembered before landing

  // Game States
  const STATE = {
    START: 'START',
    PLAYING: 'PLAYING',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
  };

  // ==========================================================================
  // 2. WEB AUDIO SYNTHESIZER (Pure JS Procedural SFX)
  // ==========================================================================
  class SoundSynthesizer {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    playJump() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.15);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
      } catch (e) { }
    }

    playLand() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
      } catch (e) { }
    }

    playPlank() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.09);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
      } catch (e) { }
    }

    playDeath() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.42);
      } catch (e) { }
    }

    playLevelComplete() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          const startTime = now + idx * 0.12;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.25, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.26);
        });
      } catch (e) { }
    }

    playVictory() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [392.0, 392.0, 392.0, 523.25, 659.25, 783.99];
        const times = [0, 0.15, 0.3, 0.45, 0.65, 0.9];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          const startTime = now + times[idx];
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.2, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.36);
        });
      } catch (e) { }
    }
  }

  const audio = new SoundSynthesizer();

  // ==========================================================================
  // 3. INPUT MANAGER
  // ==========================================================================
  class InputManager {
    constructor() {
      this.keys = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        enter: false,
        restart: false
      };
      this.jumpPressed = false;
      this.enterPressed = false;

      this.initKeyboard();
      this.initTouch();
    }

    initKeyboard() {
      window.addEventListener('keydown', (e) => {
        audio.init();

        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }

        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            this.keys.left = true;
            break;
          case 'ArrowRight':
          case 'KeyD':
            this.keys.right = true;
            break;
          case 'ArrowUp':
          case 'KeyW':
          case 'Space':
            if (!this.keys.jump) {
              this.jumpPressed = true;
            }
            this.keys.jump = true;
            break;
          case 'Enter':
            if (!this.keys.enter) {
              this.enterPressed = true;
            }
            this.keys.enter = true;
            break;
          case 'KeyR':
            this.keys.restart = true;
            break;
          case 'KeyM':
            toggleSound();
            break;
        }
      });

      window.addEventListener('keyup', (e) => {
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            this.keys.left = false;
            break;
          case 'ArrowRight':
          case 'KeyD':
            this.keys.right = false;
            break;
          case 'ArrowUp':
          case 'KeyW':
          case 'Space':
            this.keys.jump = false;
            break;
          case 'Enter':
            this.keys.enter = false;
            break;
          case 'KeyR':
            this.keys.restart = false;
            break;
        }
      });
    }

    initTouch() {
      const bindTouch = (id, onDown, onUp) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const handleStart = (e) => {
          e.preventDefault();
          audio.init();
          btn.classList.add('active');
          onDown();
        };
        const handleEnd = (e) => {
          e.preventDefault();
          btn.classList.remove('active');
          onUp();
        };
        btn.addEventListener('touchstart', handleStart, { passive: false });
        btn.addEventListener('touchend', handleEnd, { passive: false });
        btn.addEventListener('touchcancel', handleEnd, { passive: false });
        btn.addEventListener('mousedown', handleStart);
        btn.addEventListener('mouseup', handleEnd);
        btn.addEventListener('mouseleave', handleEnd);
      };

      bindTouch('touch-left', () => { this.keys.left = true; }, () => { this.keys.left = false; });
      bindTouch('touch-right', () => { this.keys.right = true; }, () => { this.keys.right = false; });
      bindTouch('touch-jump', () => {
        if (!this.keys.jump) this.jumpPressed = true;
        this.keys.jump = true;
      }, () => {
        this.keys.jump = false;
      });
    }

    consumeJump() {
      const pressed = this.jumpPressed;
      this.jumpPressed = false;
      return pressed;
    }

    consumeEnter() {
      const pressed = this.enterPressed;
      this.enterPressed = false;
      return pressed;
    }
  }

  // ==========================================================================
  // 4. PARTICLE SYSTEM
  // ==========================================================================
  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.lavaBubbles = [];
    }

    reset() {
      this.particles = [];
      this.lavaBubbles = [];
    }

    addLavaBubble(x, y) {
      this.lavaBubbles.push({
        x: x,
        y: y,
        radius: 2 + Math.random() * 4,
        maxRadius: 6 + Math.random() * 8,
        growth: 6 + Math.random() * 8,
        color: Math.random() > 0.5 ? '#ffeb3b' : '#ff9800'
      });
    }

    addEmber(x, y) {
      this.particles.push({
        type: 'ember',
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 40,
        vy: -50 - Math.random() * 80,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.9,
        decay: 0.3 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? '#ffc107' : '#ff5722'
      });
    }

    addDust(x, y) {
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          type: 'dust',
          x: x + (Math.random() - 0.5) * 12,
          y: y,
          vx: (Math.random() - 0.5) * 60,
          vy: -20 - Math.random() * 30,
          size: 3 + Math.random() * 3,
          alpha: 0.7,
          decay: 1.5,
          color: '#d7ccc8'
        });
      }
    }

    addLavaSplash(x, y) {
      for (let i = 0; i < 35; i++) {
        const angle = -Math.PI * 0.1 - Math.random() * Math.PI * 0.8;
        const speed = 120 + Math.random() * 320;
        this.particles.push({
          type: 'splash',
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 5,
          alpha: 1.0,
          decay: 1.0 + Math.random() * 0.8,
          color: Math.random() > 0.4 ? '#ff5722' : '#ffeb3b'
        });
      }
    }

    addSparkles(x, y, count = 10, color = '#ffd700') {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 120;
        this.particles.push({
          type: 'sparkle',
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3,
          alpha: 1.0,
          decay: 1.2 + Math.random() * 0.8,
          color: color
        });
      }
    }

    update(dt, cameraX, viewWidth) {
      // Spawn random embers from lava within camera view
      if (Math.random() < 0.35) {
        const spawnX = cameraX + Math.random() * viewWidth;
        this.addEmber(spawnX, LAVA_SURFACE_Y + 10);
      }

      // Spawn random lava bubbles within view
      if (Math.random() < 0.15) {
        const bubbleX = cameraX + Math.random() * viewWidth;
        this.addLavaBubble(bubbleX, LAVA_SURFACE_Y);
      }

      // Update lava bubbles
      for (let i = this.lavaBubbles.length - 1; i >= 0; i--) {
        const b = this.lavaBubbles[i];
        b.radius += b.growth * dt;
        if (b.radius >= b.maxRadius) {
          // Bubble burst!
          this.addSparkles(b.x, b.y, 4, b.color);
          this.lavaBubbles.splice(i, 1);
        }
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.type === 'splash') {
          p.vy += GRAVITY * 0.7 * dt;
        }

        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    draw(ctx) {
      // Draw bubbles
      for (const b of this.lavaBubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#d84315';
        ctx.stroke();
      }

      // Draw particles
      for (const p of this.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        if (p.type === 'ember') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'dust') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.restore();
      }
    }
  }

  // ==========================================================================
  // 5. EXTENDING BRIDGE MECHANIC
  // ==========================================================================
  class FinalBridge {
    constructor(config) {
      this.triggerX = config.triggerX; // X threshold on last brick that triggers bridge
      this.startX = config.startX; // Start of bridge gap
      this.endX = config.endX; // End of bridge gap (meets gate platform)
      this.y = config.y; // Height of bridge
      this.totalPlanks = config.totalPlanks || 10;
      this.plankWidth = (this.endX - this.startX) / this.totalPlanks;
      this.plankHeight = 16;
      this.plankInterval = config.plankInterval || 0.12; // seconds between planks

      this.isTriggered = false;
      this.timer = 0;
      this.planksPlaced = 0;
      this.planks = []; // active solid planks

      // Pre-compute plank target coordinates
      for (let i = 0; i < this.totalPlanks; i++) {
        this.planks.push({
          index: i,
          x: this.startX + i * this.plankWidth,
          y: this.y,
          width: this.plankWidth - 2, // 2px gap between planks
          height: this.plankHeight,
          placed: false,
          animProgress: 0 // for bounce-in effect
        });
      }
    }

    trigger() {
      if (!this.isTriggered) {
        this.isTriggered = true;
        this.timer = 0;
      }
    }

    update(dt, particles) {
      if (!this.isTriggered) return;

      if (this.planksPlaced < this.totalPlanks) {
        this.timer += dt;
        if (this.timer >= this.plankInterval) {
          this.timer -= this.plankInterval;
          const plank = this.planks[this.planksPlaced];
          plank.placed = true;
          this.planksPlaced++;

          // Sound & visual juice
          audio.playPlank();
          particles.addSparkles(plank.x + plank.width / 2, plank.y, 8, '#ffcc80');
        }
      }

      // Update bounce animations
      for (const plank of this.planks) {
        if (plank.placed && plank.animProgress < 1) {
          plank.animProgress = Math.min(1, plank.animProgress + dt * 6);
        }
      }
    }

    getActivePlanks() {
      return this.planks.filter(p => p.placed);
    }

    draw(ctx) {
      // Draw suspension ropes across the chasm
      ctx.save();
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 3;

      // Top suspension cable
      ctx.beginPath();
      ctx.moveTo(this.startX - 10, this.y - 18);
      ctx.quadraticCurveTo(
        (this.startX + this.endX) / 2,
        this.y - 6,
        this.endX + 10,
        this.y - 18
      );
      ctx.stroke();

      // Bottom suspension cable
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.startX - 5, this.y + 18);
      ctx.quadraticCurveTo(
        (this.startX + this.endX) / 2,
        this.y + 26,
        this.endX + 5,
        this.y + 18
      );
      ctx.stroke();

      // Draw bridge planks
      for (const plank of this.planks) {
        if (!plank.placed) continue;

        // Spring bounce entry animation
        const t = plank.animProgress;
        const bounceOffset = Math.sin(t * Math.PI) * (1 - t) * -22;
        const drawY = plank.y + bounceOffset;

        // Vertical rope hangers
        ctx.strokeStyle = 'rgba(109, 76, 65, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plank.x + plank.width / 2, this.y - 12);
        ctx.lineTo(plank.x + plank.width / 2, drawY + plank.height);
        ctx.stroke();

        // Wooden plank base
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(plank.x, drawY, plank.width, plank.height);

        // Plank top highlight
        ctx.fillStyle = '#bcaaa4';
        ctx.fillRect(plank.x, drawY, plank.width, 3);

        // Plank bottom shadow
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(plank.x, drawY + plank.height - 3, plank.width, 3);

        // Wood grain line
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plank.x + 3, drawY + 8);
        ctx.lineTo(plank.x + plank.width - 3, drawY + 8);
        ctx.stroke();

        // Iron nail heads
        ctx.fillStyle = '#263238';
        ctx.beginPath();
        ctx.arc(plank.x + 4, drawY + 8, 1.8, 0, Math.PI * 2);
        ctx.arc(plank.x + plank.width - 4, drawY + 8, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // ==========================================================================
  // 6. PLATFORM CLASSES
  // ==========================================================================
  class Platform {
    constructor(data) {
      this.id = data.id || Math.random();
      this.x = data.x;
      this.y = data.y;
      this.width = data.width;
      this.height = data.height || 36;
      this.type = data.type || 'normal'; // 'normal', 'moving', 'trigger'

      this.prevX = this.x;
      this.prevY = this.y;
      this.dx = 0;
      this.dy = 0;

      // Moving platform parameters
      this.moveY = data.moveY || 0; // vertical amplitude
      this.moveX = data.moveX || 0; // horizontal amplitude
      this.speed = data.speed || 1.8;
      this.phase = data.phase || 0;
      this.initialX = this.x;
      this.initialY = this.y;
      this.time = this.phase;

      // Trigger platform parameters
      this.isTriggered = false;
      this.triggerDelay = data.triggerDelay || 0.1; // small delay after land before moving
      this.triggerTimer = 0;

      // Flag if this platform triggers the final bridge
      this.isBridgeTrigger = !!data.isBridgeTrigger;
    }

    update(dt) {
      this.prevX = this.x;
      this.prevY = this.y;

      if (this.type === 'moving') {
        this.time += dt * this.speed;
        if (this.moveY !== 0) {
          // Subtract sin so positive moveY lifts upward initially
          this.y = this.initialY - Math.sin(this.time) * this.moveY;
        }
        if (this.moveX !== 0) {
          this.x = this.initialX + Math.sin(this.time) * this.moveX;
        }
      } else if (this.type === 'trigger') {
        if (this.isTriggered) {
          if (this.triggerTimer < this.triggerDelay) {
            this.triggerTimer += dt;
          } else {
            this.time += dt * this.speed;
            if (this.moveY !== 0) {
              // Smooth up and down motion, starting upward
              this.y = this.initialY - Math.sin(this.time) * this.moveY;
            }
            if (this.moveX !== 0) {
              this.x = this.initialX + Math.sin(this.time) * this.moveX;
            }
          }
        }
      }

      this.dx = this.x - this.prevX;
      this.dy = this.y - this.prevY;
    }

    onPlayerLand() {
      if (this.type === 'trigger' && !this.isTriggered) {
        this.isTriggered = true;
        this.time = 0;
      }
    }

    draw(ctx) {
      ctx.save();

      // Platform styles based on type
      if (this.type === 'normal') {
        this.drawNormalBrick(ctx);
      } else if (this.type === 'moving') {
        this.drawMovingBrick(ctx);
      } else if (this.type === 'trigger') {
        this.drawTriggerBrick(ctx);
      }

      // Draw Bridge Activation Indicator if it's the bridge trigger platform
      if (this.isBridgeTrigger) {
        this.drawBridgeRune(ctx);
      }

      ctx.restore();
    }

    drawNormalBrick(ctx) {
      const brickW = 28;
      const brickH = 16;
      const cols = Math.ceil(this.width / brickW);
      const rows = Math.ceil(this.height / brickH);

      // Dark volcanic mortar backing
      ctx.fillStyle = '#2b1414';
      ctx.fillRect(this.x, this.y, this.width, this.height);

      // Draw individual brick courses with alternating offsets
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x, this.y, this.width, this.height);
      ctx.clip();

      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (brickW / 2);
        for (let c = -1; c < cols + 1; c++) {
          const bx = this.x + c * brickW + offset;
          const by = this.y + r * brickH;

          // Main brick color
          ctx.fillStyle = '#a04030';
          ctx.fillRect(bx + 1, by + 1, brickW - 2, brickH - 2);

          // Brick top highlight
          ctx.fillStyle = '#c85a48';
          ctx.fillRect(bx + 1, by + 1, brickW - 2, 2);

          // Brick bottom shadow
          ctx.fillStyle = '#5c1e14';
          ctx.fillRect(bx + 1, by + brickH - 3, brickW - 2, 2);
        }
      }
      ctx.restore();

      // Solid stone top cap
      ctx.fillStyle = '#503530';
      ctx.fillRect(this.x, this.y, this.width, 4);
      ctx.fillStyle = '#8d5d54';
      ctx.fillRect(this.x, this.y, this.width, 2);

      // Platform border outline
      ctx.strokeStyle = '#1d0c0c';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    drawMovingBrick(ctx) {
      this.drawNormalBrick(ctx);

      // Bronze/Gold edge trims
      ctx.strokeStyle = '#ffa726';
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);

      // Center glowing power crystal / indicator
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;

      // Glow circle
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Motion arrows (up and down indicator)
      ctx.fillStyle = '#fff';
      // Up arrow
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 11);
      ctx.lineTo(centerX - 4, centerY - 6);
      ctx.lineTo(centerX + 4, centerY - 6);
      ctx.fill();
      // Down arrow
      ctx.beginPath();
      ctx.moveTo(centerX, centerY + 11);
      ctx.lineTo(centerX - 4, centerY + 6);
      ctx.lineTo(centerX + 4, centerY + 6);
      ctx.fill();
    }

    drawTriggerBrick(ctx) {
      ctx.fillStyle = '#1c151e';
      ctx.fillRect(this.x, this.y, this.width, this.height);

      // Distinct ruby bricks
      const brickW = 24;
      const brickH = 14;
      const cols = Math.ceil(this.width / brickW);
      const rows = Math.ceil(this.height / brickH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x, this.y, this.width, this.height);
      ctx.clip();

      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (brickW / 2);
        for (let c = -1; c < cols + 1; c++) {
          const bx = this.x + c * brickW + offset;
          const by = this.y + r * brickH;

          ctx.fillStyle = this.isTriggered ? '#b71c1c' : '#4a1525';
          ctx.fillRect(bx + 1, by + 1, brickW - 2, brickH - 2);

          ctx.fillStyle = this.isTriggered ? '#ff5252' : '#79243b';
          ctx.fillRect(bx + 1, by + 1, brickW - 2, 2);
        }
      }
      ctx.restore();

      // Glowing trigger rune on top
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;

      const pulse = this.isTriggered
        ? 0.8 + 0.2 * Math.sin(this.time * 10)
        : 0.5 + 0.3 * Math.sin(Date.now() * 0.005);

      ctx.strokeStyle = `rgba(255, 64, 129, ${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);

      // Center rune icon
      ctx.fillStyle = this.isTriggered ? '#ffeb3b' : '#ff4081';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 8);
      ctx.lineTo(centerX + 7, centerY);
      ctx.lineTo(centerX, centerY + 8);
      ctx.lineTo(centerX - 7, centerY);
      ctx.closePath();
      ctx.fill();
    }

    drawBridgeRune(ctx) {
      // Golden beacon gear / marker showing this brick extends the bridge
      const bx = this.x + this.width - 20;
      const by = this.y - 12;

      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff8f00';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', bx, by);
    }
  }

  // ==========================================================================
  // 7. THE GREAT GATE (Level Exit)
  // ==========================================================================
  class Gate {
    constructor(data) {
      this.x = data.x;
      this.y = data.y;
      this.width = data.width || 70;
      this.height = data.height || 110;
      this.portalAngle = 0;
    }

    update(dt) {
      this.portalAngle += dt * 2.5;
    }

    draw(ctx) {
      ctx.save();

      // Stone Pillars & Arch
      const pillarW = 16;
      const archH = 26;

      // Left Pillar
      ctx.fillStyle = '#37474f';
      ctx.fillRect(this.x, this.y, pillarW, this.height);
      ctx.fillStyle = '#546e7a';
      ctx.fillRect(this.x + 2, this.y, pillarW - 4, this.height);

      // Right Pillar
      ctx.fillStyle = '#37474f';
      ctx.fillRect(this.x + this.width - pillarW, this.y, pillarW, this.height);
      ctx.fillStyle = '#546e7a';
      ctx.fillRect(this.x + this.width - pillarW + 2, this.y, pillarW - 4, this.height);

      // Top Arch Beam
      ctx.fillStyle = '#263238';
      ctx.fillRect(this.x - 6, this.y - 8, this.width + 12, archH);
      ctx.fillStyle = '#455a64';
      ctx.fillRect(this.x - 4, this.y - 6, this.width + 8, archH - 6);

      // Arch Keystone (Gold Emblem)
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + 4, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff8f00';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Portal Interior (Swirling Mystical Vortex)
      const portalX = this.x + pillarW;
      const portalY = this.y + archH - 8;
      const portalW = this.width - pillarW * 2;
      const portalH = this.height - archH + 8;

      ctx.save();
      ctx.beginPath();
      ctx.rect(portalX, portalY, portalW, portalH);
      ctx.clip();

      // Portal background
      ctx.fillStyle = '#0d0221';
      ctx.fillRect(portalX, portalY, portalW, portalH);

      // Swirling portal vortex
      const pCenterX = portalX + portalW / 2;
      const pCenterY = portalY + portalH / 2;

      for (let i = 0; i < 4; i++) {
        const radius = (portalW * 0.45) * (1 - i * 0.22);
        const grad = ctx.createLinearGradient(
          pCenterX - radius, pCenterY - radius,
          pCenterX + radius, pCenterY + radius
        );
        grad.addColorStop(0, '#7b1fa2');
        grad.addColorStop(0.5, '#00e5ff');
        grad.addColorStop(1, '#ff4081');

        ctx.save();
        ctx.translate(pCenterX, pCenterY);
        ctx.rotate(this.portalAngle * (i % 2 === 0 ? 1 : -1) + i * 0.8);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius, radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      // Torches on Left & Right Pillars
      this.drawTorch(ctx, this.x - 4, this.y + 35);
      this.drawTorch(ctx, this.x + this.width - 8, this.y + 35);

      ctx.restore();
    }

    drawTorch(ctx, tx, ty) {
      ctx.fillStyle = '#212121';
      ctx.fillRect(tx, ty, 12, 16);

      const flicker = Math.sin(Date.now() * 0.02 + tx) * 3;
      const flameH = 14 + flicker;

      // Outer orange flame
      ctx.fillStyle = '#ff5722';
      ctx.beginPath();
      ctx.moveTo(tx + 2, ty);
      ctx.quadraticCurveTo(tx - 3, ty - flameH * 0.6, tx + 6, ty - flameH);
      ctx.quadraticCurveTo(tx + 15, ty - flameH * 0.6, tx + 10, ty);
      ctx.fill();

      // Inner yellow flame
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.moveTo(tx + 4, ty);
      ctx.quadraticCurveTo(tx + 1, ty - flameH * 0.5, tx + 6, ty - flameH * 0.75);
      ctx.quadraticCurveTo(tx + 11, ty - flameH * 0.5, tx + 8, ty);
      ctx.fill();
    }
  }

  // ==========================================================================
  // 8. PLAYER CHARACTER (Mario-Style Canvas Procedural Sprite)
  // ==========================================================================
  class Player {
    constructor(x, y) {
      this.spawnX = x;
      this.spawnY = y;
      this.x = x;
      this.y = y;
      this.width = 28;
      this.height = 42;

      this.prevX = x;
      this.prevY = y;

      this.vx = 0;
      this.vy = 0;
      this.facing = 1; // 1 = right, -1 = left

      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.ridingPlatform = null;

      this.animTime = 0;
      this.isDead = false;
    }

    reset(x = this.spawnX, y = this.spawnY) {
      this.x = x;
      this.y = y;
      this.prevX = x;
      this.prevY = y;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.ridingPlatform = null;
      this.animTime = 0;
      this.isDead = false;
    }

    update(dt, input, platforms, bridge, particles, levelWidth) {
      if (this.isDead) return;

      // 1. Horizontal Movement Input
      let moveDir = 0;
      if (input.keys.left) moveDir -= 1;
      if (input.keys.right) moveDir += 1;

      if (moveDir !== 0) {
        this.facing = moveDir;
        this.vx += moveDir * ACCELERATION * dt;
        if (Math.abs(this.vx) > MOVE_SPEED) {
          this.vx = moveDir * MOVE_SPEED;
        }
        this.animTime += dt * 14;

        // Running dust particles
        if (this.isGrounded && Math.random() < 0.25) {
          particles.addDust(this.x + this.width / 2, this.y + this.height);
        }
      } else {
        // Friction deceleration
        if (this.vx > 0) {
          this.vx = Math.max(0, this.vx - FRICTION * dt);
        } else if (this.vx < 0) {
          this.vx = Math.min(0, this.vx + FRICTION * dt);
        }
        this.animTime = 0;
      }

      // 2. Platform Riding Displacement
      // Follow the moving platform under the player
      if (this.isGrounded && this.ridingPlatform) {
        this.x += this.ridingPlatform.dx;
        this.y += this.ridingPlatform.dy;
      }

      // 3. Jump Input Buffering & Coyote Time
      if (input.consumeJump()) {
        this.jumpBufferTimer = JUMP_BUFFER;
      } else if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer -= dt;
      }

      if (this.isGrounded) {
        this.coyoteTimer = COYOTE_TIME;
      } else {
        this.coyoteTimer -= dt;
      }

      // Execute jump
      if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
        this.vy = JUMP_VELOCITY;
        this.isGrounded = false;
        this.ridingPlatform = null;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        audio.playJump();
        particles.addDust(this.x + this.width / 2, this.y + this.height);
      }

      // Variable jump height: cut jump short if button released early
      if (!input.keys.jump && this.vy < MIN_JUMP_VELOCITY) {
        this.vy = MIN_JUMP_VELOCITY;
      }

      // 4. Apply Gravity
      this.vy += GRAVITY * dt;
      if (this.vy > 900) {
        this.vy = 900; // Terminal velocity
      }

      // 5. Physics Collision Resolution
      const allSolids = [...platforms, ...bridge.getActivePlanks()];

      // Horizontal Step & Collision Resolution
      this.prevX = this.x;
      this.x += this.vx * dt;
      this.resolveHorizontalCollisions(allSolids);

      // Clamp to level boundaries
      if (this.x < 0) {
        this.x = 0;
        this.vx = 0;
      } else if (this.x + this.width > levelWidth) {
        this.x = levelWidth - this.width;
        this.vx = 0;
      }

      // Vertical Step & Collision Resolution
      const wasGrounded = this.isGrounded;
      this.prevY = this.y;
      this.isGrounded = false;
      this.ridingPlatform = null;

      this.y += this.vy * dt;
      this.resolveVerticalCollisions(allSolids);

      // Landing sound effect
      if (!wasGrounded && this.isGrounded) {
        audio.playLand();
        particles.addDust(this.x + this.width / 2, this.y + this.height);
      }

      // 6. Check Trigger for Final Bridge Extension
      for (const plat of platforms) {
        if (plat.isBridgeTrigger && this.x + this.width >= plat.x) {
          bridge.trigger();
        }
      }

      // 7. Check Lava Collision
      if (this.y + this.height >= LAVA_SURFACE_Y + 12) {
        this.kill(particles);
      }
    }

    resolveHorizontalCollisions(solids) {
      for (const solid of solids) {
        if (this.isColliding(this, solid)) {
          // Approach check based on previous position
          if (this.prevX + this.width <= solid.x + 8) {
            // Moving right, hit left edge of platform
            this.x = solid.x - this.width;
            this.vx = 0;
          } else if (this.prevX >= solid.x + solid.width - 8) {
            // Moving left, hit right edge of platform
            this.x = solid.x + solid.width;
            this.vx = 0;
          }
        }
      }
    }

    resolveVerticalCollisions(solids) {
      for (const solid of solids) {
        if (this.isColliding(this, solid)) {
          // Approach check: approached from top vs approached from bottom
          if (this.prevY + this.height <= solid.y + 14 && this.vy >= 0) {
            // Landing on top of platform
            this.y = solid.y - this.height;
            this.vy = 0;
            this.isGrounded = true;

            if (solid instanceof Platform) {
              this.ridingPlatform = solid;
              solid.onPlayerLand();
            } else {
              // Stood on active bridge plank
              this.ridingPlatform = null;
            }
          } else if (this.prevY >= solid.y + solid.height - 14 && this.vy < 0) {
            // Bumped ceiling
            this.y = solid.y + solid.height;
            this.vy = 0;
          }
        }
      }
    }

    isColliding(a, b) {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      );
    }

    kill(particles) {
      if (this.isDead) return;
      this.isDead = true;
      audio.playDeath();
      particles.addLavaSplash(this.x + this.width / 2, LAVA_SURFACE_Y);
      triggerScreenFlash('flash-red');
    }

    draw(ctx) {
      if (this.isDead) return;

      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.scale(this.facing, 1); // Flip horizontally when moving left

      const w = this.width;
      const h = this.height;

      // Running walk cycle calculation
      const isRunning = this.isGrounded && Math.abs(this.vx) > 10;
      const isJumping = !this.isGrounded;
      const legPhase = isRunning ? Math.sin(this.animTime) : 0;
      const armPhase = isRunning ? Math.cos(this.animTime) : 0;

      // 1. BOOTS / LEGS
      ctx.fillStyle = '#4e342e'; // Dark brown boots
      if (isJumping) {
        ctx.fillRect(-w * 0.45, h * 0.28, w * 0.4, h * 0.18);
        ctx.fillRect(w * 0.05, h * 0.2, w * 0.4, h * 0.18);
      } else {
        const leftLegY = h * 0.28 + legPhase * 4;
        const rightLegY = h * 0.28 - legPhase * 4;
        ctx.fillRect(-w * 0.42, leftLegY, w * 0.38, h * 0.2);
        ctx.fillRect(w * 0.05, rightLegY, w * 0.38, h * 0.2);
      }

      // 2. BLUE OVERALLS (Dungarees)
      ctx.fillStyle = '#1976d2'; // Classic blue
      ctx.fillRect(-w * 0.42, -h * 0.05, w * 0.84, h * 0.35);

      // Overall suspender straps
      ctx.fillStyle = '#0d47a1';
      ctx.fillRect(-w * 0.38, -h * 0.12, w * 0.22, h * 0.2);
      ctx.fillRect(w * 0.16, -h * 0.12, w * 0.22, h * 0.2);

      // Yellow brass buttons
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(-w * 0.27, -h * 0.02, 2.2, 0, Math.PI * 2);
      ctx.arc(w * 0.27, -h * 0.02, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 3. RED SHIRT (Torso & Arms)
      ctx.fillStyle = '#d32f2f'; // Mario red
      ctx.fillRect(-w * 0.35, -h * 0.18, w * 0.7, h * 0.16);

      // Arms
      if (isJumping) {
        // Triumph pose: front arm raised high, back arm down
        ctx.fillStyle = '#d32f2f';
        ctx.fillRect(w * 0.15, -h * 0.42, w * 0.26, h * 0.3); // raised arm
        ctx.fillRect(-w * 0.44, -h * 0.1, w * 0.24, h * 0.25); // lowered arm

        // White gloves
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(w * 0.28, -h * 0.42, 4.5, 0, Math.PI * 2); // raised fist
        ctx.arc(-w * 0.32, h * 0.14, 4, 0, Math.PI * 2); // lower hand
        ctx.fill();
      } else {
        // Swinging arms during run / idle
        const leftArmY = -h * 0.12 + armPhase * 4;
        const rightArmY = -h * 0.12 - armPhase * 4;

        ctx.fillStyle = '#d32f2f';
        ctx.fillRect(-w * 0.45, leftArmY, w * 0.22, h * 0.26);
        ctx.fillRect(w * 0.23, rightArmY, w * 0.22, h * 0.26);

        // White gloves
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-w * 0.34, leftArmY + h * 0.24, 4, 0, Math.PI * 2);
        ctx.arc(w * 0.34, rightArmY + h * 0.24, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. HEAD & FACE
      // Peachy skin tone
      ctx.fillStyle = '#ffcc80';
      ctx.fillRect(-w * 0.32, -h * 0.36, w * 0.64, h * 0.24);

      // Big Round Nose
      ctx.fillStyle = '#ffb74d';
      ctx.beginPath();
      ctx.arc(w * 0.2, -h * 0.25, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Big Bushy Mustache
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(w * 0.05, -h * 0.22, w * 0.35, 4);
      ctx.beginPath();
      ctx.arc(w * 0.22, -h * 0.2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#212121';
      ctx.fillRect(w * 0.08, -h * 0.32, 3.5, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w * 0.09, -h * 0.32, 1.5, 2);

      // Brown Hair at back of head
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(-w * 0.38, -h * 0.34, w * 0.18, h * 0.16);

      // 5. RED CAP
      ctx.fillStyle = '#d32f2f';
      // Cap Crown
      ctx.beginPath();
      ctx.arc(0, -h * 0.36, w * 0.44, Math.PI, 0, false);
      ctx.fill();
      // Cap Visor / Brim
      ctx.fillRect(-w * 0.2, -h * 0.38, w * 0.65, 4);

      // Cap Emblem (Gold 'M')
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-w * 0.04, -h * 0.42, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d32f2f';
      ctx.font = 'bold 5px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', -w * 0.04, -h * 0.41);

      ctx.restore();
    }
  }

  // ==========================================================================
  // 9. LEVEL DEFINITIONS (3 Progressively Difficult Levels)
  // ==========================================================================
  const LEVEL_DATA = [
    // ------------------------------------------------------------------------
    // LEVEL 1: "The Molten Caverns" (Introductory)
    // ------------------------------------------------------------------------
    {
      name: "The Molten Caverns",
      width: 2200,
      spawn: { x: 100, y: 340 },
      platforms: [
        // Safe starting platforms
        { x: 50, y: 400, width: 220, height: 40, type: 'normal' },
        { x: 330, y: 380, width: 140, height: 40, type: 'normal' },
        { x: 530, y: 350, width: 130, height: 40, type: 'normal' },

        // Gentle continuously moving platform
        { x: 730, y: 340, width: 110, height: 36, type: 'moving', moveY: 65, speed: 1.8 },

        // Mid-way solid brick
        { x: 910, y: 320, width: 150, height: 40, type: 'normal' },

        // Trigger platform: starts moving up & down once landed on!
        { x: 1130, y: 330, width: 110, height: 36, type: 'trigger', moveY: 70, speed: 2.2 },

        // High stone ledge
        { x: 1310, y: 250, width: 140, height: 40, type: 'normal' },

        // Descent platform
        { x: 1510, y: 320, width: 120, height: 40, type: 'normal' },

        // Final Brick before gap (Triggers Bridge!)
        { x: 1690, y: 350, width: 130, height: 40, type: 'normal', isBridgeTrigger: true },

        // Gate Platform across the final gap
        { x: 2040, y: 350, width: 150, height: 40, type: 'normal' }
      ],
      bridge: {
        triggerX: 1690,
        startX: 1820,
        endX: 2040,
        y: 350,
        totalPlanks: 9,
        plankInterval: 0.13
      },
      gate: { x: 2090, y: 240, width: 70, height: 110 }
    },

    // ------------------------------------------------------------------------
    // LEVEL 2: "Magma Chambers" (Intermediate challenge)
    // ------------------------------------------------------------------------
    {
      name: "Magma Chambers",
      width: 2700,
      spawn: { x: 80, y: 340 },
      platforms: [
        // Start platform
        { x: 40, y: 400, width: 180, height: 40, type: 'normal' },

        // Faster moving platforms over wider lava gaps
        { x: 280, y: 370, width: 100, height: 36, type: 'moving', moveY: 75, speed: 2.3, phase: 0 },
        { x: 440, y: 330, width: 100, height: 36, type: 'moving', moveY: 80, speed: 2.4, phase: Math.PI },

        // Stepping stone
        { x: 600, y: 360, width: 120, height: 40, type: 'normal' },

        // Trigger platform that carries player up to high route
        { x: 790, y: 380, width: 100, height: 36, type: 'trigger', moveY: 100, speed: 2.5 },

        // High ledge
        { x: 960, y: 270, width: 130, height: 40, type: 'normal' },

        // Long jump stepping stones
        { x: 1160, y: 300, width: 90, height: 36, type: 'normal' },
        { x: 1320, y: 350, width: 90, height: 36, type: 'moving', moveY: 60, speed: 2.6 },
        { x: 1480, y: 310, width: 90, height: 36, type: 'trigger', moveY: 85, speed: 2.8 },

        // Mid resting island
        { x: 1640, y: 260, width: 140, height: 40, type: 'normal' },

        // Moving bricks combo
        { x: 1850, y: 320, width: 100, height: 36, type: 'moving', moveY: 90, speed: 2.5, phase: 0.5 },
        { x: 2020, y: 350, width: 100, height: 36, type: 'trigger', moveY: 70, speed: 3.0 },

        // Final Brick before gap (Triggers Bridge!)
        { x: 2190, y: 340, width: 120, height: 40, type: 'normal', isBridgeTrigger: true },

        // Gate Platform
        { x: 2540, y: 340, width: 150, height: 40, type: 'normal' }
      ],
      bridge: {
        triggerX: 2190,
        startX: 2310,
        endX: 2540,
        y: 340,
        totalPlanks: 11,
        plankInterval: 0.11
      },
      gate: { x: 2590, y: 230, width: 70, height: 110 }
    },

    // ------------------------------------------------------------------------
    // LEVEL 3: "Heart of the Volcano" (Master Trial)
    // ------------------------------------------------------------------------
    {
      name: "Heart of the Volcano",
      width: 3300,
      spawn: { x: 80, y: 330 },
      platforms: [
        // Start platform
        { x: 40, y: 390, width: 150, height: 40, type: 'normal' },

        // Tight stepping bricks
        { x: 250, y: 370, width: 80, height: 36, type: 'normal' },
        { x: 390, y: 330, width: 90, height: 36, type: 'moving', moveY: 90, speed: 2.8, phase: 0 },
        { x: 550, y: 290, width: 80, height: 36, type: 'trigger', moveY: 80, speed: 3.0 },

        // High perch
        { x: 700, y: 220, width: 110, height: 40, type: 'normal' },

        // Deep drop jump onto rapid moving platform
        { x: 880, y: 380, width: 90, height: 36, type: 'moving', moveY: 95, speed: 3.2, phase: 1.2 },
        { x: 1040, y: 330, width: 90, height: 36, type: 'moving', moveY: 85, speed: 3.0, phase: 3.0 },

        // Narrow bridgehead
        { x: 1200, y: 300, width: 90, height: 40, type: 'normal' },

        // Chain of trigger bricks: step and keep moving!
        { x: 1360, y: 320, width: 85, height: 36, type: 'trigger', moveY: 90, speed: 3.4 },
        { x: 1515, y: 300, width: 85, height: 36, type: 'trigger', moveY: 85, speed: 3.4 },
        { x: 1670, y: 270, width: 90, height: 36, type: 'normal' },

        // Synchronized moving duo
        { x: 1830, y: 330, width: 80, height: 36, type: 'moving', moveY: 95, speed: 3.0, phase: 0 },
        { x: 1980, y: 330, width: 80, height: 36, type: 'moving', moveY: 95, speed: 3.0, phase: Math.PI },
        { x: 2130, y: 260, width: 110, height: 40, type: 'normal' },

        // Final gauntlet
        { x: 2310, y: 340, width: 80, height: 36, type: 'trigger', moveY: 90, speed: 3.5 },
        { x: 2460, y: 360, width: 80, height: 36, type: 'moving', moveY: 80, speed: 3.2 },
        { x: 2610, y: 310, width: 90, height: 36, type: 'trigger', moveY: 75, speed: 3.5 },

        // Final Brick before gap (Triggers Grand Bridge!)
        { x: 2770, y: 330, width: 120, height: 40, type: 'normal', isBridgeTrigger: true },

        // The Gate of Victory Platform
        { x: 3140, y: 330, width: 150, height: 40, type: 'normal' }
      ],
      bridge: {
        triggerX: 2770,
        startX: 2890,
        endX: 3140,
        y: 330,
        totalPlanks: 13,
        plankInterval: 0.10
      },
      gate: { x: 3190, y: 220, width: 70, height: 110 }
    }
  ];

  // ==========================================================================
  // 10. BACKGROUND & LAVA RENDERERS
  // ==========================================================================
  let lavaWaveTime = 0;

  function drawBackground(ctx, cameraX, levelWidth) {
    // 1. Volcanic Cavern Gradient Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
    skyGrad.addColorStop(0, '#150914');
    skyGrad.addColorStop(0.4, '#2d0f19');
    skyGrad.addColorStop(0.75, '#5c1417');
    skyGrad.addColorStop(1, '#ff3d00');

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Distant Jagged Volcano Mountain Silhouettes (Parallax factor 0.15)
    ctx.save();
    const paraX1 = cameraX * 0.15;
    ctx.fillStyle = '#200b14';
    ctx.beginPath();
    ctx.moveTo(0, VIRTUAL_HEIGHT);

    for (let x = 0; x <= VIRTUAL_WIDTH + 60; x += 50) {
      const worldX = x + paraX1;
      const peak = Math.sin(worldX * 0.005) * 80 + Math.cos(worldX * 0.012) * 45;
      ctx.lineTo(x, 340 - peak);
    }
    ctx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // 3. Middle-ground Basalt Pillars & Stalactites (Parallax factor 0.35)
    const paraX2 = cameraX * 0.35;
    ctx.fillStyle = '#2e121a';

    // Hanging stalactites from ceiling
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= VIRTUAL_WIDTH + 80; x += 60) {
      const worldX = x + paraX2;
      const spike = Math.abs(Math.sin(worldX * 0.02)) * 65 + Math.cos(worldX * 0.008) * 25;
      ctx.lineTo(x, spike);
    }
    ctx.lineTo(VIRTUAL_WIDTH, 0);
    ctx.closePath();
    ctx.fill();

    // Glowing basalt silhouettes near lava
    ctx.fillStyle = 'rgba(74, 20, 24, 0.6)';
    ctx.beginPath();
    ctx.moveTo(0, VIRTUAL_HEIGHT);
    for (let x = 0; x <= VIRTUAL_WIDTH + 40; x += 40) {
      const worldX = x + paraX2;
      const rock = Math.sin(worldX * 0.015) * 40;
      ctx.lineTo(x, 430 - rock);
    }
    ctx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawAnimatedLava(ctx, cameraX, dt) {
    lavaWaveTime += dt * 3.5;

    ctx.save();

    // Ambient heat glow above the lava
    const heatGlow = ctx.createLinearGradient(0, LAVA_SURFACE_Y - 80, 0, LAVA_SURFACE_Y);
    heatGlow.addColorStop(0, 'rgba(255, 61, 0, 0)');
    heatGlow.addColorStop(1, 'rgba(255, 109, 0, 0.45)');
    ctx.fillStyle = heatGlow;
    ctx.fillRect(0, LAVA_SURFACE_Y - 80, VIRTUAL_WIDTH, 80);

    // Deep fiery base fill
    ctx.fillStyle = '#bf360c';
    ctx.fillRect(0, LAVA_SURFACE_Y + 10, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - LAVA_SURFACE_Y);

    // Wave 1: Deep Crimson Wave (back)
    ctx.fillStyle = '#d84315';
    ctx.beginPath();
    ctx.moveTo(0, VIRTUAL_HEIGHT);
    for (let screenX = 0; screenX <= VIRTUAL_WIDTH + 20; screenX += 20) {
      const worldX = screenX + cameraX;
      const waveY = LAVA_SURFACE_Y + Math.sin(worldX * 0.02 + lavaWaveTime * 0.8) * 8;
      ctx.lineTo(screenX, waveY);
    }
    ctx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Wave 2: Fiery Bright Orange Wave (middle)
    ctx.fillStyle = '#ff5722';
    ctx.beginPath();
    ctx.moveTo(0, VIRTUAL_HEIGHT);
    for (let screenX = 0; screenX <= VIRTUAL_WIDTH + 20; screenX += 20) {
      const worldX = screenX + cameraX;
      const waveY = LAVA_SURFACE_Y + Math.sin(worldX * 0.035 - lavaWaveTime * 1.2) * 6 + 3;
      ctx.lineTo(screenX, waveY);
    }
    ctx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Wave 3: Golden Molten Crest (surface crest)
    ctx.fillStyle = '#ffab00';
    ctx.beginPath();
    ctx.moveTo(0, VIRTUAL_HEIGHT);
    for (let screenX = 0; screenX <= VIRTUAL_WIDTH + 15; screenX += 15) {
      const worldX = screenX + cameraX;
      const waveY = LAVA_SURFACE_Y + Math.sin(worldX * 0.05 + lavaWaveTime * 1.5) * 4 + 6;
      ctx.lineTo(screenX, waveY);
    }
    ctx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Glowing White-Yellow Specular Highlights on top foam
    ctx.fillStyle = '#fff9c4';
    for (let screenX = 10; screenX <= VIRTUAL_WIDTH; screenX += 35) {
      const worldX = screenX + cameraX;
      const waveY = LAVA_SURFACE_Y + Math.sin(worldX * 0.05 + lavaWaveTime * 1.5) * 4 + 6;
      ctx.fillRect(screenX, waveY - 1, 14, 2);
    }

    ctx.restore();
  }

  // ==========================================================================
  // 11. SCREEN FLASH & UI HELPERS
  // ==========================================================================
  const flashEl = document.getElementById('screen-flash');
  function triggerScreenFlash(cssClass = 'flash-red', duration = 180) {
    if (!flashEl) return;
    flashEl.className = `screen-flash ${cssClass}`;
    setTimeout(() => {
      flashEl.className = 'screen-flash';
    }, duration);
  }

  const soundBtn = document.getElementById('btn-sound');
  const soundIcon = document.getElementById('sound-icon');
  function toggleSound() {
    const isEnabled = audio.toggle();
    if (soundIcon) {
      soundIcon.textContent = isEnabled ? '🔊' : '🔇';
    }
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', toggleSound);
  }

  // ==========================================================================
  // 12. MAIN GAME ENGINE
  // ==========================================================================
  class GameEngine {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');

      this.input = new InputManager();
      this.particles = new ParticleSystem();

      this.currentLevelIndex = 0;
      this.deaths = 0;
      this.state = STATE.START;

      // Active level objects
      this.level = null;
      this.platforms = [];
      this.bridge = null;
      this.gate = null;
      this.player = null;

      // Camera
      this.cameraX = 0;

      // Timestep loop accumulator
      this.lastTime = 0;
      this.accumulator = 0;

      // UI Overlay Elements
      this.startScreen = document.getElementById('start-screen');
      this.levelCompleteScreen = document.getElementById('level-complete-screen');
      this.victoryScreen = document.getElementById('victory-screen');

      this.hudLevel = document.getElementById('hud-level');
      this.hudDeaths = document.getElementById('hud-deaths');
      this.hudTitle = document.getElementById('level-title');

      this.completeDeaths = document.getElementById('complete-deaths-count');
      this.finalDeaths = document.getElementById('final-deaths');

      this.initUIButtons();
      this.initLevel(this.currentLevelIndex);
      this.updateHUD();
    }

    initUIButtons() {
      // Start Game Button
      const btnStart = document.getElementById('btn-start');
      if (btnStart) {
        btnStart.addEventListener('click', () => {
          audio.init();
          this.startGame();
        });
      }

      // Next Level Button
      const btnNext = document.getElementById('btn-next-level');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          audio.init();
          this.nextLevel();
        });
      }

      // Play Again Button
      const btnPlayAgain = document.getElementById('btn-play-again');
      if (btnPlayAgain) {
        btnPlayAgain.addEventListener('click', () => {
          audio.init();
          this.restartGame();
        });
      }

      // Restart Level HUD Button
      const btnRestart = document.getElementById('btn-restart');
      if (btnRestart) {
        btnRestart.addEventListener('click', () => {
          audio.init();
          this.restartLevel();
        });
      }
    }

    startGame() {
      this.state = STATE.PLAYING;
      this.startScreen.classList.remove('active');
      this.startScreen.classList.add('hidden');
      this.resetPlayerToSpawn();
    }

    nextLevel() {
      this.levelCompleteScreen.classList.remove('active');
      this.levelCompleteScreen.classList.add('hidden');

      this.currentLevelIndex++;
      if (this.currentLevelIndex >= LEVEL_DATA.length) {
        this.showVictory();
      } else {
        this.initLevel(this.currentLevelIndex);
        this.state = STATE.PLAYING;
      }
    }

    restartLevel() {
      this.deaths++;
      this.updateHUD();
      this.initLevel(this.currentLevelIndex);
      this.state = STATE.PLAYING;
    }

    restartGame() {
      this.victoryScreen.classList.remove('active');
      this.victoryScreen.classList.add('hidden');
      this.currentLevelIndex = 0;
      this.deaths = 0;
      this.updateHUD();
      this.initLevel(0);
      this.state = STATE.PLAYING;
    }

    showLevelComplete() {
      this.state = STATE.LEVEL_COMPLETE;
      audio.playLevelComplete();
      triggerScreenFlash('flash-white', 300);

      if (this.completeDeaths) {
        this.completeDeaths.textContent = this.deaths;
      }

      this.levelCompleteScreen.classList.remove('hidden');
      this.levelCompleteScreen.classList.add('active');
    }

    showVictory() {
      this.state = STATE.VICTORY;
      audio.playVictory();
      triggerScreenFlash('flash-white', 400);

      if (this.finalDeaths) {
        this.finalDeaths.textContent = this.deaths;
      }

      this.victoryScreen.classList.remove('hidden');
      this.victoryScreen.classList.add('active');

      // Victory Confetti
      for (let i = 0; i < 60; i++) {
        this.particles.addSparkles(
          this.cameraX + Math.random() * VIRTUAL_WIDTH,
          Math.random() * (VIRTUAL_HEIGHT * 0.7),
          5,
          ['#ffd700', '#00e5ff', '#ff4081', '#76ff03'][Math.floor(Math.random() * 4)]
        );
      }
    }

    initLevel(index) {
      const data = LEVEL_DATA[index];
      this.level = data;

      // Create platforms
      this.platforms = data.platforms.map(p => new Platform(p));

      // Create bridge
      this.bridge = new FinalBridge(data.bridge);

      // Create gate
      this.gate = new Gate(data.gate);

      // Create/Reset player
      if (!this.player) {
        this.player = new Player(data.spawn.x, data.spawn.y);
      } else {
        this.player.reset(data.spawn.x, data.spawn.y);
      }

      // Reset camera
      this.cameraX = 0;

      // Reset particles
      this.particles.reset();

      this.updateHUD();
    }

    resetPlayerToSpawn() {
      if (this.level && this.player) {
        this.player.reset(this.level.spawn.x, this.level.spawn.y);
      }
    }

    updateHUD() {
      if (this.hudLevel) this.hudLevel.textContent = this.currentLevelIndex + 1;
      if (this.hudDeaths) this.hudDeaths.textContent = this.deaths;
      if (this.hudTitle && this.level) this.hudTitle.textContent = this.level.name;
    }

    // ------------------------------------------------------------------------
    // FIXED TIMESTEP UPDATE LOOP
    // ------------------------------------------------------------------------
    update(dt) {
      // Handle ENTER shortcut for modals
      if (this.input.consumeEnter()) {
        if (this.state === STATE.START) {
          this.startGame();
          return;
        } else if (this.state === STATE.LEVEL_COMPLETE) {
          this.nextLevel();
          return;
        } else if (this.state === STATE.VICTORY) {
          this.restartGame();
          return;
        }
      }

      // Handle Quick Restart shortcut 'R'
      if (this.input.keys.restart && this.state === STATE.PLAYING) {
        this.restartLevel();
        this.input.keys.restart = false;
        return;
      }

      // If in menus, just keep ambient lava & gate animating
      if (this.state !== STATE.PLAYING) {
        if (this.gate) this.gate.update(dt);
        this.particles.update(dt, this.cameraX, VIRTUAL_WIDTH);
        return;
      }

      // 1. Update Platforms
      for (const plat of this.platforms) {
        plat.update(dt);
      }

      // 2. Update Bridge
      this.bridge.update(dt, this.particles);

      // 3. Update Gate
      this.gate.update(dt);

      // 4. Update Player
      this.player.update(dt, this.input, this.platforms, this.bridge, this.particles, this.level.width);

      // If player died, short delay and respawn level
      if (this.player.isDead) {
        this.deaths++;
        this.updateHUD();
        this.state = STATE.GAME_OVER;
        setTimeout(() => {
          this.initLevel(this.currentLevelIndex);
          this.state = STATE.PLAYING;
        }, 320);
        return;
      }

      // 5. Check Gate Collision (Win Condition)
      if (this.gate && this.player.isColliding(this.player, this.gate)) {
        if (this.currentLevelIndex >= LEVEL_DATA.length - 1) {
          this.showVictory();
        } else {
          this.showLevelComplete();
        }
        return;
      }

      // 6. Update Particles
      this.particles.update(dt, this.cameraX, VIRTUAL_WIDTH);

      // 7. Update Camera (Smooth Horizontal Tracking)
      const targetCameraX = this.player.x - VIRTUAL_WIDTH * 0.38;
      const maxCameraX = Math.max(0, this.level.width - VIRTUAL_WIDTH);
      this.cameraX += (targetCameraX - this.cameraX) * 0.12;
      this.cameraX = Math.max(0, Math.min(this.cameraX, maxCameraX));
    }

    // ------------------------------------------------------------------------
    // RENDER LOOP
    // ------------------------------------------------------------------------
    draw() {
      const ctx = this.ctx;

      // 1. Draw Parallax Volcano Background
      drawBackground(ctx, this.cameraX, this.level.width);

      // 2. World Camera Transform
      ctx.save();
      ctx.translate(-Math.round(this.cameraX), 0);

      // Draw Gate
      if (this.gate) {
        this.gate.draw(ctx);
      }

      // Draw Platforms
      for (const plat of this.platforms) {
        plat.draw(ctx);
      }

      // Draw Bridge Planks
      if (this.bridge) {
        this.bridge.draw(ctx);
      }

      // Draw Player
      if (this.player) {
        this.player.draw(ctx);
      }

      // Draw Particles in World Space
      this.particles.draw(ctx);

      ctx.restore();

      // 3. Draw Animated Lava in Screen Space (always visible at bottom)
      drawAnimatedLava(ctx, this.cameraX, FIXED_TIMESTEP);
    }

    // ------------------------------------------------------------------------
    // MAIN LOOP (requestAnimationFrame + Fixed Timestep Accumulator)
    // ------------------------------------------------------------------------
    startLoop() {
      const loop = (timestamp) => {
        if (!this.lastTime) this.lastTime = timestamp;
        let frameTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Prevent spiral of death on tab switch / lag
        if (frameTime > 0.1) {
          frameTime = 0.1;
        }

        this.accumulator += frameTime;
        while (this.accumulator >= FIXED_TIMESTEP) {
          this.update(FIXED_TIMESTEP);
          this.accumulator -= FIXED_TIMESTEP;
        }

        this.draw();
        requestAnimationFrame(loop);
      };

      requestAnimationFrame(loop);
    }
  }

  // ==========================================================================
  // 13. INITIALIZATION ON WINDOW LOAD
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    const game = new GameEngine();
    game.startLoop();
  });

})();
