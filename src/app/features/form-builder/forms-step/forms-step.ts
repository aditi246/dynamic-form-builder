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
  showFillModal = signal<boolean>(false);
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
  });

  fillContextForm = new FormGroup({});

  constructor(
    public formsService: FormsManagementService,
    private storageService: StorageService,
  ) {}

  ngOnInit() {
    this.formsService.loadForms();
  }

  openCreateModal() {
    this.showCreateModal.set(true);
    this.createFormGroup.reset({ name: '' });
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
    this.createFormGroup.reset({ name: '' });
  }

  createForm() {
    if (this.createFormGroup.valid) {
      const formName =
        this.createFormGroup.get('name')?.value || 'Untitled Form';
      const formId = this.formsService.createForm(formName);
      this.closeCreateModal();
      this.formSelected.emit(formId);
    } else {
      this.createFormGroup.markAllAsTouched();
    }
  }

  openFillModal(form: SavedForm, event?: Event) {
    event?.stopPropagation();
    this.fillFormId.set(form.id);
    this.fillContextDefs.set(form.userContext || []);
    const group: Record<string, FormControl> = {};
    (form.userContext || []).forEach((ctx) => {
      group[ctx.key] = new FormControl(ctx.value || '');
    });
    this.fillContextForm = new FormGroup(group);
    this.showFillModal.set(true);
  }

  closeFillModal() {
    this.fillFormId.set(null);
    this.fillContextDefs.set([]);
    this.fillContextForm = new FormGroup({});
    this.showFillModal.set(false);
  }

  launchUserFill() {
    const formId = this.fillFormId();
    if (!formId) return;
    const defs = this.fillContextDefs() || [];
    const payload = defs.map((def) => ({
      ...def,
      value: this.fillContextForm.get(def.key)?.value || '',
    }));
    this.startUserFill.emit({ formId, userContext: payload });
    this.closeFillModal();
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

  fillContextDefs = signal<SavedForm['userContext']>([]);

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
}
