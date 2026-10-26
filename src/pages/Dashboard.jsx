import { sb, q } from "../supabase.js";
import { useState } from "react";
import { fcfa, fdate, modeLabel, nombre, TYPE } from "../utils.js";
import { Loading, useLoad } from "../components/ui.jsx";
import { joursDepuis } from "./Sauvegarde.jsx";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const ym = (d) => d.slice(0, 7);
const moisCourt = (k) => `${MOIS[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}`;
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

function derniersMois(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function Kpi({ label, value, sub, tone, action }) {
  return (
    <div className={"dash-kpi" + (tone ? " " + tone : "")}>
      <div className="dash-kpi-l">{label}</div>
      <div className="dash-kpi-v">{value}</div>
      {sub && <div className="dash-kpi-s">{sub}</div>}
      {action}
    </div>
  );
}

export default function Dashboard({ onValider, onGo }) {
  const st = useLoad(async () => {
    const [d, retards, encs, trs, frais, etus, sauv] = await Promise.all([
      q(sb.rpc("tableau_de_bord")),
      q(sb.from("v_tranches").select("*").eq("statut", "en_retard").order("date_limite")),
      q(sb.from("encaissements").select("tranche_id, montant, date_paiement, mode_paiement, numero_recu").eq("statut", "valide").order("date_paiement", { ascending: false })).catch(() => []),
      q(sb.from("v_tranches").select("id, etudiant_nom, type, numero")),
      q(sb.from("v_frais").select("etudiant_id, classe, montant_total, paye, solde, a_valider")),
      q(sb.from("etudiants").select("id, classe")),
      sb.from("sauvegardes").select("created_at").order("created_at", { ascending: false }).limit(1).then((r) => r.data?.[0]?.created_at || null),
    ]);
    return { d, retards, encs, trs, frais, etus, sauv };
  }, []);
  const [tous, setTous] = useState(false);
  if (!st.data) return <Loading state={st} />;

  const { d, retards, encs, trs, frais, etus, sauv } = st.data;
  const joursSauv = sauv ? joursDepuis(sauv) : null;
  const reste = Math.max(0, d.total_attendu - d.total_valide);
  const taux = pct(d.total_valide, d.total_attendu);

  // Encaissements par mois (6 derniers mois, y compris les mois vides)
  const mois = derniersMois(6);
  const parMois = Object.fromEntries(mois.map((m) => [m, 0]));
  encs.forEach((c) => { const k = ym(c.date_paiement); if (k in parMois) parMois[k] += c.montant; });
  const maxMois = Math.max(1, ...Object.values(parMois));
  const courant = parMois[mois[5]], precedent = parMois[mois[4]];
  const evolution = precedent > 0 ? Math.round(((courant - precedent) / precedent) * 100) : null;

  // Par mode de paiement
  const parMode = {};
  encs.forEach((c) => { const m = modeLabel(c.mode_paiement); parMode[m] = (parMode[m] || 0) + c.montant; });
  const totalModes = Object.values(parMode).reduce((s, v) => s + v, 0);

  // Par classe
  const nbParClasse = {};
  etus.forEach((e) => { const k = e.classe || "Sans classe"; nbParClasse[k] = (nbParClasse[k] || 0) + 1; });
  const parClasse = {};
  frais.forEach((f) => {
    const k = f.classe || "Sans classe";
    const x = (parClasse[k] ||= { attendu: 0, paye: 0, solde: 0 });
    x.attendu += f.montant_total; x.paye += f.paye; x.solde += Math.max(0, f.solde - f.a_valider);
  });
  const classes = Object.entries(parClasse).sort((a, b) => a[0].localeCompare(b[0]));

  // Derniers encaissements
  const parTranche = Object.fromEntries(trs.map((t) => [t.id, t]));
  const derniers = encs.slice(0, tous ? encs.length : 3).map((c) => ({ ...c, t: parTranche[c.tranche_id] || {} }));

  const aujourdhui = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="dash-head">
        <div>
          <h2 style={{ margin: 0 }}>Tableau de bord</h2>
          <div className="muted">{aujourdhui.charAt(0).toUpperCase() + aujourdhui.slice(1)}</div>
        </div>
        <div className="actions">
          {d.nb_a_valider > 0 && <button className="primary" onClick={onValider}>Valider les paiements ({d.nb_a_valider})</button>}
          <button onClick={() => onGo("relances")}>Relancer les impayés</button>
        </div>
      </div>

      {(joursSauv == null || joursSauv > 7) && (
        <div className="dash-alerte">
          <span>💾 {joursSauv == null ? "Aucune sauvegarde de tes données n'a encore été faite." : `Dernière sauvegarde il y a ${joursSauv} jours.`}</span>
          <button className="small" onClick={() => onGo("sauvegarde")}>Sauvegarder maintenant</button>
        </div>
      )}

      <section className="dash-hero">
        <div className="dash-hero-top">
          <div>
            <div className="dash-kpi-l">Taux de recouvrement</div>
            <div className="dash-hero-taux">{taux}<small>%</small></div>
          </div>
          <div className="dash-hero-nums">
            <div><span>Encaissé (validé)</span><b>{fcfa(d.total_valide)}</b></div>
            <div><span>Reste à encaisser</span><b>{fcfa(reste)}</b></div>
            <div><span>Total attendu</span><b>{fcfa(d.total_attendu)}</b></div>
          </div>
        </div>
        <div className="dash-progress" role="progressbar" aria-valuenow={taux} aria-valuemin="0" aria-valuemax="100"><i style={{ width: taux + "%" }} /></div>
      </section>

      <div className="dash-kpis">
        <Kpi
          label="Encaissé ce mois"
          value={fcfa(courant)}
          sub={evolution == null ? "Pas de mois précédent à comparer" : `${evolution >= 0 ? "▲" : "▼"} ${Math.abs(evolution)} % vs mois précédent`}
          tone={evolution == null ? "" : evolution >= 0 ? "ok" : "bad"}
        />
        <Kpi
          label="Tranches en retard"
          value={d.nb_tranches_en_retard}
          sub={fcfa(d.montant_en_retard)}
          tone={d.nb_tranches_en_retard ? "bad" : "ok"}
        />
        <Kpi
          label="Paiements à valider"
          value={d.nb_a_valider}
          sub={fcfa(d.montant_a_valider)}
          tone={d.nb_a_valider ? "warn" : ""}
          action={d.nb_a_valider > 0 && <button className="small primary" style={{ marginTop: 10 }} onClick={onValider}>Valider</button>}
        />
        <Kpi label="Étudiants suivis" value={d.nb_etudiants} sub={`${classes.length} classe${classes.length > 1 ? "s" : ""}`} />
      </div>

      <div className="dash-cols">
        <section className="card">
          <h3 className="dash-h">Encaissements des 6 derniers mois</h3>
          <div className="dash-bars">
            {mois.map((m) => (
              <div className="dash-bar" key={m}>
                <span className="dash-bar-v">{parMois[m] ? nombre(parMois[m]) : ""}</span>
                <div className="dash-bar-col"><i className={m === mois[5] ? "cur" : ""} style={{ height: Math.max(parMois[m] ? 4 : 0, Math.round((parMois[m] / maxMois) * 100)) + "%" }} /></div>
                <b>{moisCourt(m)}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h3 className="dash-h">Encaissé par mode de paiement</h3>
          {totalModes ? (
            <div className="dash-modes">
              {Object.entries(parMode).sort((a, b) => b[1] - a[1]).map(([m, t]) => (
                <div key={m}>
                  <div className="dash-mode-top"><span>{m}</span><b>{fcfa(t)}</b></div>
                  <div className="dash-progress small"><i style={{ width: pct(t, totalModes) + "%" }} /></div>
                  <div className="muted dash-mode-pct">{pct(t, totalModes)} %</div>
                </div>
              ))}
            </div>
          ) : <p className="muted">Aucun encaissement validé pour le moment.</p>}
        </section>
      </div>

      <section className="card tablewrap">
        <h3 className="dash-h">Situation par classe</h3>
        <table>
          <thead><tr><th>Classe</th><th>Étudiants</th><th>Attendu</th><th>Encaissé</th><th>Reste</th><th style={{ minWidth: 130 }}>Avancement</th></tr></thead>
          <tbody>
            {classes.map(([c, x]) => (
              <tr key={c}>
                <td><b>{c}</b></td>
                <td>{nbParClasse[c] || 0}</td>
                <td>{fcfa(x.attendu)}</td>
                <td>{fcfa(x.paye)}</td>
                <td>{fcfa(x.solde)}</td>
                <td>
                  <div className="dash-progress small"><i style={{ width: pct(x.paye, x.attendu) + "%" }} /></div>
                  <span className="muted">{pct(x.paye, x.attendu)} %</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="dash-cols">
        <section className="card tablewrap">
          <h3 className="dash-h">Derniers encaissements</h3>
          {derniers.length ? (
            <table>
              <thead><tr><th>Date</th><th>Étudiant</th><th>Montant</th></tr></thead>
              <tbody>
                {derniers.map((c) => (
                  <tr key={c.numero_recu}>
                    <td>{fdate(c.date_paiement)}</td>
                    <td><b>{c.t.etudiant_nom || "—"}</b><br /><span className="muted">{TYPE[c.t.type]}{c.t.numero ? ` T${c.t.numero}` : ""} · {modeLabel(c.mode_paiement)}</span></td>
                    <td><b>{fcfa(c.montant)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Aucun encaissement validé pour le moment.</p>}
          {encs.length > 3 && (
            <p style={{ margin: "14px 0 0" }}>
              <button className="small" onClick={() => setTous((v) => !v)}>{tous ? "Voir moins" : `Voir plus (${encs.length - 3})`}</button>
            </p>
          )}
        </section>

        <section className="card tablewrap">
          <h3 className="dash-h">Impayés en retard <span className="muted" style={{ fontWeight: 400 }}>({retards.length})</span></h3>
          {retards.length ? (
            <table>
              <thead><tr><th>Étudiant</th><th>Échéance</th><th>Reste</th></tr></thead>
              <tbody>
                {retards.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.etudiant_nom}</b><br /><span className="muted">{r.etudiant_classe || "—"} · {TYPE[r.type]} T{r.numero}</span></td>
                    <td>{fdate(r.date_limite)}</td>
                    <td><b>{fcfa(r.solde)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">Aucun retard.</p>}
          {retards.length > 8 && (
            <p style={{ margin: "14px 0 0" }}><button className="small" onClick={() => onGo("relances")}>Voir les {retards.length} retards dans Relances →</button></p>
          )}
        </section>
      </div>
    </>
  );
}
