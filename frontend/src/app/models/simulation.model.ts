/**
 * Simulation Model
 * Modèles pour les résultats de simulation
 */

import { TotalStats } from '../services/calculators/stats-calculator.service';

export interface SimulationContext {
  availablePa: number;
  availablePw: number;
  availableMp: number;
  currentPosition?: { x: number; y: number };
  buffs?: any[];
  debuffs?: any[];
}

export interface SimulationActionResult {
  success: boolean;
  actionId: string;
  actionType: string;
  spellId?: string;
  spellName?: string;
  damage?: number;
  paCost: number;
  pwCost: number;
  mpCost: number;
  message: string;
  details?: any;
}

export interface SimulationStepResult {
  stepId: string;
  stepNumber: number;
  actions: SimulationActionResult[];
  contextAfter: SimulationContext;
  success: boolean;
}

export interface SimulationResult {
  buildId: string;
  timelineId: string;
  buildStats: TotalStats;
  initialContext: SimulationContext;
  steps: SimulationStepResult[];
  finalContext: SimulationContext;
  totalDamage: number;
  totalPaUsed: number;
  totalPwUsed: number;
  totalMpUsed: number;
  success: boolean;
  errors: string[];
}

export interface SimulationSummary {
  totalDamage: number;
  averageDamagePerTurn: number;
  dps: number;
  totalPaUsed: number;
  totalPwUsed: number;
  totalMpUsed: number;
  resourceEfficiency: {
    damagePerPa: number;
    damagePerPw: number;
  };
  turnCount: number;
  successRate: number;
}

