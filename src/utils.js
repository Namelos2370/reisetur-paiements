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
