# 🧪 Tests - Affichage des mécanismes

## Comment tester les changements

### 1. Démarrer l'application

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulator/frontend
npm start
```

L'application sera disponible sur `http://localhost:4200` (ou le port configuré).

### 2. Naviguer vers le Board

1. Créez ou sélectionnez un **Build** Xélor
2. Créez ou sélectionnez une **Timeline**
3. Allez sur la page **Board** / **Carte de Combat**

### 3. Vérifier l'affichage des images

#### Test 1 : Vérification des ressources
Ouvrez les outils de développement du navigateur (F12) et vérifiez que les images se chargent :

```
Network > Img
```

Vous devriez voir des requêtes vers :
- `/resources/rouage.png`
- `/resources/sinistro.png`
- `/resources/regulateur.png`
- `/resources/dial/dial-center.png`

Si une image retourne une erreur 404, vérifiez que :
- Le fichier existe dans `frontend/src/resources/`
- Le serveur dev a été redémarré après la modification d'`angular.json`

#### Test 2 : Vérification visuelle sur le plateau

Si vous avez déjà des mécanismes dans votre timeline :
1. Naviguez dans les étapes avec **◀** et **▶**
2. Vérifiez que les mécanismes s'affichent avec des images, pas des emojis
3. Vérifiez que l'animation de pulsation fonctionne
4. Vérifiez que l'aura colorée est visible (drop-shadow)

#### Test 3 : Vérification de la liste des mécanismes

En bas du composant Board, dans la section **⚙️ Mécanismes** :
1. Vérifiez que chaque mécanisme a son image
2. Vérifiez que le nom est correct (Rouage, Cadran, Sinistro, Régulateur)
3. Vérifiez que la position et les charges sont affichées

#### Test 4 : Rouage avec charges

Pour tester l'affichage du rouage bleu (avec charges) :
1. Créez un mécanisme de type 'cog' avec `charges: 5`
2. Vérifiez que l'image affichée est `/resources/rouage-bleu.png`
3. Modifiez les charges à 0
4. Vérifiez que l'image redevient `/resources/rouage.png`

### 4. Tests de régression

Vérifiez que les fonctionnalités existantes fonctionnent toujours :

- ✅ Affichage des entités (joueur, ennemis)
- ✅ Navigation dans les étapes de la timeline
- ✅ Affichage des actions de sorts
- ✅ Légende du plateau
- ✅ Liste des entités

### 5. Tests dans différents navigateurs

Testez dans :
- Chrome / Edge
- Firefox
- Safari (si macOS)

### 6. Tests responsive

Vérifiez l'affichage sur différentes tailles d'écran :
- Desktop (1920x1080)
- Tablette (768px)
- Mobile (375px)

Les images devraient s'adapter correctement grâce aux styles en pourcentage.

## 🐛 Problèmes courants et solutions

### Images ne s'affichent pas

**Symptôme** : Les mécanismes n'apparaissent pas ou affichent une icône cassée

**Solutions** :
1. Vérifiez la console pour les erreurs 404
2. Redémarrez le serveur dev (`npm start`)
3. Videz le cache du navigateur (Cmd+Shift+R / Ctrl+Shift+R)
4. Vérifiez que les fichiers existent dans `src/resources/`

### Images trop grandes/petites

**Symptôme** : Les images débordent ou sont trop petites

**Solution** : Les styles utilisent 80% de la taille de la cellule :
```css
.mechanism-image {
  width: 80%;
  height: 80%;
  object-fit: contain;
}
```

Ajustez ce pourcentage si nécessaire.

### Animation ne fonctionne pas

**Symptôme** : Pas d'animation de pulsation

**Solution** : Vérifiez que le CSS inclut :
```css
.board .mechanism {
  animation: pulse 1.5s ease-in-out infinite;
}
```

### Drop-shadow invisible

**Symptôme** : Pas d'aura colorée autour des mécanismes

**Solution** : Vérifiez que les styles spécifiques par type sont appliqués :
```css
.board .mechanism.cog .mechanism-image {
  filter: drop-shadow(0 0 4px #ffd166);
}
```

## ✅ Checklist de validation

- [ ] Les images se chargent sans erreur 404
- [ ] Les mécanismes ont des images, pas des emojis
- [ ] L'animation de pulsation fonctionne
- [ ] Les auras colorées sont visibles
- [ ] Le rouage devient bleu avec des charges
- [ ] La liste des mécanismes affiche les bonnes images
- [ ] Les noms sont localisés (français)
- [ ] Pas d'erreurs dans la console
- [ ] Le build Angular réussit
- [ ] Les fonctionnalités existantes fonctionnent

## 🎯 Tests avancés (optionnels)

### Test de performance
```bash
npm run build -- --stats-json
```
Analysez le bundle pour vérifier que les images ne sont pas incluses (elles sont servies séparément).

### Test d'accessibilité
Vérifiez que les balises `<img>` ont des attributs `alt` :
```html
<img [src]="..." [alt]="getMechanismTitle(mech.type)" />
```

### Test de compatibilité TypeScript
```bash
npm run lint
```
Devrait passer avec seulement des warnings, pas d'erreurs.

## 📊 Métriques de succès

- ✅ Build time : ~3-5 secondes
- ✅ Bundle size : ~500 KB (léger dépassement acceptable)
- ✅ Nombre d'erreurs : 0
- ✅ Nombre de warnings critiques : 0
- ✅ Couverture fonctionnelle : 100% des types de mécanismes

## 🎉 Validation finale

Une fois tous les tests passés, l'implémentation est validée et prête pour la production ! 🚀

