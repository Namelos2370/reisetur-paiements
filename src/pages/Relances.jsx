import { useState } from "react";
import { sb, q } from "../supabase.js";
import { fcfa, fdate, limiteRappel, fixerLimiteRappel } from "../utils.js";
import { chargerRelances, messageWhatsApp, waLink, waNumber } from "../data.js";
import { notesPdf } from "../pdf.js";
import { Detail } from "./Etudiants.jsx";
import { Badge, Loading, useAction, useLoad, useToast } from "../components/ui.jsx";

export default function Relances({ onEncaisser }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const st = useLoad(chargerRelances, []);
  const [search, setSearch] = useState("");
  const [classe, setClasse] = useState("");
  const [filtre, setFiltre] = useState("tous"); // tous | retard | avenir
  const [open, setOpen] = useState(null);
  const [, maj] = useState(0);

  if (!st.data) return <Loading state={st} />;

  const classes = [...new Set(st.data.map((s) => s.classe).filter(Boolean))].sort();
  const list = st.data.filter(
    (s) =>
      (s.nom + " " + (s.matricule || "")).toLowerCase().includes(search.toLowerCase()) &&
      (!classe || s.classe === classe) &&
      (filtre === "tous" || (filtre === "retard" ? s.enRetard : !s.enRetard))
  );
  const total = list.reduce((s, x) => s + x.total, 0);
  const sansTel = list.filter((s) => !waNumber(s.telephone)).length;

  const whatsapp = (s) => {
    if (!waNumber(s.telephone)) {
      const saisi = window.prompt(`Numéro WhatsApp de ${s.nom} (ex. 690123456) :`);
      if (!saisi) return;
      if (!waNumber(saisi)) return notify("Numéro invalide.", true);
      run(async () => {
        await q(sb.from("etudiants").update({ telephone: saisi.trim() }).eq("id", s.id));
        notify("Numéro enregistré. Clique de nouveau sur WhatsApp.");
        st.reload();
      });
      return;
    }
    window.open(waLink(s.telephone, messageWhatsApp(s)), "_blank", "noopener");
  };

  return (
    <>
      <h2>Relances</h2>
      <p className="muted">
        Clique sur un nom pour ouvrir sa fiche : s'il a payé entre-temps, encaisse son paiement ou régularise sa situation, puis la liste se met à jour. Sinon, envoie le WhatsApp ou imprime la note. Les paiements déjà saisis mais pas encore validés ne sont pas comptés.
      </p>

      <div className="card" style={{ marginBottom: 12 }}>
        <label htmlFor="rl-lim">Date limite indiquée sur les notes et les WhatsApp</label>
        <input id="rl-lim" type="date" value={limiteRappel()} onChange={(e) => { fixerLimiteRappel(e.target.value); maj((n) => n + 1); }} />
        <p className="muted" style={{ margin: "6px 0 0" }}>Les notes réclament tout ce qui est dû à cette date, en une ligne par nature de frais.</p>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Rechercher un nom ou un matricule…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={classe} onChange={(e) => setClasse(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="actions" style={{ marginBottom: 16 }}>
        {[["tous", "Tous"], ["retard", "Échéance dépassée"], ["avenir", "À venir"]].map(([k, label]) => (
          <button key={k} className={"small" + (filtre === k ? " primary" : "")} onClick={() => setFiltre(k)}>{label}</button>
        ))}
        <button
          className="small primary"
          style={{ marginLeft: "auto" }}
          disabled={busy || !list.length}
          onClick={() => run(() => notesPdf(list, classe))}
        >
          Imprimer les notes ({list.length})
        </button>
      </div>

      <div className="card tablewrap">
        {list.length ? (
          <>
            <table>
              <thead><tr><th>Étudiant</th><th>Reste à payer</th><th>Prochaine échéance</th><th></th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td><button className="link" onClick={() => setOpen(s)} title="Ouvrir la fiche : paiements, encaissement, régularisation"><b>{s.nom}</b></button><br /><span className="muted">{s.matricule} · {s.classe || "—"}</span></td>
                    <td><b>{fcfa(s.total)}</b></td>
                    <td>
                      {fdate(s.prochaine)}<br />
                      {s.enRetard ? <Badge def={["Dépassée", "bad"]} /> : <Badge def={["À venir", "neutral"]} />}
                    </td>
                    <td className="actions">
                      <button className="small" onClick={() => whatsapp(s)}>
                        {waNumber(s.telephone) ? "WhatsApp" : "+ N° WhatsApp"}
                      </button>
                      <button className="small" disabled={busy} onClick={() => run(() => notesPdf([s]))}>Note PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 14 }}>
              {list.length} étudiant(s) — {fcfa(total)} à recouvrer
              {sansTel > 0 && ` — ${sansTel} sans numéro WhatsApp`}
            </p>
          </>
        ) : (
          <p className="muted">Aucun étudiant à relancer avec ces filtres.</p>
        )}
      </div>

      {open && <Detail etudiant={open} onClose={() => setOpen(null)} onChanged={st.reload} onEncaisser={onEncaisser} />}
    </>
  );
}
