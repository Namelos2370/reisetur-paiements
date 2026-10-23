import { sb, q } from "./supabase.js";
import { ECOLE } from "./config.js";
import { fcfa, today, TYPE, libelleRappel, lignesRappel } from "./utils.js";
import { recuPdf } from "./pdf.js";

// ---- Reçu ----
export async function chargerRecu(encaissementId) {
  const c = await q(sb.from("encaissements").select("*").eq("id", encaissementId).single());
  const t = await q(sb.from("v_tranches").select("*").eq("id", c.tranche_id).single());
  const [e, frais] = await Promise.all([
    q(sb.from("etudiants").select("*").eq("id", t.etudiant_id).single()),
    q(sb.from("v_frais").select("solde").eq("etudiant_id", t.etudiant_id).eq("type", t.type)),
  ]);
  return {
    numero_recu: c.numero_recu,
    montant: c.montant,
    date_paiement: c.date_paiement,
    reference_banque: c.reference_banque,
    nom: e.nom,
    matricule: e.matricule,
    classe: t.etudiant_classe ?? e.classe, // niveau/classe de l'époque du paiement
    niveau: t.niveau ?? e.niveau,
    type: t.type,
    tranche: t.numero,
    reste: frais[0]?.solde ?? 0,
    verifUrl: `${window.location.origin}/verifier?n=${encodeURIComponent(c.numero_recu)}`,
  };
}

export async function telechargerRecu(encaissementId) {
  const r = await chargerRecu(encaissementId);
  if (!r.numero_recu) throw new Error("Ce paiement n'a pas encore de n° de reçu : valide-le d'abord.");
  await recuPdf(r);
}

// ---- Relances ----
// Un étudiant apparaît s'il lui reste quelque chose à payer, hors paiements déjà saisis mais pas encore validés.
export async function chargerRelances() {
  const [etus, trs] = await Promise.all([
    q(sb.from("etudiants").select("*").order("nom")),
    q(sb.from("v_tranches").select("*").gt("solde", 0)),
  ]);
  const t0 = today();
  const by = {};
  trs.forEach((t) => {
    const reste = t.solde - t.a_valider;
    if (reste <= 0) return;
    (by[t.etudiant_id] ||= []).push({
      type: t.type,
      numero: t.numero,
      date_limite: t.date_limite,
      reste,
      partiel: t.paye > 0,
      retard: t.date_limite < t0,
    });
  });
  return etus
    .filter((e) => by[e.id])
    .map((e) => {
      const lignes = by[e.id].sort((a, b) => a.date_limite.localeCompare(b.date_limite));
      return {
        id: e.id,
        nom: e.nom,
        matricule: e.matricule,
        classe: e.classe,
        niveau: e.niveau,
        telephone: e.telephone,
        lignes,
        total: lignes.reduce((s, l) => s + l.reste, 0),
        prochaine: lignes[0].date_limite,
        enRetard: lignes.some((l) => l.retard),
      };
    })
    .sort((a, b) => (a.classe || "").localeCompare(b.classe || "") || a.nom.localeCompare(b.nom));
}

// ---- WhatsApp ----
export function waNumber(tel) {
  let d = String(tel || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.length === 9) d = "237" + d; // numéro camerounais sans indicatif
  return d.length >= 10 ? d : null;
}

const dcourt = (d) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function messageWhatsApp(s) {
  const { lignes, total, limite } = lignesRappel(s.lignes);
  const detail = lignes.map((l) => `• ${libelleRappel(l)} : ${fcfa(l.reste)}`).join("\n");
  return (
    `Bonjour ${s.nom}${s.matricule ? ` (matricule ${s.matricule})` : ""},\n\n` +
    `${ECOLE.nom} vous rappelle qu'il vous reste à régler${s.classe ? ` pour votre formation (${s.classe})` : " pour votre formation"} :\n${detail}\n` +
    `${lignes.length > 1 ? `Total : ${fcfa(total)}\n` : ""}\n` +
    `Merci de verser ce montant à la banque *avant le ${dcourt(limite)}*, puis de présenter votre bordereau à l'administration pour recevoir votre reçu. ` +
    `Si vous avez déjà payé, merci de nous envoyer votre reçu.\n\n` +
    `Cordialement,\n${ECOLE.direction}`
  );
}

export const waLink = (tel, message) => `https://wa.me/${waNumber(tel)}?text=${encodeURIComponent(message)}`;

export { TYPE };
