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

  const total = tranches.reduce((s, t) => s + t.montant_du, 0);
  const paye = tranches.reduce((s, t) => s + t.paye, 0);
  const pct = total ? Math.min(100, Math.round((paye / total) * 100)) : 100;
  const prochaine = tranches.filter((t) => t.paye < t.montant_du).sort((a, b) => a.date_limite.localeCompare(b.date_limite))[0];

  return (
    <div className="sit">
      <header className="sit-head">
        <img src="/logo.png" alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div>
          <h1>{nomCentre}</h1>
          <p>Ma situation de paiement</p>
        </div>
      </header>

      <main className="sit-main">
        {!res && (
          <form className="sit-card" onSubmit={submit}>
            <h2>Accéder à ma situation</h2>
            <p className="muted">Saisis le matricule et le code d'accès remis par l'administration.</p>
            <label htmlFor="ps-m">Matricule</label>
            <input id="ps-m" placeholder="M237-26-001" required autoComplete="off" autoCapitalize="characters" value={matricule} onChange={(e) => setMatricule(e.target.value)} />
            <label htmlFor="ps-c">Code d'accès</label>
            <input id="ps-c" placeholder="6 caractères" required autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="primary block" disabled={busy}>{busy ? "Vérification…" : "Voir ma situation"}</button>
            {err && <p className="badge bad" style={{ marginTop: 16, display: "block" }}>{err}</p>}
          </form>
        )}

        {res && (
          <>
            <section className="sit-card sit-id">
              <div className="sit-nom">{res.nom}</div>
              <div className="sit-chips">
                <span>{res.matricule}</span>
                {res.classe && <span>{res.classe}</span>}
                {res.niveau && <span>Niveau {res.niveau}</span>}
              </div>
            </section>

            <section className={"sit-card sit-resume" + (res.reste === 0 ? " ok" : "")}>
              <div className="sit-reste-l">{res.reste === 0 ? "Situation à jour" : "Reste à payer"}</div>
              <div className="sit-reste">{res.reste === 0 ? "Tout est réglé ✔" : fcfa(res.reste)}</div>
              <div className="sit-bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: pct + "%" }} /></div>
              <div className="sit-duo">
                <div><span>Total dû</span><b>{fcfa(total)}</b></div>
                <div><span>Déjà payé</span><b>{fcfa(paye)}</b></div>
              </div>
              {res.en_verification > 0 && <p className="sit-note">{fcfa(res.en_verification)} en cours de vérification par l'administration.</p>}
              {res.reste > 0 && prochaine && (
                <p className="sit-next">
                  Prochaine échéance : <b>{fdate(prochaine.date_limite)}</b>
                  {prochaine.date_limite < aujourdhui() && <span className="badge bad" style={{ marginLeft: 8 }}>Dépassée</span>}
                </p>
              )}
            </section>

            <h3 className="sit-h">Mes frais</h3>
            <section className="sit-list">
              {tranches.map((t, i) => {
                const reglee = t.paye >= t.montant_du;
                const retard = !reglee && t.date_limite < aujourdhui();
                const etat = reglee ? ["Payée", "ok"] : retard ? ["Échéance dépassée", "bad"] : t.paye > 0 ? ["Partiel", "warn"] : ["À venir", "neutral"];
                const p = t.montant_du ? Math.round((t.paye / t.montant_du) * 100) : 100;
                return (
                  <div className="sit-row" key={i}>
                    <div className="sit-row-top"><b>{objet(t.type, t.numero)}</b><Badge def={etat} /></div>
                    <div className="sit-bar small"><i style={{ width: p + "%" }} /></div>
                    <div className="sit-row-bot">
                      <span>{fcfa(t.paye)} payés sur {fcfa(t.montant_du)}</span>
                      {!reglee && <span>Avant le {fdate(t.date_limite)}</span>}
                    </div>
                  </div>
                );
              })}
            </section>

            <h3 className="sit-h">Mes reçus</h3>
            <section className="sit-list">
              {res.recus.length ? res.recus.map((r) => (
                <div className="sit-row recu" key={r.numero_recu}>
                  <div><b>{r.numero_recu}</b><div className="muted">{objet(r.type, r.tranche)} · {fdate(r.date)}</div></div>
                  <b>{fcfa(r.montant)}</b>
                </div>
              )) : <p className="muted" style={{ margin: 0 }}>Aucun reçu pour le moment.</p>}
            </section>

            <p className="sit-foot">Le versement se fait à la banque. Présente ton bordereau à l'administration pour recevoir ton reçu officiel.</p>
            <button className="block" onClick={() => { setRes(null); setCode(""); setErr(""); }}>Quitter</button>
          </>
        )}
      </main>
    </div>
  );
}
