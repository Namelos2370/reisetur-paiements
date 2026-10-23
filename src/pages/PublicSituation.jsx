import { useEffect, useState } from "react";
import { sb } from "../supabase.js";
import { ECOLE } from "../config.js";
import { fcfa, fdate } from "../utils.js";
import { Badge } from "../components/ui.jsx";

// Page publique (sans connexion) : /situation — matricule + code d'accès personnel
const objet = (type, numero) => (type === "inscription" ? "Inscription" : `Scolarité — tranche ${numero}`);
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export default function PublicSituation() {
  const [matricule, setMatricule] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [nomCentre, setNomCentre] = useState(ECOLE.nom);
  useEffect(() => { sb.rpc("ecole_nom").then(({ data }) => data && setNomCentre(data)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(""); setRes(null);
    const { data, error } = await sb.rpc("ma_situation", { p_matricule: matricule, p_code: code });
    setBusy(false);
    if (error) return setErr("Consultation impossible pour le moment. Réessaie dans un instant.");
    if (!data?.ok) {
      return setErr(
        data?.raison === "bloque"
          ? `Trop d'essais. Réessaie dans ${data.minutes} minute(s).`
          : "Matricule ou code incorrect. Vérifie les informations reçues de l'administration."
      );
    }
    setRes(data);
  };

  const tranches = (res?.tranches || []).filter((t) => t.montant_du > 0);

  return (
    <div className="center card" style={{ maxWidth: 560 }}>
      <img src="/logo.png" alt="" style={{ height: 90, display: "block", margin: "0 auto 8px" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <h2 style={{ color: "var(--brand)", marginBottom: 4 }}>{nomCentre}</h2>
      <p className="muted" style={{ marginTop: 0 }}>Ma situation de paiement</p>

      {!res && (
        <form onSubmit={submit}>
          <label htmlFor="ps-m">Matricule</label>
          <input id="ps-m" placeholder="M237-26-001" required autoComplete="off" autoCapitalize="characters" value={matricule} onChange={(e) => setMatricule(e.target.value)} />
          <label htmlFor="ps-c">Code d'accès</label>
          <input id="ps-c" placeholder="6 caractères" required autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="primary block" disabled={busy}>{busy ? "Vérification…" : "Voir ma situation"}</button>
        </form>
      )}

      {err && <p className="badge bad" style={{ marginTop: 16, display: "block" }}>{err}</p>}

      {res && (
        <>
          <p style={{ marginBottom: 4 }}><b style={{ fontSize: "1.15rem" }}>{res.nom}</b></p>
          <p className="muted" style={{ marginTop: 0 }}>{res.matricule}{res.classe ? ` · ${res.classe}` : ""}{res.niveau ? ` · niveau ${res.niveau}` : ""}</p>

          <div className={"card" + (res.reste > 0 ? "" : " success")} style={{ textAlign: "center" }}>
            <div className="muted">Reste à payer</div>
            <div className="recu-big" style={{ margin: "4px 0" }}>{fcfa(res.reste)}</div>
            {res.reste === 0 && <Badge def={["Tout est réglé", "ok"]} />}
            {res.en_verification > 0 && <p className="muted" style={{ marginBottom: 0 }}>{fcfa(res.en_verification)} en cours de vérification par l'administration.</p>}
          </div>

          <h3>Détail</h3>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Objet</th><th>Dû</th><th>Payé</th><th>Échéance</th></tr></thead>
              <tbody>
                {tranches.map((t, i) => {
                  const reglee = t.paye >= t.montant_du;
                  const retard = !reglee && t.date_limite < aujourdhui();
                  return (
                    <tr key={i}>
                      <td>{objet(t.type, t.numero)}</td>
                      <td>{fcfa(t.montant_du)}</td>
                      <td>{fcfa(t.paye)}</td>
                      <td>{reglee ? <Badge def={["Payée", "ok"]} /> : <>{fdate(t.date_limite)}{retard && <><br /><Badge def={["Dépassée", "bad"]} /></>}</>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3>Mes reçus</h3>
          {res.recus.length ? (
            <div className="tablewrap">
              <table>
                <thead><tr><th>N° de reçu</th><th>Date</th><th>Objet</th><th>Montant</th></tr></thead>
                <tbody>
                  {res.recus.map((r) => (
                    <tr key={r.numero_recu}>
                      <td><b>{r.numero_recu}</b></td>
                      <td>{fdate(r.date)}</td>
                      <td>{objet(r.type, r.tranche)}</td>
                      <td>{fcfa(r.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Aucun reçu pour le moment.</p>}

          <p className="muted" style={{ fontSize: ".9rem" }}>Le versement se fait à la banque. Présente ton bordereau à l'administration pour recevoir ton reçu.</p>
          <button className="block" onClick={() => { setRes(null); setCode(""); }}>Fermer</button>
        </>
      )}
    </div>
  );
}
