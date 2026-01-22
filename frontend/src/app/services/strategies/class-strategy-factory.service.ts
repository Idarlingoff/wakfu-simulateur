/**
 * Factory pour gérer les différentes stratégies de simulation par classe
 * Permet d'obtenir la bonne stratégie selon la classe du personnage
 */

import { Injectable, inject } from '@angular/core';
import { ClassSimulationStrategy } from './class-simulation-strategy.interface';
import { XelorSimulationStrategy } from './xelor-simulation-strategy.service';
import { DefaultSimulationStrategy } from './default-simulation-strategy.service';
import { Build } from '../../models/build.model';

@Injectable({
  providedIn: 'root'
})
export class ClassStrategyFactory {

  private readonly xelorStrategy = inject(XelorSimulationStrategy);
  private readonly defaultStrategy = inject(DefaultSimulationStrategy);

  // Map des stratégies par nom de classe
  private readonly strategies = new Map<string, ClassSimulationStrategy>([
    ['XEL', this.xelorStrategy],
    // TODO: Ajouter les autres classes ici
    // ['Iop', this.iopStrategy],
    // ['Eniripsa', this.eniStrategy],
    // etc.
  ]);

  /**
   * Obtient la stratégie de simulation appropriée pour un build
   *
   * @param build Build du joueur
   * @returns Stratégie de simulation pour la classe du build
   */
  getStrategyForBuild(build: Build): ClassSimulationStrategy {
    const className = build.classId || 'Default';
    return this.getStrategy(className);
  }

  /**
   * Obtient la stratégie de simulation pour une classe donnée
   *
   * @param className Nom de la classe
   * @returns Stratégie de simulation pour la classe
   */
  getStrategy(className: string): ClassSimulationStrategy {
    const strategy = this.strategies.get(className);

    if (strategy) {
      console.log(`[STRATEGY FACTORY] Strategy found for class: ${className}`);
      return strategy;
    }

    console.warn(`[STRATEGY FACTORY] No specific strategy for class: ${className}, using default`);
    return this.defaultStrategy;
  }

  /**
   * Enregistre une nouvelle stratégie pour une classe
   *
   * @param className Nom de la classe
   * @param strategy Stratégie à enregistrer
   */
  registerStrategy(className: string, strategy: ClassSimulationStrategy): void {
    this.strategies.set(className, strategy);
    console.log(`[STRATEGY FACTORY] Registered strategy for class: ${className}`);
  }

  /**
   * Liste toutes les classes supportées
   *
   * @returns Liste des noms de classes supportées
   */
  getSupportedClasses(): string[] {
    return Array.from(this.strategies.keys()).filter(key => key === key.charAt(0).toUpperCase() + key.slice(1));
  }
}

