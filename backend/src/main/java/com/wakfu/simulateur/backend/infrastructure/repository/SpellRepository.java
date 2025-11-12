package com.wakfu.simulateur.backend.infrastructure.repository;

import com.wakfu.simulateur.backend.infrastructure.entity.SpellEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SpellRepository extends JpaRepository<SpellEntity, String> {

    @EntityGraph(attributePaths = {
            "characterClass",
            "variants", "variants.effects", "variants.effects.condGroup", "variants.effects.condGroup.conditions",
            "breakpoints"
    })
    Optional<SpellEntity> findById(String id);
}
