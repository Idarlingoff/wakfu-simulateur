-- =========================================
-- XÉLOR
-- =========================================
DELETE FROM class_ref WHERE id = 'XEL';
INSERT INTO class_ref(id, name) VALUES
    ('XEL','Xélor');

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
SELECT MAX(id), 'HAS_PASSIVE', '{ "passiveId":"XEL_CONNAISSANCE_PASSE" }'
FROM effect_condition_group;

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

-- ============================
--  DESYNCHRO
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_DESYNCHRO');
DELETE FROM effect_condition   WHERE group_id IN (SELECT cond_group_id FROM spell_effect WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_DESYNCHRO') AND cond_group_id IS NOT NULL);
DELETE FROM spell_variant      WHERE spell_id='XEL_DESYNCHRO';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_DESYNCHRO';
DELETE FROM spell              WHERE id='XEL_DESYNCHRO';

INSERT INTO spell  VALUES (
                              'XEL_DESYNCHRO', 'XEL', 'Désynchronisation', 'WATER', 'ELEMENTAL',
                              4, 0, 3, 6, TRUE, TRUE,
                              0, 2, 0, 'AREA', 'STEP'
                          );

INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_DESYNCHRO', 185, 78);

INSERT INTO EFFECT_CONDITION_GROUP (OP) values ( 'AND' );

INSERT INTO effect_condition (group_id, cond_type, params_json)
SELECT MAX(id), 'ON_DIAL_CELL', '{}'
FROM effect_condition_group;

INSERT INTO spell_variant (spell_id, kind) VALUES
                                               ('XEL_DESYNCHRO', 'NORMAL'),
                                               ('XEL_DESYNCHRO', 'CRIT');

-- Cas de base
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'AREA',
       '{"amount":78,"element":"WATER"}', NULL
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='NORMAL';

-- NORMAL : -3 PA sur cibles
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 1, 'SUB_AP', 'TARGET',
       '{"amount":3}', NULL
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='NORMAL';

-- CRIT : dégâts 127 eau en zone
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'AREA',
       '{"amount":98,"element":"WATER"}', NULL
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='CRIT';

-- CRIT : -3 PA sur cibles
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 1, 'SUB_AP', 'TARGET',
       '{"amount":3}', NULL
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='CRIT';

-- 6) Effets conditionnels (Cas 1 : lancé sur le Cadran) — cond_group_id = 1
-- NORMAL : +6h puis +2PA au lanceur
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 2, 'ADVANCE_DIAL', 'SELF',
       '{"hours":6}', 2
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 3, 'ADD_AP', 'SELF',
       '{"amount":2}', 2
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='NORMAL';

-- CRIT : +6h puis +2PA au lanceur (mêmes effets/ordre)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 2, 'ADVANCE_DIAL', 'SELF',
       '{"hours":6}', 2
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='CRIT';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 3, 'ADD_AP', 'SELF',
       '{"amount":2}', 2
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='CRIT';

-- =========================================
-- DÉVOUEMENT
-- =========================================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_DEVOUEMENT');
DELETE FROM spell_variant      WHERE spell_id='XEL_DEVOUEMENT';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_DEVOUEMENT';
DELETE FROM spell              WHERE id='XEL_DEVOUEMENT';

-- Sort principal
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_DEVOUEMENT', 'XEL', 'Dévouement', 'NONE', 'NEUTRAL',
             0, 4, 0, 3, TRUE, TRUE,
             0, 99, 99, 'NONE', 'STEP'
         );

-- Ratio
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_DEVOUEMENT', 185, 0);

-- Variante unique (pas de critique)
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_DEVOUEMENT', 'NORMAL');

-- Effets — Donne 3PA à la cible au début de son prochain tour
-- Avec le passif "Maître du Cadran", cet effet se résout immédiatement lors d'un tour de cadran
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_TARGET_TURN_START', 0, 'ADD_AP', 'TARGET',
       '{"amount":3,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DEVOUEMENT' AND v.kind='NORMAL';

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
             0, 4, 0, 1, FALSE, FALSE,
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

-- ============================
--  HORLOGE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_HORLOGE');
DELETE FROM spell_variant      WHERE spell_id='XEL_HORLOGE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_HORLOGE';
DELETE FROM spell              WHERE id='XEL_HORLOGE';

DELETE FROM status_effect      WHERE status_id IN ('HORLOGE_BANK','HORLOGE_MARK');
DELETE FROM status_def         WHERE id IN ('HORLOGE_BANK','HORLOGE_MARK');

INSERT INTO spell VALUES (
                             'XEL_HORLOGE','XEL','Horloge','WATER','ELEMENTAL',
                             5,0,1,3,TRUE,TRUE,
                             0,2,1,'LINE','STEP'
                         );

INSERT INTO spell_ratio_breakpoint VALUES
    ('XEL_HORLOGE',185,139);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_HORLOGE','NORMAL'),
       ('XEL_HORLOGE','CRIT');

-- Compteur horloge
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('HORLOGE_BANK','Banque Horloge',1,'INFINITE',NULL);

INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('HORLOGE_MARK','Horloge',1,'FIXED',1);

-- Ticks de dégâts : fin du tour de la cible ET hour-wrap
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    ('HORLOGE_MARK','ON_TARGET_TURN_END','DEAL_DAMAGE',
     '{"element":"WATER","indirect":true,"amountFromStatus":true,"doubleField":"double"}');

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    ('HORLOGE_MARK','ON_HOUR_WRAPPED','DEAL_DAMAGE',
     '{"element":"WATER","indirect":true,"amountFromStatus":true,"doubleField":"double"}');

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{
          "status":"HORLOGE_MARK",
          "amount":139,
          "duration":1,
          "doubleFromBank": { "bankStatus":"HORLOGE_BANK", "per":12, "consume":true }
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_HORLOGE' AND v.kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{
          "status":"HORLOGE_MARK",
          "amount":174,
          "duration":1,
          "doubleFromBank": { "bankStatus":"HORLOGE_BANK", "per":12, "consume":true }
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_HORLOGE' AND v.kind='CRIT';

-- ============================
--  PARADOXE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_PARADOXE');
DELETE FROM spell_variant      WHERE spell_id='XEL_PARADOXE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_PARADOXE';
DELETE FROM spell              WHERE id='XEL_PARADOXE';

INSERT INTO spell VALUES (
                             'XEL_PARADOXE','XEL','Paradoxe','AIR','ELEMENTAL',
                             4,0,1,3,TRUE,FALSE,
                             0,2,1,'NONE','STEP'
                         );

INSERT INTO spell_ratio_breakpoint VALUES
    ('XEL_PARADOXE',185,78);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_PARADOXE','NORMAL'),
       ('XEL_PARADOXE','CRIT');

-- Effets NORMAL
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'TELEPORT_SYMMETRIC', 'AREA', '{}'
FROM spell_variant v WHERE v.spell_id='XEL_PARADOXE' AND v.kind='NORMAL';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'DEAL_DAMAGE', 'AREA', '{"amount":78,"element":"AIR","shape":"CROSS","range":2,"includeCenter":true}'
FROM spell_variant v WHERE v.spell_id='XEL_PARADOXE' AND v.kind='NORMAL';

-- Effets CRIT
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'TELEPORT_SYMMETRIC', 'AREA', '{}'
FROM spell_variant v WHERE v.spell_id='XEL_PARADOXE' AND v.kind='CRIT';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'DEAL_DAMAGE', 'AREA', '{"amount":98,"element":"AIR","shape":"CROSS","range":2,"includeCenter":true}'
FROM spell_variant v WHERE v.spell_id='XEL_PARADOXE' AND v.kind='CRIT';

-- ============================
--  POINTE-HEURE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_POINTE_HEURE');
DELETE FROM spell_variant      WHERE spell_id='XEL_POINTE_HEURE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_POINTE_HEURE';
DELETE FROM spell              WHERE id='XEL_POINTE_HEURE';

INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_POINTE_HEURE', 'XEL', 'Pointe-heure', 'AIR', 'ELEMENTAL',
             2, 0, 2, 4, TRUE, TRUE,
             0, 2, 1, 'LINE', 'STEP'
         );

INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES
    ('XEL_POINTE_HEURE', 185, 46);

INSERT INTO spell_variant (spell_id, kind)
VALUES
    ('XEL_POINTE_HEURE', 'NORMAL'),
    ('XEL_POINTE_HEURE', 'CRIT');

-- Effets variant NORMAL : dégâts 46 AIR + TP 2 cases en arrière

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET',
       '{"amount":46, "element":"AIR"}'
FROM spell_variant v
WHERE v.spell_id='XEL_POINTE_HEURE' AND v.kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'TELEPORT', 'TARGET',
       '{"cells":2, "direction":"BACK"}'
FROM spell_variant v
WHERE v.spell_id='XEL_POINTE_HEURE' AND v.kind='NORMAL';

-- Effets variant CRIT : dégâts 57 AIR + TP 2 cases en arrière

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET',
       '{"amount":57, "element":"AIR"}'
FROM spell_variant v
WHERE v.spell_id='XEL_POINTE_HEURE' AND v.kind='CRIT';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'TELEPORT', 'TARGET',
       '{"cells":2, "direction":"BACK"}'
FROM spell_variant v
WHERE v.spell_id='XEL_POINTE_HEURE' AND v.kind='CRIT';

-- =========================================
-- RALENTISSEMENT
-- =========================================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_RALENTISSEMENT');
DELETE FROM spell_variant      WHERE spell_id='XEL_RALENTISSEMENT';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_RALENTISSEMENT';
DELETE FROM spell              WHERE id='XEL_RALENTISSEMENT';

-- Sort
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_RALENTISSEMENT', 'XEL', 'Ralentissement', 'WATER', 'ELEMENTAL',
             1, 1, 1, 3, TRUE, TRUE,
             0, 3, 2, 'NONE', 'STEP'
         );

-- Ratio (palier 185) — valeur de base (non-crit)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_RALENTISSEMENT', 185, 27);

-- Variantes NORMAL / CRIT
INSERT INTO spell_variant (spell_id, kind) VALUES
                                               ('XEL_RALENTISSEMENT','NORMAL'),
                                               ('XEL_RALENTISSEMENT','CRIT');

-- Effets NORMAL
-- Ordre: dégâts -> +15 volonté (SELF) -> -2 PA (TARGET)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET',
       '{"amount":27,"element":"WATER"}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'ADD_WILLPOWER', 'SELF',
       '{"amount":15,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 2, 'SUB_AP', 'TARGET',
       '{"amount":2}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='NORMAL';

-- Effets CRIT (dégâts 34, le reste identique)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET',
       '{"amount":34,"element":"WATER"}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='CRIT';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'ADD_WILLPOWER', 'SELF',
       '{"amount":15,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='CRIT';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 2, 'SUB_AP', 'TARGET',
       '{"amount":2}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='CRIT';

-- ============================
-- REGULATEUR
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_REGULATEUR');
DELETE FROM spell_variant      WHERE spell_id='XEL_REGULATEUR';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_REGULATEUR';
DELETE FROM spell              WHERE id='XEL_REGULATEUR';

DELETE FROM status_effect      WHERE status_id IN ('REGULATOR_PW_AURA');
DELETE FROM status_def         WHERE id IN ('REGULATOR_PW_AURA');

-- Définition du statut "aura PW" (durée infinie, tick au début du tour du lanceur)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('REGULATOR_PW_AURA', 'Régulateur : aura +1 PW', 1, 'INFINITE', NULL);

-- Tick : début du tour du Xélor → +1 PW si un Régulateur (owner=caster) est vivant
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json)
VALUES (
           'REGULATOR_PW_AURA',
           'ON_CASTER_TURN_START',
           'ADD_PW',
           '{
              "amount": 1,
              "requireMechanismAlive": { "kind": "REGULATOR", "owner": "CASTER" }
            }'
       );

-- Sort REGULATEUR
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_REGULATEUR', 'XEL', 'Régulateur', 'NONE', 'NEUTRAL',
             0, 3, 1, 2, FALSE, FALSE,
             0, 1, 1, 'NONE', 'STEP'
         );

-- Ratio (aucun dégât) pour cohérence
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_REGULATEUR', 185, 0);

-- Variante unique (pas de critique)
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_REGULATEUR', 'NORMAL');

-- Effets au cast
-- Invoquer/poser le mécanisme REGULATOR
--     - max 1 par Xélor (replaceExisting)
--     - uniquement sur les cases du cadran (placeOnDialOnly)
--     - capture des dégâts directs des invocations du Xélor (meta pour le moteur)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'SUMMON_MECHANISM', 'TARGET',
       '{
          "mechanism": "REGULATOR",
          "maxPerCaster": 1,
          "replaceExisting": true,
          "placeOnDialOnly": true,
          "captureDirectDamageOf": ["DIAL","SINISTRO","ROUAGE"]
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_REGULATEUR' AND v.kind='NORMAL';

-- Appliquer l''aura PW au Xélor (s''active tant qu''un Régulateur du lanceur est vivant)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'APPLY_STATUS', 'SELF',
       '{
          "status":"REGULATOR_PW_AURA",
          "duration": null
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_REGULATEUR' AND v.kind='NORMAL';

-- ============================
--  RETOUR SPONTANE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_RETOUR_SPONTANE');
DELETE FROM spell_variant      WHERE spell_id='XEL_RETOUR_SPONTANE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_RETOUR_SPONTANE';
DELETE FROM spell              WHERE id='XEL_RETOUR_SPONTANE';

INSERT INTO spell VALUES (
                             'XEL_RETOUR_SPONTANE','XEL','Retour spontané','AIR','ELEMENTAL',
                             3,0,1,3,TRUE,TRUE,
                             0,3,2,'NONE','STEP'
                         );

INSERT INTO spell_ratio_breakpoint VALUES
    ('XEL_RETOUR_SPONTANE',185,75);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_RETOUR_SPONTANE','NORMAL'),
       ('XEL_RETOUR_SPONTANE','CRIT');

INSERT INTO effect_condition_group(op) VALUES ('AND');

-- Condition: le lanceur possède le passif XEL_CONNAISSANCE_PASSE
INSERT INTO effect_condition (group_id, cond_type, params_json)
SELECT MAX(id), 'LAST_MOVE_EXISTS', '{}'
FROM effect_condition_group;

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, cond_group_id, params_json)
SELECT v.id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET', null, '{"amount":75,"element":"AIR"}'
FROM spell_variant v
WHERE v.spell_id='XEL_RETOUR_SPONTANE' AND v.kind='NORMAL';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, cond_group_id, params_json)
SELECT v.id, 'ON_CAST', 1, 'REWIND_LAST_MOVE', 'TARGET', 1,'{}'
FROM spell_variant v
WHERE v.spell_id='XEL_RETOUR_SPONTANE' AND v.kind='NORMAL';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, cond_group_id, params_json)
SELECT v.id, 'ON_CAST',0,'DEAL_DAMAGE','TARGET',null, '{"amount":94,"element":"AIR"}'
FROM spell_variant v
WHERE v.spell_id='XEL_RETOUR_SPONTANE' AND v.kind='CRIT';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, cond_group_id, params_json)
SELECT v.id, 'ON_CAST',1,'REWIND_LAST_MOVE','TARGET',1, '{}'
FROM spell_variant v
WHERE v.spell_id='XEL_RETOUR_SPONTANE' AND v.kind='CRIT';


-- ============================
-- XELOR — ROUAGE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_ROUAGE');
DELETE FROM spell_variant      WHERE spell_id='XEL_ROUAGE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_ROUAGE';
DELETE FROM spell              WHERE id='XEL_ROUAGE';

DELETE FROM status_effect      WHERE status_id IN ('ROUAGE_AURA');
DELETE FROM status_def         WHERE id IN ('ROUAGE_AURA');

-- Aura Rouage (posee sur le Xélor; pilote les ticks)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('ROUAGE_AURA', 'Aura du Rouage', 1, 'INFINITE', NULL);

-- Fin de tour du Xélor : dégâts Lumière autour du/ des Rouage(s)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'ROUAGE_AURA',
        'ON_CASTER_TURN_END',
        'DEAL_AROUND_MECHANISM',
        '{
           "kind":"ROUAGE",
           "owner":"CASTER",
           "area":"CROSS2",
           "element":"LIGHT",
           "perChargeAmount":20,
           "scaleByCharges": true,
           "maxCharges":10
         }'
    );

-- Tour de cadran (HourWrap) : mêmes dégâts
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'ROUAGE_AURA',
        'ON_HOUR_WRAPPED',
        'DEAL_AROUND_MECHANISM',
        '{
           "kind":"ROUAGE",
           "owner":"CASTER",
           "area":"CROSS2",
           "element":"LIGHT",
           "perChargeAmount":20,
           "scaleByCharges": true,
           "maxCharges":10
         }'
    );

-- 2) Sort ROUAGE
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_ROUAGE', 'XEL', 'Rouage', 'NONE', 'NEUTRAL',
             2, 0, 1, 3, TRUE, FALSE,
             0, 1, 1, 'LINE', 'STEP'
         );

-- Ratio (aucun dégât direct au cast)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_ROUAGE', 185, 0);

-- Variante unique (pas de crit)
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_ROUAGE', 'NORMAL');

-- Effets au cast
-- Invocation du Rouage :
--   - max 1 par Xélor par défaut
--   - +1 si la passive XEL_REMANENCE est présente dans le build
--   - maxCharges = 10
--   - pose libre (pas restreint au cadran)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'SUMMON_MECHANISM', 'TARGET',
       '{
          "mechanism": "ROUAGE",
          "maxPerCaster": 1,
          "maxPerCasterPassiveBoost": { "passiveId": "XEL_REMANENCE", "bonus": 1 },
          "replaceExisting": true,
          "placeOnDialOnly": false,
          "maxCharges": 10
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_ROUAGE' AND v.kind='NORMAL';

-- Appliquer l'aura Rouage au Xélor (gère les ticks de dégâts)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'APPLY_STATUS', 'SELF',
       '{"status":"ROUAGE_AURA","duration": null}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_ROUAGE' AND v.kind='NORMAL';

-- ============================
--  SABLIER
-- ============================

-- Nettoyage
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_SABLIER');
DELETE FROM spell_variant      WHERE spell_id='XEL_SABLIER';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_SABLIER';
DELETE FROM spell              WHERE id='XEL_SABLIER';

DELETE FROM status_effect      WHERE status_id='SABLIER_MARK';
DELETE FROM status_def         WHERE id='SABLIER_MARK';

-- Définition du statut (marque Sablier)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('SABLIER_MARK','Sablier',1,'FIXED',1);

-- Ticks de dégâts (indirects) :
-- - début du tour de la cible
-- - heure qui fait un tour (HourWrap)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    ('SABLIER_MARK','ON_TARGET_TURN_START','DEAL_DAMAGE',
     '{"element":"WATER","indirect":true,"area":"CROSS1","amountFromStatus":true}');

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    ('SABLIER_MARK','ON_HOUR_WRAPPED','DEAL_DAMAGE',
     '{"element":"WATER","indirect":true,"area":"CROSS1","amountFromStatus":true}');

-- Définition du sort SABLIER
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_SABLIER', 'XEL', 'Sablier', 'WATER', 'ELEMENTAL',
             3, 0, 1, 2, TRUE, FALSE,
             0, 4, 1, 'NONE', 'STEP'
         );

-- Ratio niveau 185 (aucun crit car dégâts indirects)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_SABLIER', 185, 93);

-- NORMAL
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_SABLIER','NORMAL');

-- CRIT
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_SABLIER','CRIT');

-- Effet au cast : applique la marque avec amount=92 (pas de dégâts immédiats)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{"status":"SABLIER_MARK","amount":93,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_SABLIER' AND v.kind='NORMAL';

-- Effet au cast : applique la marque avec amount=92 (pas de dégâts immédiats)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{"status":"SABLIER_MARK","amount":116,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_SABLIER' AND v.kind='CRIT';

-- ============================
-- SINISTRO
-- ============================

-- cleanup
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_SINISTRO');
DELETE FROM spell_variant      WHERE spell_id='XEL_SINISTRO';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_SINISTRO';
DELETE FROM spell              WHERE id='XEL_SINISTRO';

DELETE FROM status_effect      WHERE status_id IN ('SINISTRO_AURA');
DELETE FROM status_def         WHERE id IN ('SINISTRO_AURA');

-- Aura (posée sur le Xélor; pilote les ticks)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('SINISTRO_AURA', 'Aura du Sinistro', 1, 'INFINITE', NULL);

-- Fin de tour du Xélor : SOINS aux ALLIÉS ADJACENTS à chaque Sinistro du lanceur
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'SINISTRO_AURA',
        'ON_CASTER_TURN_END',
        'HEAL_AROUND_MECHANISM',
        '{
           "kind":"SINISTRO",
           "owner":"CASTER",
           "targets":"ALLIES_ADJACENT",
           "percentMissingPerCharge": 2
         }'
    );

-- Fin de tour du Xélor : PA aux ALLIÉS ADJACENTS (1 PA / 5 charges)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'SINISTRO_AURA',
        'ON_CASTER_TURN_END',
        'ADD_AP_AROUND_MECHANISM',
        '{
           "kind":"SINISTRO",
           "owner":"CASTER",
           "targets":"ALLIES_ADJACENT",
           "perCharges": 5,
           "amountPerStep": 1
         }'
    );

-- Tour de cadran : mêmes effets (soins + PA)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'SINISTRO_AURA',
        'ON_HOUR_WRAPPED',
        'HEAL_AROUND_MECHANISM',
        '{
           "kind":"SINISTRO",
           "owner":"CASTER",
           "targets":"ALLIES_ADJACENT",
           "percentMissingPerCharge": 2
         }'
    );

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'SINISTRO_AURA',
        'ON_HOUR_WRAPPED',
        'ADD_AP_AROUND_MECHANISM',
        '{
           "kind":"SINISTRO",
           "owner":"CASTER",
           "targets":"ALLIES_ADJACENT",
           "perCharges": 5,
           "amountPerStep": 1
         }'
    );

-- Sort
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_SINISTRO', 'XEL', 'Sinistro', 'NONE', 'NEUTRAL',
             2, 0, 2, 5, FALSE, TRUE,
             0, 1, 1, 'NONE', 'STEP'
         );

-- ratio (pas de dégâts directs)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_SINISTRO', 185, 0);

-- variante
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_SINISTRO', 'NORMAL');

-- Effets au cast
-- Invocation du Sinistro
--   - max 1 par Xélor PAR DÉFAUT
--   - le moteur peut lire "maxPerCasterPassiveBoost" pour porter à 2 si la passive est active
--   - maxCharges = 15
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'SUMMON_MECHANISM', 'TARGET',
       '{
          "mechanism": "SINISTRO",
          "maxPerCaster": 1,
          "maxPerCasterPassiveBoost": { "passiveId": "XEL_REMANENCE", "bonus": 1 },
          "replaceExisting": true,
          "placeOnDialOnly": false,
          "maxCharges": 15
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_SINISTRO' AND v.kind='NORMAL';

-- Appliquer l''aura Sinistro au Xélor (ticks = fin de tour + hour wrap)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'APPLY_STATUS', 'SELF',
       '{"status":"SINISTRO_AURA","duration": null}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_SINISTRO' AND v.kind='NORMAL';

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
             0, 0, 0, 1, FALSE, FALSE,
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

-- =========================================
-- PASSIFS XÉLOR
-- =========================================

-- nettoyage des passifs
DELETE FROM passive_effect WHERE passive_id IN ('XEL_CONNAISSANCE_PASSE', 'XEL_COURS_TEMPS', 'XEL_MAITRE_CADRAN', 'XEL_REMANENCE', 'XEL_MECANISME_SPECIALISE');
DELETE FROM passive WHERE id IN ('XEL_CONNAISSANCE_PASSE', 'XEL_COURS_TEMPS', 'XEL_MAITRE_CADRAN', 'XEL_REMANENCE', 'XEL_MECANISME_SPECIALISE');

INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_CONNAISSANCE_PASSE','XEL','Connaissance du passé',
     'À chaque tour de cadran : +2 PW. Gagnera +2 PA en début de tour. '
         'Le Cadran coûte +2 PW et son temps de relance augmente de 1.');

-- +2 PW à chaque tour de cadran
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_HOUR_WRAPPED',0,'ADD_PW','SELF','{"amount":2}');

-- +2 PA en début de tour
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_CASTER_TURN_START',0,'ADD_AP','SELF','{"amount":2}');

-- Cadran : +2 PW de coût
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_PASSIVE_EQUIPPED',1,'ADD_SPELL_EXTRA_COST','SELF',
     '{"spellId":"XEL_CADRAN","resource":"PW","extra":2}');

-- Cadran : +1 cd
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_PASSIVE_EQUIPPED',2,'ADD_SPELL_COOLDOWN_DELTA','SELF',
     '{"spellId":"XEL_CADRAN","delta":1}');


INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_COURS_TEMPS','XEL','Cours du temps',
     'À chaque transposition causée par le Xélor : +1 PA si Distorsion actif, sinon +1 PW. Distorsion a 3 tours de relance.');

INSERT INTO effect_condition_group (op) VALUES ('AND');
INSERT INTO effect_condition_group (op) VALUES ('AND');

INSERT INTO effect_condition (group_id, cond_type, params_json)
SELECT MAX(id)-1, 'STATUS_ACTIVE', '{"status":"DISTORTION_ACTIVE"}' FROM effect_condition_group;

INSERT INTO effect_condition (group_id, cond_type, params_json)
SELECT MAX(id),   'STATUS_INACTIVE', '{"status":"DISTORTION_ACTIVE"}' FROM effect_condition_group;

-- ========== Modèle 1 : ON_TRANSPOSE ==========
-- Si Distorsion ACTIVE -> +1 PA par transposition
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json, cond_group_id)
VALUES ('XEL_COURS_TEMPS','ON_TRANSPOSE',0,'ADD_AP','SELF','{"amount":1}',
        (SELECT MAX(id)-1 FROM effect_condition_group));

-- Sinon -> +1 PW par transposition
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json, cond_group_id)
VALUES ('XEL_COURS_TEMPS','ON_TRANSPOSE',1,'ADD_PW','SELF','{"amount":1}',
        (SELECT MAX(id) FROM effect_condition_group));

-- ========== Modèle 2 : ON_SWAP ==========
-- Si Distorsion ACTIVE -> +2 PA pour un échange
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json, cond_group_id)
VALUES ('XEL_COURS_TEMPS','ON_SWAP',0,'ADD_AP','SELF','{"amount":2}',
        (SELECT MAX(id)-1 FROM effect_condition_group));

-- Sinon -> +2 PW pour un échange
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json, cond_group_id)
VALUES ('XEL_COURS_TEMPS','ON_SWAP',1,'ADD_PW','SELF','{"amount":2}',
        (SELECT MAX(id) FROM effect_condition_group));

INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES ('XEL_COURS_TEMPS','ON_PASSIVE_EQUIPPED',10,'SET_SPELL_BASE_COOLDOWN','SELF',
        '{"spellId":"XEL_DISTO","cooldown":3}');

INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_MAITRE_CADRAN','XEL','Maître du Cadran',
     'Quand l''heure courante fait un tour complet du cadran, les effets délayés se résolvent immédiatement.');

INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_MAITRE_CADRAN','ON_HOUR_WRAPPED',0,'RESOLVE_DELAYED_EFFECTS','GLOBAL',
     '{"owner":"CASTER"}');

INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_REMANENCE','XEL','Rémanence',
     'Les invocations ne bloquent plus la ligne de vue. +1 Sinistro max et +1 Rouage max.');

-- LOS : les invocations du lanceur ne bloquent plus
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_REMANENCE','ALWAYS',0,'SUMMONS_IGNORE_LOS','SELF','{"value":true}');

-- +1 limite de SINISTRO
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_REMANENCE','ON_PASSIVE_EQUIPPED',1,'INCREASE_MECHANISM_LIMIT','SELF',
     '{"kind":"SINISTRO","delta":1}');

-- +1 limite de ROUAGE
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_REMANENCE','ON_PASSIVE_EQUIPPED',2,'INCREASE_MECHANISM_LIMIT','SELF',
     '{"kind":"ROUAGE","delta":1}');

INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_MECANISMES_SPECIALISES','XEL','Mécanisme spécialisé',
     'À l''invocation d''un Rouage, Sinistro, Cadran ou Régulateur : échange immédiatement de position avec (6 cases max).');

-- À l'invocation de l'un des mécanismes → swap immédiat si ≤ 6 cases
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_MECANISMES_SPECIALISES','ON_SUMMON_MECHANISM',0,'IMMEDIATE_SWAP_WITH_SUMMON','SELF',
     '{"kinds":["ROUAGE","SINISTRO","DIAL","REGULATOR"],"maxRange":6}');

-- ============================
--  SYMÉTRIE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_SYMETRIE');
DELETE FROM spell_variant      WHERE spell_id='XEL_SYMETRIE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_SYMETRIE';
DELETE FROM spell              WHERE id='XEL_SYMETRIE';

INSERT INTO spell VALUES (
                             'XEL_SYMETRIE','XEL','Symétrie','AIR','ELEMENTAL',
                             3,0,1,3,FALSE,TRUE,
                             0,3,1,'NONE','STEP'
                         );

INSERT INTO spell_ratio_breakpoint VALUES
    ('XEL_SYMETRIE',185,58);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_SYMETRIE','NORMAL'),
       ('XEL_SYMETRIE','CRIT');

-- Effets NORMAL
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'TELEPORT_SYMMETRIC', 'TARGET',
       '{"mode":"SINGLE_TARGET","reverseOnOddHour":true}'
FROM spell_variant v WHERE v.spell_id='XEL_SYMETRIE' AND v.kind='NORMAL';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'DEAL_DAMAGE', 'TARGET', '{"amount":58,"element":"AIR"}'
FROM spell_variant v WHERE v.spell_id='XEL_SYMETRIE' AND v.kind='NORMAL';

-- Effets CRIT
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'TELEPORT_SYMMETRIC', 'TARGET',
       '{"mode":"SINGLE_TARGET","reverseOnOddHour":true}'
FROM spell_variant v WHERE v.spell_id='XEL_SYMETRIE' AND v.kind='CRIT';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'DEAL_DAMAGE', 'TARGET', '{"amount":72,"element":"AIR"}'
FROM spell_variant v WHERE v.spell_id='XEL_SYMETRIE' AND v.kind='CRIT';