INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_MAITRE_CADRAN','XEL','Maître du Cadran',
     'Quand l''heure courante fait un tour complet du cadran, les effets délayés se résolvent immédiatement.');

INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_MAITRE_CADRAN','ON_HOUR_WRAPPED',0,'RESOLVE_DELAYED_EFFECTS','GLOBAL',
     '{"owner":"CASTER"}');
