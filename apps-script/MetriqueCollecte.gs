/**
 * Métrique d'usage — collecte auprès de l'Admin SDK Reports. Introduit en v0.1.
 *
 * Deux sources, qui ne disent pas la même chose :
 *
 *   - **les rapports d'usage** (`UserUsageReport`) : des compteurs par jour et
 *     par utilisateur, publiés avec deux à trois jours de décalage. On les
 *     demande pour **tout le domaine** (`all`), page par page, et l'on ne garde
 *     que les comptes cibles : un appel par tranche de 1 000 utilisateurs,
 *     plutôt qu'un appel par compte cible et par jour ;
 *   - **le journal d'audit Drive** (`Activities`) : des événements horodatés,
 *     à jour à quelques heures près, demandés compte par compte.
 *
 * Aucune fonction de ce module n'avale un échec. Un jour qui n'a pas pu être
 * chargé lève ; c'est à l'appelant de le compter comme « non mesuré », jamais
 * comme une journée à zéro.
 */

const PARAMETRES_USAGE = Object.freeze([
  'accounts:last_login_time',
  'accounts:gmail_used_quota_in_mb',
  'accounts:drive_used_quota_in_mb',
  'gmail:last_interaction_time',
  'gmail:num_emails_received',
  'gmail:num_emails_sent',
  'drive:num_items_created',
  'drive:num_items_edited',
  'drive:num_items_viewed',
]);

/** Options communes aux appels d'usage : l'UO n'est passée que si elle est renseignée. */
const optionsUsage_ = (uniteOrganisationnelle, options) => (uniteOrganisationnelle
  ? { ...options, orgUnitID: uniteOrganisationnelle }
  : { ...options });

/**
 * Décale un jour `yyyy-MM-dd` d'un nombre de jours, sans passer par l'heure
 * locale : en UTC, un changement d'heure ne peut ni sauter ni doubler un jour.
 */
const decalerJour_ = (jour, decalage) => {
  const [annee, mois, quantieme] = jour.split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(annee, mois - 1, quantieme + decalage)),
    'UTC', 'yyyy-MM-dd');
};

/**
 * Rend la dernière date pour laquelle Google a publié les rapports d'usage.
 *
 * Google l'annonce dans son message d'erreur (« Data for dates later than
 * 2026-09-22 is not yet available ») : c'est le moyen le plus court de la
 * connaître. Le message est en anglais et pourrait changer ; à défaut, on
 * recule jour par jour jusqu'à trouver des données.
 *
 * On interroge `all` et non le premier compte de la liste : un premier compte
 * qui serait un groupe ou un alias faisait échouer tout le rapport.
 */
const trouverDerniereDateDispo_ = (uniteOrganisationnelle) => {
  const aujourdhui = SocleDates.maintenantJour();
  for (let recul = 1; recul <= CONFIG.RECUL_MAX_JOURS; recul += 1) {
    const jour = decalerJour_(aujourdhui, -recul);
    let reponse;
    try {
      reponse = SocleReprises.avecReprises(() => AdminReports.UserUsageReport.get(
        'all', jour, optionsUsage_(uniteOrganisationnelle, { maxResults: 1 })));
    } catch (erreur) {
      const annonce = String(erreur.message).match(/later than (\d{4}-\d{2}-\d{2})/);
      if (annonce) return annonce[1];
      throw erreurUtilisateur_('erreurServiceRefuse', { detail: erreur.message });
    }
    if ((reponse.usageReports || []).length) return jour;
  }
  throw erreurUtilisateur_('erreurAucuneDonnee', { jours: CONFIG.RECUL_MAX_JOURS });
};

/**
 * Teste la liste des paramètres une fois et retire ceux que l'API refuse
 * (message « Invalid parameter name X for application Y »).
 *
 * Un paramètre retiré n'est **pas** compté à zéro plus loin : ses colonnes
 * restent vides, c'est-à-dire « non mesuré ».
 */
const paramsValides_ = (jour, uniteOrganisationnelle) => {
  let liste = PARAMETRES_USAGE.slice();
  for (let essai = 0; essai < PARAMETRES_USAGE.length && liste.length; essai += 1) {
    try {
      SocleReprises.avecReprises(() => AdminReports.UserUsageReport.get('all', jour,
        optionsUsage_(uniteOrganisationnelle, { maxResults: 1, parameters: liste.join(',') })));
      return liste;
    } catch (erreur) {
      const refus = String(erreur.message)
        .match(/Invalid parameter name (\S+) for application (\S+?)\.?(\s|$)/);
      if (!refus) throw erreur;
      const refuse = `${refus[2]}:${refus[1]}`;
      console.warn(`Paramètre refusé par l'API, retiré : ${refuse}`);
      liste = liste.filter((p) => p !== refuse);
    }
  }
  if (!liste.length) {
    throw erreurUtilisateur_('erreurParametresRefuses');
  }
  return liste;
};

/**
 * Convertit les paramètres d'un rapport en objet simple, sérialisable en JSON.
 *
 * Les horodatages restent des chaînes ISO (avec « Z ») : c'est ce qui passe
 * par le cache sans perte. Google rend 1970 pour « jamais » ; on le rend
 * `null`, qui se lira « aucune activité connue ».
 */
const convertir_ = (parametres) => {
  const valeurs = {};
  parametres.forEach((p) => {
    if (p.intValue !== undefined) {
      valeurs[p.name] = Number(p.intValue);
    } else if (p.datetimeValue) {
      valeurs[p.name] = new Date(p.datetimeValue).getUTCFullYear() > 2000 ? p.datetimeValue : null;
    } else if (p.boolValue !== undefined) {
      valeurs[p.name] = p.boolValue;
    } else {
      valeurs[p.name] = p.stringValue;
    }
  });
  return valeurs;
};

/**
 * Charge le rapport d'un jour pour tout le domaine et ne garde que les cibles.
 *
 * Rend `{ valeurs, provisoire }`. `provisoire` est vrai quand Google signale
 * des données partielles (`PARTIAL_DATA_AVAILABLE`) : le jour est utilisé,
 * mais pas mis en cache, pour être redemandé au prochain rapport.
 *
 * Lève si une page échoue malgré les reprises : un jour à moitié lu se ferait
 * passer pour un jour calme.
 */
const chargerUsageJour_ = (jour, cibles, params, uniteOrganisationnelle) => {
  const avertissements = new Set();
  const parcours = SocleApi.parcourir((jeton) => {
    const options = { maxResults: 1000, parameters: params.join(',') };
    if (jeton) options.pageToken = jeton;
    const reponse = SocleReprises.avecReprises(() => AdminReports.UserUsageReport.get(
      'all', jour, optionsUsage_(uniteOrganisationnelle, options)));
    (reponse.warnings || []).forEach((a) => avertissements.add(a.code));
    return reponse;
  }, { champ: 'usageReports' });

  if (!parcours.complet) {
    throw new Error(`pagination interrompue après ${parcours.pages} pages`);
  }
  if (!parcours.elements.length && avertissements.has('DATA_NOT_AVAILABLE')) {
    throw new Error('données non publiées par Google pour ce jour');
  }

  const valeurs = new Map();
  parcours.elements.forEach((rapport) => {
    const email = String((rapport.entity && rapport.entity.userEmail) || '').toLowerCase();
    if (cibles.has(email)) valeurs.set(email, convertir_(rapport.parameters || []));
  });
  return { valeurs, provisoire: avertissements.has('PARTIAL_DATA_AVAILABLE') };
};

/** Convertit une page du journal Drive en lignes de l'onglet « Détail Drive ». */
const lignesJournalDrive_ = (compte, elements) => {
  const lignes = [];
  elements.forEach((element) => {
    (element.events || []).forEach((evenement) => {
      const p = {};
      (evenement.parameters || []).forEach((x) => {
        p[x.name] = x.value ?? x.boolValue ?? (x.multiValue || []).join(', ');
      });
      lignes.push([compte, new Date(element.id.time), evenement.name,
        p.doc_title || '', p.doc_type || '', p.owner || '', p.visibility || '']);
    });
  });
  return lignes;
};

/**
 * Lit le journal Drive d'un compte, à partir d'un jeton de page éventuel.
 *
 * Rend `{ lignes, jetonSuivant, complet }`. Quand le budget s'épuise au milieu
 * du journal d'un compte très actif, `jetonSuivant` permet à l'exécution
 * suivante de reprendre à la page exacte.
 */
const journalDrive_ = (compte, debut, jetonDepart, permet) => {
  const parcours = SocleApi.parcourir((jeton) => {
    const options = { startTime: debut, maxResults: 1000 };
    if (jeton) options.pageToken = jeton;
    return SocleReprises.avecReprises(() => AdminReports.Activities.list(compte, 'drive', options));
  }, { champ: 'items', permet, jetonDepart });
  return {
    lignes: lignesJournalDrive_(compte, parcours.elements),
    jetonSuivant: parcours.jetonSuivant,
    complet: parcours.complet,
  };
};

/**
 * Diagnostic d'un compte : `{ type, message }`, le type étant `ok`, `absent`
 * ou `erreur`. Le type est décidé ici, à la source, et non déduit plus loin
 * du texte du message — qui est traduit.
 */
const diagnostiquerCompte_ = (compte, jour) => {
  try {
    const reponse = SocleReprises.avecReprises(
      () => AdminReports.UserUsageReport.get(compte, jour));
    const codes = (reponse.warnings || []).map((a) => a.code).join(', ');
    const avertissements = codes ? ` ${t_('diagAvertissements', { codes })}` : '';
    return (reponse.usageReports || []).length
      ? { type: 'ok', message: `${t_('diagOk')}${avertissements}` }
      : { type: 'absent', message: `${t_('diagAbsent')}${avertissements}` };
  } catch (erreur) {
    return { type: 'erreur', message: t_('diagErreur', { detail: erreur.message }) };
  }
};
