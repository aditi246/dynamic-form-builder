import { Component, output, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormField } from '../fields-step/fields-step';
import { StorageService } from '../../../shared/services/storage.service';
import { IconComponent } from '../../../components/icon/icon';
import { AudioTextareaComponent } from '../../../components/audio-textarea/audio-textarea';
import { FormConfigService } from '../../../shared/services/form-config.service';
import { RulesEngineService } from '../../../shared/services/rules-engine.service';
// import { AiService } from '../../../shared/services/ai.service';

@Component({
  selector: 'app-preview-step',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, IconComponent, AudioTextareaComponent],
  templateUrl: './preview-step.html'
})
export class PreviewStep implements OnInit {
  nextStep = output<void>();
  backStep = output<void>();

  fields = signal<FormField[]>([]);
  previewForm = new FormGroup({});
  hiddenFields = signal<Set<string>>(new Set());
  private readonly STORAGE_KEY = 'form-builder-fields';

  constructor(
    private storageService: StorageService,
    private formConfigService: FormConfigService,
    private rulesEngineService: RulesEngineService,
    // private aiService: AiService
  ) {}

  ngOnInit() {
    this.loadFields();
  }

  private loadFields() {
    const fieldsData = this.storageService.getItem<Omit<FormField, 'formValue'>[]>(this.STORAGE_KEY);
    if (fieldsData) {
      this.fields.set(fieldsData as FormField[]);
      this.formConfigService.setFields(this.fields());
      this.buildForm();
      this.applyRules();
      this.previewForm.valueChanges.subscribe(() => this.applyRules());
    }
  }

  private buildForm() {
    const group: { [key: string]: FormControl } = {};
    
    this.fields().forEach(field => {
      const validators: any[] = [];
      
      // Required validator
      if (field.required) {
        validators.push(Validators.required);
      }
      
      // Type-specific validators
      if (field.type === 'text' && field.validation) {
        if (field.validation.minLength !== undefined) {
          validators.push(Validators.minLength(field.validation.minLength));
        }
        if (field.validation.maxLength !== undefined) {
          validators.push(Validators.maxLength(field.validation.maxLength));
        }
        if (field.validation.pattern) {
          validators.push(Validators.pattern(field.validation.pattern));
        }
      }
      
      if (field.type === 'number' && field.validation) {
        if (field.validation.minValue !== undefined) {
          validators.push(Validators.min(field.validation.minValue));
        }
        if (field.validation.maxValue !== undefined) {
          validators.push(Validators.max(field.validation.maxValue));
        }
      }
      
      if (field.type === 'email') {
        validators.push(Validators.email);
      }
      
      // Set default value
      let defaultValue: any = '';
      if (field.default !== undefined && field.default !== null && field.default !== '') {
        defaultValue = field.default;
      } else {
        if (field.type === 'checkbox') {
          defaultValue = false;
        } else if (field.type === 'number') {
          defaultValue = null;
        }
      }
      
      group[field.name] = new FormControl(defaultValue, validators.length > 0 ? Validators.compose(validators) : null);
    });
    
    this.previewForm = new FormGroup(group);
  }

  private applyRules() {
    const evaluation = this.rulesEngineService.evaluate(
      this.formConfigService.rules(),
      this.previewForm.getRawValue(),
      this.fields()
    );

    this.hiddenFields.set(evaluation.hiddenFields);

    this.fields().forEach(field => {
      const control = this.getFieldControl(field.name);
      if (!control) return;

      const isHidden = evaluation.hiddenFields.has(field.name);
      if (isHidden) {
        if (control.enabled) {
          control.disable({ emitEvent: false });
        }
      } else if (control.disabled) {
        control.enable({ emitEvent: false });
      }

      const existingErrors = control.errors || {};
      if (evaluation.fieldErrors[field.name]) {
        control.setErrors({ ...existingErrors, rule: evaluation.fieldErrors[field.name] });
      } else {
        if (existingErrors['rule']) {
          delete existingErrors['rule'];
        }
        control.setErrors(Object.keys(existingErrors).length ? existingErrors : null);
      }
    });
  }

  getFieldControl(fieldName: string): FormControl | null {
    return this.previewForm.get(fieldName) as FormControl;
  }

  isHidden(fieldName: string): boolean {
    return this.hiddenFields().has(fieldName);
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.getFieldControl(fieldName);
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }

  getFieldError(fieldName: string): string {
    const control = this.getFieldControl(fieldName);
    if (!control || !control.errors) return '';
    
    if (control.errors['required']) {
      return 'This field is required.';
    }
    if (control.errors['minlength']) {
      return `Minimum length is ${control.errors['minlength'].requiredLength}.`;
    }
    if (control.errors['maxlength']) {
      return `Maximum length is ${control.errors['maxlength'].requiredLength}.`;
    }
    if (control.errors['min']) {
      return `Minimum value is ${control.errors['min'].min}.`;
    }
    if (control.errors['max']) {
      return `Maximum value is ${control.errors['max'].max}.`;
    }
    if (control.errors['pattern']) {
      return 'Invalid format.';
    }
    if (control.errors['rule']) {
      return control.errors['rule'];
    }
    
    return '';
  }

  onAiCommandChange(text: string) {
    // Handle AI command text changes
    // TODO: Implement actual AI filling logic when text is received
    console.log('AI command changed:', text);
    // console.log(this.fields());
    // this.aiService.parseNaturalLanguage(text, this.fields(), this.previewForm.value).subscribe({
    //   next: (message) => {
    //     console.log(message);
    //   },
    //   error: (err) => {
    //     console.log(err);
    //   }
    // });
  }
}
