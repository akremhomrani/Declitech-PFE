import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal(false);

  private readonly sidebarOpenSubject = new BehaviorSubject<boolean>(false);
  readonly sidebarOpen$: Observable<boolean> = this.sidebarOpenSubject.asObservable();

  toggleSidebar(): void {
    this.setSidebarOpen(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.setSidebarOpen(false);
  }

  private setSidebarOpen(open: boolean): void {
    this.sidebarOpen.set(open);
    this.sidebarOpenSubject.next(open);
  }
}
