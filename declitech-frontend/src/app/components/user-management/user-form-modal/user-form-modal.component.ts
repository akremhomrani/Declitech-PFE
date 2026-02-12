import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../services/user.service';
import { CreateUserRequest } from '../../../models/user/create-user-request.model';
import { UpdateUserRequest } from '../../../models/user/update-user-request.model';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-form-modal.component.html',
  styleUrls: ['./user-form-modal.component.css']
})
export class UserFormModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() userId: number | null = null;
  @Input() mode: 'create' | 'edit' = 'create';
  @Output() closeModal = new EventEmitter<void>();
  @Output() userSaved = new EventEmitter<void>();

  user: any = {
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phoneNumber: '',
    sexe: 'MALE',
    role: 'INSTRUCTOR',
    active: true,
    password: ''
  };

  roles = ['INSTRUCTOR', 'ADMIN'];
  sexes = ['MALE', 'FEMALE'];
  isLoading = false;
  errorMessage = '';

  constructor(private userService: UserService) {}

  ngOnInit() {
    // Initial load if needed
  }

  ngOnChanges(changes: SimpleChanges) {
    // When modal opens or userId changes, load user data for edit mode
    if (changes['isOpen'] && this.isOpen && this.mode === 'edit' && this.userId) {
      this.loadUser();
    } else if (changes['isOpen'] && this.isOpen && this.mode === 'create') {
      this.resetForm();
    }
  }

  loadUser() {
    this.isLoading = true;
    this.userService.getUserById(this.userId!)
      .subscribe({
        next: (user) => {
          this.user = user;
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('Error loading user:', error);
          this.errorMessage = 'Failed to load user details';
          this.isLoading = false;
        }
      });
  }

  saveUser() {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const request = this.mode === 'create'
      ? this.userService.createUser(this.user as CreateUserRequest)
      : this.userService.updateUser(this.userId!, this.user as UpdateUserRequest);

    request.subscribe({
      next: () => {
        this.isLoading = false;
        this.userSaved.emit();
        this.close();
      },
      error: (error: any) => {
        console.error('Error saving user:', error);
        this.errorMessage = error.error?.message || 'Failed to save user';
        this.isLoading = false;
      }
    });
  }

  validateForm(): boolean {
    if (!this.user.firstName || !this.user.lastName || !this.user.username || !this.user.email) {
      this.errorMessage = 'Please fill in all required fields';
      return false;
    }

    if (!this.validateEmail(this.user.email)) {
      this.errorMessage = 'Please enter a valid email address';
      return false;
    }

    if (!this.validatePhoneNumber(this.user.phoneNumber)) {
      this.errorMessage = 'Phone number must be 8 digits and cannot start with 0 or 1';
      return false;
    }

    if (this.mode === 'create' && !this.user.password) {
      this.errorMessage = 'Password is required for new users';
      return false;
    }

    return true;
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePhoneNumber(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 8 && !digits.startsWith('0') && !digits.startsWith('1');
  }

  close() {
    this.closeModal.emit();
    this.resetForm();
  }

  resetForm() {
    this.user = {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      phoneNumber: '',
      sexe: 'MALE',
      role: 'INSTRUCTOR',
      active: true,
      password: ''
    };
    this.errorMessage = '';
  }
}
