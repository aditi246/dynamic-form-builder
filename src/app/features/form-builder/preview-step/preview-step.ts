import { Component, output, OnInit, OnDestroy, signal, effect } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
  FormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormField } from '../fields-step/fields-step';
import { Subscription } from 'rxjs';
import { FormsManagementService, SavedForm } from '../../../shared/services/forms-management.service';
import { IconComponent } from '../../../components/icon/icon';
import { AudioTextareaComponent } from '../../../components/audio-textarea/audio-textarea';
import { FileInputComponent } from '../../../components/input-file/input-file';
import { FormConfigService } from '../../../shared/services/form-config.service';
import { RulesEngineService } from '../../../shared/services/rules-engine.service';
import { OpenAiService } from '../../../shared/services/open-ai.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface FilePreviewEntry {
  file: File;
  previewUrl?: string;
  isBlurry?: boolean;
}

@Component({
  selector: 'app-preview-step',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, IconComponent, AudioTextareaComponent, HttpClientModule, FileInputComponent],
  templateUrl: './preview-step.html'
})
export class PreviewStep implements OnInit, OnDestroy {
  nextStep = output<Record<string, any>>();
  backStep = output<void>();

  fields = signal<FormField[]>([]);
  previewForm = new FormGroup({});
  hiddenFields = signal<Set<string>>(new Set());
  selectOptions = signal<Record<string, { label: string; value: any }[]>>({});
  loadingOptions = signal<Record<string, boolean>>({});
  optionErrors = signal<Record<string, string>>({});
  hiddenOptionValues = signal<Record<string, Set<string>>>({});
  contextFieldNames = signal<Set<string>>(new Set());
  filePreviews = signal<Record<string, FilePreviewEntry[]>>({});
  blurryWarnings = signal<Record<string, number | null>>({});
  analyzingImages = signal<Record<string, number | null>>({});
  isContextField = (name: string) => this.contextFieldNames().has(name);

  private valueChangesSub?: Subscription;

  constructor(
    private formConfigService: FormConfigService,
    private rulesEngineService: RulesEngineService,
    private formsService: FormsManagementService,
    private openAiService: OpenAiService,
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

  ngOnDestroy() {
    this.valueChangesSub?.unsubscribe();
  }

  private loadFields(formId?: string | null, formName?: string | null) {
    const fieldsData = this.formsService.getFormFields(formId, formName) || [];
    const contextFields = this.getUserContextFields();
    const mergedFields: FormField[] = [
      ...contextFields.filter(ctx => !fieldsData.some(f => f.name === ctx.name)),
      ...(fieldsData as FormField[])
    ];

    if (mergedFields && mergedFields.length > 0) {
      this.contextFieldNames.set(new Set(contextFields.map(f => f.name)));
      this.filePreviews.set({});
      this.blurryWarnings.set({});
      this.analyzingImages.set({});
      this.fields.set(mergedFields as FormField[]);
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
    this.filePreviews.set({});
    this.blurryWarnings.set({});
    this.analyzingImages.set({});
    this.valueChangesSub?.unsubscribe();
  }

  private getUserContextFields(): FormField[] {
    const ctx = this.formsService.getFormContext(this.formsService.getCurrentFormId()) || [];
    return ctx.map(entry => ({
      label: entry.displayName || entry.key,
      name: entry.key,
      type: 'text',
      required: true,
      default: entry.value
    }));
  }

  private buildForm() {
    const group: { [key: string]: FormControl } = {};
    const contextValues = this.formsService.getFormContext(
      this.formsService.getCurrentFormId()
    ) || [];
    
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
      
      if (field.type === 'file') {
        validators.push(this.buildFileValidator(field));
      }
      
      // Set default value
      let defaultValue: any = '';
      const ctxValue = contextValues.find(entry => entry.key === field.name)?.value;

      if (ctxValue !== undefined && ctxValue !== null) {
        defaultValue = ctxValue;
      } else if (field.default !== undefined && field.default !== null && field.default !== '') {
        defaultValue = field.default;
      } else {
        if (field.type === 'checkbox') {
          defaultValue = false;
        } else if (field.type === 'number') {
          defaultValue = null;
        } else if (field.type === 'file') {
          defaultValue = [];
        }
      }
      
      group[field.name] = new FormControl(defaultValue, validators.length > 0 ? Validators.compose(validators) : null);
    });
    
    this.previewForm = new FormGroup(group);
  }

  private applyRules() {
    const contextValues = this.formsService.getFormContext(
      this.formsService.getCurrentFormId()
    ) || [];
    const evaluationValues = {
      ...contextValues.reduce((acc, entry) => ({ ...acc, [entry.key]: entry.value }), {}),
      ...this.previewForm.getRawValue()
    };

    const evaluation = this.rulesEngineService.evaluate(
      this.formConfigService.rules(),
      evaluationValues,
      this.fields()
    );

    this.hiddenFields.set(evaluation.hiddenFields);
    this.hiddenOptionValues.set(evaluation.optionHides);

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
    if (control.errors['minFiles']) {
      return `Upload at least ${control.errors['minFiles'].minFiles} file(s).`;
    }
    if (control.errors['maxFiles']) {
      return `Upload no more than ${control.errors['maxFiles'].maxFiles} file(s).`;
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
    const hiddenSet = this.hiddenOptionValues()[field.name] || new Set<string>();
    if (field.selectSource === 'api') {
      const loaded = this.selectOptions()[field.name];
      if (loaded && loaded.length) {
        return loaded.filter(opt => !hiddenSet.has(String(opt.value)));
      }
    }
    return (field.options || [])
      .map(opt => ({ label: opt, value: opt }))
      .filter(opt => !hiddenSet.has(String(opt.value)));
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

  private buildFileValidator(field: FormField): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const files = control.value as File[] | null;
      const count = Array.isArray(files) ? files.length : 0;
      const errors: any = {};

      if (field.required && count === 0) {
        errors.required = true;
      }
      if (field.validation?.minFiles !== undefined && count < field.validation.minFiles) {
        errors.minFiles = { minFiles: field.validation.minFiles, actual: count };
      }
      if (field.validation?.maxFiles !== undefined && count > field.validation.maxFiles) {
        errors.maxFiles = { maxFiles: field.validation.maxFiles, actual: count };
      }

      return Object.keys(errors).length ? errors : null;
    };
  }

  onBack() {
    this.backStep.emit();
  }

  onSubmit() {
    this.nextStep.emit(this.previewForm.getRawValue());
  }

  onAiCommandChange(text: string) {
    if (!text || !text.trim()) {
      return;
    }

    const prompt = this.openAiService.prepareFormPrompt(
      text,
      this.fields(),
      this.previewForm.value
    );

    this.openAiService.generateText(prompt).subscribe({
      next: (response) => {
        try {
          const aiText = response.choices[0]?.message?.content?.trim() || '';
          if (!aiText) {
            console.error('No text in AI response');
            return;
          }

          const jsonMatch = aiText.match(/\{[\s\S]*\}/);
          const jsonText = jsonMatch ? jsonMatch[0] : aiText;
          const formValues = JSON.parse(jsonText);
          console.log(formValues);

          this.previewForm.patchValue(formValues);
        } catch (error) {
          console.error('Error parsing AI response:', error);
        }
      },
      error: (err) => {
        console.error('AI service error:', err);
      }
    });
  }

  onFileUpload(file: File) {
    this.openAiService.extractDataFromFile(file, this.fields(), this.previewForm.value).subscribe({
      next: (response) => {
        try {
          const textContent =
            response?.output_text ||
            response?.output?.[0]?.content?.[0]?.text ||
            response?.choices?.[0]?.message?.content ||
            '';

          if (!textContent) {
            console.error('No content in AI response');
            return;
          }

          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          const jsonText = jsonMatch ? jsonMatch[0] : textContent;
          const formValues = JSON.parse(jsonText);
          console.log('Extracted form values from file:', formValues);

          this.previewForm.patchValue(formValues);
        } catch (error) {
          console.error('Error parsing AI response from file:', error);
        }
      },
      error: (err) => {
        console.error('AI file extraction error:', err);
      }
    });
  }

  async onFilesAdded(field: FormField, files: File[]) {
    if (!files || !files.length) return;
    const current = this.filePreviews()[field.name] || [];
    const previews = await Promise.all(files.map((file) => this.toPreviewEntry(file)));
    const updated = [...current, ...previews];
    this.updateFieldFiles(field.name, updated);

    previews.forEach((preview, idx) => {
      const absoluteIndex = current.length + idx;
      this.runBlurCheck(field.name, absoluteIndex, preview.file);
    });
  }

  onRemoveFile(fieldName: string, index: number) {
    const current = this.filePreviews()[fieldName] || [];
    if (index < 0 || index >= current.length) return;
    const updated = current.filter((_, i) => i !== index);
    this.updateFieldFiles(fieldName, updated);
    this.setBlurryWarning(fieldName, null);
  }

  onBlurryAction(fieldName: string, event: { action: 'reupload' | 'keep'; index: number }) {
    if (event.action === 'reupload') {
      this.onRemoveFile(fieldName, event.index);
    } else {
      this.setBlurryWarning(fieldName, null);
    }
  }

  getAcceptForField(field: FormField): string {
    if (field.fileType === 'all') return '*/*';
    return 'image/*';
  }

  private async toPreviewEntry(file: File): Promise<FilePreviewEntry> {
    const previewUrl = file.type?.startsWith('image/')
      ? await this.fileToDataUrl(file)
      : undefined;
    return { file, previewUrl };
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private updateFieldFiles(fieldName: string, files: FilePreviewEntry[]) {
    this.filePreviews.update((map) => ({ ...map, [fieldName]: files }));
    const control = this.getFieldControl(fieldName);
    if (control) {
      control.setValue(files.length ? files.map((f) => f.file) : null);
      control.markAsTouched();
      control.updateValueAndValidity();
    }
  }

  private async runBlurCheck(fieldName: string, index: number, file: File) {
    this.setAnalyzingImage(fieldName, index);
    try {
      const observable = await this.openAiService.checkUploadedImage(file);
      observable?.subscribe({
        next: (res: any) => {
          this.setAnalyzingImage(fieldName, null);
          this.handleBlurResult(fieldName, index, res);
        },
        error: (err) => {
          this.setAnalyzingImage(fieldName, null);
          console.error('AI blur check failed', err);
        },
      });
    } catch (err) {
      this.setAnalyzingImage(fieldName, null);
      console.error('AI blur check failed', err);
    }
  }

  private handleBlurResult(fieldName: string, index: number, response: any) {
    const result = this.extractBlurResult(response);
    if (!result) return;

    this.filePreviews.update((map) => {
      const current = map[fieldName] || [];
      if (!current[index]) return map;
      const updated = [...current];
      updated[index] = { ...updated[index], isBlurry: result.isBlurry };
      return { ...map, [fieldName]: updated };
    });

    if (result.recommendReupload) {
      this.setBlurryWarning(fieldName, index);
    }
  }

  private extractBlurResult(response: any): { isBlurry: boolean; recommendReupload: boolean } | null {
    if (!response) return null;

    const textContent =
      response?.output_text ||
      response?.output?.[0]?.content?.[0]?.text ||
      response?.choices?.[0]?.message?.content;

    let payload: any = null;
    if (typeof textContent === 'string') {
      try {
        payload = JSON.parse(textContent);
      } catch {
        const match = textContent.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            payload = JSON.parse(match[0]);
          } catch {
            payload = null;
          }
        }
      }
    }

    if (!payload && typeof response === 'object') {
      payload = response;
    }

    if (!payload) return null;

    const isBlurry = payload.is_blurry ?? payload.isBlurry ?? payload.blurry ?? false;
    const recommendReupload =
      payload.recommend_reupload ?? payload.reupload ?? payload.is_blurry ?? false;

    return { isBlurry: Boolean(isBlurry), recommendReupload: Boolean(recommendReupload) };
  }

  private setBlurryWarning(fieldName: string, index: number | null) {
    this.blurryWarnings.update((map) => ({ ...map, [fieldName]: index }));
  }

  private setAnalyzingImage(fieldName: string, index: number | null) {
    this.analyzingImages.update((map) => ({ ...map, [fieldName]: index }));
  }
}
