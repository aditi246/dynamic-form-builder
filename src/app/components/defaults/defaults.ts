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
  
  fileTypes = signal<string[]>(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx', '.xls', '.xlsx']);
  selectedFileTypes = signal<string[]>([]);
  
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
      
      // Initialize file types from control value
      if (ctrl && fieldType === 'file' && ctrl.value) {
        const value = String(ctrl.value);
        if (value) {
          this.selectedFileTypes.set(value.split(',').filter(t => t.trim()));
        }
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

  isFileType(): boolean {
    return this.type() === 'file';
  }

  isTextType(): boolean {
    const t = this.type();
    return t === 'text' || t === 'email' || t === 'date';
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

  onFileTypeToggle(fileType: string) {
    this.selectedFileTypes.update(types => {
      if (types.includes(fileType)) {
        return types.filter(t => t !== fileType);
      } else {
        return [...types, fileType];
      }
    });
    
    const ctrl = this.control();
    if (ctrl) {
      ctrl.setValue(this.selectedFileTypes().join(','));
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

