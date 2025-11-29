import {
  Component,
  signal,
  computed,
  output,
  effect,
  input,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../../shared/services/storage.service';
import { FormsManagementService } from '../../../shared/services/forms-management.service';
import { IconComponent } from '../../../components/icon/icon';
import { DefaultsComponent } from '../../../components/defaults/defaults';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ApiCacheService } from '../../../shared/services/api-cache.service';
import { BuilderTourService } from '../tutorial/builder-tour.service';

export interface FormField {
  label: string;
  name: string;
  type: string;
  required: boolean;
  fileType?: 'images' | 'all';
  options?: string[];
  selectSource?: 'manual' | 'api';
  apiOptions?: {
    url: string;
    method: 'GET';
    itemsPath?: string;
    labelField?: string;
    valueField?: string;
    saveStrategy?: 'label' | 'value';
    headers?: Record<string, string>;
  };
  default?: string | number | boolean | null;
  validation?: {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    step?: number;
    pattern?: string;
    regexType?: 'predefined' | 'custom';
    minFiles?: number;
    maxFiles?: number;
  };
  formValue?: FormControl;
}

@Component({
  selector: 'app-fields-step',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    IconComponent,
    DefaultsComponent,
    HttpClientModule,
  ],
  templateUrl: './fields-step.html',
})
export class FieldsStep {
  nextStep = output<void>();
  backStep = output<void>();
  formName = input<string | null>(null);
  displayFormName = computed(
    () =>
      this.formName()?.trim() ||
      this.formsService.getCurrentFormName() ||
      'Untitled Form',
  );
  draggingIndex = signal<number | null>(null);

  private readonly STORAGE_KEY = 'form-builder-fields';
  fields = signal<FormField[]>([]);
  sortDirection = signal<'asc' | 'desc'>('asc');

  fieldForm = new FormGroup({
    label: new FormControl('', [Validators.required]),
    name: new FormControl('', [Validators.required]),
    type: new FormControl('text'),
    required: new FormControl(false),
    default: new FormControl<string | number | boolean | null>(''),
    options: new FormControl(''),
    selectSource: new FormControl<'manual' | 'api'>('manual'),
    apiMode: new FormControl<'new' | 'reuse'>('new'),
    apiPresetField: new FormControl(''),
    apiUrl: new FormControl(''),
    apiItemsPath: new FormControl(''),
    apiLabelField: new FormControl(''),
    apiValueField: new FormControl(''),
    apiSaveStrategy: new FormControl<'label' | 'value'>('value'),
    min: new FormControl(''),
    max: new FormControl(''),
    step: new FormControl(''),
    pattern: new FormControl(''),
    regexType: new FormControl<'predefined' | 'custom'>('predefined'),
  });

  fieldTypes = ['text', 'number', 'checkbox', 'select', 'file'];

  predefinedRegex = [
    {
      label: 'Email',
      value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    },
    { label: 'Phone', value: '^\\+?[1-9]\\d{1,14}$' },
    {
      label: 'URL',
      value:
        '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$',
    },
    { label: 'Alphanumeric', value: '^[a-zA-Z0-9]+$' },
  ];

  currentType = signal<string>(this.fieldForm.get('type')?.value || 'text');

  apiPreviewOptions = signal<{ label: string; value: any }[]>([]);
  apiPreviewLoading = signal<boolean>(false);
  apiPreviewError = signal<string | null>(null);
  apiPresets = computed(() => {
    const seen = new Set<string>();
    return this.fields()
      .filter(
        (f) =>
          f.type === 'select' && f.selectSource === 'api' && f.apiOptions?.url,
      )
      .map((f) => {
        const key = this.getApiCacheKey(f.apiOptions!);
        return {
          key,
          fromField: f.name,
          label: f.label,
          config: f.apiOptions!,
        };
      })
      .filter((preset) => {
        if (seen.has(preset.key)) return false;
        seen.add(preset.key);
        return true;
      });
  });

  constructor(
    private storageService: StorageService,
    private formsService: FormsManagementService,
    private http: HttpClient,
    private apiCacheService: ApiCacheService,
    private tour: BuilderTourService,
  ) {
    effect(() => {
      const formId = this.formsService.getCurrentFormId();
      const formName = this.formName();

      if (formId || formName) {
        this.loadFields(formId, formName);
      } else {
        this.fields.set([]);
      }
    });

    this.fieldForm.get('type')?.valueChanges.subscribe((type) => {
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
      if (
        type === 'checkbox' &&
        defaultControl &&
        typeof defaultControl.value !== 'boolean'
      ) {
        defaultControl.patchValue(false as any, { emitEvent: false });
      } else if (
        type === 'number' &&
        defaultControl &&
        (defaultControl.value === '' ||
          typeof defaultControl.value === 'string')
      ) {
        defaultControl.patchValue(null, { emitEvent: false });
      } else if (type === 'file' && defaultControl) {
        defaultControl.patchValue(null, { emitEvent: false });
      } else if (
        type !== 'checkbox' &&
        type !== 'number' &&
        defaultControl &&
        (defaultControl.value === false || defaultControl.value === null)
      ) {
        defaultControl.patchValue('', { emitEvent: false });
      }
    });

    // Clear min/max length when regex pattern is set and update hasRegexPattern signal
    this.fieldForm.get('pattern')?.valueChanges.subscribe((pattern) => {
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
    const initialHasPattern = !!(
      initialPattern && initialPattern.trim() !== ''
    );
    this.hasRegexPattern.set(initialHasPattern);

    // Set initial disabled state for min/max if pattern exists and type is text
    if (this.currentType() === 'text' && initialHasPattern) {
      this.fieldForm.get('min')?.disable({ emitEvent: false });
      this.fieldForm.get('max')?.disable({ emitEvent: false });
    }

    this.fieldForm.get('selectSource')?.valueChanges.subscribe((source) => {
      if (source !== 'api') {
        this.fieldForm.get('apiMode')?.setValue('new', { emitEvent: false });
        this.fieldForm
          .get('apiPresetField')
          ?.setValue('', { emitEvent: false });
      }
    });

    this.fieldForm.get('apiMode')?.valueChanges.subscribe((mode) => {
      if (mode === 'new') {
        this.fieldForm
          .get('apiPresetField')
          ?.setValue('', { emitEvent: false });
      } else if (!this.fieldForm.value.apiPresetField) {
        const firstPreset = this.apiPresets()[0];
        if (firstPreset) {
          this.applyApiPreset(firstPreset.fromField);
        }
      }
    });

    effect(() => {
      const step = this.tour.currentStep();
      if (!this.tour.isActive() || !step) return;
      const isSelectStep =
        step.id === 'fields-manual' ||
        step.id === 'fields-api' ||
        step.id === 'fields-api-reuse';

      if (isSelectStep) {
        if (!this.tourOriginalType) {
          this.tourOriginalType = this.fieldForm.get('type')?.value || 'text';
        }
        this.ensureSelectType();
        if (step.id === 'fields-manual') {
          this.fieldForm.patchValue(
            { selectSource: 'manual', apiMode: 'new' },
            { emitEvent: true },
          );
        } else if (step.id === 'fields-api') {
          this.fieldForm.patchValue(
            { selectSource: 'api', apiMode: 'new' },
            { emitEvent: true },
          );
        } else if (step.id === 'fields-api-reuse') {
          this.fieldForm.patchValue(
            { selectSource: 'api', apiMode: 'reuse' },
            { emitEvent: true },
          );
        }
      } else if (this.tourOriginalType) {
        this.fieldForm.get('type')?.setValue(this.tourOriginalType);
        this.tourOriginalType = null;
      }
    });

    effect(() => {
      if (!this.tour.isActive() && this.tourOriginalType) {
        this.fieldForm.get('type')?.setValue(this.tourOriginalType);
        this.tourOriginalType = null;
      }
    });
  }

  isSelectType = computed(() => this.currentType() === 'select');
  isTextType = computed(() => this.currentType() === 'text');
  isNumberType = computed(() => this.currentType() === 'number');
  isCheckboxType = computed(() => this.currentType() === 'checkbox');
  isFileType = computed(() => this.currentType() === 'file');

  hasRegexPattern = signal<boolean>(false);

  private tourOriginalType: string | null = null;

  private ensureSelectType() {
    if (this.currentType() !== 'select') {
      this.fieldForm.get('type')?.setValue('select');
    }
  }

  get defaultControl(): FormControl | null {
    return this.fieldForm.get('default') as FormControl | null;
  }

  isInvalid(controlName: string): boolean {
    const ctrl = this.fieldForm.get(controlName);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  getOptionsArray(): string[] {
    if (
      this.currentType() === 'select' &&
      this.fieldForm.value.selectSource === 'api'
    ) {
      const saveStrategy = this.fieldForm.value.apiSaveStrategy || 'value';
      const apiOpts = this.apiPreviewOptions();
      return apiOpts.map((opt) =>
        saveStrategy === 'label' ? opt.label : String(opt.value),
      );
    }
    const optionsValue = this.fieldForm.get('options')?.value || '';
    if (!optionsValue) return [];
    return this.parseQuotedOptions(optionsValue);
  }

  /**
   * Parse options from double-quoted format: "Option 1" "Option 2" "Option 3"
   * Returns array of trimmed option strings
   */
  private parseQuotedOptions(optionsString: string): string[] {
    if (!optionsString || !optionsString.trim()) return [];

    // Match all text within double quotes
    const regex = /"([^"]*)"/g;
    const options: string[] = [];
    let match;

    while ((match = regex.exec(optionsString)) !== null) {
      const option = match[1].trim();
      if (option) {
        options.push(option);
      }
    }

    return options;
  }

  private getApiCacheKey(config: {
    url?: string;
    itemsPath?: string;
    labelField?: string;
    valueField?: string;
    saveStrategy?: string;
  }): string {
    return JSON.stringify({
      url: config.url || '',
      itemsPath: config.itemsPath || '',
      labelField: config.labelField || '',
      valueField: config.valueField || '',
      saveStrategy: config.saveStrategy || 'value',
    });
  }

  applyApiPreset(fieldName: string) {
    if (!fieldName) return;
    const preset = this.apiPresets().find((p) => p.fromField === fieldName);
    if (!preset) return;
    this.fieldForm.patchValue(
      {
        selectSource: 'api',
        apiMode: 'reuse',
        apiPresetField: fieldName,
        apiUrl: preset.config.url || '',
        apiItemsPath: preset.config.itemsPath || '',
        apiLabelField: preset.config.labelField || '',
        apiValueField: preset.config.valueField || '',
        apiSaveStrategy: preset.config.saveStrategy || 'value',
      },
      { emitEvent: false },
    );
    this.fetchApiPreview();
  }

  onPresetChange(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value || '';
    this.applyApiPreset(value);
  }

  private getApiConfigFromForm() {
    return {
      url: this.fieldForm.value.apiUrl || '',
      itemsPath: this.fieldForm.value.apiItemsPath || '',
      labelField: this.fieldForm.value.apiLabelField || '',
      valueField: this.fieldForm.value.apiValueField || '',
      saveStrategy: this.fieldForm.value.apiSaveStrategy || 'value',
    };
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

    if (fieldData.type === 'file') {
      validators.push((control: { value: File[] | null }) => {
        const files = control.value as File[] | null;
        const count = Array.isArray(files) ? files.length : 0;
        const errors: any = {};

        if (fieldData.required && count === 0) {
          errors.required = true;
        }
        if (
          fieldData.validation?.minFiles !== undefined &&
          count < fieldData.validation.minFiles
        ) {
          errors.minFiles = {
            minFiles: fieldData.validation.minFiles,
            actual: count,
          };
        }
        if (
          fieldData.validation?.maxFiles !== undefined &&
          count > fieldData.validation.maxFiles
        ) {
          errors.maxFiles = {
            maxFiles: fieldData.validation.maxFiles,
            actual: count,
          };
        }

        return Object.keys(errors).length ? errors : null;
      });
    }

    // Create FormControl with validators
    const control = new FormControl(
      this.getDefaultValue(fieldData),
      Validators.compose(validators),
    );

    return control;
  }

  private getDefaultValue(fieldData: FormField) {
    if (fieldData.type === 'checkbox') {
      return Boolean(fieldData.default);
    }

    if (fieldData.type === 'number') {
      if (
        fieldData.default === '' ||
        fieldData.default === undefined ||
        fieldData.default === null
      ) {
        return null;
      }
      const numeric = Number(fieldData.default);
      return Number.isNaN(numeric) ? null : numeric;
    }

    if (fieldData.type === 'select') {
      return fieldData.default ?? '';
    }

    if (fieldData.type === 'file') {
      return null;
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
    const hasFormTarget =
      this.formsService.getCurrentFormId() || this.formName()?.trim();
    if (!hasFormTarget) {
      alert('Please select or create a form before adding fields.');
      return;
    }

    if (this.fieldForm.invalid) {
      this.fieldForm.markAllAsTouched();
      return;
    }

    if (this.fieldForm.valid) {
      const value = this.fieldForm.value;
      // Parse options from double-quoted format
      const options = value.options
        ? this.parseQuotedOptions(value.options)
        : undefined;

      const minValue = this.toNumberValue(value.min);
      const maxValue = this.toNumberValue(value.max);
      const step = this.toNumberValue(value.step);

      const selectSource = (value.selectSource as 'manual' | 'api') || 'manual';

      const fieldData: FormField = {
        label: value.label!,
        name: value.name!,
        type: value.type || 'text',
        required: value.required || false,
        selectSource: value.type === 'select' ? selectSource : undefined,
        options:
          value.type === 'select' && selectSource === 'manual'
            ? options
            : undefined,
        apiOptions:
          value.type === 'select' && selectSource === 'api'
            ? {
                url: value.apiUrl || '',
                method: 'GET',
                itemsPath: value.apiItemsPath || '',
                labelField: value.apiLabelField || '',
                valueField: value.apiValueField || '',
                saveStrategy: value.apiSaveStrategy || 'value',
              }
            : undefined,
        default:
          value.type === 'checkbox'
            ? Boolean(value.default)
            : value.type === 'number'
              ? (this.toNumberValue(value.default) ?? null)
              : value.type === 'file'
                ? null
                : (value.default ?? ''),
        validation: {
          // For text type: only include minLength/maxLength if pattern is not set
          minLength:
            value.type === 'text' && !value.pattern ? minValue : undefined,
          maxLength:
            value.type === 'text' && !value.pattern ? maxValue : undefined,
          minValue: value.type === 'number' ? minValue : undefined,
          maxValue: value.type === 'number' ? maxValue : undefined,
          step: value.type === 'number' ? step : undefined,
          pattern:
            value.type === 'text' ? value.pattern || undefined : undefined,
          regexType:
            value.type === 'text' ? value.regexType || undefined : undefined,
          minFiles: value.type === 'file' ? minValue : undefined,
          maxFiles: value.type === 'file' ? maxValue : undefined,
        },
      };

      const editingIdx = this.editingIndex();
      const normalizedName = fieldData.name.trim().toLowerCase();
      const duplicate = this.fields().some(
        (f, i) =>
          i !== editingIdx && f.name.trim().toLowerCase() === normalizedName,
      );
      if (duplicate) {
        this.fieldForm.get('name')?.setErrors({ duplicate: true });
        alert('Field name must be unique within a form.');
        return;
      }

      // Create FormControl with validators
      const formControl = this.createFormControl(fieldData);
      const field: FormField = { ...fieldData, formValue: formControl };

      if (editingIdx !== null) {
        // Update existing field with a fresh FormControl
        this.fields.update((fields) =>
          fields.map((f, i) => (i === editingIdx ? field : f)),
        );
        this.editingIndex.set(null);
      } else {
        // Add new field
        this.fields.update((fields) => [...fields, field]);
      }
      this.saveFields();
      this.resetForm();
    }
  }

  editingIndex = signal<number | null>(null);

  editField(field: FormField, index: number) {
    this.editingIndex.set(index);
    const defaultValue =
      field.type === 'checkbox'
        ? Boolean(field.default)
        : field.type === 'number'
          ? (field.default ?? null)
          : field.type === 'file'
            ? null
            : (field.default ?? '');
    this.fieldForm.patchValue({
      label: field.label,
      name: field.name,
      type: field.type,
      required: field.required,
      default: defaultValue as any,
      // Convert options array back to double-quoted format for editing
      options: field.options?.map((opt) => `"${opt}"`).join(' ') || '',
      selectSource: field.selectSource || 'manual',
      apiMode: 'new',
      apiPresetField: '',
      apiUrl: field.apiOptions?.url || '',
      apiItemsPath: field.apiOptions?.itemsPath || '',
      apiLabelField: field.apiOptions?.labelField || '',
      apiValueField: field.apiOptions?.valueField || '',
      apiSaveStrategy: field.apiOptions?.saveStrategy || 'value',
      min:
        field.type === 'text'
          ? field.validation?.minLength?.toString() || ''
          : field.validation?.minValue?.toString() || '',
      max:
        field.type === 'text'
          ? field.validation?.maxLength?.toString() || ''
          : field.validation?.maxValue?.toString() || '',
      step: field.validation?.step?.toString() || '',
      pattern: field.validation?.pattern || '',
      regexType: field.validation?.regexType || 'predefined',
    });
  }

  deleteField(index: number) {
    this.fields.update((fields) => fields.filter((_, i) => i !== index));
    this.saveFields();
  }

  sortByLabel() {
    const dir = this.sortDirection() === 'asc' ? 'desc' : 'asc';
    this.sortDirection.set(dir);
    this.fields.update((fields) =>
      [...fields].sort((a, b) =>
        dir === 'asc'
          ? a.label.localeCompare(b.label)
          : b.label.localeCompare(a.label),
      ),
    );
    this.saveFields();
  }

  onDragStart(index: number) {
    this.draggingIndex.set(index);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, index: number) {
    event.preventDefault();
    const from = this.draggingIndex();
    if (from === null || from === index) {
      this.draggingIndex.set(null);
      return;
    }
    const updated = [...this.fields()];
    const [moved] = updated.splice(from, 1);
    updated.splice(index, 0, moved);
    this.fields.set(updated);
    this.draggingIndex.set(null);
    this.saveFields();
  }

  resetForm() {
    this.fieldForm.reset({
      type: 'text',
      required: false,
      default: '',
      options: '',
      selectSource: 'manual',
      apiMode: 'new',
      apiPresetField: '',
      apiSaveStrategy: 'value',
      regexType: 'predefined',
    });
    this.editingIndex.set(null);
    this.apiPreviewOptions.set([]);
    this.apiPreviewLoading.set(false);
    this.apiPreviewError.set(null);
  }

  fetchApiPreview(forceRefresh = false) {
    if (this.fieldForm.value.selectSource !== 'api') return;
    const url = this.fieldForm.value.apiUrl;
    if (!url) {
      this.apiPreviewError.set('API URL is required');
      return;
    }

    const apiConfig = this.getApiConfigFromForm();
    if (!forceRefresh) {
      const cached = this.apiCacheService.get(apiConfig);
      if (cached) {
        this.apiPreviewOptions.set(cached);
        this.apiPreviewError.set(null);
        return;
      }
    }

    this.apiPreviewLoading.set(true);
    this.apiPreviewError.set(null);

    this.http.get(url).subscribe({
      next: (res: any) => {
        const list = this.extractItems(
          res,
          this.fieldForm.value.apiItemsPath || '',
        );
        const mapped = Array.isArray(list)
          ? list
              .map((item) => this.mapOption(item))
              .filter((x): x is { label: string; value: any } => !!x)
          : [];
        if (!mapped.length) {
          this.apiPreviewError.set('No options returned from API');
        }
        this.apiPreviewOptions.set(mapped);
        this.apiCacheService.set(apiConfig, mapped);
        this.apiPreviewLoading.set(false);
      },
      error: () => {
        this.apiPreviewError.set('Failed to load options');
        this.apiPreviewLoading.set(false);
      },
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

  private mapOption(item: any): { label: string; value: any } | null {
    const labelKey = this.fieldForm.value.apiLabelField;
    const valueKey = this.fieldForm.value.apiValueField;
    const saveStrategy = this.fieldForm.value.apiSaveStrategy || 'value';
    const label = labelKey ? item?.[labelKey] : item;
    const rawValue = valueKey ? item?.[valueKey] : item;
    const value = saveStrategy === 'label' ? label : rawValue;
    if (label === undefined || value === undefined) return null;
    return { label: String(label), value };
  }

  apiPreviewOptionsSaveValue(opt: { label: string; value: any }): string {
    return String(opt.value);
  }

  private saveFields(): void {
    // Save fields without formValue (FormControls can't be serialized)
    const fieldsToSave = this.fields().map((field) => {
      const { formValue, ...fieldWithoutFormControl } = field;
      return fieldWithoutFormControl;
    });

    let formId = this.formsService.getCurrentFormId();
    let formName = this.formName()?.trim() || null;

    if (!formId && !formName) {
      console.warn('No form selected; fields not saved.');
      alert('Please select or create a form before saving fields.');
      return;
    }

    const saved = this.formsService.saveFormFields(
      formId,
      fieldsToSave,
      formName,
    );
    if (!saved) {
      console.warn('Form not resolved, fields not saved to forms list');
    }
  }

  private loadFields(formId?: string | null, formName?: string | null): void {
    const fieldsData = this.formsService.getFormFields(formId, formName);

    if (fieldsData && fieldsData.length > 0) {
      // Recreate FormControls for each field
      const fieldsWithControls: FormField[] = fieldsData.map((fieldData) => {
        const formControl = this.createFormControl(fieldData as FormField);
        return { ...fieldData, formValue: formControl };
      });
      this.fields.set(fieldsWithControls);
    } else {
      const legacyFields = this.storageService.getItem<
        Omit<FormField, 'formValue'>[]
      >(this.STORAGE_KEY);
      if (legacyFields && legacyFields.length > 0) {
        const fieldsWithControls: FormField[] = legacyFields.map(
          (fieldData) => {
            const formControl = this.createFormControl(fieldData as FormField);
            return { ...fieldData, formValue: formControl };
          },
        );
        this.fields.set(fieldsWithControls);
        this.saveFields();
        this.storageService.removeItem(this.STORAGE_KEY);
      } else {
        this.fields.set([]);
      }
    }
  }
}
