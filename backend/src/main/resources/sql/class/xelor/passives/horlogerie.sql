-- =========================================
-- HORLOGERIE  (nouveau passif - refonte Xélor)
-- =========================================
-- Début de tour : téléporte le Xélor sur l'heure courante du cadran (implémenté en code:
--   XelorPassivesService.applyHorlogerie, déclenché par onTurnStart).
-- Réduit/augmente la relance du Cadran : NON simulé (le moteur n'applique aucun cooldown de sort).
-- NOTE icon_id = 7186 = PLACEHOLDER -> remplacer par le gameId réel.

DELETE FROM passive_effect WHERE passive_id = 'XEL_HORLOGERIE';
DELETE FROM passive WHERE id = 'XEL_HORLOGERIE';

INSERT INTO passive (id, class_id, name, description, icon_id) VALUES
    ('XEL_HORLOGERIE','XEL','Horlogerie',
     'En début de tour, téléporte le Xélor sur l''heure courante. '
         'Le Cadran peut être posé un tour sur deux (cooldown non simulé).', 761);

-- Début de tour : TP sur l'heure courante (logique en code)
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_HORLOGERIE','ON_CASTER_TURN_START',0,'TELEPORT_TO_CURRENT_HOUR','SELF','{}');

-- Cadran : +1 temps de relance (NON simulé - pas de cooldown dans le moteur)
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_HORLOGERIE','ON_PASSIVE_EQUIPPED',1,'ADD_SPELL_COOLDOWN_DELTA','SELF',
     '{"spellId":"XEL_CADRAN","delta":1}');
