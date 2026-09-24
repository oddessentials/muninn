import { browser } from '$app/environment';

export const musicSource = '/audio/digging-moat-8bit.mp3';
export const musicTitle = 'Digging Moat, 8-bit loop';
const storageKey = 'music';
const toggleSelector = '[data-music-toggle]';

function remember(value: 'on' | null): void {
  try {
    if (value === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, value);
  } catch {
    return;
  }
}

function remembered(): boolean {
  try {
    return localStorage.getItem(storageKey) === 'on';
  } catch {
    return false;
  }
}

export class MusicState {
  playing = $state(false);
  armed = $state(false);
  private audio: HTMLAudioElement | null = null;
  private stopListening: (() => void) | null = null;

  start(): () => void {
    if (!browser || !remembered()) return () => {};
    this.armed = true;
    const resume = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(toggleSelector)) return;
      this.unlisten();
      void this.play();
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    this.stopListening = () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    return () => this.unlisten();
  }

  get on(): boolean {
    return this.playing || this.armed;
  }

  toggle(): void {
    if (this.on) this.stop();
    else void this.play();
  }

  async play(): Promise<void> {
    this.unlisten();
    try {
      await this.element().play();
      this.playing = true;
      this.armed = false;
      remember('on');
    } catch {
      this.playing = false;
      this.armed = false;
    }
  }

  stop(): void {
    this.unlisten();
    this.audio?.pause();
    this.playing = false;
    this.armed = false;
    remember(null);
  }

  private unlisten(): void {
    this.stopListening?.();
    this.stopListening = null;
  }

  private element(): HTMLAudioElement {
    if (!this.audio) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'none';
      audio.volume = 0.55;
      audio.src = musicSource;
      this.audio = audio;
    }
    return this.audio;
  }
}

export const music = new MusicState();
