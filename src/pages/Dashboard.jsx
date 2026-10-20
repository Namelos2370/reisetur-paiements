import { sb, q } from "../supabase.js";
import { fcfa, fdate, nombre, TYPE } from "../utils.js";
import { Loading, useLoad } from "../components/ui.jsx";

export default function Dashboard({ onValider }) {
  const st = useLoad(
    async () => {
      const [d, retards] = await Promise.all([
        q(sb.rpc("tableau_de_bord")),
        q(sb.from("v_tranches").select("*").eq("statut", "en_retard").order("date_limite")),
      ]);
      return { d, retards };
    },
    []
  );
  if (!st.data) return <Loading state={st} />;

  const { d, retards } = st.data;
  const reste = d.total_attendu - d.total_valide;
  const max = Math.max(1, ...d.par_mois.map((m) => m.total));

  return (
    <>
      <h2>Tableau de bord</h2>
      <div className="grid">
        <div className="stat"><div className="l">Total encaissé (validé)</div><div className="v">{fcfa(d.total_valide)}</div></div>
        <div className="stat"><div className="l">Reste à encaisser</div><div className="v">{fcfa(reste)}</div></div>
        <div className="stat"><div className="l">Encaissé ce mois</div><div className="v">{fcfa(d.valide_ce_mois)}</div></div>
        <div className="stat">
          <div className="l">Tranches en retard</div>
          <div className="v">{d.nb_tranches_en_retard}</div>
          <div className="muted">{fcfa(d.montant_en_retard)}</div>
        </div>
        <div className="stat">
          <div className="l">Paiements à valider</div>
          <div className="v">{d.nb_a_valider}</div>
          <div className="muted">{fcfa(d.montant_a_valider)}</div>
          {d.nb_a_valider > 0 && <button className="small primary" style={{ marginTop: 8 }} onClick={onValider}>Valider</button>}
        </div>
        <div className="stat"><div className="l">Étudiants</div><div className="v">{d.nb_etudiants}</div></div>
      </div>

      <h3>Encaissements des 6 derniers mois</h3>
      <div className="card">
        {d.par_mois.length ? (
          <div className="bars">
            {d.par_mois.map((m) => (
              <div className="bar" key={m.mois}>
                <span>{nombre(m.total)}</span>
                <i style={{ height: Math.round((m.total / max) * 100) + "%" }} />
                <b>{m.mois}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Aucun encaissement validé pour le moment.</p>
        )}
      </div>

      <h3>Impayés en retard</h3>
      <div className="card tablewrap">
        {retards.length ? (
          <table>
            <thead><tr><th>Étudiant</th><th>Frais</th><th>Échéance</th><th>Reste</th></tr></thead>
            <tbody>
              {retards.map((r) => (
                <tr key={r.id}>
                  <td>{r.etudiant_nom}</td>
                  <td>{TYPE[r.type]} — tranche {r.numero}</td>
                  <td>{fdate(r.date_limite)}</td>
                  <td><b>{fcfa(r.solde)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucun retard.</p>
        )}
      </div>
    </>
  );
}
