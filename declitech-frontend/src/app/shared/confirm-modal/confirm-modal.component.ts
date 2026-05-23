import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type ConfirmVariant = 'danger' | 'success' | 'warning' | 'info' | 'primary';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './confirm-modal.component.html',
  styleUrls: ['./confirm-modal.component.css']
})
export class ConfirmModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() message = '';
  @Input() hint = '';
  @Input() icon = 'help';
  @Input() variant: ConfirmVariant = 'primary';
  @Input() confirmLabel = '';
  @Input() cancelLabel = '';
  @Input() loading = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  get iconBgClass(): string {
    switch (this.variant) {
      case 'danger':  return 'bg-red-100 dark:bg-red-900/30';
      case 'success': return 'bg-green-100 dark:bg-green-900/30';
      case 'warning': return 'bg-amber-100 dark:bg-amber-900/30';
      case 'info':    return 'bg-blue-100 dark:bg-blue-900/30';
      default:        return 'bg-primary/10';
    }
  }

  get iconColorClass(): string {
    switch (this.variant) {
      case 'danger':  return 'text-red-600 dark:text-red-400';
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-amber-600 dark:text-amber-400';
      case 'info':    return 'text-blue-600 dark:text-blue-400';
      default:        return 'text-primary';
    }
  }

  get confirmBtnClass(): string {
    switch (this.variant) {
      case 'danger':  return 'bg-red-600 hover:bg-red-700';
      case 'success': return 'bg-green-600 hover:bg-green-700';
      case 'warning': return 'bg-amber-600 hover:bg-amber-700';
      case 'info':    return 'bg-blue-600 hover:bg-blue-700';
      default:        return 'bg-primary hover:bg-primary/90';
    }
  }

  onBackdrop(): void {
    if (this.loading) return;
    this.cancelled.emit();
  }

  onCancel(): void {
    if (this.loading) return;
    this.cancelled.emit();
  }

  onConfirm(): void {
    if (this.loading) return;
    this.confirmed.emit();
  }
}
