import { Component, inject } from '@angular/core';
import { AppShellComponent } from './layout/app-shell.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppShellComponent],
  template: `<app-shell></app-shell>`,
})
export class App {
  // Injecté pour appliquer le thème (data-theme) dès le bootstrap via son constructeur.
  private readonly theme = inject(ThemeService);
}
