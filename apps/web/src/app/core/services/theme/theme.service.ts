import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SettingsService } from '../settings/settings.service';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Service for managing application theme (light/dark mode).
 *
 * Features:
 * - Light, Dark, and System (auto) modes
 * - Persists preference via SettingsService
 * - Respects system preference when set to 'system'
 * - Applies theme class to document for PrimeNG integration
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly settingsService = inject(SettingsService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** System preference for dark mode */
  private readonly systemPrefersDark = signal(this.getSystemPreference());

  /** Current theme setting */
  readonly theme = computed(() => this.settingsService.generalSettings().theme);

  /** Resolved theme (light or dark) after applying system preference */
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const theme = this.theme();
    if (theme === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return theme;
  });

  /** Whether dark mode is active */
  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  /** Whether light mode is active */
  readonly isLight = computed(() => this.resolvedTheme() === 'light');

  constructor() {
    // Listen for system preference changes
    if (this.isBrowser) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        this.systemPrefersDark.set(e.matches);
      });
    }

    // Apply theme whenever it changes
    effect(() => {
      this.applyTheme(this.resolvedTheme());
    });
  }

  /**
   * Set the theme preference
   */
  setTheme(theme: Theme): void {
    this.settingsService.updateGeneralSettings({ theme });
  }

  /**
   * Toggle between light and dark modes
   */
  toggle(): void {
    const current = this.resolvedTheme();
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }

  /**
   * Cycle through themes: light -> dark -> system -> light
   */
  cycle(): void {
    const current = this.theme();
    const next: Theme = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    this.setTheme(next);
  }

  /**
   * Get system preference for dark mode
   */
  private getSystemPreference(): boolean {
    if (!this.isBrowser) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: ResolvedTheme): void {
    if (!this.isBrowser) return;

    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark-mode');
      root.classList.remove('light-mode');
      body.classList.add('dark-mode');
      body.classList.remove('light-mode');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.add('light-mode');
      root.classList.remove('dark-mode');
      body.classList.add('light-mode');
      body.classList.remove('dark-mode');
      root.setAttribute('data-theme', 'light');
    }
  }
}
