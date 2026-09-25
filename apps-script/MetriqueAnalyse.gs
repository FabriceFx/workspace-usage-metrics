/**
 * Métrique d'usage — analyse d'un compte. Introduit en v0.1.
 *
 * Toutes les dates sont manipulées au format `yyyy-MM-dd`, le seul qui se
 * trie en tant que texte : le « plus récent » d'une liste est alors son
 * maximum alphabétique, sans conversion ni fuseau.
 *
 * Deux précisions différentes cohabitent — un horodatage exact (dernière
 * connexion, journal Drive) et un jour déduit d'un compteur non nul. Les
 * mêler dans une même colonne en affichant des heures ferait passer une
 * présomption (« 23:59 ») pour un fait. Les colonnes de date affichent donc
 * toutes le jour, et rien de plus.
 */

/** Compteurs cumulés, dans l'ordre des colonnes. */
const COMPTEURS = Object.freeze([
  { cle: 'recus', parametre: 'gmail:num_emails_received' },
  { cle: 'envoyes', parametre: 'gmail:num_emails_sent' },
  { cle: 'crees', parametre: 'drive:num_items_created' },
  { cle: 'modifies', parametre: 'drive:num_items_edited' },
  { cle: 'consultes', parametre: 'drive:num_items_viewed' },
]);

/** Largeur de la fenêtre courte, fixe : c'est elle que nomment les en-têtes « 7 j ». */
const JOURS_FENETRE_COURTE = 7;

/** Le plus récent de plusieurs jours `yyyy-MM-dd`, ou `''`. */
const plusRecent_ = (jours) => jours.filter(Boolean).sort().pop() || '';

/**
 * Ce que laisse deviner un usage Gmail **sans connexion** pendant la fenêtre.
 *
 * Une boîte générique est souvent lue par délégation : le délégué ouvre sa
 * propre session, et la dernière connexion de la boîte ne bouge jamais. Aucune
 * donnée des rapports d'usage ne dit « cette boîte a des délégués » ; on ne
 * voit que la trace, et l'on retient la plus forte.
 *
 * C'est une présomption. Elle vit dans sa propre colonne et ne modifie aucun
 * statut : un fait et une présomption ne se mélangent pas. Vide quand un
 * paramètre nécessaire n'est pas mesuré — on ne conclut pas « aucun usage »
 * sur une réception qu'on n'a pas pu compter.
 */
const signalSansConnexion_ = ({ mesure, connexion, interaction, recus, envoyes, debutFenetre }) => {
  if (!mesure.has('accounts:last_login_time')) return '';
  if (connexion && connexion >= debutFenetre) return 'Sans objet : connexion pendant la fenêtre';
  if (mesure.has('gmail:num_emails_sent') && envoyes > 0) {
    return '🔵 Envois sans connexion : délégation, « envoyer en tant que » ou application';
  }
  if (mesure.has('gmail:last_interaction_time') && interaction && interaction >= debutFenetre) {
    return '🔵 Actions Gmail sans connexion : délégation probable';
  }
  if (mesure.has('gmail:num_emails_received') && recus > 0) {
    return '⚪ Réceptions seules : délégation en lecture ou boîte abandonnée, à vérifier';
  }
  const toutMesure = ['gmail:num_emails_sent', 'gmail:last_interaction_time',
    'gmail:num_emails_received'].every((p) => mesure.has(p));
  return toutMesure ? 'Aucun usage Gmail visible' : '';
};

/** Statut lisible d'après l'ancienneté du dernier jour d'activité. */
const statutActivite_ = (jour, aujourdhui, parametres) => {
  if (!jour) return '⚫ Aucune activité connue';
  const { seuilActif, seuilRecent, seuilInactif } = parametres;
  const ecart = SocleDates.ecartEnJours(jour, aujourdhui);
  if (ecart <= seuilActif) return `🟢 Actif (≤ ${seuilActif} j)`;
  if (ecart <= seuilRecent) return `🟡 Actif récemment (≤ ${seuilRecent} j)`;
  if (ecart <= seuilInactif) return `🟠 Peu actif (${seuilRecent + 1}–${seuilInactif} j)`;
  return `🔴 Inactif (> ${seuilInactif} j)`;
};

/**
 * Rend la ligne de synthèse d'un compte.
 *
 * `jours` est ordonné du plus récent au plus ancien ; `valeursParCompte` vaut
 * `null` pour un jour qui n'a pas pu être chargé. Un tel jour n'est ni compté
 * à zéro, ni pris pour une absence du compte.
 *
 * Un compteur dont le paramètre a été refusé par l'API reste vide (« non
 * mesuré ») au lieu de valoir 0.
 */
const analyserCompte_ = (compte, jours, dernierJourDrive, contexte) => {
  const { params, parametres, aujourdhui, debutFenetre, largeur } = contexte;
  const mesure = new Set(params);
  const court = {};
  const long = {};
  COMPTEURS.forEach(({ cle }) => { court[cle] = 0; long[cle] = 0; });

  let recent = null;
  let jourDrive = ''; // dernier jour avec un compteur Drive non nul
  let jourEnvoi = ''; // dernier jour avec un message envoyé
  jours.forEach(({ jour, valeursParCompte }, rang) => {
    if (!valeursParCompte) return;
    const u = valeursParCompte.get(compte);
    if (!u) return;
    if (!recent) recent = u;
    const v = {};
    COMPTEURS.forEach(({ cle, parametre }) => {
      v[cle] = Number(u[parametre]) || 0;
      long[cle] += v[cle];
      if (rang < JOURS_FENETRE_COURTE) court[cle] += v[cle];
    });
    if (!jourDrive && v.crees + v.modifies + v.consultes > 0) jourDrive = jour;
    if (!jourEnvoi && v.envoyes > 0) jourEnvoi = jour;
  });

  if (!recent) {
    return [compte, '❔ Absent du rapport d\'usage (groupe, alias, compte suspendu, hors de '
      + 'l\'unité organisationnelle ou inexistant ?)', ...Array(largeur - 2).fill('')];
  }

  const valeur = (parametre, n) => (mesure.has(parametre) ? n : '');
  const compteur = (fenetre, cle) => valeur(
    COMPTEURS.find((c) => c.cle === cle).parametre, fenetre[cle]);
  const quota = (parametre) => (recent[parametre] === undefined ? '' : recent[parametre]);

  const derniereConnexion = SocleDates.jour(recent['accounts:last_login_time']);
  const derniereInteraction = SocleDates.jour(recent['gmail:last_interaction_time']);
  const derniereGmail = derniereInteraction || jourEnvoi;
  const derniereDrive = plusRecent_([dernierJourDrive, jourDrive]);
  const derniere = plusRecent_([derniereConnexion, derniereGmail, derniereDrive]);

  return [
    compte,
    statutActivite_(derniere, aujourdhui, parametres), derniere, derniereConnexion,
    statutActivite_(derniereGmail, aujourdhui, parametres), derniereGmail,
    compteur(court, 'recus'), compteur(court, 'envoyes'),
    compteur(long, 'recus'), compteur(long, 'envoyes'),
    signalSansConnexion_({
      mesure,
      connexion: derniereConnexion,
      interaction: derniereInteraction,
      recus: long.recus,
      envoyes: long.envoyes,
      debutFenetre,
    }),
    statutActivite_(derniereDrive, aujourdhui, parametres), derniereDrive,
    compteur(court, 'crees'), compteur(court, 'modifies'), compteur(court, 'consultes'),
    compteur(long, 'crees'), compteur(long, 'modifies'), compteur(long, 'consultes'),
    quota('accounts:gmail_used_quota_in_mb'),
    quota('accounts:drive_used_quota_in_mb'),
  ];
};
