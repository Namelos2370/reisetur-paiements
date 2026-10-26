import { useState } from "react";
import { sb, q } from "../supabase.js";
import { fcfa, fdate, fdatetime, modeLabel, TYPE } from "../utils.js";
import { Badge, Loading, useLoad } from "../components/ui.jsx";

// Journal d'audit lisible : chaque ligne technique est traduite en une phrase claire.
const PAGE = 400;

const CATEGORIES = [
  ["", "Tout"],
  ["paiements", "Paiements"],
  ["frais", "Frais et tranches"],
  ["etudiants", "Étudiants"],
  ["centre", "Centre et paramètres"],
];
const CATEGORIE = {
  encaissements: "paiements", frais: "frais", tranches: "frais", etudiants: "etudiants", parcours: "etudiants",
  ecole_parametres: "centre", tarifs_niveau: "centre", classes_infos: "centre", annonces: "centre", documents: "centre", resultats: "etudiants",
};
const ACTIONS = [["", "Toutes les actions"], ["INSERT", "Ajouts"], ["UPDATE", "Modifications"], ["DELETE", "Suppressions"]];

const IGNORE = new Set(["id", "created_at", "updated_at", "created_by", "source", "etudiant_id", "frais_id", "tranche_id", "bordereau_path", "date_debut", "date_fin"]);
const LABEL = {
  nom: "nom", telephone: "téléphone", niveau: "niveau", classe: "classe", email: "e-mail", ville: "ville",
  montant: "montant", montant_du: "montant dû", montant_total: "montant total", date_limite: "échéance", statut: "statut",
  numero_recu: "n° de reçu", reference_banque: "référence", mode_paiement: "mode de paiement", date_paiement: "date du versement", motif: "motif",
  scolarite_t1: "tranche 1", scolarite_t2: "tranche 2", sous_titre: "sous-titre", adresse: "adresse", contact: "contact", whatsapp: "WhatsApp",
  instructions_paiement: "« Comment payer »", direction: "signature", directeur: "signataire", horaires: "horaires", salle: "salle",
  debut: "début", fin: "fin", examen: "examen", formateur: "formateur", titre: "titre", message: "message", actif: "affichage",
};
const STATUT = { en_attente: "à valider", valide: "validé", rejete: "rejeté/annulé" };

const estMontant = (k) => k.startsWith("montant") || k.startsWith("scolarite_");
const estDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
function fmt(k, v) {
  if (v === null || v === undefined || v === "") return "—";
  if (k === "statut") return STATUT[v] || v;
  if (k === "mode_paiement") return modeLabel(v);
  if (estMontant(k) && typeof v === "number") return fcfa(v);
  if (estDate(v)) return fdate(v);
  if (typeof v === "boolean") return v ? "oui" : "non";
  return String(v);
}

// Champs réellement modifiés
function changements(avant = {}, apres = {}) {
  return Object.keys(apres)
    .filter((k) => !IGNORE.has(k) && JSON.stringify(avant[k]) !== JSON.stringify(apres[k]))
    .map((k) => ({ k, de: avant[k], vers: apres[k] }));
}

function decrire(r, ctx) {
  const d = r.detail || {};
  const ap = r.action === "UPDATE" ? d.apres || {} : r.action === "DELETE" ? d : d;
  const av = r.action === "UPDATE" ? d.avant || {} : {};
  const t = r.table_name;
  const verbe = { INSERT: "ajouté", UPDATE: "modifié", DELETE: "supprimé" }[r.action] || r.action;
  let sujet = "";
  let phrase = "";
  let tone = "neutral";
  let infos = [];

  if (t === "etudiants") {
    sujet = ap.nom || "";
    if (r.action === "INSERT") { phrase = `Étudiant ajouté${ap.classe ? ` en ${ap.classe}` : ""}${ap.niveau ? ` (${ap.niveau})` : ""}`; tone = "ok"; }
    else if (r.action === "DELETE") { phrase = "Étudiant supprimé"; tone = "bad"; }
    else {
      const ch = changements(av, ap);
      const code = av.code_acces !== ap.code_acces;
      infos = ch.filter((c) => c.k !== "code_acces");
      phrase = code && !infos.length ? "Nouveau code d'accès généré" : infos.length ? `Fiche étudiant modifiée (${infos.map((c) => LABEL[c.k] || c.k).join(", ")})` : "Fiche étudiant mise à jour";
    }
  } else if (t === "frais" || t === "tranches") {
    const f = t === "frais" ? { id: ap.id, nom: ctx.etus[ap.etudiant_id]?.nom, type: ap.type } : ctx.frais[ap.frais_id] || {};
    sujet = f.nom || ctx.etus[ap.etudiant_id]?.nom || "";
    const obj = t === "frais" ? `Frais ${TYPE[f.type]?.toLowerCase() || ""}` : `Tranche ${ap.numero} (${TYPE[f.type]?.toLowerCase() || "frais"})`;
    if (r.action === "INSERT") { phrase = `${obj} créé${t === "frais" ? "s" : "e"}${ap.montant_total ? ` : ${fcfa(ap.montant_total)}` : ap.montant_du != null ? ` : ${fcfa(ap.montant_du)}, échéance ${fdate(ap.date_limite)}` : ""}`; tone = "ok"; }
    else if (r.action === "DELETE") { phrase = `${obj} supprimé${t === "frais" ? "s" : "e"}`; tone = "bad"; }
    else {
      infos = changements(av, ap);
      phrase = `${obj} modifié${t === "frais" ? "s" : "e"}`;
      tone = "warn";
    }
  } else if (t === "encaissements") {
    const tr = ctx.tranches[ap.tranche_id] || {};
    sujet = tr.nom || "";
    const obj = `${fcfa(ap.montant)} — ${TYPE[tr.type] || "paiement"}${tr.numero ? ` T${tr.numero}` : ""}`;
    if (r.action === "INSERT") {
      phrase = ap.statut === "valide" ? `Paiement encaissé : ${obj}${ap.numero_recu ? ` (reçu ${ap.numero_recu})` : ""}` : `Paiement enregistré, à valider : ${obj}`;
      tone = ap.statut === "valide" ? "ok" : "warn";
    } else if (r.action === "UPDATE") {
      if (av.statut === "en_attente" && ap.statut === "valide") { phrase = `Paiement validé : ${obj}${ap.numero_recu ? ` (reçu ${ap.numero_recu})` : ""}`; tone = "ok"; }
      else if (ap.statut === "rejete") { phrase = `${av.statut === "valide" ? "Paiement annulé" : "Paiement rejeté"} : ${obj}${ap.numero_recu ? ` (reçu ${ap.numero_recu})` : ""}`; tone = "bad"; infos = ap.motif ? [{ k: "motif", de: null, vers: ap.motif }] : []; }
      else { phrase = `Paiement modifié : ${obj}`; infos = changements(av, ap); }
    } else { phrase = `Paiement supprimé : ${obj}`; tone = "bad"; }
  } else if (t === "ecole_parametres") {
    phrase = "Informations du centre modifiées";
    infos = changements(av, ap);
    if (infos.length) phrase += ` (${infos.map((c) => LABEL[c.k] || c.k).join(", ")})`;
  } else if (t === "tarifs_niveau") {
    phrase = `Tarifs du niveau ${ap.niveau || ""} modifiés`;
    infos = changements(av, ap);
  } else {
    phrase = `${t} ${verbe}`;
    sujet = ap.nom || ap.titre || ap.classe || "";
    infos = r.action === "UPDATE" ? changements(av, ap) : [];
  }
  return { phrase, sujet, tone, infos };
}

export default function Journal() {
  const [limite, setLimite] = useState(PAGE);
  const [categorie, setCategorie] = useState("");
  const [action, setAction] = useState("");
  const [recherche, setRecherche] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");

  const st = useLoad(async () => {
    const [rows, etus, frais, trs] = await Promise.all([
      q(sb.from("journal_audit").select("*").order("id", { ascending: false }).limit(limite)),
      q(sb.from("etudiants").select("id, nom")),
      q(sb.from("v_frais").select("id, etudiant_nom, type")),
      q(sb.from("v_tranches").select("id, etudiant_nom, type, numero")),
    ]);
    return {
      rows,
      ctx: {
        etus: Object.fromEntries(etus.map((e) => [e.id, e])),
        frais: Object.fromEntries(frais.map((f) => [f.id, { nom: f.etudiant_nom, type: f.type }])),
        tranches: Object.fromEntries(trs.map((t) => [t.id, { nom: t.etudiant_nom, type: t.type, numero: t.numero }])),
      },
    };
  }, [limite]);
  if (!st.data) return <Loading state={st} />;

  const lignes = st.data.rows.map((r) => ({ r, ...decrire(r, st.data.ctx) }));
  const rech = recherche.trim().toLowerCase();
  const liste = lignes.filter(({ r, phrase, sujet }) => {
    if (categorie && (CATEGORIE[r.table_name] || "centre") !== categorie) return false;
    if (action && r.action !== action) return false;
    const jour = r.created_at.slice(0, 10);
    if (du && jour < du) return false;
    if (au && jour > au) return false;
    if (rech && !(`${phrase} ${sujet}`.toLowerCase().includes(rech))) return false;
    return true;
  });

  return (
    <>
      <h2>Journal d'audit</h2>
      <p className="muted">Historique inaltérable de toutes les actions : qui est concerné, ce qui a changé, et quand.</p>

      <div className="card">
        <div className="row">
          <input placeholder="Rechercher un étudiant, un n° de reçu…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={action} onChange={(e) => setAction(e.target.value)}>{ACTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div><label htmlFor="jr-du">Du</label><input id="jr-du" type="date" value={du} onChange={(e) => setDu(e.target.value)} /></div>
          <div><label htmlFor="jr-au">Au</label><input id="jr-au" type="date" value={au} onChange={(e) => setAu(e.target.value)} /></div>
        </div>
        <p className="muted" style={{ margin: "12px 0 0" }}>{liste.length} action(s) affichée(s) sur les {st.data.rows.length} plus récentes.</p>
      </div>

      <div className="card tablewrap">
        <table>
          <thead><tr><th>Quand</th><th>Ce qui s'est passé</th><th>Étudiant</th></tr></thead>
          <tbody>
            {liste.map(({ r, phrase, sujet, tone, infos }) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fdatetime(r.created_at)}</td>
                <td>
                  <Badge def={[{ INSERT: "Ajout", UPDATE: "Modification", DELETE: "Suppression" }[r.action] || r.action, tone]} />{" "}
                  <b>{phrase}</b>
                  {infos.length > 0 && (
                    <ul className="jr-ch">
                      {infos.map((c) => (
                        <li key={c.k}>{LABEL[c.k] || c.k} : <span className="muted">{fmt(c.k, c.de)}</span> → <b>{fmt(c.k, c.vers)}</b></li>
                      ))}
                    </ul>
                  )}
                  <details>
                    <summary className="muted">Détail technique</summary>
                    <pre>{JSON.stringify(r.detail, null, 2)}</pre>
                  </details>
                </td>
                <td>{sujet || <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!liste.length && <p className="muted">Aucune action ne correspond à ces filtres.</p>}
        {st.data.rows.length >= limite && (
          <p style={{ margin: "14px 0 0" }}><button className="small" onClick={() => setLimite((n) => n + PAGE)}>Charger les {PAGE} actions précédentes</button></p>
        )}
      </div>
    </>
  );
}
