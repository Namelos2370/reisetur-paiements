import { useEffect, useRef, useState } from "react";
import { sb, q } from "./supabase.js";
import { friendly } from "./utils.js";
import { ToastProvider, useAction, useToast } from "./components/ui.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Encaisser from "./pages/Encaisser.jsx";
import Etudiants from "./pages/Etudiants.jsx";
import Validations from "./pages/Validations.jsx";
import Verifier from "./pages/Verifier.jsx";
import Journal from "./pages/Journal.jsx";
import Relances from "./pages/Relances.jsx";
import Exports from "./pages/Exports.jsx";
import PublicVerifier from "./pages/PublicVerifier.jsx";
import Profil from "./pages/Profil.jsx";
import { ECOLE, appliquerEcole } from "./config.js";

const TABS = [
  ["dashboard", "Tableau de bord"],
  ["valider", "À valider"],
  ["encaisser", "Nouvel encaissement"],
  ["etudiants", "Étudiants"],
];
// Sections secondaires : dans le menu qui s'ouvre en cliquant sur le logo / le nom du centre
const MENU = [
  ["relances", "Relances et notes"],
  ["exports", "Exports Excel"],
  ["verifier", "Vérifier un reçu"],
  ["journal", "Journal"],
  ["profil", "Mon profil"],
];

function Login({ message, onDone }) {
  const notify = useToast();
  const [run, busy] = useAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signIn = (e) => {
    e.preventDefault();
    run(async () => {
      await q(sb.auth.signInWithPassword({ email: email.trim(), password }));
      await onDone();
    });
  };

  const signUp = (e) => {
    e.preventDefault();
    run(async () => {
      if (!email.trim() || password.length < 8)
        return notify("Saisis un email et un mot de passe de 8 caractères minimum.", true);
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (data.session) await onDone();
      else notify("Compte créé. Confirme l'email reçu, puis connecte-toi.");
    });
  };

  return (
    <div className="center card">
      <img src="/logo.png" alt="" style={{ height: 110, display: "block", margin: "0 auto 8px" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <h2>Reisetür 237</h2>
      <p className="muted">Gestion des encaissements — accès réservé.</p>
      {message && <p className="badge bad">{message}</p>}
      <form onSubmit={signIn}>
        <label htmlFor="em">Email</label>
        <input id="em" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="pw">Mot de passe</label>
        <input id="pw" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="primary block" disabled={busy}>Se connecter</button>
      </form>
      <p className="muted" style={{ fontSize: ".9rem" }}>
        Première utilisation ? <a href="#" onClick={signUp}>Créer le compte administrateur</a>
      </p>
    </div>
  );
}

function Shell({ onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const [preselect, setPreselect] = useState(null);
  const [nomCentre, setNomCentre] = useState(ECOLE.nom);
  const menuRef = useRef(null);

  useEffect(() => {
    sb.from("ecole_parametres").select("*").eq("id", "unique").maybeSingle()
      .then(({ data }) => { if (data) { appliquerEcole(data); setNomCentre(data.nom); } });
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const go = (id) => { setPreselect(null); setTab(id); setMenu(false); };
  const goEncaisser = (etudiantId) => { setPreselect(etudiantId); setTab("encaisser"); };
  const dansMenu = MENU.find(([id]) => id === tab);

  return (
    <>
      <header className="top" ref={menuRef}>
        <button className="brand" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <img src="/logo.png" alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <span className="brand-t">{nomCentre}<small>Gestion des paiements</small></span>
          <span className="caret" aria-hidden="true">{menu ? "▴" : "▾"}</span>
        </button>
        {menu && (
          <div className="menu" role="menu">
            {MENU.map(([id, label]) => (
              <button key={id} role="menuitem" className={tab === id ? "active" : ""} onClick={() => go(id)}>{label}</button>
            ))}
            <hr />
            <button role="menuitem" onClick={onLogout}>Déconnexion</button>
          </div>
        )}
      </header>
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => go(id)}>{label}</button>
        ))}
        {dansMenu && <button className="active">{dansMenu[1]}</button>}
      </nav>
      <main>
        {tab === "dashboard" && <Dashboard onValider={() => setTab("valider")} />}
        {tab === "valider" && <Validations />}
        {tab === "encaisser" && <Encaisser preselect={preselect} />}
        {tab === "etudiants" && <Etudiants onEncaisser={goEncaisser} />}
        {tab === "relances" && <Relances />}
        {tab === "exports" && <Exports />}
        {tab === "verifier" && <Verifier />}
        {tab === "journal" && <Journal />}
        {tab === "profil" && <Profil onEcole={(r) => setNomCentre(r.nom)} />}
      </main>
    </>
  );
}

function Root() {
  const [status, setStatus] = useState("loading"); // loading | out | in
  const [message, setMessage] = useState("");

  const boot = async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return setStatus("out");
    const ok = await q(sb.rpc("claim_admin"));
    if (!ok) {
      await sb.auth.signOut();
      setMessage("Accès refusé : ce compte n'est pas administrateur.");
      return setStatus("out");
    }
    setMessage("");
    setStatus("in");
  };

  useEffect(() => {
    boot().catch((e) => { setMessage(friendly(e)); setStatus("out"); });
    const { data: sub } = sb.auth.onAuthStateChange((ev) => ev === "SIGNED_OUT" && setStatus("out"));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === "loading") return <p className="muted" style={{ padding: 24 }}>Chargement…</p>;
  if (status === "out") return <Login message={message} onDone={boot} />;
  return <Shell onLogout={() => sb.auth.signOut()} />;
}

export default function App() {
  // Page publique de vérification d'un reçu (sans connexion) : /verifier
  const publique = window.location.pathname.replace(/\/+$/, "") === "/verifier";
  return (
    <ToastProvider>
      {publique ? <PublicVerifier /> : <Root />}
    </ToastProvider>
  );
}
