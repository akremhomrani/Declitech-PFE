import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  durationMs: number;
}

const DEFAULT_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private counter = 0;

  readonly toasts = this._toasts.asReadonly();

  success(message: string, durationMs = DEFAULT_DURATION_MS): number {
    return this.push('success', message, durationMs);
  }

  error(message: string, durationMs = DEFAULT_DURATION_MS): number {
    return this.push('error', message, durationMs);
  }

  dismiss(id: number): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }

  private push(type: ToastType, message: string, durationMs: number): number {
    const id = ++this.counter;
    this._toasts.update(list => [...list, { id, type, message, durationMs }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }
}
