import { sb, q } from "../supabase.js";
import { fdatetime } from "../utils.js";
import { Loading, useLoad } from "../components/ui.jsx";

const ACT = { INSERT: "Création", UPDATE: "Modification", DELETE: "Suppression" };
const TBL = { etudiants: "Étudiant", frais: "Frais", tranches: "Tranche", encaissements: "Encaissement" };

const resume = (r) =>
  String(r.detail?.numero_recu || r.detail?.apres?.numero_recu || r.detail?.nom || r.detail?.apres?.nom || r.row_id || "").slice(0, 40);

export default function Journal() {
  const st = useLoad(() => q(sb.from("journal_audit").select("*").order("id", { ascending: false }).limit(200)), []);
  if (!st.data) return <Loading state={st} />;

  return (
    <>
      <h2>Journal d'audit</h2>
      <p className="muted">Historique inaltérable des 200 dernières actions.</p>
      <div className="card tablewrap">
        <table>
          <thead><tr><th>Date</th><th>Objet</th><th>Action</th><th>Détail</th></tr></thead>
          <tbody>
            {st.data.map((r) => (
              <tr key={r.id}>
                <td>{fdatetime(r.created_at)}</td>
                <td>{TBL[r.table_name] || r.table_name}</td>
                <td>{ACT[r.action] || r.action}</td>
                <td>
                  <details>
                    <summary>{resume(r)}</summary>
                    <pre>{JSON.stringify(r.detail, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!st.data.length && <p className="muted">Aucune action enregistrée.</p>}
      </div>
    </>
  );
}
