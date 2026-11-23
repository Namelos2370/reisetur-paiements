import { useEffect, useState } from "react";
import { sb } from "../supabase.js";
import { ECOLE, appliquerEcole } from "../config.js";
import { fcfa, fdate, modeLabel, noteSur80, maxModules, moduleValide, modulesARepasser, fpts, attestationPossible, noteModule } from "../utils.js";
import { waNumber } from "../data.js";
import { Badge } from "../components/ui.jsx";

// Page publique « Mon profil » (/situation ou /profil) — matricule + code d'accès personnel.
// Option « rester connecté » : les accès sont mémorisés sur l'appareil de l'étudiant (effacés par « Se déconnecter »).
const CLE = "reisetur_acces";
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE) || "null"); } catch { return null; } };
const ecrire = (v) => { try { v ? localStorage.setItem(CLE, JSON.stringify(v)) : localStorage.removeItem(CLE); } catch { /* sans stockage */ } };
const objet = (type, numero) => (type === "inscription" ? "Inscription" : type === "rattrapage" ? "Frais de rattrapage" : `Scolarité — tranche ${numero}`);
const aujourdhui = () => new Date().toISOString().slice(0, 10);

// Icônes en traits fins (style « ligne »), colorées par le texte du bouton
const Ico = ({ d }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((x, i) => <path key={i} d={x} />)}
  </svg>
);
const ICONES = {
  accueil: ["M3 10.5 12 3l9 7.5", "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"],
  paiements: ["M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18", "M7 15h3"],
  cours: ["M2 6.5 12 3l10 3.5-10 3.5z", "M6 8.5V13c0 1.7 2.7 3 6 3s6-1.3 6-3V8.5", "M22 6.5V12"],
  documents: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h6"],
  profil: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"],
};
// « NNTOUBA EBOUELLE RACHEL » → « Nntouba Ebouelle Rachel »
const prenomNom = (n) => String(n || "").toLocaleLowerCase("fr").replace(/(^|[\s'-])(\p{L})/gu, (m, sep, c) => sep + c.toLocaleUpperCase("fr"));

const ONGLETS = ["accueil", "paiements", "cours", "documents", "profil"];
const NIVEAUX = ["A1", "A2", "B1", "B2", "C1"];

// Libellés FR / DE (accueil, onglets et fiche Profil)
const T = {
  fr: {
    accueil: "Accueil", paiements: "Paiements", cours: "Cours", documents: "Documents", profil: "Profil",
    bonjour: "Bonjour,", espace: "Espace étudiant",
    pf_complet: "Profil complété", pf_invite: "Complète ton profil pour faciliter le suivi de ton dossier.",
    parcours: "Progression", niveau_actuel: "Niveau actuel", valide: "Validé", encours: "En cours",
    infos: "Informations personnelles", nom: "Nom complet", matricule: "Matricule", classe: "Classe", niveau: "Niveau", formateur: "Formateur", periode: "Période de cours",
    identite: "État civil", naissance: "Date de naissance", lieu: "Lieu de naissance", nationalite: "Nationalité", modifier: "Modifier", enregistrer: "Enregistrer", annuler: "Annuler", non_renseigne: "Non renseigné",
    examen: "Examen de passage", date: "Date", ecrites: "Épreuves écrites", sprechen: "Sprechen", frais: "Frais", soldes: "Soldés", reste: "Reste",
    coord: "Coordonnées", tel: "Téléphone", email: "E-mail", ville: "Ville", tel_l: "Téléphone (WhatsApp de préférence)",
    contact: "Contacter l'école", whatsapp: "WhatsApp", appeler: "Appeler", adresse: "Adresse", itineraire: "Voir sur la carte",
    securite: "Sécurité", code: "Code d'accès", changer_code: "Changer mon code", nouveau_code: "Nouveau code (6 à 16 caractères : lettres, chiffres, tiret)", derniere: "Dernière connexion", premiere: "Première connexion",
    prefs: "Préférences", theme: "Apparence", clair: "Clair", sombre: "Sombre", langue: "Langue",
    photo_ajouter: "Ajouter une photo", photo_changer: "Changer la photo", photo_retirer: "Retirer",
    deconnexion: "Se déconnecter", ecrire_wa: "Écrire à la direction sur WhatsApp",
  },
  de: {
    accueil: "Start", paiements: "Zahlungen", cours: "Kurs", documents: "Dokumente", profil: "Profil",
    bonjour: "Hallo,", espace: "Studierendenbereich",
    pf_complet: "Profil vollständig", pf_invite: "Vervollständige dein Profil, damit wir deine Akte besser betreuen können.",
    parcours: "Fortschritt", niveau_actuel: "Aktuelles Niveau", valide: "Bestanden", encours: "Laufend",
    infos: "Persönliche Angaben", nom: "Vollständiger Name", matricule: "Matrikelnummer", classe: "Klasse", niveau: "Niveau", formateur: "Dozent/in", periode: "Kurszeitraum",
    identite: "Personalien", naissance: "Geburtsdatum", lieu: "Geburtsort", nationalite: "Staatsangehörigkeit", modifier: "Ändern", enregistrer: "Speichern", annuler: "Abbrechen", non_renseigne: "Nicht angegeben",
    examen: "Abschlusstest", date: "Datum", ecrites: "Schriftliche Prüfungen", sprechen: "Sprechen", frais: "Gebühren", soldes: "Beglichen", reste: "Offen",
    coord: "Kontaktdaten", tel: "Telefon", email: "E-Mail", ville: "Stadt", tel_l: "Telefon (am besten WhatsApp)",
    contact: "Schule kontaktieren", whatsapp: "WhatsApp", appeler: "Anrufen", adresse: "Adresse", itineraire: "Auf der Karte ansehen",
    securite: "Sicherheit", code: "Zugangscode", changer_code: "Code ändern", nouveau_code: "Neuer Code (6–16 Zeichen: Buchstaben, Ziffern, Bindestrich)", derniere: "Letzte Anmeldung", premiere: "Erste Anmeldung",
    prefs: "Einstellungen", theme: "Darstellung", clair: "Hell", sombre: "Dunkel", langue: "Sprache",
    photo_ajouter: "Foto hinzufügen", photo_changer: "Foto ändern", photo_retirer: "Entfernen",
    deconnexion: "Abmelden", ecrire_wa: "Der Schulleitung per WhatsApp schreiben",
  },
};
const memoGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const memoSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sans stockage */ } };
const initiales = (n) => String(n || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toLocaleUpperCase("fr")).join("") || "?";
const Avatar = ({ nom, photo, taille = 64 }) => (
  <span className="pf-avatar" style={{ width: taille, height: taille, fontSize: taille * 0.38 }}>
    {photo ? <img src={photo} alt="" /> : initiales(nom)}
  </span>
);
// Réduit une photo à 200 px (JPEG) avant envoi
const reduirePhoto = (file) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onerror = reject;
  fr.onload = () => {
    const im = new Image();
    im.onerror = reject;
    im.onload = () => {
      const c = document.createElement("canvas"); const t = 200; c.width = t; c.height = t;
      const k = Math.max(t / im.width, t / im.height); const w = im.width * k; const h = im.height * k;
      c.getContext("2d").drawImage(im, (t - w) / 2, (t - h) / 2, w, h);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
});

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

  const invitation = async () => {
    setPdfBusy("invit");
    try {
      const { invitationExamenPdf } = await import("../pdf.js");
      await invitationExamenPdf({ nom: res.nom, matricule: res.matricule, niveau: res.niveau, classe: res.classe, examen: cal.examen, horaires: cal.horaires, salle: cal.salle, sprechen: res.passage?.heure_sprechen, salleSprechen: String(res.niveau || "").toUpperCase().startsWith("A2") ? "Salle Clausthal" : "Salle Humboldt" });
    } catch { setErr("L'invitation n'a pas pu être générée. Réessaie dans un instant."); }
    setPdfBusy("");
  };

  const attestationNiveau = async (r) => {
    setPdfBusy("niv" + r.niveau);
    try {
      const { attestationNiveauPdf } = await import("../pdf.js");
      const p = (res.parcours || []).find((x) => x.niveau === r.niveau);
      await attestationNiveauPdf({ nom: res.nom, matricule: res.matricule, niveau: r.niveau, classe: p?.classe, date_examen: r.date_examen, note: r.note, max: maxModules(r.modules), mention: r.mention, modules: r.modules, naissance: r.releve?.naissance || (res.date_naissance ? fdate(res.date_naissance) + (res.lieu_naissance ? " à " + res.lieu_naissance : "") : undefined) });
    } catch { setErr("L'attestation n'a pas pu être générée. Réessaie dans un instant."); }
    setPdfBusy("");
  };

  const releve = async (r) => {
    setPdfBusy("rel" + r.niveau);
    try {
      const { releveNotesPdf } = await import("../pdf.js");
      const info = r.releve || {};
      await releveNotesPdf({ nom: info.nom || res.nom, naissance: info.naissance, rang: info.rang, rattrapage: info.rattrapage, epreuve: info.epreuve, niveau: r.niveau, date_examen: r.date_examen, note: r.note, mention: r.mention, statut: r.statut, modules: r.modules });
    } catch { setErr("Le relevé n'a pas pu être généré. Réessaie dans un instant."); }
    setPdfBusy("");
  };

  useEffect(() => { document.title = "Espace étudiant · REISETÜR 237"; }, []);
  const [onglet, setOnglet] = useState("accueil");
  const deconnecter = () => { ecrire(null); setOnglet("accueil"); setRes(null); setCode(""); setErr(""); setCoord(null); window.scrollTo({ top: 0 }); };
  const aller = (k) => { setOnglet(k); window.scrollTo({ top: 0 }); };
  const [lang, setLang] = useState(() => (memoGet("sit_lang", "fr") === "de" ? "de" : "fr"));
  const [theme, setTheme] = useState(() => (memoGet("sit_theme", "clair") === "sombre" ? "sombre" : "clair"));
  const t = (k) => T[lang][k] ?? T.fr[k] ?? k;
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "sombre") el.setAttribute("data-sit-theme", "sombre"); else el.removeAttribute("data-sit-theme");
    return () => el.removeAttribute("data-sit-theme");
  }, [theme]);
  const choisirLang = (l) => { setLang(l); memoSet("sit_lang", l); };
  const choisirTheme = (v) => { setTheme(v); memoSet("sit_theme", v); };
  const [ident, setIdent] = useState(null); // { naiss, lieu, nat } en cours de saisie
  const [identMsg, setIdentMsg] = useState("");
  const [secu, setSecu] = useState(null); // { nouveau } en cours de saisie
  const [secuMsg, setSecuMsg] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");
  const [coord, setCoord] = useState(null); // { tel, email, ville } en cours de saisie
  const [coordMsg, setCoordMsg] = useState("");
  const ouvrirCoord = () => { setOnglet("profil"); setCoordMsg(""); setCoord({ tel: res.telephone || "", email: res.email || "", ville: res.ville || "" }); setTimeout(() => document.getElementById("coordonnees")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); };
  const enregistrerCoord = async (e) => {
    e.preventDefault();
    setBusy(true); setCoordMsg("");
    const { data, error } = await sb.rpc("maj_mes_infos", { p_matricule: res.matricule, p_code: code, p_tel: coord.tel, p_email: coord.email, p_ville: coord.ville });
    setBusy(false);
    if (error || !data) return setCoordMsg("Enregistrement impossible pour le moment. Réessaie dans un instant.");
    setRes((r) => ({ ...r, telephone: coord.tel.trim() || null, email: coord.email.trim() || null, ville: coord.ville.trim() || null }));
    setCoord(null); setCoordMsg("Coordonnées enregistrées");
  };

  const enregistrerIdent = async (e) => {
    e.preventDefault();
    setBusy(true); setIdentMsg("");
    const { data, error } = await sb.rpc("maj_mes_identite", { p_matricule: res.matricule, p_code: code, p_naissance: ident.naiss || null, p_lieu: ident.lieu, p_nationalite: ident.nat });
    setBusy(false);
    if (error || !data) return setIdentMsg("Enregistrement impossible. Vérifie la date de naissance puis réessaie.");
    setRes((r) => ({ ...r, date_naissance: ident.naiss || null, lieu_naissance: ident.lieu.trim() || null, nationalite: ident.nat.trim() || null }));
    setIdent(null); setIdentMsg("Informations enregistrées");
  };
  const changerPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setPhotoMsg("");
    try {
      const img = await reduirePhoto(f);
      const { data, error } = await sb.rpc("maj_ma_photo", { p_matricule: res.matricule, p_code: code, p_photo: img });
      if (error || !data) return setPhotoMsg("La photo n'a pas pu être enregistrée.");
      setRes((r) => ({ ...r, photo: img }));
    } catch { setPhotoMsg("Cette image n'a pas pu être lue. Essaie une autre photo."); }
  };
  const retirerPhoto = async () => {
    const { data } = await sb.rpc("maj_ma_photo", { p_matricule: res.matricule, p_code: code, p_photo: null });
    if (data) setRes((r) => ({ ...r, photo: null }));
  };
  const enregistrerCode = async (e) => {
    e.preventDefault();
    setBusy(true); setSecuMsg("");
    const nouveau = secu.nouveau.trim().toUpperCase().replace(/\s/g, "");
    const { data, error } = await sb.rpc("changer_mon_code", { p_matricule: res.matricule, p_code: code, p_nouveau: nouveau });
    setBusy(false);
    if (error) return setSecuMsg("Changement impossible pour le moment. Réessaie dans un instant.");
    if (data === "format") return setSecuMsg("Le code doit faire 6 à 16 caractères (lettres, chiffres ou tiret).");
    if (data === "identique") return setSecuMsg("Le nouveau code doit être différent de l'actuel.");
    if (data !== "ok") return setSecuMsg("Changement refusé.");
    if (lire()) ecrire({ m: res.matricule, c: nouveau });
    setCode(nouveau); setSecu(null); setSecuMsg("Code d'accès modifié. Utilise-le à ta prochaine connexion.");
  };

  // Parcours : un niveau par ligne, avec son résultat d'examen
  const niveauxParcours = [...new Set([...(res?.parcours || []).map((p) => p.niveau), ...(res?.resultats || []).map((r) => r.niveau)])];
  const lignesParcours = niveauxParcours.map((n) => ({
    niveau: n,
    p: (res.parcours || []).find((x) => x.niveau === n),
    r: (res.resultats || []).find((x) => x.niveau === n),
  }));
  const bloque = !!res?.resultats_bloques;
  const niveauxValides = (res?.resultats || []).filter((r) => r.statut === "reussi").map((r) => r.niveau);
  const champsProfil = res ? [res.telephone, res.email, res.ville, res.date_naissance, res.lieu_naissance, res.nationalite, res.photo] : [];
  const completion = champsProfil.length ? Math.round((champsProfil.filter(Boolean).length / champsProfil.length) * 100) : 0;
  const aRepasser = (res?.resultats || []).map((r) => ({ niveau: r.niveau, statut: r.statut, modules: modulesARepasser(r.modules) })).filter((x) => x.modules.length && !bloque);
  const avecModules = (res?.resultats || []).filter((r) => r.modules?.length);
  const attestations = (res?.resultats || []).filter((r) => r.statut === "reussi");

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
          <p>{t("espace")}</p>
        </div>
        {res && (
          <button className="sit-out" onClick={deconnecter} aria-label="Se déconnecter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
            <span>Quitter</span>
          </button>
        )}
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
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar nom={res.nom} photo={res.photo} taille={54} />
                <div style={{ minWidth: 0 }}>
                  <div className="sit-hello">{t("bonjour")}</div>
                  <div className="sit-nom">{prenomNom(res.nom)}</div>
                </div>
              </div>
              <div className="sit-chips">
                <span>{res.matricule}</span>
                {res.classe && <span>{res.classe}</span>}
                {res.niveau && <span>Niveau {res.niveau}</span>}
              </div>
            </section>

            {onglet === "accueil" && (
              <>
            {!res.telephone && !coord && (
              <section className="sit-annonce" style={{ background: "#eef4ff", borderColor: "#b9d0ff" }}>
                <b>Ajoute ton numéro WhatsApp</b>
                <p>Pour que le centre puisse te joindre facilement (rappels, annonces).</p>
                <button className="small primary" onClick={ouvrirCoord}>Ajouter mon numéro</button>
              </section>
            )}

            {bloque && (
              <section className="sit-annonce sit-repasser">
                <b>Résultats bloqués</b>
                <p>Tes résultats et tes notes sont bloqués pour cause de non-paiement de frais dû. Rapproche-toi du centre pour régulariser ta situation : ils te seront accessibles dès le paiement enregistré.</p>
                <button className="small" onClick={() => aller("paiements")}>Voir mes frais</button>
              </section>
            )}

            {aRepasser.map((x) => (
              <section className="sit-annonce sit-repasser" key={x.niveau}>
                <b>Examen {x.niveau} : {x.modules.length > 1 ? "modules" : "module"} à repasser</b>
                <p>{x.modules.map((m) => `${m.m} (${fpts(noteModule(m).pts)}/${noteModule(m).max})`).join(", ")}. {x.statut === "reussi" ? "Ton niveau est validé, mais ces modules doivent être repassés." : "Ces modules doivent être repassés pour valider ton niveau."} Rapproche-toi du centre pour connaître la date de la prochaine session.</p>
                <button className="small" onClick={() => aller("cours")}>Voir mes résultats</button>
              </section>
            ))}

            {res.annonces?.length > 0 && (
              <section className="sit-annonces">
                {res.annonces.map((a, i) => (
                  <div className="sit-annonce" key={i}>
                    {a.date_evenement && <span className="sit-evt">{fdate(a.date_evenement)}</span>}
                    <b>{a.titre}</b>
                    {a.message && <p>{a.message}</p>}
                    {a.classe && <small>{a.classe}</small>}
                  </div>
                ))}
              </section>
            )}

            <section className={"sit-card sit-resume" + (res.reste === 0 ? " ok" : "")}>
              <div className="sit-reste-l">{res.reste === 0 ? "Situation à jour" : "Reste à payer"}</div>
              <div className="sit-reste">{res.reste === 0 ? "Tout est réglé" : fcfa(res.reste)}</div>
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

              </>
            )}

            {onglet === "paiements" && (
              <>
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

            {ecoleInfo.instructions_paiement && (
              <>
                <h3 className="sit-h">Comment payer</h3>
                <section className="sit-card sit-pay">{ecoleInfo.instructions_paiement}</section>
              </>
            )}

            <p className="sit-foot">Les paiements se font au centre : un reçu officiel t'est remis à chaque versement.</p>

              </>
            )}

            {onglet === "cours" && (
              <>
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
                        {r ? <Badge def={r.statut === "bloque" ? ["Bloqué", "bad"] : r.statut === "reussi" ? ["Réussi", "ok"] : r.statut === "echec" ? ["Non validé", "bad"] : ["Résultat à venir", "neutral"]} /> : niveau !== res.niveau ? <Badge def={["Terminé", "neutral"]} /> : null}
                      </div>
                      <div className="sit-row-bot" style={{ marginTop: 6 }}>
                        <span>{p?.classe || ""}{p?.debut ? ` · depuis le ${fdate(p.debut)}` : ""}</span>
                        {r && (r.note != null || r.mention) && <span>{r.note != null ? `Note ${noteSur80(r.note, maxModules(r.modules))}` : ""}{r.note != null && r.mention ? " · " : ""}{r.mention || ""}</span>}
                      </div>
                      {r?.modules?.length > 0 && (
                        <div className="sit-mod">
                          {r.modules.map((m) => (
                            <div key={m.m} className={moduleValide(m) ? "ok" : "ko"}><span>{m.m}{m.ratt ? " · rattrapage" : ""}</span><b>{fpts(noteModule(m).pts)}/{noteModule(m).max}</b><i>{moduleValide(m) ? "Validé" : "À repasser"}</i>{m.ratt && <small>Examen initial : {fpts(m.pts)}/{m.max}</small>}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              </>
            )}

              {!(cal && (cal.debut || cal.fin || cal.examen || cal.horaires || cal.salle || cal.formateur)) && lignesParcours.length === 0 && <p className="muted">Le calendrier de ta classe sera bientôt publié.</p>}

              </>
            )}

            {onglet === "documents" && (
              <>
            <h3 className="sit-h">Mes documents</h3>
            <section className="sit-list">
              <div className="sit-row recu">
                <div><b>Attestation d'inscription</b><div className="muted">{inscrite ? "Disponible" : "Disponible dès que l'inscription est réglée"}</div></div>
                <button className="small" disabled={!inscrite || pdfBusy === "attestation"} onClick={attestation}>{pdfBusy === "attestation" ? "…" : "Télécharger"}</button>
              </div>
              {cal?.examen && (
                <div className="sit-row recu">
                  <div><b>Invitation à l'examen de passage</b><div className="muted">{res.reste > 0 ? `Disponible une fois tes frais réglés (reste ${res.reste.toLocaleString("fr-FR")} FCFA)` : `Examen du ${fdate(cal.examen)}${res.passage?.heure_sprechen ? ` · Sprechen à ${res.passage.heure_sprechen}` : ""}`}</div></div>
                  <button className="small" disabled={res.reste > 0 || pdfBusy === "invit"} onClick={invitation}>{pdfBusy === "invit" ? "…" : res.reste > 0 ? "Frais à régler" : "Télécharger"}</button>
                </div>
              )}
              {bloque && (
                <div className="sit-row recu">
                  <div><b>Relevé de notes et attestations</b><div className="muted">Bloqués pour cause de non-paiement de frais dû</div></div>
                  <button className="small" disabled>Bloqué</button>
                </div>
              )}
              {avecModules.map((r) => (
                <div className="sit-row recu" key={"rel" + r.niveau}>
                  <div><b>Relevé de notes {r.niveau}</b><div className="muted">Résultats de l'épreuve finale{r.date_examen ? ` · ${fdate(r.date_examen)}` : ""}</div></div>
                  <button className="small" disabled={pdfBusy === "rel" + r.niveau} onClick={() => releve(r)}>{pdfBusy === "rel" + r.niveau ? "…" : "Télécharger"}</button>
                </div>
              ))}
              {attestations.map((r) => {
                const ok = attestationPossible(r);
                const restants = modulesARepasser(r.modules);
                return (
                  <div className="sit-row recu" key={r.niveau}>
                    <div><b>Attestation de niveau {r.niveau}</b><div className="muted">{ok ? `Niveau validé${r.date_examen ? ` · examen du ${fdate(r.date_examen)}` : ""}` : `Disponible quand tous les modules seront validés (à repasser : ${restants.map((m) => m.m).join(", ")})`}</div></div>
                    <button className="small" disabled={!ok || pdfBusy === "niv" + r.niveau} onClick={() => attestationNiveau(r)}>{pdfBusy === "niv" + r.niveau ? "…" : "Télécharger"}</button>
                  </div>
                );
              })}
              {(res.documents || []).map((d, i) => (
                <div className="sit-row recu" key={i}>
                  <div><b>{d.titre}</b><div className="muted">Support de cours</div></div>
                  <a className="sit-lien" href={d.url} target="_blank" rel="noreferrer">Ouvrir</a>
                </div>
              ))}
            </section>

              </>
            )}

            {onglet === "profil" && (
              <>
            <section className="pf-hero">
              <Avatar nom={res.nom} photo={res.photo} taille={84} />
              <div className="pf-hero-t">
                <b>{prenomNom(res.nom)}</b>
                <span>{res.matricule}{res.classe ? ` · ${res.classe}` : ""}</span>
                <div className="pf-photo-actions">
                  <label className="small pf-btn">{res.photo ? t("photo_changer") : t("photo_ajouter")}<input type="file" accept="image/*" onChange={changerPhoto} hidden /></label>
                  {res.photo && <button type="button" className="small pf-btn" onClick={retirerPhoto}>{t("photo_retirer")}</button>}
                </div>
              </div>
            </section>
            {photoMsg && <p className="badge bad" style={{ display: "block", marginBottom: 12 }}>{photoMsg}</p>}

            <section className="pf-card pf-progress">
              <div className="pf-progress-top"><b>{t("pf_complet")}</b><span>{completion}%</span></div>
              <div className="pf-bar"><i style={{ width: completion + "%" }} /></div>
              {completion < 100 && <p className="muted" style={{ margin: "8px 0 0", fontSize: ".88rem" }}>{t("pf_invite")}</p>}
            </section>

            <section className="pf-card">
              <div className="pf-head"><Ico d={ICONES.cours} /><b>{t("parcours")}</b></div>
              <div className="pf-steps">
                {NIVEAUX.map((n) => {
                  const ok = niveauxValides.includes(n); const cur = n === res.niveau && !ok;
                  return (
                    <div key={n} className={"pf-step" + (ok ? " ok" : cur ? " cur" : "")}>
                      <i>{ok ? "✓" : n}</i>
                      <span>{ok ? t("valide") : cur ? t("encours") : n}</span>
                    </div>
                  );
                })}
              </div>
              <div className="pf-row"><span>{t("niveau_actuel")}</span><b>{res.niveau || "—"}</b></div>
            </section>

            <section className="pf-card">
              <div className="pf-head"><Ico d={ICONES.profil} /><b>{t("infos")}</b></div>
              <div className="pf-row"><span>{t("nom")}</span><b>{prenomNom(res.nom)}</b></div>
              <div className="pf-row"><span>{t("matricule")}</span><b>{res.matricule}</b></div>
              <div className="pf-row"><span>{t("classe")}</span><b>{res.classe || "—"}</b></div>
              <div className="pf-row"><span>{t("niveau")}</span><b>{res.niveau || "—"}</b></div>
              {cal?.formateur && <div className="pf-row"><span>{t("formateur")}</span><b>{cal.formateur}</b></div>}
              {(cal?.debut || cal?.fin) && <div className="pf-row"><span>{t("periode")}</span><b>{cal.debut ? fdate(cal.debut) : "…"} → {cal.fin ? fdate(cal.fin) : "…"}</b></div>}
            </section>

            <section className="pf-card" id="identite">
              <div className="pf-head"><Ico d={ICONES.documents} /><b>{t("identite")}</b>{!ident && <button className="small pf-edit" onClick={() => { setIdentMsg(""); setIdent({ naiss: res.date_naissance || "", lieu: res.lieu_naissance || "", nat: res.nationalite || "" }); }}>{t("modifier")}</button>}</div>
              {!ident ? (
                <>
                  <div className="pf-row"><span>{t("naissance")}</span><b className={res.date_naissance ? "" : "pf-vide"}>{res.date_naissance ? fdate(res.date_naissance) : t("non_renseigne")}</b></div>
                  <div className="pf-row"><span>{t("lieu")}</span><b className={res.lieu_naissance ? "" : "pf-vide"}>{res.lieu_naissance || t("non_renseigne")}</b></div>
                  <div className="pf-row"><span>{t("nationalite")}</span><b className={res.nationalite ? "" : "pf-vide"}>{res.nationalite || t("non_renseigne")}</b></div>
                  {identMsg && <p className="sit-note" style={{ color: "var(--ok)", margin: 0, padding: "10px 18px 14px" }}>{identMsg}</p>}
                </>
              ) : (
                <form onSubmit={enregistrerIdent} style={{ padding: "6px 18px 18px" }}>
                  <label htmlFor="id-n">{t("naissance")}</label>
                  <input id="id-n" type="date" value={ident.naiss} max={aujourdhui()} onChange={(e) => setIdent({ ...ident, naiss: e.target.value })} />
                  <label htmlFor="id-l">{t("lieu")}</label>
                  <input id="id-l" value={ident.lieu} onChange={(e) => setIdent({ ...ident, lieu: e.target.value })} />
                  <label htmlFor="id-a">{t("nationalite")}</label>
                  <input id="id-a" value={ident.nat} onChange={(e) => setIdent({ ...ident, nat: e.target.value })} />
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button className="primary" disabled={busy}>{t("enregistrer")}</button>
                    <button type="button" onClick={() => setIdent(null)}>{t("annuler")}</button>
                  </div>
                  {identMsg && <p className="badge bad" style={{ marginTop: 12, display: "block" }}>{identMsg}</p>}
                </form>
              )}
            </section>

            {cal?.examen && (
              <section className="pf-card">
                <div className="pf-head"><Ico d={ICONES.documents} /><b>{t("examen")}</b></div>
                <div className="pf-row"><span>{t("date")}</span><b>{fdate(cal.examen)}</b></div>
                {cal.horaires && <div className="pf-row"><span>{t("ecrites")}</span><b>{cal.horaires}{cal.salle ? ` · ${cal.salle}` : ""}</b></div>}
                {res.passage?.heure_sprechen && <div className="pf-row"><span>{t("sprechen")}</span><b>{res.passage.heure_sprechen} · {String(res.niveau || "").toUpperCase().startsWith("A2") ? "Salle Clausthal" : "Salle Humboldt"}</b></div>}
                <div className="pf-row"><span>{t("frais")}</span><b className={res.reste > 0 ? "pf-bad" : "pf-ok"}>{res.reste > 0 ? `${t("reste")} ${res.reste.toLocaleString("fr-FR")} FCFA` : t("soldes")}</b></div>
              </section>
            )}

            <section className="pf-card" id="coordonnees">
              <div className="pf-head"><Ico d={ICONES.paiements} /><b>{t("coord")}</b>{!coord && <button className="small pf-edit" onClick={ouvrirCoord}>{t("modifier")}</button>}</div>
              {!coord ? (
                <>
                  <div className="pf-row"><span>{t("tel")}</span><b className={res.telephone ? "" : "pf-vide"}>{res.telephone || t("non_renseigne")}</b></div>
                  <div className="pf-row"><span>{t("email")}</span><b className={res.email ? "" : "pf-vide"}>{res.email || t("non_renseigne")}</b></div>
                  <div className="pf-row"><span>{t("ville")}</span><b className={res.ville ? "" : "pf-vide"}>{res.ville || t("non_renseigne")}</b></div>
                  {coordMsg && <p className="sit-note" style={{ color: "var(--ok)", margin: "0", padding: "10px 18px 14px" }}>{coordMsg}</p>}
                </>
              ) : (
                <form onSubmit={enregistrerCoord} style={{ padding: "6px 18px 18px" }}>
                  <label htmlFor="co-t">{t("tel_l")}</label>
                  <input id="co-t" type="tel" value={coord.tel} onChange={(e) => setCoord({ ...coord, tel: e.target.value })} />
                  <label htmlFor="co-e">{t("email")}</label>
                  <input id="co-e" type="email" value={coord.email} onChange={(e) => setCoord({ ...coord, email: e.target.value })} />
                  <label htmlFor="co-v">{t("ville")}</label>
                  <input id="co-v" value={coord.ville} onChange={(e) => setCoord({ ...coord, ville: e.target.value })} />
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button className="primary" disabled={busy}>{t("enregistrer")}</button>
                    <button type="button" onClick={() => setCoord(null)}>{t("annuler")}</button>
                  </div>
                  {coordMsg && <p className="badge bad" style={{ marginTop: 12, display: "block" }}>{coordMsg}</p>}
                </form>
              )}
            </section>

            {(wa || ecoleInfo.adresse || ecoleInfo.contact) && (
              <section className="pf-card">
                <div className="pf-head"><Ico d={ICONES.accueil} /><b>{t("contact")}</b></div>
                {ecoleInfo.adresse && <div className="pf-row"><span>{t("adresse")}</span><b>{ecoleInfo.adresse}</b></div>}
                {ecoleInfo.contact && <div className="pf-row"><span>{lang === "de" ? "Kontakt" : "Contact"}</span><b>{ecoleInfo.contact}</b></div>}
                <div className="pf-actions">
                  {wa && <a className="pf-act wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Bonjour, je suis ${res.nom} (matricule ${res.matricule}).`)}`} target="_blank" rel="noreferrer">{t("whatsapp")}</a>}
                  {wa && <a className="pf-act" href={`tel:+${wa}`}>{t("appeler")}</a>}
                  {ecoleInfo.adresse && <a className="pf-act" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ecoleInfo.nom || ECOLE.nom} ${ecoleInfo.adresse}`)}`} target="_blank" rel="noreferrer">{t("itineraire")}</a>}
                </div>
              </section>
            )}

            <section className="pf-card">
              <div className="pf-head"><Ico d={ICONES.paiements} /><b>{t("securite")}</b>{!secu && <button className="small pf-edit" onClick={() => { setSecuMsg(""); setSecu({ nouveau: "" }); }}>{t("changer_code")}</button>}</div>
              <div className="pf-row"><span>{t("derniere")}</span><b>{res.derniere_connexion ? new Date(res.derniere_connexion).toLocaleString(lang === "de" ? "de-DE" : "fr-FR", { dateStyle: "medium", timeStyle: "short" }) : t("premiere")}</b></div>
              {secu && (
                <form onSubmit={enregistrerCode} style={{ padding: "6px 18px 18px" }}>
                  <label htmlFor="sc-n">{t("nouveau_code")}</label>
                  <input id="sc-n" value={secu.nouveau} autoComplete="new-password" onChange={(e) => setSecu({ nouveau: e.target.value })} />
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button className="primary" disabled={busy || secu.nouveau.trim().length < 6}>{t("enregistrer")}</button>
                    <button type="button" onClick={() => setSecu(null)}>{t("annuler")}</button>
                  </div>
                </form>
              )}
              {secuMsg && <p className={secuMsg.startsWith("Code d'accès modifié") ? "sit-note" : "badge bad"} style={{ margin: 0, padding: "10px 18px 14px", display: "block", color: secuMsg.startsWith("Code d'accès modifié") ? "var(--ok)" : undefined }}>{secuMsg}</p>}
            </section>

            <section className="pf-card">
              <div className="pf-head"><Ico d={ICONES.profil} /><b>{t("prefs")}</b></div>
              <div className="pf-row"><span>{t("theme")}</span>
                <div className="pf-seg"><button type="button" className={theme === "clair" ? "on" : ""} onClick={() => choisirTheme("clair")}>{t("clair")}</button><button type="button" className={theme === "sombre" ? "on" : ""} onClick={() => choisirTheme("sombre")}>{t("sombre")}</button></div>
              </div>
              <div className="pf-row"><span>{t("langue")}</span>
                <div className="pf-seg"><button type="button" className={lang === "fr" ? "on" : ""} onClick={() => choisirLang("fr")}>Français</button><button type="button" className={lang === "de" ? "on" : ""} onClick={() => choisirLang("de")}>Deutsch</button></div>
              </div>
            </section>

            <button className="block" onClick={deconnecter}>{t("deconnexion")}</button>

              </>
            )}

            <nav className="sit-tabs" aria-label="Navigation">
              {ONGLETS.map((k) => (
                <button key={k} className={onglet === k ? "on" : ""} onClick={() => aller(k)} aria-current={onglet === k ? "page" : undefined}><span className="pf-ico"><Ico d={ICONES[k]} />{k === "profil" && completion < 100 && <i className="pf-dot" aria-label="Profil incomplet" />}</span>{t(k)}</button>
              ))}
            </nav>
          </>
        )}
      </main>
    </div>
  );
}
