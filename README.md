# Reisetür 237 — Validation des encaissements

Application React (Vite) connectée à la base Supabase **reisetur-paiements** (déjà créée et sécurisée).

## Lancer en local
```bash
npm install
cp .env.example .env   # déjà pré-rempli avec la clé publique
npm run dev
```

## Déployer sur Vercel
1. Pousse le dossier sur GitHub et importe-le dans Vercel (preset **Vite** détecté automatiquement).
2. Variables d'environnement (optionnelles, des valeurs par défaut existent) :
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir `.env.example`).
3. Build : `npm run build` — dossier de sortie : `dist`.

## Première utilisation
1. Saisis email + mot de passe (8 caractères min.), clique « Créer le compte administrateur ».
2. Confirme l'email, puis connecte-toi : **le premier compte connecté devient l'unique administrateur**.
3. Dans Supabase → Authentication → Sign In / Providers, **désactive les inscriptions publiques**.

## Fonctionnement
- **Étudiants** : nom, téléphone, niveau (A1–C1) ; frais d'inscription ou de scolarité en 2 tranches.
- **Valider un encaissement** : étudiant, tranche, montant, date, référence du bordereau, photo. Le n° de reçu (`RT237-ANNÉE-0001`) est généré automatiquement ou saisi.
- **Garde-fous (côté base)** : n° de reçu unique, référence bancaire unique, pas de dépassement de tranche, aucun encaissement modifiable/supprimable (annulation avec motif uniquement), journal d'audit inaltérable.
- **Vérifier un reçu**, **tableau de bord**, **journal**.

## Structure
```
src/
  App.jsx            connexion + navigation
  supabase.js        client Supabase
  utils.js           formats FCFA / dates, libellés
  components/ui.jsx  toast, modal, hooks
  pages/             Dashboard, Encaisser, Etudiants, Verifier, Journal
```
