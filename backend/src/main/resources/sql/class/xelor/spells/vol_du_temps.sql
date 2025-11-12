-- =========================================
-- VOL DU TEMPS
-- =========================================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_VDT');
DELETE FROM spell_variant      WHERE spell_id='XEL_VDT';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_VDT';
DELETE FROM spell              WHERE id='XEL_VDT';

DELETE FROM status_effect      WHERE status_id IN ('TIME_STEAL_STACKS');
DELETE FROM status_def         WHERE id IN ('TIME_STEAL_STACKS');

INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('TIME_STEAL_STACKS', 'Vol du Temps (stacks)', 999, 'INFINITE', NULL);

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'TIME_STEAL_STACKS',
        'ON_CASTER_TURN_START',
        'SET_STATUS_FLAG',
        '{ "flag":"usedThisTurn", "value": false }'
    );

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'TIME_STEAL_STACKS',
        'ON_CASTER_TURN_END',
        'RESET_STACKS',
        '{ "onlyIfFlagEquals": { "flag":"usedThisTurn", "value": false } }'
    );

-- Sort VOL DU TEMPS
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_VDT', 'XEL', 'Vol du Temps', 'NONE', 'INNATE',
             0, 0, 1, 1, FALSE, FALSE,
             0, 1, 1, 'NONE', 'STEP'
         );

-- Ratio (aucun dégât)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_VDT', 185, 0);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_VDT', 'NORMAL');

-- Effets au cast (ordre important)
-- S'assurer que le statut existe sur SELF
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'SELF',
       '{ "status":"TIME_STEAL_STACKS", "ensure": true }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_VDT' AND v.kind='NORMAL';

-- Consommer PW = stacks + 1 (coût dynamique)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'CONSUME_PW_DYNAMIC', 'SELF',
       '{ "status":"TIME_STEAL_STACKS", "mode":"STACKS_PLUS_ONE" }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_VDT' AND v.kind='NORMAL';

-- Donner PA = stacks + 1 (gain dynamique)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 2, 'ADD_AP_DYNAMIC', 'SELF',
       '{ "status":"TIME_STEAL_STACKS", "mode":"STACKS_PLUS_ONE" }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_VDT' AND v.kind='NORMAL';

-- Incrémenter les stacks (+1)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 3, 'INCREMENT_STACKS', 'SELF',
       '{ "status":"TIME_STEAL_STACKS", "amount": 1, "cap": 999 }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_VDT' AND v.kind='NORMAL';

-- Marquer "utilisé ce tour"
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 4, 'SET_STATUS_FLAG', 'SELF',
       '{ "status":"TIME_STEAL_STACKS", "flag":"usedThisTurn", "value": true }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_VDT' AND v.kind='NORMAL';
