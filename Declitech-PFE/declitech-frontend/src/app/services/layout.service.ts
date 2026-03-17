import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);
  public sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  toggleSidebar(): void {
    this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value);
  }

  closeSidebar(): void {
    this.sidebarOpenSubject.next(false);
  }
}
