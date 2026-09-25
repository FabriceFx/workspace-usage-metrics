/**
 * Métrique d'usage — cache des jours de rapport. Introduit en v0.2.
 *
 * Un rapport d'usage publié ne change plus. Le redemander à chaque génération
 * coûtait trente jours × (utilisateurs du domaine / 1 000) appels, soit
 * plusieurs minutes sur un domaine de quelques milliers de comptes — au-delà
 * du plafond des six minutes. Avec le cache, un rapport quotidien ne demande
 * plus que le jour nouveau.
 *
 * Le cache vit dans un onglet masqué, et non dans PropertiesService : 9 Ko par
 * valeur n'y suffiraient pas. Une ligne par (jour, compte), plus une ligne
 * témoin `*` qui dit « ce jour a été lu en entier et n'est pas provisoire ».
 * Un jour sans témoin n'est pas fiable : il est purgé au rapport suivant.
 *
 * Le cache n'est valable que pour une liste de comptes et de paramètres
 * donnée : un compte ajouté serait absent de tous les jours en cache, donc
 * déclaré « absent du rapport » à tort. La signature de la liste est gardée
 * à part ; si elle change, le cache repart de zéro.
 */

const ENTETES_CACHE = Object.freeze(['Jour', 'Compte', 'Valeurs']);
const TEMOIN_JOUR_COMPLET = '*';

/** Empreinte courte de la liste des comptes et des paramètres. */
const signatureCache_ = (comptes, params) => Utilities.base64Encode(Utilities.computeDigest(
  Utilities.DigestAlgorithm.SHA_256,
  `${[...comptes].sort().join(',')}|${[...params].sort().join(',')}`,
  Utilities.Charset.UTF_8));

const ongletCache_ = (classeur) => {
  const existant = classeur.getSheetByName(CONFIG.ONGLET_CACHE);
  if (existant) return existant;
  const feuille = classeur.insertSheet(CONFIG.ONGLET_CACHE);
  feuille.getRange(1, 1, 1, ENTETES_CACHE.length).setValues([ENTETES_CACHE]);
  // Texte brut en colonne A, pour que Sheets ne convertisse pas le jour en
  // date. La lecture normalise quand même : on ne se fie pas à ce que Sheets
  // fait d'une valeur en la stockant.
  feuille.getRange('A:A').setNumberFormat('@');
  feuille.hideSheet();
  return feuille;
};

/**
 * Lit tout le cache. Rend `{ complets, valeurs }` : l'ensemble des jours
 * témoins, et jour → (compte → valeurs).
 *
 * Une même paire (jour, compte) peut figurer deux fois si une exécution a été
 * tuée entre l'écriture du cache et celle de l'état : la dernière l'emporte.
 */
const lireCache_ = (classeur) => {
  const feuille = ongletCache_(classeur);
  const complets = new Set();
  const valeurs = new Map();
  const hauteur = feuille.getLastRow();
  if (hauteur < 2) return { complets, valeurs };

  feuille.getRange(2, 1, hauteur - 1, ENTETES_CACHE.length).getValues()
    .forEach(([brut, compte, json]) => {
      const jour = SocleDates.jour(brut);
      if (!jour) return;
      if (compte === TEMOIN_JOUR_COMPLET) {
        complets.add(jour);
        return;
      }
      let lu;
      try {
        lu = JSON.parse(json);
      } catch (erreur) {
        console.warn(`Cache : ligne illisible pour ${compte} le ${jour}, ignorée.`);
        return;
      }
      if (!valeurs.has(jour)) valeurs.set(jour, new Map());
      valeurs.get(jour).set(String(compte), lu);
    });
  return { complets, valeurs };
};

/**
 * Prépare le cache pour un nouveau rapport : ne garde que les jours complets
 * de la fenêtre, et repart de zéro si la liste de comptes ou de paramètres a
 * changé. Rend le nombre de jours conservés.
 */
const preparerCache_ = (classeur, signature, jours) => {
  const feuille = ongletCache_(classeur);
  const proprietes = PropertiesService.getDocumentProperties();
  const memeListe = proprietes.getProperty(CONFIG.CLE_SIGNATURE_CACHE) === signature;

  const fenetre = new Set(jours);
  const { complets, valeurs } = memeListe ? lireCache_(classeur) : { complets: new Set(), valeurs: new Map() };
  const gardes = [...complets].filter((jour) => fenetre.has(jour));
  const lignes = [];
  gardes.forEach((jour) => {
    (valeurs.get(jour) || new Map()).forEach((v, compte) => {
      lignes.push([jour, compte, JSON.stringify(v)]);
    });
    lignes.push([jour, TEMOIN_JOUR_COMPLET, '']);
  });

  const hauteur = feuille.getLastRow();
  if (hauteur > 1) feuille.getRange(2, 1, hauteur - 1, ENTETES_CACHE.length).clearContent();
  if (lignes.length) feuille.getRange(2, 1, lignes.length, ENTETES_CACHE.length).setValues(lignes);
  proprietes.setProperty(CONFIG.CLE_SIGNATURE_CACHE, signature);
  SpreadsheetApp.flush();
  return gardes.length;
};

/**
 * Ajoute un jour au cache. Le témoin n'est posé que pour un jour définitif.
 * `flush` avant de rendre la main : l'appelant n'avance son curseur qu'ensuite.
 */
const ecrireJourEnCache_ = (classeur, jour, valeurs, definitif) => {
  const feuille = ongletCache_(classeur);
  const lignes = [...valeurs].map(([compte, v]) => [jour, compte, JSON.stringify(v)]);
  if (definitif) lignes.push([jour, TEMOIN_JOUR_COMPLET, '']);
  if (!lignes.length) return;
  feuille.getRange(feuille.getLastRow() + 1, 1, lignes.length, ENTETES_CACHE.length).setValues(lignes);
  SpreadsheetApp.flush();
};
