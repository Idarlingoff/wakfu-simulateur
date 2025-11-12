CREATE TABLE class_ref (
                           id          VARCHAR(32) PRIMARY KEY,
                           name        VARCHAR(64) NOT NULL
);

-- Sorts
CREATE TABLE spell (
                       id               VARCHAR(64) PRIMARY KEY,
                       class_id         VARCHAR(32) NOT NULL,
                       name             VARCHAR(128) NOT NULL,
                       element          VARCHAR(16),                     -- NULL pour neutre
                       spell_type       VARCHAR(16) NOT NULL,            -- ELEMENTAL|NEUTRAL|INNATE
                       pa_cost          INT NOT NULL,
                       pw_cost          INT NOT NULL DEFAULT 0,
                       po_min           INT NOT NULL DEFAULT 1,
                       po_max           INT NOT NULL,
                       po_modifiable    BOOLEAN NOT NULL DEFAULT TRUE,
                       line_of_sight    BOOLEAN NOT NULL DEFAULT TRUE,
                       cooldown         INT NOT NULL DEFAULT 0,
                       use_per_turn     INT NOT NULL DEFAULT 99,
                       use_per_target   INT NOT NULL DEFAULT 99,
                       direction        VARCHAR(16) NOT NULL,            -- LINE|CROSS|NONE…
                       ratio_eval_mode  VARCHAR(16) NOT NULL DEFAULT 'STEP', -- STEP|LINEAR
                       CONSTRAINT ck_spell_type CHECK (spell_type IN ('ELEMENTAL','NEUTRAL','INNATE'))
);

CREATE TABLE spell_ratio_breakpoint (
                                        spell_id VARCHAR(64) NOT NULL,
                                        lvl      INT NOT NULL,
                                        ratio    INT NOT NULL,
                                        PRIMARY KEY (spell_id, lvl),
                                        FOREIGN KEY (spell_id) REFERENCES spell(id)
);

-- Variante NORMAL / CRIT (sépare les listes d’effets)
CREATE TABLE spell_variant (
                               id        IDENTITY PRIMARY KEY,
                               spell_id  VARCHAR(64) NOT NULL,
                               kind      VARCHAR(16) NOT NULL,     -- NORMAL|CRIT
                               FOREIGN KEY (spell_id) REFERENCES spell(id),
                               CONSTRAINT ck_variant_kind CHECK (kind IN ('NORMAL','CRIT'))
);

-- Groupe de conditions (pour combiner AND/OR plusieurs conditions)
CREATE TABLE effect_condition_group (
                                        id          IDENTITY PRIMARY KEY,
                                        op          VARCHAR(8) NOT NULL DEFAULT 'AND' -- AND|OR
);

CREATE TABLE effect_condition (
                                  id          IDENTITY PRIMARY KEY,
                                  group_id    BIGINT NOT NULL,
                                  cond_type   VARCHAR(64) NOT NULL,  -- e.g. ON_DIAL_CELL, EXCHANGE_OCCURRED, ONCE_PER_TURN('desync_on_dial')
                                  params_json CLOB,                  -- JSON paramétré (clé/valeur)
                                  FOREIGN KEY (group_id) REFERENCES effect_condition_group(id)
);

-- Effets atomiques (damage, tp, rewind, refund, applyStatus…)
CREATE TABLE spell_effect (
                              id             IDENTITY PRIMARY KEY,
                              variant_id     BIGINT NOT NULL,          -- FK vers NORMAL/CRIT
                              phase          VARCHAR(24) NOT NULL,     -- ON_CAST|ON_HIT|ON_END_TURN|ON_TARGET_TURN_START|IMMEDIATE
                              order_index    INT NOT NULL DEFAULT 0,   -- ordre d’application
                              effect_type    VARCHAR(64) NOT NULL,     -- DEAL_DAMAGE|TELEPORT|REWIND_LAST_MOVE|REFUND_AP|APPLY_STATUS|ADVANCE_DIAL|ADD_AP|SUB_AP …
                              target_scope   VARCHAR(32) NOT NULL,     -- SELF|TARGET|AREA|LAST_MOVED|LAST_SWAPPED …
                              params_json    CLOB,                     -- payload (ex: {"element":"AIR","amount":60})
                              cond_group_id  BIGINT,                   -- optionnel : conditions à respecter pour cet effet
                              FOREIGN KEY (variant_id) REFERENCES spell_variant(id),
                              FOREIGN KEY (cond_group_id) REFERENCES effect_condition_group(id)
);

-- États persistants (Sablier/Horloge/Contre la montre)
CREATE TABLE status_def (
                            id            VARCHAR(64) PRIMARY KEY,   -- e.g. "SABLIER", "HORLOGE_MARK", "CONTRE_LA_MONTRE"
                            name          VARCHAR(128),
                            max_stacks    INT NOT NULL DEFAULT 1,
                            duration_type VARCHAR(16) NOT NULL,      -- FIXED|INFINITE
                            base_duration INT                         -- nombre de tours si FIXED
);

CREATE TABLE status_effect (
                               id             IDENTITY PRIMARY KEY,
                               status_id      VARCHAR(64) NOT NULL,
                               tick_phase     VARCHAR(24) NOT NULL,     -- ON_APPL, ON_CASTER_TURN_END, ON_TARGET_TURN_START, ON_TARGET_TURN_END …
                               effect_type    VARCHAR(64) NOT NULL,     -- DEAL_DAMAGE|TELEPORT_TO_SAVED_POS|DOUBLE_NEXT_HORLOGE|…
                               params_json    CLOB,
                               FOREIGN KEY (status_id) REFERENCES status_def(id)
);




