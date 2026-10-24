import { useState } from "react";
import { sb, q } from "../supabase.js";
import { appliquerEcole } from "../config.js";
import { fdate } from "../utils.js";
import { Loading, useAction, useLoad, useToast } from "../components/ui.jsx";

// Administration de l'« Espace étudiant » : annonces, calendrier des classes, paiement et contact.

function Annonces({ classes }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const st = useLoad(() => q(sb.from("annonces").select("*").order("created_at", { ascending: false })), []);
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [classe, setClasse] = useState("");
  const [expire, setExpire] = useState("");

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await q(sb.from("annonces").insert({ titre: titre.trim(), message: message.trim(), classe: classe || null, expire_le: expire || null }));
      setTitre(""); setMessage(""); setClasse(""); setExpire("");
      notify("Annonce publiée.");
      st.reload();
    });
  };
  const toggle = (a) => run(async () => { await q(sb.from("annonces").update({ actif: !a.actif }).eq("id", a.id)); st.reload(); });
  const del = (a) => {
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
          <div>
            <label htmlFor="an-c">Destinataires</label>
            <select id="an-c" value={classe} onChange={(e) => setClasse(e.target.value)}>
              <option value="">Tout le centre</option>
              {classes.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label htmlFor="an-e">Visible jusqu'au <span className="muted">(facultatif)</span></label><input id="an-e" type="date" value={expire} onChange={(e) => setExpire(e.target.value)} /></div>
        </div>
        <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Publier</button>
      </form>
      <Loading state={st} />
      {st.data && st.data.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {st.data.map((a) => (
            <div key={a.id} className="row" style={{ alignItems: "center", borderTop: "1px solid var(--line, #e5e9f0)", padding: "10px 0", opacity: a.actif ? 1 : 0.55 }}>
              <div>
                <b>{a.titre}</b>
                <div className="muted">{a.classe || "Tout le centre"} · {fdate(a.created_at.slice(0, 10))}{a.expire_le ? ` · jusqu'au ${fdate(a.expire_le)}` : ""}{a.actif ? "" : " · masquée"}</div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
  const st = useLoad(() => q(sb.from("classes_infos").select("*")), []);
  const [classe, setClasse] = useState("");
  const [f, setF] = useState({ debut: "", fin: "", examen: "", horaires: "", salle: "" });
  const [libre, setLibre] = useState("");
  const nom = libre.trim() || classe;
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const choisir = (c) => {
    setClasse(c); setLibre("");
    const x = (st.data || []).find((r) => r.classe === c);
    setF({ debut: x?.debut || "", fin: x?.fin || "", examen: x?.examen || "", horaires: x?.horaires || "", salle: x?.salle || "" });
  };

  const save = (e) => {
    e.preventDefault();
    if (!nom) return notify("Choisis une classe.", true);
    run(async () => {
      await q(sb.from("classes_infos").upsert({
        classe: nom, debut: f.debut || null, fin: f.fin || null, examen: f.examen || null,
        horaires: f.horaires.trim(), salle: f.salle.trim(), updated_at: new Date().toISOString(),
      }, { onConflict: "classe" }));
      notify(`Calendrier de « ${nom} » enregistré.`);
      st.reload();
    });
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
      <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Enregistrer ce calendrier</button>
      {(st.data || []).length > 0 && (
        <p className="muted" style={{ marginTop: 14 }}>
          Déjà renseignées : {(st.data || []).map((r) => `${r.classe}${r.debut ? ` (début ${fdate(r.debut)})` : ""}`).join(" · ")}
        </p>
      )}
    </form>
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
      <textarea id="pa-i" rows="5" placeholder={"Banque : …\nIntitulé du compte : …\nN° de compte : …\nConserve ton bordereau et apporte-le à l'administration pour recevoir ton reçu."} value={f.instructions_paiement} onChange={set("instructions_paiement")} />
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
      <Paiement initial={st.data.ecole} onSaved={(row) => appliquerEcole(row)} />
    </>
  );
}
