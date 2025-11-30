package com.wakfu.simulateur.backend.infrastructure.repository;

import com.wakfu.simulateur.backend.infrastructure.entity.EffectConditionGroupEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellVariantEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface SpellRepository extends JpaRepository<SpellEntity, String> {

    @Query("SELECT DISTINCT s FROM SpellEntity s " +
           "LEFT JOIN FETCH s.characterClass " +
           "LEFT JOIN FETCH s.variants")
    List<SpellEntity> findAllWithVariants();

    @Query("SELECT DISTINCT v FROM SpellVariantEntity v " +
           "LEFT JOIN FETCH v.effects e " +
           "LEFT JOIN FETCH e.condGroup cg " +
           "WHERE v.spell.id IN :spellIds")
    List<SpellVariantEntity> findVariantsWithEffects(List<String> spellIds);

    @Query("SELECT DISTINCT cg FROM EffectConditionGroupEntity cg " +
           "LEFT JOIN FETCH cg.conditions " +
           "WHERE cg.id IN :groupIds")
    List<EffectConditionGroupEntity> findConditionGroupsWithConditions(List<Long> groupIds);

    @Query("SELECT DISTINCT s FROM SpellEntity s " +
           "LEFT JOIN FETCH s.breakpoints " +
           "WHERE s.id IN :ids")
    List<SpellEntity> findAllWithBreakpoints(List<String> ids);

    @Query("SELECT DISTINCT s FROM SpellEntity s " +
           "LEFT JOIN FETCH s.characterClass " +
           "LEFT JOIN FETCH s.variants " +
           "WHERE s.id = :id")
    Optional<SpellEntity> findByIdWithVariants(String id);

    @Query("SELECT DISTINCT s FROM SpellEntity s " +
           "LEFT JOIN FETCH s.breakpoints " +
           "WHERE s.id = :id")
    Optional<SpellEntity> findByIdWithBreakpoints(String id);
}
