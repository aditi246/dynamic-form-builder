import { Component, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  FormsManagementService,
  SavedForm,
} from '../../../shared/services/forms-management.service';
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
  startUserFill = output<{
    formId: string;
    userContext: SavedForm['userContext'];
  }>();
  editSubmission = output<{
    formId: string;
    submissionId: string;
    values: Record<string, any>;
    context: SavedForm['userContext'] | null;
  }>();

  showCreateModal = signal<boolean>(false);
  showContextModal = signal<boolean>(false);
  showFillModal = signal<boolean>(false);
  contextEditFormId = signal<string | null>(null);
  fillFormId = signal<string | null>(null);
  submissionsFormId = signal<string | null>(null);
  submissions = signal<
    {
      id: string;
      submittedAt: string;
      values: Record<string, any>;
      context: SavedForm['userContext'] | null;
    }[]
  >([]);
  selectedSubmission = signal<{
    id: string;
    submittedAt: string;
    values: Record<string, any>;
    context: SavedForm['userContext'] | null;
  } | null>(null);

  createFormGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(1)]),
    provideContext: new FormControl(false),
    userContextJson: new FormControl(''),
  });

  contextEditForm = new FormGroup({
    userContextJson: new FormControl(''),
  });

  fillContextForm = new FormGroup({
    userContextJson: new FormControl(''),
  });

  constructor(
    public formsService: FormsManagementService,
    private storageService: StorageService,
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
      const formName =
        this.createFormGroup.get('name')?.value || 'Untitled Form';
      const provideContext =
        !!this.createFormGroup.get('provideContext')?.value;
      const rawContext =
        this.createFormGroup.get('userContextJson')?.value || '';
      const parsedContext = provideContext
        ? this.parseUserContext(rawContext)
        : null;
      if (provideContext && !parsedContext) {
        alert(
          'Please enter a valid JSON array of { key, displayName, value } entries.',
        );
        return;
      }
      const formId = this.formsService.createForm(
        formName,
        parsedContext || undefined,
      );
      this.closeCreateModal();
      this.formSelected.emit(formId);
    } else {
      this.createFormGroup.markAllAsTouched();
    }
  }

  openFillModal(form: SavedForm, event?: Event) {
    event?.stopPropagation();
    this.fillFormId.set(form.id);
    const json =
      form.userContext && form.userContext.length
        ? JSON.stringify(form.userContext, null, 2)
        : '';
    this.fillContextForm.reset({ userContextJson: json });
    this.showFillModal.set(true);
  }

  closeFillModal() {
    this.fillFormId.set(null);
    this.fillContextForm.reset({ userContextJson: '' });
    this.showFillModal.set(false);
  }

  launchUserFill() {
    const formId = this.fillFormId();
    if (!formId) return;
    const rawContext =
      this.fillContextForm.get('userContextJson')?.value?.trim() || '';
    const parsedContext =
      (rawContext ? this.parseUserContext(rawContext) : []) || [];
    this.startUserFill.emit({ formId, userContext: parsedContext });
    this.closeFillModal();
  }

  updateUserContext() {
    const formId = this.contextEditFormId();
    if (!formId) return;
    const rawContext = this.contextEditForm.get('userContextJson')?.value || '';
    const parsed = this.parseUserContext(rawContext);
    if (rawContext.trim() && !parsed) {
      alert(
        'Please enter a valid JSON array of { key, displayName, value } entries.',
      );
      return;
    }
    this.formsService.updateForm(formId, { userContext: parsed || [] });
    this.closeContextModal();
  }

  selectForm(formId: string) {
    this.formsService.setCurrentForm(formId);
    this.formSelected.emit(formId);
  }

  viewSubmissions(event: Event, form: SavedForm) {
    event.stopPropagation();
    this.submissionsFormId.set(form.id);
    const data = this.formsService.getUserSubmissions(form.id);
    this.submissions.set(data);
    this.selectedSubmission.set(data.length ? data[0] : null);
  }

  selectSubmission(entry: {
    id: string;
    submittedAt: string;
    values: Record<string, any>;
    context: SavedForm['userContext'] | null;
  }) {
    this.selectedSubmission.set(entry);
  }

  editSelectedSubmission() {
    const formId = this.submissionsFormId();
    const entry = this.selectedSubmission();
    if (!formId || !entry) return;
    this.editSubmission.emit({
      formId,
      submissionId: entry.id,
      values: entry.values,
      context: entry.context || null,
    });
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
    const existing = this.formsService.forms();
    const mockName = MOCK_FORMLIST[0].name.trim().toLowerCase();
    const nameExists = existing.some(
      (f) => f.name.trim().toLowerCase() === mockName,
    );
    if (nameExists) {
      alert('Mock form already exists. No changes made.');
      return;
    }

    const updated = [
      ...existing.filter((f) => f.id !== MOCK_FORM_ID),
      ...MOCK_FORMLIST,
    ];

    this.storageService.setItem('formlist', updated);
    this.storageService.setItem(
      `form-builder-rules-${MOCK_FORM_ID}`,
      MOCK_RULES,
    );
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
        .filter(
          (entry: any) =>
            entry && entry.key && entry.displayName && entry.value,
        )
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
