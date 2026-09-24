import { slugifyName } from './stats';
import type { DiagnosticResult } from './types';

export function resultFilename(name: string, testedAt: string): string {
  const day = testedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `zone-leader-${slugifyName(name)}-${day}.json`;
}

export function serializeResult(result: DiagnosticResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function downloadResult(result: DiagnosticResult): void {
  const blob = new Blob([serializeResult(result)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = resultFilename(result.player.name, result.testedAt);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
