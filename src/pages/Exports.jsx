import { useState } from "react";
import { sb, q } from "../supabase.js";
import { today } from "../utils.js";
import { Loading, useAction, useLoad, useToast } from "../components/ui.jsx";

// ---------- Mise en forme ----------
const H = (v) => ({ value: v, fontWeight: "bold", backgroundColor: "#0b3d91", textColor: "#ffffff", align: "center", alignVertical: "center" });
const T = (v) => ({ value: v, fontWeight: "bold", backgroundColor: "#e7eefb" });
const N = (v, bold) => ({ value: Number(v || 0), type: Number, format: "#,##0", ...(bold ? { fontWeight: "bold", backgroundColor: "#e7eefb" } : {}) });
const S = (v) => ({ value: v == null ? "" : String(v), type: String });

const TYPE = { inscription: "Inscription", scolarite: "Scolarité" };
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisLabel = (ym) => { const [y, m] = ym.split("-"); return `${MOIS[+m - 1]} ${y}`; };
const nomFeuille = (s, used) => {
  let base = String(s || "Sans classe").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Feuille";
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) n = base.slice(0, 28) + " " + i++;
  used.add(n.toLowerCase());
  return n;
};

// ---------- Données ----------
async function chargerBase() {
  const [etus, trs] = await Promise.all([
    q(sb.from("etudiants").select("*").order("nom")),
    q(sb.from("v_tranches").select("*")),
  ]);
  const by = {};
  trs.forEach((t) => (by[t.etudiant_id] ||= []).push(t));
  const somme = (a, k) => a.reduce((s, t) => s + t[k], 0);
  return etus.map((e) => {
    const ts = by[e.id] || [];
    const ins = ts.filter((t) => t.type === "inscription");
    const sco = ts.filter((t) => t.type === "scolarite").sort((a, b) => a.numero - b.numero);
    const attendu = somme(ts, "montant_du"), paye = somme(ts, "paye"), aval = somme(ts, "a_valider");
    return {
      matricule: e.matricule, nom: e.nom, classe: e.classe || "", niveau: e.niveau, tel: e.telephone || "",
      insAtt: somme(ins, "montant_du"), insPaye: somme(ins, "paye"),
      scoAtt: somme(sco, "montant_du"), t1: sco[0]?.paye || 0, t2: sco[1]?.paye || 0,
      paye, aval, attendu, solde: attendu - paye,
      statut: attendu > 0 && paye >= attendu ? "Soldé" : paye > 0 ? "Partiel" : aval > 0 ? "À valider" : "Non payé",
    };
  });
}

async function chargerEncaissements() {
  const [encs, trs] = await Promise.all([
    q(sb.from("encaissements").select("*").eq("statut", "valide").order("date_paiement")),
    q(sb.from("v_tranches").select("id,etudiant_nom,etudiant_classe,type,numero")),
  ]);
  const by = Object.fromEntries(trs.map((t) => [t.id, t]));
  return encs.map((c) => {
    const t = by[c.tranche_id] || {};
    return { ...c, nom: t.etudiant_nom || "", classe: t.etudiant_classe || "", type: t.type, tranche: t.numero };
  });
}

// ---------- Feuilles ----------
function feuilleEtudiants(rows, { avecClasse, titreTotal }) {
  const head = [
    ...(avecClasse ? ["Classe"] : ["N°"]),
    "Matricule", "Nom et prénom(s)", "Niveau", "Téléphone",
    "Inscription attendue", "Inscription payée", "Scolarité attendue", "Scolarité T1 payée", "Scolarité T2 payée",
    "Total payé (validé)", "À valider", "Total attendu", "Solde restant", "Statut",
  ];
  const tot = (k) => rows.reduce((s, r) => s + r[k], 0);
  const data = [head.map(H)];
  rows.forEach((r, i) => data.push([
    avecClasse ? S(r.classe) : N(i + 1),
    S(r.matricule), S(r.nom), S(r.niveau), S(r.tel),
    N(r.insAtt), N(r.insPaye), N(r.scoAtt), N(r.t1), N(r.t2),
    N(r.paye), N(r.aval), N(r.attendu), N(r.solde), S(r.statut),
  ]));
  const pct = tot("attendu") ? Math.round((tot("paye") / tot("attendu")) * 100) : 0;
  data.push([
    T(titreTotal), T(""), T(""), T(""), T(""),
    N(tot("insAtt"), 1), N(tot("insPaye"), 1), N(tot("scoAtt"), 1), N(tot("t1"), 1), N(tot("t2"), 1),
    N(tot("paye"), 1), N(tot("aval"), 1), N(tot("attendu"), 1), N(tot("solde"), 1), T(`${pct}% recouvré`),
  ]);
  const columns = [{ width: avecClasse ? 22 : 6 }, { width: 15 }, { width: 34 }, { width: 8 }, { width: 15 }, ...Array(9).fill({ width: 16 }), { width: 16 }];
  return { data, columns, stickyRowsCount: 1 };
}

function feuilleResume(rows) {
  const parClasse = {};
  rows.forEach((r) => (parClasse[r.classe || "Sans classe"] ||= []).push(r));
  const head = ["Classe", "Effectif", "Total attendu", "Total payé (validé)", "À valider", "Solde restant", "% recouvré"];
  const data = [head.map(H)];
  let g = { n: 0, att: 0, pay: 0, av: 0, sol: 0 };
  Object.keys(parClasse).sort().forEach((c) => {
    const l = parClasse[c];
    const att = l.reduce((s, r) => s + r.attendu, 0), pay = l.reduce((s, r) => s + r.paye, 0);
    const av = l.reduce((s, r) => s + r.aval, 0), sol = l.reduce((s, r) => s + r.solde, 0);
    data.push([S(c), N(l.length), N(att), N(pay), N(av), N(sol), S(att ? Math.round((pay / att) * 100) + "%" : "-")]);
    g = { n: g.n + l.length, att: g.att + att, pay: g.pay + pay, av: g.av + av, sol: g.sol + sol };
  });
  data.push([T("TOTAL"), N(g.n, 1), N(g.att, 1), N(g.pay, 1), N(g.av, 1), N(g.sol, 1), T(g.att ? Math.round((g.pay / g.att) * 100) + "%" : "-")]);
  return { data, columns: [{ width: 26 }, ...Array(6).fill({ width: 18 })], stickyRowsCount: 1 };
}

function feuilleEncaissements(list) {
  const head = ["Date", "N° de reçu", "Référence bancaire", "Étudiant", "Classe", "Objet", "Montant (FCFA)"];
  const data = [head.map(H)];
  list.forEach((c) => data.push([
    S(c.date_paiement), S(c.numero_recu), S(c.reference_banque), S(c.nom), S(c.classe),
    S(c.type === "inscription" ? "Inscription" : `${TYPE[c.type] || ""} T${c.tranche || ""}`), N(c.montant),
  ]));
  data.push([T("TOTAL"), T(`${list.length} paiement(s)`), T(""), T(""), T(""), T(""), N(list.reduce((s, c) => s + c.montant, 0), 1)]);
  return { data, columns: [{ width: 12 }, { width: 18 }, { width: 20 }, { width: 34 }, { width: 22 }, { width: 22 }, { width: 18 }], stickyRowsCount: 1 };
}

function feuilleMois(encs) {
  const par = {};
  encs.forEach((c) => { const m = c.date_paiement.slice(0, 7); (par[m] ||= { n: 0, t: 0 }); par[m].n++; par[m].t += c.montant; });
  const data = [["Mois", "Nombre de paiements", "Total encaissé (FCFA)"].map(H)];
  Object.keys(par).sort().forEach((m) => data.push([S(moisLabel(m)), N(par[m].n), N(par[m].t)]));
  data.push([T("TOTAL"), N(encs.length, 1), N(encs.reduce((s, c) => s + c.montant, 0), 1)]);
  return { data, columns: [{ width: 22 }, { width: 22 }, { width: 24 }], stickyRowsCount: 1 };
}

async function ecrire(feuilles, fichier) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  await writeExcelFile(feuilles.map(({ nom, ...f }) => ({ sheet: nom, ...f }))).toFile(fichier);
}

// ---------- Page ----------
export default function Exports() {
  const notify = useToast();
  const [run, busy] = useAction();
  const base = useLoad(chargerBase, []);
  const [classe, setClasse] = useState("");
  const [mois, setMois] = useState(today().slice(0, 7));

  if (!base.data) return <Loading state={base} />;
  const rows = base.data;
  const classes = [...new Set(rows.map((r) => r.classe).filter(Boolean))].sort();
  const suffixe = today();

  const global = () => run(async () => {
    const used = new Set();
    await ecrire([
      { nom: nomFeuille("Global", used), ...feuilleEtudiants(rows, { avecClasse: true, titreTotal: "TOTAL GÉNÉRAL" }) },
      { nom: nomFeuille("Résumé par classe", used), ...feuilleResume(rows) },
    ], `Reisetur237_Global_${suffixe}.xlsx`);
    notify("Export global téléchargé.");
  });

  const parClasse = () => run(async () => {
    const choix = classe ? [classe] : classes;
    const used = new Set();
    const feuilles = choix.map((c) => ({
      nom: nomFeuille(c, used),
      ...feuilleEtudiants(rows.filter((r) => r.classe === c), { avecClasse: false, titreTotal: "TOTAL CLASSE" }),
    }));
    const sans = rows.filter((r) => !r.classe);
    if (!classe && sans.length) feuilles.push({ nom: nomFeuille("Sans classe", used), ...feuilleEtudiants(sans, { avecClasse: false, titreTotal: "TOTAL" }) });
    if (!classe) feuilles.push({ nom: nomFeuille("Résumé", used), ...feuilleResume(rows) });
    await ecrire(feuilles, classe ? `Reisetur237_${classe.replace(/\s+/g, "_")}_${suffixe}.xlsx` : `Reisetur237_Par_classe_${suffixe}.xlsx`);
    notify("Export par classe téléchargé.");
  });

  const parMois = (tous) => run(async () => {
    const encs = await chargerEncaissements();
    if (!tous) {
      const l = encs.filter((c) => c.date_paiement.startsWith(mois));
      if (!l.length) return notify(`Aucun encaissement validé en ${moisLabel(mois)}.`, true);
      await ecrire([{ nom: nomFeuille(moisLabel(mois), new Set()), ...feuilleEncaissements(l) }], `Reisetur237_Encaissements_${mois}.xlsx`);
    } else {
      if (!encs.length) return notify("Aucun encaissement validé pour le moment.", true);
      const used = new Set();
      await ecrire([
        { nom: nomFeuille("Récapitulatif par mois", used), ...feuilleMois(encs) },
        { nom: nomFeuille("Tous les encaissements", used), ...feuilleEncaissements(encs) },
      ], `Reisetur237_Encaissements_par_mois_${suffixe}.xlsx`);
    }
    notify("Export par mois téléchargé.");
  });

  return (
    <>
      <h2>Exports Excel</h2>
      <p className="muted">
        Les montants « payés » ne comptent que les paiements validés ; les paiements en attente de validation sont indiqués à part (« À valider »).
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Global</h3>
        <p className="muted">Tous les étudiants avec leurs frais, paiements et soldes, plus un résumé par classe.</p>
        <button className="primary" disabled={busy} onClick={global}>Télécharger l'export global</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Par classe</h3>
        <p className="muted">Une feuille par classe, avec le total de la classe en bas.</p>
        <div className="row">
          <select value={classe} onChange={(e) => setClasse(e.target.value)}>
            <option value="">Toutes les classes (une feuille chacune)</option>
            {classes.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div><button className="primary" disabled={busy} onClick={parClasse}>Télécharger</button></div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Par mois</h3>
        <p className="muted">Les encaissements validés : un mois précis, ou tous les mois avec un récapitulatif.</p>
        <div className="row">
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
          <div className="actions">
            <button className="primary" disabled={busy || !mois} onClick={() => parMois(false)}>Ce mois</button>
            <button disabled={busy} onClick={() => parMois(true)}>Tous les mois</button>
          </div>
        </div>
      </div>
    </>
  );
}
