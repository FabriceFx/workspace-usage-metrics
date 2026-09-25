# Métrique d'usage / Usage metrics

[Français](#français) · [English](#english)

<a name="français"></a>
## Français

Rapport d'activité Gmail et Drive d'une liste de comptes Google Workspace —
typiquement des comptes génériques (`accueil@`, `compta@`…) dont on veut savoir
s'ils servent encore. Le résultat est un onglet de synthèse : un statut par
compte, les dates de dernière activité, des cumuls sur 7 jours et sur une
fenêtre réglable, et le journal Drive détaillé des derniers jours.

Pour l'installer et s'en servir, voir **[DEMARRAGE.md](DEMARRAGE.md)**. Ce
fichier-ci explique les choix de conception, et surtout **pourquoi** ils sont
ce qu'ils sont.

### D'où viennent les chiffres

Deux sources de l'Admin SDK Reports, qui ne disent pas la même chose :

| Source | Ce qu'elle donne | Fraîcheur |
|---|---|---|
| Rapports d'usage (`UserUsageReport`) | compteurs par jour et par utilisateur, dernière connexion, quotas | 2 à 3 jours de décalage |
| Journal d'audit Drive (`Activities`) | événements horodatés (consultation, modification…) | quelques heures |

Les compteurs s'arrêtent donc à la **dernière date publiée par Google**, que le
bandeau de la synthèse affiche. « Dernière activité Drive » prend la plus
récente des deux sources : c'est la seule colonne qui peut dépasser cette date.

### Choix de conception

| Choix | Pourquoi |
|---|---|
| Un jour que Google n'a pas rendu est **exclu des cumuls** et nommé dans le bandeau. | Le compter à zéro ferait passer une panne pour de l'inactivité. |
| Une cellule **vide** veut dire « non mesuré ». | Un zéro affirme ce qu'on n'a pas mesuré. |
| On interroge **tout le domaine** (`all`), pas chaque compte. | 30 jours = 30 appels par tranche de 1 000 utilisateurs, quel que soit le nombre de comptes suivis. |
| Les jours publiés sont **gardés en cache** (onglet masqué). | Ils ne changent plus : le rapport quotidien ne demande que le jour nouveau. |
| Le rapport **s'interrompt et reprend** seul. | Un grand domaine dépasse les 6 minutes d'une exécution. |
| Le projet est **lié au classeur**. | Chaque action s'exécute sous l'identité de qui clique, sans prêter ses droits. |
| Les réglages sont dans l'onglet **« Paramètres »**. | Les changer ne demande aucun déploiement. |
| Les dates affichent **le jour**, pas l'heure. | Certaines ne sont connues qu'au jour ; une heure serait inventée. |
| Les titres de fichiers Drive sont **forcés en texte**. | Un titre `=IMAGE(…)` deviendrait sinon une formule active. |

### Deux langues : ce qui est traduit, et ce qui ne l'est pas

Ce que l'outil **dit** à la personne suit la langue de son compte Google
(français, ou anglais pour toute langue en `en`) : menu, boîtes de dialogue,
messages d'erreur, notifications, diagnostic.

Le **contenu du classeur** reste en français : noms d'onglets, en-têtes,
statuts, bandeau, notes d'en-tête, explications de l'onglet « Paramètres ».
C'est un document partagé ; il ne doit pas changer de langue selon qui a cliqué
en dernier, et les statuts sont des valeurs que l'on filtre.

Les tables de traduction passent par `SocleLangues` : une clé manquante
s'affiche `⟨cle⟩` au lieu de passer inaperçue, et le banc vérifie que les deux
tables ont les mêmes clés.

### Portées demandées

| Portée | Pour quoi faire |
|---|---|
| `admin.reports.usage.readonly` | rapports d'usage |
| `admin.reports.audit.readonly` | journal Drive |
| `spreadsheets.currentonly` | ce classeur-ci, et aucun autre |
| `script.container.ui` | menu et boîtes de dialogue |
| `script.scriptapp` | déclencheur de reprise |

Rien d'autre : aucun accès aux boîtes aux lettres ni au contenu des fichiers
Drive. Le banc le vérifie (`GmailApp`, `DriveApp`, `openById`, `UrlFetchApp`
absents du code).

### Structure

```
apps-script/
  Metrique.gs            version, CONFIG, paramètres, menu et points d'entrée
  MetriqueUi.gs          traductions et boîtes de dialogue Material Design 3
  MetriqueRapport.gs     déroulé en étapes reprenables, état
  MetriqueCollecte.gs    appels à l'Admin SDK Reports
  MetriqueCache.gs       cache des jours publiés
  MetriqueAnalyse.gs     calcul d'une ligne de synthèse
  MetriqueClasseur.gs    lecture des comptes, écriture des onglets
  Socle*.gs              recopiés tels quels de socle-apps-script
  appsscript.json
banc/
  faux-google.js         services Google simulés, aussi stricts que les vrais
  test.js
```

Les modules `Socle*` ne se retouchent pas ici : une correction remonte au
socle, puis redescend dans chaque projet.

### Banc d'essai

```bash
node banc/test.js
```

Le banc simule un domaine de 2 500 comptes (trois pages), des pannes
passagères et définitives, une page en échec au milieu d'un jour, un paramètre
refusé, un jour partiel, une horloge qui s'emballe pour forcer les reprises, un
verrou déjà pris, une exécution orpheline et un titre de fichier piégé. Chaque
défaut corrigé y a son cas, marqué de la version où il a été trouvé.

Le faux service refuse ce que le vrai refuse : il rend des `Date` là où l'on a
écrit une date, transforme en formule une chaîne qui commence par `=`, refuse
une valeur de propriété de plus de 9 Ko et toute propriété ajoutée à un objet
HtmlOutput. Les messages sont vérifiés sur le texte réellement affiché.

Avant de pousser :

```bash
cat apps-script/*.gs > /tmp/projet.js && node --check /tmp/projet.js
```

---

<a name="english"></a>
## English

Gmail and Drive activity report for a list of Google Workspace accounts —
typically shared mailboxes (`contact@`, `billing@`…) whose actual use you want
to check. The output is a summary sheet: one status per account, last-activity
dates, totals over 7 days and over an adjustable window, and the detailed Drive
log of the last few days.

Setup instructions are in **[DEMARRAGE.md](DEMARRAGE.md)** (French).

### Where the figures come from

| Source | What it gives | Freshness |
|---|---|---|
| Usage reports (`UserUsageReport`) | per-user daily counters, last login, storage | 2 to 3 days late |
| Drive audit log (`Activities`) | timestamped events (view, edit…) | a few hours |

Counters stop at the **latest date published by Google**, shown in the summary
banner. « Dernière activité Drive » takes the more recent of both sources.

### Design choices

- **An unread day is not a quiet day.** If Google rejects a page, the whole day
  is left out of the totals and named in the banner. A parameter the API
  rejects leaves its cells blank: blank means « not measured », never zero.
- **The whole domain is queried, not each account.** One `all` call returns
  1,000 users: thirty days cost thirty calls per 1,000 domain users, however
  many accounts are tracked.
- **Published days are cached** in a hidden sheet; the next report only fetches
  the new day. The cache is reset when the account or parameter list changes
  (detected by a SHA-256 fingerprint of that list).
- **Six minutes, no more.** The report runs in resumable stages under a
  four-minute budget; its state stays under the 9 KB property limit, and a
  one-off trigger resumes it a minute later. Diagnostics follow the same rule.
- **Bound to the spreadsheet.** The menu comes from the simple `onOpen`
  trigger, so each action runs as whoever clicks it.
- **Dates are days.** Some last-activity values are only known to the day;
  showing a time would present a guess as a fact.
- **File titles are hostile data.** A shared file named `=IMAGE("https://…")`
  would become a formula; every string from Drive is forced to plain text.

### Languages

What the tool **says** — menu, dialogs, errors, notifications, diagnostics —
follows the language of your Google account (English for any `en` locale,
French otherwise). The **spreadsheet content** — sheet names, headers,
statuses, banner, header notes — stays in French: it is a shared document, and
it must not change language depending on who clicked last.

### OAuth scopes

| Scope | Purpose |
|---|---|
| `admin.reports.usage.readonly` | usage reports |
| `admin.reports.audit.readonly` | Drive log |
| `spreadsheets.currentonly` | this spreadsheet only |
| `script.container.ui` | menu and dialogs |
| `script.scriptapp` | resume trigger |

No access to mailboxes or to Drive file contents.

### Test bench

```bash
node banc/test.js
```

---

## Licence / License

[Elastic License 2.0](LICENSE) — Fabrice Faucheux, <https://faucheux.bzh>.
