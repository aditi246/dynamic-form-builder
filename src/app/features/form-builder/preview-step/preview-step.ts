import { Component, output, OnInit, signal, effect } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormField } from '../fields-step/fields-step';
import { Subscription } from 'rxjs';
import { FormsManagementService } from '../../../shared/services/forms-management.service';
import { IconComponent } from '../../../components/icon/icon';
import { AudioTextareaComponent } from '../../../components/audio-textarea/audio-textarea';
import { FormConfigService } from '../../../shared/services/form-config.service';
import { RulesEngineService } from '../../../shared/services/rules-engine.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-preview-step',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, IconComponent, AudioTextareaComponent, HttpClientModule],
  templateUrl: './preview-step.html'
})
export class PreviewStep implements OnInit {
  nextStep = output<void>();
  backStep = output<void>();

  fields = signal<FormField[]>([]);
  previewForm = new FormGroup({});
  hiddenFields = signal<Set<string>>(new Set());
  selectOptions = signal<Record<string, { label: string; value: any }[]>>({});
  loadingOptions = signal<Record<string, boolean>>({});
  optionErrors = signal<Record<string, string>>({});

  private valueChangesSub?: Subscription;

  constructor(
    private formConfigService: FormConfigService,
    private rulesEngineService: RulesEngineService,
    private formsService: FormsManagementService,
    private http: HttpClient
  ) {
    effect(() => {
      this.formsService.forms(); // react to field updates
      const formId = this.formsService.getCurrentFormId();
      const formName = this.formsService.getCurrentFormName();
      if (formId || formName) {
        this.loadFields(formId, formName);
      } else {
        this.resetPreview();
      }
    });
  }

  ngOnInit() {
    this.loadFields(this.formsService.getCurrentFormId(), this.formsService.getCurrentFormName());
  }

  private loadFields(formId?: string | null, formName?: string | null) {
    const fieldsData = this.formsService.getFormFields(formId, formName);
    if (fieldsData && fieldsData.length > 0) {
      this.fields.set(fieldsData as FormField[]);
      this.formConfigService.setFields(this.fields());
      this.buildForm();
      this.loadDynamicOptions();
      this.applyRules();
      this.valueChangesSub?.unsubscribe();
      this.valueChangesSub = this.previewForm.valueChanges.subscribe(() => this.applyRules());
    } else {
      this.resetPreview();
    }
  }

  private resetPreview() {
    this.fields.set([]);
    this.previewForm = new FormGroup({});
    this.hiddenFields.set(new Set());
    this.selectOptions.set({});
    this.loadingOptions.set({});
    this.optionErrors.set({});
    this.valueChangesSub?.unsubscribe();
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

  getOptionsForField(field: FormField): { label: string; value: any }[] {
    if (field.type !== 'select') return [];
    if (field.selectSource === 'api') {
      const loaded = this.selectOptions()[field.name];
      if (loaded && loaded.length) return loaded;
    }
    return (field.options || []).map(opt => ({ label: opt, value: opt }));
  }

  isOptionsLoading(fieldName: string): boolean {
    return this.loadingOptions()[fieldName] === true;
  }

  getOptionError(fieldName: string): string | undefined {
    return this.optionErrors()[fieldName];
  }

  refreshOptions(field: FormField) {
    if (field.type === 'select' && field.selectSource === 'api') {
      this.fetchOptions(field);
    }
  }

  private loadDynamicOptions() {
    this.fields()
      .filter(f => f.type === 'select' && f.selectSource === 'api' && f.apiOptions?.url)
      .forEach(f => this.fetchOptions(f));
  }

  private fetchOptions(field: FormField) {
    if (!field.apiOptions?.url) return;
    this.loadingOptions.update(map => ({ ...map, [field.name]: true }));
    this.optionErrors.update(map => {
      const copy = { ...map };
      delete copy[field.name];
      return copy;
    });

    this.http.get(field.apiOptions.url).subscribe({
      next: (res: any) => {
        const list = this.extractItems(res, field.apiOptions?.itemsPath);
        const mapped = Array.isArray(list)
          ? list
              .map((item: any) => this.mapOption(item, field))
              .filter((x): x is { label: string; value: any } => !!x)
          : [];
        if (!mapped.length) {
          this.optionErrors.update(map => ({ ...map, [field.name]: 'No options returned from API' }));
        }
        this.selectOptions.update(map => ({ ...map, [field.name]: mapped }));
        this.loadingOptions.update(map => ({ ...map, [field.name]: false }));
      },
      error: () => {
        this.optionErrors.update(map => ({ ...map, [field.name]: 'Failed to load options' }));
        this.loadingOptions.update(map => ({ ...map, [field.name]: false }));
      }
    });
  }

  private extractItems(res: any, path?: string) {
    if (!path) return res;
    const segments = path.split('.').filter(Boolean);
    let current: any = res;
    for (const seg of segments) {
      if (current && typeof current === 'object' && seg in current) {
        current = current[seg];
      } else {
        return [];
      }
    }
    return current;
  }

  private mapOption(item: any, field: FormField): { label: string; value: any } | null {
    if (!field.apiOptions) return null;
    const label = field.apiOptions.labelField ? item?.[field.apiOptions.labelField] : item;
    const rawValue = field.apiOptions.valueField ? item?.[field.apiOptions.valueField] : item;
    const value =
      field.apiOptions.saveStrategy === 'label'
        ? label
        : rawValue;
    if (label === undefined || value === undefined) return null;
    return { label: String(label), value };
  }

  onAiCommandChange(text: string) {
    // Handle AI command text changes
    // TODO: Implement actual AI filling logic when text is received
    console.log('AI command changed:', text);
  }
}
