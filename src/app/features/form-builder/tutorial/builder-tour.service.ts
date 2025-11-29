import { Injectable, computed, signal } from '@angular/core';

export type BuilderShellStep = 'forms' | 'fields' | 'rules' | 'preview';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  selector?: string;
  shellStep?: BuilderShellStep;
}

@Injectable({
  providedIn: 'root',
})
export class BuilderTourService {
  private readonly STORAGE_KEY = 'form-builder-tour-complete';
  private readonly shellStep = signal<BuilderShellStep>('forms');
  private readonly steps: TutorialStep[] = [
    {
      id: 'forms-start',
      title: 'Start with a form',
      description:
        'Use “Load Mock Form” for an instant template or “Create New Form” to start from scratch. You need one active form before building. For sake of the tutorial, we have loaded a mock form for you.',
      selector: '[data-tour-anchor="forms-actions"]',
      shellStep: 'forms',
    },
    {
      id: 'forms-manage',
      title: 'Manage saved forms',
      description:
        'Your saved forms live here. Click a row to edit, copy, preview, or review submissions.',
      selector: '[data-tour-anchor="forms-list"]',
      shellStep: 'forms',
    },
    {
      id: 'forms-action-view',
      title: 'View submissions',
      description:
        'Use the list icon to open saved submissions for this form—handy for editing and re-filling.',
      selector: '[data-tour-anchor="forms-action-view"]',
      shellStep: 'forms',
    },
    {
      id: 'forms-action-copy',
      title: 'Copy form',
      description:
        'Duplicate the form structure instantly so you can tweak a variation without starting over.',
      selector: '[data-tour-anchor="forms-action-copy"]',
      shellStep: 'forms',
    },
    {
      id: 'forms-action-fill',
      title: 'Fill as user',
      description:
        'Launch the form in user mode with optional context (role, region, etc.) to test real submissions.',
      selector: '[data-tour-anchor="forms-action-fill"]',
      shellStep: 'forms',
    },
    {
      id: 'forms-action-edit',
      title: 'Edit form',
      description:
        'Jump into the builder to change fields and rules for this form.',
      selector: '[data-tour-anchor="forms-action-edit"]',
      shellStep: 'forms',
    },
    {
      id: 'forms-action-delete',
      title: 'Delete form',
      description:
        'Remove a form and its saved submissions from this browser (local storage).',
      selector: '[data-tour-anchor="forms-action-delete"]',
      shellStep: 'forms',
    },
    {
      id: 'forms-submissions',
      title: 'Saved submissions',
      description:
        'The side panel lists saved submissions for the selected form—open, inspect, and edit them here.',
      selector: '[data-tour-anchor="forms-submissions"]',
      shellStep: 'forms',
    },
    {
      id: 'fields-manual',
      title: 'Manual select options',
      description:
        'Choose “Manual options” and paste quoted values (e.g., "Basic" "Pro" "Enterprise"). Great for quick dropdowns.',
      selector: '[data-tour-anchor="field-options-manual"]',
      shellStep: 'fields',
    },
    {
      id: 'fields-api',
      title: 'API-driven select',
      description:
        'Flip to “Load from API,” set URL and paths (items, label, value). Fetch a preview before saving to confirm the shape.',
      selector: '[data-tour-anchor="field-options-api"]',
      shellStep: 'fields',
    },
    {
      id: 'fields-api-reuse',
      title: 'Reuse an existing API',
      description:
        'If another select already uses an API, pick it here to avoid duplicating config. The dropdown lists available presets.',
      selector: '[data-tour-anchor="field-options-api-reuse"]',
      shellStep: 'fields',
    },
    {
      id: 'rules-context',
      title: 'Define user context',
      description:
        'Open the User Context dialog to declare attributes (e.g., role, plan, locale). Context can drive rules and prefill values.',
      selector: '[data-tour-anchor="rules-user-context"]',
      shellStep: 'rules',
    },
    {
      id: 'rules-validation',
      title: 'Add validation',
      description:
        'Pick an action to enforce validation when conditions match—choose comparator, compare against value/field, and provide an error message.',
      selector: '[data-tour-anchor="rules-validation"]',
      shellStep: 'rules',
    },
    {
      id: 'rules-visibility',
      title: 'Toggle visibility',
      description:
        'Hide or show the target field when conditions hit. Hidden fields are disabled so they do not block submission.',
      selector: '[data-tour-anchor="rules-visibility"]',
      shellStep: 'rules',
    },
    {
      id: 'rules-hide-options',
      title: 'Hide options',
      description:
        'For select targets, hide specific values or drive visibility from another field’s values.',
      selector: '[data-tour-anchor="rules-hide-options"]',
      shellStep: 'rules',
    },
    {
      id: 'rules-compose',
      title: 'Build rules with examples',
      description:
        'Set conditions and actions. Example: IF Country = “US” THEN Show “State”; IF Age < 18 THEN Hide “Payment”; IF Role = Admin THEN Require “Notes”.',
      selector: '[data-tour-anchor="rules-compose"]',
      shellStep: 'rules',
    },
    {
      id: 'rules-api-maintenance',
      title: 'Refresh API options',
      description:
        'If dropdowns use API-driven options, refresh to re-pull choices or clear the cache when schemas change.',
      selector: '[data-tour-anchor="rules-api-refresh"]',
      shellStep: 'rules',
    },
    {
      id: 'preview-ai',
      title: 'Voice/AI assists',
      description:
        'Use the voice/AI box to describe changes or upload a file; responses can drive field values or options.',
      selector: '[data-tour-anchor="preview-ai"]',
      shellStep: 'preview',
    },
    {
      id: 'preview-response',
      title: 'Inspect payloads',
      description:
        'Toggle payload modes (value | key+value | full option) to see exactly what will be submitted.',
      selector: '[data-tour-anchor="preview-payload"]',
      shellStep: 'preview',
    },
  ];

  private currentIndex = signal<number>(-1);

  private filteredSteps = computed(() =>
    this.steps.filter(
      (step) => !step.shellStep || step.shellStep === this.shellStep(),
    ),
  );

  isActive = computed(() => this.currentIndex() >= 0);
  currentStep = computed<TutorialStep | null>(() => {
    const filtered = this.filteredSteps();
    const idx = this.currentIndex();
    if (idx < 0 || idx >= filtered.length) return null;
    return filtered[idx];
  });
  stepCount = computed(() => this.filteredSteps().length);
  stepNumber = computed(() =>
    this.currentIndex() >= 0 ? this.currentIndex() + 1 : 0,
  );

  start(force = false) {
    if (this.isActive()) return;
    if (!force && this.hasSeenTour()) return;
    if (this.filteredSteps().length === 0) return;
    this.currentIndex.set(0);
  }

  maybeAutoStart() {
    if (!this.hasSeenTour() && this.filteredSteps().length) {
      // Small delay to ensure the UI is rendered before the overlay measures targets
      setTimeout(() => this.start(), 400);
    }
  }

  next() {
    if (!this.isActive()) return;
    const filtered = this.filteredSteps();
    if (filtered.length === 0) {
      this.complete();
      return;
    }
    const nextIndex = this.currentIndex() + 1;
    if (nextIndex >= filtered.length) {
      this.complete();
    } else {
      this.currentIndex.set(nextIndex);
    }
  }

  previous() {
    if (!this.isActive()) return;
    const filtered = this.filteredSteps();
    if (filtered.length === 0) {
      this.complete();
      return;
    }
    const prevIndex = this.currentIndex() - 1;
    if (prevIndex < 0) {
      this.currentIndex.set(0);
    } else {
      this.currentIndex.set(prevIndex);
    }
  }

  skip() {
    this.complete();
  }

  restart() {
    this.markUnseen();
    if (this.filteredSteps().length === 0) {
      this.currentIndex.set(-1);
      return;
    }
    this.currentIndex.set(0);
  }

  complete() {
    this.persistSeen();
    this.currentIndex.set(-1);
  }

  getSteps(): TutorialStep[] {
    return this.steps;
  }

  setShellStep(step: BuilderShellStep) {
    this.shellStep.set(step);
    const filtered = this.filteredSteps();
    if (!this.isActive()) {
      return;
    }
    if (filtered.length === 0) {
      this.complete();
      return;
    }
    const current = this.currentStep();
    const newIndex = current
      ? filtered.findIndex((s) => s.id === current.id)
      : -1;
    this.currentIndex.set(newIndex >= 0 ? newIndex : 0);
  }

  private hasSeenTour(): boolean {
    try {
      return localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private persistSeen() {
    try {
      localStorage.setItem(this.STORAGE_KEY, 'true');
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }

  private markUnseen() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
