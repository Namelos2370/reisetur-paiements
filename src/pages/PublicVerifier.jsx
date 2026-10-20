import { useState } from "react";
import { sb } from "../supabase.js";
import { ECOLE } from "../config.js";
import { fcfa, fdate, TYPE } from "../utils.js";
import { Badge } from "../components/ui.jsx";

// Page publique (sans connexion) : /verifier?n=RT237-2026-0001
export default function PublicVerifier() {
  const [numero, setNumero] = useState(new URLSearchParams(window.location.search).get("n") || "");
  const [nom, setNom] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null); // null | "introuvable" | objet
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(""); setRes(null);
    const { data, error } = await sb.rpc("verifier_recu_public", { p_numero: numero, p_nom: nom });
    setBusy(false);
    if (error) return setErr("Vérification impossible pour le moment. Réessaie dans un instant.");
    setRes(data?.[0] || "introuvable");
  };

  return (
    <div className="center card">
      <h2 style={{ color: "var(--brand)", marginBottom: 4 }}>{ECOLE.nom}</h2>
      <p className="muted" style={{ marginTop: 0 }}>Vérification d'un reçu de paiement</p>

      <form onSubmit={submit}>
        <label htmlFor="pv-n">N° de reçu</label>
        <input id="pv-n" placeholder="RT237-2026-0001" required autoComplete="off" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <label htmlFor="pv-nom">Nom de l'étudiant</label>
        <input id="pv-nom" placeholder="Tel qu'écrit sur le reçu" required minLength={3} autoComplete="off" value={nom} onChange={(e) => setNom(e.target.value)} />
        <button className="primary block" disabled={busy}>{busy ? "Vérification…" : "Vérifier"}</button>
      </form>

      {err && <p className="badge bad" style={{ marginTop: 16 }}>{err}</p>}

      {res === "introuvable" && (
        <div style={{ marginTop: 20 }}>
          <Badge def={["Aucun reçu ne correspond", "bad"]} />
          <p className="muted">Vérifie le n° de reçu et le nom de l'étudiant (le nom doit correspondre à celui du reçu).</p>
        </div>
      )}

      {res && res !== "introuvable" && res.statut === "rejete" && (
        <div style={{ marginTop: 20 }}>
          <Badge def={["Reçu annulé", "bad"]} />
          <p className="muted">Ce reçu a été annulé par l'administration. Contacte {ECOLE.nom}.</p>
        </div>
      )}

      {res && res !== "introuvable" && res.statut === "valide" && (
        <div className="card success" style={{ marginTop: 20, marginBottom: 0 }}>
          <Badge def={["✔ Reçu authentique", "ok"]} />
          <table style={{ marginTop: 12 }}>
            <tbody>
              <tr><td>Étudiant</td><td><b>{res.etudiant_nom}</b></td></tr>
              {res.classe && <tr><td>Classe</td><td>{res.classe}</td></tr>}
              <tr><td>Objet</td><td>{res.type_frais === "inscription" ? "Inscription" : `${TYPE[res.type_frais]} — tranche ${res.tranche_numero}`}</td></tr>
              <tr><td>Montant</td><td><b>{fcfa(res.montant)}</b></td></tr>
              <tr><td>Date du versement</td><td>{fdate(res.date_paiement)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
