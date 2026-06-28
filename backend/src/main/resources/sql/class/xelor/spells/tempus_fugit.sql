-- ============================
--  TEMPUS FUGIT  (nouveau sort - refonte Xélor)
-- ============================
-- 3 PA, PO 1-6 (modifiable), monocible, dégâts Air.
-- Téléporte la cible sur l'heure courante du cadran (max 6 cases).
-- Si lancé sur le cadran (ON_DIAL_CELL) : +2 PA au Xélor + déplace le cadran sur l'heure courante.
-- NOTE icon_id = 767 = PLACEHOLDER (réutilise l'icône de Pointe-heure) -> à remplacer par le gameId réel.
-- NOTE "lançable sur soi" non représenté (le modèle n'a pas de flag self-cast ; po_min=1 ici).

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_TEMPUS_FUGIT');
DELETE FROM spell_variant      WHERE spell_id='XEL_TEMPUS_FUGIT';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_TEMPUS_FUGIT';
DELETE FROM spell              WHERE id='XEL_TEMPUS_FUGIT';

INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode, icon_id, is_aoe
) VALUES (
             'XEL_TEMPUS_FUGIT', 'XEL', 'Tempus Fugit', 'AIR', 'ELEMENTAL',
             3, 0, 1, 6, TRUE, TRUE,
             0, 3, 2, 'AREA', 'STEP', 765, FALSE
         );

-- Ratio = base de calcul des dégâts (63 air). CRIT = NORMAL x1.25 (convention du projet).
INSERT INTO spell_ratio_breakpoint (spell_id, kind, lvl, ratio)
VALUES ('XEL_TEMPUS_FUGIT', 'NORMAL', 200, 63),
       ('XEL_TEMPUS_FUGIT', 'CRIT',   200, 79);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_TEMPUS_FUGIT', 'NORMAL');

-- (0) Dégâts Air sur la cible
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET', '{"amount":63,"element":"AIR"}', NULL
FROM spell_variant v WHERE v.spell_id='XEL_TEMPUS_FUGIT' AND v.kind='NORMAL';

-- (1) Téléporte la cible sur l'heure courante (max 6 cases)
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'TELEPORT_TO_CURRENT_HOUR', 'TARGET', '{"maxCells":6}', NULL
FROM spell_variant v WHERE v.spell_id='XEL_TEMPUS_FUGIT' AND v.kind='NORMAL';

-- Effets conditionnels : lancé sur le cadran (ON_DIAL_CELL)
INSERT INTO effect_condition_group (op) VALUES ('AND');
INSERT INTO effect_condition (group_id, cond_type, params_json)
VALUES ((SELECT MAX(id) FROM effect_condition_group), 'ON_DIAL_CELL', '{}');

-- (2) +2 PA au Xélor
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 2, 'ADD_AP', 'SELF', '{"amount":2}', (SELECT MAX(id) FROM effect_condition_group)
FROM spell_variant v WHERE v.spell_id='XEL_TEMPUS_FUGIT' AND v.kind='NORMAL';

-- (3) Déplace le cadran sur l'heure courante
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 3, 'MOVE_DIAL_TO_CURRENT_HOUR', 'SELF', '{}', (SELECT MAX(id) FROM effect_condition_group)
FROM spell_variant v WHERE v.spell_id='XEL_TEMPUS_FUGIT' AND v.kind='NORMAL';
