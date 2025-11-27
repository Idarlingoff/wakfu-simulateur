/**
 * Report Component
 * Displays simulation results, timeline, logs, and analysis
 */

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="report">
      <!-- Tabs -->
      <div class="tabs">
        <div class="tab active" (click)="onTabChange('report')">Rapport</div>
        <div class="tab" (click)="onTabChange('timeline')">Timeline</div>
        <div class="tab" (click)="onTabChange('graphs')">Graphes</div>
        <div class="tab" (click)="onTabChange('logs')">Logs</div>
        <div class="tab" (click)="onTabChange('resources')">Ressources</div>
      </div>

      <!-- Content -->
      <div class="report-content">
        <!-- Main Report Block -->
        <div class="block">
          <h2 style="margin-top: 0">Rapport de simulation</h2>
          <div class="row">
            <div class="pill">Total Damage: 12 345</div>
            <div class="pill">Crit effectif: 38%</div>
            <div class="pill">Explosions Rouage: 2 &#64;10c</div>
            <div class="pill">Sinistro récup: 15c</div>
          </div>
          <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px">
            <div class="chart" aria-label="Damage over time"></div>
            <div class="chart" aria-label="Resources track"></div>
          </div>
        </div>

        <!-- Timeline / Logs Block -->
        <div class="block">
          <h3>Timeline</h3>
          <ol>
            <li>CastSpell Vol du temps → E1 (crit: non) : 420 dmg</li>
            <li>CastSpell Rouage &#64; (7,10) : mécanisme placé (charges 0)</li>
            <li>CastSpell Cadran &#64; (6,6) : heure=12 (départ)</li>
            <li>…</li>
            <li>TriggerExplosion Rouage (10) : 1980 dmg AoE</li>
          </ol>

          <h3>Logs</h3>
          <pre>[INFO] PA:12→10 après Vol du temps
[PROC] Cours du temps: transpose → +1 PW (Distorsion inactif)
[DMG] Pointe-heure (crit) → 1120 (dos+DI)
[MECH] Sinistro charges: 14→15
[HEAL] Sinistro récupéré: +1 PA /5 charges, +120 PV
…
          </pre>
        </div>
      </div>
    </section>
  `,
  styleUrl: './report.component.css'
})
export class ReportComponent {
  onTabChange(tabName: string): void {
    // TODO: Switch between tabs
    console.log('Switch to tab:', tabName);
  }
}

