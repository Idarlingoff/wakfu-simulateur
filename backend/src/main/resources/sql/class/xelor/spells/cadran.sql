-- ============================
-- DIAL
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_DIAL');
DELETE FROM spell_variant      WHERE spell_id='XEL_DIAL';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_DIAL';
DELETE FROM spell              WHERE id='XEL_DIAL';

DELETE FROM status_effect      WHERE status_id IN ('DIAL_AURA','PONCTUALITE');
DELETE FROM status_def         WHERE id IN ('DIAL_AURA','PONCTUALITE');

-- Statuts

-- Aura liée au cadran : gère avance d'heure, bonus conditionnel sur case-heure, etc.
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('DIAL_AURA', 'Aura du Dial', 1, 'INFINITE', NULL);

-- Bonus ponctualité (appliqué en début de tour si le Xélor est sur l’heure courante)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('PONCTUALITE', 'Ponctualité (+50% DI)', 1, 'FIXED', 1);

-- DIAL_AURA effects
-- (1) Chaque PW dépensé par le lanceur avance l'heure de +1 (déplacements inclus)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DIAL_AURA',
        'ON_PW_SPENT',
        'ADVANCE_DIAL_HOUR',
        '{ "owner":"CASTER", "by":1 }'
    );

-- (2) Bonus DI +50% tant que le Xélor est sur l’heure courante
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DIAL_AURA',
        'ALWAYS',
        'MODIFY_STAT_WHILE',
        '{
           "target":"SELF",
           "stat":"dmgInflictedConditionalPct",
           "flat":50,
           "while": { "casterOnCurrentHour": true }
         }'
    );

-- (3) Début de tour : si Xélor sur l’heure, appliquer Ponctualité (+50% DI pour le tour)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DIAL_AURA',
        'ON_CASTER_TURN_START',
        'APPLY_STATUS_IF',
        '{
           "condition": { "casterOnCurrentHour": true },
           "status": "PONCTUALITE",
           "duration": 1
         }'
    );

-- (4) Début de tour : si Ponctualité appliquée, l’heure courante donne +2 PO (bonus horaire de tour)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DIAL_AURA',
        'ON_CASTER_TURN_START',
        'SET_DIAL_HOUR_BONUS',
        '{
           "owner":"CASTER",
           "bonus":"RANGE_PLUS_2",
           "durationTurns": 1
         }'
    );

-- (5) En cours de tour : si un tour de cadran a lieu et que l'heure courante
--     se trouve sur la case du Xélor après l'avance => Ponctualité pour ce tour
DELETE FROM status_effect
WHERE status_id='DIAL_AURA'
  AND tick_phase='ON_HOUR_WRAPPED'
  AND effect_type='APPLY_STATUS_IF';

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DIAL_AURA',
        'ON_HOUR_WRAPPED',
        'APPLY_STATUS_IF',
        '{
           "condition": { "casterOnCurrentHour": true },
           "status": "PONCTUALITE",
           "duration": 1
         }'
    );

-- (6) Et l'heure courante fournit +2 PO pour le reste du tour courant
DELETE FROM status_effect
WHERE status_id='DIAL_AURA'
  AND tick_phase='ON_HOUR_WRAPPED'
  AND effect_type='SET_DIAL_HOUR_BONUS';

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DIAL_AURA',
        'ON_HOUR_WRAPPED',
        'SET_DIAL_HOUR_BONUS',
        '{
           "owner":"CASTER",
           "bonus":"RANGE_PLUS_2",
           "durationTurns": 1
         }'
    );

-- PONCTUALITE effects : +50% DI constant pendant le tour
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'PONCTUALITE',
        'ALWAYS',
        'MODIFY_STAT',
        '{ "target":"SELF", "stat":"dmgInflictedConditionalPct", "flat":50 }'
    );

-- 2) Sort DIAL

INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_DIAL', 'XEL', 'Dial', 'NONE', 'INNATE',
             2, 0, 1, 3, FALSE, TRUE,
             0, 1, 1, 'NONE', 'STEP'
         );

INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_DIAL', 185, 0);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_DIAL', 'NORMAL');

-- Effets au cast

-- (A) Gérer l’augmentation de coût / cooldown si le passif "Connaissance du passé" est présent
--     (ces effets sont traités AVANT la dépense de ressources par le moteur)
INSERT INTO effect_condition_group (op) VALUES ('AND');
-- On utilisera le dernier id inséré comme groupe de condition
-- (si tu as déjà un groupe 'AND' générique, tu peux réutiliser son id)

-- Condition: le lanceur possède le passif XEL_CONNAISSANCE_PASSE
INSERT INTO effect_condition (group_id, cond_type, params_json)
VALUES (3, 'HAS_PASSIVE', '{ "passiveId":"XEL_CONNAISSANCE_PASSE" }');

-- Effet: coût supplémentaire en PW (+2)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'PRE_CAST', 0, 'EXTRA_COST_IF_PASSIVE', 'SELF',
       '{ "resource":"PW", "extra":2, "passiveId":"XEL_CONNAISSANCE_PASSE" }',
       (SELECT MAX(id) FROM effect_condition_group)
FROM spell_variant v
WHERE v.spell_id='XEL_DIAL' AND v.kind='NORMAL';

-- Effet: +1 de cooldown si passif
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'PRE_CAST', 1, 'COOLDOWN_DELTA_IF_PASSIVE', 'SELF',
       '{ "delta":1, "passiveId":"XEL_CONNAISSANCE_PASSE" }',
       (SELECT MAX(id) FROM effect_condition_group)
FROM spell_variant v
WHERE v.spell_id='XEL_DIAL' AND v.kind='NORMAL';

-- Poser le mécanisme DIAL (unique par Xélor)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'SUMMON_MECHANISM', 'TARGET',
       '{
          "mechanism": "DIAL",
          "maxPerCaster": 1,
          "replaceExisting": true,
          "placeOnDialOnly": false
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DIAL' AND v.kind='NORMAL';

-- Téléporter le Xélor sur l’heure VI (swap si occupé)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'TELEPORT_TO_DIAL_HOUR', 'SELF',
       '{ "hour":6, "swapIfOccupied": true }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DIAL' AND v.kind='NORMAL';

-- Appliquer l’aura du cadran au Xélor (gère avance d’heure, bonus, ponctualité)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 2, 'APPLY_STATUS', 'SELF',
       '{ "status":"DIAL_AURA", "duration": null }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DIAL' AND v.kind='NORMAL';
