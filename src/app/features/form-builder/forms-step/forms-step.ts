import { Component, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsManagementService, SavedForm } from '../../../shared/services/forms-management.service';
import { IconComponent } from '../../../components/icon/icon';

@Component({
  selector: 'app-forms-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  templateUrl: './forms-step.html'
})
export class FormsStep implements OnInit {
  nextStep = output<void>();
  backStep = output<void>();
  formSelected = output<string>(); // Emits form ID when a form is selected

  showCreateModal = signal<boolean>(false);
  createFormGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(1)]),
    provideContext: new FormControl(false),
    userContextJson: new FormControl('')
  });

  constructor(public formsService: FormsManagementService) {}

  ngOnInit() {
    // Refresh forms list
    this.formsService.loadForms();
  }

  openCreateModal() {
    this.showCreateModal.set(true);
    this.createFormGroup.reset({ provideContext: false, userContextJson: '' });
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
    this.createFormGroup.reset({ provideContext: false, userContextJson: '' });
  }

  createForm() {
    if (this.createFormGroup.valid) {
      const formName = this.createFormGroup.get('name')?.value || 'Untitled Form';
      const provideContext = !!this.createFormGroup.get('provideContext')?.value;
      const rawContext = this.createFormGroup.get('userContextJson')?.value || '';
      const parsedContext = provideContext ? this.parseUserContext(rawContext) : null;
      if (provideContext && !parsedContext) {
        alert('Please enter a valid JSON array of { key, displayName, value } entries.');
        return;
      }
      const formId = this.formsService.createForm(formName, parsedContext || undefined);
      this.closeCreateModal();
      // Navigate to builder with the new form
      this.formSelected.emit(formId);
    } else {
      this.createFormGroup.markAllAsTouched();
    }
  }

  private parseUserContext(raw: string): SavedForm['userContext'] | null {
    if (!raw || !raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return null;
      }
      const normalized = parsed
        .filter((entry: any) => entry && entry.key && entry.displayName && entry.value)
        .map((entry: any) => ({
          key: String(entry.key),
          displayName: String(entry.displayName),
          value: String(entry.value)
        }));
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }

  selectForm(formId: string) {
    this.formsService.setCurrentForm(formId);
    this.formSelected.emit(formId);
  }

  deleteForm(event: Event, formId: string) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this form?')) {
      this.formsService.deleteForm(formId);
    }
  }

  editForm(event: Event, formId: string) {
    event.stopPropagation();
    this.formsService.setCurrentForm(formId);
    this.formSelected.emit(formId);
  }

  copyForm(event: Event, formId: string) {
    event.stopPropagation();
    try {
      const newFormId = this.formsService.copyForm(formId);
      // Optionally navigate to the copied form
      // this.formsService.setCurrentForm(newFormId);
      // this.formSelected.emit(newFormId);
    } catch (error) {
      console.error('Error copying form:', error);
      alert('Failed to copy form. Please try again.');
    }
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

