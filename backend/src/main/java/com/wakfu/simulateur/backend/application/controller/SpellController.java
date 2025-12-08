package com.wakfu.simulateur.backend.application.controller;

import com.wakfu.simulateur.backend.application.dto.SpellDTO;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellEntity;
import com.wakfu.simulateur.backend.infrastructure.mapper.SpellDTOMapper;
import com.wakfu.simulateur.backend.infrastructure.repository.SpellRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * Simple REST controller for Spell data access
 * No business logic - just CRUD operations
 */
@RestController
@RequestMapping("/api/spells")
@CrossOrigin(origins = "http://localhost:4200")
public class SpellController {

    private final SpellRepository spellRepository;
    private final SpellDTOMapper mapper;

    public SpellController(SpellRepository spellRepository, SpellDTOMapper mapper) {
        this.spellRepository = spellRepository;
        this.mapper = mapper;
    }

    /**
     * Get all spells
     */
    @GetMapping
    public ResponseEntity<List<SpellDTO>> getAllSpells(
            @RequestParam(required = false) String classId) {
        // Load variants first (without effects to avoid MultipleBagFetchException)
        List<SpellEntity> entities = spellRepository.findAllWithVariants();

        // Then load breakpoints separately to avoid MultipleBagFetchException
        List<String> ids = entities.stream().map(SpellEntity::getId).toList();
        if (!ids.isEmpty()) {
            List<SpellEntity> entitiesWithBreakpoints = spellRepository.findAllWithBreakpoints(ids);
            // Merge breakpoints into original entities
            for (SpellEntity entity : entities) {
                entitiesWithBreakpoints.stream()
                    .filter(e -> e.getId().equals(entity.getId()))
                    .findFirst()
                    .ifPresent(e -> entity.setBreakpoints(e.getBreakpoints()));
            }
        }

        // Simple filtering by classId if provided
        if (classId != null && !classId.isEmpty()) {
            entities = entities.stream()
                    .filter(s -> s.getCharacterClass() != null &&
                                 classId.equals(s.getCharacterClass().getId()))
                    .toList();
        }

        return ResponseEntity.ok(mapper.toDTOs(entities));
    }

    /**
     * Get spell by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<SpellDTO> getSpellById(@PathVariable String id) {
        // Load variants first (without effects to avoid MultipleBagFetchException)
        Optional<SpellEntity> entityOpt = spellRepository.findByIdWithVariants(id);
        if (entityOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        SpellEntity entity = entityOpt.get();

        // Then load breakpoints separately
        spellRepository.findByIdWithBreakpoints(id)
            .ifPresent(e -> entity.setBreakpoints(e.getBreakpoints()));

        return ResponseEntity.ok(mapper.toDTO(entity));
    }
}

