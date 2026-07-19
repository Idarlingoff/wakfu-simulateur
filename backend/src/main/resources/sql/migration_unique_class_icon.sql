-- ============================
-- Migration : unicite de icon_id par classe (sorts et passifs)
-- ============================
--
-- Le projet n'a pas de runner de migration (ni Flyway ni Liquibase) : les scripts
-- de creation sont appliques a la main sur la base H2. Ce script est donc a passer
-- manuellement sur une base existante ; une base recreee depuis
-- creation_tables_spells.sql / creation_tables_passifs.sql a deja les contraintes.
--
-- Pourquoi : l'import/export de code deck indexe sorts et passifs par icon_id, une
-- classe a la fois (frontend/src/app/services/deck-code.service.ts, indexByIcon).
-- Un icon_id duplique au sein d'une classe ferait degenerer le decodage en une
-- selection arbitraire (dernier ecrit gagne dans la Map), sans aucun diagnostic.
--
-- Portee : (class_id, icon_id) et non icon_id seul, parce que l'index est construit
-- par classe. Deux classes distinctes peuvent donc partager un icon_id sans risque.
-- Les lignes dont icon_id est NULL restent autorisees et multiples (H2 traite les
-- NULL comme distincts dans un index unique).
--
-- Verification prealable en cas de doute sur les donnees existantes :
--   SELECT class_id, icon_id, COUNT(*) FROM spell
--    WHERE icon_id IS NOT NULL GROUP BY class_id, icon_id HAVING COUNT(*) > 1;
--   SELECT class_id, icon_id, COUNT(*) FROM passive
--    WHERE icon_id IS NOT NULL GROUP BY class_id, icon_id HAVING COUNT(*) > 1;

ALTER TABLE spell
    ADD CONSTRAINT IF NOT EXISTS uq_spell_class_icon UNIQUE (class_id, icon_id);

ALTER TABLE passive
    ADD CONSTRAINT IF NOT EXISTS uq_passive_class_icon UNIQUE (class_id, icon_id);
