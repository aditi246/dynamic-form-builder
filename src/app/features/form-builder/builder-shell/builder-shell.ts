import { Component, ViewChild, computed, effect, signal } from '@angular/core';
import { FormsStep } from '../forms-step/forms-step';
import { FieldsStep } from '../fields-step/fields-step';
import { RulesStep } from '../rules-step/rules-step';
import { PreviewStep } from '../preview-step/preview-step';
import {
  FormsManagementService,
  SavedForm,
} from '../../../shared/services/forms-management.service';

@Component({
  selector: 'app-builder-shell',
  standalone: true,
  imports: [FormsStep, FieldsStep, RulesStep, PreviewStep],
  templateUrl: './builder-shell.html',
})
export class BuilderShell {
  @ViewChild('previewCmp') previewCmp?: PreviewStep;
  currentStep = signal<'forms' | 'fields' | 'rules' | 'preview'>('forms');
  formEngaged = signal<boolean>(false);
  userFillMode = signal<boolean>(false);
  submissionSaved = signal<boolean>(false);
  initialValues = signal<Record<string, any> | null>(null);
  editingSubmissionId = signal<string | null>(null);
  hasActiveForm = computed(
    () => this.formEngaged() && !!this.formsService.currentFormId(),
  );

  constructor(public formsService: FormsManagementService) {
    effect(() => {
      const currentForm = this.formsService.currentFormId();
      if (!currentForm) {
        this.formEngaged.set(false);
        this.currentStep.set('forms');
      } else if (!this.formEngaged()) {
        // Re-engage tabs when a persisted form selection exists (e.g., after reload)
        this.formEngaged.set(true);
      }
    });
  }

  goToStep(step: 'forms' | 'fields' | 'rules' | 'preview') {
    if (this.userFillMode() && step !== 'forms' && step !== 'preview') {
      return;
    }

    if (step === 'forms') {
      this.formsService.setCurrentForm(null);
      this.formEngaged.set(false);
      this.userFillMode.set(false);
      this.formsService.clearActiveUserContext();
      this.currentStep.set('forms');
      return;
    }

    if (this.hasActiveForm()) {
      this.currentStep.set(step);
    } else {
      this.currentStep.set('forms');
    }
  }

  onNextStep() {
    if (this.currentStep() === 'forms') {
      if (this.hasActiveForm()) {
        this.currentStep.set('fields');
      }
    } else if (this.currentStep() === 'fields') {
      this.currentStep.set('rules');
    } else if (this.currentStep() === 'rules') {
      this.currentStep.set('preview');
    } else if (this.currentStep() === 'preview') {
      this.previewCmp?.onSubmit();
    }
  }

  onBackStep() {
    if (this.currentStep() === 'preview' && this.userFillMode()) {
      this.exitUserFill();
    } else if (this.currentStep() === 'preview') {
      this.currentStep.set('rules');
    } else if (this.currentStep() === 'rules') {
      this.currentStep.set('fields');
    } else if (this.currentStep() === 'fields') {
      this.formsService.setCurrentForm(null);
      this.formEngaged.set(false);
      this.currentStep.set('forms');
    }
  }

  onFormSelected(formId: string) {
    if (formId) {
      this.formsService.clearActiveUserContext();
      this.userFillMode.set(false);
      this.formEngaged.set(true);
      this.currentStep.set('fields');
      this.initialValues.set(null);
      this.editingSubmissionId.set(null);
    }
  }

  onUserFillStart(event: {
    formId: string;
    userContext: SavedForm['userContext'];
  }) {
    if (event.formId) {
      this.formsService.setActiveUserContext(event.userContext || []);
      this.formsService.setCurrentForm(event.formId);
      this.formEngaged.set(true);
      this.userFillMode.set(true);
      this.initialValues.set(null);
      this.editingSubmissionId.set(null);
      this.currentStep.set('preview');
    }
  }

  onSubmissionEdit(event: {
    formId: string;
    submissionId: string;
    values: Record<string, any>;
    context: SavedForm['userContext'] | null;
  }) {
    if (event.formId) {
      this.formsService.setActiveUserContext(event.context || []);
      this.formsService.setCurrentForm(event.formId);
      this.formEngaged.set(true);
      this.userFillMode.set(true);
      this.initialValues.set(event.values || {});
      this.editingSubmissionId.set(event.submissionId);
      this.currentStep.set('preview');
    }
  }

  private exitUserFill() {
    this.formsService.clearActiveUserContext();
    this.formsService.setCurrentForm(null);
    this.formEngaged.set(false);
    this.userFillMode.set(false);
    this.initialValues.set(null);
    this.editingSubmissionId.set(null);
    this.currentStep.set('forms');
  }

  handleBackClick() {
    this.onBackStep();
  }

  handleNextClick() {
    if (this.currentStep() === 'preview') {
      this.previewCmp?.onSubmit();
      return;
    }
    this.onNextStep();
  }

  onPreviewSubmit(values: Record<string, any>) {
    const formId = this.formsService.getCurrentFormId();
    if (formId) {
      const editingId = this.editingSubmissionId();
      if (editingId) {
        this.formsService.updateUserSubmission(formId, editingId, values);
      } else {
        this.formsService.saveUserSubmission(formId, values);
      }
      this.submissionSaved.set(true);
      setTimeout(() => this.submissionSaved.set(false), 2500);
      if (this.userFillMode()) {
        this.exitUserFill();
      }
    }
  }

  isPrimaryDisabled(): boolean {
    if (this.currentStep() === 'forms') {
      return !this.hasActiveForm();
    }
    if (this.currentStep() === 'preview') {
      const form = this.previewCmp?.previewForm;
      return !form || form.invalid;
    }
    return false;
  }
}
