import { useState } from "react";
import { sb, q } from "../supabase.js";
import { echeancesDepuisDebut, fcfa, fdate, GLOBAL, modeLabel, STAT, TYPE, today } from "../utils.js";
import { Badge, Loading, Modal, useAction, useLoad, useToast } from "../components/ui.jsx";
import ImportEtudiants from "../components/ImportEtudiants.jsx";
import { telechargerRecu, waLink, waNumber } from "../data.js";
import { ECOLE } from "../config.js";

const NIVEAUX = ["A1", "A2", "B1", "B2", "C1"];

function PasserNiveau({ etudiant, onClose, onDone }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const suivants = NIVEAUX.slice(NIVEAUX.indexOf(etudiant.niveau) + 1);
  const info = useLoad(async () => {
    const [tarifs, frais] = await Promise.all([
      q(sb.from("tarifs_niveau").select("*")),
      q(sb.from("v_frais").select("solde,a_valider").eq("etudiant_id", etudiant.id)),
    ]);
    return { tarifs, impaye: frais.reduce((s, f) => s + Math.max(0, f.solde - f.a_valider), 0) };
  }, [etudiant.id]);
  const [niveau, setNiveau] = useState(suivants[0]);
  const [classe, setClasse] = useState("");
  const [date, setDate] = useState(today());
  const [f, setF] = useState({ m1: null, d1: "", m2: null, d2: "" });
  const [debut, setDebut] = useState("");
  const onDebut = (e) => { setDebut(e.target.value); setF((s) => ({ ...s, ...echeancesDepuisDebut(e.target.value) })); };
  const tarif = info.data?.tarifs.find((t) => t.niveau === niveau);
  const m1 = f.m1 ?? tarif?.scolarite_t1 ?? "";
  const m2 = f.m2 ?? tarif?.scolarite_t2 ?? "";

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (f.d2 < f.d1) return notify("La tranche 2 doit être après la tranche 1.", true);
      await q(sb.rpc("passer_niveau", {
        p_etudiant: etudiant.id, p_niveau: niveau, p_classe: classe, p_date: date,
        p_t1: +m1, p_d1: f.d1, p_t2: +m2, p_d2: f.d2,
      }));
      notify(`${etudiant.nom} passe en ${niveau}.`);
      onDone();
    });
  };

  return (
    <Modal onClose={onClose}>
      <div className="between">
        <h2>Passage au niveau supérieur</h2>
        <button className="small" onClick={onClose}>Fermer</button>
      </div>
      <p><b>{etudiant.nom}</b> — {etudiant.niveau}{etudiant.classe ? ` (${etudiant.classe})` : ""}</p>
      {!info.data ? <Loading state={info} /> : (
        <form onSubmit={submit}>
          {info.data.impaye > 0 && (
            <p className="badge warn" style={{ display: "block" }}>
              Attention : il reste {fcfa(info.data.impaye)} à payer sur les niveaux précédents. Ils restent dus et restent visibles dans les relances.
            </p>
          )}
          <p className="muted">Réservé aux étudiants ayant réussi leur niveau. L'historique (reçus, frais, classe) du niveau actuel est conservé tel quel.</p>
          <div className="row">
            <div>
              <label htmlFor="pn-niv">Nouveau niveau</label>
              <select id="pn-niv" value={niveau} onChange={(e) => { setNiveau(e.target.value); setF((s) => ({ ...s, m1: null, m2: null })); }}>
                {suivants.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div><label htmlFor="pn-cl">Nouvelle classe</label><input id="pn-cl" placeholder="ex. B1 Clausthal" value={classe} onChange={(e) => setClasse(e.target.value)} /></div>
          </div>
          <div className="row">
            <div><label htmlFor="pn-dt">Date du passage</label><input id="pn-dt" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label htmlFor="pn-db">Début des cours du nouveau niveau</label><input id="pn-db" type="date" value={debut} onChange={onDebut} /></div>
          </div>
          <p className="muted">Les échéances se remplissent à partir du début des cours : tranche 1 au début, tranche 2 deux semaines après. Tu peux les ajuster.</p>
          <h3>Scolarité {niveau} (2 tranches)</h3>
          {!tarif?.scolarite_t1 && <p className="muted">Aucun tarif défini pour {niveau} : saisis-le ici (ou dans Mon profil → Tarifs).</p>}
          <div className="row">
            <div><label htmlFor="pn-m1">Tranche 1 — montant (FCFA)</label><input id="pn-m1" type="number" min="1" required value={m1} onChange={(e) => setF((s) => ({ ...s, m1: e.target.value }))} /></div>
            <div><label htmlFor="pn-d1">Tranche 1 — date limite</label><input id="pn-d1" type="date" required value={f.d1} onChange={(e) => setF((s) => ({ ...s, d1: e.target.value }))} /></div>
          </div>
          <div className="row">
            <div><label htmlFor="pn-m2">Tranche 2 — montant (FCFA)</label><input id="pn-m2" type="number" min="1" required value={m2} onChange={(e) => setF((s) => ({ ...s, m2: e.target.value }))} /></div>
            <div><label htmlFor="pn-d2">Tranche 2 — date limite</label><input id="pn-d2" type="date" required value={f.d2} onChange={(e) => setF((s) => ({ ...s, d2: e.target.value }))} /></div>
          </div>
          <button className="primary block" disabled={busy}>Confirmer le passage en {niveau}</button>
        </form>
      )}
    </Modal>
  );
}

function NouvelEtudiant({ onAdded }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [niveau, setNiveau] = useState("A1");
  const [classe, setClasse] = useState("");

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await q(sb.from("etudiants").insert({ nom: nom.trim(), telephone: tel.trim() || null, niveau, classe: classe.trim() || null }));
      setNom(""); setTel("");
      notify("Étudiant ajouté.");
      onAdded();
    });
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>Ajouter un étudiant</h3>
      <div className="row">
        <div><label htmlFor="n-nom">Nom complet</label><input id="n-nom" required value={nom} onChange={(e) => setNom(e.target.value)} /></div>
        <div><label htmlFor="n-tel">Téléphone</label><input id="n-tel" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
      </div>
      <div className="row">
        <div>
          <label htmlFor="n-niv">Niveau</label>
          <select id="n-niv" value={niveau} onChange={(e) => setNiveau(e.target.value)}>
            {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="n-cl">Classe</label>
          <input id="n-cl" placeholder="ex. A1 Clausthal" value={classe} onChange={(e) => setClasse(e.target.value)} />
        </div>
      </div>
      <button className="primary" style={{ marginTop: 18 }} disabled={busy}>Ajouter</button>
    </form>
  );
}

function NouveauxFrais({ etudiantId, niveau, onCreated }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [f, setF] = useState({ type: "inscription", m1: "", d1: "", m2: "", d2: "" });
  const tarifs = useLoad(() => q(sb.from("tarifs_niveau").select("*").eq("niveau", niveau || "")), [niveau]);
  const tarif = (tarifs.data || [])[0];
  // Scolarité : montants proposés d'après les tarifs du niveau (Mon profil → Tarifs), modifiables
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const choisirType = (e) => {
    const type = e.target.value;
    setF((s) => ({ ...s, type, m1: type === "scolarite" && tarif?.scolarite_t1 ? String(tarif.scolarite_t1) : "", m2: type === "scolarite" && tarif?.scolarite_t2 ? String(tarif.scolarite_t2) : "" }));
  };
  const [debut, setDebut] = useState("");
  const onDebut = (e) => { setDebut(e.target.value); setF((s) => ({ ...s, ...echeancesDepuisDebut(e.target.value) })); };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (f.d2 < f.d1) return notify("La tranche 2 doit être après la tranche 1.", true);
      await q(sb.rpc("creer_frais", {
        p_etudiant: etudiantId, p_type: f.type,
        p_t1: +f.m1, p_d1: f.d1, p_t2: +f.m2, p_d2: f.d2,
      }));
      setF({ type: "inscription", m1: "", d1: "", m2: "", d2: "" });
      notify("Frais créés.");
      onCreated();
    });
  };

  return (
    <form onSubmit={submit}>
      <label htmlFor="f-type">Type</label>
      <select id="f-type" value={f.type} onChange={choisirType}>
        <option value="inscription">Inscription</option>
        <option value="scolarite">Scolarité</option>
      </select>
      <label htmlFor="f-debut">Début des cours <span className="muted">(remplit les échéances : T1 au début, T2 deux semaines après)</span></label>
      <input id="f-debut" type="date" value={debut} onChange={onDebut} />
      <div className="row">
        <div><label htmlFor="f-m1">Tranche 1 — montant (FCFA)</label><input id="f-m1" type="number" min="1" required value={f.m1} onChange={set("m1")} /></div>
        <div><label htmlFor="f-d1">Tranche 1 — date limite</label><input id="f-d1" type="date" required value={f.d1} onChange={set("d1")} /></div>
      </div>
      <div className="row">
        <div><label htmlFor="f-m2">Tranche 2 — montant (FCFA)</label><input id="f-m2" type="number" min="1" required value={f.m2} onChange={set("m2")} /></div>
        <div><label htmlFor="f-d2">Tranche 2 — date limite</label><input id="f-d2" type="date" required value={f.d2} onChange={set("d2")} /></div>
      </div>
      <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Créer les frais</button>
    </form>
  );
}

const STATUT_RES = { reussi: ["Réussi", "ok"], echec: ["Échec", "bad"], en_attente: ["En attente", "neutral"] };

function Resultats({ etudiant }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const st = useLoad(() => q(sb.from("resultats").select("*").eq("etudiant_id", etudiant.id).order("niveau")), [etudiant.id]);
  const [f, setF] = useState({ niveau: etudiant.niveau, date_examen: "", note: "", mention: "", statut: "reussi" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      await q(sb.from("resultats").upsert({
        etudiant_id: etudiant.id, niveau: f.niveau, date_examen: f.date_examen || null,
        note: f.note === "" ? null : +f.note, mention: f.mention.trim(), statut: f.statut,
      }, { onConflict: "etudiant_id,niveau" }));
      notify(`Résultat ${f.niveau} enregistré.`);
      st.reload();
    });
  };
  const del = (r) => {
    if (!window.confirm(`Supprimer le résultat ${r.niveau} ?`)) return;
    run(async () => { await q(sb.from("resultats").delete().eq("id", r.id)); st.reload(); });
  };
  return (
    <>
      <h3>Résultats d'examen</h3>
      <p className="muted">Visibles par l'étudiant dans « Mon profil ». Un résultat « Réussi » lui donne accès à son attestation de niveau.</p>
      {st.data?.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Niveau</th><th>Examen</th><th>Note</th><th>Résultat</th><th></th></tr></thead>
            <tbody>
              {st.data.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.niveau}</b></td>
                  <td>{r.date_examen ? fdate(r.date_examen) : "—"}</td>
                  <td>{r.note ?? "—"}{r.mention ? <><br /><span className="muted">{r.mention}</span></> : null}</td>
                  <td><Badge def={STATUT_RES[r.statut]} /></td>
                  <td className="actions">
                    <button className="small" onClick={() => setF({ niveau: r.niveau, date_examen: r.date_examen || "", note: r.note ?? "", mention: r.mention || "", statut: r.statut })}>Modifier</button>
                    <button className="small danger" onClick={() => del(r)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={save}>
        <div className="row">
          <div><label htmlFor="rs-n">Niveau</label><select id="rs-n" value={f.niveau} onChange={set("niveau")}>{NIVEAUX.map((n) => <option key={n}>{n}</option>)}</select></div>
          <div><label htmlFor="rs-s">Résultat</label><select id="rs-s" value={f.statut} onChange={set("statut")}><option value="reussi">Réussi</option><option value="echec">Échec</option><option value="en_attente">En attente</option></select></div>
        </div>
        <div className="row">
          <div><label htmlFor="rs-d">Date de l'examen</label><input id="rs-d" type="date" value={f.date_examen} onChange={set("date_examen")} /></div>
          <div><label htmlFor="rs-no">Note <span className="muted">(facultatif)</span></label><input id="rs-no" type="number" step="0.01" min="0" value={f.note} onChange={set("note")} /></div>
        </div>
        <label htmlFor="rs-m">Mention / commentaire <span className="muted">(facultatif)</span></label>
        <input id="rs-m" value={f.mention} onChange={set("mention")} />
        <button className="primary" style={{ marginTop: 14 }} disabled={busy}>Enregistrer le résultat</button>
      </form>
    </>
  );
}

export function Detail({ etudiant: initial, onClose, onChanged, onEncaisser }) {
  const notify = useToast();
  const [etudiant, setEtudiant] = useState(initial);
  const [edit, setEdit] = useState(null); // { nom, telephone, email, ville, classe } pendant la modification
  const ouvrirEdit = () => setEdit({ nom: etudiant.nom || "", telephone: etudiant.telephone || "", email: etudiant.email || "", ville: etudiant.ville || "", classe: etudiant.classe || "" });
  const enregistrerEdit = (e) => {
    e.preventDefault();
    const nom = edit.nom.trim();
    if (!nom) return notify("Le nom est obligatoire.", true);
    const maj = { nom, telephone: edit.telephone.trim() || null, email: edit.email.trim() || null, ville: edit.ville.trim() || null, classe: edit.classe.trim() || null };
    run(async () => {
      await q(sb.from("etudiants").update(maj).eq("id", etudiant.id));
      // la classe du niveau en cours suit la fiche
      if (maj.classe !== (etudiant.classe || null)) await sb.from("parcours").update({ classe: maj.classe }).eq("etudiant_id", etudiant.id).eq("niveau", etudiant.niveau);
      setEtudiant({ ...etudiant, ...maj });
      setEdit(null);
      notify("Informations enregistrées.");
      onChanged();
    });
  };
  const [passage, setPassage] = useState(false);
  const [run, busy] = useAction();
  const [code, setCode] = useState(etudiant.code_acces);

  const messageAcces = () =>
    `Bonjour ${etudiant.nom},\n\n${ECOLE.nom} met à votre disposition le suivi de votre situation de paiement :\n` +
    `Lien : ${window.location.origin}/situation\nMatricule : ${etudiant.matricule}\nCode d'accès : ${code}\n\n` +
    `Gardez ce code pour vous. Cordialement,\n${ECOLE.direction}`;
  const envoyerAcces = () => {
    if (waNumber(etudiant.telephone)) window.open(waLink(etudiant.telephone, messageAcces()), "_blank", "noopener");
    else navigator.clipboard?.writeText(messageAcces()).then(() => notify("Pas de numéro WhatsApp : message copié, colle-le où tu veux."));
  };
  const renouveler = () => {
    if (!window.confirm("Générer un nouveau code ? L'ancien ne fonctionnera plus.")) return;
    run(async () => { setCode(await q(sb.rpc("nouveau_code_acces", { p_etudiant: etudiant.id }))); notify("Nouveau code généré."); });
  };
  const st = useLoad(async () => {
    const [trs, encs, parcours] = await Promise.all([
      q(sb.from("v_tranches").select("*").eq("etudiant_id", etudiant.id).order("frais_id").order("numero")),
      q(sb.from("encaissements")
        .select("*, tranches!inner(numero, frais!inner(type, etudiant_id))")
        .eq("tranches.frais.etudiant_id", etudiant.id)
        .order("created_at", { ascending: false })),
      q(sb.from("parcours").select("*").eq("etudiant_id", etudiant.id).order("date_debut")),
    ]);
    return { trs, encs, parcours };
  }, [etudiant.id]);

  const refresh = () => { st.reload(); onChanged(); };

  const openBordereau = (path) =>
    run(async () => {
      const { data, error } = await sb.storage.from("bordereaux").createSignedUrl(path, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener");
    });

  const annuler = (id) => {
    const motif = window.prompt("Motif de l'annulation (obligatoire) :");
    if (!motif || !motif.trim()) return;
    run(async () => {
      await q(sb.from("encaissements").update({ statut: "rejete", motif: motif.trim() }).eq("id", id));
      notify("Encaissement annulé.");
      refresh();
    });
  };

  return (
    <Modal onClose={onClose}>
      <div className="between">
        <h2>{etudiant.nom} <Badge>{etudiant.niveau}</Badge>{etudiant.classe && <> <Badge>{etudiant.classe}</Badge></>}</h2>
        <button className="small" onClick={onClose}>Fermer</button>
      </div>
      <p className="muted"><b>{etudiant.matricule}</b> · {etudiant.telephone || "Pas de téléphone"}{etudiant.email ? ` · ${etudiant.email}` : ""}{etudiant.ville ? ` · ${etudiant.ville}` : ""}</p>
      {edit && (
        <form className="card" onSubmit={enregistrerEdit}>
          <h3 style={{ marginTop: 0 }}>Modifier les informations</h3>
          <div className="row">
            <div><label htmlFor="ed-nom">Nom complet</label><input id="ed-nom" required value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} /></div>
            <div><label htmlFor="ed-tel">Téléphone</label><input id="ed-tel" type="tel" inputMode="tel" value={edit.telephone} onChange={(e) => setEdit({ ...edit, telephone: e.target.value })} /></div>
          </div>
          <div className="row">
            <div><label htmlFor="ed-mail">E-mail</label><input id="ed-mail" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            <div><label htmlFor="ed-ville">Ville</label><input id="ed-ville" value={edit.ville} onChange={(e) => setEdit({ ...edit, ville: e.target.value })} /></div>
          </div>
          <div className="row">
            <div><label htmlFor="ed-cl">Classe</label><input id="ed-cl" value={edit.classe} onChange={(e) => setEdit({ ...edit, classe: e.target.value })} /></div>
          </div>
          <p className="muted" style={{ margin: "8px 0 0" }}>Le matricule ne change jamais. Pour changer de niveau, utilise « Passer au niveau supérieur ».</p>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="primary" disabled={busy}>Enregistrer</button>
            <button type="button" onClick={() => setEdit(null)}>Annuler</button>
          </div>
        </form>
      )}
      {code && (
        <p className="muted">
          Accès en ligne : matricule <b>{etudiant.matricule}</b> · code <b>{code}</b>{" "}
          <button className="small" onClick={envoyerAcces}>Envoyer ses accès</button>{" "}
          <button className="small" onClick={renouveler}>Nouveau code</button>
        </p>
      )}
      <div className="actions">
        {!edit && <button className="small" onClick={ouvrirEdit}>Modifier les informations</button>}
        {onEncaisser && <button className="small primary" onClick={() => { onClose(); onEncaisser(etudiant.id); }}>＋ Encaisser un paiement</button>}
        {etudiant.niveau !== "C1" && <button className="small" onClick={() => setPassage(true)}>Passer au niveau supérieur</button>}
      </div>

      {!st.data ? <Loading state={st} /> : (
        <>
          {st.data.parcours.length > 1 && (
            <p className="muted">Parcours : {st.data.parcours.map((p) => `${p.niveau}${p.classe ? ` (${p.classe})` : ""}`).join(" → ")}</p>
          )}
          <Resultats etudiant={etudiant} />

          <h3>Tranches</h3>
          <div className="tablewrap">
            {st.data.trs.length ? (
              <table>
                <thead><tr><th>Frais</th><th>Niveau</th><th>Échéance</th><th>Dû</th><th>Payé</th><th>Statut</th></tr></thead>
                <tbody>
                  {st.data.trs.map((t) => (
                    <tr key={t.id}>
                      <td>{TYPE[t.type]} T{t.numero}</td>
                      <td>{t.niveau}</td>
                      <td>{fdate(t.date_limite)}</td>
                      <td>{fcfa(t.montant_du)}</td>
                      <td>{fcfa(t.paye)}</td>
                      <td><Badge def={STAT[t.statut]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">Aucun frais défini.</p>}
          </div>

          <h3>Définir de nouveaux frais (2 tranches)</h3>
          <NouveauxFrais etudiantId={etudiant.id} niveau={etudiant.niveau} onCreated={refresh} />

          <h3>Encaissements</h3>
          <div className="tablewrap">
            {st.data.encs.length ? (
              <table>
                <thead><tr><th>Reçu</th><th>Date</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {st.data.encs.map((c) => (
                    <tr key={c.id}>
                      <td>{c.numero_recu ? <b>{c.numero_recu}</b> : <span className="muted">Sans n° de reçu</span>}<br /><span className="muted">{[c.mode_paiement ? modeLabel(c.mode_paiement) : "", c.reference_banque || ""].filter(Boolean).join(" · ")}</span></td>
                      <td>{fdate(c.date_paiement)}</td>
                      <td>{fcfa(c.montant)}<br /><span className="muted">{TYPE[c.tranches.frais.type]} T{c.tranches.numero}</span></td>
                      <td>
                        {c.statut === "valide" && <Badge def={["Validé", "ok"]} />}
                        {c.statut === "en_attente" && <Badge def={["À valider", "warn"]} />}
                        {c.statut === "rejete" && <><Badge def={["Rejeté", "bad"]} /><br /><span className="muted">{c.motif}</span></>}
                      </td>
                      <td className="actions">
                        {c.statut === "valide" && <button className="small" onClick={() => run(() => telechargerRecu(c.id))}>Reçu PDF</button>}
                        {c.bordereau_path && <button className="small" onClick={() => openBordereau(c.bordereau_path)}>Bordereau</button>}
                        {c.statut === "valide" && <button className="small danger" onClick={() => annuler(c.id)}>Annuler</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">Aucun encaissement.</p>}
          </div>
        </>
      )}
      {passage && <PasserNiveau etudiant={etudiant} onClose={() => setPassage(false)} onDone={() => { setPassage(false); onChanged(); onClose(); }} />}
    </Modal>
  );
}

export default function Etudiants({ onEncaisser }) {
  const st = useLoad(async () => {
    const [etus, frais] = await Promise.all([
      q(sb.from("etudiants").select("*").order("nom")),
      q(sb.from("v_frais").select("*")),
    ]);
    return { etus, frais };
  }, []);
  const [search, setSearch] = useState("");
  const [classe, setClasse] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [panneau, setPanneau] = useState(null); // null | "ajout" | "import"
  const [open, setOpen] = useState(null);

  if (!st.data) return <Loading state={st} />;

  const byE = {};
  st.data.frais.forEach((f) => (byE[f.etudiant_id] ||= []).push(f));
  const classes = [...new Set(st.data.etus.map((e) => e.classe).filter(Boolean))].sort();
  const etat = (e) => {
    const fr = byE[e.id] || [];
    if (!fr.length) return "sans";
    if (fr.some((f) => f.solde - f.a_valider > 0)) return "impayes";
    if (fr.some((f) => f.a_valider > 0)) return "avalider";
    return "soldes";
  };
  const base = st.data.etus.filter(
    (e) => (e.nom + " " + e.matricule).toLowerCase().includes(search.toLowerCase()) && (!classe || e.classe === classe)
  );
  const compte = (k) => base.filter((e) => etat(e) === k).length;
  const FILTRES = [["tous", "Tous", base.length], ["impayes", "Reste à payer", compte("impayes")], ["avalider", "À valider", compte("avalider")], ["soldes", "Soldés", compte("soldes")]];
  const list = filtre === "tous" ? base : base.filter((e) => etat(e) === filtre);

  return (
    <>
      <div className="between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Étudiants <span className="muted" style={{ fontSize: ".95rem", fontWeight: 400 }}>({list.length})</span></h2>
        <div className="actions">
          <button className={"small" + (panneau === "ajout" ? " primary" : "")} onClick={() => setPanneau(panneau === "ajout" ? null : "ajout")}>＋ Nouvel étudiant</button>
          <button className={"small" + (panneau === "import" ? " primary" : "")} onClick={() => setPanneau(panneau === "import" ? null : "import")}>Importer un fichier Excel</button>
        </div>
      </div>
      {panneau === "ajout" && <NouvelEtudiant onAdded={() => { st.reload(); setPanneau(null); }} />}
      {panneau === "import" && <ImportEtudiants onDone={() => { st.reload(); setPanneau(null); }} />}
      <div className="row" style={{ marginBottom: 12 }}>
        <input type="search" placeholder="Rechercher un nom ou un matricule…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={classe} onChange={(e) => setClasse(e.target.value)}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="chips" role="tablist">
        {FILTRES.map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={filtre === id} className={"chip" + (filtre === id ? " on" : "")} onClick={() => setFiltre(id)}>{label} <b>{n}</b></button>
        ))}
      </div>

      {!list.length && <p className="muted">Aucun étudiant.</p>}
      {list.map((e) => (
        <div className="card" key={e.id}>
          <div className="between">
            <div>
              <b style={{ fontSize: "1.1rem" }}>{e.nom}</b> <Badge>{e.niveau}</Badge>{e.classe && <> <Badge>{e.classe}</Badge></>}
              <br /><span className="muted"><b>{e.matricule}</b> · {e.telephone || "Pas de téléphone"}</span>
            </div>
            <div className="actions">
              <button className="small" onClick={() => setOpen(e)}>Détails</button>
              <button className="small primary" onClick={() => onEncaisser(e.id)}>Encaisser</button>
            </div>
          </div>
          {(byE[e.id] || []).map((f) => (
            <p key={f.id} style={{ margin: "12px 0 0" }}>
              {TYPE[f.type]} : {fcfa(f.paye)} / {fcfa(f.montant_total)} <Badge def={GLOBAL[f.statut_global]} />
              {f.a_valider > 0 && <span className="muted"> · {fcfa(f.a_valider)} à valider</span>}
            </p>
          ))}
          {!byE[e.id] && <p className="muted" style={{ margin: "12px 0 0" }}>Aucun frais défini.</p>}
        </div>
      ))}

      {open && <Detail etudiant={open} onClose={() => setOpen(null)} onChanged={st.reload} onEncaisser={onEncaisser} />}
    </>
  );
}
