import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/editor/pages/editor-page').then((m) => m.EditorPageComponent)
  },
  {
    path: 'editor',
    loadComponent: () =>
      import('./features/editor/pages/editor-page').then((m) => m.EditorPageComponent)
  },
  {
    path: 'editor/:planId',
    loadComponent: () =>
      import('./features/editor/pages/editor-page').then((m) => m.EditorPageComponent)
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./features/reports/pages/reports-page').then((m) => m.ReportsPageComponent)
  },
  {
    path: 'reports/:executionId',
    loadComponent: () =>
      import('./features/reports/pages/results-viewer-page').then((m) => m.ResultsViewerPageComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
