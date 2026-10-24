// Valeurs par défaut des informations de l'école (modifiables ensuite dans « Mon profil »).

//
// Logo (facultatif) : place un fichier  public/logo.png  dans le projet,
// il apparaîtra automatiquement en haut à gauche des documents.
export const ECOLE = {
  nom: "REISETÜR 237",
  sousTitre: "Cours d'allemand",
  adresse: "Yaoundé, Cameroun",
  contact: "", // ex. "Tél : 6 90 00 00 00  |  contact@reisetur237.com"
  ville: "Yaoundé",
  direction: "La Direction",
  whatsapp: "",
  instructionsPaiement: "",
  directeur: "", // nom affiché sous la ligne de signature (facultatif)
};

// Les valeurs ci-dessus sont les valeurs par défaut ; une fois connecté, les paramètres
// enregistrés dans « Mon profil » (table ecole_parametres) les remplacent.
export function appliquerEcole(row) {
  if (!row) return ECOLE;
  Object.assign(ECOLE, {
    nom: row.nom, sousTitre: row.sous_titre, adresse: row.adresse, contact: row.contact,
    ville: row.ville, direction: row.direction, directeur: row.directeur,
    whatsapp: row.whatsapp || "", instructionsPaiement: row.instructions_paiement || "",
  });
  return ECOLE;
}
