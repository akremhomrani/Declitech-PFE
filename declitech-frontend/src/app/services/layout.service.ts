import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal(false);
  readonly sidebarOpen$: Observable<boolean> = toObservable(this.sidebarOpen);

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
