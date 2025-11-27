package com.wakfu.simulateur.backend.domain.spell.port;

import com.wakfu.simulateur.backend.domain.spell.Spell;

import java.util.Optional;

/**
 * Port d'accès au catalogue de sorts.
 */
public interface SpellGateway {

    Optional<Spell> findById(String spellId);
}
