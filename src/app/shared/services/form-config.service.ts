import { Injectable, signal } from '@angular/core';
import { FormField } from '../../features/form-builder/fields-step/fields-step';

export interface ConditionalRule {
  id: string;
  type: 'conditional';
  triggerField: string;
  operator: string;
  triggerValue: string;
  action: 'show' | 'hide' | 'require' | 'optional';
  targetField: string;
}

export interface DateComparisonRule {
  id: string;
  type: 'date-comparison';
  leftField: string;
  comparator: '<=' | '>=' | '<' | '>' | '==';
  rightField: string;
  errorMessage: string;
}

export type Rule = ConditionalRule | DateComparisonRule;

@Injectable({
  providedIn: 'root'
})
export class FormConfigService {
  private readonly STORAGE_KEY = 'form-builder-rules';
  
  rules = signal<Rule[]>([]);
  fields = signal<FormField[]>([]);

  constructor() {
    this.loadRules();
  }

  addRule(rule: Rule): void {
    this.rules.update(rules => [...rules, rule]);
    this.saveRules();
  }

  updateRule(id: string, rule: Rule): void {
    this.rules.update(rules => 
      rules.map(r => r.id === id ? rule : r)
    );
    this.saveRules();
  }

  deleteRule(id: string): void {
    this.rules.update(rules => rules.filter(r => r.id !== id));
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
          this.rules.set(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading rules:', error);
      }
    }
  }
}

