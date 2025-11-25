import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/form-builder/builder-shell/builder-shell').then(m => m.BuilderShell)
  }
];
