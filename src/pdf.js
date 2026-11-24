import { ECOLE } from "./config.js";
import { modeLabel, TYPE, dansJours, isoLocal, libelleRappel, lignesRappel, noteSur80, fpts, moduleValide, noteModule } from "./utils.js";

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
  type === "inscription" ? "Frais d'inscription" : type === "rattrapage" ? "Frais de rattrapage" : `Frais de scolarité - tranche ${numero}`;
const nomFrais = (type) => (type === "inscription" ? "frais d'inscription" : type === "rattrapage" ? "frais de rattrapage" : "frais de scolarité");

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
      // Logo réduit (360 px max, JPEG sur fond blanc) pour alléger les PDF
      const logo = await new Promise((res) => {
        const im = new Image();
        im.onload = () => {
          try {
            const k = Math.min(1, 360 / Math.max(im.width, im.height));
            const w = Math.round(im.width * k), h = Math.round(im.height * k);
            const c = document.createElement("canvas"); c.width = w; c.height = h;
            const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
            res({ data: c.toDataURL("image/jpeg", 0.85), fmt: "JPEG", w, h });
          } catch { res({ data, fmt: (/^data:image\/(\w+)/.exec(data)?.[1] || "png").toUpperCase().replace("JPG", "JPEG"), w: im.width, h: im.height }); }
        };
        im.onerror = () => res(null);
        im.src = data;
      });
      if (logo) logoCache = logo;
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
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
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
      ? `Reste à payer sur les ${nomFrais(r.type)} : ${money(reste)}`
      : `${nomFrais(r.type).charAt(0).toUpperCase() + nomFrais(r.type).slice(1)} entièrement soldés.`,
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
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
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
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = 210, H = 297, OR = [176, 141, 60], TX = [20, 32, 51], GR = [100, 112, 130];
  const logo = await loadLogo();
  const centre = (t, y, opt = {}) => doc.text(t, W / 2, y, { align: "center", ...opt });

  // Cadre : double filet bleu / or
  doc.setDrawColor(...BLEU); doc.setLineWidth(1.4); doc.rect(8, 8, W - 16, H - 16);
  doc.setDrawColor(...OR); doc.setLineWidth(0.5); doc.rect(11.5, 11.5, W - 23, H - 23);

  // En-tête : logo + centre
  let y = 20;
  if (logo) { const h = 20, w = Math.min(40, (h * logo.w) / logo.h); doc.addImage(logo.data, logo.fmt, (W - w) / 2, y, w, h); y += h + 8; } else y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...BLEU); centre(ECOLE.nom, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...GR);
  centre([ECOLE.sousTitre, ECOLE.adresse].filter(Boolean).join("  ·  "), y + 5.5);
  if (ECOLE.contact) centre(ECOLE.contact, y + 10.5);
  y += 15;

  // Titre
  doc.setDrawColor(...OR); doc.setLineWidth(0.6); doc.line(60, y, W - 60, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(...TX);
  centre("ATTESTATION DE RÉUSSITE", y + 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...GR);
  centre(`Langue allemande · Niveau ${a.niveau} du Cadre européen commun de référence`, y + 20);
  doc.line(60, y + 25, W - 60, y + 25);
  y += 34;

  // Échelle des niveaux : seul le niveau concerné est en couleur
  const niveaux = ["A1", "A2", "B1", "B2", "C1"], pas = 27, x0n = W / 2 - (pas * (niveaux.length - 1)) / 2, cy = y + 11;
  niveaux.forEach((n, i) => {
    const x = x0n + i * pas, actif = n === String(a.niveau).toUpperCase();
    if (i > 0) { doc.setDrawColor(215, 220, 230); doc.setLineWidth(0.5); doc.line(x - pas + (actif ? 8 : 9.5), cy, x - (actif ? 11 : 9.5), cy); }
    if (actif) {
      doc.setFillColor(...BLEU); doc.circle(x, cy, 9.5, "F");
      doc.setDrawColor(...OR); doc.setLineWidth(0.9); doc.circle(x, cy, 12);
    } else {
      doc.setFillColor(235, 238, 244); doc.circle(x, cy, 8, "F");
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(actif ? 15 : 11); doc.setTextColor(...(actif ? [255, 255, 255] : [165, 172, 186]));
    doc.text(n, x, cy + (actif ? 2.4 : 1.8), { align: "center" });
  });
  y = cy + 24;

  // Corps
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(...GR);
  centre(`La Direction de ${ECOLE.nom} certifie que`, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...TX);
  centre(a.nom, y + 12);
  doc.setDrawColor(...BLEU); doc.setLineWidth(0.4); doc.line(50, y + 16, W - 50, y + 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...GR);
  let sous = `Matricule ${a.matricule}`;
  if (a.naissance) sous += `  ·  Né(e) le ${a.naissance}`;
  centre(sous, y + 22.5);
  y += 31;

  doc.setFontSize(11.5); doc.setTextColor(...TX);
  const date = a.date_examen ? ` du ${dlong(a.date_examen)}` : "";
  const corps = `a suivi la formation de langue allemande au sein du centre ${ECOLE.nom}${a.classe ? ` (classe ${a.classe})` : ""} et a satisfait à l'ensemble des épreuves de l'examen final (Abschlusstest)${date}, validant ainsi le niveau ${a.niveau}.`;
  doc.text(doc.splitTextToSize(corps, W - 56), W / 2, y, { align: "center", lineHeightFactor: 1.45 });
  y += 24;

  // Résultats
  const max = a.max || 80;
  const pct = a.note != null && a.note !== "" ? `${((Number(a.note) / max) * 100).toFixed(1).replace(".", ",")} %` : null;
  const boites = [
    ...(a.note != null && a.note !== "" ? [["NOTE FINALE", noteSur80(a.note, max)]] : []),
    ...(pct ? [["POURCENTAGE", pct]] : []),
    ...(a.mention ? [["OBSERVATIONS", a.mention]] : []),
  ];
  if (boites.length) {
    const bw = 48, gap = 6, total = boites.length * bw + (boites.length - 1) * gap;
    boites.forEach(([k, v], i) => {
      const x = (W - total) / 2 + i * (bw + gap);
      doc.setFillColor(243, 246, 252); doc.setDrawColor(...BLEU); doc.setLineWidth(0.4); doc.roundedRect(x, y, bw, 19, 2, 2, "FD");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...GR); doc.text(k, x + bw / 2, y + 6.5, { align: "center" });
      doc.setFontSize(13.5); doc.setTextColor(...BLEU); doc.text(v, x + bw / 2, y + 14.5, { align: "center" });
    });
    y += 25;
  }

  // Signature
  const ys = Math.min(Math.max(y + 14, 215), 240);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...TX);
  doc.text(`Fait à ${ECOLE.ville}, le ${dlong(todayIso())}`, W - 25, ys, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(ECOLE.direction, W - 60, ys + 9, { align: "center" });
  doc.setDrawColor(90, 100, 120); doc.setLineWidth(0.3); doc.line(W - 90, ys + 30, W - 30, ys + 30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GR);
  doc.text(ECOLE.directeur ? ECOLE.directeur : "Signature et cachet", W - 60, ys + 35, { align: "center" });

  // Pied : numéro de référence + mention d'usage
  const ref = `ATT-${String(a.niveau).toUpperCase()}-${String(a.matricule || "").replace(/\D/g, "").slice(-5)}-${String(a.date_examen || todayIso()).replace(/-/g, "")}`;
  doc.setFontSize(8); doc.setTextColor(120, 130, 150);
  doc.text(`Référence : ${ref}`, 25, ys + 35);
  centre("Document délivré à l'intéressé(e) pour servir et valoir ce que de droit.", H - 17);

  doc.save(`Attestation_niveau_${slug(a.niveau)}_${slug(a.matricule || a.nom)}.pdf`);
}

// ---- Invitation à l'examen de passage (Abschlusstest) ----
// Planning des épreuves écrites selon le niveau (minutes) — l'ordre est celui de l'examen
const EPREUVES_EXAMEN = {
  A1: [["Hören", 20], ["Lesen + Schreiben", 50], ["Grammatik", 15]],
  A2: [["Hören", 30], ["Lesen", 30], ["Schreiben", 30], ["Grammatik", 20]],
};
const hm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}h${String(min % 60).padStart(2, "0")}`;

export async function invitationExamenPdf(a) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = 210;
  entete(doc, await loadLogo());
  doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.setTextColor(20, 32, 51);
  doc.text("INVITATION À L'EXAMEN DE PASSAGE", W / 2, 60, { align: "center" });
  doc.setFontSize(11.5); doc.setTextColor(100, 112, 130);
  doc.text("Abschlusstest — Langue allemande", W / 2, 67, { align: "center" });
  doc.setDrawColor(...BLEU); doc.setLineWidth(0.7); doc.line(65, 71, W - 65, 71);

  // Début de l'examen (ex. "09h00") -> minutes
  const mh = /(\d{1,2})\s*[h:]\s*(\d{2})?/i.exec(a.horaires || "");
  const debut = mh ? Number(mh[1]) * 60 + Number(mh[2] || 0) : null;
  const plan = EPREUVES_EXAMEN[String(a.niveau || "").toUpperCase().slice(0, 2)];

  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(20, 32, 51);
  doc.text(`${ECOLE.nom} a le plaisir d'inviter :`, 25, 82);
  const rows = [
    ["Nom et prénoms", a.nom], ["Numéro de candidat", a.matricule],
    ["Niveau", `Langue allemande - niveau ${a.niveau}`],
    ...(a.classe ? [["Classe", a.classe]] : []),
    ["Date de l'examen", dlongJour(a.examen)],
    ...(a.salle ? [["Lieu / salle", a.salle]] : []),
  ];
  let y = 92;
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(100, 112, 130); doc.text(k, 25, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(20, 32, 51); doc.text(String(v), 80, y);
    doc.setDrawColor(221, 227, 238); doc.setLineWidth(0.3); doc.line(25, y + 3, W - 25, y + 3); y += 9;
  });

  // Tableau des épreuves : Désignation / Local / Date / Heure
  const lignes = [];
  if (plan && debut != null) {
    let t = debut;
    plan.forEach(([m, d]) => { lignes.push([m, t, t + d]); t += d; });
  } else if (a.horaires) {
    lignes.push(["Épreuves écrites", null, null]);
  }
  y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(20, 32, 51);
  doc.text("Vous êtes inscrit(e) aux modules suivants :", 25, y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
  doc.text("Désignation", 25, y); doc.text("Local", 80, y); doc.text("Date", 115, y); doc.text("Heure", 160, y);
  doc.setDrawColor(...BLEU); doc.setLineWidth(0.4); doc.line(25, y + 2, W - 25, y + 2);
  y += 7;
  const dcourte = new Date(iso(a.examen)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  let local = a.salle || "Salle d'examen";
  const ligne = (m, heure) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(20, 32, 51);
    doc.text(m, 25, y); doc.text(local, 80, y, { maxWidth: 32 }); doc.text(dcourte, 115, y); doc.text(heure, 160, y);
    y += 7;
  };
  lignes.forEach(([m, d, f]) => ligne(m, d != null ? `${hm(d)} - ${hm(f)}` : a.horaires));
  if (a.sprechen) {
    const [hh, mm] = String(a.sprechen).split(/[h:]/).map((x) => parseInt(x, 10));
    if (a.salleSprechen) local = a.salleSprechen;
    ligne("Sprechen", Number.isFinite(hh) ? `${hm(hh * 60 + (mm || 0))} - ${hm(hh * 60 + (mm || 0) + 15)}` : String(a.sprechen));
  }

  y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(20, 32, 51);
  const avant = debut != null ? ` (soit à ${hm(debut - 30)})` : "";
  const corps = `Veuillez vous présenter 30 minutes avant le début de l'examen${avant}, muni(e) de la présente invitation et d'une pièce d'identité. Le Sprechen se passe individuellement, à l'heure indiquée ci-dessus. Les frais de scolarité doivent être entièrement réglés avant l'examen. Nous vous souhaitons beaucoup de réussite !`;
  const lines = doc.splitTextToSize(corps, W - 50);
  doc.text(lines, 25, y, { lineHeightFactor: 1.45 });
  y += lines.length * 6.4;
  const ys = Math.min(Math.max(y + 10, 200), 250);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(20, 32, 51);
  doc.text(`Fait à ${ECOLE.ville}, le ${dlong(todayIso())}`, W - 15, ys, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(ECOLE.direction, W - 50, ys + 10, { align: "center" });
  doc.save(`Invitation_examen_${slug(a.niveau)}_${slug(a.matricule || a.nom)}.pdf`);
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
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
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
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const logo = await loadLogo();
  const L = 20, R = 190, W = R - L;
  const reussi = a.statut === "reussi";
  const modules = a.modules || [];
  const ratts = modules.filter((m) => m.ratt);
  const initial = modules.reduce((s, m) => s + m.pts, 0);
  const total = ratts.length ? initial : a.note != null && a.note !== "" ? Number(a.note) : initial; // tableau = examen initial
  const final = a.note != null && a.note !== "" ? Number(a.note) : total;
  const max = modules.reduce((s, m) => s + m.max, 0) || 80;
  const reussiInitial = ratts.length ? total / max >= 0.6 : reussi; // le tableau reste celui de l'examen initial
  const pct = (p, m) => ((p / m) * 100).toFixed(1) + "%";
  const jmy = a.date_examen ? a.date_examen.split("-").reverse().join(".") : "";
  const epreuve = a.epreuve || "";
  // « Hören » est écrit « Horen » sur les relevés remis aux candidats
  const nomModule = (m) => String(m);
  const jr = a.rattrapage || ""; // date du rattrapage (relevé définitif)

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
  doc.text([a.rang ? `Rang : ${a.rang}` : "", jmy ? `Date de l'épreuve : ${jmy}` : "", jr ? `Rattrapage : ${jr}` : ""].filter(Boolean).join(" | "), L + 6, 102.2);

  // tableau
  const X = [20, 59.8, 94.9, 125.1, 149.9, 190];
  const cx = (i) => (X[i] + X[i + 1]) / 2;
  let y = 115.5;
  doc.setFillColor(...NOIR); doc.rect(L, y, W, 12.7, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text("Module", X[0] + 4, y + 7.8);
  ["Points obtenus", "Maximum", "%", "Résultat"].forEach((t, i) => doc.text(t, cx(i + 1), y + 7.8, { align: "center" }));
  y += 12.7;
  const rowH = Math.min(13.9, (201.5 - y - 14.7) / Math.max(modules.length, 1)); // 5 modules : lignes plus compactes
  modules.forEach((m, i) => {
    doc.setFillColor(...(i % 2 ? [244, 244, 244] : [255, 255, 255])); doc.rect(L, y, W, rowH, "F");
    doc.setDrawColor(221, 221, 221); doc.setLineWidth(0.25); doc.rect(L, y, W, rowH);
    X.slice(1, -1).forEach((x) => doc.line(x, y, x, y + rowH));
    const ok = !m.ratt ? moduleValide(m) : m.pts / m.max >= 0.5, by = y + rowH / 2 + 1.4; // le tableau reste celui de l'examen initial
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
  doc.setFont("helvetica", "bold"); doc.setTextColor(...(reussiInitial ? [46, 204, 113] : [231, 76, 60]));
  doc.text(reussiInitial ? "VALIDÉ" : "ECHOUÉ", cx(4), ty, { align: "center" });

  // encadré résultat
  const by0 = 205.5;
  doc.setFillColor(...(reussi ? [236, 253, 243] : [253, 237, 236])); doc.setDrawColor(...(reussi ? VERT : ROUGE)); doc.setLineWidth(0.6);
  doc.rect(L, by0, W, 24, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...(reussi ? VERT : ROUGE));
  doc.text(reussi ? `REUSSI${ratts.length ? " APRES RATTRAPAGE" : ""} — Niveau ${a.niveau} validé` : `ECHOUÉ — Niveau ${a.niveau} non validé`, 105, by0 + 9.4, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Score total : ${fpts(final)}/${max} (${pct(final, max)}) | Mention : ${a.mention || ""}`, 105, by0 + 16.6, { align: "center" });
  if (ratts.length) {
    doc.setFontSize(8); doc.setTextColor(110, 110, 110);
    doc.text(`Rattrapage : ${ratts.map((m) => `${nomModule(m.m)} ${fpts(m.ratt.pts)}/${m.ratt.max}`).join("  •  ")}  (barème initial ramené au prorata)`, 105, by0 + 29, { align: "center" });
  }

  // signature + pied de page
  doc.setFontSize(8.5); doc.setTextColor(140, 140, 140);
  doc.text("Signature & Cachet du Directeur du Centre", 105, 245.6, { align: "center" });
  doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.3); doc.line(65, 254.4, 145, 254.4);
  doc.setDrawColor(220, 220, 220); doc.line(22.3, 265.4, 187.7, 265.4);
  doc.setFontSize(7.5); doc.setTextColor(170, 170, 170);
  doc.text(`REISETÜR 237 Language Center | Abschlussprüfung Deutsch ${a.niveau}${epreuve ? " | " + epreuve : ""}${jr || jmy ? " | " + (jr || jmy) : ""}`, 105, 269.2, { align: "center" });

  doc.save(`Releve_${slug(a.niveau)}_${slug(a.nom)}.pdf`);
}
