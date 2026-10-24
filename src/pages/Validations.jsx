import { useState } from "react";
import { sb, q, avecMode } from "../supabase.js";
import { fcfa, fdate, today, TYPE } from "../utils.js";
import { Badge, ChampsMode, Loading, Modal, useAction, useLoad, useToast } from "../components/ui.jsx";
import { telechargerRecu } from "../data.js";

function ValiderModal({ item, onClose, onDone }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [date, setDate] = useState(today());
  const [ref, setRef] = useState("");
  const [mode, setMode] = useState(item.mode_paiement || "especes");
  const [numero, setNumero] = useState("");
  const [file, setFile] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      let path = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("bordereaux").upload(path, file, { contentType: file.type });
        if (error) throw error;
      }
      const row = await avecMode((avec) => q(
        sb.from("encaissements")
          .update({
            statut: "valide",
            date_paiement: date,
            reference_banque: ref.trim() || null,
            ...(avec ? { mode_paiement: mode } : {}),
            numero_recu: numero.trim() || null,
            bordereau_path: path,
          })
          .eq("id", item.id)
          .select()
          .single()
      ));
      notify(`Paiement validé — reçu ${row.numero_recu}`);
      onDone({ ...row, nom: item.nom, classe: item.classe, type: item.type, numero: item.numero });
    });
  };

  return (
    <Modal onClose={onClose}>
      <div className="between">
        <h2>Valider le paiement</h2>
        <button className="small" onClick={onClose}>Fermer</button>
      </div>
      <p>
        <b>{item.nom}</b> <span className="muted">({item.classe || "—"})</span><br />
        {TYPE[item.type]}, tranche {item.numero} — <b>{fcfa(item.montant)}</b>
      </p>
      <form onSubmit={submit}>
        <label htmlFor="v-dt">Date du versement</label>
        <input id="v-dt" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <ChampsMode id="v" mode={mode} setMode={setMode} refVal={ref} setRef={setRef} />
        <label htmlFor="v-nr">N° de reçu <span className="muted">(vide = généré automatiquement)</span></label>
        <input id="v-nr" placeholder="RT237-2026-0001" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <label htmlFor="v-file">Justificatif <span className="muted">(photo du bordereau ou capture du SMS, facultatif)</span></label>
        <input id="v-file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
        <button className="primary block" disabled={busy}>Valider ce paiement</button>
      </form>
    </Modal>
  );
}

export default function Validations() {
  const notify = useToast();
  const [run] = useAction();
  const st = useLoad(async () => {
    const [encs, trs] = await Promise.all([
      q(sb.from("encaissements").select("*").eq("statut", "en_attente").order("created_at")),
      q(sb.from("v_tranches").select("id,etudiant_nom,etudiant_classe,type,numero")),
    ]);
    const byId = Object.fromEntries(trs.map((t) => [t.id, t]));
    return encs
      .map((c) => {
        const t = byId[c.tranche_id] || {};
        return { ...c, nom: t.etudiant_nom || "—", classe: t.etudiant_classe, type: t.type, numero: t.numero };
      })
      .sort((a, b) => (a.classe || "").localeCompare(b.classe || "") || a.nom.localeCompare(b.nom));
  }, []);
  const [search, setSearch] = useState("");
  const [classe, setClasse] = useState("");
  const [open, setOpen] = useState(null);
  const [done, setDone] = useState(null);
  const [pdfRun, pdfBusy] = useAction();

  if (!st.data) return <Loading state={st} />;

  const classes = [...new Set(st.data.map((c) => c.classe).filter(Boolean))].sort();
  const list = st.data.filter(
    (c) => c.nom.toLowerCase().includes(search.toLowerCase()) && (!classe || c.classe === classe)
  );
  const total = list.reduce((s, c) => s + c.montant, 0);

  const rejeter = (c) => {
    const motif = window.prompt(`Motif du rejet pour ${c.nom} (obligatoire) :`);
    if (!motif || !motif.trim()) return;
    run(async () => {
      await q(sb.from("encaissements").update({ statut: "rejete", motif: motif.trim() }).eq("id", c.id));
      notify("Paiement rejeté.");
      st.reload();
    });
  };

  return (
    <>
      <h2>Paiements à valider</h2>
      {done && (
        <div className="card success">
          <b>✔ Paiement validé</b>
          <div className="recu-big">{done.numero_recu}</div>
          <p>{done.nom} — {TYPE[done.type]}, tranche {done.numero} — <b>{fcfa(done.montant)}</b><br />
            <span className="muted">Remets ce numéro de reçu à l'étudiant.</span></p>
          <div className="actions">
            <button className="small primary" disabled={pdfBusy} onClick={() => pdfRun(() => telechargerRecu(done.id))}>Reçu PDF</button>
            <button className="small" onClick={() => setDone(null)}>Fermer</button>
          </div>
        </div>
      )}
      <p className="muted">
        Paiements repris du fichier Excel. Valide-les un par un avec le reçu de la banque : ils comptent dans les totaux « encaissé » seulement après validation.
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <input placeholder="Rechercher un étudiant…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={classe} onChange={(e) => setClasse(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="card tablewrap">
        {list.length ? (
          <>
            <table>
              <thead><tr><th>Étudiant</th><th>Objet</th><th>Montant</th><th></th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.nom}</b><br /><span className="muted">{c.classe || "—"}</span></td>
                    <td>{TYPE[c.type]} — tranche {c.numero}</td>
                    <td><b>{fcfa(c.montant)}</b></td>
                    <td className="actions">
                      <button className="small primary" onClick={() => setOpen(c)}>Valider</button>
                      <button className="small danger" onClick={() => rejeter(c)}>Rejeter</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 14 }}>{list.length} paiement(s) — {fcfa(total)}</p>
          </>
        ) : (
          <p className="muted">Aucun paiement en attente de validation.</p>
        )}
      </div>

      {open && <ValiderModal item={open} onClose={() => setOpen(null)} onDone={(row) => { setOpen(null); setDone(row); st.reload(); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
    </>
  );
}
