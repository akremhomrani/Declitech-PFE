import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

type LogLevel = 'info' | 'warn' | 'error';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly isProd = environment.production;

  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.write('error', message, { ...context, error: this.serializeError(error) });
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (this.isProd && level === 'info') {
      return;
    }
    const payload = { level, message, context, ts: new Date().toISOString() };
    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error('[Declitech]', payload);
    } else if (level === 'warn') {
      // eslint-disable-next-line no-console
      console.warn('[Declitech]', payload);
    } else {
      // eslint-disable-next-line no-console
      console.info('[Declitech]', payload);
    }
  }

  private serializeError(error: unknown): unknown {
    if (error instanceof Error) {
      return { name: error.name, message: error.message, stack: error.stack };
    }
    return error;
  }
}
