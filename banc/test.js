/**
 * Métrique d'usage — banc d'essai.
 *
 *     node banc/test.js
 *
 * Les `.gs` sont chargés dans un contexte Node où les services Google sont
 * simulés (`banc/faux-google.js`), puis rejoués sur des données de la forme
 * exacte que rendent les API : `intValue` en chaîne, horodatages ISO en UTC,
 * 1970 pour « jamais », adresses dont la casse varie, pages de 1 000.
 *
 * Chaque défaut corrigé en v0.2 a ici le cas qui l'aurait attrapé ; la
 * mention « Défaut v0.1 » le signale.
 */

'use strict';

// Avant toute création de Date : le fuseau du script est Europe/Paris, et un
// banc qui tournerait en UTC ne verrait aucun défaut de fuseau.
process.env.TZ = 'Europe/Paris';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { installerFauxGoogle } = require('./faux-google');

const RACINE = path.join(__dirname, '..');
const SOURCES = path.join(RACINE, 'apps-script');
const fichiers = fs.readdirSync(SOURCES).filter((n) => n.endsWith('.gs')).sort();

/* ------------------------------ Jeu de données ------------------------------ */

const jourParis = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

const decaler = (jour, n) => {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().substring(0, 10);
};

const AUJOURDHUI = jourParis(new Date());
const PUBLIE = decaler(AUJOURDHUI, -3);

const GROUPE = 'equipe@exemple.fr';
const ACCUEIL = 'accueil@exemple.fr';
const COMPTA = 'compta@exemple.fr';
const RH = 'rh@exemple.fr';
const COMPTES = [GROUPE, ACCUEIL, COMPTA, RH]; // le groupe en premier : Défaut v0.1

const hash = (texte) => [...texte].reduce((h, c) => ((h * 31) + c.charCodeAt(0)) >>> 0, 7);

/** Compteurs d'un compte pour un jour, déterministes. */
const compteurs = (email, jour) => {
  const n = hash(email + jour);
  if (email === ACCUEIL) {
    return { recus: n % 20, envoyes: n % 4, crees: n % 3, modifies: n % 5, consultes: n % 7 };
  }
  if (email === RH) return { recus: n % 9, envoyes: 0, crees: 0, modifies: 0, consultes: 0 };
  if (email === COMPTA) return { recus: 0, envoyes: 0, crees: 0, modifies: 0, consultes: 0 };
  return { recus: n % 3, envoyes: n % 2, crees: 0, modifies: n % 2, consultes: 0 };
};

const parametres = (email, jour) => {
  const c = compteurs(email, jour);
  const connexion = {
    [ACCUEIL]: `${jour}T08:00:00.000Z`,
    [COMPTA]: `${decaler(AUJOURDHUI, -200)}T09:00:00.000Z`,
    [RH]: `${decaler(PUBLIE, -40)}T09:00:00.000Z`,
  }[email] || `${jour}T07:00:00.000Z`;
  const interaction = email === ACCUEIL ? `${jour}T10:00:00.000Z` : '1970-01-01T00:00:00.000Z';
  return [
    { nom: 'accounts:last_login_time', datetimeValue: connexion },
    { nom: 'accounts:gmail_used_quota_in_mb', intValue: email === ACCUEIL ? '1234' : '10' },
    { nom: 'accounts:drive_used_quota_in_mb', intValue: '0' },
    { nom: 'gmail:last_interaction_time', datetimeValue: interaction },
    { nom: 'gmail:num_emails_received', intValue: String(c.recus) },
    { nom: 'gmail:num_emails_sent', intValue: String(c.envoyes) },
    { nom: 'drive:num_items_created', intValue: String(c.crees) },
    { nom: 'drive:num_items_edited', intValue: String(c.modifies) },
    { nom: 'drive:num_items_viewed', intValue: String(c.consultes) },
  ];
};

/** 2 500 agents : trois pages de 1 000, l'accueil en tête et les RH en dernière page. */
const UTILISATEURS = [ACCUEIL,
  ...Array.from({ length: 2500 }, (_, i) => `agent${i}@exemple.fr`), COMPTA, RH];

const evenements = (email, nombre, depuis) => Array.from({ length: nombre }, (_, i) => ({
  time: new Date(Date.parse(`${depuis}T12:00:00Z`) + i * 60000).toISOString(),
  name: i % 2 ? 'edit' : 'view',
  titre: `Document ${i}`,
}));

/** Un titre de fichier que n'importe qui peut donner à un document partagé. */
const TITRE_FORMULE = '=IMAGE("https://exemple.invalid/pixel?fuite=1")';

const nouveauxReports = (surcharges = {}) => ({
  publieJusquA: PUBLIE,
  utilisateurs: UTILISATEURS,
  parametres,
  parametresRefuses: [],
  pannes: {},
  avertissements: {},
  evenementsDrive: {
    [ACCUEIL]: [...evenements(ACCUEIL, 10, decaler(AUJOURDHUI, -2)),
      { time: `${decaler(AUJOURDHUI, -2)}T15:00:00.000Z`, name: 'view', titre: TITRE_FORMULE },
      { time: `${decaler(AUJOURDHUI, -2)}T15:01:00.000Z`, name: 'view', titre: '2026-09-01' }],
    [RH]: evenements(RH, 2500, decaler(AUJOURDHUI, -3)),
  },
  ...surcharges,
});

/* ------------------------------ Chargement ------------------------------ */

const charger = (options = {}) => {
  const sandbox = {};
  vm.createContext(sandbox);
  const DateContexte = vm.runInContext('Date', sandbox);
  const faux = installerFauxGoogle(sandbox, DateContexte,
    { reports: nouveauxReports(), ...options });
  vm.runInContext('Date.now = ((reel) => () => reel() + __horloge.decalage)(Date.now);', sandbox);
  fichiers.forEach((nom) => {
    vm.runInContext(fs.readFileSync(path.join(SOURCES, nom), 'utf8'), sandbox, { filename: nom });
  });
  const lire = (expression) => vm.runInContext(expression, sandbox);
  const ecrireComptes = (comptes) => {
    const feuille = faux.classeur.getSheetByName('Comptes') || faux.classeur.insertSheet('Comptes');
    feuille.clear();
    feuille.getRange(1, 1, comptes.length + 1, 1)
      .setValues([['Adresse du compte'], ...comptes.map((c) => [c])]);
  };
  if (!options.sansComptes) ecrireComptes(options.comptes || COMPTES);
  const feuille = (nom) => faux.classeur.getSheetByName(nom);
  const synthese = () => {
    const v = feuille('Synthèse').valeurs();
    const entetes = v[2];
    const lignes = new Map(v.slice(3).map((l) => [l[0], Object.fromEntries(entetes.map((e, i) => [e, l[i]]))]));
    return { bandeau: v[0][0], reserves: v[1][0], entetes, lignes };
  };
  /** Rejoue les reprises comme le ferait Google, jusqu'à la fin. */
  const reprendreJusquAuBout = () => {
    let tours = 0;
    while (faux.declencheurs.some((d) => d.getHandlerFunction() === 'reprendreRapport')) {
      tours += 1;
      assert.ok(tours < 100, 'le rapport ne se termine pas');
      sandbox.reprendreRapport();
    }
    return tours;
  };
  return { ...faux, sandbox, lire, ecrireComptes, feuille, synthese, reprendreJusquAuBout };
};

/** Cumuls attendus, calculés hors du code testé. */
const attendu = (email, cle, fenetre, exclus = []) => Array.from({ length: fenetre }, (_, i) => decaler(PUBLIE, -i))
  .filter((j) => !exclus.includes(j))
  .reduce((s, j) => s + compteurs(email, j)[cle], 0);

const memeJour = (cellule, jour) => {
  assert.strictEqual(Object.prototype.toString.call(cellule), '[object Date]', `pas une Date : ${cellule}`);
  assert.strictEqual(`${cellule.getFullYear()}-${String(cellule.getMonth() + 1).padStart(2, '0')}-`
    + `${String(cellule.getDate()).padStart(2, '0')}`, jour);
};

/** Ligne d'un réglage dans l'onglet Paramètres, trouvée par sa clé et jamais par son rang. */
const ligneReglage = (t, cle) => t.feuille('Paramètres').valeurs().findIndex(([c]) => c === cle) + 1;

/* ------------------------------ Mini-cadre ------------------------------ */

let reussis = 0;
const echecs = [];
const cas = (nom, fonction) => {
  try {
    fonction();
    reussis += 1;
    console.log(`  ✓ ${nom}`);
  } catch (erreur) {
    echecs.push(nom);
    console.log(`  ✗ ${nom}\n      ${String(erreur.stack || erreur).split('\n').slice(0, 4).join('\n      ')}`);
  }
};

/* ============================ A. Chargement et contrôles statiques ============================ */

console.log('A. Chargement et contrôles statiques');

const sourceProjet = fichiers.map((n) => fs.readFileSync(path.join(SOURCES, n), 'utf8'));
const sourceMetrique = fichiers.filter((n) => n.startsWith('Metrique'))
  .map((n) => fs.readFileSync(path.join(SOURCES, n), 'utf8')).join('\n');

cas('le projet entier se charge, fichiers concaténés comme dans Apps Script', () => {
  new vm.Script(sourceProjet.join('\n')); // lève sur une constante globale déclarée deux fois
  charger();
});

cas('METRIQUE_VERSION vaut le fichier VERSION, et le CHANGELOG commence par elle', () => {
  const version = fs.readFileSync(path.join(RACINE, 'VERSION'), 'utf8').trim();
  assert.strictEqual(charger().lire('METRIQUE_VERSION'), version);
  const premiere = fs.readFileSync(path.join(RACINE, 'CHANGELOG.md'), 'utf8').match(/## \[(\d+\.\d+\.\d+)\]/);
  assert.strictEqual(premiere && premiere[1], version);
});

cas('seuls les points d\'entrée sont des function déclarées', () => {
  const declarees = [...sourceMetrique.matchAll(/^function (\w+)/gm)].map((m) => m[1]).sort();
  assert.deepStrictEqual(declarees, ['aPropos', 'abandonnerRapport', 'arreterRapportProgramme',
    'diagnostiquer', 'genererRapport', 'onOpen', 'programmerRapport', 'rapportProgramme',
    'reprendreRapport']);
});

cas('chaque entrée de menu vise une function déclarée', () => {
  const { sandbox } = charger();
  [...sourceMetrique.matchAll(/addItem\([^,]+,\s*'(\w+)'\)/g)].forEach(([, nom]) => {
    assert.strictEqual(typeof sandbox[nom], 'function', nom);
  });
});

cas('aucun .slice(0, 10) sur un horodatage, aucun service hors portée', () => {
  assert.ok(!/\.slice\(0, 10\)/.test(sourceMetrique));
  assert.ok(!/GmailApp|MailApp|DriveApp|openById|UrlFetchApp/.test(sourceMetrique));
});

cas('appsscript.json : Reports activé, portées en lecture seule et currentonly', () => {
  const manifeste = JSON.parse(fs.readFileSync(path.join(SOURCES, 'appsscript.json'), 'utf8'));
  assert.strictEqual(manifeste.runtimeVersion, 'V8');
  assert.ok(manifeste.dependencies.enabledAdvancedServices.some((s) => s.userSymbol === 'AdminReports'));
  manifeste.oauthScopes.filter((s) => s.includes('admin.')).forEach((s) => assert.ok(s.endsWith('.readonly'), s));
  assert.ok(manifeste.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.currentonly'));
});

cas('decalerJour_ traverse les changements d\'heure sans sauter de jour', () => {
  const { lire } = charger();
  assert.strictEqual(lire('decalerJour_("2026-10-26", -1)'), '2026-10-25');
  assert.strictEqual(lire('decalerJour_("2026-10-25", -1)'), '2026-10-24');
  assert.strictEqual(lire('decalerJour_("2026-03-30", -2)'), '2026-03-28');
  assert.strictEqual(lire('decalerJour_("2026-03-01", -1)'), '2026-02-28');
});

/* ============================ B. Rapport nominal ============================ */

console.log('B. Rapport nominal');

const nominal = charger();
nominal.sandbox.genererRapport();
const S = nominal.synthese();

cas('le rapport se termine en une exécution, sans déclencheur ni état résiduels', () => {
  assert.strictEqual(nominal.declencheurs.length, 0);
  assert.strictEqual(nominal.lire('lireEtat_()'), null);
});

// Le groupe n'a pas de journal Drive : c'est la seule réserve attendue.
const RESERVE_GROUPE = '⚠️ journal Drive illisible pour 1 compte(s) — détail dans le journal d\'exécution';

cas('bandeau : date d\'arrêt lisible, version, et seule la réserve du groupe', () => {
  assert.ok(S.bandeau.includes('Compteurs arrêtés au'), S.bandeau);
  assert.ok(S.bandeau.includes(`version ${nominal.lire('METRIQUE_VERSION')}`));
  assert.strictEqual(S.reserves, RESERVE_GROUPE);
});

cas('sans compte illisible, le bandeau dit que tout a été chargé', () => {
  const t = charger({ comptes: [ACCUEIL, RH] });
  t.sandbox.genererRapport();
  assert.ok(t.synthese().reserves.startsWith('✅'), t.synthese().reserves);
});

cas('cumuls 7 j et 30 j exacts, casse des adresses ignorée', () => {
  const a = S.lignes.get(ACCUEIL);
  assert.strictEqual(a['Mails reçus 7 j'], attendu(ACCUEIL, 'recus', 7));
  assert.strictEqual(a['Mails envoyés 30 j'], attendu(ACCUEIL, 'envoyes', 30));
  assert.strictEqual(a['Fichiers consultés 30 j'], attendu(ACCUEIL, 'consultes', 30));
  assert.strictEqual(S.lignes.get(RH)['Mails reçus 30 j'], attendu(RH, 'recus', 30));
  assert.strictEqual(a['Quota Gmail (Mo)'], 1234);
});

cas('Défaut v0.1 : un groupe en tête de liste ne fait plus échouer tout le rapport', () => {
  assert.ok(S.lignes.get(GROUPE)['Statut global'].startsWith('❔'));
});

cas('les dates sont des jours (Date à minuit), jamais des heures présumées', () => {
  memeJour(S.lignes.get(ACCUEIL)['Dernière connexion'], PUBLIE);
  memeJour(S.lignes.get(ACCUEIL)['Dernière activité Drive'], decaler(AUJOURDHUI, -2));
  assert.strictEqual(S.lignes.get(ACCUEIL)['Dernière activité'].getHours(), 0);
});

cas('1970 = jamais : ni date, ni statut inventé', () => {
  const rh = S.lignes.get(RH);
  assert.strictEqual(rh['Dernière action Gmail'], '');
  assert.ok(rh['Statut Gmail'].startsWith('⚫'));
  assert.ok(S.lignes.get(COMPTA)['Statut global'].startsWith('🔴'), S.lignes.get(COMPTA)['Statut global']);
});

cas('chaque en-tête porte une note qui dit d\'où vient le chiffre', () => {
  const notes = nominal.feuille('Synthèse').notes[0];
  assert.strictEqual(notes.length, S.entetes.length);
  notes.forEach((n, i) => assert.ok(n.length > 20, S.entetes[i]));
});

cas('le journal Drive est complet et trié du plus récent au plus ancien', () => {
  const lignes = nominal.feuille('Détail Drive').valeurs().slice(1);
  assert.strictEqual(lignes.length, 12 + 2500);
  for (let i = 1; i < lignes.length; i += 1) assert.ok(lignes[i - 1][1] >= lignes[i][1]);
});

cas('Défaut v0.2.0 : un titre de fichier reste du texte, jamais une formule ni une date', () => {
  const titres = nominal.feuille('Détail Drive').valeurs().map((l) => l[3]);
  assert.ok(titres.includes(TITRE_FORMULE), 'le titre piégé doit revenir tel quel');
  assert.ok(titres.includes('2026-09-01'), 'un titre en forme de date ne doit pas devenir une Date');
  assert.ok(!titres.some((t) => String(t).startsWith('#FORMULE')));
});

cas('l\'onglet Paramètres est posé avec ses explications', () => {
  const v = nominal.feuille('Paramètres').valeurs();
  assert.strictEqual(v.length, 10);
  v.slice(1).forEach(([cle, , explication]) => assert.ok(explication.length > 20, cle));
});

/* ============================ C. Honnêteté des chiffres ============================ */

console.log('C. Honnêteté des chiffres');

cas('Défaut v0.1 : un jour en panne est dit, et exclu des cumuls — pas compté à zéro en silence', () => {
  const jour = decaler(PUBLIE, -3);
  const t = charger({ reports: nouveauxReports({ pannes: { [jour]: { restantes: 99, message: 'Backend Error' } } }) });
  t.sandbox.genererRapport();
  const s = t.synthese();
  assert.ok(s.reserves.includes('1 jour(s) non chargé(s)') && s.reserves.includes(jour), s.reserves);
  assert.strictEqual(s.lignes.get(ACCUEIL)['Mails reçus 30 j'], attendu(ACCUEIL, 'recus', 30, [jour]));
});

cas('Défaut v0.1 : une page en panne ne laisse pas un jour à moitié lu', () => {
  // Page 2 en panne : en v0.1, l'accueil (page 1) était compté et les RH
  // (page 3) déclarés absents ce jour-là, sans un mot.
  const jour = decaler(PUBLIE, -1);
  const t = charger({ reports: nouveauxReports({ pannes: { [`${jour}@1000`]: { restantes: 99, message: 'Backend Error' } } }) });
  t.sandbox.genererRapport();
  const s = t.synthese();
  assert.ok(s.reserves.includes(jour), s.reserves);
  assert.strictEqual(s.lignes.get(ACCUEIL)['Mails reçus 7 j'], attendu(ACCUEIL, 'recus', 7, [jour]));
  assert.strictEqual(s.lignes.get(RH)['Mails reçus 7 j'], attendu(RH, 'recus', 7, [jour]));
});

cas('Défaut v0.1 : un paramètre refusé laisse ses colonnes vides, pas à 0', () => {
  const t = charger({ reports: nouveauxReports({ parametresRefuses: ['drive:num_items_viewed'] }) });
  t.sandbox.genererRapport();
  const s = t.synthese();
  assert.strictEqual(s.lignes.get(ACCUEIL)['Fichiers consultés 7 j'], '');
  assert.strictEqual(s.lignes.get(ACCUEIL)['Fichiers créés 7 j'], attendu(ACCUEIL, 'crees', 7));
  assert.ok(s.reserves.includes('drive:num_items_viewed'), s.reserves);
});

cas('une panne passagère est rejouée, sans réserve au bandeau', () => {
  const jour = decaler(PUBLIE, -5);
  const t = charger({ reports: nouveauxReports({ pannes: { [jour]: { restantes: 1, message: 'Rate Limit Exceeded' } } }) });
  t.sandbox.genererRapport();
  assert.strictEqual(t.synthese().reserves, RESERVE_GROUPE);
});

/* ============================ D. Plafond des six minutes ============================ */

console.log('D. Plafond des six minutes');

cas('Défaut v0.1 : un rapport trop long se découpe en reprises et rend le même résultat', () => {
  const t = charger({ msParAppel: 20000 });
  t.sandbox.genererRapport();
  assert.strictEqual(t.declencheurs.length, 1, 'une reprise doit être programmée');
  assert.ok(t.lire('lireEtat_()'), 'l\'état doit être écrit');
  const tours = t.reprendreJusquAuBout();
  assert.ok(tours >= 3, `seulement ${tours} reprise(s)`);
  assert.strictEqual(t.declencheurs.length, 0);
  assert.strictEqual(t.lire('lireEtat_()'), null);
  const s = t.synthese();
  assert.strictEqual(s.reserves, RESERVE_GROUPE);
  S.lignes.forEach((attendue, compte) => {
    Object.entries(attendue).forEach(([colonne, valeur]) => {
      const obtenu = s.lignes.get(compte)[colonne];
      if (valeur && valeur.getTime) assert.strictEqual(obtenu.getTime(), valeur.getTime(), `${compte} ${colonne}`);
      else assert.strictEqual(obtenu, valeur, `${compte} ${colonne}`);
    });
  });
  assert.strictEqual(t.feuille('Détail Drive').valeurs().length - 1, 12 + 2500, 'journal Drive sans doublon ni trou');
});

cas('le journal Drive d\'un compte reprend à la page exacte', () => {
  const t = charger();
  t.lire('preparerDetailDrive_(SpreadsheetApp.getActive())');
  const etat = { phase: 'drive', indexDrive: 0, jetonDrive: null, debutDrive: decaler(AUJOURDHUI, -7),
    drivesEchec: [], drivesEchecTotal: 0, drivesTronques: 0, jours: [], joursTraites: 0 };
  let n = 0;
  const avancer = t.lire('avancerDrive_');
  const classeur = t.classeur;
  assert.strictEqual(avancer(classeur, etat, [RH], { permet: () => (n += 1) <= 2 }), false);
  assert.ok(etat.jetonDrive, 'le jeton de page doit être gardé');
  assert.strictEqual(etat.indexDrive, 0);
  assert.strictEqual(avancer(classeur, etat, [RH], { permet: () => true }), true);
  assert.strictEqual(t.feuille('Détail Drive').valeurs().length - 1, 2500);
});

cas('verrou pris : la reprise se reprogramme au lieu de travailler à deux', () => {
  const t = charger({ msParAppel: 20000 });
  t.sandbox.genererRapport();
  const avant = t.lire('lireEtat_()').joursTraites;
  t.verrou.bloque = true;
  t.sandbox.reprendreRapport();
  assert.strictEqual(t.declencheurs.length, 1);
  assert.strictEqual(t.lire('lireEtat_()').joursTraites, avant);
  t.verrou.bloque = false;
  t.reprendreJusquAuBout();
  assert.strictEqual(t.synthese().reserves, RESERVE_GROUPE);
});

cas('un second clic pendant un rapport en cours ne relance rien', () => {
  const t = charger({ msParAppel: 20000 });
  t.sandbox.genererRapport();
  const avant = JSON.stringify(t.lire('lireEtat_()'));
  t.sandbox.genererRapport();
  assert.strictEqual(JSON.stringify(t.lire('lireEtat_()')).replace(/"majLe":"[^"]+"/, ''),
    avant.replace(/"majLe":"[^"]+"/, ''));
  assert.ok(t.toasts.some((m) => m.includes('déjà en cours')));
});

cas('un rapport orphelin (exécution tuée) est repris au clic suivant', () => {
  const t = charger({ msParAppel: 20000 });
  t.sandbox.genererRapport();
  t.lire('SocleExecution.retirerReprise("reprendreRapport")');
  const etat = t.lire('lireEtat_()');
  etat.majLe = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  t.proprietes.set('METRIQUE_ETAT', JSON.stringify(etat));
  t.sandbox.genererRapport();
  t.reprendreJusquAuBout();
  assert.strictEqual(t.lire('lireEtat_()'), null);
  assert.strictEqual(t.synthese().reserves, RESERVE_GROUPE);
});

cas('un échec en arrière-plan s\'affiche en tête de la synthèse et nettoie tout', () => {
  const t = charger({ msParAppel: 20000 });
  t.sandbox.genererRapport();
  t.ecrireComptes([ACCUEIL]);
  assert.throws(() => t.sandbox.reprendreRapport(), /a changé pendant la génération/);
  assert.ok(String(t.feuille('Synthèse').valeurs()[0][0]).startsWith('❌'));
  assert.strictEqual(t.lire('lireEtat_()'), null);
  assert.strictEqual(t.declencheurs.length, 0);
});

cas('Défaut v0.3.1 : le bandeau d\'échec est en français, quelle que soit la langue de qui a lancé', () => {
  const t = charger({ msParAppel: 20000, locale: 'en' });
  t.sandbox.genererRapport();
  t.ecrireComptes([ACCUEIL]);
  // L'administrateur, lui, reçoit l'erreur dans sa langue (notification Google).
  assert.throws(() => t.sandbox.reprendreRapport(), /changed during generation/);
  const bandeau = String(t.feuille('Synthèse').valeurs()[0][0]);
  assert.match(bandeau, /^❌ Le rapport du .* a échoué : La liste de l'onglet « Comptes » a changé/);
  assert.ok(!/changed|sheet/.test(bandeau), bandeau);
});

cas('un défaut imprévu en arrière-plan se dit imprévu dans le bandeau', () => {
  const t = charger({ msParAppel: 20000, locale: 'en' });
  t.sandbox.genererRapport();
  t.sandbox.SpreadsheetApp.getActive = ((vrai) => {
    let appels = 0;
    // Premier appel (poursuivreRapport_) : null ; ensuite le vrai classeur,
    // pour que le bandeau puisse s'écrire.
    return () => { appels += 1; return appels === 1 ? null : vrai(); };
  })(t.sandbox.SpreadsheetApp.getActive);
  assert.throws(() => t.sandbox.reprendreRapport(), /Cannot read properties of null/);
  const bandeau = String(t.feuille('Synthèse').valeurs()[0][0]);
  assert.match(bandeau, /a échoué sur une erreur imprévue \(Cannot read properties of null/);
});

cas('Défaut v0.2.0 : l\'état tient sous 9 Ko quand 179 jours sur 180 échouent', () => {
  const pannes = {};
  for (let i = 1; i < 180; i += 1) {
    pannes[decaler(PUBLIE, -i)] = { restantes: 999, message: `Erreur définitive n°${i}, très bavarde ${'x'.repeat(300)}` };
  }
  const t = charger({ reports: nouveauxReports({ pannes }) });
  t.lire('lireParametres_(SpreadsheetApp.getActive())');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Jours d\'historique'), 2).setValue(180);
  t.sandbox.genererRapport();
  assert.deepStrictEqual(t.alertes, []);
  assert.ok(t.synthese().reserves.includes('179 jour(s) non chargé(s)'), t.synthese().reserves);
});

cas('l\'état tient sous 9 Ko même avec quarante journaux Drive illisibles', () => {
  const inconnus = Array.from({ length: 40 }, (_, i) => `ancien-compte-au-nom-tres-long-${i}@exemple.fr`);
  const t = charger({ comptes: [...COMPTES, ...inconnus] });
  t.sandbox.genererRapport();
  assert.ok(t.synthese().reserves.includes('journal Drive illisible pour 41 compte(s)'), t.synthese().reserves);
});

/* ============================ E. Cache ============================ */

console.log('E. Cache');

const pagesChargees = (t) => Object.values(t.compteurs.usageParJour).reduce((a, b) => a + b, 0);

cas('un second rapport ne redemande aucun jour déjà publié', () => {
  const t = charger();
  t.sandbox.genererRapport();
  assert.strictEqual(pagesChargees(t), 30 * 3);
  t.compteurs.usageParJour = {};
  t.sandbox.genererRapport();
  assert.strictEqual(pagesChargees(t), 0);
  assert.strictEqual(t.synthese().lignes.get(ACCUEIL)['Mails reçus 30 j'], attendu(ACCUEIL, 'recus', 30));
});

cas('un jour publié le lendemain ne coûte qu\'un jour', () => {
  const t = charger();
  t.sandbox.genererRapport();
  t.compteurs.usageParJour = {};
  t.reports.publieJusquA = decaler(PUBLIE, 1);
  t.sandbox.genererRapport();
  assert.deepStrictEqual(Object.keys(t.compteurs.usageParJour), [decaler(PUBLIE, 1)]);
  assert.strictEqual(t.compteurs.usageParJour[decaler(PUBLIE, 1)], 3);
});

cas('un compte ajouté vide le cache : il ne serait présent dans aucun jour gardé', () => {
  const t = charger();
  t.sandbox.genererRapport();
  t.ecrireComptes([...COMPTES, 'agent7@exemple.fr']);
  t.compteurs.usageParJour = {};
  t.sandbox.genererRapport();
  assert.strictEqual(pagesChargees(t), 30 * 3);
  assert.ok(!t.synthese().lignes.get('agent7@exemple.fr')['Statut global'].startsWith('❔'));
});

cas('un jour partiel selon Google est utilisé, dit, et redemandé la fois suivante', () => {
  const t = charger({ reports: nouveauxReports({ avertissements: { [PUBLIE]: ['PARTIAL_DATA_AVAILABLE'] } }) });
  t.sandbox.genererRapport();
  assert.ok(t.synthese().reserves.includes('partiel'), t.synthese().reserves);
  t.compteurs.usageParJour = {};
  t.sandbox.genererRapport();
  assert.deepStrictEqual(Object.keys(t.compteurs.usageParJour), [PUBLIE]);
});

cas('le cache relu dédoublonne une paire (jour, compte) écrite deux fois', () => {
  const t = charger();
  const c = t.classeur;
  t.lire('ongletCache_')(c);
  t.lire('ecrireJourEnCache_')(c, PUBLIE, new Map([[ACCUEIL, { a: 1 }]]), false);
  t.lire('ecrireJourEnCache_')(c, PUBLIE, new Map([[ACCUEIL, { a: 2 }]]), true);
  const { complets, valeurs } = t.lire('lireCache_')(c);
  assert.ok(complets.has(PUBLIE), 'la colonne Jour revient en Date et doit être normalisée');
  assert.strictEqual(valeurs.get(PUBLIE).size, 1);
  assert.strictEqual(valeurs.get(PUBLIE).get(ACCUEIL).a, 2);
});

/* ============================ F. Paramètres ============================ */

console.log('F. Paramètres');

cas('une valeur saisie n\'est jamais réécrite, et la fenêtre suit le réglage', () => {
  const t = charger();
  t.sandbox.genererRapport();
  const p = t.feuille('Paramètres');
  p.getRange(ligneReglage(t, 'Jours d\'historique'), 2).setValue(14);
  t.sandbox.genererRapport();
  assert.strictEqual(p.getRange(ligneReglage(t, 'Jours d\'historique'), 2).getValues()[0][0], 14);
  const s = t.synthese();
  assert.ok(s.entetes.includes('Mails reçus 14 j'), s.entetes.join());
  assert.strictEqual(s.lignes.get(ACCUEIL)['Mails reçus 14 j'], attendu(ACCUEIL, 'recus', 14));
});

/** Dernier message montré à l'utilisateur, et vérification qu'il n'a rien d'imprévu. */
const derniereAlerte = (t) => {
  assert.strictEqual(t.alertes.length, 1, JSON.stringify(t.alertes));
  return t.alertes[0].message;
};

cas('une valeur invalide s\'affiche avec ce qu\'il faut saisir, sans laisser d\'état', () => {
  const t = charger();
  t.lire('lireParametres_(SpreadsheetApp.getActive())');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Jours d\'historique'), 2).setValue('trente');
  t.sandbox.genererRapport();
  assert.match(derniereAlerte(t), /Le réglage « Jours d'historique » vaut « trente ».* Saisissez un nombre entier entre 7 et 180/);
  assert.strictEqual(t.lire('lireEtat_()'), null);
});

cas('des seuils non croissants sont refusés', () => {
  const t = charger();
  t.lire('lireParametres_(SpreadsheetApp.getActive())');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Seuil « actif » (jours)'), 2).setValue(60);
  t.sandbox.genererRapport();
  assert.match(derniereAlerte(t), /croissants/);
});

cas('liste de comptes vide : message qui dit quoi faire', () => {
  const t = charger({ comptes: [] });
  t.sandbox.genererRapport();
  assert.match(derniereAlerte(t), /Saisissez une adresse par ligne/);
});

cas('service avancé non activé : le message le nomme', () => {
  const t = charger();
  delete t.sandbox.AdminReports;
  t.sandbox.genererRapport();
  assert.match(derniereAlerte(t), /service avancé « Admin SDK Reports »/);
});

cas('un défaut imprévu se dit imprévu, et ne se déguise pas en conseil', () => {
  const t = charger();
  // Google rend null sans lever quand le contexte ne s'y prête pas.
  t.sandbox.SpreadsheetApp.getActive = () => null;
  t.sandbox.diagnostiquer();
  assert.match(derniereAlerte(t), /Erreur imprévue — ce n'est pas votre saisie/);
});

cas('diagnostiquer ne plante pas sur un groupe', () => {
  charger().sandbox.diagnostiquer();
});

/* ============================ G. Interface MD3 et bilinguisme ============================ */

console.log('G. Interface MD3 et bilinguisme');

const sourceUi = sourceMetrique;

cas('« À propos » : auteur, site et version courante', () => {
  const t = charger();
  t.sandbox.aPropos();
  const { html, message } = t.modales[t.modales.length - 1];
  assert.ok(message.includes('Fabrice Faucheux'));
  assert.ok(html.includes('href="https://faucheux.bzh"'));
  assert.ok(message.includes(`Version ${t.lire('METRIQUE_VERSION')}`));
});

cas('les tables fr et en ont les mêmes clés, et les mêmes pluriels', () => {
  const t = charger();
  t.lire('t_("menuTitre")');
  const verification = t.lire('SocleLangues.verifier()');
  assert.ok(verification.completes, JSON.stringify(verification));
});

cas('chaque clé appelée dans le code existe dans la table', () => {
  const t = charger();
  const table = t.lire('METRIQUE_CHAINES.fr');
  const appelees = new Set([
    ...[...sourceUi.matchAll(/\bt_\('(\w+)'/g)].map((m) => m[1]),
    ...[...sourceUi.matchAll(/erreurUtilisateur_\('(\w+)'/g)].map((m) => m[1]),
    ...[...sourceUi.matchAll(/\bcle: '(diag\w+)'/g)].map((m) => m[1]),
  ]);
  assert.ok(appelees.size > 40, `seulement ${appelees.size} clés trouvées`);
  appelees.forEach((cle) => assert.ok(cle in table, `clé absente : ${cle}`));
});

cas('Défaut v0.3.0 : en anglais, « À propos » ne contient plus de français en dur', () => {
  const t = charger({ locale: 'en_US' });
  t.sandbox.aPropos();
  const { message } = t.modales[t.modales.length - 1];
  assert.ok(message.includes('Usage metrics for Google Workspace'));
  assert.ok(!/Rapports d'usage|Comptes analysés|Fermer/.test(message), message);
});

cas('Défaut v0.3.0 : en anglais, les erreurs sont en anglais', () => {
  const t = charger({ locale: 'en', comptes: [] });
  t.sandbox.genererRapport();
  assert.match(derniereAlerte(t), /No valid address in the « Comptes » sheet/);
});

cas('Défaut v0.3.0 : en anglais, un compte en erreur reste classé « Error »', () => {
  // Le classement se faisait sur le début du message français (« ERREUR ») :
  // traduit, il aurait fait passer chaque erreur pour une absence.
  const t = charger({ locale: 'en' });
  t.sandbox.diagnostiquer();
  const { html } = t.modales[t.modales.length - 1];
  const ligneGroupe = html.split('md-list-item"').find((l) => l.includes(GROUPE));
  assert.ok(ligneGroupe.includes('md-badge-error'), ligneGroupe);
  assert.strictEqual(html.split('md-badge md-badge-success').length - 1, 3, 'trois comptes OK attendus');
});

cas('le diagnostic s\'arrête avant le plafond et dit ce qu\'il n\'a pas vérifié', () => {
  // 90 s par appel sur un budget de 4 min : trois comptes vérifiés, le quatrième non.
  const t = charger({ msParAppel: 90000 });
  t.sandbox.diagnostiquer();
  const { html, message } = t.modales[t.modales.length - 1];
  assert.ok(html.includes('md-badge md-badge-primary'), 'des comptes « Non vérifié » attendus');
  assert.ok(message.includes('Non vérifié : le temps d\'exécution était épuisé'), message);
});

cas('une adresse hostile est échappée dans la modale du diagnostic', () => {
  const hostile = '"><img src=x onerror=alert(1)>@exemple.fr';
  const t = charger();
  // L'adresse ne passerait pas le filtre des comptes : on l'injecte directement.
  t.lire('afficherDiagnosticMd3_')(PUBLIE, [{ compte: hostile, type: 'erreur', message: '<b>x</b>' }]);
  const { html } = t.modales[t.modales.length - 1];
  assert.ok(!html.includes('<img'), 'balise injectée');
  assert.ok(!html.includes('<b>x</b>'), 'message non échappé');
});

cas('Défaut v0.3.0 : aucun objet de service ne reçoit de propriété ajoutée', () => {
  assert.ok(!/texteBrut/.test(sourceUi));
  const t = charger();
  assert.throws(() => t.lire('HtmlService.createHtmlOutput("x").texteBrut = "y"'), /Cannot add property/);
});

cas('ni t_ ni échappement réécrits : ils viennent du socle', () => {
  assert.ok(!/echapperHtml_\s*=/.test(sourceUi));
  assert.ok(!/const I18N\b/.test(sourceUi));
  assert.ok(fichiers.includes('SocleLangues.gs') && fichiers.includes('SocleTexte.gs'));
});

cas('la langue n\'est lue qu\'une fois par exécution', () => {
  const t = charger();
  let lectures = 0;
  const vraie = t.sandbox.Session.getActiveUserLocale;
  t.sandbox.Session.getActiveUserLocale = () => { lectures += 1; return vraie(); };
  t.sandbox.aPropos();
  t.sandbox.diagnostiquer();
  assert.strictEqual(lectures, 1);
});

/* ============================ H. Rapport programmé ============================ */

console.log('H. Rapport programmé');

const hebdomadaires = (t) => t.declencheurs.filter((d) => d.getHandlerFunction() === 'rapportProgramme');

cas('programmer pose un seul déclencheur, au jour et à l\'heure des Paramètres', () => {
  const t = charger();
  t.lire('lireParametres_(SpreadsheetApp.getActive())');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Jour du rapport programmé'), 2).setValue('Jeudi');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Heure du rapport programmé'), 2).setValue(0);
  t.sandbox.programmerRapport();
  t.sandbox.programmerRapport();
  const poses = hebdomadaires(t);
  assert.strictEqual(poses.length, 1, 'reprogrammer ne doit pas doubler le déclencheur');
  assert.strictEqual(poses[0].jour, 'THURSDAY');
  assert.strictEqual(poses[0].heure, 0, 'minuit est une heure valide');
  assert.strictEqual(JSON.parse(t.proprietes.get('METRIQUE_PROGRAMMATION')).par, 'admin@exemple.fr');
});

cas('la confirmation nomme l\'identité et le risque des éditeurs', () => {
  const t = charger();
  t.sandbox.programmerRapport();
  const { message } = t.alertes[0];
  assert.match(message, /admin@exemple\.fr/);
  assert.match(message, /Toute personne qui peut modifier ce classeur peut aussi modifier son script/);
});

cas('annuler la confirmation ne programme rien', () => {
  const t = charger({ reponseAlerte: 'CANCEL' });
  t.sandbox.programmerRapport();
  assert.strictEqual(hebdomadaires(t).length, 0);
  assert.strictEqual(t.proprietes.has('METRIQUE_PROGRAMMATION'), false);
});

cas('un second administrateur ne peut pas doubler la programmation', () => {
  const t = charger();
  t.proprietes.set('METRIQUE_PROGRAMMATION', JSON.stringify({ par: 'autre@exemple.fr', le: '2026-09-01T08:00:00Z' }));
  t.sandbox.programmerRapport();
  assert.strictEqual(hebdomadaires(t).length, 0);
  assert.match(derniereAlerte(t), /déjà programmé par autre@exemple\.fr/);
});

cas('arrêter retire le déclencheur ; un autre compte est renvoyé vers son auteur', () => {
  const t = charger();
  t.sandbox.programmerRapport();
  t.sandbox.arreterRapportProgramme();
  assert.strictEqual(hebdomadaires(t).length, 0);
  assert.strictEqual(t.proprietes.has('METRIQUE_PROGRAMMATION'), false);

  const u = charger();
  u.proprietes.set('METRIQUE_PROGRAMMATION', JSON.stringify({ par: 'autre@exemple.fr', le: '2026-09-01T08:00:00Z' }));
  u.sandbox.arreterRapportProgramme();
  assert.match(derniereAlerte(u), /seul ce compte peut l'arrêter/);
  assert.ok(u.proprietes.has('METRIQUE_PROGRAMMATION'), 'la mention d\'un autre ne s\'efface pas');
});

cas('un jour invalide est refusé avec la liste des choix', () => {
  const t = charger();
  t.lire('lireParametres_(SpreadsheetApp.getActive())');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Jour du rapport programmé'), 2).setValue('lundy');
  t.sandbox.programmerRapport();
  assert.match(derniereAlerte(t), /Choisissez parmi : lundi, mardi/);
  assert.strictEqual(hebdomadaires(t).length, 0);
});

cas('le déclencheur produit un rapport complet, sans interface', () => {
  const t = charger({ sansUi: true });
  t.sandbox.rapportProgramme();
  assert.strictEqual(t.synthese().reserves, RESERVE_GROUPE);
  assert.strictEqual(t.lire('lireEtat_()'), null);
});

cas('le déclencheur ne relance pas un rapport déjà en cours', () => {
  const t = charger({ msParAppel: 20000 });
  t.sandbox.genererRapport();
  const avant = t.lire('lireEtat_()').debut;
  t.sandbox.rapportProgramme();
  assert.strictEqual(t.lire('lireEtat_()').debut, avant);
});

cas('un échec du rapport programmé s\'écrit en tête de la synthèse', () => {
  const t = charger({ comptes: [], sansUi: true });
  assert.throws(() => t.sandbox.rapportProgramme(), /Aucune adresse valide/);
  assert.match(String(t.feuille('Synthèse').valeurs()[0][0]), /^❌ .* a échoué : Aucune adresse valide/);
});

cas('le déclencheur hebdomadaire survit à la fin d\'un rapport et à ses reprises', () => {
  const t = charger({ msParAppel: 20000 });
  t.sandbox.programmerRapport();
  t.sandbox.rapportProgramme();
  t.reprendreJusquAuBout();
  assert.strictEqual(hebdomadaires(t).length, 1);
});

cas('portée userinfo.email déclarée, justifiée au README', () => {
  const manifeste = JSON.parse(fs.readFileSync(path.join(SOURCES, 'appsscript.json'), 'utf8'));
  assert.ok(manifeste.oauthScopes.includes('https://www.googleapis.com/auth/userinfo.email'));
  assert.ok(fs.readFileSync(path.join(RACINE, 'README.md'), 'utf8').includes('userinfo.email'));
});

/* ============================ I. Langue de l'interface ============================ */

console.log('I. Langue de l\'interface');

cas('Défaut v0.4.0 : le réglage « français » l\'emporte sur une langue de compte mal détectée', () => {
  const t = charger({ locale: 'en' });
  t.lire('lireParametres_(SpreadsheetApp.getActive())');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Langue de l\'interface'), 2).setValue('Français');
  t.sandbox.onOpen();
  assert.strictEqual(t.menus[0].titre, 'Rapport d\'activité');
  assert.strictEqual(t.menus[0].entrees[0].libelle, 'Générer le rapport');
});

cas('le réglage « anglais » force l\'anglais sur un compte français', () => {
  const t = charger({ locale: 'fr' });
  t.lire('lireParametres_(SpreadsheetApp.getActive())');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Langue de l\'interface'), 2).setValue('anglais');
  t.sandbox.onOpen();
  assert.strictEqual(t.menus[0].titre, 'Activity report');
});

cas('« automatique » suit le compte ; un compte sans langue donne le français', () => {
  const t = charger({ locale: 'en_GB' });
  t.sandbox.onOpen();
  assert.strictEqual(t.menus[0].titre, 'Activity report');
  const u = charger({ locale: '' });
  u.sandbox.onOpen();
  assert.strictEqual(u.menus[0].titre, 'Rapport d\'activité');
});

cas('onOpen ne crée ni onglet ni ligne, et ne casse pas sur un réglage invalide', () => {
  const t = charger({ locale: 'en' });
  t.sandbox.onOpen();
  assert.strictEqual(t.feuille('Paramètres'), null, 'onOpen ne doit rien écrire');
  const u = charger({ locale: 'en' });
  u.lire('lireParametres_(SpreadsheetApp.getActive())');
  u.feuille('Paramètres').getRange(ligneReglage(u, 'Langue de l\'interface'), 2).setValue('klingon');
  u.sandbox.onOpen();
  assert.strictEqual(u.menus[0].titre, 'Activity report', 'réglage invalide : retour à l\'automatique');
});

cas('« À propos » dit ce que Google a répondu, et d\'où vient la langue', () => {
  const t = charger({ locale: 'en_US' });
  t.lire('lireParametres_(SpreadsheetApp.getActive())');
  t.feuille('Paramètres').getRange(ligneReglage(t, 'Langue de l\'interface'), 2).setValue('français');
  t.sandbox.aPropos();
  const { message } = t.modales[t.modales.length - 1];
  assert.match(message, /« en_US »/);
  assert.match(message, /réglage « Langue de l'interface »/);
});

/* ============================ J. Installation ============================ */

console.log('J. Installation');

const noms = (t) => t.classeur.getSheets().map((f) => f.getName());

cas('l\'installation retire la « Feuille 1 » vide de Google', () => {
  const t = charger({ sansComptes: true });
  t.sandbox.genererRapport();
  assert.ok(!noms(t).includes('Feuille 1'), noms(t).join());
  assert.ok(noms(t).includes('Comptes') && noms(t).includes('Paramètres'));
});

cas('et la « Sheet1 » d\'un compte en anglais', () => {
  const t = charger({ sansComptes: true, premiereFeuille: 'Sheet1', locale: 'en' });
  t.sandbox.genererRapport();
  assert.ok(!noms(t).includes('Sheet1'), noms(t).join());
});

cas('et la « Feuil1 » d\'un classeur Excel importé', () => {
  const t = charger({ sansComptes: true, premiereFeuille: 'Feuil1' });
  t.sandbox.diagnostiquer();
  assert.ok(!noms(t).includes('Feuil1'), noms(t).join());
});

cas('une première feuille où quelqu\'un a écrit est gardée', () => {
  const t = charger({ sansComptes: true });
  t.feuille('Feuille 1').getRange(1, 1).setValue('mes notes');
  t.sandbox.genererRapport();
  assert.ok(noms(t).includes('Feuille 1'));
});

cas('hors installation, rien n\'est retiré', () => {
  const t = charger();
  t.sandbox.genererRapport();
  assert.ok(noms(t).includes('Feuille 1'), 'l\'onglet Comptes existait : ce n\'est pas une installation');
});

/* ------------------------------ Conclusion ------------------------------ */

console.log(`\n${reussis} réussi(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
