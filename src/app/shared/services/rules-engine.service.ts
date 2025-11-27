import { Injectable } from '@angular/core';
import { CustomRule, RuleCondition, RuleAction, ConditionOperator } from './form-config.service';
import { FormField } from '../../features/form-builder/fields-step/fields-step';

export interface RuleEvaluationResult {
  hiddenFields: Set<string>;
  fieldErrors: Record<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class RulesEngineService {
  evaluate(
    rules: CustomRule[],
    formValues: Record<string, any>,
    fields: FormField[]
  ): RuleEvaluationResult {
    const hiddenFields = new Set<string>();
    const fieldErrors: Record<string, string> = {};

    rules.forEach(rule => {
      const conditionsMet = this.conditionsSatisfied(rule.conditions, formValues);
      if (!conditionsMet) {
        return;
      }

      const actionResult = this.applyAction(rule.action, formValues, fields);
      if (actionResult?.hideField) {
        hiddenFields.add(actionResult.hideField);
      }
      if (actionResult?.showField) {
        hiddenFields.delete(actionResult.showField);
      }
      if (actionResult?.fieldError) {
        fieldErrors[actionResult.fieldError.field] = actionResult.fieldError.message;
      }
    });

    return { hiddenFields, fieldErrors };
  }

  private conditionsSatisfied(conditions: RuleCondition[], values: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every(condition => {
      const left = values[condition.field];
      return this.evaluateCondition(left, condition.operator, condition.value, condition.values);
    });
  }

  private applyAction(
    action: RuleAction,
    values: Record<string, any>,
    fields: FormField[]
  ): { hideField?: string; showField?: string; fieldError?: { field: string; message: string } } | null {
    if (action.type === 'hide-field') {
      return { hideField: action.targetField };
    }

    if (action.type === 'show-field') {
      return { showField: action.targetField };
    }

    if (action.type === 'enforce-comparison') {
      const targetValue = values[action.targetField];
      const comparatorValue =
        action.valueSource === 'static'
          ? action.value
          : values[action.otherField || ''];

      const targetField = fields.find(f => f.name === action.targetField);
      const comparatorField = action.valueSource === 'field'
        ? fields.find(f => f.name === action.otherField)
        : undefined;

      const left = this.normalizeValue(targetValue, targetField?.type);
      const right = this.normalizeValue(
        comparatorValue,
        comparatorField?.type || targetField?.type
      );

      if (left.value === null || right.value === null) {
        return null;
      }

      const passes = this.compareValues(left.value, right.value, action.comparator);
      if (!passes) {
        return {
          fieldError: {
            field: action.targetField,
            message:
              action.errorMessage ||
              `Must be ${action.comparator} ${action.valueSource === 'static' ? action.value : 'selected field'}`
          }
        };
      }
    }

    return null;
  }

  private evaluateCondition(
    value: any,
    operator: ConditionOperator,
    triggerValue?: string,
    triggerValues?: string[]
  ): boolean {
    if (operator === 'isTrue') {
      return value === true || value === 'true';
    }
    if (operator === 'isFalse') {
      return value === false || value === 'false';
    }
    if (value === null || value === undefined || value === '') {
      return false;
    }

    const multi = triggerValues && triggerValues.length ? triggerValues.map(v => String(v)) : null;

    switch (operator) {
      case 'equals':
        if (multi) {
          return multi.includes(String(value));
        }
        return String(value) === String(triggerValue);
      case 'notEquals':
        if (multi) {
          return !multi.includes(String(value));
        }
        return String(value) !== String(triggerValue);
      case 'contains':
        return String(value).toLowerCase().includes(String(triggerValue || '').toLowerCase());
      case 'gt':
        return Number(value) > Number(triggerValue);
      case 'gte':
        return Number(value) >= Number(triggerValue);
      case 'lt':
        return Number(value) < Number(triggerValue);
      case 'lte':
        return Number(value) <= Number(triggerValue);
      default:
        return false;
    }
  }

  private normalizeValue(raw: any, type?: string): { value: number | string | null } {
    if (raw === null || raw === undefined || raw === '') {
      return { value: null };
    }

    if (type === 'date') {
      const date = new Date(raw);
      return isNaN(date.getTime()) ? { value: null } : { value: date.getTime() };
    }

    const numeric = Number(raw);
    if (!isNaN(numeric)) {
      return { value: numeric };
    }

    return { value: String(raw).toLowerCase() };
  }

  private compareValues(left: number | string, right: number | string, comparator: string): boolean {
    switch (comparator) {
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      case '!=':
        return left !== right;
      case '==':
      default:
        return left === right;
    }
  }
}
