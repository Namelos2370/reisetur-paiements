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

## Fonctions avancées
- **Reçu PDF** : bouton « Reçu PDF » après chaque validation (et dans la fiche étudiant). En-tête de l'école, n° de reçu, montant, reste à payer, signature de la direction, lien de vérification.
- **Relances** : liste des impayés par classe (échéance dépassée / à venir), message WhatsApp prêt à envoyer, **note de rappel imprimable** (une page par étudiant, ou toute la classe d'un coup).
- **Exports Excel** : global, par classe (une feuille par classe) et par mois.
- **Vérification publique** : `https://ton-site/verifier?n=RT237-2026-0001`. L'étudiant doit saisir le n° de reçu **et** son nom ; aucune autre donnée n'est exposée.
- **Navigation** : seuls les onglets essentiels sont visibles (Tableau de bord, À valider, Nouvel encaissement, Étudiants). Clique sur le **logo / nom du centre** pour ouvrir le menu : Relances, Exports, Vérifier un reçu, Journal, Mon profil, Déconnexion.
- **Passage au niveau supérieur** : bouton dans la fiche étudiant (uniquement vers un niveau plus élevé, pour ceux qui ont réussi). Crée les frais de scolarité du nouveau niveau (tarifs pré-remplis depuis *Mon profil → Tarifs*), garde l'historique : chaque frais et chaque reçu conserve le niveau et la classe de son époque, et le parcours (A1 → A2 …) est enregistré.
- **Échéances** : tranche 1 due au début des cours, tranche 2 deux semaines après. En saisissant le « Début des cours » (nouveaux frais ou passage de niveau), les deux dates se remplissent toutes seules.
- **Mon profil** : mes informations, changement de mot de passe, et informations du centre (nom, adresse, contact, ville, signature) utilisées sur les PDF et WhatsApp.

## Personnaliser les documents
- Texte de l'en-tête et signature : **Mon profil → Le centre** (enregistré en base ; `src/config.js` ne contient que les valeurs par défaut).
- Logo : `public/logo.png` : affiché dans l'en-tête de l'app, sur la page de connexion, la vérification publique, les reçus et les notes.
