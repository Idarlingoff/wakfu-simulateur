-- =========================================
-- PERMUTATION MOMENTANÉE  (nouveau passif - refonte Xélor)
-- =========================================
-- Fin de tour : le Xélor échange sa position avec le Cadran (implémenté en code:
--   XelorPassivesService.applyPermutationMomentanee, déclenché par cleanupTurn).
--   -> génère 2 charges (Rouage/Sinistro) puis les ticks de mécanismes ; déclenche Cours du temps.
-- Le Cadran gagne 100 de résistance élémentaire : NON simulé (les mécanismes n'ont ni PV ni résistances).
-- NOTE icon_id = 7186 = PLACEHOLDER -> remplacer par le gameId réel.

DELETE FROM passive_effect WHERE passive_id = 'XEL_PERMUTATION_MOMENTANEE';
DELETE FROM passive WHERE id = 'XEL_PERMUTATION_MOMENTANEE';

INSERT INTO passive (id, class_id, name, description, icon_id) VALUES
    ('XEL_PERMUTATION_MOMENTANEE','XEL','Permutation momentanée',
     'En fin de tour, échange de position avec le Cadran (génère 2 charges, déclenche Cours du temps). '
         'Le Cadran gagne 100 de résistance élémentaire (non simulé).', 7192);

-- Fin de tour : échange avec le Cadran (logique en code)
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_PERMUTATION_MOMENTANEE','ON_CASTER_TURN_END',0,'SWAP_WITH_MECHANISM','SELF','{"mechanism":"DIAL"}');

-- Cadran : +100 résistance élémentaire (NON simulé - pas de stats sur les mécanismes)
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_PERMUTATION_MOMENTANEE','ON_PASSIVE_EQUIPPED',1,'MODIFY_MECHANISM_STAT','MECHANISM',
     '{"mechanism":"DIAL","stat":"elementalResistance","flat":100}');
