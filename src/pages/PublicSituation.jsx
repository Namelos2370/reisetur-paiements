import { useEffect, useState } from "react";
import { sb } from "../supabase.js";
import { ECOLE, appliquerEcole } from "../config.js";
import { fcfa, fdate, modeLabel } from "../utils.js";
import { waNumber } from "../data.js";
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
  const [ecoleInfo, setEcoleInfo] = useState({});

  useEffect(() => {
    sb.rpc("ecole_publique").then(({ data }) => {
      if (data) { appliquerEcole(data); setNomCentre(data.nom); setEcoleInfo(data); }
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
        numero_recu: r.numero_recu, montant: r.montant, date_paiement: r.date, reference_banque: r.reference_banque || "", mode_paiement: r.mode_paiement || null,
        nom: res.nom, matricule: res.matricule, classe: r.classe ?? res.classe, niveau: r.niveau ?? res.niveau,
        type: r.type, tranche: r.tranche,
        reste: r.reste ?? memeFrais.reduce((s, t) => s + Math.max(0, t.montant_du - t.paye), 0),
        verifUrl: `${window.location.origin}/verifier?n=${encodeURIComponent(r.numero_recu)}`,
      });
    } catch { setErr("Le reçu n'a pas pu être généré. Réessaie dans un instant."); }
    setPdfBusy("");
  };

  const attestation = async () => {
    setPdfBusy("attestation");
    try {
      const { attestationPdf } = await import("../pdf.js");
      await attestationPdf({ nom: res.nom, matricule: res.matricule, niveau: res.niveau, classe: res.classe, debut: cal?.debut, fin: cal?.fin });
    } catch { setErr("L'attestation n'a pas pu être générée. Réessaie dans un instant."); }
    setPdfBusy("");
  };

  const attestationNiveau = async (r) => {
    setPdfBusy("niv" + r.niveau);
    try {
      const { attestationNiveauPdf } = await import("../pdf.js");
      const p = (res.parcours || []).find((x) => x.niveau === r.niveau);
      await attestationNiveauPdf({ nom: res.nom, matricule: res.matricule, niveau: r.niveau, classe: p?.classe, date_examen: r.date_examen, note: r.note, mention: r.mention });
    } catch { setErr("L'attestation n'a pas pu être générée. Réessaie dans un instant."); }
    setPdfBusy("");
  };

  const [coord, setCoord] = useState(null); // { tel, email, ville } en cours de saisie
  const [coordMsg, setCoordMsg] = useState("");
  const ouvrirCoord = () => { setCoordMsg(""); setCoord({ tel: res.telephone || "", email: res.email || "", ville: res.ville || "" }); setTimeout(() => document.getElementById("coordonnees")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); };
  const enregistrerCoord = async (e) => {
    e.preventDefault();
    setBusy(true); setCoordMsg("");
    const { data, error } = await sb.rpc("maj_mes_infos", { p_matricule: res.matricule, p_code: code, p_tel: coord.tel, p_email: coord.email, p_ville: coord.ville });
    setBusy(false);
    if (error || !data) return setCoordMsg("Enregistrement impossible pour le moment. Réessaie dans un instant.");
    setRes((r) => ({ ...r, telephone: coord.tel.trim() || null, email: coord.email.trim() || null, ville: coord.ville.trim() || null }));
    setCoord(null); setCoordMsg("Coordonnées enregistrées ✔");
  };

  // Parcours : un niveau par ligne, avec son résultat d'examen
  const niveauxParcours = [...new Set([...(res?.parcours || []).map((p) => p.niveau), ...(res?.resultats || []).map((r) => r.niveau)])];
  const lignesParcours = niveauxParcours.map((n) => ({
    niveau: n,
    p: (res.parcours || []).find((x) => x.niveau === n),
    r: (res.resultats || []).find((x) => x.niveau === n),
  }));
  const reussis = (res?.resultats || []).filter((r) => r.statut === "reussi");

  const tranches = (res?.tranches || []).filter((t) => t.montant_du > 0);

  const total = tranches.reduce((s, t) => s + t.montant_du, 0);
  const paye = tranches.reduce((s, t) => s + t.paye, 0);
  const pct = total ? Math.min(100, Math.round((paye / total) * 100)) : 100;
  const inscr = tranches.filter((t) => t.type === "inscription" && (!res.niveau || !t.niveau || t.niveau === res.niveau));
  const inscrite = inscr.length > 0 && inscr.every((t) => t.paye >= t.montant_du);
  const cal = res?.calendrier;
  const wa = waNumber(ecoleInfo.whatsapp);
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


            {!res.telephone && !coord && (
              <section className="sit-annonce" style={{ background: "#eef4ff", borderColor: "#b9d0ff" }}>
                <b>📱 Ajoute ton numéro WhatsApp</b>
                <p>Pour que le centre puisse te joindre facilement (rappels, annonces).</p>
                <button className="small primary" onClick={ouvrirCoord}>Ajouter mon numéro</button>
              </section>
            )}

            {res.annonces?.length > 0 && (
              <section className="sit-annonces">
                {res.annonces.map((a, i) => (
                  <div className="sit-annonce" key={i}>
                    {a.date_evenement && <span className="sit-evt">📅 {fdate(a.date_evenement)}</span>}
                    <b>📢 {a.titre}</b>
                    {a.message && <p>{a.message}</p>}
                    {a.classe && <small>{a.classe}</small>}
                  </div>
                ))}
              </section>
            )}

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


            {cal && (cal.debut || cal.fin || cal.examen || cal.horaires || cal.salle || cal.formateur) && (
              <>
                <h3 className="sit-h">Ma classe</h3>
                <section className="sit-card sit-cal">
                  {cal.debut && <div><span>Début des cours</span><b>{fdate(cal.debut)}</b></div>}
                  {cal.fin && <div><span>Fin des cours</span><b>{fdate(cal.fin)}</b></div>}
                  {cal.examen && <div><span>Examen</span><b>{fdate(cal.examen)}</b></div>}
                  {cal.horaires && <div><span>Horaires</span><b>{cal.horaires}</b></div>}
                  {cal.salle && <div><span>Salle</span><b>{cal.salle}</b></div>}
                  {cal.formateur && <div><span>Formateur</span><b>{cal.formateur}</b></div>}
                </section>
              </>
            )}

            {lignesParcours.length > 0 && (
              <>
                <h3 className="sit-h">Mon parcours</h3>
                <section className="sit-list">
                  {lignesParcours.map(({ niveau, p, r }) => (
                    <div className="sit-row" key={niveau}>
                      <div className="sit-row-top">
                        <b>Niveau {niveau}{niveau === res.niveau ? " · en cours" : ""}</b>
                        {r ? <Badge def={r.statut === "reussi" ? ["Réussi", "ok"] : r.statut === "echec" ? ["Non validé", "bad"] : ["Résultat à venir", "neutral"]} /> : niveau !== res.niveau ? <Badge def={["Terminé", "neutral"]} /> : null}
                      </div>
                      <div className="sit-row-bot" style={{ marginTop: 6 }}>
                        <span>{p?.classe || ""}{p?.debut ? ` · depuis le ${fdate(p.debut)}` : ""}</span>
                        {r && (r.note != null || r.mention) && <span>{r.note != null ? `Note ${r.note}` : ""}{r.note != null && r.mention ? " · " : ""}{r.mention || ""}</span>}
                      </div>
                    </div>
                  ))}
                </section>
              </>
            )}

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
                  <div><b>{r.numero_recu}</b><div className="muted">{objet(r.type, r.tranche)} · {fdate(r.date)}{r.mode_paiement ? ` · ${modeLabel(r.mode_paiement)}` : ""}</div></div>
                  <div className="sit-recu-r"><b>{fcfa(r.montant)}</b><button className="small" disabled={pdfBusy === r.numero_recu} onClick={() => telecharger(r)}>{pdfBusy === r.numero_recu ? "…" : "Télécharger"}</button></div>
                </div>
              )) : <p className="muted" style={{ margin: 0 }}>Aucun reçu pour le moment.</p>}
            </section>

            <h3 className="sit-h">Mes documents</h3>
            <section className="sit-list">
              <div className="sit-row recu">
                <div><b>Attestation d'inscription</b><div className="muted">{inscrite ? "Disponible" : "Disponible dès que l'inscription est réglée"}</div></div>
                <button className="small" disabled={!inscrite || pdfBusy === "attestation"} onClick={attestation}>{pdfBusy === "attestation" ? "…" : "Télécharger"}</button>
              </div>
              {reussis.map((r) => (
                <div className="sit-row recu" key={r.niveau}>
                  <div><b>Attestation de niveau {r.niveau}</b><div className="muted">Niveau validé{r.date_examen ? ` · examen du ${fdate(r.date_examen)}` : ""}</div></div>
                  <button className="small" disabled={pdfBusy === "niv" + r.niveau} onClick={() => attestationNiveau(r)}>{pdfBusy === "niv" + r.niveau ? "…" : "Télécharger"}</button>
                </div>
              ))}
              {(res.documents || []).map((d, i) => (
                <div className="sit-row recu" key={i}>
                  <div><b>{d.titre}</b><div className="muted">Support de cours</div></div>
                  <a className="sit-lien" href={d.url} target="_blank" rel="noreferrer">Ouvrir</a>
                </div>
              ))}
            </section>

            <h3 className="sit-h" id="coordonnees">Mes coordonnées</h3>
            <section className="sit-card">
              {!coord ? (
                <>
                  <div className="sit-coord">
                    <div><span>Téléphone</span><b>{res.telephone || "—"}</b></div>
                    <div><span>E-mail</span><b>{res.email || "—"}</b></div>
                    <div><span>Ville</span><b>{res.ville || "—"}</b></div>
                  </div>
                  <button className="small" style={{ marginTop: 12 }} onClick={ouvrirCoord}>Modifier mes coordonnées</button>
                  {coordMsg && <p className="sit-note" style={{ color: "var(--ok)" }}>{coordMsg}</p>}
                </>
              ) : (
                <form onSubmit={enregistrerCoord}>
                  <label htmlFor="co-t">Téléphone (WhatsApp de préférence)</label>
                  <input id="co-t" type="tel" value={coord.tel} onChange={(e) => setCoord({ ...coord, tel: e.target.value })} />
                  <label htmlFor="co-e">E-mail</label>
                  <input id="co-e" type="email" value={coord.email} onChange={(e) => setCoord({ ...coord, email: e.target.value })} />
                  <label htmlFor="co-v">Ville</label>
                  <input id="co-v" value={coord.ville} onChange={(e) => setCoord({ ...coord, ville: e.target.value })} />
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button className="primary" disabled={busy}>Enregistrer</button>
                    <button type="button" onClick={() => setCoord(null)}>Annuler</button>
                  </div>
                  {coordMsg && <p className="badge bad" style={{ marginTop: 12, display: "block" }}>{coordMsg}</p>}
                </form>
              )}
            </section>

            {ecoleInfo.instructions_paiement && (
              <>
                <h3 className="sit-h">Comment payer</h3>
                <section className="sit-card sit-pay">{ecoleInfo.instructions_paiement}</section>
              </>
            )}

            {wa && <a className="sit-wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Bonjour, je suis ${res.nom} (matricule ${res.matricule}).`)}`} target="_blank" rel="noreferrer">💬 Écrire à la direction sur WhatsApp</a>}

            <p className="sit-foot">Les paiements se font au centre : un reçu officiel t'est remis à chaque versement.</p>
            <button className="block" onClick={() => { ecrire(null); setRes(null); setCode(""); setErr(""); }}>Quitter</button>
          </>
        )}
      </main>
    </div>
  );
}
