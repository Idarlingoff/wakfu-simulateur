package com.wakfu.simulateur.backend.domain.spell;

/**
 * Portée d'un effet de sort.
 */
public enum TargetScope {
    SELF,
    TARGET,
    AREA,
    GLOBAL,
    LAST_MOVED,
    LAST_SWAPPED
}
