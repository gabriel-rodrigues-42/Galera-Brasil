export type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  time: number;
  level: LogLevel;
  message: string;
}

const MAX_ENTRIES = 300;
const MAX_VISIBLE = 16;
const entries: LogEntry[] = [];

export interface DebugPanelSink {
  setLog(text: string): void;
  setStats(text: string): void;
}

let sink: DebugPanelSink | null = null;

export function initDebugPanel(panel: DebugPanelSink) {
  sink = panel;
  renderLog();
}

export function log(level: LogLevel, message: string) {
  entries.push({ time: performance.now(), level, message });
  if (entries.length > MAX_ENTRIES) entries.shift();

  const prefix = `[${(performance.now() / 1000).toFixed(2)}s]`;
  if (level === 'error') console.error(prefix, message);
  else if (level === 'warn') console.warn(prefix, message);
  else console.log(prefix, message);

  renderLog();
}

function renderLog() {
  if (!sink) return;
  sink.setLog(
    entries
      .slice(-MAX_VISIBLE)
      .map((e) => `[${(e.time / 1000).toFixed(2)}] ${e.level.toUpperCase()}: ${e.message}`)
      .join('\n')
  );
}

export function updateStats(lines: string[]) {
  sink?.setStats(lines.join('\n'));
}

/** Surface exceptions that would otherwise silently die inside a
 * requestAnimationFrame callback (the browser only prints these to devtools
 * console, easy to miss when debugging over a screenshot). */
export function installGlobalErrorLogging() {
  window.addEventListener('error', (e) => {
    log('error', `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    log('error', `Unhandled promise rejection: ${String(e.reason)}`);
  });
}
