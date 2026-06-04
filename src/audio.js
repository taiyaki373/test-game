class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlayingBgm = false;
    this.bgmTimer = null;
    this.bpm = 126;
    this.currentStep = 0;
    this.noiseBuffer = null;
    
    // Notes frequency mapping (C3 to B4)
    this.scale = {
      'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
      'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
      'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'G5': 783.99, 'A5': 880.00
    };

    // BGM track definitions: [Melody (16 steps), Bass (16 steps), Drums (16 steps: 1=kick, 2=snare, 0=none)]
    this.tracks = {
      stage1: {
        bpm: 125,
        melody: ['E4', 'G4', 'A4', null, 'A4', 'B4', 'C5', null, 'B4', 'G4', 'E4', null, 'D4', 'E4', null, null],
        bass:   ['E3', 'E3', 'G3', 'G3', 'A3', 'A3', 'A3', 'G3', 'E3', 'E3', 'D3', 'D3', 'E3', 'E3', 'B3', 'B3'],
        drums:  [1, 0, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 2]
      },
      stage2: {
        bpm: 135,
        melody: ['A4', 'C5', 'D5', 'E5', null, 'D5', 'C5', 'A4', 'G4', 'A4', null, 'A4', 'C5', 'G4', 'A4', null],
        bass:   ['A3', 'A3', 'C3', 'C3', 'D3', 'D3', 'E3', 'E3', 'G3', 'G3', 'A3', 'A3', 'A3', 'E3', 'A3', 'G3'],
        drums:  [1, 1, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 2, 2, 0]
      },
      stage3: {
        bpm: 145,
        melody: ['C5', null, 'G4', 'C5', 'D5', 'D#5', 'D5', 'C5', 'A#4', 'C5', null, 'G4', 'F4', 'G4', null, null],
        bass:   ['C3', 'C3', 'G3', 'C3', 'D3', 'D#3', 'D3', 'C3', 'A#2', 'C3', 'C3', 'G2', 'F2', 'G2', 'D2', 'G2'],
        drums:  [1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 2, 1, 2]
      },
      boss: {
        bpm: 155,
        melody: ['E4', 'F4', 'G#4', 'A4', 'B4', 'C5', 'D#5', 'E5', 'D#5', 'C5', 'B4', 'A4', 'G#4', 'F4', 'E4', null],
        bass:   ['E3', 'F3', 'E3', 'F3', 'E3', 'F3', 'E3', 'F3', 'E3', 'F3', 'E3', 'F3', 'E3', 'F3', 'E3', 'D3'],
        drums:  [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 2, 2]
      }
    };
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // Reduce default volume to 30%
    this.masterGain.connect(this.ctx.destination);
    
    // Create white noise buffer
    const bufferSize = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Plays a step in the sequencer
  playStep(track) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    
    const stepMelody = track.melody[this.currentStep];
    const stepBass = track.bass[this.currentStep];
    const stepDrum = track.drums[this.currentStep];
    const stepDuration = 60 / track.bpm / 2; // 8th note duration
    
    // 1. Melody
    if (stepMelody && this.scale[stepMelody]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle'; // Retro chiptune sound
      osc.frequency.setValueAtTime(this.scale[stepMelody], time);
      
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 0.9);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(time);
      osc.stop(time + stepDuration);
    }
    
    // 2. Bass
    if (stepBass && this.scale[stepBass]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth'; // Heavy bass
      osc.frequency.setValueAtTime(this.scale[stepBass] * 0.5, time); // 1 octave lower
      
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 0.9);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(time);
      osc.stop(time + stepDuration);
    }
    
    // 3. Drums (Percussion)
    if (stepDrum === 1) { // Kick
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
      
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(time);
      osc.stop(time + 0.15);
    } else if (stepDrum === 2) { // Snare (Noise snare)
      if (this.noiseBuffer) {
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        source.buffer = this.noiseBuffer;
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, time);
        
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        source.start(time);
        source.stop(time + 0.1);
      }
    }
    
    this.currentStep = (this.currentStep + 1) % 16;
  }

  startBGM(stageId) {
    this.init();
    this.resume();
    this.stopBGM();
    
    const track = this.tracks[stageId] || this.tracks.stage1;
    this.isPlayingBgm = true;
    this.currentStep = 0;
    
    const interval = (60 / track.bpm / 2) * 1000;
    this.bgmTimer = setInterval(() => {
      this.playStep(track);
    }, interval);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.isPlayingBgm = false;
  }

  playSFX(type) {
    this.init();
    this.resume();
    if (!this.ctx) return;
    
    const time = this.ctx.currentTime;
    
    switch (type) {
      case 'shoot': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, time);
        osc.frequency.exponentialRampToValueAtTime(200, time + 0.1);
        
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.1);
        break;
      }
      case 'laser': {
        // Continuous sci-fi beam sound
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(440, time);
        osc1.frequency.linearRampToValueAtTime(880, time + 0.15);
        
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(220, time);
        osc2.frequency.linearRampToValueAtTime(440, time + 0.15);
        
        gain.gain.setValueAtTime(0.08, time);
        gain.gain.setValueAtTime(0.08, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);
        
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.18);
        osc2.stop(time + 0.18);
        break;
      }
      case 'missile': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.exponentialRampToValueAtTime(600, time + 0.2);
        
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.22);
        break;
      }
      case 'hit': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, time);
        osc.frequency.setValueAtTime(100, time + 0.03);
        
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.05);
        break;
      }
      case 'kill': {
        // Standard enemy explosion
        if (this.noiseBuffer) {
          const source = this.ctx.createBufferSource();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          
          source.buffer = this.noiseBuffer;
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(400, time);
          filter.frequency.exponentialRampToValueAtTime(10, time + 0.3);
          
          gain.gain.setValueAtTime(0.25, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
          
          source.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain);
          
          source.start(time);
          source.stop(time + 0.3);
        }
        break;
      }
      case 'powerup_pickup': {
        // High pitch rising arpeggio
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, index) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time + index * 0.04);
          
          gain.gain.setValueAtTime(0.1, time + index * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, time + index * 0.04 + 0.08);
          
          osc.connect(gain);
          gain.connect(this.masterGain);
          
          osc.start(time + index * 0.04);
          osc.stop(time + index * 0.04 + 0.08);
        });
        break;
      }
      case 'powerup_activate': {
        // Energetic electronic trigger
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, time);
        osc.frequency.linearRampToValueAtTime(1200, time + 0.25);
        
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.25);
        break;
      }
      case 'player_death': {
        // Dramatic low pitch explosion
        if (this.noiseBuffer) {
          const source = this.ctx.createBufferSource();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          
          source.buffer = this.noiseBuffer;
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(200, time);
          filter.frequency.exponentialRampToValueAtTime(1, time + 1.2);
          
          gain.gain.setValueAtTime(0.5, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
          
          source.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain);
          
          source.start(time);
          source.stop(time + 1.2);
        }
        // Sub bass drop
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(100, time);
        subOsc.frequency.linearRampToValueAtTime(20, time + 1.0);
        subGain.gain.setValueAtTime(0.4, time);
        subGain.gain.exponentialRampToValueAtTime(0.001, time + 1.0);
        subOsc.connect(subGain);
        subGain.connect(this.masterGain);
        subOsc.start(time);
        subOsc.stop(time + 1.0);
        break;
      }
      case 'boss_death': {
        // Chain of explosions
        for (let i = 0; i < 8; i++) {
          const t = time + i * 0.15;
          const duration = 0.4;
          if (this.noiseBuffer) {
            const source = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            
            source.buffer = this.noiseBuffer;
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600 - i * 50, t);
            filter.frequency.exponentialRampToValueAtTime(10, t + duration);
            
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
            
            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            source.start(t);
            source.stop(t + duration);
          }
        }
        break;
      }
    }
  }
}

export default new AudioSynthesizer();
