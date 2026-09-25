/**
 * Banc d'essai — simulateurs des services Google.
 *
 * **Un faux service complaisant valide du code faux.** D'où :
 *
 *   - le faux classeur rend des objets `Date` là où l'on a écrit une chaîne
 *     `yyyy-MM-dd` — y compris dans une colonne au format texte, ce qui est
 *     plus sévère que Sheets et oblige à normaliser à la lecture ;
 *   - les `Date` sont fabriquées avec le constructeur **du bac à sable** : une
 *     `Date` de Node n'y serait pas `instanceof Date`, et le banc échouerait
 *     pour une raison qui n'existe pas en production ;
 *   - le faux Reports refuse une date non publiée, un paramètre inconnu et un
 *     `maxResults` hors bornes avec les messages du vrai ;
 *   - le faux PropertiesService refuse une valeur de plus de 9 Ko ;
 *   - `formatDate` suit réellement le fuseau demandé.
 */

'use strict';

const crypto = require('crypto');

const EST_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const TAILLE_MAX_PROPRIETE = 9 * 1024;

/** Texte visible d'une page : sans styles, scripts ni balises, entités décodées. */
const texteVisible = (html) => String(html)
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const JOURS_SEMAINE = Object.freeze(Object.fromEntries(
  ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    .map((nom) => [nom, Object.freeze({ nom })])));

const installerFauxGoogle = (sandbox, DateContexte, options = {}) => {
  const horloge = { decalage: 0 };
  const compteurs = { usage: 0, activites: 0, usageParJour: {} };
  const declencheurs = [];
  // Qui exécute. Les déclencheurs appartiennent à leur auteur : Google ne rend
  // à chacun que les siens, et un faux qui les rendrait tous validerait une
  // logique de propriété qui ne fonctionne pas en production.
  const courant = { email: options.utilisateur ?? 'admin@exemple.fr' };
  const proprietes = new Map();
  const feuilles = [];
  const toasts = [];
  const verrou = { pris: false, bloque: false };
  const pannes = { setPropertyRestantes: 0 };

  const alertes = [];
  const modales = [];
  const menus = [];
  const ui = {
    createMenu: (titre) => {
      if (typeof titre !== 'string' || titre === '') throw new Error('Invalid argument: caption');
      const menu = { titre, entrees: [] };
      const constructeur = {
        addItem: (libelle, fonction) => { menu.entrees.push({ libelle, fonction }); return constructeur; },
        addSeparator: () => constructeur,
        addToUi: () => { menus.push(menu); },
      };
      return constructeur;
    },
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL' },
    Button: { OK: 'OK', CANCEL: 'CANCEL' },
    alert: (titre, message) => {
      alertes.push({ titre, message });
      return options.reponseAlerte || 'OK';
    },
    showModalDialog: (output, titre) => {
      if (!output || typeof output.getContent !== 'function') {
        throw new Error('Exception: Invalid argument: userInterface');
      }
      const html = output.getContent();
      // Ce que la personne lit, et rien d'autre : le banc ne doit pas pouvoir
      // valider un message qui ne serait pas dans la page.
      const message = texteVisible(html);
      alertes.push({ titre, message });
      modales.push({ titre, message, html });
      return undefined;
    },
  };

  const avancer = () => { horloge.decalage += options.msParAppel || 0; };

  /**
   * Reproduit l'interprétation que Sheets fait d'une chaîne écrite par
   * `setValues` : l'apostrophe initiale force le texte et disparaît à la
   * lecture ; une chaîne qui commence par = + - @ devient une formule (ou
   * `#ERROR!`). Le faux la rend sous une forme qui ne peut égaler le texte.
   */
  const commeSheets = (valeur) => {
    if (typeof valeur === 'string' && valeur.startsWith("'")) return valeur.slice(1);
    if (typeof valeur === 'string' && /^[=+\-@]/.test(valeur) && Number.isNaN(Number(valeur))) {
      return `#FORMULE(${valeur})`;
    }
    if (typeof valeur === 'string' && EST_JOUR.test(valeur)) {
      const [a, m, j] = valeur.split('-').map(Number);
      return new DateContexte(a, m - 1, j);
    }
    if (Object.prototype.toString.call(valeur) === '[object Date]') return new DateContexte(valeur.getTime());
    return valeur;
  };

  /* ------------------------------ Classeur ------------------------------ */

  class FaussePlage {
    constructor(feuille, ligne, colonne, hauteur, largeur) {
      if (hauteur < 1) throw new Error('The number of rows in the range must be at least 1.');
      if (largeur < 1) throw new Error('The number of columns in the range must be at least 1.');
      Object.assign(this, { feuille, ligne, colonne, hauteur, largeur });
    }

    verifierDimensions(valeurs) {
      if (!Array.isArray(valeurs) || valeurs.length !== this.hauteur) {
        throw new Error('The number of rows in the data does not match the number of rows in '
          + `the range. The data has ${valeurs && valeurs.length} but the range has ${this.hauteur}.`);
      }
      valeurs.forEach((cellules) => {
        if (!Array.isArray(cellules) || cellules.length !== this.largeur) {
          throw new Error('The number of columns in the data does not match the number of '
            + `columns in the range. The data has ${cellules && cellules.length} but the range `
            + `has ${this.largeur}.`);
        }
        cellules.forEach((v) => {
          if (v === undefined) throw new Error('Exception: Invalid argument: undefined');
        });
      });
    }

    setValues(valeurs) {
      this.verifierDimensions(valeurs);
      valeurs.forEach((cellules, dl) => {
        const l = this.ligne - 1 + dl;
        while (this.feuille.cellules.length <= l) this.feuille.cellules.push([]);
        cellules.forEach((v, dc) => { this.feuille.cellules[l][this.colonne - 1 + dc] = commeSheets(v); });
      });
      return this;
    }

    setValue(valeur) { return this.setValues([[valeur]]); }

    getValues() {
      this.feuille.cellulesLues += this.hauteur * this.largeur;
      const sortie = [];
      for (let l = 0; l < this.hauteur; l += 1) {
        const source = this.feuille.cellules[this.ligne - 1 + l] || [];
        const ligne = [];
        for (let c = 0; c < this.largeur; c += 1) {
          const v = source[this.colonne - 1 + c];
          ligne.push(v === undefined || v === null ? '' : v);
        }
        sortie.push(ligne);
      }
      return sortie;
    }

    setNotes(notes) {
      this.verifierDimensions(notes);
      this.feuille.notes = notes;
      return this;
    }

    clearContent() {
      for (let l = 0; l < this.hauteur; l += 1) {
        const ligne = this.feuille.cellules[this.ligne - 1 + l];
        if (!ligne) continue;
        for (let c = 0; c < this.largeur; c += 1) ligne[this.colonne - 1 + c] = undefined;
      }
      return this;
    }

    sort({ column, ascending }) {
      const debut = this.ligne - 1;
      const bloc = this.feuille.cellules.slice(debut, debut + this.hauteur);
      bloc.sort((a, b) => {
        const va = a[column - 1];
        const vb = b[column - 1];
        const ecart = (va > vb) - (va < vb);
        return ascending ? ecart : -ecart;
      });
      bloc.forEach((ligne, i) => { this.feuille.cellules[debut + i] = ligne; });
      return this;
    }

    setFontWeight() { return this; }
    setFontStyle() { return this; }
    setBackground() { return this; }
    setNumberFormat(format) { this.feuille.formats.push(format); return this; }
  }

  class FausseFeuille {
    constructor(nom) {
      Object.assign(this, { nom, cellules: [], notes: null, formats: [], masquee: false, cellulesLues: 0 });
    }

    getName() { return this.nom; }

    getLastColumn() {
      return this.cellules.reduce((max, ligne) => Math.max(max, ...(ligne || [])
        .map((v, i) => (v !== undefined && v !== '' ? i + 1 : 0)), 0), 0);
    }

    getLastRow() {
      for (let l = this.cellules.length - 1; l >= 0; l -= 1) {
        if ((this.cellules[l] || []).some((v) => v !== undefined && v !== '')) return l + 1;
      }
      return 0;
    }

    getRange(ligne, colonne, hauteur = 1, largeur = 1) {
      if (typeof ligne === 'string') {
        if (ligne !== 'A:A') throw new Error(`Notation A1 non simulée : ${ligne}`);
        return new FaussePlage(this, 1, 1, 1000, 1);
      }
      return new FaussePlage(this, ligne, colonne, hauteur, largeur);
    }

    clear() { this.cellules = []; this.notes = null; this.formats = []; return this; }
    hideSheet() { this.masquee = true; return this; }
    setFrozenRows() { return this; }
    setFrozenColumns() { return this; }
    autoResizeColumns() { return this; }
    setColumnWidth() { return this; }

    /** Pour les tests : le contenu tel que `getValues` le rendrait. */
    valeurs() {
      const h = this.getLastRow();
      const w = this.cellules.reduce((m, l) => Math.max(m, (l || []).length), 0);
      return h && w ? this.getRange(1, 1, h, w).getValues() : [];
    }
  }

  const classeur = {
    getSheetByName: (nom) => feuilles.find((f) => f.nom === nom) || null,
    insertSheet: (nom) => {
      if (feuilles.some((f) => f.nom === nom)) {
        throw new Error(`A sheet with the name "${nom}" already exists. Please enter another name.`);
      }
      const feuille = new FausseFeuille(nom);
      feuilles.push(feuille);
      return feuille;
    },
    getSheets: () => feuilles.slice(),
    deleteSheet: (feuille) => {
      const i = feuilles.indexOf(feuille);
      if (i === -1) throw new Error('Sheet not found');
      if (feuilles.length === 1) {
        throw new Error('You can\'t remove all the sheets in a document.');
      }
      feuilles.splice(i, 1);
    },
    toast: (message) => { toasts.push(message); },
  };

  /* ------------------------------ Reports ------------------------------ */

  const reports = options.reports;
  const ACCEPTEES_USAGE = new Set(['maxResults', 'pageToken', 'parameters', 'orgUnitID', 'filters', 'customerId']);

  const verifierOptions = (opts, acceptees) => {
    Object.keys(opts || {}).forEach((cle) => {
      if (!acceptees.has(cle)) throw new Error(`Invalid argument: ${cle}`);
    });
    if (opts && opts.maxResults !== undefined && (opts.maxResults < 1 || opts.maxResults > 1000)) {
      throw new Error('Invalid value for: maxResults');
    }
  };

  const UserUsageReport = {
    get: (userKey, date, opts = {}) => {
      avancer();
      compteurs.usage += 1;
      verifierOptions(opts, ACCEPTEES_USAGE);
      if (date > reports.publieJusquA) {
        throw new Error(`API call to reports.userUsageReport.get failed with error: Data for dates `
          + `later than ${reports.publieJusquA} is not yet available. Please check back later`);
      }
      const demandes = opts.parameters ? opts.parameters.split(',') : null;
      (demandes || []).forEach((p) => {
        if (reports.parametresRefuses.includes(p)) {
          const [appli, nom] = p.split(':');
          throw new Error(`API call to reports.userUsageReport.get failed with error: Invalid `
            + `parameter name ${nom} for application ${appli}.`);
        }
      });
      const panne = reports.pannes[date] || reports.pannes[`${date}@${opts.pageToken || 0}`];
      if (panne && panne.restantes > 0) {
        panne.restantes -= 1;
        throw new Error(panne.message);
      }
      // Seules les pages de données comptent ; les sondes à maxResults 1 (date
      // publiée, validation des paramètres) coûtent un appel mais pas une page.
      if (opts.maxResults !== 1) compteurs.usageParJour[date] = (compteurs.usageParJour[date] || 0) + 1;

      const rapport = (email) => ({
        // Casse modifiée exprès : le code doit comparer les adresses en minuscules.
        entity: { userEmail: email.charAt(0).toUpperCase() + email.slice(1) },
        date,
        parameters: reports.parametres(email, date)
          .filter((p) => !demandes || demandes.includes(p.nom))
          .map(({ nom, ...v }) => ({ name: nom, ...v })),
      });

      const warnings = (reports.avertissements[date] || []).map((code) => ({ code }));
      if (userKey !== 'all') {
        if (!reports.utilisateurs.includes(userKey)) {
          throw new Error(`API call to reports.userUsageReport.get failed with error: Bad Request`);
        }
        return { usageReports: [rapport(userKey)], warnings };
      }
      // L'UO filtre les utilisateurs rendus ; une UO inconnue est refusée.
      let perimetre = reports.utilisateurs;
      if (opts.orgUnitID) {
        const membres = (reports.unites || {})[opts.orgUnitID];
        if (!membres) throw new Error('API call to reports.userUsageReport.get failed with error: Invalid org unit id');
        perimetre = reports.utilisateurs.filter((u) => membres.includes(u));
      }
      const taille = opts.maxResults || 1000;
      const debut = opts.pageToken ? Number(opts.pageToken) : 0;
      const tranche = perimetre.slice(debut, debut + taille);
      const suite = debut + taille < perimetre.length ? String(debut + taille) : undefined;
      const reponse = { usageReports: tranche.map(rapport), warnings };
      if (suite) reponse.nextPageToken = suite;
      return reponse;
    },
  };

  const Activities = {
    list: (userKey, application, opts = {}) => {
      avancer();
      compteurs.activites += 1;
      verifierOptions(opts, new Set(['startTime', 'maxResults', 'pageToken', 'endTime']));
      if (application !== 'drive') throw new Error(`Application non simulée : ${application}`);
      if (!reports.utilisateurs.includes(userKey)) {
        throw new Error('API call to reports.activities.list failed with error: Bad Request');
      }
      const tous = (reports.evenementsDrive[userKey] || [])
        .filter((e) => e.time >= opts.startTime)
        .sort((a, b) => (a.time < b.time ? 1 : -1));
      const taille = opts.maxResults || 1000;
      const debut = opts.pageToken ? Number(opts.pageToken) : 0;
      const items = tous.slice(debut, debut + taille).map((e) => ({
        id: { time: e.time },
        events: [{ name: e.name, parameters: [
          { name: 'doc_title', value: e.titre },
          { name: 'doc_type', value: 'document' },
          { name: 'owner', value: userKey },
          { name: 'visibility', value: 'private' },
          { name: 'primary_event', boolValue: true },
        ] }],
      }));
      const reponse = { items };
      if (debut + taille < tous.length) reponse.nextPageToken = String(debut + taille);
      return reponse;
    },
  };

  /* ------------------------------ Services ------------------------------ */

  Object.assign(sandbox, {
    console: options.bavard ? console : { log: () => {}, warn: () => {}, error: () => {} },
    AdminReports: { UserUsageReport, Activities },

    SpreadsheetApp: {
      getActive: () => classeur,
      getActiveSpreadsheet: () => classeur,
      flush: () => {},
      getUi: () => {
        if (options.sansUi) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.');
        return ui;
      },
    },

    HtmlService: {
      /**
       * Objet de service : on n'y ajoute pas de propriété. Le vrai HtmlOutput
       * n'est pas un objet JavaScript ordinaire ; y ranger une donnée pour le
       * banc revient à tester autre chose que ce qui tourne chez Google.
       */
      createHtmlOutput: (html) => {
        const cible = {
          setWidth: () => sortie,
          setHeight: () => sortie,
          setTitle: () => sortie,
          getContent: () => String(html),
        };
        const sortie = new Proxy(cible, {
          set: (_, cle) => {
            throw new TypeError(`Cannot add property ${String(cle)} to HtmlOutput`);
          },
        });
        return sortie;
      },
    },

    Session: {
      getScriptTimeZone: () => 'Europe/Paris',
      getActiveUserLocale: () => options.locale || 'fr',
      getActiveUser: () => ({ getEmail: () => courant.email }),
    },

    Utilities: {
      formatDate: (date, fuseau, motif) => {
        if (Object.prototype.toString.call(date) !== '[object Date]' || Number.isNaN(date.getTime())) {
          throw new Error('Exception: Invalid argument: date');
        }
        const p = {};
        new Intl.DateTimeFormat('en-CA', {
          timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
        }).formatToParts(date).forEach(({ type, value }) => { p[type] = value; });
        const motifs = {
          'yyyy-MM-dd': `${p.year}-${p.month}-${p.day}`,
          'yyyy-MM-dd HH:mm:ss': `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`,
        };
        if (!(motif in motifs)) throw new Error(`Motif de date non simulé : ${motif}`);
        return motifs[motif];
      },
      sleep: () => {},
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (algorithme, texte, jeu) => {
        if (algorithme !== 'SHA_256' || jeu !== 'UTF_8') throw new Error('Invalid argument');
        // Google rend des octets **signés**, de -128 à 127.
        return [...crypto.createHash('sha256').update(texte, 'utf8').digest()]
          .map((o) => (o > 127 ? o - 256 : o));
      },
      base64Encode: (octets) => Buffer.from(octets.map((o) => (o < 0 ? o + 256 : o))).toString('base64'),
    },

    PropertiesService: {
      getDocumentProperties: () => (options.sansDocument ? null : {
        getProperty: (cle) => (proprietes.has(cle) ? proprietes.get(cle) : null),
        setProperty: (cle, valeur) => {
          if (pannes.setPropertyRestantes > 0) {
            pannes.setPropertyRestantes -= 1;
            throw new Error('Service error: Properties');
          }
          if (Buffer.byteLength(String(valeur), 'utf8') > TAILLE_MAX_PROPRIETE) {
            throw new Error('Exception: Argument too large: value');
          }
          proprietes.set(cle, String(valeur));
        },
        deleteProperty: (cle) => { proprietes.delete(cle); },
      }),
    },

    LockService: {
      getDocumentLock: () => ({
        tryLock: () => {
          if (verrou.bloque || verrou.pris) return false;
          verrou.pris = true;
          return true;
        },
        releaseLock: () => { verrou.pris = false; },
      }),
      getScriptLock: () => null,
    },

    ScriptApp: {
      getProjectTriggers: () => declencheurs.filter((d) => d.proprietaire === courant.email),
      deleteTrigger: (cible) => {
        const i = declencheurs.indexOf(cible);
        if (i === -1 || cible.proprietaire !== courant.email) throw new Error('Trigger not found');
        declencheurs.splice(i, 1);
      },
      // Des objets, comme les énumérations de Google : une chaîne « MONDAY »
      // ou un `undefined` passés à onWeekDay sont refusés.
      WeekDay: JOURS_SEMAINE,
      newTrigger: (nom) => ({
        timeBased: () => ({
          onWeekDay: (jour) => {
            if (!Object.values(JOURS_SEMAINE).includes(jour)) {
              throw new Error('Exception: Invalid argument: day');
            }
            const hebdo = { jour: jour.nom, heure: null };
            const constructeur = {
              atHour: (heure) => {
                if (!Number.isInteger(heure) || heure < 0 || heure > 23) {
                  throw new Error('Exception: Invalid argument: hour');
                }
                hebdo.heure = heure;
                return constructeur;
              },
              create: () => {
                const d = { getHandlerFunction: () => nom, proprietaire: courant.email, ...hebdo };
                declencheurs.push(d);
                return d;
              },
            };
            return constructeur;
          },
          after: (ms) => ({
            create: () => {
              if (typeof ms !== 'number') throw new Error('Invalid argument: after');
              const d = { getHandlerFunction: () => nom, proprietaire: courant.email, apres: ms };
              declencheurs.push(d);
              return d;
            },
          }),
        }),
      }),
    },
  });

  // Un classeur neuf n'est jamais vide : Google y pose une première feuille.
  if (options.premiereFeuille !== null) classeur.insertSheet(options.premiereFeuille || 'Feuille 1');

  sandbox.__horloge = horloge;
  return { courant, menus, alertes, modales, reports, horloge, compteurs, declencheurs, proprietes, feuilles, classeur, toasts, verrou, pannes, FausseFeuille };
};

module.exports = { installerFauxGoogle };
