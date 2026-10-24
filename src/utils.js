const nf = new Intl.NumberFormat("fr-FR");

export const fcfa = (n) => nf.format(Number(n || 0)) + " FCFA";
export const nombre = (n) => nf.format(Number(n || 0));

export const fdate = (d) =>
  d
    ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const fdatetime = (d) => new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export const today = () => new Date().toISOString().slice(0, 10);

export const TYPE = { inscription: "Inscription", scolarite: "Scolarité" };

export const STAT = {
  payee: ["Payée", "ok"],
  en_retard: ["En retard", "bad"],
  partielle: ["Partielle", "warn"],
  en_attente: ["En attente", "neutral"],
};

export const GLOBAL = {
  solde: ["Soldé", "ok"],
  rien_paye: ["Rien payé", "neutral"],
  tranche_1_payee: ["Tranche 1 payée", "warn"],
};

export function friendly(e) {
  const m = e?.message || String(e);
  if (e?.code === "23505") {
    if (m.includes("numero_recu")) return "Ce numéro de reçu existe déjà.";
    if (m.includes("reference_banque")) return "Cette référence bancaire a déjà été validée.";
  }
  if (m.includes("Invalid login")) return "Email ou mot de passe incorrect.";
  return m;
}

// Règle d'échéances : tranche 1 versée au début des cours, tranche 2 deux semaines plus tard.
export function echeancesDepuisDebut(debut) {
  if (!debut) return { d1: "", d2: "" };
  const d = new Date(debut + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 14);
  return { d1: debut, d2: d.toISOString().slice(0, 10) };
}

// ---- Rappels (note PDF et WhatsApp) : mêmes montants, même date limite ----
export const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dansJours = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };

// Date limite affichée sur les notes et les WhatsApp : réglable dans « Relances » (mémorisée sur cet appareil).
// Par défaut : 7 jours à partir d'aujourd'hui.
const CLE_LIMITE = "reisetur_limite_rappel";
let limiteDefaut = null; // prochaine échéance à venir (calculée au chargement des relances)
export const proposerLimite = (v) => { limiteDefaut = v; };
export function limiteRappel() {
  try {
    const v = localStorage.getItem(CLE_LIMITE);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= isoLocal(new Date())) return v;
  } catch { /* sans stockage */ }
  return limiteDefaut && limiteDefaut >= isoLocal(new Date()) ? limiteDefaut : dansJours(7);
}
export function fixerLimiteRappel(v) { try { v ? localStorage.setItem(CLE_LIMITE, v) : localStorage.removeItem(CLE_LIMITE); } catch { /* ignore */ } }

// Tranches à réclamer : celles dont l'échéance tombe au plus tard à la date limite des rappels (sinon la prochaine).
export function lignesRappel(lignes) {
  const limite = limiteRappel();
  const echues = lignes.filter((l) => l.date_limite <= limite);
  const dues = echues.length ? echues : [lignes[0]];
  // Une seule ligne par nature de frais (plus de séparation T1 / T2 sur les notes)
  const parType = [];
  dues.forEach((l) => {
    const x = parType.find((y) => y.type === l.type);
    if (x) { x.reste += l.reste; x.partiel = x.partiel || l.partiel; } else parType.push({ ...l });
  });
  return { lignes: parType, total: dues.reduce((s, l) => s + l.reste, 0), limite };
}

export const libelleRappel = (l) =>
  (l.type === "inscription" ? "Frais d'inscription" : "Frais de scolarité") + (l.partiel ? " (solde)" : "");
