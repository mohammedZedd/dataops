class SoundService {
  private ctx: AudioContext | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = localStorage.getItem('sound_enabled') !== 'false';
  }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setEnabled(v: boolean) { this.enabled = v; localStorage.setItem('sound_enabled', String(v)); }
  isEnabled() { return this.enabled; }

  private tone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine', delay = 0) {
    if (!this.enabled) return;
    try {
      const c = this.getCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime + delay);
      g.gain.setValueAtTime(gain, c.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
      o.start(c.currentTime + delay);
      o.stop(c.currentTime + delay + duration);
    } catch { /* browser policy */ }
  }

  playNotification() { this.tone(880, 0.3, 0.25); this.tone(660, 0.3, 0.2, 'sine', 0.1); }
  playMessageReceived() { this.tone(600, 0.2, 0.2); this.tone(800, 0.2, 0.2, 'sine', 0.12); }
  playMessageSent() { this.tone(400, 0.15, 0.12); this.tone(700, 0.15, 0.1, 'sine', 0.08); }
  playSuccess() { this.tone(523, 0.2, 0.15); this.tone(659, 0.2, 0.15, 'sine', 0.1); this.tone(784, 0.25, 0.15, 'sine', 0.2); }
  playError() { this.tone(300, 0.3, 0.1, 'sawtooth'); }
}

export const soundService = new SoundService();
