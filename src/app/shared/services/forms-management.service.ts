import { Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';

export interface SavedForm {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fieldCount?: number;
  ruleCount?: number;
  fields?: any[];
  userContext?: Array<{
    key: string;
    displayName: string;
    value: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class FormsManagementService {
  private readonly FORMS_LIST_KEY = 'formlist';
  private readonly LEGACY_FORMS_LIST_KEY = 'form-builder-forms-list';
  private readonly CURRENT_FORM_KEY = 'form-builder-current-form-id';
  private readonly SUBMISSION_PREFIX = 'form-builder-submissions-';

  forms = signal<SavedForm[]>([]);
  currentFormId = signal<string | null>(null);
  activeUserContext = signal<SavedForm['userContext'] | null>(null);

  constructor(private storageService: StorageService) {
    this.loadForms();
    this.loadCurrentFormId();
  }

  loadForms(): void {
    let forms = this.storageService.getItem<SavedForm[]>(this.FORMS_LIST_KEY);

    if (!forms || !Array.isArray(forms)) {
      const legacyForms = this.storageService.getItem<SavedForm[]>(
        this.LEGACY_FORMS_LIST_KEY,
      );
      if (legacyForms && Array.isArray(legacyForms)) {
        forms = legacyForms;
        this.storageService.setItem(this.FORMS_LIST_KEY, legacyForms);
        this.storageService.removeItem(this.LEGACY_FORMS_LIST_KEY);
      }
    }

    const normalized = (forms || []).map((form) => ({
      ...form,
      userContext: Array.isArray(form.userContext) ? form.userContext : [],
    }));

    this.forms.set(normalized);
  }

  createForm(name: string, userContext?: SavedForm['userContext']): string {
    const formId = this.generateId();
    const now = new Date().toISOString();
    const resolvedContext = Array.isArray(userContext) ? userContext : [];

    const newForm: SavedForm = {
      id: formId,
      name: name.trim() || 'Untitled Form',
      createdAt: now,
      updatedAt: now,
      fieldCount: 0,
      ruleCount: 0,
      fields: [],
      userContext: resolvedContext,
    };

    this.forms.update((forms) => [...forms, newForm]);
    this.saveForms();
    this.setCurrentForm(formId);

    return formId;
  }

  updateForm(formId: string, updates: Partial<SavedForm>): void {
    this.forms.update((forms) =>
      forms.map((form) =>
        form.id === formId
          ? { ...form, ...updates, updatedAt: new Date().toISOString() }
          : form,
      ),
    );
    this.saveForms();
  }

  deleteForm(formId: string): void {
    this.forms.update((forms) => forms.filter((form) => form.id !== formId));
    this.saveForms();

    this.storageService.removeItem(`form-builder-rules-${formId}`);

    if (this.currentFormId() === formId) {
      this.setCurrentForm(null);
    }
  }

  setCurrentForm(formId: string | null): void {
    this.currentFormId.set(formId);
    if (formId) {
      this.storageService.setSessionItem(this.CURRENT_FORM_KEY, formId);
    } else {
      this.storageService.removeSessionItem(this.CURRENT_FORM_KEY);
    }
  }

  getCurrentFormId(): string | null {
    return this.currentFormId();
  }

  getCurrentFormName(): string | null {
    const formId = this.currentFormId();
    const form = formId ? this.getFormById(formId) : null;
    return form ? form.name : null;
  }

  getFormContext(formId?: string | null): SavedForm['userContext'] | null {
    const override = this.activeUserContext();
    if (override) {
      return override;
    }
    const targetId = formId || this.currentFormId();
    const form = targetId ? this.getFormById(targetId) : null;
    return Array.isArray(form?.userContext) ? form?.userContext : [];
  }

  getFormById(formId: string): SavedForm | undefined {
    return this.forms().find((form) => form.id === formId);
  }

  getFormFields(formId?: string | null, formName?: string | null): any[] {
    const form = this.findForm(formId, formName);
    if (!form || !form.fields) {
      return [];
    }

    if (Array.isArray(form.fields)) {
      return [...form.fields];
    }

    if (typeof form.fields === 'object') {
      return Object.values(form.fields);
    }

    return [];
  }

  saveFormFields(
    formId: string | null,
    fields: any[],
    formName?: string | null,
  ): boolean {
    const normalizedName = formName?.trim();
    const forms = this.forms();

    const targetIndex = forms.findIndex(
      (form) =>
        (formId && form.id === formId) ||
        (normalizedName &&
          form.name.toLowerCase() === normalizedName.toLowerCase()),
    );

    if (targetIndex === -1) {
      console.error(
        'Cannot save fields: form was not found for the provided identifier',
      );
      return false;
    }

    const now = new Date().toISOString();
    const updatedForms = [...forms];
    const targetForm = updatedForms[targetIndex];

    updatedForms[targetIndex] = {
      ...targetForm,
      name: normalizedName || targetForm.name,
      fields: fields,
      fieldCount: fields.length,
      updatedAt: now,
    };

    this.forms.set(updatedForms);
    this.saveForms();
    return true;
  }

  copyForm(sourceFormId: string, newName?: string): string {
    const sourceForm = this.getFormById(sourceFormId);
    if (!sourceForm) {
      throw new Error('Source form not found');
    }

    const newFormId = this.generateId();
    const now = new Date().toISOString();

    let sourceFields: any[] = [];
    if (Array.isArray(sourceForm.fields)) {
      sourceFields = sourceForm.fields;
    } else if (sourceForm.fields && typeof sourceForm.fields === 'object') {
      sourceFields = Object.values(sourceForm.fields);
    }
    const fieldCount = sourceFields.length;

    const sourceRulesKey = `form-builder-rules-${sourceFormId}`;
    const sourceRules = this.storageService.getItem<any[]>(sourceRulesKey);
    let ruleCount = 0;
    if (sourceRules && Array.isArray(sourceRules)) {
      const newRulesKey = `form-builder-rules-${newFormId}`;
      this.storageService.setItem(newRulesKey, sourceRules);
      ruleCount = sourceRules.length;
    }

    const copiedFields = sourceFields.map((field: any) =>
      JSON.parse(JSON.stringify(field)),
    );

    const copiedForm: SavedForm = {
      id: newFormId,
      name: newName || `Copy of ${sourceForm.name}`,
      createdAt: now,
      updatedAt: now,
      fieldCount: fieldCount,
      ruleCount: ruleCount,
      fields: copiedFields,
      userContext: Array.isArray(sourceForm.userContext)
        ? sourceForm.userContext.map((ctx) => ({ ...ctx }))
        : [],
    };

    this.forms.update((forms) => [...forms, copiedForm]);
    this.saveForms();

    return newFormId;
  }

  setActiveUserContext(context: SavedForm['userContext'] | null) {
    this.activeUserContext.set(
      Array.isArray(context)
        ? context.map((entry) => ({
            key: String(entry.key),
            displayName: String(entry.displayName),
            value: String(entry.value),
          }))
        : null,
    );
  }

  clearActiveUserContext() {
    this.activeUserContext.set(null);
  }

  saveUserSubmission(formId: string, submission: Record<string, any>) {
    if (!formId) return;
    const key = `${this.SUBMISSION_PREFIX}${formId}`;
    const existing =
      this.storageService.getItem<
        {
          id: string;
          submittedAt: string;
          values: Record<string, any>;
          context: SavedForm['userContext'] | null;
        }[]
      >(key) || [];
    const entry = {
      id: this.generateId(),
      submittedAt: new Date().toISOString(),
      values: submission,
      context: this.getFormContext(formId),
    };
    this.storageService.setItem(key, [...existing, entry]);
  }

  getUserSubmissions(formId: string) {
    if (!formId) return [];
    const key = `${this.SUBMISSION_PREFIX}${formId}`;
    return (
      this.storageService.getItem<
        {
          id: string;
          submittedAt: string;
          values: Record<string, any>;
          context: SavedForm['userContext'] | null;
        }[]
      >(key) || []
    );
  }

  updateUserSubmission(
    formId: string,
    submissionId: string,
    submission: Record<string, any>,
  ) {
    if (!formId || !submissionId) return;
    const key = `${this.SUBMISSION_PREFIX}${formId}`;
    const existing =
      this.storageService.getItem<
        {
          id: string;
          submittedAt: string;
          values: Record<string, any>;
          context: SavedForm['userContext'] | null;
        }[]
      >(key) || [];
    const updated = existing.map((entry) =>
      entry.id === submissionId
        ? {
            ...entry,
            submittedAt: new Date().toISOString(),
            values: submission,
            context: this.getFormContext(formId),
          }
        : entry,
    );
    this.storageService.setItem(key, updated);
  }

  private loadCurrentFormId(): void {
    const formId = this.storageService.getSessionItem<string>(
      this.CURRENT_FORM_KEY,
    );
    if (formId) {
      const formExists = this.forms().some((form) => form.id === formId);
      if (formExists) {
        this.currentFormId.set(formId);
      } else {
        this.setCurrentForm(null);
      }
    }
  }

  private saveForms(): void {
    this.storageService.setItem(this.FORMS_LIST_KEY, this.forms());
  }

  private generateId(): string {
    return `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private findForm(
    formId?: string | null,
    formName?: string | null,
  ): SavedForm | undefined {
    const normalizedName = formName?.trim().toLowerCase();
    return this.forms().find(
      (form) =>
        (formId && form.id === formId) ||
        (normalizedName && form.name.trim().toLowerCase() === normalizedName),
    );
  }
}
