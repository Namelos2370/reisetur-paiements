import { useState } from "react";
import { sb, q } from "../supabase.js";
import { fcfa, fdate, GLOBAL, STAT, TYPE } from "../utils.js";
import { Badge, Loading, Modal, useAction, useLoad, useToast } from "../components/ui.jsx";
import ImportEtudiants from "../components/ImportEtudiants.jsx";

const NIVEAUX = ["A1", "A2", "B1", "B2", "C1"];

function NouvelEtudiant({ onAdded }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [niveau, setNiveau] = useState("A1");

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await q(sb.from("etudiants").insert({ nom: nom.trim(), telephone: tel.trim() || null, niveau }));
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
      <label htmlFor="n-niv">Niveau</label>
      <select id="n-niv" value={niveau} onChange={(e) => setNiveau(e.target.value)}>
        {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
      </select>
      <button className="primary" style={{ marginTop: 18 }} disabled={busy}>Ajouter</button>
    </form>
  );
}

function NouveauxFrais({ etudiantId, onCreated }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [f, setF] = useState({ type: "inscription", m1: "", d1: "", m2: "", d2: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

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
      <select id="f-type" value={f.type} onChange={set("type")}>
        <option value="inscription">Inscription</option>
        <option value="scolarite">Scolarité</option>
      </select>
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

function Detail({ etudiant, onClose, onChanged }) {
  const notify = useToast();
  const [run] = useAction();
  const st = useLoad(async () => {
    const [trs, encs] = await Promise.all([
      q(sb.from("v_tranches").select("*").eq("etudiant_id", etudiant.id).order("frais_id").order("numero")),
      q(sb.from("encaissements")
        .select("*, tranches!inner(numero, frais!inner(type, etudiant_id))")
        .eq("tranches.frais.etudiant_id", etudiant.id)
        .order("created_at", { ascending: false })),
    ]);
    return { trs, encs };
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
        <h2>{etudiant.nom} <Badge>{etudiant.niveau}</Badge></h2>
        <button className="small" onClick={onClose}>Fermer</button>
      </div>
      <p className="muted">{etudiant.telephone || "Pas de téléphone"}</p>

      {!st.data ? <Loading state={st} /> : (
        <>
          <h3>Tranches</h3>
          <div className="tablewrap">
            {st.data.trs.length ? (
              <table>
                <thead><tr><th>Frais</th><th>Échéance</th><th>Dû</th><th>Payé</th><th>Statut</th></tr></thead>
                <tbody>
                  {st.data.trs.map((t) => (
                    <tr key={t.id}>
                      <td>{TYPE[t.type]} T{t.numero}</td>
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
          <NouveauxFrais etudiantId={etudiant.id} onCreated={refresh} />

          <h3>Encaissements</h3>
          <div className="tablewrap">
            {st.data.encs.length ? (
              <table>
                <thead><tr><th>Reçu</th><th>Date</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {st.data.encs.map((c) => (
                    <tr key={c.id}>
                      <td><b>{c.numero_recu}</b><br /><span className="muted">{c.reference_banque || ""}</span></td>
                      <td>{fdate(c.date_paiement)}</td>
                      <td>{fcfa(c.montant)}<br /><span className="muted">{TYPE[c.tranches.frais.type]} T{c.tranches.numero}</span></td>
                      <td>
                        {c.statut === "valide" ? <Badge def={["Validé", "ok"]} /> : (
                          <><Badge def={["Rejeté", "bad"]} /><br /><span className="muted">{c.motif}</span></>
                        )}
                      </td>
                      <td className="actions">
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
  const [open, setOpen] = useState(null);

  if (!st.data) return <Loading state={st} />;

  const byE = {};
  st.data.frais.forEach((f) => (byE[f.etudiant_id] ||= []).push(f));
  const list = st.data.etus.filter((e) => e.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <h2>Étudiants</h2>
      <ImportEtudiants onDone={st.reload} />
      <NouvelEtudiant onAdded={st.reload} />
      <input placeholder="Rechercher un étudiant…" style={{ marginBottom: 16 }} value={search} onChange={(e) => setSearch(e.target.value)} />

      {!list.length && <p className="muted">Aucun étudiant.</p>}
      {list.map((e) => (
        <div className="card" key={e.id}>
          <div className="between">
            <div>
              <b style={{ fontSize: "1.1rem" }}>{e.nom}</b> <Badge>{e.niveau}</Badge>
              <br /><span className="muted">{e.telephone || "Pas de téléphone"}</span>
            </div>
            <div className="actions">
              <button className="small" onClick={() => setOpen(e)}>Détails</button>
              <button className="small primary" onClick={() => onEncaisser(e.id)}>Encaisser</button>
            </div>
          </div>
          {(byE[e.id] || []).map((f) => (
            <p key={f.id} style={{ margin: "12px 0 0" }}>
              {TYPE[f.type]} : {fcfa(f.paye)} / {fcfa(f.montant_total)} <Badge def={GLOBAL[f.statut_global]} />
            </p>
          ))}
          {!byE[e.id] && <p className="muted" style={{ margin: "12px 0 0" }}>Aucun frais défini.</p>}
        </div>
      ))}

      {open && <Detail etudiant={open} onClose={() => setOpen(null)} onChanged={st.reload} />}
    </>
  );
}
