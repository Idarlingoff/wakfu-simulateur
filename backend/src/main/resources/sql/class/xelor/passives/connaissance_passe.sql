-- =========================================
-- CONNAISSANCE DU PASSÉ
-- =========================================

-- nettoyage si déjà présent
DELETE FROM passive_effect WHERE passive_id = 'XEL_CONNAISSANCE_PASSE';
DELETE FROM passive WHERE id = 'XEL_CONNAISSANCE_PASSE';

-- REFONTE: l'ancienne régén (+2 PA/+2 PW au tour de cadran) est désormais le comportement
-- PAR DÉFAUT du Cadran (code: XelorPassivesService.applyDialDefaultRegeneration).
-- Le passif ne conserve que le surcoût +2 PW du Cadran. Le +50% PV du Cadran n'est pas simulé
-- (les mécanismes n'ont pas de PV). Le +1 de relance du Cadran migre vers le passif Horlogerie.
INSERT INTO passive (id, class_id, name, description, icon_id) VALUES
    ('XEL_CONNAISSANCE_PASSE','XEL','Connaissance du passé',
     'Le Cadran possède 50% de PV supplémentaires (non simulé) et coûte +2 PW.', 7186);

-- Cadran : +2 PW de coût (implémenté en code via getSpellExtraCost)
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_PASSIVE_EQUIPPED',1,'ADD_SPELL_EXTRA_COST','SELF',
     '{"spellId":"XEL_CADRAN","resource":"PW","extra":2}');
