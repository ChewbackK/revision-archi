# revision-app

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)
![PM2](https://img.shields.io/badge/PM2-required-blue)
![Claude Code](https://img.shields.io/badge/Claude_Code-required-orange)

App de révision locale générée automatiquement depuis tes PDFs de cours.
Un skill Claude Code analyse tes PDFs et produit des QCM, flashcards et résumés — tu les importes en un clic.

---

## Comment ça marche

```
Dossier cours/
  ├── CM1.pdf
  ├── CM2.pdf
  └── CM3.pdf
       │
       ▼
  Claude Code
  /generate-revision
       │
       ▼
  3 fichiers JSON générés localement
  ├── questions.json   (QCM)
  ├── flashcards.json  (Flashcards)
  └── cours.json       (Résumés)
       │
       ▼
  http://localhost:4242
  → Importer → upload des 3 fichiers
       │
       ▼
  App chargée avec ton cours
  QCM · Flashcards · Résumés · Stats
```

---

## Prérequis

- [Node.js](https://nodejs.org/) ≥ 18
- [PM2](https://pm2.keymetrics.io/) (`npm install -g pm2`)
- [Claude Code](https://claude.ai/code)
- `pdftotext` (optionnel, pour les PDFs textuels) : `sudo apt install poppler-utils`

---

## Installation

```bash
git clone https://github.com/ChewbackK/revision-archi.git ~/revision-app
cd ~/revision-app
npm install
pm2 start npm --name "revision-app" -- start
pm2 save
```

L'app tourne sur **http://localhost:4242**.

---

## Installer le skill Claude

Le skill `/generate-revision` est inclus dans ce repo. Copie-le dans ton dossier de skills Claude Code :

```bash
cp ~/revision-app/skills/generate-revision.md ~/.claude/skills/
```

> Si tu n'as pas encore de dossier `~/.claude/skills/`, crée-le d'abord :
> `mkdir -p ~/.claude/skills`

---

## Utilisation

1. **Va dans le dossier de ton cours** (celui qui contient tes PDFs) :
   ```bash
   cd ~/Documents/cours/R4B10
   ```

2. **Lance le skill dans Claude Code** :
   ```
   /generate-revision
   ```
   Claude lit les PDFs, génère `questions.json`, `flashcards.json` et `cours.json` dans le dossier courant.

3. **Importe dans l'app** :
   Ouvre **http://localhost:4242**, va dans **Importer**, et uploade les 3 fichiers.

C'est tout. L'app se recharge avec ton cours.

---

## Fonctionnalités

**QCM**
- Mode normal, adaptatif (priorité aux questions ratées), chronométré, révision des erreurs
- Filtre par chapitre
- Indicateur de confiance (je savais / j'ai deviné / raté)

**Flashcards**
- Filtre par chapitre et thème
- Retournement animé

**Résumés de cours**
- Sections dépliables par chapitre
- Rendu Markdown (gras, listes, tableaux, code)

**Statistiques**
- Historique des sessions
- Score par question
- Progression dans le temps

---

## Structure du repo

```
revision-app/
├── server.js              — API Express (port 4242)
├── package.json
├── public/
│   ├── index.html
│   ├── js/app.js          — App vanilla JS (routing, QCM, flashcards, cours, stats, import)
│   ├── css/style.css
│   └── data/              — JSON actifs (remplacés à chaque import)
│       ├── questions.json
│       ├── flashcards.json
│       └── cours.json
├── skills/
│   └── generate-revision.md  — Skill Claude Code à copier dans ~/.claude/skills/
└── .gitignore             — data.json (progression) ignoré
```

---

## Notes

- La progression (`data.json`) est locale et **non versionnée** — elle ne part pas si tu réinstalle l'app.
- Les fichiers JSON de cours (générés par Claude) peuvent être versionnés dans **ton dossier de cours**, pas dans ce repo.
- L'app est prévue pour tourner en local uniquement — pas de auth, pas de multi-utilisateur.
