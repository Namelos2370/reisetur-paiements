import { useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { sb, q } from "../supabase.js";
import { useAction, useToast } from "./ui.jsx";

const NIVEAUX = ["A1", "A2", "B1", "B2", "C1"];
const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Lecture CSV simple (séparateur , ou ; détecté, guillemets gérés)
function parseCsv(text) {
  const first = text.split(/\r?\n/)[0] || "";
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function guess(headers, patterns) {
  const i = headers.findIndex((h) => patterns.some((p) => norm(h).includes(p)));
  return i; // -1 si introuvable
}

export default function ImportEtudiants({ onDone }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null); // lignes de données (sans l'en-tête)
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({ nom: -1, tel: -1, niveau: -1 });
  const [defNiveau, setDefNiveau] = useState("A1");
  const [fileName, setFileName] = useState("");

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    run(async () => {
      let data;
      if (/\.(csv|txt)$/i.test(f.name)) data = parseCsv(await f.text());
      else if (/\.xlsx$/i.test(f.name)) data = await readSheet(f);
      else throw new Error("Format non pris en charge : utilise un fichier .xlsx ou .csv (pour un .xls, enregistre-le d'abord en .xlsx).");
      data = data.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
      if (data.length < 2) throw new Error("Le fichier ne contient aucune ligne de données.");
      const h = data[0].map((c) => String(c ?? "").trim());
      setHeaders(h);
      setRows(data.slice(1));
      setFileName(f.name);
      setMap({
        nom: guess(h, ["nom", "name", "etudiant", "candidat", "prenom"]),
        tel: guess(h, ["tel", "phone", "contact", "whatsapp"]),
        niveau: guess(h, ["niveau", "level"]),
      });
    });
  };

  // Lignes interprétées
  const parsed = (rows || []).map((r) => {
    const nom = map.nom >= 0 ? String(r[map.nom] ?? "").replace(/\s+/g, " ").trim() : "";
    const tel = map.tel >= 0 ? String(r[map.tel] ?? "").trim() : "";
    const raw = map.niveau >= 0 ? String(r[map.niveau] ?? "").toUpperCase().replace(/\s/g, "") : "";
    const niveau = NIVEAUX.includes(raw) ? raw : defNiveau;
    return { nom, telephone: tel || null, niveau };
  }).filter((x) => x.nom);

  const submit = () =>
    run(async () => {
      const existants = await q(sb.from("etudiants").select("nom"));
      const connus = new Set(existants.map((e) => norm(e.nom)));
      const aAjouter = [];
      let doublons = 0;
      for (const p of parsed) {
        const k = norm(p.nom);
        if (connus.has(k)) { doublons++; continue; }
        connus.add(k);
        aAjouter.push(p);
      }
      for (let i = 0; i < aAjouter.length; i += 200)
        await q(sb.from("etudiants").insert(aAjouter.slice(i, i + 200)));
      notify(`${aAjouter.length} étudiant(s) importé(s)` + (doublons ? `, ${doublons} déjà présent(s) ignoré(s).` : "."));
      setRows(null); setOpen(false);
      onDone();
    });

  if (!open)
    return (
      <div className="card between">
        <div><b>Importer depuis Excel</b><br /><span className="muted">Ajoute tous les étudiants d'un coup (.xlsx ou .csv).</span></div>
        <button className="primary" onClick={() => setOpen(true)}>Importer un fichier</button>
      </div>
    );

  const sel = (k) => (
    <select value={map[k]} onChange={(e) => setMap((m) => ({ ...m, [k]: +e.target.value }))}>
      <option value={-1}>— Aucune —</option>
      {headers.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
    </select>
  );

  return (
    <div className="card">
      <div className="between">
        <h3 style={{ marginTop: 0 }}>Importer depuis Excel</h3>
        <button className="small" onClick={() => { setOpen(false); setRows(null); }}>Fermer</button>
      </div>
      <p className="muted">La première ligne doit contenir les titres des colonnes.</p>
      <input type="file" accept=".xlsx,.csv,.txt" onChange={onFile} />

      {rows && (
        <>
          <p className="muted" style={{ marginTop: 14 }}>{fileName} — {rows.length} ligne(s) lue(s)</p>
          <div className="row">
            <div><label>Colonne du nom *</label>{sel("nom")}</div>
            <div><label>Colonne du téléphone</label>{sel("tel")}</div>
          </div>
          <div className="row">
            <div><label>Colonne du niveau</label>{sel("niveau")}</div>
            <div>
              <label>Niveau par défaut <span className="muted">(si vide ou inconnu)</span></label>
              <select value={defNiveau} onChange={(e) => setDefNiveau(e.target.value)}>
                {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <h3>Aperçu ({parsed.length} étudiant(s) à importer)</h3>
          {map.nom < 0 ? (
            <p className="badge bad">Choisis la colonne du nom.</p>
          ) : (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Nom</th><th>Téléphone</th><th>Niveau</th></tr></thead>
                <tbody>
                  {parsed.slice(0, 8).map((p, i) => (
                    <tr key={i}><td>{p.nom}</td><td>{p.telephone || "—"}</td><td>{p.niveau}</td></tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 8 && <p className="muted">… et {parsed.length - 8} autre(s).</p>}
            </div>
          )}
          <p className="muted">Les noms déjà présents dans la base sont ignorés (pas de doublons).</p>
          <button className="primary block" disabled={busy || map.nom < 0 || !parsed.length} onClick={submit}>
            Importer {parsed.length} étudiant(s)
          </button>
        </>
      )}
    </div>
  );
}
