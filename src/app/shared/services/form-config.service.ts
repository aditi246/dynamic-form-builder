import { Injectable, signal } from '@angular/core';
import { FormField } from '../../features/form-builder/fields-step/fields-step';

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
  private readonly STORAGE_KEY = 'form-builder-rules';
  
  rules = signal<CustomRule[]>([]);
  fields = signal<FormField[]>([]);

  constructor() {
    this.loadRules();
  }

  addRule(rule: CustomRule): void {
    this.rules.update(rules => [...rules, rule]);
    this.saveRules();
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
  }

  clearRules(): void {
    this.rules.set([]);
    this.saveRules();
  }

  setFields(fields: FormField[]): void {
    this.fields.set(fields);
  }

  private saveRules(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.rules()));
      } catch (error) {
        console.error('Error saving rules:', error);
      }
    }
  }

  private loadRules(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const safeRules = Array.isArray(parsed)
            ? parsed.filter((rule: any) => rule && rule.action && rule.conditions !== undefined)
            : [];
          this.rules.set(safeRules);
        }
      } catch (error) {
        console.error('Error loading rules:', error);
      }
    }
  }
}
