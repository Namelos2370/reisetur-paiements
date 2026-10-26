import { useState } from "react";
import { sb, q, avecColonne } from "../supabase.js";
import { appliquerEcole } from "../config.js";
import { fdate } from "../utils.js";
import { Loading, useAction, useLoad, useToast, Icone } from "../components/ui.jsx";

// Administration de l'« Espace étudiant » : annonces, calendrier des classes, paiement et contact.

function Annonces({ classes }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const st = useLoad(() => q(sb.from("annonces").select("*").order("date_evenement", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })), []);
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [classe, setClasse] = useState("");
  const [expire, setExpire] = useState("");
  const [evt, setEvt] = useState("");
  const [edit, setEdit] = useState(null); // id de l'annonce en modification

  const vider = () => { setEdit(null); setTitre(""); setMessage(""); setClasse(""); setExpire(""); setEvt(""); };
  const modifier = (a) => {
    setEdit(a.id); setTitre(a.titre); setMessage(a.message || ""); setClasse(a.classe || ""); setExpire(a.expire_le || ""); setEvt(a.date_evenement || "");
    document.getElementById("an-t")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const add = (e) => {
    e.preventDefault();
    run(async () => {
      const row = { titre: titre.trim(), message: message.trim(), classe: classe || null, expire_le: expire || null, date_evenement: evt || null };
      if (edit) await q(sb.from("annonces").update(row).eq("id", edit));
      else await q(sb.from("annonces").insert(row));
      notify(edit ? "Annonce modifiée." : "Annonce publiée.");
      vider();
      st.reload();
    });
  };
  const toggle = (a) => run(async () => { await q(sb.from("annonces").update({ actif: !a.actif }).eq("id", a.id)); st.reload(); });
  const del = (a) => {
    if (edit === a.id) vider();
    if (!window.confirm("Supprimer cette annonce ?")) return;
    run(async () => { await q(sb.from("annonces").delete().eq("id", a.id)); notify("Annonce supprimée."); st.reload(); });
  };

  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Annonces</h3>
      <p className="muted">Affichées en haut de « Mon profil » des étudiants : pour tout le centre ou pour une classe.</p>
      <form onSubmit={add}>
        <label htmlFor="an-t">Titre</label>
        <input id="an-t" required placeholder="ex. Examen A1 le 12 décembre" value={titre} onChange={(e) => setTitre(e.target.value)} />
        <label htmlFor="an-m">Message <span className="muted">(facultatif)</span></label>
        <textarea id="an-m" rows="3" value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="row">
          <div><label htmlFor="an-v">Date de l'événement <span className="muted">(facultatif)</span></label><input id="an-v" type="date" value={evt} onChange={(e) => setEvt(e.target.value)} /></div>
          <div><label htmlFor="an-e">Visible jusqu'au <span className="muted">(par défaut : la date de l'événement)</span></label><input id="an-e" type="date" value={expire} onChange={(e) => setExpire(e.target.value)} /></div>
        </div>
        <div className="row">
          <div>
            <label htmlFor="an-c">Destinataires</label>
            <select id="an-c" value={classe} onChange={(e) => setClasse(e.target.value)}>
              <option value="">Tout le centre</option>
              {classes.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="primary" disabled={busy}>{edit ? "Enregistrer les modifications" : "Publier"}</button>
          {edit && <button type="button" onClick={vider}>Annuler</button>}
        </div>
      </form>
      <Loading state={st} />
      {st.data && st.data.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {st.data.map((a) => (
            <div key={a.id} className="row" style={{ alignItems: "center", borderTop: "1px solid var(--line, #e5e9f0)", padding: "10px 0", opacity: a.actif ? 1 : 0.55 }}>
              <div>
                <b>{a.titre}</b>
                <div className="muted">{a.date_evenement ? <b><Icone nom="calendar" />{fdate(a.date_evenement)}</b> : "Sans date"} · {a.classe || "Tout le centre"}{a.expire_le ? ` · jusqu'au ${fdate(a.expire_le)}` : ""}{a.actif ? "" : " · masquée"}</div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="small" onClick={() => modifier(a)}>Modifier</button>
                <button className="small" onClick={() => toggle(a)}>{a.actif ? "Masquer" : "Réafficher"}</button>
                <button className="small danger" onClick={() => del(a)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Calendrier({ classes }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const st = useLoad(() => q(sb.from("classes_infos").select("*").order("debut", { ascending: true, nullsFirst: false })), []);
  const [classe, setClasse] = useState("");
  const [f, setF] = useState({ debut: "", fin: "", examen: "", horaires: "", salle: "", formateur: "" });
  const [libre, setLibre] = useState("");
  const nom = libre.trim() || classe;
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const choisir = (c) => {
    setClasse(c); setLibre("");
    const x = (st.data || []).find((r) => r.classe === c);
    setF({ debut: x?.debut || "", fin: x?.fin || "", examen: x?.examen || "", horaires: x?.horaires || "", salle: x?.salle || "", formateur: x?.formateur || "" });
  };

  const save = (e) => {
    e.preventDefault();
    if (!nom) return notify("Choisis une classe.", true);
    run(async () => {
      await avecColonne("formateur", (avec) => q(sb.from("classes_infos").upsert({
        classe: nom, debut: f.debut || null, fin: f.fin || null, examen: f.examen || null,
        horaires: f.horaires.trim(), salle: f.salle.trim(), ...(avec ? { formateur: f.formateur.trim() } : {}), updated_at: new Date().toISOString(),
      }, { onConflict: "classe" })));
      notify(`Calendrier de « ${nom} » enregistré.`);
      st.reload();
    });
  };

  const supprimer = (r) => {
    if (!window.confirm(`Supprimer le calendrier de « ${r.classe} » ?`)) return;
    run(async () => { await q(sb.from("classes_infos").delete().eq("id", r.id)); if (classe === r.classe) choisir(""); notify("Calendrier supprimé."); st.reload(); });
  };
  const toutes = [...new Set([...classes, ...(st.data || []).map((r) => r.classe)])].sort();
  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ marginTop: 0 }}>Calendrier des classes</h3>
      <p className="muted">Dates et horaires montrés aux étudiants de la classe. La date de début sert aussi pour l'attestation d'inscription.</p>
      <div className="row">
        <div>
          <label htmlFor="cl-c">Classe</label>
          <select id="cl-c" value={classe} onChange={(e) => choisir(e.target.value)}>
            <option value="">— Choisir —</option>
            {toutes.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label htmlFor="cl-n">…ou nouvelle classe</label><input id="cl-n" placeholder="ex. B1 Clausthal" value={libre} onChange={(e) => setLibre(e.target.value)} /></div>
      </div>
      <div className="row">
        <div><label htmlFor="cl-d">Début des cours</label><input id="cl-d" type="date" value={f.debut} onChange={set("debut")} /></div>
        <div><label htmlFor="cl-f">Fin des cours</label><input id="cl-f" type="date" value={f.fin} onChange={set("fin")} /></div>
        <div><label htmlFor="cl-e">Examen</label><input id="cl-e" type="date" value={f.examen} onChange={set("examen")} /></div>
      </div>
      <div className="row">
        <div><label htmlFor="cl-h">Jours et horaires</label><input id="cl-h" placeholder="ex. Lun–Ven, 8h–12h" value={f.horaires} onChange={set("horaires")} /></div>
        <div><label htmlFor="cl-s">Salle</label><input id="cl-s" value={f.salle} onChange={set("salle")} /></div>
      </div>
      <label htmlFor="cl-fo">Formateur</label>
      <input id="cl-fo" placeholder="Nom du formateur / de la formatrice" value={f.formateur} onChange={set("formateur")} />
      <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Enregistrer ce calendrier</button>
      {(st.data || []).length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="muted" style={{ marginBottom: 6 }}>Déjà renseignées (clique pour modifier) :</p>
          {(st.data || []).map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
              <button type="button" className="link" onClick={() => choisir(r.classe)}>{r.classe}{r.debut ? ` — début ${fdate(r.debut)}` : ""}</button>
              <button type="button" className="small danger" onClick={() => supprimer(r)}>Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}

function Documents({ classes }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const st = useLoad(() => q(sb.from("documents").select("*").order("created_at", { ascending: false })), []);
  const [titre, setTitre] = useState("");
  const [url, setUrl] = useState("");
  const [classe, setClasse] = useState("");
  const add = (e) => {
    e.preventDefault();
    run(async () => {
      let u = url.trim();
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      await q(sb.from("documents").insert({ titre: titre.trim(), url: u, classe: classe || null }));
      setTitre(""); setUrl(""); setClasse("");
      notify("Document ajouté.");
      st.reload();
    });
  };
  const toggle = (d) => run(async () => { await q(sb.from("documents").update({ actif: !d.actif }).eq("id", d.id)); st.reload(); });
  const del = (d) => {
    if (!window.confirm("Supprimer ce document ?")) return;
    run(async () => { await q(sb.from("documents").delete().eq("id", d.id)); notify("Document supprimé."); st.reload(); });
  };
  return (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>Documents et supports de cours</h3>
      <p className="muted">Liens (Google Drive, PDF en ligne…) montrés aux étudiants dans « Mes documents ». Partage le fichier en « tous les utilisateurs disposant du lien ».</p>
      <form onSubmit={add}>
        <div className="row">
          <div><label htmlFor="do-t">Titre</label><input id="do-t" required placeholder="ex. Cours A1 — semaine 1" value={titre} onChange={(e) => setTitre(e.target.value)} /></div>
          <div>
            <label htmlFor="do-c">Pour</label>
            <select id="do-c" value={classe} onChange={(e) => setClasse(e.target.value)}>
              <option value="">Tout le centre</option>
              {classes.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <label htmlFor="do-u">Lien</label>
        <input id="do-u" required placeholder="https://drive.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Ajouter</button>
      </form>
      <Loading state={st} />
      {st.data && st.data.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {st.data.map((d) => (
            <div key={d.id} className="row" style={{ alignItems: "center", borderTop: "1px solid var(--line, #e5e9f0)", padding: "10px 0", opacity: d.actif ? 1 : 0.55 }}>
              <div><b>{d.titre}</b><div className="muted">{d.classe || "Tout le centre"}{d.actif ? "" : " · masqué"}</div></div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="small" onClick={() => toggle(d)}>{d.actif ? "Masquer" : "Réafficher"}</button>
                <button className="small danger" onClick={() => del(d)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Paiement({ initial, onSaved }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [f, setF] = useState({ whatsapp: initial.whatsapp || "", instructions_paiement: initial.instructions_paiement || "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const row = await q(sb.from("ecole_parametres").update({
        whatsapp: f.whatsapp.trim(), instructions_paiement: f.instructions_paiement.trim(), updated_at: new Date().toISOString(),
      }).eq("id", "unique").select().single());
      onSaved(row);
      notify("Enregistré.");
    });
  };
  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ marginTop: 0 }}>Paiement et contact</h3>
      <label htmlFor="pa-w">WhatsApp du centre <span className="muted">(bouton « Écrire à la direction »)</span></label>
      <input id="pa-w" type="tel" placeholder="ex. 6 90 00 00 00" value={f.whatsapp} onChange={set("whatsapp")} />
      <label htmlFor="pa-i">Comment payer</label>
      <textarea id="pa-i" rows="5" placeholder={"Au centre (espèces), aux heures d'ouverture : …\nOrange Money : n° … (nom du compte : …)\nMTN Mobile Money : n° … (nom du compte : …)\nBanque : …\nUn reçu officiel est remis à chaque versement."} value={f.instructions_paiement} onChange={set("instructions_paiement")} />
      <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Enregistrer</button>
    </form>
  );
}

export default function Espace() {
  const st = useLoad(async () => {
    const [ecole, etus, cls] = await Promise.all([
      q(sb.from("ecole_parametres").select("*").eq("id", "unique").single()),
      q(sb.from("etudiants").select("classe")),
      q(sb.from("classes_infos").select("classe")),
    ]);
    return { ecole, classes: [...new Set([...etus, ...cls].map((e) => e.classe).filter(Boolean))].sort() };
  }, []);
  if (!st.data) return <Loading state={st} />;
  return (
    <>
      <h2>Espace étudiant</h2>
      <p className="muted">Ce que tes étudiants voient dans « Mon profil » ({window.location.origin}/profil).</p>
      <Annonces classes={st.data.classes} />
      <Calendrier classes={st.data.classes} />
      <Documents classes={st.data.classes} />
      <Paiement initial={st.data.ecole} onSaved={(row) => appliquerEcole(row)} />
    </>
  );
}
