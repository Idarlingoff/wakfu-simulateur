package com.wakfu.simulateur.backend.infrastructure.gateway;

import com.wakfu.simulateur.backend.domain.spell.Spell;
import com.wakfu.simulateur.backend.domain.spell.port.SpellGateway;
import com.wakfu.simulateur.backend.infrastructure.mapper.SpellMapper;
import com.wakfu.simulateur.backend.infrastructure.repository.SpellRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class JpaSpellGateway implements SpellGateway {

    private final SpellRepository spellRepository;
    private final SpellMapper spellMapper;

    public JpaSpellGateway(SpellRepository spellRepository, SpellMapper spellMapper) {
        this.spellRepository = spellRepository;
        this.spellMapper = spellMapper;
    }

    @Override
    public Optional<Spell> findById(String spellId) {
        return spellRepository.findById(spellId).map(spellMapper::toDomain);
    }
}
