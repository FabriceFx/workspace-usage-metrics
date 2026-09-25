/**
 * Métrique d'usage — interface Material Design 3 et traductions. Introduit en v0.3.
 *
 * Ce qui se traduit, c'est ce que l'outil **dit** à la personne qui s'en sert :
 * menu, boîtes de dialogue, erreurs, notifications. Le contenu du classeur —
 * noms d'onglets, en-têtes, statuts, bandeau, notes — reste en français : c'est
 * un document partagé, et il ne doit pas changer de langue selon qui a cliqué
 * en dernier. Les statuts sont en outre des valeurs que l'on filtre.
 *
 * Les tables passent par `SocleLangues` et l'échappement par `SocleTexte`,
 * recopiés du socle : c'est la divergence entre deux réécritures locales de
 * ces fonctions qui a justifié le socle.
 *
 * Tout l'interne de ce module est en `const … = () =>` ; seuls les points
 * d'entrée de `Metrique.gs` sont des `function` déclarées.
 */

/** Auteur et site : des faits, pas des libellés — ils ne vont pas au dictionnaire. */
const METRIQUE_AUTEUR = 'Fabrice Faucheux';
const METRIQUE_SITE = 'https://faucheux.bzh';

const METRIQUE_CHAINES = Object.freeze({
  fr: {
    menuTitre: 'Rapport d\'activité',
    menuGenerer: 'Générer le rapport',
    menuDiagnostiquer: 'Diagnostiquer les comptes',
    menuAbandonner: 'Abandonner le rapport en cours',
    menuAPropos: 'À propos',

    btnFermer: 'Fermer',
    btnCompris: 'Compris',

    diagTitre: 'Diagnostic des comptes',
    diagDerniereDate: 'Dernière date publiée par Google',
    diagSousTitre: 'Ce que Google répond pour chaque compte de la liste, sans rien écrire.',
    diagRecherche: 'Filtrer un compte ou un statut…',
    diagStatutOk: 'OK',
    diagStatutAbsent: 'Absent',
    diagStatutErreur: 'Erreur',
    diagStatutNonVerifie: 'Non vérifié',
    diagAucun: 'Aucun compte ne correspond à votre filtre.',
    diagTotal: { un: '{compte} compte', plusieurs: '{compte} comptes' },
    diagOk: 'Rapport d\'usage présent.',
    diagAbsent: 'Aucun rapport d\'usage : groupe, alias, compte suspendu ou hors de l\'unité '
      + 'organisationnelle ?',
    diagErreur: 'Google refuse la requête : {detail}',
    diagAvertissements: 'Avertissements de Google : {codes}.',
    diagNonVerifie: 'Non vérifié : le temps d\'exécution était épuisé. Relancez le diagnostic '
      + 'sur une liste plus courte.',

    aProposTitre: 'Rapport d\'activité Gmail et Drive',
    aProposSousTitre: 'Métrique d\'usage pour Google Workspace',
    aProposVersion: 'Version {version}',
    aProposLicence: 'Elastic License 2.0',
    aProposDevPar: 'Conçu et développé par',
    aProposFonctionnement: 'Fonctionnement',
    aProposComptesTitre: 'Comptes analysés',
    aProposComptesDesc: 'Lus dans l\'onglet « Comptes », colonne A, à partir de la ligne 2.',
    aProposReglagesTitre: 'Paramètres',
    aProposReglagesDesc: 'Fenêtres, seuils d\'activité et unité organisationnelle se règlent dans '
      + 'l\'onglet « Paramètres », sans modifier le code.',
    aProposSourcesTitre: 'Rapports d\'usage et journal Drive',
    aProposSourcesDesc: 'Google publie les compteurs d\'usage avec 2 à 3 jours de décalage. Le '
      + 'journal Drive est à jour à quelques heures près.',
    aProposNotesTitre: 'Lire les chiffres',
    aProposNotesDesc: 'Chaque en-tête de la synthèse porte une note qui dit d\'où vient le chiffre. '
      + 'Une cellule vide veut dire « non mesuré », jamais zéro.',
    aProposLangueTitre: 'Langue',
    aProposLangueDesc: 'L\'interface suit la langue de votre compte Google. Le contenu du classeur '
      + 'reste en français, pour que tous ses lecteurs voient le même document.',

    abandonTitre: 'Abandonner le rapport en cours ?',
    abandonMessage: 'Le rapport lancé le {debut} en est à l\'étape « {etape} ». Il ne se '
      + 'poursuivra plus. Les jours déjà chargés restent en cache : un nouveau rapport ne les '
      + 'redemandera pas.',
    abandonAucun: 'Aucun rapport n\'est en cours : il n\'y a rien à abandonner.',
    abandonConfirmation: 'Rapport abandonné.',

    errImprevuePrefixe: 'Erreur imprévue — ce n\'est pas votre saisie qui est en cause : ',
    errImprevueDetail: 'Le détail est dans Extensions > Apps Script > Exécutions. Signalez-la '
      + 'avec l\'heure à laquelle elle s\'est produite.',

    erreurReglage: 'Le réglage « {cle} » vaut « {valeur} » dans l\'onglet « {onglet} ». '
      + 'Saisissez un nombre entier entre {min} et {max}, puis relancez.',
    erreurSeuils: 'Les seuils de l\'onglet « {onglet} » doivent être croissants (actif < actif '
      + 'récemment < inactif) ; ils valent {actif}, {recent} et {inactif}. Corrigez-les, puis '
      + 'relancez.',
    erreurAucunCompte: 'Aucune adresse valide dans l\'onglet « {onglet} ». Saisissez une adresse '
      + 'par ligne en colonne A, à partir de la ligne 2, puis relancez.',
    erreurServiceRefuse: 'Le service de rapports Google refuse la requête ({detail}). Vérifiez que '
      + 'le service avancé « Admin SDK Reports » est activé, que votre compte dispose du '
      + 'privilège administrateur « Rapports » et, s\'il est renseigné, le réglage « Unité '
      + 'organisationnelle » ; puis relancez.',
    erreurAucuneDonnee: 'Aucune donnée d\'usage publiée sur les {jours} derniers jours. Si le '
      + 'réglage « Unité organisationnelle » est renseigné, vérifiez qu\'elle contient des '
      + 'utilisateurs ; sinon, réessayez demain.',
    erreurParametresRefuses: 'L\'API a refusé tous les paramètres d\'usage demandés. Vérifiez que '
      + 'les services Gmail et Drive sont activés pour le domaine, puis lancez « Diagnostiquer '
      + 'les comptes ».',
    erreurListeModifiee: 'La liste de l\'onglet « {onglet} » a changé pendant la génération. '
      + 'Relancez « Générer le rapport » : le rapport repartira de la liste actuelle.',
    erreurAucunJour: 'Aucun jour de la fenêtre n\'a pu être chargé. Lancez « Diagnostiquer les '
      + 'comptes » pour voir ce que Google répond, puis relancez.',

    notifVerrou: 'Une autre exécution travaille déjà sur ce classeur. Attendez qu\'elle se '
      + 'termine, puis relancez.',
    notifDejaEnCours: 'Un rapport est déjà en cours depuis le {debut} (étape : {etape}). Il se '
      + 'poursuit seul chaque minute. Pour repartir de zéro, choisissez « Abandonner le rapport '
      + 'en cours ».',
    notifReprise: 'Reprise d\'un rapport interrompu (étape : {etape}).',
    notifLance: {
      un: 'Rapport lancé sur {compte} compte. Jours déjà en cache : {enCache} ; à charger : {aCharger}.',
      plusieurs: 'Rapport lancé sur {compte} comptes. Jours déjà en cache : {enCache} ; à charger : {aCharger}.',
    },
    notifSuspendu: 'Rapport en cours ({etape}). La suite reprend seule dans une minute ; '
      + 'l\'onglet « Synthèse » sera mis à jour à la fin.',
    notifTermine: {
      un: '{compte} compte analysé. Synthèse à jour.',
      plusieurs: '{compte} comptes analysés. Synthèse à jour.',
    },

    etapeUsage: 'rapports d\'usage, {traites} jour(s) sur {total}',
    etapeDrive: 'journal Drive, compte n° {rang}',
    etapeFin: 'écriture de la synthèse',
  },
  en: {
    menuTitre: 'Activity report',
    menuGenerer: 'Generate report',
    menuDiagnostiquer: 'Diagnose accounts',
    menuAbandonner: 'Abort current report',
    menuAPropos: 'About',

    btnFermer: 'Close',
    btnCompris: 'Got it',

    diagTitre: 'Account diagnostics',
    diagDerniereDate: 'Latest date published by Google',
    diagSousTitre: 'What Google answers for each account in the list. Nothing is written.',
    diagRecherche: 'Filter by account or status…',
    diagStatutOk: 'OK',
    diagStatutAbsent: 'Missing',
    diagStatutErreur: 'Error',
    diagStatutNonVerifie: 'Not checked',
    diagAucun: 'No account matches your filter.',
    diagTotal: { un: '{compte} account', plusieurs: '{compte} accounts' },
    diagOk: 'Usage report available.',
    diagAbsent: 'No usage report: group, alias, suspended account, or outside the '
      + 'organizational unit?',
    diagErreur: 'Google rejects the request: {detail}',
    diagAvertissements: 'Google warnings: {codes}.',
    diagNonVerifie: 'Not checked: execution time ran out. Run the diagnostics again on a '
      + 'shorter list.',

    aProposTitre: 'Gmail and Drive activity report',
    aProposSousTitre: 'Usage metrics for Google Workspace',
    aProposVersion: 'Version {version}',
    aProposLicence: 'Elastic License 2.0',
    aProposDevPar: 'Designed and developed by',
    aProposFonctionnement: 'How it works',
    aProposComptesTitre: 'Analyzed accounts',
    aProposComptesDesc: 'Read from the « Comptes » sheet, column A, from row 2.',
    aProposReglagesTitre: 'Settings',
    aProposReglagesDesc: 'Time windows, activity thresholds and organizational unit are set in '
      + 'the « Paramètres » sheet, without editing code.',
    aProposSourcesTitre: 'Usage reports and Drive log',
    aProposSourcesDesc: 'Google publishes usage counters with a 2 to 3 day delay. The Drive '
      + 'audit log is up to date within a few hours.',
    aProposNotesTitre: 'Reading the figures',
    aProposNotesDesc: 'Each summary header carries a note saying where the figure comes from. '
      + 'A blank cell means « not measured », never zero.',
    aProposLangueTitre: 'Language',
    aProposLangueDesc: 'The interface follows your Google account language. The spreadsheet '
      + 'content stays in French, so that every reader sees the same document.',

    abandonTitre: 'Abort the current report?',
    abandonMessage: 'The report started on {debut} is at step « {etape} ». It will not '
      + 'continue. Days already loaded stay cached: a new report will not fetch them again.',
    abandonAucun: 'No report is running: there is nothing to abort.',
    abandonConfirmation: 'Report aborted.',

    errImprevuePrefixe: 'Unexpected error — your input is not the cause: ',
    errImprevueDetail: 'Details are in Extensions > Apps Script > Executions. Report it with '
      + 'the time it occurred.',

    erreurReglage: 'The setting « {cle} » is « {valeur} » in the « {onglet} » sheet. Enter a '
      + 'whole number between {min} and {max}, then run again.',
    erreurSeuils: 'The thresholds in the « {onglet} » sheet must increase (active < recently '
      + 'active < inactive); they are {actif}, {recent} and {inactif}. Fix them, then run again.',
    erreurAucunCompte: 'No valid address in the « {onglet} » sheet. Enter one address per row '
      + 'in column A, from row 2, then run again.',
    erreurServiceRefuse: 'The Google reports service rejects the request ({detail}). Check that '
      + 'the « Admin SDK Reports » advanced service is enabled, that your account has the '
      + '« Reports » admin privilege and, if set, the « Unité organisationnelle » setting; then '
      + 'run again.',
    erreurAucuneDonnee: 'No usage data published over the last {jours} days. If the « Unité '
      + 'organisationnelle » setting is filled in, check that it contains users; otherwise, try '
      + 'again tomorrow.',
    erreurParametresRefuses: 'The API rejected every requested usage parameter. Check that Gmail '
      + 'and Drive are enabled for the domain, then run « Diagnose accounts ».',
    erreurListeModifiee: 'The list in the « {onglet} » sheet changed during generation. Run '
      + '« Generate report » again: it will start from the current list.',
    erreurAucunJour: 'No day of the window could be loaded. Run « Diagnose accounts » to see '
      + 'what Google answers, then run again.',

    notifVerrou: 'Another execution is already working on this spreadsheet. Wait for it to '
      + 'finish, then run again.',
    notifDejaEnCours: 'A report has been running since {debut} (step: {etape}). It continues on '
      + 'its own every minute. To start over, choose « Abort current report ».',
    notifReprise: 'Resuming an interrupted report (step: {etape}).',
    notifLance: {
      un: 'Report started on {compte} account. Days already cached: {enCache}; to load: {aCharger}.',
      plusieurs: 'Report started on {compte} accounts. Days already cached: {enCache}; to load: {aCharger}.',
    },
    notifSuspendu: 'Report in progress ({etape}). It resumes on its own in a minute; the '
      + '« Synthèse » sheet will be updated at the end.',
    notifTermine: {
      un: '{compte} account analyzed. Summary updated.',
      plusieurs: '{compte} accounts analyzed. Summary updated.',
    },

    etapeUsage: 'usage reports, day {traites} of {total}',
    etapeDrive: 'Drive log, account #{rang}',
    etapeFin: 'writing the summary',
  },
});

/**
 * Langue et déclaration des tables, une fois par exécution.
 *
 * Rien n'est appelé au niveau du fichier : Apps Script charge les fichiers
 * dans l'ordre du projet, et un appel à `SocleLangues` avant que son fichier
 * soit chargé ferait échouer le chargement du projet entier.
 */
const METRIQUE_LANGUE_ = { code: '', declaree: false };

/** 'fr' ou 'en', d'après la langue du compte Google ; 'fr' à défaut. */
const langue_ = () => {
  if (!METRIQUE_LANGUE_.code) {
    let locale = '';
    try {
      locale = String(Session.getActiveUserLocale() || '');
    } catch (erreur) {
      console.log(`Langue de l'utilisateur illisible (${erreur.message}) : français.`);
    }
    METRIQUE_LANGUE_.code = locale.toLowerCase().startsWith('en') ? 'en' : 'fr';
  }
  return METRIQUE_LANGUE_.code;
};

const declarerChaines_ = () => {
  if (METRIQUE_LANGUE_.declaree) return;
  SocleLangues.declarer({ defaut: 'fr', chaines: METRIQUE_CHAINES });
  METRIQUE_LANGUE_.declaree = true;
};

/** Traduit une clé dans la langue de l'utilisateur. Une clé absente se voit : ⟨cle⟩. */
const t_ = (cle, valeurs) => {
  declarerChaines_();
  return SocleLangues.traduire(langue_(), cle, valeurs);
};

/**
 * Traduit une clé en français, quelle que soit la langue de l'utilisateur.
 * Pour ce qui s'écrit dans le classeur : c'est un document partagé, et son
 * contenu est en français.
 */
const tClasseur_ = (cle, valeurs) => {
  declarerChaines_();
  return SocleLangues.traduire('fr', cle, valeurs);
};

/* ============================ FEUILLE DE STYLE MD3 ============================ */

/** Feuilles de style complètes au standard Material Design 3 (Google Workspace). */
const stylesMd3_ = () => `
  <style>
    :root {
      --md-sys-color-primary: #0b57d0;
      --md-sys-color-on-primary: #ffffff;
      --md-sys-color-primary-container: #d3e3fd;
      --md-sys-color-on-primary-container: #041e49;
      --md-sys-color-surface: #ffffff;
      --md-sys-color-surface-container: #f0f4f9;
      --md-sys-color-surface-container-high: #e9eef6;
      --md-sys-color-surface-container-highest: #dde3ea;
      --md-sys-color-on-surface: #1f1f1f;
      --md-sys-color-on-surface-variant: #444746;
      --md-sys-color-outline: #74777f;
      --md-sys-color-outline-variant: #c4c7c5;
      
      --md-sys-color-success: #146c2e;
      --md-sys-color-success-container: #c4eed0;
      --md-sys-color-warning: #8f4e00;
      --md-sys-color-warning-container: #ffe088;
      --md-sys-color-error: #ba1a1a;
      --md-sys-color-error-container: #ffdad6;
      --md-sys-color-on-error: #ffffff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Google Sans', 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 14px;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    .md-dialog-header {
      padding: 20px 24px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface);
    }

    .md-dialog-header-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .md-dialog-header-text h1 {
      font-size: 18px;
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
      line-height: 1.25;
    }

    .md-dialog-header-text p {
      font-size: 12px;
      color: var(--md-sys-color-on-surface-variant);
      margin-top: 2px;
    }

    .md-dialog-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .md-card {
      background: var(--md-sys-color-surface-container);
      border-radius: 16px;
      padding: 16px;
      border: 1px solid var(--md-sys-color-outline-variant);
      transition: background 0.15s ease;
    }

    .md-card-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--md-sys-color-primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .md-card-body {
      font-size: 13px;
      color: var(--md-sys-color-on-surface-variant);
      line-height: 1.45;
    }

    .md-badges-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .md-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
    }

    .md-badge-primary {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .md-badge-success {
      background: var(--md-sys-color-success-container);
      color: var(--md-sys-color-success);
    }

    .md-badge-warning {
      background: var(--md-sys-color-warning-container);
      color: var(--md-sys-color-warning);
    }

    .md-badge-error {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-error);
    }

    .md-search-box {
      position: relative;
      margin-bottom: 8px;
    }

    .md-search-input {
      width: 100%;
      padding: 10px 14px 10px 38px;
      border-radius: 20px;
      border: 1px solid var(--md-sys-color-outline);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 13px;
      outline: none;
      transition: all 0.2s ease;
    }

    .md-search-input:focus {
      border-color: var(--md-sys-color-primary);
      box-shadow: 0 0 0 2px var(--md-sys-color-primary-container);
    }

    .md-search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--md-sys-color-outline);
      font-size: 14px;
    }

    .md-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .md-list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--md-sys-color-surface-container);
      border-radius: 12px;
      border: 1px solid var(--md-sys-color-outline-variant);
      transition: background 0.15s ease, transform 0.1s ease;
    }

    .md-list-item:hover {
      background: var(--md-sys-color-surface-container-high);
      transform: translateX(2px);
    }

    .md-list-item-account {
      font-weight: 500;
      color: var(--md-sys-color-on-surface);
      word-break: break-all;
    }

    .md-list-item-detail {
      font-size: 11px;
      color: var(--md-sys-color-on-surface-variant);
      margin-top: 2px;
    }

    .md-dialog-footer {
      padding: 14px 24px;
      border-top: 1px solid var(--md-sys-color-outline-variant);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--md-sys-color-surface);
    }

    .md-button {
      padding: 10px 24px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .md-button-filled {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }

    .md-button-filled:hover {
      box-shadow: 0 2px 6px rgba(11,87,208,0.25);
      background: #0842a0;
    }

    .md-button-tonal {
      background: var(--md-sys-color-surface-container-highest);
      color: var(--md-sys-color-on-surface);
    }

    .md-button-tonal:hover {
      background: var(--md-sys-color-outline-variant);
    }

    .md-link {
      color: var(--md-sys-color-primary);
      text-decoration: none;
      font-weight: 500;
    }

    .md-link:hover { text-decoration: underline; }

    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: var(--md-sys-color-outline-variant);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover { background: var(--md-sys-color-outline); }
  </style>
`;

/** Gabarit HTML complet avec scripts de fermeture et gestion de la touche Échap. */
const gabaritHtmlMd3_ = (titre, icone, sousTitre, corpsHtml, footerHtml) => `
  <!DOCTYPE html>
  <html>
    <head>
      <base target="_top">
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${stylesMd3_()}
    </head>
    <body>
      <div class="md-dialog-header">
        <div class="md-dialog-header-icon" aria-hidden="true">${icone}</div>
        <div class="md-dialog-header-text">
          <h1>${SocleTexte.echapperHtml(titre)}</h1>
          ${sousTitre ? `<p>${SocleTexte.echapperHtml(sousTitre)}</p>` : ''}
        </div>
      </div>
      <div class="md-dialog-body">
        ${corpsHtml}
      </div>
      <div class="md-dialog-footer">
        ${footerHtml}
      </div>
      <script>
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') google.script.host.close();
        });
      </script>
    </body>
  </html>
`;

/* ============================ DIALOGUES ============================ */

/** Paragraphe « titre : description » d'une carte. */
const paragrapheCarte_ = (cleTitre, cleDescription) => {
  const e = SocleTexte.echapperHtml;
  return `<p style="margin-bottom: 6px;"><strong>${e(t_(cleTitre))}</strong> : ${e(t_(cleDescription))}</p>`;
};

const afficherAProposMd3_ = () => {
  const e = SocleTexte.echapperHtml;
  const corps = `
    <div class="md-card">
      <div class="md-card-title">ℹ️ ${e(t_('aProposVersion', { version: METRIQUE_VERSION }))}</div>
      <div class="md-card-body">
        ${e(t_('aProposSousTitre'))}
        <div class="md-badges-row">
          <span class="md-badge md-badge-primary">v${e(METRIQUE_VERSION)}</span>
          <span class="md-badge md-badge-primary">${e(t_('aProposLicence'))}</span>
        </div>
      </div>
    </div>

    <div class="md-card">
      <div class="md-card-title">📊 ${e(t_('aProposFonctionnement'))}</div>
      <div class="md-card-body">
        ${paragrapheCarte_('aProposComptesTitre', 'aProposComptesDesc')}
        ${paragrapheCarte_('aProposReglagesTitre', 'aProposReglagesDesc')}
        ${paragrapheCarte_('aProposSourcesTitre', 'aProposSourcesDesc')}
        ${paragrapheCarte_('aProposNotesTitre', 'aProposNotesDesc')}
        ${paragrapheCarte_('aProposLangueTitre', 'aProposLangueDesc')}
      </div>
    </div>

    <div class="md-card">
      <div class="md-card-title">👨‍💻 ${e(t_('aProposDevPar'))}</div>
      <div class="md-card-body">
        <strong>${e(METRIQUE_AUTEUR)}</strong> —
        <a class="md-link" href="${SocleTexte.urlSure(METRIQUE_SITE)}" target="_blank" rel="noopener">${e(METRIQUE_SITE)}</a>
      </div>
    </div>
  `;
  const pied = `
    <span style="font-size: 11px; color: var(--md-sys-color-on-surface-variant);">${e(t_('aProposLicence'))}</span>
    <button class="md-button md-button-filled" onclick="google.script.host.close()">${e(t_('btnFermer'))}</button>
  `;
  const html = gabaritHtmlMd3_(t_('aProposTitre'), '📈', t_('aProposSousTitre'), corps, pied);
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(580).setHeight(560), t_('aProposTitre'));
};

/** Badge et libellé de chaque type de résultat du diagnostic. */
const BADGES_DIAGNOSTIC = Object.freeze({
  ok: { classe: 'md-badge-success', cle: 'diagStatutOk' },
  absent: { classe: 'md-badge-warning', cle: 'diagStatutAbsent' },
  erreur: { classe: 'md-badge-error', cle: 'diagStatutErreur' },
  nonVerifie: { classe: 'md-badge-primary', cle: 'diagStatutNonVerifie' },
});

/**
 * Modale du diagnostic. `resultats` porte un **type** calculé à la source
 * (`ok`, `absent`, `erreur`, `nonVerifie`) : le classer d'après le début de
 * son message cesserait de fonctionner dès que le message est traduit.
 */
const afficherDiagnosticMd3_ = (jour, resultats) => {
  const e = SocleTexte.echapperHtml;
  const lignes = resultats.map((r) => {
    const badge = BADGES_DIAGNOSTIC[r.type];
    const libelle = t_(badge.cle);
    // Le filtre porte sur le libellé affiché, dans la langue affichée : on
    // cherche « erreur » ou « error », pas un identifiant interne.
    return `
      <div class="md-list-item" data-filtre="${e(`${r.compte} ${libelle}`.toLowerCase())}">
        <div>
          <div class="md-list-item-account">${e(r.compte)}</div>
          <div class="md-list-item-detail">${e(r.message)}</div>
        </div>
        <span class="md-badge ${badge.classe}">${e(libelle)}</span>
      </div>`;
  }).join('');

  const corps = `
    <div class="md-card" style="padding: 12px 16px;">
      <div style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">${e(t_('diagDerniereDate'))}</div>
      <div style="font-size: 16px; font-weight: 600; color: var(--md-sys-color-primary); margin-top: 2px;">📅 ${e(SocleDates.lisible(jour, langue_()))}</div>
    </div>

    <div class="md-search-box">
      <span class="md-search-icon" aria-hidden="true">🔍</span>
      <input type="text" id="rechercheCompte" class="md-search-input" placeholder="${e(t_('diagRecherche'))}" oninput="filtrerComptes()">
    </div>

    <div class="md-list" id="listeComptes">${lignes}</div>
    <div id="aucunResultat" style="display: none; padding: 24px; text-align: center; color: var(--md-sys-color-on-surface-variant); font-size: 13px;">
      ${e(t_('diagAucun'))}
    </div>

    <script>
      function filtrerComptes() {
        const filtre = document.getElementById('rechercheCompte').value.toLowerCase().trim();
        let visibles = 0;
        document.querySelectorAll('.md-list-item').forEach((el) => {
          const garde = el.getAttribute('data-filtre').includes(filtre);
          el.style.display = garde ? 'flex' : 'none';
          if (garde) visibles += 1;
        });
        document.getElementById('aucunResultat').style.display = visibles === 0 ? 'block' : 'none';
      }
    </script>
  `;
  const pied = `
    <span style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); font-weight: 500;">
      ${e(t_('diagTotal', { compte: resultats.length }))}
    </span>
    <button class="md-button md-button-filled" onclick="google.script.host.close()">${e(t_('btnFermer'))}</button>
  `;
  const html = gabaritHtmlMd3_(t_('diagTitre'), '🔍', t_('diagSousTitre'), corps, pied);
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(640).setHeight(560), t_('diagTitre'));
};

/** Message d'information ou d'erreur. */
const afficherBoiteMd3_ = (titre, message, type = 'info') => {
  const e = SocleTexte.echapperHtml;
  const paragraphes = String(message).split('\n')
    .map((ligne) => `<p style="margin-bottom: 6px;">${e(ligne)}</p>`).join('');
  const corps = `
    <div class="md-card">
      <div class="md-card-body" style="font-size: 13px; line-height: 1.5; color: var(--md-sys-color-on-surface);">
        ${paragraphes}
      </div>
    </div>
  `;
  const pied = `
    <span></span>
    <button class="md-button md-button-filled" onclick="google.script.host.close()">${e(t_('btnCompris'))}</button>
  `;
  const html = gabaritHtmlMd3_(titre, type === 'erreur' ? '⚠️' : 'ℹ️', '', corps, pied);
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(520).setHeight(340), titre);
};
