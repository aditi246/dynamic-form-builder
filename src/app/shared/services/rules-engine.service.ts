import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { FormConfigService, ConditionalRule, DateComparisonRule } from './form-config.service';

@Injectable({
  providedIn: 'root'
})
export class RulesEngineService {
  constructor(private formConfigService: FormConfigService) {}

  /**
   * Applies conditional visibility rules (non-blocking)
   * Returns an object with field names and their visibility state
   */
  applyConditionalRules(formValues: { [key: string]: any }): { [fieldName: string]: boolean } {
    const visibility: { [fieldName: string]: boolean } = {};
    const rules = this.formConfigService.rules();
    const fields = this.formConfigService.fields();

    // Initialize all fields as visible
    fields.forEach(field => {
      visibility[field.name] = true;
    });

    // Apply conditional rules
    rules
      .filter((rule): rule is ConditionalRule => rule.type === 'conditional')
      .forEach(rule => {
        const triggerValue = formValues[rule.triggerField];
        const conditionMet = this.evaluateCondition(triggerValue, rule.operator, rule.triggerValue);

        if (conditionMet) {
          if (rule.action === 'show') {
            visibility[rule.targetField] = true;
          } else if (rule.action === 'hide') {
            visibility[rule.targetField] = false;
          }
        }
      });

    return visibility;
  }

  /**
   * Creates a validator function for date comparison (blocking)
   */
  createDateComparisonValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const formGroup = control.parent;
      if (!formGroup) return null;

      const rules = this.formConfigService.rules();
      const dateComparisonRules = rules.filter(
        (rule): rule is DateComparisonRule => rule.type === 'date-comparison'
      );

      for (const rule of dateComparisonRules) {
        const leftValue = formGroup.get(rule.leftField)?.value;
        const rightValue = formGroup.get(rule.rightField)?.value;

        if (leftValue && rightValue) {
          const leftDate = new Date(leftValue);
          const rightDate = new Date(rightValue);

          const isValid = this.compareDates(leftDate, rightDate, rule.comparator);
          
          if (!isValid) {
            return {
              dateComparison: {
                message: rule.errorMessage,
                leftField: rule.leftField,
                rightField: rule.rightField
              }
            };
          }
        }
      }

      return null;
    };
  }

  private evaluateCondition(value: any, operator: string, triggerValue: string): boolean {
    if (value === null || value === undefined) return false;

    switch (operator) {
      case 'equals':
      case '==':
        return String(value) === triggerValue;
      case 'not-equals':
      case '!=':
        return String(value) !== triggerValue;
      case 'greater-than':
      case '>':
        return Number(value) > Number(triggerValue);
      case 'less-than':
      case '<':
        return Number(value) < Number(triggerValue);
      case 'greater-than-equal':
      case '>=':
        return Number(value) >= Number(triggerValue);
      case 'less-than-equal':
      case '<=':
        return Number(value) <= Number(triggerValue);
      case 'contains':
        return String(value).toLowerCase().includes(triggerValue.toLowerCase());
      default:
        return false;
    }
  }

  private compareDates(leftDate: Date, rightDate: Date, comparator: string): boolean {
    switch (comparator) {
      case '<=':
        return leftDate <= rightDate;
      case '>=':
        return leftDate >= rightDate;
      case '<':
        return leftDate < rightDate;
      case '>':
        return leftDate > rightDate;
      case '==':
        return leftDate.getTime() === rightDate.getTime();
      default:
        return true;
    }
  }
}

