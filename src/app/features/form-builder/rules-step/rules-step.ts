import { Component, OnInit, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormConfigService, ConditionalRule, DateComparisonRule, Rule } from '../../../shared/services/form-config.service';
import { RulesEngineService } from '../../../shared/services/rules-engine.service';
import { StorageService } from '../../../shared/services/storage.service';
import { FormField } from '../fields-step/fields-step';
import { IconComponent } from '../../../components/icon/icon';

@Component({
  selector: 'app-rules-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  templateUrl: './rules-step.html'
})
export class RulesStep implements OnInit {
  nextStep = output<void>();
  backStep = output<void>();
  showConditionalForm = signal<boolean>(false);
  showComparisonForm = signal<boolean>(false);
  editingRuleId = signal<string | null>(null);
  
  fields = signal<FormField[]>([]);
  rules = computed(() => this.formConfigService.rules());
  
  conditionalForm = new FormGroup({
    triggerField: new FormControl('', [Validators.required]),
    operator: new FormControl('', [Validators.required]),
    triggerValue: new FormControl('', [Validators.required]),
    action: new FormControl('', [Validators.required]),
    targetField: new FormControl('', [Validators.required])
  });

  comparisonForm = new FormGroup({
    leftField: new FormControl('', [Validators.required]),
    comparator: new FormControl('<=', [Validators.required]),
    rightField: new FormControl('', [Validators.required]),
    errorMessage: new FormControl('', [Validators.required])
  });

  operators = [
    { label: 'Equals', value: 'equals' },
    { label: 'Not equal to', value: 'not-equals' },
    { label: 'Greater than', value: 'greater-than' },
    { label: 'Less than', value: 'less-than' },
    { label: 'Greater than or equal', value: 'greater-than-equal' },
    { label: 'Less than or equal', value: 'less-than-equal' },
    { label: 'Contains', value: 'contains' }
  ];

  comparators = [
    { label: 'Less than or equal (≤)', value: '<=' },
    { label: 'Greater than or equal (≥)', value: '>=' },
    { label: 'Less than (<)', value: '<' },
    { label: 'Greater than (>)', value: '>' },
    { label: 'Equal (==)', value: '==' }
  ];

  actions = [
    { label: 'Show', value: 'show' },
    { label: 'Hide', value: 'hide' },
    { label: 'Require', value: 'require' },
    { label: 'Optional', value: 'optional' }
  ];

  constructor(
    private formConfigService: FormConfigService,
    private rulesEngineService: RulesEngineService,
    private storageService: StorageService
  ) {}

  ngOnInit() {
    this.loadFields();
    this.formConfigService.setFields(this.fields());
  }

  private loadFields() {
    const fieldsData = this.storageService.getItem<Omit<FormField, 'formValue'>[]>('form-builder-fields');
    if (fieldsData) {
      this.fields.set(fieldsData as FormField[]);
    }
  }

  openConditionalForm() {
    this.showConditionalForm.set(true);
    this.showComparisonForm.set(false);
    this.editingRuleId.set(null);
    this.conditionalForm.reset();
  }

  openComparisonForm() {
    this.showComparisonForm.set(true);
    this.showConditionalForm.set(false);
    this.editingRuleId.set(null);
    this.comparisonForm.reset();
  }

  closeForms() {
    this.showConditionalForm.set(false);
    this.showComparisonForm.set(false);
    this.editingRuleId.set(null);
    this.conditionalForm.reset();
    this.comparisonForm.reset();
  }

  saveConditionalRule() {
    if (this.conditionalForm.valid) {
      const formValue = this.conditionalForm.value;
      const rule: ConditionalRule = {
        id: this.editingRuleId() || this.generateId(),
        type: 'conditional',
        triggerField: formValue.triggerField!,
        operator: formValue.operator!,
        triggerValue: formValue.triggerValue!,
        action: formValue.action as 'show' | 'hide' | 'require' | 'optional',
        targetField: formValue.targetField!
      };

      if (this.editingRuleId()) {
        this.formConfigService.updateRule(this.editingRuleId()!, rule);
      } else {
        this.formConfigService.addRule(rule);
      }

      this.closeForms();
    }
  }

  saveComparisonRule() {
    if (this.comparisonForm.valid) {
      const formValue = this.comparisonForm.value;
      const rule: DateComparisonRule = {
        id: this.editingRuleId() || this.generateId(),
        type: 'date-comparison',
        leftField: formValue.leftField!,
        comparator: formValue.comparator as '<=' | '>=' | '<' | '>' | '==',
        rightField: formValue.rightField!,
        errorMessage: formValue.errorMessage!
      };

      if (this.editingRuleId()) {
        this.formConfigService.updateRule(this.editingRuleId()!, rule);
      } else {
        this.formConfigService.addRule(rule);
      }

      this.closeForms();
    }
  }

  editRule(rule: Rule) {
    this.editingRuleId.set(rule.id);
    
    if (rule.type === 'conditional') {
      this.conditionalForm.patchValue({
        triggerField: rule.triggerField,
        operator: rule.operator,
        triggerValue: rule.triggerValue,
        action: rule.action,
        targetField: rule.targetField
      });
      this.openConditionalForm();
    } else {
      this.comparisonForm.patchValue({
        leftField: rule.leftField,
        comparator: rule.comparator,
        rightField: rule.rightField,
        errorMessage: rule.errorMessage
      });
      this.openComparisonForm();
    }
  }

  deleteRule(id: string) {
    if (confirm('Are you sure you want to delete this rule?')) {
      this.formConfigService.deleteRule(id);
    }
  }

  getFieldLabel(fieldName: string): string {
    const field = this.fields().find(f => f.name === fieldName);
    return field ? field.label : fieldName;
  }

  formatRule(rule: Rule): string {
    if (rule.type === 'conditional') {
      const triggerLabel = this.getFieldLabel(rule.triggerField);
      const targetLabel = this.getFieldLabel(rule.targetField);
      const operatorLabel = this.operators.find(op => op.value === rule.operator)?.label || rule.operator;
      const actionLabel = rule.action.charAt(0).toUpperCase() + rule.action.slice(1);
      
      return `IF '${triggerLabel}' is '${operatorLabel}' '${rule.triggerValue}' THEN '${actionLabel}' '${targetLabel}'.`;
    } else {
      const leftLabel = this.getFieldLabel(rule.leftField);
      const rightLabel = this.getFieldLabel(rule.rightField);
      const comparatorLabel = this.comparators.find(comp => comp.value === rule.comparator)?.label || rule.comparator;
      
      return `VALIDATE that '${leftLabel}' is '${rule.comparator}' '${rightLabel}'. On failure, show: "${rule.errorMessage}"`;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
