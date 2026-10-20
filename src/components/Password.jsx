import { useState } from "react";
import { sb } from "../supabase.js";
import { Modal, useAction, useToast } from "./ui.jsx";

export default function Password({ onClose }) {
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
      notify("Mot de passe modifié.");
      onClose();
    });
  };

  return (
    <Modal onClose={onClose}>
      <div className="between">
        <h2>Changer mon mot de passe</h2>
        <button className="small" onClick={onClose}>Fermer</button>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="p1">Nouveau mot de passe</label>
        <input id="p1" type="password" autoComplete="new-password" minLength={8} required value={p1} onChange={(e) => setP1(e.target.value)} />
        <label htmlFor="p2">Confirmer</label>
        <input id="p2" type="password" autoComplete="new-password" minLength={8} required value={p2} onChange={(e) => setP2(e.target.value)} />
        <button className="primary block" disabled={busy}>Enregistrer</button>
      </form>
    </Modal>
  );
}
