-- ============================
-- DISTORSION
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_DISTO');
DELETE FROM spell_variant      WHERE spell_id='XEL_DISTO';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_DISTO';
DELETE FROM spell              WHERE id='XEL_DISTO';

DELETE FROM status_effect      WHERE status_id IN ('DISTORTION_POWER','DISTORTION_ACTIVE');
DELETE FROM status_def         WHERE id IN ('DISTORTION_POWER','DISTORTION_ACTIVE');

-- Statuts

-- Puissance cumulée pour la PROCHAINE Distorsion (0..4 => 0%..400%)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('DISTORTION_POWER', 'Distorsion - puissance (next cast)', 4, 'INFINITE', NULL);

-- +100% par tour de cadran (si le cadran du lanceur est vivant), cap 4
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DISTORTION_POWER',
        'ON_HOUR_WRAPPED',
        'INCREMENT_STACKS_IF',
        '{
           "amount":1,
           "cap":4,
           "condition": { "mechanismAlive": { "kind":"DIAL", "owner":"CASTER" } }
         }'
    );

-- Reset si le cadran du lanceur meurt
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DISTORTION_POWER',
        'ON_MECHANISM_DESTROYED',
        'RESET_STACKS_IF',
        '{
           "mechanism": { "kind":"DIAL", "owner":"CASTER" }
         }'
    );

-- Statut actif pendant le tour où Distorsion est lancée
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('DISTORTION_ACTIVE', 'Distorsion (actif)', 1, 'FIXED', 1);

-- Pendant Distorsion : à CHAQUE sort du lanceur -> ajoute une ligne de dégâts Lumière
-- ratio = 6 * (PA + PW du sort lancé), multiplié par la puissance (stacks) enregistrée
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'DISTORTION_ACTIVE',
        'ON_CASTER_SPELL_CAST',
        'BONUS_DAMAGE_PER_RESOURCE',
        '{
           "element":"LIGHT",
           "ratioPerAP":6,
           "ratioPerPW":6,
           "multiplierFromStatus": {
             "status":"DISTORTION_POWER",
             "perStackPct":100
           }
         }'
    );

-- Sort DISTORSION (SELF)
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_DISTO', 'XEL', 'Distorsion', 'NONE', 'INNATE',
             0, 4, 1, 1, FALSE, FALSE,
             0, 99, 99, 'NONE', 'STEP'
         );

INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_DISTO', 185, 0);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_DISTO', 'NORMAL');

-- Effets au cast (ordre important)

-- (optionnel) si le passif "Cours du temps" est présent -> CD 3 tours
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'PRE_CAST', 0, 'COOLDOWN_SET_IF_PASSIVE', 'SELF',
       '{ "cooldown":3, "passiveId":"XEL_COURS_TEMPS" }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DISTO' AND v.kind='NORMAL';

-- S'assurer que les statuts existent
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'SELF',
       '{ "status":"DISTORTION_POWER", "ensure": true }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DISTO' AND v.kind='NORMAL';

-- Activer Distorsion pour CE tour (les dégâts bonus se baseront sur la puissance courante)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'APPLY_STATUS', 'SELF',
       '{ "status":"DISTORTION_ACTIVE", "duration":1 }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DISTO' AND v.kind='NORMAL';

-- Après activation, la puissance retombe à 0 pour préparer la prochaine accumulation
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 2, 'RESET_STACKS', 'SELF',
       '{ "status":"DISTORTION_POWER" }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DISTO' AND v.kind='NORMAL';
