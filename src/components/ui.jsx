import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MODES, friendly, refHint, refLabel } from "../utils.js";

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();
  const notify = useCallback((msg, err = false) => {
    setT({ msg, err });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), err ? 6500 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={notify}>
      {children}
      {t && <div className={"toast" + (t.err ? " err" : "")} role="status">{t.msg}</div>}
    </ToastCtx.Provider>
  );
}

// Exécute une action async avec gestion d'erreur + état "occupé"
export function useAction() {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn) => {
      setBusy(true);
      try {
        return await fn();
      } catch (e) {
        console.error(e);
        notify(friendly(e), true);
      } finally {
        setBusy(false);
      }
    },
    [notify]
  );
  return [run, busy];
}

// Champs « mode de paiement » + référence, communs à Encaisser et À valider
export function ChampsMode({ mode, setMode, refVal, setRef, id }) {
  return (
    <>
      <label htmlFor={id + "-mode"}>Mode de paiement</label>
      <select id={id + "-mode"} value={mode} onChange={(e) => setMode(e.target.value)}>
        {MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {mode !== "especes" && (
        <>
          <label htmlFor={id + "-ref"}>{refLabel(mode)}</label>
          <input id={id + "-ref"} placeholder={refHint(mode)} value={refVal} onChange={(e) => setRef(e.target.value)} />
        </>
      )}
    </>
  );
}

export function Badge({ def, children }) {
  const [label, kind] = def || [children, "neutral"];
  return <span className={"badge " + kind}>{label}</span>;
}

export function Modal({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

// Charge des données async au montage / quand deps changent
export function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const reload = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => reload(), [reload]);
  return { ...state, reload };
}

export function Loading({ state }) {
  if (state.loading) return <p className="muted">Chargement…</p>;
  if (state.error) return <p className="badge bad">{friendly(state.error)}</p>;
  return null;
}
