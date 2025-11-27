import { Component, computed, effect, signal } from '@angular/core';
import { FormsStep } from '../forms-step/forms-step';
import { FieldsStep } from '../fields-step/fields-step';
import { RulesStep } from '../rules-step/rules-step';
import { PreviewStep } from '../preview-step/preview-step';
import { FormsManagementService } from '../../../shared/services/forms-management.service';

@Component({
  selector: 'app-builder-shell',
  standalone: true,
  imports: [FormsStep, FieldsStep, RulesStep, PreviewStep],
  templateUrl: './builder-shell.html'
})
export class BuilderShell {
  currentStep = signal<'forms' | 'fields' | 'rules' | 'preview'>('forms');
  formEngaged = signal<boolean>(false);
  hasActiveForm = computed(() => this.formEngaged() && !!this.formsService.currentFormId());

  constructor(public formsService: FormsManagementService) {
    effect(() => {
      const currentForm = this.formsService.currentFormId();
      if (!currentForm) {
        this.formEngaged.set(false);
        this.currentStep.set('forms');
      }
    });
  }

  goToStep(step: 'forms' | 'fields' | 'rules' | 'preview') {
    if (step === 'forms') {
      this.formEngaged.set(false);
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
      // Handle submit (could finish or show success)
    }
  }

  onBackStep() {
    if (this.currentStep() === 'preview') {
      this.currentStep.set('rules');
    } else if (this.currentStep() === 'rules') {
      this.currentStep.set('fields');
    } else if (this.currentStep() === 'fields') {
      this.formEngaged.set(false);
      this.currentStep.set('forms');
    }
  }

  onFormSelected(formId: string) {
    if (formId) {
      this.formEngaged.set(true);
      this.currentStep.set('fields');
    }
  }
}
