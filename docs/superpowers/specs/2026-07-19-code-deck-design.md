# Code deck — import / export dans l'éditeur de build

**Date :** 2026-07-19
**Statut :** validé, prêt pour plan d'implémentation
**Périmètre :** frontend uniquement (Angular)

---

## Problème

Créer un build impose de re-sélectionner tous les sorts et passifs à la main, un par un,
même quand le deck existe déjà en jeu. Le jeu expose un « code deck » textuel qui encode
l'intégralité de la barre de sorts et des passifs. Le supporter en import et en export
supprime cette ressaisie et permet les allers-retours avec le jeu et les builders tiers.

## Objectif

Dans l'éditeur de build :

- **Coller** un code deck pour remplir les 12 slots de sorts et les 6 slots de passifs.
- **Copier** le code deck correspondant à la sélection en cours, pour l'exporter.

## Hors périmètre

- Export depuis la liste des builds (décidé : éditeur uniquement).
- Encodage des stats, sublimations, niveau ou nom du build : le code deck ne porte que
  sorts et passifs.
- Seeding de nouvelles classes. Seul le Xélor a des données aujourd'hui (18 sorts,
  7 passifs) ; la fonctionnalité doit se comporter proprement pour les autres classes,
  pas les faire fonctionner.

---

## Format du code deck

18 segments entiers séparés par `-` :

| Positions | Contenu                                  |
| --------- | ---------------------------------------- |
| 0-5       | Sorts, raccourcis `1` à `6`              |
| 6-11      | Sorts, raccourcis `alt+1` à `alt+6`      |
| 12-17     | Passifs                                  |

`0` signifie « slot vide ». Chaque valeur non nulle est l'**ID de jeu** de l'entité, qui
correspond exactement au champ `iconId` des données locales et au nom du fichier dans
`frontend/src/assets/images/spells/<iconId>.png`.

Exemple de référence :

```
2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0
```

Vérifié contre les données actuelles : les 12 sorts et 5 des 6 passifs se résolvent, le
dernier segment est un slot de passif vide.

**Sorts innés.** Dial (`5345`), Distorsion (`7794`) et Vol du Temps (`3909`) sont absents
de l'exemple : le jeu ne place pas les sorts innés dans le deck. L'export ne doit jamais
les émettre, ce qui est cohérent avec `removeInnateSpellsFromSelection`, qui les exclut
déjà de la sélection persistée.

**Risque connu.** Le format n'a été validé que contre un seul code d'exemple. Si les codes
du jeu peuvent avoir une autre longueur ou porter un préfixe de version, le parsing strict
à 18 segments les rejettera. À réévaluer si un contre-exemple apparaît.

---

## Architecture

Trois couches, chacune testable indépendamment.

### 1. `frontend/src/app/utils/deck-code.utils.ts` — encodage pur

Aucune dépendance Angular, aucune dépendance aux données. Manipule uniquement des
`iconId` bruts.

```ts
export const DECK_SPELL_SLOTS = 12;
export const DECK_PASSIVE_SLOTS = 6;

/** Slots bruts d'un code deck : iconId de jeu, ou null si le slot est vide. */
export interface DeckCodeSlots {
  spells: (number | null)[];   // longueur DECK_SPELL_SLOTS
  passives: (number | null)[]; // longueur DECK_PASSIVE_SLOTS
}

export class DeckCodeFormatError extends Error {}

export function parseDeckCode(raw: string): DeckCodeSlots;
export function formatDeckCode(slots: DeckCodeSlots): string;
```

`parseDeckCode` tolère : espaces en tête et en fin, espaces autour des tirets, tirets
consécutifs compressés en un seul séparateur.

`parseDeckCode` lève `DeckCodeFormatError` si : le nombre de segments est différent de 18,
un segment n'est pas un entier décimal, ou un entier est négatif.

`formatDeckCode` produit toujours 18 segments et écrit `0` pour chaque slot vide, y
compris les slots vides en fin de code.

### 2. `frontend/src/app/services/deck-code.service.ts` — résolution

Traduit entre `iconId` et entités du domaine, via `DataCacheService`.

```ts
export interface DeckCodeImportResult {
  spells: (SpellReference | null)[];     // longueur DECK_SPELL_SLOTS
  passives: (PassiveReference | null)[]; // longueur DECK_PASSIVE_SLOTS
  unresolvedSpellIcons: number[];
  unresolvedPassiveIcons: number[];
  duplicateIcons: number[];
}

decode(code: string, classId: string): Promise<DeckCodeImportResult>;
encode(
  spells: (SpellReference | null)[],
  passives: (PassiveReference | null)[],
  classId: string,
): Promise<string>;
```

L'index `iconId → entité` est construit à la demande depuis `getSpells(classId)` et
`getPassives(classId)`, tous deux asynchrones et déjà filtrés par classe. Les `iconId`
sont uniques dans chaque table — vérifié, aucune collision côté sorts ni côté passifs.

Règles de résolution :

- **ID introuvable** dans la table interrogée → slot laissé vide, `iconId` ajouté à la
  liste des non résolus correspondante.
- **Doublon** : un `iconId` déjà placé dans un slot précédent laisse le slot suivant vide
  et est ajouté à `duplicateIcons`. Le sélecteur de sorts existant interdit déjà les
  doublons ; on reste cohérent avec lui.
- **Pas de repli croisé** : un ID de passif dans une position de sort est cherché
  uniquement dans la table des sorts, ne s'y trouve pas, et compte donc comme non résolu.
- `decode` propage `DeckCodeFormatError` telle quelle ; le composant la traduit en message
  utilisateur.

`encode` mappe chaque `SpellReference.spellId` / `PassiveReference.passiveId` vers son
`iconId`. Une référence non résolvable devient `0` — le code reste ainsi bien formé.

### 3. Carte « Code deck » dans `build-editor.component.ts`

Nouvelle `section.card` insérée entre **Identité** et **Sorts**.

Contenu :

- Un `input` texte pour le code, plus un bouton **Importer**.
- Un bouton **Copier le code deck**.
- Une zone de rapport sous les contrôles.

Comportements :

- **Classe requise.** L'`input` et le bouton Importer sont désactivés tant que
  `form.classId` est vide, avec le message *« Sélectionne d'abord une classe »*. Décidé
  ainsi plutôt que de déduire la classe depuis les IDs : le code deck ne porte pas la
  classe, et la déduction serait fragile tant qu'une seule classe est seedée.
- **Import = remplacement total.** `form.spells` et `form.passives` sont intégralement
  remplacés, puis les handlers existants `onSpellsChange` / `onPassivesChange` sont
  appelés pour resynchroniser les sélecteurs. Sémantique identique au jeu, et prévisible.
- **Copie.** `navigator.clipboard.writeText()`, avec un retour visuel « Copié ✓ » pendant
  environ 2 secondes. Si l'API clipboard est indisponible (contexte non sécurisé), le code
  est affiché dans un champ en lecture seule, sélectionné, pour une copie manuelle.
  Le code est généré depuis la sélection en cours d'édition, même non enregistrée.
- **Rapport d'import**, sous les contrôles. Les compteurs ont pour dénominateur le nombre
  de slots **non vides** du code, pas 12 et 6 : un `0` est un slot volontairement vide, pas
  un échec. Le code de référence donne donc *« 12/12 sorts et 5/5 passifs »*, en vert.
  - Succès complet, en vert : *« 12/12 sorts et 5/5 passifs importés »*.
  - Succès partiel, en orange : même compteur, suivi des IDs ignorés et de leur motif
    (inconnu ou doublon).
  - Échec, en rouge : format invalide, ou aucun ID reconnu.

---

## Flux de données

**Import.** Code collé → `parseDeckCode` → `DeckCodeSlots` → `DeckCodeService.decode`
résout via `DataCacheService` → `DeckCodeImportResult` → le composant écrase `form.spells`
et `form.passives`, puis affiche le rapport.

**Export.** `form.spells` / `form.passives` → `DeckCodeService.encode` mappe vers les
`iconId` → `formatDeckCode` → chaîne de 18 segments → presse-papier.

---

## Gestion des erreurs

| Cas                                    | Comportement                                                |
| -------------------------------------- | ----------------------------------------------------------- |
| Champ vide, Importer cliqué            | Rapport rouge, aucun changement d'état                       |
| Format invalide                        | Rapport rouge citant l'attendu, aucun changement d'état      |
| Aucune classe sélectionnée             | Contrôles désactivés, import impossible                      |
| Classe sans données seedées            | Rapport rouge : aucun ID reconnu, aucun changement d'état    |
| Certains IDs non résolus               | Rapport orange, import partiel appliqué                      |
| `DataCacheService` échoue              | Rapport rouge, aucun changement d'état                       |
| API clipboard indisponible             | Repli sur champ lecture seule sélectionné                    |

Un import qui ne résout **aucun** ID ne modifie pas la sélection : effacer la barre
entière sur un code invalide serait destructeur et non désiré.

---

## Tests

**`deck-code.utils.spec.ts`**

- Aller-retour `parseDeckCode` → `formatDeckCode` sur le code de référence.
- Slots vides en tête, au milieu, en fin.
- Tolérance : espaces autour des tirets, espaces en tête et en fin.
- Rejets : 17 segments, 19 segments, segment non numérique, entier négatif, chaîne vide.

**`deck-code.service.spec.ts`**

- Résolution complète du code de référence avec les données Xélor.
- IDs inconnus → slots vides, remontés dans les listes de non résolus.
- Doublons → première occurrence conservée, suivantes vides et signalées.
- Classe sans données → tout non résolu.
- `encode` : sélection complète, sélection partielle avec `0`, exclusion des sorts innés.

**`build-editor.component.spec.ts`**

- L'import remplace intégralement la sélection existante.
- Les contrôles d'import sont désactivés tant qu'aucune classe n'est choisie.
- Un code invalide laisse la sélection intacte.

Note : `ng test` nécessite `CHROME_BIN` pointant vers le `chrome-headless-shell` de
puppeteer.

---

## Fichiers touchés

| Fichier                                              | Nature    |
| ---------------------------------------------------- | --------- |
| `frontend/src/app/utils/deck-code.utils.ts`           | créé      |
| `frontend/src/app/utils/deck-code.utils.spec.ts`      | créé      |
| `frontend/src/app/services/deck-code.service.ts`      | créé      |
| `frontend/src/app/services/deck-code.service.spec.ts` | créé      |
| `frontend/src/app/pages/build-editor.component.ts`    | modifié   |
| `frontend/src/app/pages/build-editor.component.spec.ts` | modifié |
