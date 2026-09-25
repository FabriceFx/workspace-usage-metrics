/**
 * Métrique d'usage — lecture et écriture du classeur. Introduit en v0.1.
 *
 * La synthèse s'explique là où on la lit : un bandeau en tête dit à quelle
 * date s'arrêtent les compteurs et ce qui n'a pas pu être mesuré, et chaque
 * en-tête de colonne porte une note qui dit d'où vient le chiffre.
 */

const ENTETES_DRIVE = Object.freeze([
  'Compte', 'Date', 'Action', 'Titre du fichier', 'Type', 'Propriétaire', 'Visibilité',
]);

const ENTETES_SYNTHESE_LARGEUR = 21;

/**
 * En-têtes des colonnes qui portent un jour `yyyy-MM-dd`. Repérées par leur
 * nom, jamais par leur rang : une colonne ajoutée ne doit décaler aucune date.
 */
const ENTETES_JOUR = Object.freeze(['Dernière activité', 'Dernière connexion',
  'Dernière action Gmail', 'Dernière activité Drive']);

const LIGNE_BANDEAU = 1;
const LIGNE_ENTETES_SYNTHESE = 3;

/**
 * En-têtes et notes de la synthèse. La fenêtre longue suit le réglage : un
 * en-tête « 30 j » sur une fenêtre de 60 jours serait faux.
 */
const entetesSynthese_ = (joursHistorique) => {
  const n = joursHistorique;
  const c = JOURS_FENETRE_COURTE;
  const vide = 'Vide = paramètre refusé par l\'API pour ce domaine : non mesuré, et non zéro.';
  const cumul = (param, fenetre) => `Somme de ${param} sur les ${fenetre} jours se terminant à la `
    + `date d'arrêt des compteurs (bandeau). Les jours non chargés en sont exclus. ${vide}`;
  const colonnes = [
    ['Compte', `Adresse lue dans l'onglet « ${CONFIG.ONGLET_COMPTES} ».`],
    ['Statut global', 'Ancienneté de « Dernière activité » par rapport à aujourd\'hui. Seuils '
      + `dans l'onglet « ${CONFIG.ONGLET_PARAMETRES} ».`],
    ['Dernière activité', 'La plus récente des dates « Dernière connexion », « Dernière action '
      + 'Gmail » et « Dernière activité Drive ».'],
    ['Dernière connexion', 'accounts:last_login_time, tel que Google le publie à la date '
      + 'd\'arrêt des compteurs.'],
    ['Statut Gmail', 'Ancienneté de « Dernière action Gmail ».'],
    ['Dernière action Gmail', 'gmail:last_interaction_time ; à défaut, le dernier jour de la '
      + `fenêtre de ${n} jours où au moins un message a été envoyé.`],
    [`Mails reçus ${c} j`, cumul('gmail:num_emails_received', c)],
    [`Mails envoyés ${c} j`, cumul('gmail:num_emails_sent', c)],
    [`Mails reçus ${n} j`, cumul('gmail:num_emails_received', n)],
    [`Mails envoyés ${n} j`, cumul('gmail:num_emails_sent', n)],
    ['Signal Gmail sans connexion', 'Présomption, pas un fait : ne concerne que les comptes '
      + `sans connexion pendant la fenêtre de ${n} jours. Une boîte lue par délégation ne se `
      + 'connecte jamais — le délégué ouvre sa propre session. Envois ou actions Gmail sans '
      + 'connexion : délégation, alias « envoyer en tant que » ou application. Réceptions '
      + 'seules : délégation en lecture ou boîte abandonnée, indiscernables ici. Vérifiez les '
      + 'délégués dans les paramètres Gmail de la boîte avant de conclure. Vide = non mesurable.'],
    ['Statut Drive', 'Ancienneté de « Dernière activité Drive ».'],
    ['Dernière activité Drive', 'Le plus récent entre le dernier événement du journal Drive '
      + '(onglet « Détail Drive », à jour à quelques heures près) et le dernier jour où un '
      + 'compteur Drive est non nul.'],
    [`Fichiers créés ${c} j`, cumul('drive:num_items_created', c)],
    [`Fichiers modifiés ${c} j`, cumul('drive:num_items_edited', c)],
    [`Fichiers consultés ${c} j`, cumul('drive:num_items_viewed', c)],
    [`Fichiers créés ${n} j`, cumul('drive:num_items_created', n)],
    [`Fichiers modifiés ${n} j`, cumul('drive:num_items_edited', n)],
    [`Fichiers consultés ${n} j`, cumul('drive:num_items_viewed', n)],
    ['Quota Gmail (Mo)', `accounts:gmail_used_quota_in_mb au dernier jour publié. ${vide}`],
    ['Quota Drive (Mo)', `accounts:drive_used_quota_in_mb au dernier jour publié. ${vide}`],
  ];
  return { entetes: colonnes.map(([e]) => e), notes: colonnes.map(([, note]) => note) };
};

/**
 * Lit les adresses en colonne A (ligne 1 = en-tête).
 *
 * L'onglet absent, c'est l'installation : on le crée, et l'on retire la
 * première feuille que Google pose dans un classeur neuf (« Feuille 1 » en
 * français, « Sheet1 » en anglais, « Feuil1 » pour un .xlsx importé) — seulement si elle est vide. Hors
 * installation on n'y touche pas : une feuille vide peut être voulue.
 */
const lireComptes_ = (classeur) => {
  const feuille = classeur.getSheetByName(CONFIG.ONGLET_COMPTES);
  if (!feuille) {
    classeur.insertSheet(CONFIG.ONGLET_COMPTES, 0)
      .getRange(1, 1).setValue('Adresse du compte').setFontWeight('bold');
    const { retirees } = SocleFeuilles.retirerFeuilleParDefaut();
    if (retirees.length) console.log(`Installation : onglet(s) retiré(s) : ${retirees.join(', ')}.`);
    return [];
  }
  const derniere = feuille.getLastRow();
  if (derniere < 2) return [];
  const adresses = feuille.getRange(2, 1, derniere - 1, 1).getValues()
    .map(([valeur]) => String(valeur).trim().toLowerCase())
    .filter((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
  return [...new Set(adresses)];
};

const viderOnglet_ = (classeur, nom) => {
  const feuille = classeur.getSheetByName(nom) || classeur.insertSheet(nom);
  feuille.clear();
  return feuille;
};

/**
 * Force une chaîne à rester du texte dans la cellule.
 *
 * `setValues` interprète ce qu'on lui donne comme une saisie : une chaîne qui
 * commence par = + - @ devient une formule, « 2026-09-01 » devient une date.
 * Or un titre de fichier Drive est choisi par n'importe qui — y compris un
 * tiers qui partage un document intitulé `=IMAGE("https://…")`, formule qui
 * appellerait son serveur à chaque ouverture du classeur. L'apostrophe
 * initiale force le texte et n'apparaît pas à la lecture. On l'applique à
 * toute chaîne venue de l'extérieur, sans chercher à reconnaître les
 * dangereuses : une liste de caractères interdits s'oublie, pas une règle.
 */
const enTexte_ = (valeur) => (typeof valeur === 'string' && valeur !== '' ? `'${valeur}` : valeur);

/** Un jour `yyyy-MM-dd` en cellule de date (minuit, heure du script), ou `''`. */
const versCelluleJour_ = (jour) => (jour ? new Date(`${jour}T00:00:00`) : '');

/** Liste abrégée pour le bandeau : au-delà de quelques éléments, on compte. */
const abreger_ = (elements, max = 3) => (elements.length <= max ? elements.join(', ')
  : `${elements.slice(0, max).join(', ')}… (+${elements.length - max})`);

/** Ce que le rapport n'a pas pu mesurer, en une ligne. Vide ne veut jamais dire « rien vu ». */
const bandeauReserves_ = (etat) => {
  const reserves = [];
  const echecs = [...etat.joursEchec].sort();
  if (echecs.length) {
    reserves.push(`⚠️ ${echecs.length} jour(s) non chargé(s), exclus des cumuls : ${abreger_(echecs)}`);
  }
  if (etat.joursProvisoires.length) {
    reserves.push(`${etat.joursProvisoires.length} jour(s) partiel(s) selon Google, redemandé(s) `
      + `au prochain rapport : ${abreger_([...etat.joursProvisoires].sort())}`);
  }
  const refuses = PARAMETRES_USAGE.filter((p) => !etat.params.includes(p));
  if (refuses.length) reserves.push(`paramètre(s) refusé(s) par l'API, colonnes vides : ${refuses.join(', ')}`);
  if (etat.drivesEchecTotal) {
    reserves.push(`⚠️ journal Drive illisible pour ${etat.drivesEchecTotal} compte(s) — `
      + 'détail dans le journal d\'exécution');
  }
  if (etat.drivesTronques) {
    reserves.push(`journal Drive tronqué pour ${etat.drivesTronques} compte(s) (plafond de pages)`);
  }
  return reserves.length ? reserves.join(' · ') : '✅ Toutes les données de la fenêtre ont été chargées.';
};

const ecrireSynthese_ = (classeur, lignes, etat) => {
  const { entetes, notes } = entetesSynthese_(etat.parametres.joursHistorique);
  const feuille = viderOnglet_(classeur, CONFIG.ONGLET_SYNTHESE);

  feuille.getRange(LIGNE_BANDEAU, 1, 2, 1).setValues([
    [`Compteurs arrêtés au ${SocleDates.lisible(etat.jourReference)} (Google les publie avec 2 à `
      + `3 jours de décalage) · journal Drive des ${etat.parametres.joursDetailDrive} derniers jours `
      + `· généré le ${SocleDates.lisibleAvecHeure(new Date())} · version ${METRIQUE_VERSION}`],
    [bandeauReserves_(etat)],
  ]).setFontStyle('italic');
  etat.messagesEchec.forEach((ligne) => console.warn(`Jour non chargé : ${ligne}`));
  etat.drivesEchec.forEach((ligne) => console.warn(`Journal Drive : ${ligne}`));

  feuille.getRange(LIGNE_ENTETES_SYNTHESE, 1, 1, entetes.length).setValues([entetes])
    .setNotes([notes]).setFontWeight('bold').setBackground('#e8eaed');

  if (lignes.length) {
    // Colonne A : l'adresse vient de l'onglet Comptes, saisi à la main.
    const colonnesJour = ENTETES_JOUR.map((nom) => entetes.indexOf(nom));
    const cellules = lignes.map((ligne) => ligne.map((valeur, i) => {
      if (colonnesJour.includes(i)) return versCelluleJour_(valeur);
      return i === 0 ? enTexte_(valeur) : valeur;
    }));
    const premiere = LIGNE_ENTETES_SYNTHESE + 1;
    feuille.getRange(premiere, 1, cellules.length, entetes.length).setValues(cellules);
    colonnesJour.forEach((i) => feuille.getRange(premiere, i + 1, cellules.length, 1)
      .setNumberFormat('dd/mm/yyyy'));
  }
  feuille.setFrozenRows(LIGNE_ENTETES_SYNTHESE);
  feuille.setFrozenColumns(1);
  feuille.autoResizeColumns(1, entetes.length);
  SpreadsheetApp.flush();
};

/* ------------------------------ Détail Drive ------------------------------ */

const preparerDetailDrive_ = (classeur) => {
  const feuille = viderOnglet_(classeur, CONFIG.ONGLET_DETAIL_DRIVE);
  feuille.getRange(1, 1, 1, ENTETES_DRIVE.length).setValues([ENTETES_DRIVE])
    .setFontWeight('bold').setBackground('#e8eaed');
  feuille.setFrozenRows(1);
  // Largeurs posées une fois, sur l'onglet vide : un autoResizeColumns sur des
  // milliers de lignes coûte plusieurs secondes du budget de fin.
  [260, 150, 110, 360, 110, 260, 110].forEach((largeur, i) => feuille.setColumnWidth(i + 1, largeur));
  SpreadsheetApp.flush();
};

/** Ajoute des lignes en un seul lot, puis `flush` : le curseur n'avance qu'après. */
const ajouterLignesDrive_ = (classeur, lignes) => {
  if (!lignes.length) return;
  const feuille = classeur.getSheetByName(CONFIG.ONGLET_DETAIL_DRIVE);
  const cellules = lignes.map((ligne) => ligne.map(enTexte_));
  feuille.getRange(feuille.getLastRow() + 1, 1, cellules.length, ENTETES_DRIVE.length).setValues(cellules);
  SpreadsheetApp.flush();
};

/**
 * Trie le journal du plus récent au plus ancien, puis rend compte → dernier
 * jour d'événement. Les dates reviennent de Sheets en objets `Date` : elles
 * passent par `SocleDates.jour` avant toute comparaison.
 */
const trierEtLireDetailDrive_ = (classeur) => {
  const derniers = new Map();
  const feuille = classeur.getSheetByName(CONFIG.ONGLET_DETAIL_DRIVE);
  if (!feuille || feuille.getLastRow() < 2) return derniers;
  const plage = feuille.getRange(2, 1, feuille.getLastRow() - 1, ENTETES_DRIVE.length);
  plage.sort({ column: 2, ascending: false });
  plage.getValues().forEach(([compte, date]) => {
    const jour = SocleDates.jour(date);
    if (jour && jour > (derniers.get(compte) || '')) derniers.set(compte, jour);
  });
  return derniers;
};
