import { useState } from "react";
import { sb } from "../supabase.js";
import { fdatetime } from "../utils.js";
import { useAction, useLoad, useToast } from "../components/ui.jsx";

// Tables incluses dans la sauvegarde (celles qui n'existent pas encore sont simplement ignorées)
export const TABLES = [
  "ecole_parametres", "tarifs_niveau", "etudiants", "parcours", "frais", "tranches", "encaissements",
  "matricule_compteur", "classes_infos", "annonces", "documents", "resultats", "rappels", "journal_audit",
];

async function lireTable(nom) {
  const lignes = [];
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await sb.from(nom).select("*").range(debut, debut + 999);
    if (error) return { erreur: error.message, lignes };
    lignes.push(...data);
    if (data.length < 1000) break;
  }
  return { lignes };
}

export const joursDepuis = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export default function Sauvegarde() {
  const notify = useToast();
  const [run, busy] = useAction();
  const [recap, setRecap] = useState(null);
  const st = useLoad(async () => {
    const { data } = await sb.from("sauvegardes").select("*").order("created_at", { ascending: false }).limit(5);
    return data || [];
  }, []);

  const sauvegarder = () =>
    run(async () => {
      const tables = {};
      const resume = [];
      for (const nom of TABLES) {
        const r = await lireTable(nom);
        if (r.erreur && !r.lignes.length) { resume.push([nom, null]); continue; }
        tables[nom] = r.lignes;
        resume.push([nom, r.lignes.length]);
      }
      const total = resume.reduce((s, [, n]) => s + (n || 0), 0);
      const contenu = { application: "Reisetür 237 — gestion des paiements", date: new Date().toISOString(), tables };
      const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Reisetur237_sauvegarde_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      await sb.from("sauvegardes").insert({ nb_lignes: total }); // trace de la sauvegarde (ignorée si la table n'existe pas encore)
      setRecap(resume);
      notify(`Sauvegarde téléchargée (${total} lignes).`);
      st.reload();
    });

  const derniere = st.data?.[0];
  const jours = derniere ? joursDepuis(derniere.created_at) : null;

  return (
    <>
      <h2>Sauvegarde</h2>
      <p className="muted">Un fichier complet de toutes tes données (étudiants, frais, paiements, journal…), à conserver en lieu sûr.</p>

      <div className={"card" + (jours == null || jours > 7 ? "" : " success")}>
        {derniere ? (
          <p style={{ margin: 0 }}>
            Dernière sauvegarde : <b>{fdatetime(derniere.created_at)}</b> ({jours === 0 ? "aujourd'hui" : `il y a ${jours} jour${jours > 1 ? "s" : ""}`}).
            {jours > 7 && <span className="badge bad" style={{ marginLeft: 8 }}>À refaire</span>}
          </p>
        ) : (
          <p style={{ margin: 0 }}>Aucune sauvegarde enregistrée pour le moment.</p>
        )}
        <button className="primary" style={{ marginTop: 14 }} disabled={busy} onClick={sauvegarder}>{busy ? "Sauvegarde en cours…" : "Télécharger une sauvegarde complète"}</button>
      </div>

      {recap && (
        <div className="card tablewrap">
          <h3 style={{ marginTop: 0 }}>Contenu du fichier</h3>
          <table>
            <thead><tr><th>Table</th><th>Lignes</th></tr></thead>
            <tbody>
              {recap.map(([nom, n]) => <tr key={nom}><td>{nom}</td><td>{n == null ? <span className="muted">non disponible</span> : n}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Bonnes pratiques</h3>
        <ul>
          <li><b>Fréquence :</b> une sauvegarde par semaine, et toujours avant une grosse opération (import, correction en masse).</li>
          <li><b>Où la garder :</b> sur ton ordinateur <em>et</em> dans un deuxième endroit (Google Drive, clé USB). Le fichier contient des données personnelles : ne le partage pas.</li>
          <li><b>Ce qui n'est pas dans le fichier :</b> les photos de bordereaux (stockées à part dans Supabase) et les comptes de connexion.</li>
          <li><b>Sauvegardes automatiques de Supabase :</b> selon ton offre, elles peuvent exister ou non. Vérifie dans Supabase › Database › Backups : si cette page n'en propose pas, cette sauvegarde manuelle est ta seule protection.</li>
          <li><b>Restauration :</b> en cas de problème, envoie le fichier à ton développeur : il contient chaque table, ligne par ligne, et permet de tout remettre en place.</li>
        </ul>
      </div>

      {st.data?.length > 1 && (
        <div className="card tablewrap">
          <h3 style={{ marginTop: 0 }}>Historique des sauvegardes</h3>
          <table>
            <thead><tr><th>Date</th><th>Lignes sauvegardées</th></tr></thead>
            <tbody>{st.data.map((s) => <tr key={s.id}><td>{fdatetime(s.created_at)}</td><td>{s.nb_lignes}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
