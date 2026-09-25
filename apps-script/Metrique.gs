/**
 * Métrique d'usage — configuration, menu et points d'entrée. Introduit en v0.1.
 *
 * Rapport d'activité Gmail et Drive d'une liste de comptes (typiquement des
 * comptes génériques), tiré des rapports d'usage et du journal d'audit Drive
 * de l'Admin SDK.
 *
 * Prérequis :
 *   - projet **lié** au classeur (Extensions > Apps Script) : le menu apparaît
 *     par le déclencheur simple `onOpen`, et chaque action s'exécute sous
 *     l'identité de qui la déclenche ;
 *   - service avancé « Admin SDK Reports » activé (voir `appsscript.json`) ;
 *   - exécuté par un administrateur disposant du privilège « Rapports ».
 *
 * Google publie les rapports d'usage avec deux à trois jours de décalage : les
 * compteurs s'arrêtent à la dernière date publiée, pas à aujourd'hui.
 *
 * Seuls les points d'entrée sont des `function` déclarées : ce sont eux que
 * l'éditeur propose au menu d'exécution, et eux que les menus et déclencheurs
 * résolvent par leur nom global. Tout le reste est en `const … = () =>`.
 */

/** Le seul numéro de version courant du projet. Le banc vérifie qu'il vaut `VERSION`. */
const METRIQUE_VERSION = '0.5.1';

/**
 * Constantes techniques. Rien ici ne relève du jugement : les fenêtres, seuils
 * et l'unité organisationnelle vivent dans l'onglet « Paramètres », pour qu'un
 * changement ne demande aucun déploiement.
 */
const CONFIG = Object.freeze({
  ONGLET_COMPTES: 'Comptes',
  ONGLET_PARAMETRES: 'Paramètres',
  ONGLET_SYNTHESE: 'Synthèse',
  ONGLET_DETAIL_DRIVE: 'Détail Drive',
  ONGLET_CACHE: '_cache_usage',
  CLE_ETAT: 'METRIQUE_ETAT',
  CLE_SIGNATURE_CACHE: 'METRIQUE_SIGNATURE_CACHE',

  // Budget sous le plafond des 6 minutes : de quoi écrire l'état et rendre la main.
  BUDGET_MS: 4 * 60 * 1000,
  // Ce qu'il faut de budget pour **commencer** une unité. On ne démarre pas un
  // jour de rapport (plusieurs pages de 1 000 utilisateurs) sur un budget entamé.
  MARGE_JOUR_MS: 45 * 1000,
  MARGE_PAGE_DRIVE_MS: 15 * 1000,
  DELAI_REPRISE_MS: 60 * 1000,

  // Recul maximal pour trouver la dernière date publiée, si Google ne l'annonce pas.
  RECUL_MAX_JOURS: 7,
  // Longueur maximale d'un message d'erreur gardé dans l'état : PropertiesService
  // plafonne à 9 Ko par valeur, et un message d'API peut en faire plusieurs.
  // Budget total de l'état : ≤ 180 jours en échec (2,4 Ko), autant de jours
  // provisoires au plus, et deux listes de cinq messages. Le banc le vérifie
  // sur 179 jours en échec.
  LONGUEUR_MESSAGE_ETAT: 160,
  MESSAGES_ECHEC_GARDES: 5,
  MARGE_FIN_MS: 30 * 1000,
  // Le diagnostic fait un appel par compte : il s'arrête avant le plafond, et
  // dit quels comptes il n'a pas eu le temps de vérifier.
  MARGE_DIAG_MS: 10 * 1000,
});

/**
 * Le référentiel de réglages, posé dans l'onglet « Paramètres » à la première
 * exécution. Le code n'ajoute que les lignes absentes et ne réécrit jamais une
 * valeur saisie.
 */
const PARAMETRES_DEFAUT = Object.freeze([
  {
    nom: 'joursHistorique', cle: 'Jours d\'historique', valeur: 30, min: 7, max: 180,
    explication: 'Fenêtre des cumuls, en jours, se terminant à la dernière date publiée par '
      + 'Google. Chaque jour coûte un appel par tranche de 1 000 utilisateurs du domaine ; '
      + 'les jours déjà chargés sont gardés en cache et ne sont pas redemandés.',
  },
  {
    nom: 'joursDetailDrive', cle: 'Jours de détail Drive', valeur: 7, min: 1, max: 180,
    explication: 'Fenêtre du journal Drive détaillé (onglet « Détail Drive »), jusqu\'à '
      + 'aujourd\'hui. Google conserve ce journal environ six mois.',
  },
  {
    nom: 'seuilActif', cle: 'Seuil « actif » (jours)', valeur: 7, min: 1, max: 365,
    explication: 'Une dernière activité datant d\'au plus ce nombre de jours donne 🟢.',
  },
  {
    nom: 'seuilRecent', cle: 'Seuil « actif récemment » (jours)', valeur: 30, min: 1, max: 365,
    explication: 'Au-delà du seuil « actif » et jusqu\'à ce nombre de jours : 🟡.',
  },
  {
    nom: 'seuilInactif', cle: 'Seuil « inactif » (jours)', valeur: 90, min: 1, max: 3650,
    explication: 'Jusqu\'à ce nombre de jours : 🟠 peu actif. Au-delà : 🔴 inactif.',
  },
  {
    nom: 'uniteOrganisationnelle', cle: 'Unité organisationnelle', valeur: '', texte: true,
    explication: 'Facultatif. Identifiant d\'UO de la forme « id:03ph8a2z… » (console '
      + 'd\'administration, ou AdminDirectory.Orgunits). Restreint les appels à cette UO et '
      + 'les accélère d\'autant ; un compte hors de l\'UO apparaîtra alors « absent ». '
      + 'Vide = tout le domaine.',
  },
  {
    nom: 'langueInterface', cle: 'Langue de l\'interface', valeur: 'automatique', texte: true,
    choix: ['automatique', 'français', 'anglais'],
    explication: 'Langue du menu et des boîtes de dialogue. « automatique » suit la langue du '
      + 'compte Google telle qu\'Apps Script la rapporte (voir « À propos ») ; choisissez '
      + '« français » ou « anglais » si elle est mal détectée. Rouvrez le classeur pour le menu.',
  },
  {
    nom: 'jourProgramme', cle: 'Jour du rapport programmé', valeur: 'lundi', texte: true,
    choix: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
    explication: 'Jour du rapport automatique (menu « Programmer le rapport hebdomadaire »). '
      + 'Un changement ne s\'applique qu\'après avoir choisi à nouveau « Programmer ».',
  },
  {
    nom: 'heureProgramme', cle: 'Heure du rapport programmé', valeur: 7, min: 0, max: 23,
    explication: 'Heure de départ, de 0 à 23, dans le fuseau du script. Google lance le '
      + 'rapport à un moment quelconque de cette heure-là.',
  },
]);

/* ============================ POINTS D'ENTRÉE ============================ */

function onOpen() {
  // Trace dans Extensions > Apps Script > Exécutions : c'est dans ce contexte
  // restreint (déclencheur simple) que la langue du compte peut être mal rendue.
  const { code, locale, source } = detectionLangue_();
  console.log(`Menu en « ${code} » — langue du compte selon Google : « ${locale} », source : ${source}.`);
  SpreadsheetApp.getUi()
    .createMenu(t_('menuTitre'))
    .addItem(t_('menuGenerer'), 'genererRapport')
    .addItem(t_('menuDiagnostiquer'), 'diagnostiquer')
    .addItem(t_('menuAbandonner'), 'abandonnerRapport')
    .addSeparator()
    .addItem(t_('menuProgrammer'), 'programmerRapport')
    .addItem(t_('menuArreterProgramme'), 'arreterRapportProgramme')
    .addSeparator()
    .addItem(t_('menuAPropos'), 'aPropos')
    .addToUi();
}

/** Lance un rapport. S'il ne tient pas en une exécution, il se poursuit seul. */
function genererRapport() {
  depuisLeMenu_(t_('menuGenerer'), () => {
    const resultat = SocleExecution.sousVerrou(() => {
      try {
        demarrerRapport_();
      } catch (erreur) {
        // Un rapport déjà engagé ne doit pas laisser derrière lui un état qui
        // bloquerait le suivant. Avant l'engagement, il n'y a rien à nettoyer.
        if (lireEtat_()) echouerRapport_(erreur);
        throw erreur;
      }
    });
    if (!resultat.pris) notifier_(t_('notifVerrou'));
  });
}

/**
 * Cible du déclencheur de reprise. Doit rester une `function` déclarée : un
 * déclencheur est résolu par son nom global.
 */
function reprendreRapport() {
  // Ramassage en première ligne : c'est le seul endroit qui opère quand
  // l'exécution renonce aussitôt, verrou déjà pris.
  SocleExecution.retirerReprise('reprendreRapport');
  const resultat = SocleExecution.sousVerrou(() => {
    try {
      poursuivreRapport_();
    } catch (erreur) {
      echouerRapport_(erreur);
      // Relevée pour que Google notifie le propriétaire du déclencheur : dans
      // une exécution d'arrière-plan, personne ne regarde l'écran.
      throw erreur;
    }
  });
  if (!resultat.pris) SocleExecution.programmerReprise('reprendreRapport', CONFIG.DELAI_REPRISE_MS);
}

/**
 * Cible du déclencheur hebdomadaire. Doit rester une `function` déclarée.
 *
 * Un rapport déjà en cours n'est pas relancé (`demarrerRapport_` le dit et
 * s'arrête), un rapport orphelin est repris. Un échec s'écrit en tête de la
 * synthèse, puis est relevé pour que Google notifie l'administrateur.
 */
function rapportProgramme() {
  const resultat = SocleExecution.sousVerrou(() => {
    try {
      demarrerRapport_();
    } catch (erreur) {
      echouerRapport_(erreur);
      throw erreur;
    }
  });
  // Verrou pris par une génération manuelle : elle produit déjà un rapport.
  // Pas de nouvel essai — reprogrammer par nom retirerait le déclencheur hebdomadaire.
  if (!resultat.pris) console.log('Rapport programmé sauté : une génération est déjà en cours.');
}

function programmerRapport() {
  depuisLeMenu_(t_('menuProgrammer'), () => programmerRapport_());
}

function arreterRapportProgramme() {
  depuisLeMenu_(t_('menuArreterProgramme'), () => arreterRapportProgramme_());
}

/** Oublie un rapport en cours. Le cache des jours déjà chargés est conservé. */
function abandonnerRapport() {
  depuisLeMenu_(t_('menuAbandonner'), () => abandonnerRapport_());
}

/**
 * La confirmation reste un `ui.alert` natif, et c'est voulu : une modale HTML
 * ne rend pas de réponse au script qui l'ouvre, alors que `alert` attend le
 * clic et rend le bouton choisi.
 */
const abandonnerRapport_ = () => {
  const etat = lireEtat_();
  if (!etat) {
    afficher_(t_('menuAbandonner'), t_('abandonAucun'));
    return;
  }
  const ui = SpreadsheetApp.getUi();
  const message = t_('abandonMessage', {
    debut: SocleDates.lisibleAvecHeure(etat.debut, langue_()),
    etape: libelleEtape_(etat),
  });
  const reponse = ui.alert(t_('abandonTitre'), message, ui.ButtonSet.OK_CANCEL);
  if (reponse !== ui.Button.OK) return;
  effacerEtat_();
  SocleExecution.retirerReprise('reprendreRapport');
  notifier_(t_('abandonConfirmation'));
};

/** Teste chaque compte de la liste sur la dernière date publiée, sans rien écrire. */
function diagnostiquer() {
  depuisLeMenu_(t_('diagTitre'), () => diagnostiquerComptes_());
}

const diagnostiquerComptes_ = () => {
  const classeur = SpreadsheetApp.getActive();
  const parametres = lireParametres_(classeur);
  const comptes = lireComptes_(classeur);
  if (!comptes.length) throw erreurAucunCompte_();

  const jour = trouverDerniereDateDispo_(parametres.uniteOrganisationnelle);
  const budget = SocleExecution.budget({ msMax: CONFIG.BUDGET_MS });
  const resultats = comptes.map((compte) => (budget.permet(CONFIG.MARGE_DIAG_MS)
    ? { compte, ...diagnostiquerCompte_(compte, jour) }
    : { compte, type: 'nonVerifie', message: t_('diagNonVerifie') }));

  console.log([`${t_('diagDerniereDate')} : ${jour}`,
    ...resultats.map((r) => `${r.compte} [${r.type}] ${r.message}`)].join('\n'));
  afficherDiagnosticMd3_(jour, resultats);
};

function aPropos() {
  afficherAProposMd3_();
}

/* ============================ PARAMÈTRES ============================ */

/**
 * Le choix saisi, sous sa forme canonique, ou `''`. Comparé sans casse ni
 * accents : « Francais » vaut « français ». La même règle sert au menu et au
 * rapport — deux règles différentes, et un réglage accepté par l'un bloquerait
 * l'autre.
 */
const choixReconnu_ = (reglage, texte) => reglage.choix
  .find((c) => SocleTexte.comparable(c) === SocleTexte.comparable(texte)) || '';

/**
 * Lit l'onglet « Paramètres », en y posant les réglages absents.
 *
 * Une valeur hors bornes lève plutôt que de retomber sur le défaut : un
 * réglage ignoré en silence produit un rapport qui ne dit pas ce que son
 * lecteur croit.
 */
const lireParametres_ = (classeur) => {
  let feuille = classeur.getSheetByName(CONFIG.ONGLET_PARAMETRES);
  if (!feuille) {
    feuille = classeur.insertSheet(CONFIG.ONGLET_PARAMETRES);
    feuille.getRange(1, 1, 1, 3).setValues([['Réglage', 'Valeur', 'Explication']])
      .setFontWeight('bold');
  }
  const hauteur = Math.max(feuille.getLastRow(), 1);
  const presents = new Map(feuille.getRange(1, 1, hauteur, 2).getValues().slice(1)
    .map(([cle, valeur]) => [String(cle ?? '').trim(), valeur]));

  const manquants = PARAMETRES_DEFAUT.filter((p) => !presents.has(p.cle));
  if (manquants.length) {
    feuille.getRange(hauteur + 1, 1, manquants.length, 3)
      .setValues(manquants.map((p) => [p.cle, p.valeur, p.explication]));
  }

  const parametres = {};
  PARAMETRES_DEFAUT.forEach((p) => {
    const brute = presents.has(p.cle) ? presents.get(p.cle) : p.valeur;
    if (p.texte) {
      const texte = String(brute ?? '').trim();
      if (!p.choix) {
        parametres[p.nom] = texte;
        return;
      }
      const choix = choixReconnu_(p, texte);
      if (!choix) {
        throw erreurUtilisateur_('erreurReglageChoix', {
          cle: p.cle, valeur: texte, onglet: CONFIG.ONGLET_PARAMETRES, choix: p.choix.join(', '),
        });
      }
      parametres[p.nom] = choix;
      return;
    }
    const nombre = Number(brute);
    if (brute === '' || !Number.isInteger(nombre) || nombre < p.min || nombre > p.max) {
      throw erreurUtilisateur_('erreurReglage', {
        cle: p.cle, valeur: brute, onglet: CONFIG.ONGLET_PARAMETRES, min: p.min, max: p.max,
      });
    }
    parametres[p.nom] = nombre;
  });

  if (!(parametres.seuilActif < parametres.seuilRecent
    && parametres.seuilRecent < parametres.seuilInactif)) {
    throw erreurUtilisateur_('erreurSeuils', {
      onglet: CONFIG.ONGLET_PARAMETRES,
      actif: parametres.seuilActif,
      recent: parametres.seuilRecent,
      inactif: parametres.seuilInactif,
    });
  }
  return parametres;
};

/* ============================ INTERFACE ============================ */

/**
 * Message bref à qui regarde le classeur. En arrière-plan (déclencheur), il
 * n'y a personne : le journal d'exécution en garde la trace.
 */
const notifier_ = (message) => {
  console.log(message);
  try {
    SpreadsheetApp.getActive().toast(message, t_('menuTitre'), 10);
  } catch (erreur) {
    console.log(`Toast impossible dans ce contexte (${erreur.message}).`);
  }
};

/**
 * Erreur qui porte son remède, destinée à qui a cliqué, dans sa langue.
 * Marquée pour que la surface du menu la montre telle quelle, et la distingue
 * d'un défaut du code.
 *
 * Elle garde aussi sa clé et ses valeurs : quand elle finit dans le bandeau de
 * la synthèse, on la retraduit en français plutôt que de recopier un message
 * rédigé dans la langue de qui a lancé le rapport.
 */
const erreurUtilisateur_ = (cle, valeurs) => {
  const erreur = new Error(t_(cle, valeurs));
  erreur.metriqueAttendue = true;
  erreur.metriqueCle = cle;
  erreur.metriqueValeurs = valeurs;
  return erreur;
};

/**
 * Exécute une action de menu et présente son échec dans une boîte de
 * dialogue, au lieu du bandeau d'erreur d'Apps Script.
 *
 * Une erreur attendue montre son remède. Une erreur imprévue ne se déguise pas
 * en conseil : on dit qu'elle est imprévue, avec le message technique — les
 * utilisateurs de l'outil sont des administrateurs, il leur sert. On ne relève
 * pas : Google afficherait l'erreur une seconde fois ; `console.error` la garde
 * dans le journal d'exécution.
 */
const depuisLeMenu_ = (titre, action) => {
  try {
    return action();
  } catch (erreur) {
    console.error(`${titre} : ${erreur.message}\n${erreur.stack || ''}`);
    afficher_(titre, erreur.metriqueAttendue ? erreur.message
      : `${t_('errImprevuePrefixe')}${erreur.message}\n\n${t_('errImprevueDetail')}`,
      erreur.metriqueAttendue ? 'info' : 'erreur');
    return undefined;
  }
};

/** Boîte de dialogue quand une interface existe, journal sinon (lancement depuis l'éditeur). */
const afficher_ = (titre, texte, type = 'info') => {
  try {
    const ui = SpreadsheetApp.getUi();
    if (typeof HtmlService !== 'undefined' && typeof ui.showModalDialog === 'function') {
      afficherBoiteMd3_(titre, texte, type);
      return;
    }
    ui.alert(titre, texte, ui.ButtonSet.OK);
  } catch (erreur) {
    console.log(`${titre}\n${texte}`);
  }
};

const erreurAucunCompte_ = () => erreurUtilisateur_('erreurAucunCompte',
  { onglet: CONFIG.ONGLET_COMPTES });
