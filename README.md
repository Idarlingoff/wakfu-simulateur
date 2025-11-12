# 🧮 Wakfu Combo Simulator

### ⚔️ Présentation

**Wakfu Combo Simulator** est une application web complète permettant de **simuler des tours de jeu complexes** dans **Wakfu**, en prenant en compte :

* les **sorts**, **passifs**, **sublimations** et **statistiques** du build choisi,
* les **effets conditionnels** (cadran, position, orientation, transposition, etc.),
* les **ressources** (PA, PM, PW),
* et les **procs automatiques** (passifs, distorsion, horloge double, etc.).

Le but n’est **pas de reproduire un builder existant**, mais de fournir un **simulateur précis et dynamique** permettant d’évaluer la **performance réelle d’un combo** ou d’une **rotation complète** en combat.

---

## 🧱 Architecture globale

L’application repose sur une architecture **Full Stack** :

* **Backend** : Java / Spring Boot
* **Frontend** : Angular
* **Base de données** : H2 (embarquée, simulation locale)

### Schéma :

```
wakfu-simulator/
├── backend/   → logique métier, simulation, gestion des sorts / effets
│   ├── src/
│   ├── pom.xml
│   └── Dockerfile
│
└── frontend/  → interface utilisateur Angular
    ├── src/
    ├── package.json
    ├── angular.json
    └── Dockerfile
```

---

## ⚙️ Fonctionnalités principales

### 🎯 Simulation de combos

* Création d’une **timeline de sorts** (enchaînement d’actions).
* Calcul automatique :

    * des **coûts PA / PM / PW**,
    * des **dégâts** (directs / indirects / critiques / dos / distance / mêlée),
    * des **gains** ou **pertes** de ressources.
* Gestion des **effets de zone**, **glyphes**, **mécanismes**, **transpositions**, etc.

### 🧠 Gestion des builds

* Sélection ou création d’un **build complet** :

    * Classe (ex: Xélor, Roublard…)
    * Sorts (jusqu’à 12)
    * Passifs (jusqu’à 6 selon le niveau)
    * Sublimations (jusqu’à 12 / 10 sublis, 1 épique et 1 relique)
    * Statistiques (maîtrises, CC, DI, etc.)
* Possibilité de **sauvegarder plusieurs builds** pour les comparer.

### 🧩 Système d’effets & conditions

Le backend repose sur une architecture **orientée domaine** et **pilotée par la donnée (data-driven)** :

* Chaque **sort**, **passif** et **statut** est défini en base H2 (SQL).
* Chaque **effet** (dégât, soin, déplacement, téléportation, etc.) est une entité combinable.
* Les **conditions** (ex: “sur le cadran”, “en transposition”, “au dos”) sont dynamiques et combinables (pattern *Specification*).

### 🕹️ Simulation visuelle (frontend Angular)

* **Mini-map interactive** : positionner le joueur et les ennemis (glisser-déposer).
* **Timeline éditable** : ajouter, réordonner et visualiser les sorts utilisés.
* **Gestion visuelle** des builds (drag & drop des sorts, passifs, sublis).
* **Rapport détaillé de simulation** :

    * Dégâts totaux / par sort
    * Chronologie des procs / gains de PA
    * Graphiques et logs détaillés

---

## 🧩 Technologies

### Backend

* **Java 21**
* **Spring Boot 3**
* **Spring Data JPA (H2)**
* **Lombok**
* **MapStruct**
* **JUnit 5** (tests)
* **Design Patterns** :

    * Strategy (formules de dégâts)
    * Composite (effets)
    * Specification (conditions)
    * Command (actions de simulation)
    * Observer (event bus)

### Frontend

* **Angular 19+**
* **TypeScript**
* **Bootstrap / TailwindCSS**
* **ngx-charts** (graphiques)
* **Drag & Drop API**
* **State management** léger (service-based)

---

## 🧮 Base de données H2

Le backend embarque une base H2 préremplie avec :

* Les sorts du **Xélor Rouage** (Cadran, Rouage, Sinistro, Sablier, Horloge, Désynchronisation, etc.)
* Les passifs majeurs (Maître du Cadran, Connaissance du Passé, Rémanence…)
* Les statuts persistants (Horloge, Sablier, Retour Spontané, Distorsion…)

Les sorts sont structurés de manière modulaire :

```sql
spell
spell_variant
spell_effect
effect_condition_group
effect_condition
status_def
status_effect
```

---

## 🚀 Installation rapide

### Backend

```bash
cd backend
mvn spring-boot:run
```

Base accessible sur :
➡️ [http://localhost:8080/h2-console](http://localhost:8080/h2-console)

### Frontend

```bash
cd frontend
npm install
ng serve
```

Interface accessible sur :
➡️ [http://localhost:4200](http://localhost:4200)

---

## 🧠 Exemple d’utilisation

1️⃣ Créer un build **Xélor Rouage** avec ses passifs.
2️⃣ Configurer les stats et sublis.
3️⃣ Éditer la **timeline de sorts** :

```
Vol du Temps → Sinistro → Cadran → Dévouement → Déplacement → Rouage → 
Retour Spontané → Désynchronisation → Distorsion → Pointe-Heure ×2 → ...
```

4️⃣ Lancer la simulation.
5️⃣ Visualiser :

* les **PA/PW** dépensés,
* les **dégâts totaux**,
* les **procs de passifs et sublis**,
* la **position finale** sur la map.

---

## 📈 Objectif final

Créer un outil permettant :

* aux joueurs **avancés** de **comprendre et optimiser leurs rotations** ;
* aux développeurs de la communauté de **tester mécaniquement des interactions complexes** ;
* de poser les bases d’un **moteur de simulation open-source** extensible à d’autres classes.