---
date: 2026-03-29
topic: revision-app — README public + skill review
status: approved
---

# Spec : README public + review du skill generate-revision

## Contexte

`revision-app` est une app de révision locale (Node.js + vanilla JS) couplée à un skill Claude Code (`/generate-revision`) qui génère automatiquement des QCM, flashcards et résumés de cours à partir de PDFs universitaires.

Le repo va être rendu public. Objectifs :
1. Réviser et améliorer le skill `generate-revision.md`
2. Créer un `README.md` destiné à d'autres étudiants/devs qui veulent utiliser le système

## Changements au skill

### Corrections
- Step 3 : ajouter fallback HTTPS si SSH échoue
- Step 3 : supprimer la note obsolète "if the permanent app doesn't have an import UI yet"
- Step 7 : mentionner `npm install -g pm2` si PM2 absent
- Step 9 : conditionner le commit git à la présence d'un repo git dans le dossier cours

### Améliorations qualité de génération
- Step 4 : règle "les mauvaises réponses doivent être dans le même registre sémantique"
- Step 4 : au moins 2 questions de type comparaison par chapitre
- Step 5 : le `back` des flashcards doit inclure un exemple concret si possible
- Step 6 : décrire les schémas/diagrammes en ASCII ou tableau
- Step 2 : affiner la détection image-heavy — vérifier les 3 premières pages avant de conclure

### Déplacement
- Copier le skill révisé dans `skills/generate-revision.md` (dans le repo)
- Mettre à jour `~/.claude/skills/generate-revision.md` avec la version révisée

## README

### Audience
Étudiants et devs qui veulent cloner le système pour leurs propres cours.

### Sections
1. Description + badges
2. Schéma ASCII du workflow (PDFs → Claude → JSON → Import → App)
3. Prérequis (Node.js ≥ 18, PM2, Claude Code, pdftotext optionnel)
4. Installation (git clone + npm install + pm2 start)
5. Installer le skill Claude (cp skills/generate-revision.md ~/.claude/skills/)
6. Utilisation pas-à-pas (3 étapes)
7. Fonctionnalités (QCM modes, flashcards, cours, stats)
8. Structure du repo

### Ce qui est exclu
- Guide de contribution
- Changelog
- Détails d'implémentation du code
