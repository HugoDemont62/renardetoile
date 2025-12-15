# RenardÉtoile — Shoot'em up Web (React + TypeScript + Vite)

RenardÉtoile est un petit shoot'em up développé en TypeScript avec React et Vite. Le projet contient le moteur de jeu, les classes d'entités (vaisseau, ennemis, lasers), des assets (modèles, textures, sons) et une interface minimale pour jouer.

## Principales fonctionnalités

- Moteur de jeu en TypeScript (classe `Engine`, gestion de la scène et des objets).
- Entités : `Starship`, `Enemy`, `Laser`, `PowerUp`, etc.
- Assets 3D et textures dans `public/` et `src/assets/`.
- Interface utilisateur légère dans `src/components/GameUI.tsx`.

## Prérequis

- Node.js (>= 16 recommandé)
- npm ou yarn

## Installation

Ouvrez un terminal à la racine du projet et lancez :

```bash
npm install
```

## Développement

Lancer le serveur de développement (Vite) :

```bash
npm run dev
```

## Construction pour production

```bash
npm run build
npm run preview
```

## Structure utile du dépôt

- `src/` : code source TypeScript et React
  - `Class/` : classes de jeu (vaisseaux, ennemis, projectiles...)
  - `components/` : composants React (UI)
  - `lib/` : moteur, contrôles, utilitaires
  - `assets/` : images et icônes du projet
- `public/` : modèles 3D, textures et sons statiques
- `index.html`, `vite.config.ts` : configuration Vite

## Comment jouer

- Ouvrez le serveur de dev (ou la build preview) dans votre navigateur.
- Contrôles : les touches sont définies dans `src/lib/Controls.ts` (clavier / souris).
- Objectif : survivre et obtenir le meilleur score possible.

## Contribuer

- Forkez le dépôt, créez une branche pour chaque fonctionnalité ou correction.
- Respectez la structure existante et ajoutez des tests ou des exemples si pertinent.
- Ouvrez une Pull Request détaillée décrivant les changements.

## Licence

Ce projet est distribué sous la licence MIT. Voir le fichier `LICENSE` à la racine du dépôt.

## Auteur

Prénom / pseudo : demonthu (inféré depuis l'environnement de travail)

---

Si vous voulez un README plus détaillé (guide de contribution, architecture interne, diagrammes, ou captures d'écran), dites-moi ce que vous souhaitez ajouter et je le ferai.
