package com.wakfu.simulateur.backend.infrastructure.repository;

import com.wakfu.simulateur.backend.infrastructure.entity.PassiveEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PassiveRepository extends JpaRepository<PassiveEntity, String> {

    @EntityGraph(attributePaths = {
            "characterClass",
            "effects"
    })
    Optional<PassiveEntity> findById(String id);

    @EntityGraph(attributePaths = {
            "characterClass",
            "effects"
    })
    List<PassiveEntity> findAll();
}

