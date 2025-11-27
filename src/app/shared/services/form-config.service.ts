import { Injectable, signal, effect } from '@angular/core';
import { FormField } from '../../features/form-builder/fields-step/fields-step';
import { FormsManagementService } from './forms-management.service';
import { StorageService } from './storage.service';

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isTrue'
  | 'isFalse';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: string;
  values?: string[];
}

export type RuleAction =
  | { type: 'hide-field'; targetField: string }
  | { type: 'show-field'; targetField: string }
  | {
      type: 'enforce-comparison';
      targetField: string;
      comparator: '<' | '<=' | '>' | '>=' | '==' | '!=';
      valueSource: 'static' | 'field';
      value?: number;
      otherField?: string;
      errorMessage?: string;
    };

export interface CustomRule {
  id: string;
  name: string;
  description?: string;
  conditions: RuleCondition[];
  action: RuleAction;
}

@Injectable({
  providedIn: 'root'
})
export class FormConfigService {
  private get STORAGE_KEY(): string {
    const formId = this.formsService.getCurrentFormId();
    return formId ? `form-builder-rules-${formId}` : 'form-builder-rules';
  }
  
  rules = signal<CustomRule[]>([]);
  fields = signal<FormField[]>([]);

  constructor(
    private formsService: FormsManagementService,
    private storageService: StorageService
  ) {
    effect(() => {
      const formId = this.formsService.getCurrentFormId();
      if (formId) {
        this.loadRules();
      } else {
        this.rules.set([]);
      }
    });
    this.loadRules();
  }

  addRule(rule: CustomRule): void {
    this.rules.update(rules => [...rules, rule]);
    this.saveRules();
    this.updateFormRuleCount();
  }

  updateRule(id: string, rule: CustomRule): void {
    this.rules.update(rules => 
      rules.map(r => r.id === id ? rule : r)
    );
    this.saveRules();
  }

  deleteRule(id: string): void {
    this.rules.update(rules => rules.filter(r => r.id !== id));
    this.saveRules();
    this.updateFormRuleCount();
  }

  clearRules(): void {
    this.rules.set([]);
    this.saveRules();
  }

  setFields(fields: FormField[]): void {
    this.fields.set(fields);
  }

  private saveRules(): void {
    this.storageService.setItem(this.STORAGE_KEY, this.rules());
  }

  private loadRules(): void {
    const stored = this.storageService.getItem<CustomRule[]>(this.STORAGE_KEY);
    if (stored) {
      const safeRules = Array.isArray(stored)
        ? stored.filter((rule: any) => rule && rule.action && rule.conditions !== undefined)
        : [];
      this.rules.set(safeRules);
    } else {
      this.rules.set([]);
    }
  }

  private updateFormRuleCount(): void {
    const formId = this.formsService.getCurrentFormId();
    if (formId) {
      this.formsService.updateForm(formId, {
        ruleCount: this.rules().length
      });
    }
  }
}
