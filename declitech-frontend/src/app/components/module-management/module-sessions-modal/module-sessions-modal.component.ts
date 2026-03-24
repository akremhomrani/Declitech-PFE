import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionInfo } from '../../../models/module';

@Component({
  selector: 'app-module-sessions-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './module-sessions-modal.component.html',
  styleUrls: ['./module-sessions-modal.component.css']
})
export class ModuleSessionsModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() sessions: SessionInfo[] = [];
  @Input() moduleTitle = '';
  @Output() closeModal = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else if (changes['isOpen'] && !this.isOpen) {
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'auto';
    }
  }

  close() {
    document.body.style.overflow = 'auto';
    this.closeModal.emit();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
