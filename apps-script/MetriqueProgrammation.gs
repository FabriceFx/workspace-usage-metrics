/**
 * Métrique d'usage — rapport programmé chaque semaine. Introduit en v0.4.
 *
 * Un déclencheur hebdomadaire est **installable** : il s'exécute sous
 * l'identité de l'administrateur qui l'a posé, avec ses droits de lecture sur
 * les rapports Google, même quand personne n'ouvre le classeur. Or quiconque
 * peut modifier le classeur peut aussi modifier son script, et ce code
 * tournerait alors avec ces droits. D'où trois règles :
 *
 *   - rien ne se programme sans une confirmation qui dit ce risque ;
 *   - un seul déclencheur par classeur, et l'on retient qui l'a posé : un
 *     déclencheur appartient à son auteur, qui seul peut le retirer — un
 *     second administrateur qui en poserait un autre doublerait les rapports
 *     sans pouvoir arrêter le premier ;
 *   - le jour et l'heure se règlent dans l'onglet « Paramètres », mais ne
 *     s'appliquent qu'à la prochaine programmation : un déclencheur ne relit
 *     pas l'onglet.
 */

const CLE_PROGRAMMATION = 'METRIQUE_PROGRAMMATION';

/** Jours acceptés dans l'onglet « Paramètres », leur jour Apps Script et leur libellé. */
const JOURS_PROGRAMMATION = Object.freeze({
  lundi: { jourSemaine: 'MONDAY', cle: 'jourLundi' },
  mardi: { jourSemaine: 'TUESDAY', cle: 'jourMardi' },
  mercredi: { jourSemaine: 'WEDNESDAY', cle: 'jourMercredi' },
  jeudi: { jourSemaine: 'THURSDAY', cle: 'jourJeudi' },
  vendredi: { jourSemaine: 'FRIDAY', cle: 'jourVendredi' },
  samedi: { jourSemaine: 'SATURDAY', cle: 'jourSamedi' },
  dimanche: { jourSemaine: 'SUNDAY', cle: 'jourDimanche' },
});

/**
 * L'adresse de qui exécute, ou `''`. `getActiveUser` peut rendre une chaîne
 * vide (compte hors domaine, contexte restreint) : on ne l'invente pas.
 */
const adresseCourante_ = () => {
  try {
    return String(Session.getActiveUser().getEmail() || '');
  } catch (erreur) {
    console.log(`Adresse de l'utilisateur illisible : ${erreur.message}`);
    return '';
  }
};

const lireProgrammation_ = () => {
  const brut = PropertiesService.getDocumentProperties().getProperty(CLE_PROGRAMMATION);
  return brut ? JSON.parse(brut) : null;
};

/** Vrai si l'exécutant courant a lui-même posé un déclencheur hebdomadaire. */
const programmeParMoi_ = () => SocleExecution.repriseProgrammee('rapportProgramme');

const programmerRapport_ = () => {
  const classeur = SpreadsheetApp.getActive();
  const { jourProgramme, heureProgramme } = lireParametres_(classeur);
  const moi = adresseCourante_();
  // Sans adresse, la propriété du déclencheur ne peut pas être retenue : un
  // second administrateur en poserait un autre, ou effacerait la mention.
  if (!moi) {
    afficher_(t_('menuProgrammer'), t_('progAdresseRequise'));
    return;
  }
  const existante = lireProgrammation_();
  const jour = t_(JOURS_PROGRAMMATION[jourProgramme].cle);

  if (existante && !programmeParMoi_() && existante.par && existante.par !== moi) {
    afficher_(t_('menuProgrammer'), t_('progDejaAutre', {
      par: existante.par, le: SocleDates.lisible(existante.le, langue_()),
    }));
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const reponse = ui.alert(t_('progConfirmTitre'), t_('progConfirmMessage', {
    jour, heure: heureProgramme, par: moi,
  }), ui.ButtonSet.OK_CANCEL);
  if (reponse !== ui.Button.OK) return;

  // Ramasser d'abord : reprogrammer après avoir changé l'heure ne doit pas
  // laisser deux déclencheurs derrière soi.
  SocleExecution.retirerReprise('rapportProgramme');
  ScriptApp.newTrigger('rapportProgramme').timeBased()
    .onWeekDay(ScriptApp.WeekDay[JOURS_PROGRAMMATION[jourProgramme].jourSemaine])
    .atHour(heureProgramme)
    .create();
  PropertiesService.getDocumentProperties().setProperty(CLE_PROGRAMMATION, JSON.stringify({
    par: moi, le: new Date().toISOString(), jour: jourProgramme, heure: heureProgramme,
  }));
  notifier_(t_('progFait', { jour, heure: heureProgramme }));
};

const arreterRapportProgramme_ = () => {
  const existante = lireProgrammation_();
  if (programmeParMoi_()) {
    SocleExecution.retirerReprise('rapportProgramme');
    PropertiesService.getDocumentProperties().deleteProperty(CLE_PROGRAMMATION);
    notifier_(t_('progArrete'));
    return;
  }
  if (existante && existante.par && existante.par !== adresseCourante_()) {
    afficher_(t_('menuArreterProgramme'), t_('progAutreArret', { par: existante.par }));
    return;
  }
  // Mention sans déclencheur : il a été supprimé à la main depuis l'éditeur.
  if (existante) PropertiesService.getDocumentProperties().deleteProperty(CLE_PROGRAMMATION);
  afficher_(t_('menuArreterProgramme'), t_('progAucun'));
};
