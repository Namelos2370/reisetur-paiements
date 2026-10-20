import { useState } from "react";
import { sb, q } from "../supabase.js";
import { fcfa, fdate, fdatetime, TYPE } from "../utils.js";
import { Badge, useAction } from "../components/ui.jsx";

export default function Verifier() {
  const [run, busy] = useAction();
  const [num, setNum] = useState("");
  const [res, setRes] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    run(async () => setRes(await q(sb.rpc("verifier_recu", { p_numero: num }))));
  };

  return (
    <>
      <h2>Vérifier un reçu</h2>
      <form className="card" onSubmit={submit}>
        <label htmlFor="v-n">N° de reçu ou référence bancaire</label>
        <input id="v-n" placeholder="RT237-2026-0001" required autoComplete="off" value={num} onChange={(e) => setNum(e.target.value)} />
        <button className="primary block" disabled={busy}>Vérifier</button>
      </form>

      {res && res.length === 0 && (
        <div className="card"><Badge def={["Introuvable", "bad"]} /><p>Aucun encaissement ne porte ce numéro.</p></div>
      )}
      {res?.map((x) => (
        <div key={x.numero_recu} className={"card" + (x.statut === "valide" ? " success" : "")}>
          <div className="recu-big">{x.numero_recu}</div>
          <Badge def={x.statut === "valide" ? ["Valide", "ok"] : ["Rejeté", "bad"]} />
          <table style={{ marginTop: 14 }}>
            <tbody>
              <tr><td>Étudiant</td><td><b>{x.etudiant_nom}</b> ({x.niveau})</td></tr>
              <tr><td>Objet</td><td>{TYPE[x.type_frais]} — tranche {x.tranche_numero}</td></tr>
              <tr><td>Montant</td><td><b>{fcfa(x.montant)}</b></td></tr>
              <tr><td>Date du versement</td><td>{fdate(x.date_paiement)}</td></tr>
              <tr><td>Réf. bancaire</td><td>{x.reference_banque || "—"}</td></tr>
              <tr><td>Enregistré le</td><td>{fdatetime(x.created_at)}</td></tr>
              {x.motif && <tr><td>Motif</td><td>{x.motif}</td></tr>}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
