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

### Les choix, et pourquoi

**Un jour non chargé n'est pas un jour calme.** Si Google refuse une page, le
jour entier est écarté des cumuls et le bandeau le nomme. La version d'origine
avalait l'erreur : le jour valait zéro pour tous les comptes, ou — si la panne
tombait sur la deuxième page — zéro pour une partie d'entre eux seulement, sans
aucune mention. De même, un paramètre que l'API refuse laisse ses colonnes
**vides** : une cellule vide veut dire « non mesuré », jamais « rien trouvé ».

**On interroge tout le domaine, pas chaque compte.** Un appel `all` rend 1 000
utilisateurs. Pour trente jours, cela fait trente appels par tranche de 1 000
utilisateurs du domaine, quel que soit le nombre de comptes suivis. Interroger
compte par compte coûte un appel par compte et par jour : c'est plus cher dès
qu'on suit plus de comptes qu'il n'y a de tranches.

**Un jour publié ne change plus, donc on le garde.** Le cache (onglet masqué
`_cache_usage`) retient chaque jour chargé en entier ; le rapport suivant ne
redemande que le jour nouveau. Un jour que Google déclare partiel
(`PARTIAL_DATA_AVAILABLE`) est utilisé mais pas gardé. Le cache repart de zéro
dès que la liste des comptes ou des paramètres change — on le détecte par une
empreinte SHA-256 de cette liste : un compte ajouté serait sinon absent de tous
les jours gardés, donc déclaré « absent » à tort.

**Six minutes, et pas une de plus.** Sur un domaine de quelques milliers de
comptes, trente jours de rapports dépassent le plafond d'une exécution. Le
rapport travaille donc par étapes — jours d'usage, puis journal Drive compte
par compte, puis synthèse — avec un budget de quatre minutes. Quand il est
atteint, l'état est écrit (sous les 9 Ko permis par valeur) et un déclencheur
ponctuel reprend une minute plus tard, à la page exacte. Le curseur n'avance
qu'après l'écriture : une exécution tuée fait au pire recommencer une unité,
jamais en sauter une. Le diagnostic suit la même règle et dit quels comptes il
n'a pas eu le temps de vérifier.

**Lié au classeur.** Le menu vient du déclencheur simple `onOpen`, et chaque
action s'exécute sous l'identité de qui la lance. Seul le déclencheur de
reprise est installable : il tourne sous l'identité de l'administrateur qui a
cliqué, ne vit que le temps d'un rapport, et n'est jamais posé par quelqu'un
d'autre. Un projet autonome aurait dû poser un déclencheur permanent, qui
aurait prêté ses droits à quiconque ouvre le classeur.

**Le réglage n'est pas dans le code.** Fenêtres, seuils de statut et unité
organisationnelle vivent dans l'onglet « Paramètres ». Le code n'y ajoute que
les lignes absentes et ne réécrit jamais une valeur saisie.

**Les dates sont des jours.** « Dernière action Gmail » peut venir d'un
horodatage exact ou d'un compteur d'envois non nul, qui ne donne que le jour.
Afficher 23:59 dans le second cas ferait passer une présomption pour un fait :
toutes les colonnes de date affichent donc le jour, et rien de plus.

**Un titre de fichier est une donnée hostile.** N'importe qui peut partager un
document intitulé `=IMAGE("https://…")` ; écrit tel quel, il deviendrait une
formule qui appelle ce serveur à chaque ouverture du classeur. Toute chaîne
venue de Drive est forcée en texte par une apostrophe initiale, invisible à la
lecture.

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
