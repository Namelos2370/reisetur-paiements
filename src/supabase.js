import { createClient } from "@supabase/supabase-js";

// Clé publique : la sécurité repose sur les règles RLS de la base.
const url = import.meta.env.VITE_SUPABASE_URL || "https://xhsybovyqpgqlsfmutla.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_g2m8SYkUcisLGfnK-NnjSg_bx5GvAOp";

export const sb = createClient(url, key);

// Lève l'erreur Supabase si présente, sinon renvoie les données.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

// Tant que la colonne mode_paiement n'existe pas en base (SQL v5 pas encore exécuté), on réessaie sans elle.
export async function avecMode(faire) {
  try { return await faire(true); }
  catch (e) {
    if (String(e?.message || "").includes("mode_paiement")) return faire(false);
    throw e;
  }
}

// Même principe pour une colonne ajoutée plus tard (ex. formateur) : réessai sans elle si la base n'est pas encore à jour.
export async function avecColonne(col, faire) {
  try { return await faire(true); }
  catch (e) {
    if (String(e?.message || "").includes(col)) return faire(false);
    throw e;
  }
}
