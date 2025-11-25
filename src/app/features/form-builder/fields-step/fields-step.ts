import { Component, signal, computed, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../../shared/services/storage.service';
import { IconComponent } from '../../../components/icon/icon';
import { DefaultsComponent } from '../../../components/defaults/defaults';

export interface FormField {
  label: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  default?: string | number | boolean | null;
  validation?: {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    step?: number;
    pattern?: string;
    regexType?: 'predefined' | 'custom';
  };
  formValue?: FormControl;
}

@Component({
  selector: 'app-fields-step',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, IconComponent, DefaultsComponent],
  templateUrl: './fields-step.html'
})
export class FieldsStep {
  nextStep = output<void>();
  backStep = output<void>();
  
  private readonly STORAGE_KEY = 'form-builder-fields';
  fields = signal<FormField[]>([]);

  fieldForm = new FormGroup({
    label: new FormControl('', [Validators.required]),
    name: new FormControl('', [Validators.required]),
    type: new FormControl('text'),
    required: new FormControl(false),
    default: new FormControl<string | number | boolean | null>(''),
    options: new FormControl(''),
    min: new FormControl(''),
    max: new FormControl(''),
    step: new FormControl(''),
    pattern: new FormControl(''),
    regexType: new FormControl<'predefined' | 'custom'>('predefined')
  });

  fieldTypes = ['text', 'number', 'checkbox', 'select', 'date', 'file'];
  
  predefinedRegex = [
    { label: 'Email', value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
    { label: 'Phone', value: '^\\+?[1-9]\\d{1,14}$' },
    { label: 'URL', value: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$' },
    { label: 'Alphanumeric', value: '^[a-zA-Z0-9]+$' }
  ];

  currentType = signal<string>(this.fieldForm.get('type')?.value || 'text');

  constructor(private storageService: StorageService) {
    this.loadFields();
    this.fieldForm.get('type')?.valueChanges.subscribe(type => {
      this.currentType.set(type || 'text');

      const minControl = this.fieldForm.get('min');
      const maxControl = this.fieldForm.get('max');

      // Reset regex pattern signal if type is not text
      if (type !== 'text') {
        this.hasRegexPattern.set(false);
        // Enable min/max controls for non-text types
        minControl?.enable({ emitEvent: false });
        maxControl?.enable({ emitEvent: false });
      } else {
        // Check pattern value when switching to text type
        const pattern = this.fieldForm.get('pattern')?.value;
        const hasPattern = !!(pattern && pattern.trim() !== '');
        this.hasRegexPattern.set(hasPattern);
        
        // Enable/disable min/max based on pattern
        if (hasPattern) {
          minControl?.disable({ emitEvent: false });
          maxControl?.disable({ emitEvent: false });
        } else {
          minControl?.enable({ emitEvent: false });
          maxControl?.enable({ emitEvent: false });
        }
      }

      const defaultControl = this.fieldForm.get('default');
      if (type === 'checkbox' && defaultControl && typeof defaultControl.value !== 'boolean') {
        defaultControl.patchValue(false as any, { emitEvent: false });
      } else if (type === 'number' && defaultControl && (defaultControl.value === '' || typeof defaultControl.value === 'string')) {
        defaultControl.patchValue(null, { emitEvent: false });
      } else if (type !== 'checkbox' && type !== 'number' && defaultControl && (defaultControl.value === false || defaultControl.value === null)) {
        defaultControl.patchValue('', { emitEvent: false });
      }
    });

    // Clear min/max length when regex pattern is set and update hasRegexPattern signal
    this.fieldForm.get('pattern')?.valueChanges.subscribe(pattern => {
      const hasPattern = !!(pattern && pattern.trim() !== '');
      this.hasRegexPattern.set(hasPattern);
      
      const minControl = this.fieldForm.get('min');
      const maxControl = this.fieldForm.get('max');
      
      if (this.currentType() === 'text') {
        if (hasPattern) {
          // Disable min/max controls when pattern is set
          minControl?.disable({ emitEvent: false });
          maxControl?.disable({ emitEvent: false });
          // Clear values
          if (minControl && minControl.value) {
            minControl.patchValue('', { emitEvent: false });
          }
          if (maxControl && maxControl.value) {
            maxControl.patchValue('', { emitEvent: false });
          }
        } else {
          // Enable min/max controls when pattern is cleared
          minControl?.enable({ emitEvent: false });
          maxControl?.enable({ emitEvent: false });
        }
      }
    });

    // Check initial pattern value and set initial disabled state
    const initialPattern = this.fieldForm.get('pattern')?.value;
    const initialHasPattern = !!(initialPattern && initialPattern.trim() !== '');
    this.hasRegexPattern.set(initialHasPattern);
    
    // Set initial disabled state for min/max if pattern exists and type is text
    if (this.currentType() === 'text' && initialHasPattern) {
      this.fieldForm.get('min')?.disable({ emitEvent: false });
      this.fieldForm.get('max')?.disable({ emitEvent: false });
    }
  }

  isSelectType = computed(() => this.currentType() === 'select');
  isTextType = computed(() => this.currentType() === 'text');
  isNumberType = computed(() => this.currentType() === 'number');
  isCheckboxType = computed(() => this.currentType() === 'checkbox');
  isFileType = computed(() => this.currentType() === 'file');
  
  hasRegexPattern = signal<boolean>(false);

  get defaultControl(): FormControl | null {
    return this.fieldForm.get('default') as FormControl | null;
  }

  getOptionsArray(): string[] {
    const optionsValue = this.fieldForm.get('options')?.value || '';
    if (!optionsValue) return [];
    return optionsValue.split('\n').map((o: string) => o.trim()).filter((o: string) => o);
  }

  addOption(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const textarea = event.target as HTMLTextAreaElement;
      const currentValue = this.fieldForm.get('options')?.value || '';
      const lines = textarea.value.split('\n');
      const lastLine = lines[lines.length - 1].trim();
      
      if (lastLine) {
        const updatedValue = currentValue ? `${currentValue}\n${lastLine}` : lastLine;
        this.fieldForm.patchValue({ options: updatedValue });
        textarea.value = '';
      }
    }
  }

  private createFormControl(fieldData: FormField): FormControl {
    const validators: any[] = [];

    if (fieldData.required) {
      validators.push(Validators.required);
    }
    
    // Type-specific validators
    if (fieldData.type === 'text') {
      if (fieldData.validation?.minLength !== undefined) {
        validators.push(Validators.minLength(fieldData.validation.minLength));
      }
      if (fieldData.validation?.maxLength !== undefined) {
        validators.push(Validators.maxLength(fieldData.validation.maxLength));
      }
      if (fieldData.validation?.pattern) {
        validators.push(Validators.pattern(fieldData.validation.pattern));
      }
    }
    
    if (fieldData.type === 'number') {
      if (fieldData.validation?.minValue !== undefined) {
        validators.push(Validators.min(fieldData.validation.minValue));
      }
      if (fieldData.validation?.maxValue !== undefined) {
        validators.push(Validators.max(fieldData.validation.maxValue));
      }
    }
    
    // Create FormControl with validators
    const control = new FormControl(
      this.getDefaultValue(fieldData),
      Validators.compose(validators)
    );
    
    return control;
  }

  private getDefaultValue(fieldData: FormField) {
    if (fieldData.type === 'checkbox') {
      return Boolean(fieldData.default);
    }

    if (fieldData.type === 'number') {
      if (fieldData.default === '' || fieldData.default === undefined || fieldData.default === null) {
        return null;
      }
      const numeric = Number(fieldData.default);
      return Number.isNaN(numeric) ? null : numeric;
    }

    if (fieldData.type === 'select') {
      return fieldData.default ?? '';
    }

    return fieldData.default ?? '';
  }

  private toNumberValue(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? undefined : numeric;
  }

  addField() {
    if (this.fieldForm.valid) {
      const value = this.fieldForm.value;
      const options = value.options ? value.options.split('\n').filter((o: string) => o.trim()) : undefined;

      const minValue = this.toNumberValue(value.min);
      const maxValue = this.toNumberValue(value.max);
      const step = this.toNumberValue(value.step);
      
      const fieldData: FormField = {
        label: value.label!,
        name: value.name!,
        type: value.type || 'text',
        required: value.required || false,
        options: value.type === 'select' ? options : undefined,
        default: value.type === 'checkbox'
          ? Boolean(value.default)
          : value.type === 'number'
            ? (this.toNumberValue(value.default) ?? null)
            : value.default ?? '',
        validation: {
          // For text type: only include minLength/maxLength if pattern is not set
          minLength: value.type === 'text' && !value.pattern ? minValue : undefined,
          maxLength: value.type === 'text' && !value.pattern ? maxValue : undefined,
          minValue: value.type === 'number' ? minValue : undefined,
          maxValue: value.type === 'number' ? maxValue : undefined,
          step: value.type === 'number' ? step : undefined,
          pattern: value.type === 'text' ? (value.pattern || undefined) : undefined,
          regexType: value.type === 'text' ? (value.regexType || undefined) : undefined
        }
      };
      
      // Create FormControl with validators
      const formControl = this.createFormControl(fieldData);
      const field: FormField = { ...fieldData, formValue: formControl };
      
      const editingIdx = this.editingIndex();
      if (editingIdx !== null) {
        // Update existing field with a fresh FormControl
        this.fields.update(fields => fields.map((f, i) => i === editingIdx ? field : f));
        this.editingIndex.set(null);
      } else {
        // Add new field
        this.fields.update(fields => [...fields, field]);
      }
      this.saveFields();
      this.resetForm();
    }
    console.log("AFTER");
    console.log(this.fields()); 
  }

  editingIndex = signal<number | null>(null);

  editField(field: FormField, index: number) {
    this.editingIndex.set(index);
    const defaultValue = field.default ?? (field.type === 'checkbox' ? false : field.type === 'number' ? null : '');
    this.fieldForm.patchValue({
      label: field.label,
      name: field.name,
      type: field.type,
      required: field.required,
      default: defaultValue as any,
      options: field.options?.join('\n') || '',
      min: field.type === 'text' 
        ? field.validation?.minLength?.toString() || '' 
        : field.validation?.minValue?.toString() || '',
      max: field.type === 'text' 
        ? field.validation?.maxLength?.toString() || '' 
        : field.validation?.maxValue?.toString() || '',
      step: field.validation?.step?.toString() || '',
      pattern: field.validation?.pattern || '',
      regexType: field.validation?.regexType || 'predefined'
    });
  }

  deleteField(index: number) {
    this.fields.update(fields => fields.filter((_, i) => i !== index));
    this.saveFields();
  }

  resetForm() {
    this.fieldForm.reset({ 
      type: 'text', 
      required: false,
      default: '',
      options: '',
      regexType: 'predefined'
    });
    this.editingIndex.set(null);
  }

  private saveFields(): void {
    // Save fields without formValue (FormControls can't be serialized)
    const fieldsToSave = this.fields().map(field => {
      const { formValue, ...fieldWithoutFormControl } = field;
      return fieldWithoutFormControl;
    });
    this.storageService.setItem(this.STORAGE_KEY, fieldsToSave);
  }

  private loadFields(): void {
    const fieldsData = this.storageService.getItem<Omit<FormField, 'formValue'>[]>(this.STORAGE_KEY);
    if (fieldsData) {
      // Recreate FormControls for each field
      const fieldsWithControls: FormField[] = fieldsData.map(fieldData => {
        const formControl = this.createFormControl(fieldData as FormField);
        return { ...fieldData, formValue: formControl };
      });
      this.fields.set(fieldsWithControls);
    }
  }
}
