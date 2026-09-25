/**
 * Métrique d'usage — déroulé d'un rapport, en exécutions successives. Introduit en v0.2.
 *
 * Un rapport se fait en trois étapes : les jours d'usage (`usage`), le
 * journal Drive compte par compte (`drive`), puis la synthèse (`fin`). Les
 * deux premières peuvent dépasser six minutes sur un domaine réel ; elles
 * s'arrêtent donc proprement quand le budget est atteint, et un déclencheur
 * ponctuel les reprend une minute plus tard.
 *
 * Trois règles tiennent la reprise :
 *   - l'état est dans les propriétés **du document** — il appartient à ce
 *     classeur — et reste petit : ni liste de comptes, ni données ;
 *   - **le curseur n'avance qu'après l'écriture** (et son `flush`) : une
 *     exécution tuée fait au pire recommencer une unité, jamais en sauter une ;
 *   - la liste des comptes est relue à chaque reprise, et comparée à sa
 *     signature : si quelqu'un l'a modifiée entre-temps, on s'arrête plutôt
 *     que de mélanger deux listes dans un même rapport.
 */

/* ------------------------------ État ------------------------------ */

const lireEtat_ = () => {
  const brut = PropertiesService.getDocumentProperties().getProperty(CONFIG.CLE_ETAT);
  return brut ? JSON.parse(brut) : null;
};

const ecrireEtat_ = (etat) => {
  etat.majLe = new Date().toISOString();
  PropertiesService.getDocumentProperties().setProperty(CONFIG.CLE_ETAT, JSON.stringify(etat));
};

const effacerEtat_ = () => {
  PropertiesService.getDocumentProperties().deleteProperty(CONFIG.CLE_ETAT);
};

const messageCourt_ = (erreur) => String((erreur && erreur.message) || erreur)
  .slice(0, CONFIG.LONGUEUR_MESSAGE_ETAT);

/**
 * Les jours de la fenêtre, du plus récent au plus ancien. Recalculés plutôt
 * que stockés : 180 dates pèseraient 2,5 Ko dans un état plafonné à 9 Ko.
 */
const joursFenetre_ = (etat) => Array.from({ length: etat.parametres.joursHistorique },
  (_, i) => decalerJour_(etat.jourReference, -i));

const libelleEtape_ = (etat) => {
  if (etat.phase === 'usage') {
    return t_('etapeUsage', { traites: etat.joursTraites, total: etat.parametres.joursHistorique });
  }
  if (etat.phase === 'drive') return t_('etapeDrive', { rang: etat.indexDrive + 1 });
  if (etat.phase === 'fin') return t_('etapeFin');
  return etat.phase;
};

/**
 * Garde un message d'échec, dédoublonné et en nombre borné. Les échecs se
 * **comptent** tous ; seuls les premiers messages différents sont gardés — un
 * domaine en panne répète presque toujours le même.
 */
const retenirMessage_ = (liste, message) => {
  if (!liste.includes(message) && liste.length < CONFIG.MESSAGES_ECHEC_GARDES) liste.push(message);
};

/**
 * Un état sans reprise programmée et sans mise à jour depuis plus de dix
 * minutes est celui d'une exécution tuée : le budget est de quatre minutes,
 * une exécution vivante l'aurait mis à jour ou aurait programmé sa suite.
 */
const estOrphelin_ = (etat) => !SocleExecution.repriseProgrammee('reprendreRapport')
  && Date.now() - new Date(etat.majLe).getTime() > 10 * 60 * 1000;

/* ------------------------------ Déroulé ------------------------------ */

/** Prépare un rapport neuf et en exécute tout ce que le budget permet. */
const demarrerRapport_ = () => {
  const enCours = lireEtat_();
  if (enCours && estOrphelin_(enCours)) {
    // Exécution tuée sans avoir pu programmer sa suite : on la reprend plutôt
    // que de laisser l'état bloquer tout nouveau rapport.
    notifier_(t_('notifReprise', { etape: libelleEtape_(enCours) }));
    poursuivreRapport_();
    return;
  }
  if (enCours) {
    notifier_(t_('notifDejaEnCours', {
      debut: SocleDates.lisibleAvecHeure(enCours.debut, langue_()),
      etape: libelleEtape_(enCours),
    }));
    return;
  }

  const classeur = SpreadsheetApp.getActive();
  const parametres = lireParametres_(classeur);
  const comptes = lireComptes_(classeur);
  if (!comptes.length) throw erreurAucunCompte_();

  const jourReference = trouverDerniereDateDispo_(parametres.uniteOrganisationnelle);
  const params = paramsValides_(jourReference, parametres.uniteOrganisationnelle);
  const jours = joursFenetre_({ parametres, jourReference });
  const signature = signatureCache_(comptes, params);
  const joursEnCache = preparerCache_(classeur, signature, jours);

  ecrireEtat_({
    version: METRIQUE_VERSION,
    debut: new Date().toISOString(),
    debutDrive: new Date(Date.now() - parametres.joursDetailDrive * 86400000).toISOString(),
    parametres,
    jourReference,
    params,
    signature,
    phase: 'usage',
    joursTraites: joursEnCache,
    joursEchec: [],
    messagesEchec: [],
    joursProvisoires: [],
    indexDrive: 0,
    jetonDrive: null,
    drivesEchec: [],
    drivesEchecTotal: 0,
    drivesTronques: 0,
  });
  notifier_(t_('notifLance', {
    compte: comptes.length, enCache: joursEnCache, aCharger: jours.length - joursEnCache,
  }));
  poursuivreRapport_();
};

/** Reprend le rapport là où l'état le dit. */
const poursuivreRapport_ = () => {
  const etat = lireEtat_();
  if (!etat) return; // abandonné entre-temps

  const budget = SocleExecution.budget({ msMax: CONFIG.BUDGET_MS });
  const classeur = SpreadsheetApp.getActive();
  const comptes = lireComptes_(classeur);
  if (signatureCache_(comptes, etat.params) !== etat.signature) {
    throw erreurUtilisateur_('erreurListeModifiee', { onglet: CONFIG.ONGLET_COMPTES });
  }

  if (etat.phase === 'usage' && !avancerUsage_(classeur, etat, comptes, budget)) return;
  if (etat.phase === 'drive' && !avancerDrive_(classeur, etat, comptes, budget)) return;
  // La synthèse relit le cache et trie le journal Drive : sur un grand domaine,
  // plusieurs dizaines de secondes. On ne la commence pas sur un budget entamé.
  if (!budget.permet(CONFIG.MARGE_FIN_MS)) {
    suspendre_(etat);
    return;
  }

  terminerRapport_(classeur, etat, comptes);
  effacerEtat_();
  SocleExecution.retirerReprise('reprendreRapport');
};

/** Rend vrai quand l'étape est finie, faux quand une reprise a été programmée. */
const avancerUsage_ = (classeur, etat, comptes, budget) => {
  const cibles = new Set(comptes);
  const { complets } = lireCache_(classeur);
  const aFaire = joursFenetre_(etat).filter((jour) => !complets.has(jour)
    && !etat.joursEchec.includes(jour) && !etat.joursProvisoires.includes(jour));

  for (const jour of aFaire) {
    if (!budget.permet(CONFIG.MARGE_JOUR_MS)) return suspendre_(etat);
    try {
      const { valeurs, provisoire } = chargerUsageJour_(jour, cibles, etat.params,
        etat.parametres.uniteOrganisationnelle);
      ecrireJourEnCache_(classeur, jour, valeurs, !provisoire);
      if (provisoire) etat.joursProvisoires.push(jour);
    } catch (erreur) {
      // Le jour est compté « non chargé », jamais « calme » : il sort des
      // cumuls, et le bandeau de la synthèse le dit.
      console.warn(`Jour ${jour} non chargé : ${erreur.message}`);
      etat.joursEchec.push(jour);
      retenirMessage_(etat.messagesEchec, messageCourt_(erreur));
    }
    etat.joursTraites += 1;
    ecrireEtat_(etat);
  }

  etat.phase = 'drive';
  etat.indexDrive = 0;
  etat.jetonDrive = null;
  preparerDetailDrive_(classeur);
  ecrireEtat_(etat);
  return true;
};

/** Même contrat que `avancerUsage_`. */
const avancerDrive_ = (classeur, etat, comptes, budget) => {
  const permet = () => budget.permet(CONFIG.MARGE_PAGE_DRIVE_MS);

  while (etat.indexDrive < comptes.length) {
    if (!permet()) return suspendre_(etat);
    const compte = comptes[etat.indexDrive];
    let suite = null;
    try {
      const { lignes, jetonSuivant, complet } = journalDrive_(
        compte, etat.debutDrive, etat.jetonDrive, permet);
      ajouterLignesDrive_(classeur, lignes);
      if (!complet && !permet()) {
        suite = jetonSuivant; // budget épuisé au milieu du journal de ce compte
      } else if (!complet) {
        etat.drivesTronques += 1; // plafond de pages atteint : le dire
      }
    } catch (erreur) {
      console.warn(`Journal Drive de ${compte} non chargé : ${erreur.message}`);
      etat.drivesEchecTotal += 1;
      retenirMessage_(etat.drivesEchec, messageCourt_(`${compte} : ${erreur.message}`));
    }
    if (suite) {
      etat.jetonDrive = suite;
    } else {
      etat.jetonDrive = null;
      etat.indexDrive += 1;
    }
    ecrireEtat_(etat);
  }
  etat.phase = 'fin';
  ecrireEtat_(etat);
  return true;
};

const suspendre_ = (etat) => {
  ecrireEtat_(etat);
  SocleExecution.programmerReprise('reprendreRapport', CONFIG.DELAI_REPRISE_MS);
  notifier_(t_('notifSuspendu', { etape: libelleEtape_(etat) }));
  return false;
};

/** Construit et écrit la synthèse à partir du cache et du journal Drive. */
const terminerRapport_ = (classeur, etat, comptes) => {
  const { valeurs } = lireCache_(classeur);
  const jours = joursFenetre_(etat).map((jour) => ({
    jour,
    // null = jour non chargé ; une Map vide = jour chargé où aucun compte cible ne figure.
    valeursParCompte: etat.joursEchec.includes(jour) ? null : valeurs.get(jour) || new Map(),
  }));
  if (jours.every((j) => j.valeursParCompte === null)) {
    throw erreurUtilisateur_('erreurAucunJour');
  }

  const dernierJourDrive = trierEtLireDetailDrive_(classeur);
  const contexte = {
    params: etat.params,
    parametres: etat.parametres,
    aujourdhui: SocleDates.maintenantJour(),
    debutFenetre: decalerJour_(etat.jourReference, 1 - etat.parametres.joursHistorique),
  };
  const lignes = comptes.map((compte) => analyserCompte_(
    compte, jours, dernierJourDrive.get(compte) || '', contexte));

  ecrireSynthese_(classeur, lignes, etat);
  notifier_(t_('notifTermine', { compte: comptes.length }));
};

/**
 * La cause d'un échec, en français, pour le bandeau du classeur.
 *
 * Une erreur attendue est retraduite depuis sa clé. Une erreur imprévue n'a
 * pas de traduction : son message vient du moteur ou d'un service Google. On
 * le recopie tel quel, mais annoncé comme imprévu — le déguiser en phrase
 * française serait inventer ce qu'il dit.
 */
const causeEnFrancais_ = (erreur) => (erreur && erreur.metriqueCle
  ? tClasseur_(erreur.metriqueCle, erreur.metriqueValeurs)
  : `sur une erreur imprévue (${(erreur && erreur.message) || erreur}). Le détail est dans `
    + 'Extensions > Apps Script > Exécutions.');

/**
 * Consigne l'échec d'un rapport en arrière-plan, là où quelqu'un le lira : en
 * tête de l'onglet « Synthèse ». Les chiffres du rapport précédent restent
 * en dessous, et le bandeau le dit.
 */
const echouerRapport_ = (erreur) => {
  console.error(`Rapport interrompu : ${erreur.message}\n${erreur.stack || ''}`);
  effacerEtat_();
  SocleExecution.retirerReprise('reprendreRapport');
  const classeur = SpreadsheetApp.getActive();
  const feuille = classeur.getSheetByName(CONFIG.ONGLET_SYNTHESE)
    || classeur.insertSheet(CONFIG.ONGLET_SYNTHESE);
  feuille.getRange(1, 1, 2, 1).setValues([
    [`❌ Le rapport du ${SocleDates.lisibleAvecHeure(new Date(), 'fr')} a échoué`
      + `${erreur && erreur.metriqueCle ? ' : ' : ' '}${causeEnFrancais_(erreur)}`],
    ['Les chiffres ci-dessous, s\'il y en a, sont ceux du rapport précédent.'],
  ]);
  SpreadsheetApp.flush();
};
