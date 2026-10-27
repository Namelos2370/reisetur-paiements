import { ECOLE } from "./config.js";
import { modeLabel, TYPE, dansJours, isoLocal, libelleRappel, lignesRappel, noteSur80, fpts, moduleValide } from "./utils.js";

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
    ["Mode de paiement", modeLabel(r.mode_paiement)],
    ["Référence", r.reference_banque || "-"],
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

// ---- Attestation de réussite de niveau ----
export async function attestationNiveauPdf(a) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  entete(doc, await loadLogo());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 32, 51);
  doc.text("ATTESTATION DE NIVEAU", W / 2, 64, { align: "center" });
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
    ["Niveau validé", `Langue allemande - niveau ${a.niveau}`],
    ...(a.classe ? [["Classe", a.classe]] : []),
    ...(a.date_examen ? [["Date de l'examen", dlong(a.date_examen)]] : []),
    ...(a.note != null && a.note !== "" ? [["Note", noteSur80(a.note)]] : []),
    ...(a.mention ? [["Mention", a.mention]] : []),
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
  const corps = `a suivi la formation de langue allemande au centre ${ECOLE.nom} et a réussi l'examen du niveau ${a.niveau}. La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.`;
  doc.text(doc.splitTextToSize(corps, W - 50), 25, y, { lineHeightFactor: 1.5 });

  signature(doc, Math.max(y + 40, 195));

  doc.setFontSize(8.5);
  doc.setTextColor(120, 130, 150);
  doc.text(`Attestation éditée le ${dlong(todayIso())} - ${ECOLE.nom}`, W / 2, 287, { align: "center" });

  doc.save(`Attestation_niveau_${slug(a.niveau)}_${slug(a.matricule || a.nom)}.pdf`);
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
    "Nous vous rappelons qu'il vous reste les montants suivants à régler pour votre formation. Nous vous prions de bien vouloir les régler au centre au plus tard à la date limite indiquée ci-dessous.";
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
    "Le paiement s'effectue au centre. Un reçu officiel vous sera remis à chaque versement. Si vous avez déjà effectué ce paiement, veuillez présenter votre reçu pour la mise à jour de votre dossier.";
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

// ---- Relevé de résultats de l'épreuve finale (une page A4, mise en page du relevé remis aux candidats) ----
const NOIR = [42, 42, 42], VERT = [39, 174, 96], ROUGE = [192, 57, 43];
export async function releveNotesPdf(a) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  const L = 20, R = 190, W = R - L;
  const reussi = a.statut === "reussi";
  const modules = a.modules || [];
  const total = a.note != null && a.note !== "" ? Number(a.note) : modules.reduce((s, m) => s + m.pts, 0);
  const max = modules.reduce((s, m) => s + m.max, 0) || 80;
  const pct = (p, m) => ((p / m) * 100).toFixed(1) + "%";
  const jmy = a.date_examen ? a.date_examen.split("-").reverse().join(".") : "";
  const epreuve = a.epreuve || "";
  // « Hören » est écrit « Horen » sur les relevés remis aux candidats
  const nomModule = (m) => String(m).replace("ö", "o");

  // bandeau
  doc.setFillColor(...NOIR); doc.rect(L, 17.2, W, 25.7, "F");
  doc.setFillColor(255, 255, 255); doc.rect(L + 3.4, 19.8, 20.3, 20.3, "F");
  if (logo) { const r = Math.min(18.5 / logo.w, 18.5 / logo.h); const w = logo.w * r, h = logo.h * r; doc.addImage(logo.data, logo.fmt, L + 3.4 + (20.3 - w) / 2, 19.8 + (20.3 - h) / 2, w, h); }
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("REISETÜR 237 LANGUAGE CENTER", 47.7, 29);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(205, 205, 205);
  doc.text("Yaoundé, Cameroun • reisetur237@gmail.com • +237 620 107 489 • +237 699 164 497", 47.7, 35.4);

  // titre
  doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text(`ABSCHLUSSPRÜFUNG DEUTSCH ${a.niveau}`, 105, 57.5, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(85, 85, 85);
  doc.text(`${epreuve ? epreuve + " • " : ""}Résultats de l'épreuve finale`, 105, 65.5, { align: "center" });

  // candidat
  doc.setFillColor(250, 250, 250); doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
  doc.roundedRect(L, 73.7, W, 35.6, 2, 2, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(130, 130, 130);
  doc.text("KANDIDAT/IN", L + 6, 80);
  doc.setFontSize(16); doc.setTextColor(10, 10, 10);
  doc.text(a.nom, L + 6, 88.8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(85, 85, 85);
  if (a.naissance) doc.text(`Né(e) le ${a.naissance}`, L + 6, 96.7);
  doc.setTextColor(135, 135, 135);
  doc.text([a.rang ? `Rang : ${a.rang}` : "", jmy ? `Date de l'épreuve : ${jmy}` : ""].filter(Boolean).join(" | "), L + 6, 102.2);

  // tableau
  const X = [20, 59.8, 94.9, 125.1, 149.9, 190];
  const cx = (i) => (X[i] + X[i + 1]) / 2;
  let y = 115.5;
  doc.setFillColor(...NOIR); doc.rect(L, y, W, 12.7, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text("Module", X[0] + 4, y + 7.8);
  ["Points obtenus", "Maximum", "%", "Résultat"].forEach((t, i) => doc.text(t, cx(i + 1), y + 7.8, { align: "center" }));
  y += 12.7;
  const rowH = 13.9;
  modules.forEach((m, i) => {
    doc.setFillColor(...(i % 2 ? [244, 244, 244] : [255, 255, 255])); doc.rect(L, y, W, rowH, "F");
    doc.setDrawColor(221, 221, 221); doc.setLineWidth(0.25); doc.rect(L, y, W, rowH);
    X.slice(1, -1).forEach((x) => doc.line(x, y, x, y + rowH));
    const ok = moduleValide(m), by = y + rowH / 2 + 1.4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(10, 10, 10);
    doc.text(nomModule(m.m), X[0] + 4, by);
    doc.setFontSize(12.5); doc.text(fpts(m.pts), cx(1), by + 0.4, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(150, 150, 150);
    doc.text(String(m.max), cx(2), by, { align: "center" });
    doc.setTextColor(20, 20, 20); doc.text(pct(m.pts, m.max), cx(3), by, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setTextColor(...(ok ? VERT : ROUGE));
    doc.text(ok ? "Validé" : "Insuffisant", cx(4), by, { align: "center" });
    y += rowH;
  });
  // ligne TOTAL
  doc.setFillColor(...NOIR); doc.rect(L, y, W, 14.7, "F");
  doc.setDrawColor(10, 10, 10); doc.setLineWidth(0.5); doc.line(L, y, R, y);
  doc.setDrawColor(90, 90, 90); doc.setLineWidth(0.25); X.slice(1, -1).forEach((x) => doc.line(x, y, x, y + 14.7));
  const ty = y + 14.7 / 2 + 1.6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", X[0] + 4, ty);
  doc.setFontSize(12.5); doc.text(fpts(total), cx(1), ty + 0.4, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(160, 160, 160); doc.text(String(max), cx(2), ty, { align: "center" });
  doc.setTextColor(255, 255, 255); doc.text(pct(total, max), cx(3), ty, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setTextColor(...(reussi ? [46, 204, 113] : [231, 76, 60]));
  doc.text(reussi ? "VALIDE" : "ECHOUE", cx(4), ty, { align: "center" });

  // encadré résultat
  const by0 = 205.5;
  doc.setFillColor(...(reussi ? [236, 253, 243] : [253, 237, 236])); doc.setDrawColor(...(reussi ? VERT : ROUGE)); doc.setLineWidth(0.6);
  doc.rect(L, by0, W, 24, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...(reussi ? VERT : ROUGE));
  doc.text(reussi ? `REUSSI - Niveau ${a.niveau} valide` : `ECHOUE - Niveau ${a.niveau} non valide`, 105, by0 + 9.4, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Score total : ${fpts(total)}/${max} (${pct(total, max)}) | Mention : ${a.mention || ""}`, 105, by0 + 16.6, { align: "center" });

  // signature + pied de page
  doc.setFontSize(8.5); doc.setTextColor(140, 140, 140);
  doc.text("Signature & Cachet du Directeur du Centre", 105, 245.6, { align: "center" });
  doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.3); doc.line(65, 254.4, 145, 254.4);
  doc.setDrawColor(220, 220, 220); doc.line(22.3, 265.4, 187.7, 265.4);
  doc.setFontSize(7.5); doc.setTextColor(170, 170, 170);
  doc.text(`REISETÜR 237 Language Center | Abschlussprüfung Deutsch ${a.niveau}${epreuve ? " | " + epreuve : ""}${jmy ? " | " + jmy : ""}`, 105, 269.2, { align: "center" });

  doc.save(`Releve_${slug(a.niveau)}_${slug(a.nom)}.pdf`);
}
