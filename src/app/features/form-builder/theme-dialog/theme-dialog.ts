import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';

export type ThemeOption = {
  id: string;
  name: string;
  accent: string;
};

@Component({
  selector: 'app-theme-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-dialog.html',
  styleUrl: './theme-dialog.scss',
})
export class ThemeDialogComponent {
  private dialogRef = inject(DialogRef<string>);
  private data = inject<{ themes: ThemeOption[]; currentTheme: string }>(
    DIALOG_DATA,
  );

  themes = this.data.themes;
  activeTheme = computed(() => this.data.currentTheme);

  selectTheme(id: string) {
    this.dialogRef.close(id);
  }

  nextTheme() {
    const idx = this.themes.findIndex((t) => t.id === this.data.currentTheme);
    const next = this.themes[(idx + 1) % this.themes.length];
    this.dialogRef.close(next.id);
  }
}
