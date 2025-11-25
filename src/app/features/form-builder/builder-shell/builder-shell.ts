import { Component, signal } from '@angular/core';
import { FieldsStep } from '../fields-step/fields-step';
import { RulesStep } from '../rules-step/rules-step';
import { PreviewStep } from '../preview-step/preview-step';

@Component({
  selector: 'app-builder-shell',
  standalone: true,
  imports: [FieldsStep, RulesStep, PreviewStep],
  templateUrl: './builder-shell.html'
})
export class BuilderShell {
  currentStep = signal<'fields' | 'rules' | 'preview'>('fields');

  onNextStep() {
    if (this.currentStep() === 'fields') {
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
    }
  }
}

