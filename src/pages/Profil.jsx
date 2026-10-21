import { useState } from "react";
import { sb, q } from "../supabase.js";
import { appliquerEcole } from "../config.js";
import { Loading, useAction, useLoad, useToast } from "../components/ui.jsx";

function Compte({ user }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const meta = user.user_metadata || {};
  const [nom, setNom] = useState(meta.nom || "");
  const [tel, setTel] = useState(meta.telephone || "");

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const { error } = await sb.auth.updateUser({ data: { nom: nom.trim(), telephone: tel.trim() } });
      if (error) throw error;
      notify("Profil enregistré.");
    });
  };

  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ marginTop: 0 }}>Mes informations</h3>
      <label htmlFor="pr-mail">Email de connexion</label>
      <input id="pr-mail" value={user.email || ""} disabled />
      <div className="row">
        <div><label htmlFor="pr-nom">Mon nom</label><input id="pr-nom" value={nom} onChange={(e) => setNom(e.target.value)} /></div>
        <div><label htmlFor="pr-tel">Mon téléphone</label><input id="pr-tel" type="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
      </div>
      <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Enregistrer</button>
    </form>
  );
}

function MotDePasse() {
  const notify = useToast();
  const [run, busy] = useAction();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (p1.length < 8) return notify("8 caractères minimum.", true);
      if (p1 !== p2) return notify("Les deux mots de passe ne sont pas identiques.", true);
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) throw error;
      setP1(""); setP2("");
      notify("Mot de passe modifié.");
    });
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>Mot de passe</h3>
      <div className="row">
        <div><label htmlFor="p1">Nouveau mot de passe</label><input id="p1" type="password" autoComplete="new-password" minLength={8} required value={p1} onChange={(e) => setP1(e.target.value)} /></div>
        <div><label htmlFor="p2">Confirmer</label><input id="p2" type="password" autoComplete="new-password" minLength={8} required value={p2} onChange={(e) => setP2(e.target.value)} /></div>
      </div>
      <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Changer le mot de passe</button>
    </form>
  );
}

function Ecole({ initial, onSaved }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const row = await q(
        sb.from("ecole_parametres")
          .update({
            nom: f.nom.trim(), sous_titre: f.sous_titre.trim(), adresse: f.adresse.trim(), contact: f.contact.trim(),
            ville: f.ville.trim(), direction: f.direction.trim(), directeur: f.directeur.trim(), updated_at: new Date().toISOString(),
          })
          .eq("id", "unique").select().single()
      );
      onSaved(row);
      notify("Informations de l'école enregistrées.");
    });
  };

  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ marginTop: 0 }}>Le centre</h3>
      <p className="muted">Ces informations apparaissent sur les reçus PDF, les notes de rappel et les messages WhatsApp.</p>
      <div className="row">
        <div><label htmlFor="ec-nom">Nom du centre</label><input id="ec-nom" required value={f.nom} onChange={set("nom")} /></div>
        <div><label htmlFor="ec-st">Sous-titre</label><input id="ec-st" value={f.sous_titre} onChange={set("sous_titre")} /></div>
      </div>
      <div className="row">
        <div><label htmlFor="ec-ad">Adresse</label><input id="ec-ad" value={f.adresse} onChange={set("adresse")} /></div>
        <div><label htmlFor="ec-ct">Contact (tél, email)</label><input id="ec-ct" placeholder="Tél : 6 90 00 00 00 | contact@…" value={f.contact} onChange={set("contact")} /></div>
      </div>
      <div className="row">
        <div><label htmlFor="ec-vi">Ville (« Fait à … »)</label><input id="ec-vi" required value={f.ville} onChange={set("ville")} /></div>
        <div><label htmlFor="ec-di">Signature (fonction)</label><input id="ec-di" required value={f.direction} onChange={set("direction")} /></div>
      </div>
      <label htmlFor="ec-dn">Nom du signataire <span className="muted">(facultatif, sous la ligne de signature)</span></label>
      <input id="ec-dn" value={f.directeur} onChange={set("directeur")} />
      <button className="primary" style={{ marginTop: 16 }} disabled={busy}>Enregistrer</button>
    </form>
  );
}

export default function Profil({ onEcole }) {
  const st = useLoad(async () => {
    const [{ data: { user } }, ecole] = await Promise.all([
      sb.auth.getUser(),
      q(sb.from("ecole_parametres").select("*").eq("id", "unique").single()),
    ]);
    return { user, ecole };
  }, []);
  if (!st.data) return <Loading state={st} />;
  return (
    <>
      <h2>Mon profil</h2>
      <Compte user={st.data.user} />
      <MotDePasse />
      <Ecole initial={st.data.ecole} onSaved={(row) => { appliquerEcole(row); onEcole(row); }} />
    </>
  );
}
