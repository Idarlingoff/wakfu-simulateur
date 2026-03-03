package com.wakfu.simulateur.backend.application.controller;

import com.wakfu.simulateur.backend.application.dto.PassiveDTO;
import com.wakfu.simulateur.backend.infrastructure.entity.PassiveEntity;
import com.wakfu.simulateur.backend.infrastructure.mapper.PassiveDTOMapper;
import com.wakfu.simulateur.backend.infrastructure.repository.PassiveRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/passives")
@CrossOrigin(origins = "http://localhost:4200")
public class PassiveController {

    private final PassiveRepository passiveRepository;
    private final PassiveDTOMapper mapper;

    public PassiveController(PassiveRepository passiveRepository, PassiveDTOMapper mapper) {
        this.passiveRepository = passiveRepository;
        this.mapper = mapper;
    }

    @GetMapping
    public ResponseEntity<List<PassiveDTO>> getAllPassives(
            @RequestParam(required = false) String classId) {
        List<PassiveEntity> entities = passiveRepository.findAll();

        if (classId != null && !classId.isEmpty()) {
            entities = entities.stream()
                    .filter(p -> p.getCharacterClass() != null &&
                                 classId.equals(p.getCharacterClass().getId()))
                    .toList();
        }

        return ResponseEntity.ok(mapper.toDTOs(entities));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PassiveDTO> getPassiveById(@PathVariable String id) {
        return passiveRepository.findById(id)
                .map(mapper::toDTO)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}

