import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Custom validator that checks if start date is greater than end date
 * Returns an error if start date > end date
 * 
 * @param startDateFieldName - Name of the start date field in the form
 * @param endDateFieldName - Name of the end date field in the form
 * @param errorKey - Optional custom error key (default: 'dateRangeInvalid')
 * @returns ValidatorFn
 */
export function dateRangeValidator(
  startDateFieldName: string,
  endDateFieldName: string,
  errorKey: string = 'dateRangeInvalid'
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control.parent;
    
    if (!formGroup) {
      return null;
    }

    const startDateControl = formGroup.get(startDateFieldName);
    const endDateControl = formGroup.get(endDateFieldName);

    if (!startDateControl || !endDateControl) {
      return null;
    }

    const startDate = startDateControl.value;
    const endDate = endDateControl.value;

    // If either date is empty, don't validate (let required validator handle it)
    if (!startDate || !endDate) {
      return null;
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return null; // Let other validators handle invalid date format
    }

    // Check if start date is greater than end date
    if (start > end) {
      return {
        [errorKey]: {
          message: 'Start date must be less than or equal to end date',
          startDate: startDate,
          endDate: endDate
        }
      };
    }

    return null;
  };
}
