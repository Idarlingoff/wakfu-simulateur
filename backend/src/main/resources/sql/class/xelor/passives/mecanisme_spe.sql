-- =========================================
-- MÉCANISME SPÉCIALISÉ
-- =========================================

-- nettoyage si déjà présent
DELETE FROM passive_effect WHERE passive_id = 'XEL_MECANISMES_SPECIALISES';
DELETE FROM passive WHERE id = 'XEL_MECANISMES_SPECIALISES';

INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_MECANISMES_SPECIALISES','XEL','Mécanisme spécialisé',
     'À l''invocation d''un Rouage, Sinistro, Cadran ou Régulateur : échange immédiatement de position avec (6 cases max).');

-- À l'invocation de l'un des mécanismes → swap immédiat si ≤ 6 cases
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_MECANISMES_SPECIALISES','ON_SUMMON_MECHANISM',0,'IMMEDIATE_SWAP_WITH_SUMMON','SELF',
     '{"kinds":["ROUAGE","SINISTRO","DIAL","REGULATOR"],"maxRange":6}');
