# 🧪 Exemple de timeline pour tester les mécanismes

## Timeline de test : Pose de mécanismes Xélor

Cette timeline permet de tester la création automatique de tous les types de mécanismes.

### Configuration

**Build requis :**
- Classe : Xélor (XEL)
- Sorts dans la barre :
  - Rouage
  - Cadran (si disponible)
  - Sinistro (si disponible)
  - Régulateur (si disponible)

**Entités sur le plateau :**
- Joueur Xélor à la position (6, 6)
- Ennemi à la position (6, 10)

### Étapes de la timeline

#### Étape 1 : Poser un Rouage
```json
{
  "id": "step_1",
  "actions": [{
    "id": "action_1",
    "type": "CastSpell",
    "order": 1,
    "spellId": "rouage",
    "targetPosition": { "x": 7, "y": 10 },
    "targetFacing": { "direction": "front" }
  }],
  "description": "Pose un Rouage en (7,10)"
}
```

**Résultat attendu :**
- ✅ Un rouage apparaît à la position (7, 10)
- ✅ Image : `/resources/rouage.png` (gris, pas de charges)
- ✅ Aura jaune doré

#### Étape 2 : Poser un Cadran
```json
{
  "id": "step_2",
  "actions": [{
    "id": "action_2",
    "type": "CastSpell",
    "order": 2,
    "spellId": "cadran",
    "targetPosition": { "x": 5, "y": 10 },
    "targetFacing": { "direction": "front" }
  }],
  "description": "Pose un Cadran en (5,10)"
}
```

**Résultat attendu :**
- ✅ Un cadran apparaît à la position (5, 10)
- ✅ Image : `/resources/dial/dial-center.png`
- ✅ Aura violette

#### Étape 3 : Poser un Sinistro
```json
{
  "id": "step_3",
  "actions": [{
    "id": "action_3",
    "type": "CastSpell",
    "order": 3,
    "spellId": "sinistro",
    "targetPosition": { "x": 8, "y": 10 },
    "targetFacing": { "direction": "front" }
  }],
  "description": "Pose un Sinistro en (8,10)"
}
```

**Résultat attendu :**
- ✅ Un sinistro apparaît à la position (8, 10)
- ✅ Image : `/resources/sinistro.png`
- ✅ Aura rouge

#### Étape 4 : Poser un Régulateur
```json
{
  "id": "step_4",
  "actions": [{
    "id": "action_4",
    "type": "CastSpell",
    "order": 4,
    "spellId": "regulateur",
    "targetPosition": { "x": 6, "y": 11 },
    "targetFacing": { "direction": "front" }
  }],
  "description": "Pose un Régulateur en (6,11)"
}
```

**Résultat attendu :**
- ✅ Un régulateur apparaît à la position (6, 11)
- ✅ Image : `/resources/regulateur.png`
- ✅ Aura cyan

### Timeline complète (JSON)

```json
{
  "id": "timeline_test_mechanisms",
  "name": "Test - Mécanismes Xélor",
  "buildId": "build_xelor_test",
  "steps": [
    {
      "id": "step_1",
      "actions": [{
        "id": "action_1",
        "type": "CastSpell",
        "order": 1,
        "spellId": "rouage",
        "targetPosition": { "x": 7, "y": 10 },
        "targetFacing": { "direction": "front" }
      }],
      "description": "Pose un Rouage en (7,10)"
    },
    {
      "id": "step_2",
      "actions": [{
        "id": "action_2",
        "type": "CastSpell",
        "order": 2,
        "spellId": "cadran",
        "targetPosition": { "x": 5, "y": 10 },
        "targetFacing": { "direction": "front" }
      }],
      "description": "Pose un Cadran en (5,10)"
    },
    {
      "id": "step_3",
      "actions": [{
        "id": "action_3",
        "type": "CastSpell",
        "order": 3,
        "spellId": "sinistro",
        "targetPosition": { "x": 8, "y": 10 },
        "targetFacing": { "direction": "front" }
      }],
      "description": "Pose un Sinistro en (8,10)"
    },
    {
      "id": "step_4",
      "actions": [{
        "id": "action_4",
        "type": "CastSpell",
        "order": 4,
        "spellId": "regulateur",
        "targetPosition": { "x": 6, "y": 11 },
        "targetFacing": { "direction": "front" }
      }],
      "description": "Pose un Régulateur en (6,11)"
    }
  ],
  "createdAt": "2025-12-04T00:00:00.000Z",
  "updatedAt": "2025-12-04T00:00:00.000Z"
}
```

## Procédure de test manuelle

### Via l'interface utilisateur

1. **Créer un build Xélor**
   - Aller dans "📦 Builds"
   - Créer un nouveau build
   - Nom : "Test Mécanismes"
   - Classe : Xélor
   - Ajouter les sorts : Rouage, Cadran, Sinistro, Régulateur

2. **Créer la timeline**
   - Aller dans "📋 Timelines"
   - Créer une nouvelle timeline
   - Nom : "Test - Mécanismes Xélor"
   - Build : Sélectionner "Test Mécanismes"
   
3. **Ajouter les étapes**
   - Étape 1 :
     - Type : Lancer sort
     - Sort : Rouage
     - Position X : 7
     - Position Y : 10
     - Description : "Pose un Rouage"
   
   - Étape 2 :
     - Type : Lancer sort
     - Sort : Cadran
     - Position X : 5
     - Position Y : 10
     - Description : "Pose un Cadran"
   
   - Étape 3 :
     - Type : Lancer sort
     - Sort : Sinistro
     - Position X : 8
     - Position Y : 10
     - Description : "Pose un Sinistro"
   
   - Étape 4 :
     - Type : Lancer sort
     - Sort : Régulateur
     - Position X : 6
     - Position Y : 11
     - Description : "Pose un Régulateur"

4. **Tester sur le plateau**
   - Aller sur "🗺️ Carte de Combat"
   - Sélectionner la timeline "Test - Mécanismes Xélor"
   - Naviguer avec les boutons ◀ et ▶
   - Observer la création des mécanismes à chaque étape

## Checklist de validation

### Pour chaque étape

- [ ] Le mécanisme apparaît à la bonne position
- [ ] L'image correcte s'affiche
- [ ] L'aura colorée est visible
- [ ] L'animation de pulsation fonctionne
- [ ] Le mécanisme apparaît dans la liste "⚙️ Mécanismes"
- [ ] Les informations sont correctes (nom, position, charges)

### Navigation

- [ ] Navigation avant : les mécanismes s'ajoutent progressivement
- [ ] Navigation arrière : les mécanismes disparaissent dans l'ordre inverse
- [ ] Reset : tous les mécanismes disparaissent

### Console

- [ ] Logs de création visibles : "Création d'un mécanisme [type]..."
- [ ] Logs d'ajout visibles : "Mécanisme créé et ajouté au plateau..."
- [ ] Pas d'erreurs JavaScript

## Résultats visuels attendus

Après l'étape 4, le plateau devrait afficher :

```
Position (5,10) : 🟣 Cadran (violet)
Position (6,11) : 🔵 Régulateur (cyan)
Position (7,10) : 🟡 Rouage (jaune)
Position (8,10) : 🔴 Sinistro (rouge)
```

Avec toutes les images correspondantes et les animations de pulsation.

## 🎉 Test réussi !

Si tous les points de la checklist sont validés, la fonctionnalité de création automatique des mécanismes fonctionne parfaitement ! 🚀

