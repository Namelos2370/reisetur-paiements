import { useState } from "react";
import { sb, q } from "../supabase.js";
import { fcfa, fdate } from "../utils.js";
import { chargerRelances, messageWhatsApp, waLink, waNumber } from "../data.js";
import { notesPdf } from "../pdf.js";
import { Badge, Loading, useAction, useLoad, useToast } from "../components/ui.jsx";

export default function Relances() {
  const notify = useToast();
  const [run, busy] = useAction();
  const st = useLoad(chargerRelances, []);
  const [search, setSearch] = useState("");
  const [classe, setClasse] = useState("");
  const [filtre, setFiltre] = useState("tous"); // tous | retard | avenir

  if (!st.data) return <Loading state={st} />;

  const classes = [...new Set(st.data.map((s) => s.classe).filter(Boolean))].sort();
  const list = st.data.filter(
    (s) =>
      s.nom.toLowerCase().includes(search.toLowerCase()) &&
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
        Étudiants qui ont encore un montant à payer. Les paiements déjà saisis mais pas encore validés ne sont pas comptés.
      </p>

      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Rechercher un étudiant…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <td><b>{s.nom}</b><br /><span className="muted">{s.classe || "—"}</span></td>
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
    </>
  );
}
