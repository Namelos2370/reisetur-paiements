import { useEffect, useState } from "react";
import { sb } from "../supabase.js";
import { ECOLE, appliquerEcole } from "../config.js";
import { fcfa, fdate } from "../utils.js";
import { Badge } from "../components/ui.jsx";

// Page publique « Mon profil » (/situation ou /profil) — matricule + code d'accès personnel.
// Option « rester connecté » : les accès sont mémorisés sur l'appareil de l'étudiant (effacés par « Quitter »).
const CLE = "reisetur_acces";
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || "null"); } catch { return null; } };
const ecrire = (v) => { try { v ? localStorage.setItem(CLE, JSON.stringify(v)) : localStorage.removeItem(CLE); } catch { /* sans stockage */ } };
const objet = (type, numero) => (type === "inscription" ? "Inscription" : `Scolarité — tranche ${numero}`);
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export default function PublicSituation() {
  const [matricule, setMatricule] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [nomCentre, setNomCentre] = useState(ECOLE.nom);
  const [rester, setRester] = useState(true);
  const [pdfBusy, setPdfBusy] = useState("");

  useEffect(() => {
    sb.rpc("ecole_publique").then(({ data }) => {
      if (data) { appliquerEcole(data); setNomCentre(data.nom); }
      else sb.rpc("ecole_nom").then((r) => r.data && setNomCentre(r.data));
    });
    const memo = lire();
    if (memo?.m && memo?.c) { setMatricule(memo.m); setCode(memo.c); consulter(memo.m, memo.c, true); }
    // eslint-disable-next-line
  }, []);

  async function consulter(m, c, auto = false) {
    setBusy(true); setErr("");
    const { data, error } = await sb.rpc("ma_situation", { p_matricule: m, p_code: c });
    setBusy(false);
    if (error) return setErr("Consultation impossible pour le moment. Réessaie dans un instant.");
    if (!data?.ok) {
      if (auto && data?.raison !== "bloque") ecrire(null); // accès mémorisés devenus invalides (code renouvelé)
      return setErr(
        data?.raison === "bloque"
          ? `Trop d'essais. Réessaie dans ${data.minutes} minute(s).`
          : auto ? "Ton code a changé. Saisis le nouveau code reçu de l'administration." : "Matricule ou code incorrect. Vérifie les informations reçues de l'administration."
      );
    }
    ecrire(rester || auto ? { m, c } : null);
    setRes(data);
  }

  const submit = (e) => { e.preventDefault(); consulter(matricule, code); };

  const telecharger = async (r) => {
    setPdfBusy(r.numero_recu);
    try {
      const { recuPdf } = await import("../pdf.js");
      const memeFrais = (res.tranches || []).filter((t) => t.type === r.type && (!r.niveau || t.niveau === r.niveau));
      await recuPdf({
        numero_recu: r.numero_recu, montant: r.montant, date_paiement: r.date, reference_banque: r.reference_banque || "",
        nom: res.nom, matricule: res.matricule, classe: r.classe ?? res.classe, niveau: r.niveau ?? res.niveau,
        type: r.type, tranche: r.tranche,
        reste: r.reste ?? memeFrais.reduce((s, t) => s + Math.max(0, t.montant_du - t.paye), 0),
        verifUrl: `${window.location.origin}/verifier?n=${encodeURIComponent(r.numero_recu)}`,
      });
    } catch { setErr("Le reçu n'a pas pu être généré. Réessaie dans un instant."); }
    setPdfBusy("");
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
          <p>{res ? "Mon profil" : "Espace étudiant"}</p>
        </div>
      </header>

      <main className="sit-main">
        {!res && (
          <form className="sit-card" onSubmit={submit}>
            <h2>Accéder à mon profil</h2>
            <p className="muted">Saisis le matricule et le code d'accès remis par l'administration.</p>
            <label htmlFor="ps-m">Matricule</label>
            <input id="ps-m" placeholder="M237-26-001" required autoComplete="off" autoCapitalize="characters" value={matricule} onChange={(e) => setMatricule(e.target.value)} />
            <label htmlFor="ps-c">Code d'accès</label>
            <input id="ps-c" placeholder="6 caractères" required autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} />
            <label className="sit-check"><input type="checkbox" checked={rester} onChange={(e) => setRester(e.target.checked)} /> Rester connecté sur cet appareil</label>
            <button className="primary block" disabled={busy}>{busy ? "Vérification…" : "Accéder à mon profil"}</button>
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
                  <div className="sit-recu-r"><b>{fcfa(r.montant)}</b><button className="small" disabled={pdfBusy === r.numero_recu} onClick={() => telecharger(r)}>{pdfBusy === r.numero_recu ? "…" : "Télécharger"}</button></div>
                </div>
              )) : <p className="muted" style={{ margin: 0 }}>Aucun reçu pour le moment.</p>}
            </section>

            <p className="sit-foot">Le versement se fait à la banque. Présente ton bordereau à l'administration pour recevoir ton reçu officiel.</p>
            <button className="block" onClick={() => { ecrire(null); setRes(null); setCode(""); setErr(""); }}>Quitter</button>
          </>
        )}
      </main>
    </div>
  );
}
