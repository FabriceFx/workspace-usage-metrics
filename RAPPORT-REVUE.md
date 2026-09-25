# Revue — Métrique d'usage

**Type** : administration Workspace (Admin SDK Reports), projet lié à un classeur
**Fichiers analysés** : `Code.gs` (358 lignes, un seul fichier, sans manifeste)
**Verdict** : la logique métier est saine et l'idée d'interroger `all` plutôt que
chaque compte est la bonne. Mais le fichier **ne se charge pas** en l'état, et
une fois réparé il **donne des chiffres faux sans le dire** dès qu'un appel échoue.
Sur un domaine de quelques milliers de comptes, il dépasse aussi le plafond des
six minutes. La v0.2 corrige les trois, et le banc d'essai (38 cas) les couvre.

Les numéros de ligne renvoient à l'ancien `Code.gs`.

## 🔴 Bloquant

- **Le projet ne se charge pas : seize gabarits de chaîne sans accents graves** —
  `Code.gs:61, 67, 71, 80, 93, 109, 128, 129, 148, 188, 297, 307, 321, 325, 331, 333`
  `throw new Error(Aucun compte trouvé … ${CONFIG.ONGLET_COMPTES} …)` est une
  erreur de syntaxe (`node --check` : *missing ) after argument list*). Le projet
  entier échoue au chargement : `onOpen`, le menu et toutes les fonctions
  deviennent « introuvables ». Les espaces ajoutées dans `${ x }` et le retrait
  décalé des lignes 62, 82 et 296-313 montrent un passage par un formateur ou un
  copier-coller qui a mangé les accents graves. Tous les gabarits sont rétablis.

- **Un jour ou une page en échec compte comme une journée calme** — `Code.gs:145-150, 183-190`
  `chargerUsageJour_` intercepte l'erreur, affiche un `console.warn` et fait
  `break`. Deux résultats faux :
  - si la **première** page échoue, le jour vaut zéro pour tous les comptes ;
  - si c'est la **deuxième**, les comptes de la page 1 sont comptés et ceux des
    pages suivantes passent pour absents ce jour-là.
  Dans les deux cas, rien dans le classeur ne le dit. Même chose pour le journal
  Drive (`journalDrive_`). Désormais : reprise automatique sur erreur passagère
  (`SocleReprises`), sinon le jour entier est écarté des cumuls et **nommé dans
  le bandeau** de la synthèse. Un jour à moitié lu n'est jamais utilisé.

- **Le plafond des six minutes est atteignable** — `Code.gs:75-79`
  Trente jours × (utilisateurs du domaine / 1 000) appels, plus un appel Drive par
  compte, sans budget ni reprise. À 5 000 utilisateurs, c'est 150 appels d'usage :
  plusieurs minutes, selon la latence de Reports. Une exécution qui atteint six
  minutes est tuée sans rien écrire. Désormais : étapes reprenables avec un budget
  de 4 minutes, état dans les propriétés du document, reprise par déclencheur
  ponctuel, curseur qui n'avance qu'après l'écriture — jusqu'à la page exacte du
  journal Drive d'un compte très actif. Et surtout un **cache des jours publiés** :
  un rapport quotidien ne demande plus qu'un seul jour au lieu de trente.

## 🟠 Important

- **Un groupe en tête de liste fait échouer tout le rapport** — `Code.gs:66, 100-111`
  La date de référence est demandée pour `comptes[0]`. Si ce compte est un groupe
  ou un alias, Google répond une erreur qui ne contient pas « later than », et la
  fonction lève. Elle est maintenant demandée pour `all` (avec l'UO éventuelle),
  avec un repli qui recule jour par jour si le message de Google change un jour.

- **Un paramètre refusé par l'API s'affiche 0** — `Code.gs:228, 254-255`
  `paramsValides_` retire proprement un paramètre refusé, mais `u[p] || 0` le fait
  ensuite réapparaître à zéro : « aucun fichier consulté » au lieu de « non
  mesuré ». Même défaut pour les quotas. Ces colonnes restent vides, et le
  bandeau nomme les paramètres refusés.

- **Présomption affichée comme un fait** — `Code.gs:232-233, 350-354`
  Faute de `last_interaction_time`, « Dernière action Gmail » prend le dernier
  jour d'envoi, daté arbitrairement de 23 h 59. La cellule affiche alors une heure
  que personne n'a observée, à côté de vrais horodatages. Toutes les colonnes de
  date affichent désormais le jour seul, et la note de l'en-tête dit d'où vient
  la valeur.

- **Deux clics = deux rapports concurrents** — `Code.gs:55`
  Aucun verrou : deux générations simultanées se partagent les mêmes onglets.
  Verrou de document (`SocleExecution.sousVerrou`) ; un second clic pendant un
  rapport en cours affiche où il en est, sans rien relancer.

- **Manifeste absent** — l'en-tête renvoie à un `appsscript.json` qui n'est pas
  dans le dossier. Livré, avec des portées explicites et minimales :
  `spreadsheets.currentonly` au lieu de l'accès à tous les classeurs que
  l'inférence automatique aurait demandé à cause de `openById`.

- **Rien pour l'utilisateur qui lit la synthèse** — aucune explication des
  colonnes, ni de ce qui manque. Chaque en-tête porte maintenant une note, et la
  ligne 2 dit ce qui n'a pas pu être mesuré (« ✅ » sinon).

## 🟡 Harmonisation

- Découpage en six modules `Metrique*.gs` sous `apps-script/`, plus quatre
  modules recopiés tels quels du socle (`SocleDates`, `SocleExecution`,
  `SocleReprises`, `SocleApi`) au lieu de leur réécriture locale.
- Seuls les six points d'entrée sont des `function` déclarées ; tout l'interne en
  `const … = () =>`. Le banc le vérifie.
- Noms globaux génériques renommés : `PARAMS` → `PARAMETRES_USAGE`, `ENTETES` →
  `entetesSynthese_()`, `fmt_` → `SocleDates.jour`, `statut_` → `statutActivite_`,
  `feuille_` → `viderOnglet_`. Les noms métier d'origine (`analyserCompte_`,
  `chargerUsageJour_`, `journalDrive_`, `paramsValides_`, `convertir_`…) sont gardés.
- `CONFIG` figé par `Object.freeze` et réservé aux constantes techniques.
- Numéro de version unique (`METRIQUE_VERSION`, vérifié contre `VERSION`), affiché
  dans le bandeau et dans « À propos ».
- Commentaires réécrits pour dire *pourquoi* ; JSDoc sur les fonctions non évidentes.
- `README.md`, `DEMARRAGE.md`, `CHANGELOG.md`, `VERSION`, `LICENSE` (recopiée de
  `menage-gmail`), banc `node banc/test.js`.

## Changements de comportement

| Avant | Après |
|---|---|
| Jour ou page en échec : compté à zéro, en silence | écarté des cumuls, nommé dans le bandeau |
| Paramètre refusé, quota absent : `0` | cellule vide |
| Dates avec heure (23:59 présumé) | jour seul, format `jj/mm/aaaa` |
| Statuts « Actif cette semaine », « Actif ce mois-ci »… | « 🟢 Actif (≤ 7 j) », « 🟡 Actif récemment (≤ 30 j) »… — dérivés des seuils réglables |
| En-têtes « 30 j » fixes | suivent le réglage « Jours d'historique » |
| `CONFIG` dans le code | onglet « Paramètres » (même valeurs par défaut) |
| Onglet « Détail Drive 7 j » | « Détail Drive », nom fixe (l'ancien onglet reste : à supprimer à la main) |
| `CONFIG.SPREADSHEET_ID` | retiré : le projet doit être lié au classeur |
| Rapport en une exécution | peut s'étaler sur plusieurs, avec reprise automatique |
| Ligne 2 de « Synthèse » vide | bandeau des réserves |
| « Absent du rapport d'usage » | mentionne aussi « hors de l'unité organisationnelle » |
| Journal Drive illisible pour un compte : ignoré | compté dans le bandeau (un groupe y figure donc toujours) |

## Points à ta main

- **Supprimer l'ancien `Code.gs` du projet Apps Script.** Il déclare `CONFIG`, comme
  `Metrique.gs` : les deux ensemble empêchent tout le projet de se charger. Je l'ai
  laissé à la racine du dossier local pour comparaison ; supprime-le quand tu
  auras validé.
- **Le message « later than » de Google** est une chaîne en anglais non documentée.
  Le repli (reculer jour par jour) couvre sa disparition, mais pas une traduction
  qui garderait une autre date : à surveiller.
- **Mise en cache d'un jour publié.** J'ai supposé qu'un jour publié sans
  avertissement `PARTIAL_DATA_AVAILABLE` ne change plus. Si tu observes des
  corrections tardives de Google, il suffit de ne pas poser le témoin sur les deux
  jours les plus récents.
- **Seuils de statut** comparés à la date du jour, alors que les compteurs ont 2 à
  3 jours de retard : un compte actif chaque jour affiche « ≤ 7 j » avec 3 jours
  d'ancienneté minimum. C'était déjà le cas ; à toi de dire si le seuil « actif »
  doit se compter depuis la date d'arrêt.
- **Journal Drive des comptes très actifs** : plafond de 200 pages (200 000
  événements) par compte, signalé au bandeau s'il est atteint. Pour une fenêtre
  longue, filtrer par `eventName` réduirait le volume — à décider selon l'usage.
- **Interface bilingue FR/EN et notification par courriel d'un échec en arrière-plan**
  (`SocleCourriel`) : pas faites. Google notifie déjà le propriétaire du
  déclencheur ; dis-moi si tu veux plus.
- **Non vérifié sur un vrai domaine.** Le banc simule fidèlement la forme des
  réponses, mais je n'ai pas exécuté le code contre l'Admin SDK. Un premier
  lancement de « Diagnostiquer les comptes » puis d'un rapport sur une UO restreinte
  est le bon essai.
