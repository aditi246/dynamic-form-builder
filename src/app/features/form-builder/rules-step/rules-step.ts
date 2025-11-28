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
  editingRuleId = signal<string | null>(null);
  conditions = signal<RuleCondition[]>([]);

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

  constructor(
    private formConfigService: FormConfigService,
    private formsService: FormsManagementService,
    private http: HttpClient,
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

    this.ruleForm.get('targetField')?.valueChanges.subscribe(() => {
      const isSelect = this.isTargetSelect();
      const actionCtrl = this.ruleForm.get('actionType');
      const hideOptionsCtrl = this.ruleForm.get('hideOptionValues');
      if (!isSelect && actionCtrl?.value === 'options') {
        actionCtrl.setValue('validation');
      }
      if (isSelect) {
        hideOptionsCtrl?.enable({ emitEvent: false });
      } else {
        hideOptionsCtrl?.disable({ emitEvent: false });
        hideOptionsCtrl?.setValue([], { emitEvent: false });
      }
    });
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

    if (!targetField || !actionType) {
      this.ruleForm.markAllAsTouched();
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
      action = {
        type: 'hide-options',
        targetField,
        options: formValue.hideOptionValues || [],
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
        return;
      }

      if (action.valueSource === 'field' && !action.otherField) {
        this.ruleForm.get('thresholdField')?.setErrors({ required: true });
        return;
      }
    }

    const rule: CustomRule = {
      id: this.editingRuleId() || this.generateId(),
      name: formValue.name || 'Custom rule',
      conditions: this.conditions(),
      action,
    };

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
        rule.action.type === 'hide-options' ? rule.action.options : [],
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
      const opts = (rule.action.options || []).join(', ');
      return `${conditions} -> Hide options [${opts}] from ${this.getFieldLabel(rule.action.targetField)}`;
    }

    const visibilityAction =
      rule.action.type === 'show-field' ? 'Show' : 'Hide';
    return `${conditions} -> ${visibilityAction} ${this.getFieldLabel(rule.action.targetField)}`;
  }

  getFieldLabel(fieldName: string): string {
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

  getOptionLabel(optValue: any): string {
    const match = this.getStaticValueOptionsForTarget().find(
      (o) => String(o.value) === String(optValue),
    );
    return match?.label || String(optValue);
  }

  userContextEntries() {
    return this.userContextEntriesSignal();
  }

  getTargetField(): FormField | undefined {
    const target = this.ruleForm.value.targetField;
    return this.fields().find((f) => f.name === target);
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

  isSelectField(fieldName: string): boolean {
    const field = this.fields().find((f) => f.name === fieldName);
    return field?.type === 'select';
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

  private fetchOptions(field: FormField) {
    if (!field.apiOptions?.url) return;
    this.loadingOptions.update((map) => ({ ...map, [field.name]: true }));
    this.optionErrors.update((map) => {
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
          this.optionErrors.update((map) => ({
            ...map,
            [field.name]: 'No options returned from API',
          }));
        }
        this.selectOptions.update((map) => ({ ...map, [field.name]: mapped }));
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

  private parseThresholdValue(input: any, targetType?: string): any {
    if (input === null || input === undefined || input === '') return undefined;
    if (targetType === 'number') return this.toNumber(input);
    return input;
  }

  private getComparatorForTarget(
    target: FormField | undefined,
    requested: any,
  ): '<' | '<=' | '>' | '>=' | '==' | '!=' | 'contains' {
    const allowed = this.getComparatorOptions().map((c) => c.value);
    return (allowed.includes(requested) ? requested : allowed[0]) as any;
  }
}
