import { ECOLE } from "./config.js";
import { TYPE, dansJours, isoLocal, libelleRappel, lignesRappel } from "./utils.js";

// jsPDF ne sait pas afficher les espaces insécables des nombres français : on les remplace.
const nf = new Intl.NumberFormat("fr-FR");
const money = (n) => nf.format(Number(n || 0)).replace(/[  ]/g, " ") + " FCFA";
const iso = (d) => (d.length === 10 ? d + "T00:00:00" : d);
const dlong = (d) => new Date(iso(d)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const dshort = (d) => new Date(iso(d)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const todayIso = () => isoLocal(new Date());
const dlongJour = (d) => new Date(iso(d)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

const BLEU = [11, 61, 145];
const objet = (type, numero) =>
  type === "inscription" ? "Frais d'inscription" : `Frais de scolarité - tranche ${numero}`;

// ---- Logo facultatif (public/logo.png) ----
let logoCache;
async function loadLogo() {
  if (logoCache !== undefined) return logoCache;
  logoCache = null;
  try {
    const r = await fetch("/logo.png");
    if (r.ok && (r.headers.get("content-type") || "").startsWith("image/")) {
      const blob = await r.blob();
      const data = await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(blob);
      });
      const dims = await new Promise((res) => {
        const im = new Image();
        im.onload = () => res({ w: im.width, h: im.height });
        im.onerror = () => res(null);
        im.src = data;
      });
      if (dims) {
        const fmt = (/^data:image\/(\w+)/.exec(data)?.[1] || "png").toUpperCase().replace("JPG", "JPEG");
        logoCache = { data, fmt, ...dims };
      }
    }
  } catch { /* pas de logo : on continue sans */ }
  return logoCache;
}

// ---- Éléments communs ----
function entete(doc, logo) {
  const W = doc.internal.pageSize.getWidth();
  let x0 = 15;
  if (logo) {
    const h = 22, w = Math.min(42, (h * logo.w) / logo.h);
    doc.addImage(logo.data, logo.fmt, 15, 12, w, h);
    x0 = 15 + w + 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...BLEU);
  doc.text(ECOLE.nom, x0, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(70, 80, 100);
  let y = 28;
  [ECOLE.sousTitre, ECOLE.adresse, ECOLE.contact].filter(Boolean).forEach((l) => { doc.text(l, x0, y); y += 5; });
  doc.setDrawColor(...BLEU);
  doc.setLineWidth(0.9);
  doc.line(15, 40, W - 15, 40);
  doc.setTextColor(20, 32, 51);
}

function signature(doc, y) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 32, 51);
  doc.text(`Fait à ${ECOLE.ville}, le ${dlong(todayIso())}`, W - 15, y, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(ECOLE.direction, W - 50, y + 11, { align: "center" });
  doc.setDrawColor(90, 100, 120);
  doc.setLineWidth(0.3);
  doc.line(W - 85, y + 36, W - 15, y + 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 120, 140);
  doc.text(ECOLE.directeur ? ECOLE.directeur : "Signature et cachet", W - 50, y + 41, { align: "center" });
  doc.setTextColor(20, 32, 51);
}

// ---- Reçu de paiement ----
export async function recuPdf(r) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  entete(doc, await loadLogo());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(20, 32, 51);
  doc.text("REÇU DE PAIEMENT", W / 2, 57, { align: "center" });

  doc.setDrawColor(...BLEU);
  doc.setLineWidth(0.7);
  doc.roundedRect(45, 64, 120, 17, 2, 2);
  doc.setFontSize(17);
  doc.setTextColor(...BLEU);
  doc.text("N° " + r.numero_recu, W / 2, 75, { align: "center" });

  const rows = [
    ["Étudiant", r.nom],
    ...(r.matricule ? [["Matricule", r.matricule]] : []),
    ["Classe", [r.classe, r.niveau && `(niveau ${r.niveau})`].filter(Boolean).join(" ") || "-"],
    ["Objet du paiement", objet(r.type, r.tranche)],
    ["Date du versement", dlong(r.date_paiement)],
    ["Référence bancaire", r.reference_banque || "-"],
  ];
  let y = 98;
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(100, 112, 130);
    doc.text(k, 25, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 32, 51);
    doc.text(String(v), 85, y);
    doc.setDrawColor(221, 227, 238);
    doc.setLineWidth(0.3);
    doc.line(25, y + 4, W - 25, y + 4);
    y += 12;
  });

  y += 4;
  doc.setFillColor(231, 238, 251);
  doc.roundedRect(25, y, W - 50, 26, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(70, 80, 100);
  doc.text("MONTANT REÇU", 32, y + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...BLEU);
  doc.text(money(r.montant), 32, y + 20);
  y += 36;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(70, 80, 100);
  const reste = Number(r.reste);
  doc.text(
    reste > 0
      ? `Reste à payer sur les ${r.type === "inscription" ? "frais d'inscription" : "frais de scolarité"} : ${money(reste)}`
      : `${r.type === "inscription" ? "Frais d'inscription" : "Frais de scolarité"} entièrement soldés.`,
    25, y
  );

  signature(doc, 218);

  doc.setFontSize(8.5);
  doc.setTextColor(120, 130, 150);
  doc.text("Pour vérifier l'authenticité de ce reçu : " + r.verifUrl, W / 2, 283, { align: "center" });
  doc.text("(saisir le n° de reçu et le nom de l'étudiant)", W / 2, 287, { align: "center" });

  doc.save(`Recu_${slug(r.numero_recu)}.pdf`);
}

// ---- Attestation d'inscription ----
export async function attestationPdf(a) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  entete(doc, await loadLogo());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 32, 51);
  doc.text("ATTESTATION D'INSCRIPTION", W / 2, 64, { align: "center" });
  doc.setDrawColor(...BLEU);
  doc.setLineWidth(0.7);
  doc.line(65, 69, W - 65, 69);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  doc.setTextColor(20, 32, 51);
  const intro = `Je soussigné(e), ${ECOLE.directeur || "la Direction"}, ${ECOLE.directeur ? ECOLE.direction + ", " : ""}atteste que :`;
  doc.text(doc.splitTextToSize(intro, W - 50), 25, 88);

  const rows = [
    ["Nom et prénoms", a.nom],
    ["Matricule", a.matricule],
    ["Formation", `Langue allemande - niveau ${a.niveau || "-"}`],
    ...(a.classe ? [["Classe", a.classe]] : []),
    ...(a.debut ? [["Début des cours", dlong(a.debut)]] : []),
    ...(a.fin ? [["Fin prévue", dlong(a.fin)]] : []),
  ];
  let y = 104;
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(100, 112, 130);
    doc.text(k, 25, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 32, 51);
    doc.text(String(v), 80, y);
    doc.setDrawColor(221, 227, 238);
    doc.setLineWidth(0.3);
    doc.line(25, y + 4, W - 25, y + 4);
    y += 12;
  });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  doc.setTextColor(20, 32, 51);
  const corps = `est régulièrement inscrit(e) au centre ${ECOLE.nom} et que ses frais d'inscription ont été réglés. La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.`;
  doc.text(doc.splitTextToSize(corps, W - 50), 25, y, { lineHeightFactor: 1.5 });

  signature(doc, Math.max(y + 40, 190));

  doc.setFontSize(8.5);
  doc.setTextColor(120, 130, 150);
  doc.text(`Attestation éditée le ${dlong(todayIso())} - ${ECOLE.nom}`, W / 2, 287, { align: "center" });

  doc.save(`Attestation_${slug(a.matricule || a.nom)}.pdf`);
}

// ---- Note de rappel d'échéance (une page par étudiant) ----
function noteUnePage(doc, logo, it) {
  const W = 210;
  entete(doc, logo);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 32, 51);
  doc.text(`${ECOLE.ville}, le ${dlong(todayIso())}`, W - 15, 52, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("NOTE DE RAPPEL D'ÉCHÉANCE DE PAIEMENT", W / 2, 68, { align: "center" });

  doc.setFontSize(11.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 112, 130);
  doc.text("À l'attention de :", 20, 84);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 32, 51);
  doc.setFontSize(13);
  doc.text(it.nom, 55, 84);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text([it.classe, it.niveau && `niveau ${it.niveau}`].filter(Boolean).join(" - "), 55, 90);
  if (it.matricule) doc.text(`Matricule : ${it.matricule}`, 55, 96);

  // Montants exactement dus : tranches échues (ou, à défaut, la prochaine), à régler sous 7 jours
  const { lignes, total, limite } = lignesRappel(it.lignes);
  const libelle = libelleRappel;

  const intro =
    "Nous vous rappelons qu'il vous reste les montants suivants à régler pour votre formation. Nous vous prions de bien vouloir les verser à la banque au plus tard à la date limite indiquée ci-dessous.";
  doc.text(doc.splitTextToSize(intro, W - 40), 20, 105);

  // Tableau
  let y = 125;
  doc.setFillColor(...BLEU);
  doc.rect(20, y - 6, W - 40, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Objet", 24, y);
  doc.text("Reste à payer", W - 24, y, { align: "right" });
  y += 9;
  doc.setFontSize(11.5);
  lignes.forEach((l) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 32, 51);
    doc.text(libelle(l), 24, y);
    doc.setFont("helvetica", "bold");
    doc.text(money(l.reste), W - 24, y, { align: "right" });
    doc.setDrawColor(221, 227, 238);
    doc.setLineWidth(0.3);
    doc.line(20, y + 3.5, W - 20, y + 3.5);
    y += 10;
  });
  if (lignes.length > 1) {
    doc.setFillColor(231, 238, 251);
    doc.rect(20, y - 4, W - 40, 11, "F");
    doc.setTextColor(...BLEU);
    doc.setFontSize(12);
    doc.text("TOTAL À RÉGLER", 24, y + 3);
    doc.text(money(total), W - 24, y + 3, { align: "right" });
    y += 14;
  }

  // Date limite
  y += 4;
  doc.setDrawColor(...BLEU);
  doc.setLineWidth(0.7);
  doc.roundedRect(20, y - 6, W - 40, 20, 2, 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(70, 80, 100);
  doc.text("À payer avant le", W / 2, y + 1, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BLEU);
  doc.text(dlongJour(limite), W / 2, y + 10, { align: "center" });
  y += 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 32, 51);
  const fin =
    "Le versement s'effectue à la banque. Merci de présenter votre bordereau de versement à l'administration afin de recevoir votre reçu officiel. Si vous avez déjà effectué ce paiement, veuillez présenter votre reçu pour la mise à jour de votre dossier.";
  doc.text(doc.splitTextToSize(fin, W - 40), 20, y);

  if (it.code_acces) {
    doc.setFontSize(9);
    doc.setTextColor(110, 120, 140);
    doc.text(`Suivi en ligne : ${window.location.origin}/situation  -  Matricule ${it.matricule}  -  Code d'accès ${it.code_acces}`, W / 2, 285, { align: "center" });
  }

  signature(doc, Math.max(y + 32, 215));
}

export async function notesPdf(items, titre = "") {
  if (!items.length) return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  items.forEach((it, i) => {
    if (i) doc.addPage();
    noteUnePage(doc, logo, it);
  });
  doc.save(
    items.length === 1
      ? `Note_echeance_${slug(items[0].nom)}.pdf`
      : `Notes_echeance_${titre ? slug(titre) + "_" : ""}${items.length}_etudiants.pdf`
  );
}
