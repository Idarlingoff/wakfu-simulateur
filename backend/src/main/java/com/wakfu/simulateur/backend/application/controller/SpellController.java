package com.wakfu.simulateur.backend.application.controller;

import com.wakfu.simulateur.backend.application.dto.SpellDTO;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellEntity;
import com.wakfu.simulateur.backend.infrastructure.mapper.SpellDTOMapper;
import com.wakfu.simulateur.backend.infrastructure.repository.SpellRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

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

    @GetMapping
    public ResponseEntity<List<SpellDTO>> getAllSpells(
            @RequestParam(required = false) String classId) {
        List<SpellEntity> entities = spellRepository.findAllWithVariants();

        List<String> ids = entities.stream().map(SpellEntity::getId).toList();
        if (!ids.isEmpty()) {
            List<SpellEntity> entitiesWithBreakpoints = spellRepository.findAllWithBreakpoints(ids);
            for (SpellEntity entity : entities) {
                entitiesWithBreakpoints.stream()
                    .filter(e -> e.getId().equals(entity.getId()))
                    .findFirst()
                    .ifPresent(e -> entity.setBreakpoints(e.getBreakpoints()));
            }
        }

        if (classId != null && !classId.isEmpty()) {
            entities = entities.stream()
                    .filter(s -> s.getCharacterClass() != null &&
                                 classId.equals(s.getCharacterClass().getId()))
                    .toList();
        }

        return ResponseEntity.ok(mapper.toDTOs(entities));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SpellDTO> getSpellById(@PathVariable String id) {
        Optional<SpellEntity> entityOpt = spellRepository.findByIdWithVariants(id);
        if (entityOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        SpellEntity entity = entityOpt.get();

        spellRepository.findByIdWithBreakpoints(id)
            .ifPresent(e -> entity.setBreakpoints(e.getBreakpoints()));

        return ResponseEntity.ok(mapper.toDTO(entity));
    }
}

