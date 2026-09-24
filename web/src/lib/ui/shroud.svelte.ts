import { browser } from '$app/environment';

const storageKey = 'map';
const stamp = 'revealed';

function remember(revealed: boolean): void {
  try {
    if (revealed) localStorage.setItem(storageKey, stamp);
    else localStorage.removeItem(storageKey);
  } catch {
    return;
  }
}

function remembered(): boolean {
  try {
    return localStorage.getItem(storageKey) === stamp;
  } catch {
    return false;
  }
}

function mark(revealed: boolean): void {
  if (revealed) document.documentElement.dataset.map = stamp;
  else delete document.documentElement.dataset.map;
}

export class ShroudState {
  revealed = $state(false);

  start(): void {
    if (!browser) return;
    this.revealed = remembered();
    mark(this.revealed);
  }

  reveal(): void {
    this.revealed = true;
    remember(true);
    mark(true);
  }

  cover(): void {
    this.revealed = false;
    remember(false);
    mark(false);
  }
}

export const shroud = new ShroudState();
