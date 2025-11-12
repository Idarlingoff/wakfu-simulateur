-- =========================================
-- CONTRE LA MONTRE
-- =========================================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_CLM');
DELETE FROM spell_variant      WHERE spell_id='XEL_CLM';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_CLM';
DELETE FROM spell              WHERE id='XEL_CLM';

DELETE FROM status_effect      WHERE status_id IN ('CLM_MARK');
DELETE FROM status_def         WHERE id IN ('CLM_MARK');

-- Statut appliqué à la cible : marque + cooldown 4 tours
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('CLM_MARK', 'Contre la Montre (marque + CD)', 1, 'FIXED', 4);

-- Déclenchement unique en fin de tour du Xélor (le lanceur) :
-- CAS A) cible n'est PAS le Xélor ni une de ses invocations -> retour à la position début de tour
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'CLM_MARK',
        'ON_CASTER_TURN_END',
        'TELEPORT_SAVED_POS',
        '{
           "once": true,
           "requireCasterOwner": true,
           "ifTargetCategory": "NOT_CASTER_NOR_SUMMON",
           "to": "START_OF_TURN_POS"          ,
           "saveCastPos": true,
           "saveStartPos": true
         }'
    );

-- CAS B) cible = Xélor OU une de ses invocations -> retour à la position du CAST
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'CLM_MARK',
        'ON_CASTER_TURN_END',
        'TELEPORT_SAVED_POS',
        '{
           "once": true,
           "requireCasterOwner": true,
           "ifTargetCategory": "CASTER_OR_SUMMON",
           "to": "CAST_POS",
           "saveCastPos": true,
           "saveStartPos": true
         }'
    );

-- Sort "Contre la montre"
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_CLM', 'XEL', 'Contre la montre', 'NONE', 'NEUTRAL',
             2, 0, 1, 3, TRUE, TRUE,
             0, 1, 1, 'NONE', 'STEP'
         );

-- Ratio (aucun dégât)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_CLM', 185, 0);

-- Variante (pas de crit)
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_CLM', 'NORMAL');

-- Effet au cast : applique la marque sur la CIBLE (durée 4 tours)
-- Le moteur enregistre la position au cast et la position de début de tour de la cible
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{
          "status":"CLM_MARK",
          "duration": 4,
          "saveCastPos": true,
          "saveStartPos": true
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_CLM' AND v.kind='NORMAL';
