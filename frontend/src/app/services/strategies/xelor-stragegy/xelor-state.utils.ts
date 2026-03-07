import { SimulationActionResult, SimulationContext } from '../../calculators/simulation-engine.service';

export interface XelorState {
  mechanismCharges: Map<string, number>;
  sharedMechanismCharges: Map<'cog' | 'sinistro', number>;
  activeAuras: Set<string>;
  currentDialHour?: number;
  dialId?: string;
  dialFirstLoopCompleted: boolean;
  delayedEffects: any[];
  mechanismsPlacedThisTurn: Map<string, number>;
  distorsionActive: boolean;
  distorsionCooldownRemaining: number;
  triggeredActions: SimulationActionResult[];
}

const XELOR_KEY = 'XEL';

export function getXelorState(context: SimulationContext, initialize = false): XelorState {
  if (!context.classState) {
    if (!initialize) {
      return createDefaultXelorState();
    }
    context.classState = {};
  }

  const existing = context.classState[XELOR_KEY] as XelorState | undefined;
  if (existing) {
    return existing;
  }

  const created = createDefaultXelorState();
  if (initialize) {
    context.classState[XELOR_KEY] = created;
  }
  return created;
}

function createDefaultXelorState(): XelorState {
  return {
    mechanismCharges: new Map<string, number>(),
    sharedMechanismCharges: new Map<'cog' | 'sinistro', number>(),
    activeAuras: new Set<string>(),
    currentDialHour: undefined,
    dialId: undefined,
    dialFirstLoopCompleted: false,
    delayedEffects: [],
    mechanismsPlacedThisTurn: new Map<string, number>(),
    distorsionActive: false,
    distorsionCooldownRemaining: 0,
    triggeredActions: []
  };
}
