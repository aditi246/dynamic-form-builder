import { Component, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsManagementService, SavedForm } from '../../../shared/services/forms-management.service';
import { IconComponent } from '../../../components/icon/icon';
import { StorageService } from '../../../shared/services/storage.service';
import { MOCK_FORM_ID, MOCK_FORMLIST, MOCK_RULES } from './mock-form.data';

@Component({
  selector: 'app-forms-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  templateUrl: './forms-step.html',
})
export class FormsStep implements OnInit {
  nextStep = output<void>();
  backStep = output<void>();
  formSelected = output<string>(); // Emits form ID when a form is selected

  showCreateModal = signal<boolean>(false);
  showContextModal = signal<boolean>(false);
  contextEditFormId = signal<string | null>(null);

  createFormGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(1)]),
    provideContext: new FormControl(false),
    userContextJson: new FormControl(''),
  });

  contextEditForm = new FormGroup({
    userContextJson: new FormControl(''),
  });

  constructor(
    public formsService: FormsManagementService,
    private storageService: StorageService
  ) {}

  ngOnInit() {
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

  openContextModal(form: SavedForm, event?: Event) {
    event?.stopPropagation();
    this.contextEditFormId.set(form.id);
    const json =
      form.userContext && form.userContext.length
        ? JSON.stringify(form.userContext, null, 2)
        : '';
    this.contextEditForm.reset({ userContextJson: json });
    this.showContextModal.set(true);
  }

  closeContextModal() {
    this.showContextModal.set(false);
    this.contextEditFormId.set(null);
    this.contextEditForm.reset({ userContextJson: '' });
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
      this.formSelected.emit(formId);
    } else {
      this.createFormGroup.markAllAsTouched();
    }
  }

  updateUserContext() {
    const formId = this.contextEditFormId();
    if (!formId) return;
    const rawContext = this.contextEditForm.get('userContextJson')?.value || '';
    const parsed = this.parseUserContext(rawContext);
    if (rawContext.trim() && !parsed) {
      alert('Please enter a valid JSON array of { key, displayName, value } entries.');
      return;
    }
    this.formsService.updateForm(formId, { userContext: parsed || [] });
    this.closeContextModal();
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
      // optionally navigate to copy
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
      minute: '2-digit',
    });
  }

  loadMockForm() {
    this.storageService.setItem('formlist', MOCK_FORMLIST);
    this.storageService.setItem(`form-builder-rules-${MOCK_FORM_ID}`, MOCK_RULES);
    this.formsService.loadForms();
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
          value: String(entry.value),
        }));
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }
}
