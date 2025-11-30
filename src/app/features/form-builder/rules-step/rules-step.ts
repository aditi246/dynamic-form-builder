import {
  Component,
  OnInit,
  signal,
  computed,
  output,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import {
  FormConfigService,
  CustomRule,
  RuleCondition,
  ConditionOperator,
  RuleAction,
} from '../../../shared/services/form-config.service';
import { FormsManagementService } from '../../../shared/services/forms-management.service';
import { FormField } from '../fields-step/fields-step';
import { IconComponent } from '../../../components/icon/icon';
import { ApiCacheService } from '../../../shared/services/api-cache.service';
import { BuilderTourService } from '../tutorial/builder-tour.service';

@Component({
  selector: 'app-rules-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, HttpClientModule],
  templateUrl: './rules-step.html',
})
export class RulesStep implements OnInit {
  nextStep = output<void>();
  backStep = output<void>();

  fields = signal<FormField[]>([]);
  userContextEntriesSignal = signal<
    { key: string; displayName: string; value: string }[]
  >([]);
  targetFields = computed(() => this.fields());
  rules = computed(() => this.formConfigService.rules());
  selectOptions = signal<Record<string, { label: string; value: any }[]>>({});
  loadingOptions = signal<Record<string, boolean>>({});
  optionErrors = signal<Record<string, string>>({});
  groupedRules = computed(() => {
    const groups: { targetField: string; rules: CustomRule[] }[] = [];
    const byTarget: Record<string, CustomRule[]> = {};
    this.rules().forEach((rule) => {
      if (!byTarget[rule.action.targetField]) {
        byTarget[rule.action.targetField] = [];
      }
      byTarget[rule.action.targetField].push(rule);
    });
    Object.keys(byTarget).forEach((target) => {
      groups.push({ targetField: target, rules: byTarget[target] });
    });
    return groups;
  });
  collapsedMap = signal<Record<string, boolean>>({});
  editingRuleId = signal<string | null>(null);
  conditions = signal<RuleCondition[]>([]);
  showContextModal = signal<boolean>(false);
  contextForm = new FormArray<FormGroup>([]);
  contextFormGroup = new FormGroup({
    entries: this.contextForm,
  });

  ruleForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    targetField: new FormControl('', [Validators.required]),
    actionType: new FormControl<'validation' | 'visibility' | 'options'>(
      'validation',
      [Validators.required],
    ),
    comparator: new FormControl<
      '<' | '<=' | '>' | '>=' | '==' | '!=' | 'contains' | 'not-contains'
    >('<=' as any, [Validators.required]),
    thresholdType: new FormControl<'static' | 'field'>('static', [
      Validators.required,
    ]),
    thresholdValue: new FormControl(''),
    thresholdField: new FormControl(''),
    thresholdOffset: new FormControl<string>(''),
    hideOptionValues: new FormControl<string[]>([]),
    optionHideMode: new FormControl<'static' | 'source-field'>('static'),
    optionSourceField: new FormControl<string[]>([]),
    errorMessage: new FormControl('Value must satisfy the rule'),
    visibilityBehavior: new FormControl<'hide' | 'show'>('hide', [
      Validators.required,
    ]),
  });

  conditionDraft = new FormGroup({
    field: new FormControl('', [Validators.required]),
    operator: new FormControl<ConditionOperator>('equals', [
      Validators.required,
    ]),
    value: new FormControl(''),
    multiValues: new FormControl<string[]>([]),
  });

  conditionOperators = [
    { label: 'Equals', value: 'equals' as ConditionOperator },
    { label: 'Not equals', value: 'notEquals' as ConditionOperator },
    { label: 'Contains', value: 'contains' as ConditionOperator },
    { label: 'Does not contain', value: 'not-contains' as ConditionOperator },
    { label: 'Greater than', value: 'gt' as ConditionOperator },
    { label: 'Greater or equal', value: 'gte' as ConditionOperator },
    { label: 'Less than', value: 'lt' as ConditionOperator },
    { label: 'Less or equal', value: 'lte' as ConditionOperator },
    { label: 'Is true', value: 'isTrue' as ConditionOperator },
    { label: 'Is false', value: 'isFalse' as ConditionOperator },
  ];

  numericComparators = [
    { label: 'Less than (<)', value: '<' },
    { label: 'Less than or equal (≤)', value: '<=' },
    { label: 'Greater than (>)', value: '>' },
    { label: 'Greater than or equal (≥)', value: '>=' },
    { label: 'Equal (==)', value: '==' },
    { label: 'Not equal (!=)', value: '!=' },
  ];

  textComparators = [
    { label: 'Equals', value: '==' },
    { label: 'Not equal', value: '!=' },
    { label: 'Contains', value: 'contains' },
    { label: 'Does not contain', value: 'not-contains' },
  ];

  private tourOriginalActionType:
    | 'validation'
    | 'visibility'
    | 'options'
    | null = null;
  private tourOriginalTargetField: string | null = null;

  constructor(
    private formConfigService: FormConfigService,
    private formsService: FormsManagementService,
    private http: HttpClient,
    private apiCacheService: ApiCacheService,
    private tour: BuilderTourService,
  ) {
    effect(() => {
      this.formsService.forms(); // react when fields list updates
      const formId = this.formsService.getCurrentFormId();
      const formName = this.formsService.getCurrentFormName();
      if (formId || formName) {
        this.loadFields();
        this.formConfigService.setFields(this.fields());
      } else {
        this.fields.set([]);
      }
    });

    effect(() => {
      const groups = this.groupedRules();
      this.collapsedMap.update((map) => {
        const next = { ...map };
        // default new groups to collapsed
        groups.forEach((g) => {
          if (next[g.targetField] === undefined) {
            next[g.targetField] = true;
          }
        });
        // prune removed targets
        Object.keys(next).forEach((key) => {
          if (!groups.find((g) => g.targetField === key)) {
            delete next[key];
          }
        });
        return next;
      });
    });

    this.ruleForm.get('targetField')?.valueChanges.subscribe(() => {
      this.updateOptionControlsAvailability();
    });

    this.ruleForm.get('thresholdType')?.valueChanges.subscribe((type) => {
      if (type === 'field') {
        this.ruleForm.get('thresholdValue')?.setValue('', { emitEvent: false });
      } else {
        this.ruleForm.get('thresholdField')?.setValue('', { emitEvent: false });
      }
      this.syncThresholdValidators();
    });

    this.ruleForm.get('actionType')?.valueChanges.subscribe((action) => {
      this.syncThresholdValidators();
      const sourceCtrl = this.ruleForm.get('optionSourceField');
      if (action !== 'options') {
        sourceCtrl?.clearValidators();
        sourceCtrl?.updateValueAndValidity({ emitEvent: false });
      } else if (this.ruleForm.value.optionHideMode === 'source-field') {
        sourceCtrl?.setValidators([Validators.required]);
        sourceCtrl?.updateValueAndValidity({ emitEvent: false });
      }
      this.updateOptionControlsAvailability();
    });

    this.ruleForm.get('optionHideMode')?.valueChanges.subscribe((mode) => {
      const sourceCtrl = this.ruleForm.get('optionSourceField');
      if (mode === 'source-field') {
        this.ruleForm
          .get('hideOptionValues')
          ?.setValue([], { emitEvent: false });
        sourceCtrl?.setValidators([Validators.required]);
      } else {
        this.ruleForm
          .get('optionSourceField')
          ?.setValue([], { emitEvent: false });
        sourceCtrl?.clearValidators();
      }
      sourceCtrl?.updateValueAndValidity({ emitEvent: false });
      this.updateOptionControlsAvailability();
    });

    effect(() => {
      const step = this.tour.currentStep();
      if (!this.tour.isActive() || !step) {
        this.restoreTourActionState();
        return;
      }

      const isActionStep =
        step.id === 'rules-validation' ||
        step.id === 'rules-visibility' ||
        step.id === 'rules-hide-options';

      if (!isActionStep) {
        this.restoreTourActionState();
        return;
      }

      if (!this.tourOriginalActionType) {
        this.tourOriginalActionType =
          (this.ruleForm.value.actionType as
            | 'validation'
            | 'visibility'
            | 'options') || 'validation';
      }
      if (!this.tourOriginalTargetField) {
        this.tourOriginalTargetField = this.ruleForm.value.targetField || '';
      }

      if (step.id === 'rules-hide-options') {
        const currentTarget = this.ruleForm.value.targetField || '';
        if (!currentTarget || !this.isSelectField(currentTarget)) {
          const firstSelect = this.fields().find((f) => f.type === 'select');
          if (firstSelect) {
            this.ruleForm.patchValue(
              { targetField: firstSelect.name },
              { emitEvent: true },
            );
          }
        }
        this.ruleForm.patchValue(
          { actionType: 'options' },
          { emitEvent: true },
        );
      } else if (step.id === 'rules-visibility') {
        this.ruleForm.patchValue(
          { actionType: 'visibility' },
          { emitEvent: true },
        );
      } else {
        this.ruleForm.patchValue(
          { actionType: 'validation' },
          { emitEvent: true },
        );
      }
    });

    this.syncThresholdValidators();
    this.updateOptionControlsAvailability();
  }

  ngOnInit() {
    this.loadFields();
    this.formConfigService.setFields(this.fields());
  }

  private loadFields() {
    const formId = this.formsService.getCurrentFormId();
    const formName = this.formsService.getCurrentFormName();
    const fieldsData = this.formsService.getFormFields(formId, formName) || [];
    const ctx = this.formsService.getFormContext(formId) || [];
    this.userContextEntriesSignal.set(ctx);
    this.fields.set((fieldsData as FormField[]) || []);
    this.loadSelectOptions();
  }

  isSelectField(name: string): boolean {
    return !!this.fields().find((f) => f.name === name && f.type === 'select');
  }

  private restoreTourActionState() {
    if (this.tourOriginalActionType) {
      this.ruleForm.patchValue(
        { actionType: this.tourOriginalActionType },
        { emitEvent: true },
      );
    }
    if (this.tourOriginalTargetField) {
      this.ruleForm.patchValue(
        { targetField: this.tourOriginalTargetField },
        { emitEvent: true },
      );
    }
    this.tourOriginalActionType = null;
    this.tourOriginalTargetField = null;
  }

  openContextModal() {
    const ctx = this.userContextEntriesSignal();
    this.buildContextForm(ctx);
    this.showContextModal.set(true);
  }

  closeContextModal() {
    this.showContextModal.set(false);
  }

  addContextRow() {
    this.contextForm.push(
      new FormGroup({
        key: new FormControl('', [Validators.required]),
        displayName: new FormControl('', [Validators.required]),
        value: new FormControl(''),
      }),
    );
  }

  removeContextRow(index: number) {
    if (index >= 0 && index < this.contextForm.length) {
      this.contextForm.removeAt(index);
    }
  }

  saveContextRows() {
    const formId = this.formsService.getCurrentFormId();
    if (!formId) {
      this.closeContextModal();
      return;
    }
    const previousKeys = new Set(
      (this.userContextEntriesSignal() || []).map((e) => e.key),
    );
    const normalized =
      this.contextForm.controls
        .map((group) => {
          const key = String(group.get('key')?.value || '').trim();
          const displayName = String(
            group.get('displayName')?.value || '',
          ).trim();
          const value = String(group.get('value')?.value || '');
          if (!key || !displayName) return null;
          return { key, displayName, value };
        })
        .filter((x): x is { key: string; displayName: string; value: string } =>
          Boolean(x),
        ) || [];

    const nextKeys = new Set(normalized.map((n) => n.key));
    const removedKeys: string[] = [];
    previousKeys.forEach((k) => {
      if (!nextKeys.has(k)) removedKeys.push(k);
    });

    if (removedKeys.length) {
      const rules = this.formConfigService.rules();
      const affected = rules.filter((r) =>
        r.conditions?.some((c) => removedKeys.includes(c.field)),
      );
      if (affected.length) {
        const proceed = confirm(
          `You removed ${removedKeys.join(', ')} from user context. There are ${affected.length} rule(s) using those keys. Remove those rules and continue?`,
        );
        if (!proceed) {
          return;
        }
        this.formConfigService.removeRulesByIds(affected.map((r) => r.id));
      }
    }

    this.formsService.updateForm(formId, { userContext: normalized });
    this.userContextEntriesSignal.set(normalized);
    this.closeContextModal();
  }

  private buildContextForm(
    entries: { key: string; displayName: string; value: string }[],
  ) {
    while (this.contextForm.length) {
      this.contextForm.removeAt(0);
    }
    if (!entries || !entries.length) {
      this.addContextRow();
      return;
    }
    entries.forEach((entry) => {
      this.contextForm.push(
        new FormGroup({
          key: new FormControl(entry.key, [Validators.required]),
          displayName: new FormControl(entry.displayName, [
            Validators.required,
          ]),
          value: new FormControl(entry.value || ''),
        }),
      );
    });
  }

  addCondition() {
    if (this.conditionDraft.invalid) return;
    const value = this.conditionDraft.value;
    const condition: RuleCondition = {
      field: value.field || '',
      operator: (value.operator as ConditionOperator) || 'equals',
      value:
        value.operator === 'isTrue' || value.operator === 'isFalse'
          ? undefined
          : value.value || undefined,
      values: this.isSelectField(value.field || '')
        ? value.multiValues || []
        : undefined,
    };
    this.conditions.update((list) => [...list, condition]);
    this.conditionDraft.reset({ operator: 'equals', multiValues: [] });
  }

  removeCondition(index: number) {
    this.conditions.update((list) => list.filter((_, i) => i !== index));
  }

  saveRule(keepTarget = false) {
    const formValue = this.ruleForm.value;
    const targetField = formValue.targetField;
    const actionType = formValue.actionType;

    if (this.ruleForm.invalid) {
      this.ruleForm.markAllAsTouched();
      return;
    }

    if (!targetField || !actionType) {
      this.ruleForm.markAllAsTouched();
      return;
    }

    if (!formValue.name || !formValue.name.trim()) {
      this.ruleForm.get('name')?.markAsTouched();
      return;
    }

    const targetDef = this.fields().find((f) => f.name === targetField);
    const targetType = targetDef?.type;

    let action: RuleAction;
    if (actionType === 'visibility') {
      action = {
        type:
          formValue.visibilityBehavior === 'show' ? 'show-field' : 'hide-field',
        targetField,
      };
    } else if (actionType === 'options') {
      if (!this.isTargetSelect()) {
        alert('Hide options is only available for select fields.');
        return;
      }
      const hideMode = formValue.optionHideMode || 'static';
      const sourceFields =
        hideMode === 'source-field'
          ? this.normalizeSourceFields(formValue.optionSourceField)
          : [];
      if (hideMode === 'source-field' && sourceFields.length === 0) {
        this.ruleForm.get('optionSourceField')?.setErrors({ required: true });
        this.ruleForm.get('optionSourceField')?.markAsTouched();
        this.ruleForm.get('optionSourceField')?.markAsDirty();
        return;
      }
      action = {
        type: 'hide-options',
        targetField,
        options: hideMode === 'static' ? formValue.hideOptionValues || [] : [],
        sourceFields: hideMode === 'source-field' ? sourceFields : undefined,
        // keep legacy single-source for backward compatibility with existing saved rules
        sourceField:
          hideMode === 'source-field'
            ? sourceFields[0] || undefined
            : undefined,
      };
    } else {
      const comparator = this.getComparatorForTarget(
        targetDef,
        formValue.comparator,
      );
      const staticValue =
        formValue.thresholdType === 'static'
          ? this.parseThresholdValue(formValue.thresholdValue, targetType)
          : undefined;
      const offset =
        formValue.thresholdType === 'field' && targetType === 'number'
          ? this.toNumber(formValue.thresholdOffset)
          : undefined;

      action = {
        type: 'enforce-comparison',
        targetField,
        comparator,
        valueSource: (formValue.thresholdType as any) || 'static',
        value: staticValue,
        otherField:
          formValue.thresholdType === 'field'
            ? formValue.thresholdField || undefined
            : undefined,
        offset,
        errorMessage: formValue.errorMessage || undefined,
      };
    }

    if (actionType === 'validation' && action.type === 'enforce-comparison') {
      if (
        action.valueSource === 'static' &&
        (action.value === null || action.value === undefined)
      ) {
        this.ruleForm.get('thresholdValue')?.setErrors({ required: true });
        this.ruleForm.get('thresholdValue')?.markAsTouched();
        this.ruleForm.get('thresholdValue')?.markAsDirty();
        return;
      }

      if (action.valueSource === 'field' && !action.otherField) {
        this.ruleForm.get('thresholdField')?.setErrors({ required: true });
        this.ruleForm.get('thresholdField')?.markAsTouched();
        this.ruleForm.get('thresholdField')?.markAsDirty();
        return;
      }
    }

    const rule: CustomRule = {
      id: this.editingRuleId() || this.generateId(),
      name: formValue.name || 'Custom rule',
      conditions: this.conditions(),
      action,
    };

    if (this.isDuplicateRule(rule, this.editingRuleId() || undefined)) {
      alert(
        'A rule with the same conditions and action already exists for this target.',
      );
      return;
    }

    if (this.editingRuleId()) {
      this.formConfigService.updateRule(this.editingRuleId()!, rule);
    } else {
      this.formConfigService.addRule(rule);
    }

    this.resetForms(keepTarget ? targetField : undefined);
  }

  editRule(rule: CustomRule) {
    this.editingRuleId.set(rule.id);
    this.conditions.set(rule.conditions || []);

    this.ruleForm.patchValue({
      name: rule.name,
      targetField: rule.action.targetField,
      actionType:
        rule.action.type === 'enforce-comparison'
          ? 'validation'
          : rule.action.type === 'hide-options'
            ? 'options'
            : 'visibility',
      comparator:
        rule.action.type === 'enforce-comparison'
          ? rule.action.comparator
          : '<=',
      thresholdType:
        rule.action.type === 'enforce-comparison'
          ? rule.action.valueSource
          : 'static',
      thresholdValue:
        rule.action.type === 'enforce-comparison' &&
        rule.action.valueSource === 'static'
          ? ((rule.action.value as any) ?? '')
          : '',
      thresholdField:
        rule.action.type === 'enforce-comparison' &&
        rule.action.valueSource === 'field'
          ? (rule.action.otherField ?? '')
          : '',
      thresholdOffset:
        rule.action.type === 'enforce-comparison' &&
        rule.action.valueSource === 'field'
          ? rule.action.offset !== undefined && rule.action.offset !== null
            ? String(rule.action.offset)
            : ''
          : '',
      hideOptionValues:
        rule.action.type === 'hide-options' ? rule.action.options || [] : [],
      optionHideMode:
        rule.action.type === 'hide-options' &&
        ((rule.action.sourceFields && rule.action.sourceFields.length) ||
          rule.action.sourceField)
          ? 'source-field'
          : 'static',
      optionSourceField:
        rule.action.type === 'hide-options'
          ? rule.action.sourceFields ||
            (rule.action.sourceField ? [rule.action.sourceField] : [])
          : [],
      errorMessage:
        rule.action.type === 'enforce-comparison'
          ? rule.action.errorMessage || ''
          : 'Value must satisfy the rule',
      visibilityBehavior: rule.action.type === 'show-field' ? 'show' : 'hide',
    });
  }

  deleteRule(id: string) {
    this.formConfigService.deleteRule(id);
    if (this.editingRuleId() === id) {
      this.resetForms();
    }
  }

  cancelEditing() {
    this.resetForms();
  }

  formatRule(rule: CustomRule): string {
    const conditions =
      rule.conditions?.length > 0
        ? rule.conditions.map((c) => this.conditionText(c)).join(' AND ')
        : 'Always';

    if (rule.action.type === 'enforce-comparison') {
      const right =
        rule.action.valueSource === 'static'
          ? rule.action.value
          : this.getFieldLabel(rule.action.otherField || '');
      return `${conditions} -> ${this.getFieldLabel(rule.action.targetField)} must be ${rule.action.comparator} ${right}`;
    }

    if (rule.action.type === 'hide-options') {
      const sources =
        rule.action.sourceFields && rule.action.sourceFields.length
          ? rule.action.sourceFields
          : rule.action.sourceField
            ? [rule.action.sourceField]
            : [];
      if (sources.length) {
        const labels = sources
          .map((field) => this.getFieldLabel(field))
          .join(', ');
        return `${conditions} -> Hide value(s) selected in ${labels} from ${this.getFieldLabel(rule.action.targetField)}`;
      }
      const opts = (rule.action.options || []).join(', ');
      return `${conditions} -> Hide options [${opts}] from ${this.getFieldLabel(rule.action.targetField)}`;
    }

    const visibilityAction =
      rule.action.type === 'show-field' ? 'Show' : 'Hide';
    return `${conditions} -> ${visibilityAction} ${this.getFieldLabel(rule.action.targetField)}`;
  }

  getFieldLabel(fieldName: string): string {
    const ctxLabel = this.getContextLabel(fieldName);
    if (ctxLabel) return ctxLabel;
    const field = this.fields().find((f) => f.name === fieldName);
    return field ? field.label : fieldName;
  }

  conditionText(condition: RuleCondition): string {
    const operator =
      this.conditionOperators.find((op) => op.value === condition.operator)
        ?.label || condition.operator;
    const fieldLabel = this.getFieldLabel(condition.field);
    const multi =
      condition.values && condition.values.length
        ? condition.values.join(' or ')
        : condition.value || '';
    return `${fieldLabel} ${operator}${multi ? ' ' + multi : ''}`;
  }

  isValidationAction(): boolean {
    return this.ruleForm.value.actionType === 'validation';
  }

  getComparatorOptions() {
    const targetType = this.getTargetField()?.type;
    if (targetType === 'number' || targetType === 'date') {
      return this.numericComparators;
    }
    return this.textComparators;
  }

  isTargetSelect(): boolean {
    return this.getTargetField()?.type === 'select';
  }

  userDataFields(): FormField[] {
    return [];
  }

  formFieldsList(): FormField[] {
    return this.fields().filter((f) => f.type === 'select');
  }

  optionSourceFields(): FormField[] {
    const target = this.ruleForm.value.targetField;
    return this.fields().filter(
      (f) => f.type === 'select' && f.name !== target,
    );
  }

  getOptionLabel(optValue: any): string {
    const match = this.getStaticValueOptionsForTarget().find(
      (o) => String(o.value) === String(optValue),
    );
    return match?.label || String(optValue);
  }

  userContextEntries() {
    return this.userContextEntriesSignal();
  }

  isInvalid(controlName: string): boolean {
    const ctrl = this.ruleForm.get(controlName);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  hasError(controlName: string, errorKey: string): boolean {
    const ctrl = this.ruleForm.get(controlName);
    return !!ctrl && ctrl.hasError(errorKey) && (ctrl.dirty || ctrl.touched);
  }

  getTargetField(): FormField | undefined {
    const target = this.ruleForm.value.targetField;
    return this.fields().find((f) => f.name === target);
  }

  private syncThresholdValidators() {
    const isValidation =
      this.ruleForm.get('actionType')?.value === 'validation';
    const type = this.ruleForm.get('thresholdType')?.value;
    const valueCtrl = this.ruleForm.get('thresholdValue');
    const fieldCtrl = this.ruleForm.get('thresholdField');
    if (!isValidation) {
      valueCtrl?.clearValidators();
      fieldCtrl?.clearValidators();
      valueCtrl?.updateValueAndValidity({ emitEvent: false });
      fieldCtrl?.updateValueAndValidity({ emitEvent: false });
      return;
    }

    if (type === 'field') {
      fieldCtrl?.setValidators([Validators.required]);
      valueCtrl?.clearValidators();
    } else {
      valueCtrl?.setValidators([Validators.required]);
      fieldCtrl?.clearValidators();
    }
    valueCtrl?.updateValueAndValidity({ emitEvent: false });
    fieldCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  getStaticValueOptionsForTarget(): { label: string; value: any }[] {
    const target = this.getTargetField();
    if (target?.type === 'select') {
      const opts = this.selectOptions()[target.name] || [];
      if (opts.length) return opts;
      return (target.options || []).map((o) => ({ label: o, value: o }));
    }
    return [];
  }

  isTargetNumericOrDate(): boolean {
    const t = this.getTargetField()?.type;
    return t === 'number' || t === 'date';
  }

  resetForms(keepTargetField?: string) {
    this.ruleForm.reset({
      actionType: 'validation',
      comparator: '<=',
      thresholdType: 'static',
      visibilityBehavior: 'hide',
      errorMessage: 'Value must satisfy the rule',
      targetField: keepTargetField ?? '',
      optionHideMode: 'static',
      optionSourceField: [],
    });
    this.conditionDraft.reset({ operator: 'equals' });
    this.conditions.set([]);
    this.editingRuleId.set(null);
  }

  private generateId(): string {
    return 'rule-' + Math.random().toString(36).substring(2, 10);
  }

  private toNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return Number.isNaN(num) ? undefined : num;
  }

  getSelectOptions(fieldName: string): string[] {
    const field = this.fields().find((f) => f.name === fieldName);
    if (!field) return [];
    if (field.selectSource === 'api') {
      const opts = this.selectOptions()[field.name] || [];
      return opts.map((o) => o.label);
    }
    return field.options || [];
  }

  getOptionError(fieldName: string): string | undefined {
    return this.optionErrors()[fieldName];
  }

  isOptionsLoading(fieldName: string): boolean {
    return this.loadingOptions()[fieldName] === true;
  }

  private loadSelectOptions() {
    this.fields()
      .filter(
        (f) =>
          f.type === 'select' && f.selectSource === 'api' && f.apiOptions?.url,
      )
      .forEach((f) => this.fetchOptions(f));
  }

  clearApiCache() {
    this.apiCacheService.clear();
    this.selectOptions.set({});
    this.refreshAllOptions();
  }

  refreshAllOptions() {
    this.fields()
      .filter(
        (f) =>
          f.type === 'select' && f.selectSource === 'api' && f.apiOptions?.url,
      )
      .forEach((f) => this.fetchOptions(f, true));
  }

  private fetchOptions(field: FormField, forceRefresh = false) {
    if (!field.apiOptions?.url) return;
    this.loadingOptions.update((map) => ({ ...map, [field.name]: true }));
    this.optionErrors.update((map) => {
      const copy = { ...map };
      delete copy[field.name];
      return copy;
    });

    const config = this.getApiConfig(field);
    if (!forceRefresh) {
      const cached = this.apiCacheService.get(config);
      if (cached) {
        this.selectOptions.update((map) => ({ ...map, [field.name]: cached }));
        this.loadingOptions.update((map) => ({
          ...map,
          [field.name]: false,
        }));
        return;
      }
    }

    this.http.get(field.apiOptions.url).subscribe({
      next: (res: any) => {
        const list = this.extractItems(res, field.apiOptions?.itemsPath);
        const mapped = Array.isArray(list)
          ? list
              .map((item: any) => this.mapOption(item, field))
              .filter((x): x is { label: string; value: any } => !!x)
          : [];
        if (!mapped.length) {
          this.optionErrors.update((map) => ({
            ...map,
            [field.name]: 'No options returned from API',
          }));
        }
        this.selectOptions.update((map) => ({ ...map, [field.name]: mapped }));
        this.apiCacheService.set(config, mapped);
        this.loadingOptions.update((map) => ({ ...map, [field.name]: false }));
      },
      error: () => {
        this.optionErrors.update((map) => ({
          ...map,
          [field.name]: 'Failed to load options',
        }));
        this.loadingOptions.update((map) => ({ ...map, [field.name]: false }));
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

  private mapOption(
    item: any,
    field: FormField,
  ): { label: string; value: any } | null {
    if (!field.apiOptions) return null;
    const label = field.apiOptions.labelField
      ? item?.[field.apiOptions.labelField]
      : item;
    const rawValue = field.apiOptions.valueField
      ? item?.[field.apiOptions.valueField]
      : item;
    const value = field.apiOptions.saveStrategy === 'label' ? label : rawValue;
    if (label === undefined || value === undefined) return null;
    return { label: String(label), value };
  }

  private getApiConfig(field: FormField) {
    return {
      url: field.apiOptions?.url || '',
      itemsPath: field.apiOptions?.itemsPath || '',
      labelField: field.apiOptions?.labelField || '',
      valueField: field.apiOptions?.valueField || '',
      saveStrategy: field.apiOptions?.saveStrategy || 'value',
    };
  }

  private updateOptionControlsAvailability() {
    const isSelect = this.isTargetSelect();
    const actionCtrl = this.ruleForm.get('actionType');
    const hideOptionsCtrl = this.ruleForm.get('hideOptionValues');
    const optionSourceCtrl = this.ruleForm.get('optionSourceField');
    const optionModeCtrl = this.ruleForm.get('optionHideMode');
    const target = this.ruleForm.value.targetField;

    if (optionSourceCtrl && target) {
      const currentSources = this.normalizeSourceFields(optionSourceCtrl.value);
      const filteredSources = currentSources.filter((s) => s !== target);
      if (filteredSources.length !== currentSources.length) {
        optionSourceCtrl.setValue(filteredSources, { emitEvent: false });
      }
    }

    if (!isSelect && actionCtrl?.value === 'options') {
      actionCtrl.setValue('validation');
    }

    if (isSelect) {
      hideOptionsCtrl?.enable({ emitEvent: false });
      optionSourceCtrl?.enable({ emitEvent: false });
      optionModeCtrl?.enable({ emitEvent: false });
    } else {
      hideOptionsCtrl?.disable({ emitEvent: false });
      hideOptionsCtrl?.setValue([], { emitEvent: false });
      optionSourceCtrl?.disable({ emitEvent: false });
      optionSourceCtrl?.setValue([], { emitEvent: false });
      optionModeCtrl?.disable({ emitEvent: false });
      optionModeCtrl?.setValue('static', { emitEvent: false });
    }
  }

  private normalizeSourceFields(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.filter((v) => !!v);
    }
    return [value].filter((v) => !!v);
  }

  private parseThresholdValue(input: any, targetType?: string): any {
    if (input === null || input === undefined || input === '') return undefined;
    if (targetType === 'number') return this.toNumber(input);
    return input;
  }

  private isDuplicateRule(rule: CustomRule, ignoreId?: string): boolean {
    const normalized = this.normalizeRule(rule);
    return this.formConfigService
      .rules()
      .some(
        (existing) =>
          existing.id !== ignoreId &&
          this.normalizeRule(existing) === normalized,
      );
  }

  private normalizeRule(rule: CustomRule): string {
    const normalizedConditions = [...(rule.conditions || [])]
      .map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value ?? null,
        values: c.values ? [...c.values].sort() : null,
      }))
      .sort((a, b) =>
        (a.field + a.operator).localeCompare(b.field + b.operator),
      );

    const action = rule.action;
    let normalizedAction: any = {
      type: action.type,
      target: action.targetField,
    };

    if (action.type === 'hide-options') {
      const sources =
        action.sourceFields && action.sourceFields.length
          ? action.sourceFields
          : action.sourceField
            ? [action.sourceField]
            : [];
      normalizedAction = {
        ...normalizedAction,
        options: (action.options || []).slice().sort(),
        sources: sources.slice().sort(),
      };
    } else if (action.type === 'enforce-comparison') {
      normalizedAction = {
        ...normalizedAction,
        comparator: action.comparator,
        valueSource: action.valueSource,
        value: action.value ?? null,
        otherField: action.otherField ?? null,
        offset: action.offset ?? null,
      };
    }

    return JSON.stringify({
      conditions: normalizedConditions,
      action: normalizedAction,
    });
  }

  private getComparatorForTarget(
    target: FormField | undefined,
    requested: any,
  ): '<' | '<=' | '>' | '>=' | '==' | '!=' | 'contains' {
    const allowed = this.getComparatorOptions().map((c) => c.value);
    return (allowed.includes(requested) ? requested : allowed[0]) as any;
  }

  private getContextLabel(fieldName: string): string | null {
    const ctx = this.userContextEntriesSignal().find(
      (c) => c.key === fieldName,
    );
    if (!ctx) return null;
    return ctx.displayName || ctx.key || null;
  }

  isGroupCollapsed(target: string): boolean {
    const map = this.collapsedMap();
    return map[target] !== undefined ? map[target] : true;
  }

  toggleGroup(target: string) {
    this.collapsedMap.update((map) => ({
      ...map,
      [target]: !(map[target] !== undefined ? map[target] : true),
    }));
  }

  collapseAllGroups() {
    const map: Record<string, boolean> = {};
    this.groupedRules().forEach((g) => {
      map[g.targetField] = true;
    });
    this.collapsedMap.set(map);
  }

  expandAllGroups() {
    const map: Record<string, boolean> = {};
    this.groupedRules().forEach((g) => {
      map[g.targetField] = false;
    });
    this.collapsedMap.set(map);
  }
}
