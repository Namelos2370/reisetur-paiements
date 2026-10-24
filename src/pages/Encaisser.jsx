import { useEffect, useState } from "react";
import { sb, q, avecMode } from "../supabase.js";
import { fcfa, fdate, today, TYPE } from "../utils.js";
import { ChampsMode, Loading, useAction, useLoad, useToast } from "../components/ui.jsx";
import { telechargerRecu } from "../data.js";

export default function Encaisser({ preselect }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const etus = useLoad(() => q(sb.from("etudiants").select("id,nom,niveau,matricule").order("nom")), []);

  const [etuId, setEtuId] = useState(preselect || "");
  const [tranches, setTranches] = useState([]);
  const [trId, setTrId] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(today());
  const [ref, setRef] = useState("");
  const [mode, setMode] = useState("especes");
  const [numero, setNumero] = useState("");
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [last, setLast] = useState(null);

  async function loadTranches(id) {
    if (!id) { setTranches([]); setTrId(""); setMontant(""); return; }
    // "solde" = reste réellement disponible : on retire les paiements déjà saisis mais pas encore validés
    const rows = await q(
      sb.from("v_tranches").select("*").eq("etudiant_id", id).gt("solde", 0).order("frais_id").order("numero")
    );
    const data = rows
      .map((t) => ({ ...t, attente: t.a_valider, solde: t.solde - t.a_valider }))
      .filter((t) => t.solde > 0);
    setTranches(data);
    setTrId(data[0]?.id || "");
    setMontant(data[0] ? String(data[0].solde) : "");
  }

  useEffect(() => { run(() => loadTranches(etuId)); /* eslint-disable-next-line */ }, [etuId]);

  const tranche = tranches.find((t) => t.id === trId);
  const etudiant = etus.data?.find((e) => e.id === etuId);

  const onTranche = (id) => {
    setTrId(id);
    const t = tranches.find((x) => x.id === id);
    if (t) setMontant(String(t.solde));
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const m = parseInt(montant, 10);
      if (!tranche) return notify("Choisis une tranche.", true);
      if (!(m > 0)) return notify("Montant invalide.", true);
      if (m > tranche.solde)
        return notify(`Le montant dépasse le reste à payer (${fcfa(tranche.solde)}).`, true);

      let path = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("bordereaux").upload(path, file, { contentType: file.type });
        if (error) throw error;
      }
      const row = await avecMode((avec) => q(
        sb.from("encaissements")
          .insert({
            tranche_id: tranche.id,
            montant: m,
            date_paiement: date,
            reference_banque: ref.trim() || null,
            ...(avec ? { mode_paiement: mode } : {}),
            numero_recu: numero.trim() || null,
            bordereau_path: path,
            statut: "valide",
          })
          .select()
          .single()
      ));
      setLast({ ...row, etudiant, tranche });
      setRef(""); setNumero(""); setFile(null); setFileKey((k) => k + 1);
      notify("Encaissement validé.");
      await loadTranches(etuId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  if (!etus.data) return <Loading state={etus} />;

  return (
    <>
      <h2>Nouvel encaissement</h2>

      {last && (
        <div className="card success">
          <b>✔ Encaissement validé</b>
          <div className="recu-big">{last.numero_recu}</div>
          <p>
            {last.etudiant.nom} — {TYPE[last.tranche.type]}, tranche {last.tranche.numero} — <b>{fcfa(last.montant)}</b>
            <br />
            <span className="muted">Remets ce numéro de reçu à l'étudiant.</span>
          </p>
          <div className="actions">
            <button className="small" onClick={() => navigator.clipboard?.writeText(last.numero_recu).then(() => notify("Numéro copié."))}>Copier le numéro</button>
            <button className="small primary" disabled={busy} onClick={() => run(() => telechargerRecu(last.id))}>Reçu PDF</button>
          </div>
        </div>
      )}

      <form className="card" onSubmit={submit}>
        <label htmlFor="e-etu">Étudiant</label>
        <select id="e-etu" required value={etuId} onChange={(e) => setEtuId(e.target.value)}>
          <option value="">— Choisir —</option>
          {etus.data.map((e) => <option key={e.id} value={e.id}>{e.nom} ({e.niveau}) — {e.matricule}</option>)}
        </select>

        <label htmlFor="e-tr">Frais et tranche à payer</label>
        <select id="e-tr" required disabled={!tranches.length} value={trId} onChange={(e) => onTranche(e.target.value)}>
          {!etuId && <option value="">Choisis d'abord un étudiant</option>}
          {etuId && !tranches.length && <option value="">Aucune tranche à payer</option>}
          {tranches.map((t) => (
            <option key={t.id} value={t.id}>
              {TYPE[t.type]} — tranche {t.numero} — reste {fcfa(t.solde)}{t.attente > 0 ? ` (+ ${fcfa(t.attente)} à valider)` : ""} (avant le {fdate(t.date_limite)})
            </option>
          ))}
        </select>

        <div className="row">
          <div>
            <label htmlFor="e-mt">Montant versé (FCFA)</label>
            <input id="e-mt" type="number" min="1" step="1" inputMode="numeric" required value={montant} onChange={(e) => setMontant(e.target.value)} />
          </div>
          <div>
            <label htmlFor="e-dt">Date du versement</label>
            <input id="e-dt" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <ChampsMode id="e" mode={mode} setMode={setMode} refVal={ref} setRef={setRef} />
        <label htmlFor="e-nr">N° de reçu <span className="muted">(vide = généré automatiquement)</span></label>
        <input id="e-nr" placeholder="RT237-2026-0001" value={numero} onChange={(e) => setNumero(e.target.value)} />

        <label htmlFor="e-file">Justificatif <span className="muted">(photo du bordereau ou capture du SMS, facultatif)</span></label>
        <input key={fileKey} id="e-file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} />

        <button className="primary block" disabled={busy || !tranche}>Valider l'encaissement</button>
      </form>
    </>
  );
}
