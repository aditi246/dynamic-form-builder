import { Component, input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-defaults',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './defaults.html'
})
export class DefaultsComponent {
  type = input.required<string>();
  options = input<string[]>([]);
  control = input<FormControl | null>(null);
  
  checkboxValue = signal<boolean | null>(null);

  constructor() {
    // Sync checkbox value with control
    effect(() => {
      const ctrl = this.control();
      const fieldType = this.type();
      
      if (ctrl && fieldType === 'checkbox') {
        const value = ctrl.value;
        this.checkboxValue.set(value === true || value === 'true' || value === 1);
      }
    });
  }

  // Helper methods instead of computed signals for simple checks
  isSelectType(): boolean {
    return this.type() === 'select';
  }

  isCheckboxType(): boolean {
    return this.type() === 'checkbox';
  }

  isTextType(): boolean {
    const t = this.type();
    return t === 'text' || t === 'email';
  }

  isNumberType(): boolean {
    return this.type() === 'number';
  }

  hasOptions(): boolean {
    return this.options().length > 0;
  }

  onCheckboxChange(value: boolean) {
    this.checkboxValue.set(value);
    const ctrl = this.control();
    if (ctrl) {
      ctrl.setValue(value);
    }
  }

  onInputChange(value: any) {
    const ctrl = this.control();
    if (ctrl) {
      if (this.type() === 'number') {
        const numValue = value === '' ? null : Number(value);
        ctrl.setValue(!numValue? null : numValue);
      } else {
        ctrl.setValue(value);
      }
    }
  }

  onSelectChange(value: string) {
    const ctrl = this.control();
    if (ctrl) {
      ctrl.setValue(value);
    }
  }
}

