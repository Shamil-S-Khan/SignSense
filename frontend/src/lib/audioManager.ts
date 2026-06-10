class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmVolumeNode: GainNode | null = null;
  private masterVolumeNode: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackNode: GainNode | null = null;
  private isMuted: boolean = false;
  private bgmVolume: number = 0.2; // default 20%
  private isPlayingBgm: boolean = false;
  private bgmTimer: ReturnType<typeof setTimeout> | null = null;
  private noteIndex: number = 0;

  // A minor pentatonic scale frequencies (A3, C4, D4, E4, G4, A4, C5)
  private readonly scale = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

  init() {
    if (this.ctx) return;

    interface WindowWithWebkitAudio extends Window {
      webkitAudioContext?: typeof AudioContext;
    }
    const customWindow = window as unknown as WindowWithWebkitAudio;
    const AudioContextClass = window.AudioContext || customWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.ctx = new AudioContextClass();
      
      // Master Gain
      this.masterVolumeNode = this.ctx.createGain();
      this.masterVolumeNode.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterVolumeNode.connect(this.ctx.destination);

      // BGM Gain
      this.bgmVolumeNode = this.ctx.createGain();
      this.bgmVolumeNode.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
      this.bgmVolumeNode.connect(this.masterVolumeNode);

      // Reverb / Delay feedback loop
      this.delayNode = this.ctx.createDelay(1.0);
      this.feedbackNode = this.ctx.createGain();

      this.delayNode.delayTime.setValueAtTime(0.4, this.ctx.currentTime); // ~72 BPM delay echo
      this.feedbackNode.gain.setValueAtTime(0.4, this.ctx.currentTime); // Echo decay rate

      // Connect delay loop: input -> delay -> feedback -> delay -> output
      this.delayNode.connect(this.feedbackNode);
      this.feedbackNode.connect(this.delayNode);
      this.delayNode.connect(this.masterVolumeNode); // Send echo to master output
    } catch (e) {
      console.error("Failed to initialize Web Audio context:", e);
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.ctx && this.masterVolumeNode) {
      const target = mute ? 0 : 1;
      this.masterVolumeNode.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.15);
    }
  }

  getMute() {
    return this.isMuted;
  }

  setBgmVolume(volume: number) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.bgmVolumeNode) {
      this.bgmVolumeNode.gain.linearRampToValueAtTime(this.bgmVolume, this.ctx.currentTime + 0.1);
    }
  }

  getBgmVolume() {
    return this.bgmVolume;
  }

  startBgm() {
    this.init();
    if (!this.ctx || this.isPlayingBgm) return;

    this.isPlayingBgm = true;
    this.noteIndex = 0;
    this.setBgmVolume(this.bgmVolume); // Ensure BGM volume matches setting

    const scheduleNextNote = () => {
      if (!this.isPlayingBgm || !this.ctx) return;

      const tempoBPM = 72;
      const beatSeconds = 60 / tempoBPM; // ~0.833s

      // Simple minor pentatonic arpeggiation patterns
      const patterns = [
        [0, 2, 4, 3, 5, 4, 2, 1],
        [0, 3, 5, 4, 6, 5, 3, 2],
        [2, 4, 6, 5, 4, 3, 2, 0]
      ];

      const currentPattern = patterns[Math.floor(this.noteIndex / 8) % patterns.length]!;
      const scaleDegree = currentPattern[this.noteIndex % 8]!;
      const freq = this.scale[scaleDegree]!;

      this.playSynthNote(freq, beatSeconds * 0.95);

      this.noteIndex++;
      this.bgmTimer = setTimeout(scheduleNextNote, beatSeconds * 1000);
    };

    scheduleNextNote();
  }

  stopBgm() {
    this.isPlayingBgm = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  fadeBgmOut(durationSeconds = 1.0) {
    if (this.ctx && this.bgmVolumeNode) {
      const now = this.ctx.currentTime;
      this.bgmVolumeNode.gain.setValueAtTime(this.bgmVolumeNode.gain.value, now);
      this.bgmVolumeNode.gain.linearRampToValueAtTime(0.001, now + durationSeconds);
    }
  }

  fadeBgmIn(durationSeconds = 1.0) {
    if (this.ctx && this.bgmVolumeNode) {
      const now = this.ctx.currentTime;
      this.bgmVolumeNode.gain.setValueAtTime(this.bgmVolumeNode.gain.value, now);
      this.bgmVolumeNode.gain.linearRampToValueAtTime(this.bgmVolume, now + durationSeconds);
    }
  }

  private isReducedMotion() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private playSynthNote(freq: number, duration: number) {
    if (this.isMuted || this.isReducedMotion() || !this.ctx || !this.bgmVolumeNode) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      // Soft triangle/sine blend for ambient arpeggio
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      gainNode.gain.setValueAtTime(0.06, now); // soft bgm notes
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gainNode);
      gainNode.connect(this.bgmVolumeNode);
      
      // Connect dry to delay feedback loop for echo depth
      if (this.delayNode) {
        gainNode.connect(this.delayNode);
      }

      osc.start(now);
      osc.stop(now + duration + 0.1);
    } catch (e) {
      console.warn("Failed to play arpeggiation note:", e);
    }
  }

  // --- Sound Effects ---

  playCorrect() {
    this.init();
    if (this.isMuted || this.isReducedMotion() || !this.ctx || !this.masterVolumeNode) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "sine";
      
      // Ascending bright double-tone
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gainNode);
      gainNode.connect(this.masterVolumeNode);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn("Failed to play correct chime:", e);
    }
  }

  playWrong() {
    this.init();
    if (this.isMuted || this.isReducedMotion() || !this.ctx || !this.masterVolumeNode) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "triangle";
      
      // Low sliding buzzer tone
      osc.frequency.setValueAtTime(130.81, now); // C3
      osc.frequency.linearRampToValueAtTime(80.0, now + 0.3); // Pitch slide down

      gainNode.gain.setValueAtTime(0.18, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gainNode);
      gainNode.connect(this.masterVolumeNode);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn("Failed to play wrong buzzer:", e);
    }
  }

  playTick() {
    this.init();
    if (this.isMuted || this.isReducedMotion() || !this.ctx || !this.masterVolumeNode) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1200.0, now); // High pitch tick

      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gainNode);
      gainNode.connect(this.masterVolumeNode);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn("Failed to play tick:", e);
    }
  }

  playFanfare() {
    this.init();
    if (this.isMuted || this.isReducedMotion() || !this.ctx || !this.masterVolumeNode) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gainNode = this.ctx!.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gainNode.gain.setValueAtTime(0.08, now + idx * 0.12);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6 + idx * 0.12);

        osc.connect(gainNode);
        gainNode.connect(this.masterVolumeNode!);

        osc.start(now + idx * 0.12);
        osc.stop(now + 0.7 + idx * 0.12);
      });
    } catch (e) {
      console.warn("Failed to play victory fanfare:", e);
    }
  }
}

export const audioManager = new AudioManager();
