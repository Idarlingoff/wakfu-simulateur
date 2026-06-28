-- ============================
--  PRÉMONITION  (nouveau sort - refonte Xélor)
-- ============================
-- 3 PA, PO 1-6 (modifiable), monocible.
-- PÉRIMÈTRE SIMULÉ (positionnel uniquement) : si lancé sur une CASE VIDE, le Xélor est téléporté
-- sur cette case au DÉBUT DE SON PROCHAIN TOUR.
-- Le volet PV (sauvegarde/restauration des PV, retrait à 50%) n'est PAS simulé (pas de PV dans le moteur).
-- NOTE icon_id = 767 = PLACEHOLDER -> remplacer par le gameId réel.
-- NOTE "lançable sur soi" non représenté (pas de flag self-cast ; po_min=1).

DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_PREMONITION');
DELETE FROM spell_variant      WHERE spell_id='XEL_PREMONITION';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_PREMONITION';
DELETE FROM spell              WHERE id='XEL_PREMONITION';

INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode, icon_id, is_aoe
) VALUES (
             'XEL_PREMONITION', 'XEL', 'Prémonition', 'NONE', 'NEUTRAL',
             3, 0, 1, 7, TRUE, TRUE,
             2, 1, 1, 'AREA', 'STEP', 757, FALSE
         );

INSERT INTO spell_ratio_breakpoint (spell_id, kind, lvl, ratio)
VALUES ('XEL_PREMONITION', 'NORMAL', 200, 0);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_PREMONITION', 'NORMAL');

-- Sur case vide : enregistre un TP différé du Xélor (résolu au début du tour suivant, en code).
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'REGISTER_SELF_TP_IF_EMPTY', 'SELF', '{}', NULL
FROM spell_variant v WHERE v.spell_id='XEL_PREMONITION' AND v.kind='NORMAL';
