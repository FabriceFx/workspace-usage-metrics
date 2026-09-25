# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit le [Semantic Versioning](https://semver.org/lang/fr/).

## [0.3.2] - 2026-09-25

### Corrigé

- **Le bandeau d'échec mélangeait deux langues.** Quand un rapport échouait en
  arrière-plan, la phrase « Le rapport du … a échoué » était en français, mais
  la cause suivait la langue de l'administrateur qui l'avait lancé. Une erreur
  attendue est maintenant retraduite en français depuis sa clé. Une erreur
  imprévue garde son message technique, annoncé comme tel. L'administrateur
  reçoit toujours la notification de Google dans sa propre langue.

## [0.3.1] - 2026-09-25

Corrections de la 0.3.0, dont l'annonce allait plus loin que le code.

### Corrigé

- **Le bilinguisme n'était pas complet**, contrairement à ce qu'annonçait la
  0.3.0 : erreurs, notifications, détail du diagnostic et une ligne de
  « À propos » restaient en français en dur. Tout ce que l'outil dit à la
  personne passe maintenant par la table de traductions. Le contenu du
  classeur (onglets, en-têtes, statuts, bandeau, notes) reste en français, et
  c'est désormais écrit : un document partagé ne change pas de langue selon qui
  a cliqué en dernier.
- **Le diagnostic classait chaque compte d'après le début de son message**
  (« OK », « ERREUR »). Une fois traduit, chaque erreur serait passée pour une
  absence. Le type est maintenant décidé à la source.
- **Crochet de test dans le code de production** : `texteBrut`, propriété
  ajoutée à l'objet HtmlOutput de Google pour que le banc lise les messages.
  Retiré ; le faux service refuse désormais toute propriété ajoutée, et le banc
  lit le texte réellement affiché.
- **Le diagnostic pouvait dépasser six minutes** sur une longue liste (un appel
  par compte). Il s'arrête avant, et marque « Non vérifié » les comptes restants.
- `abandonnerRapport` est protégé comme les autres entrées de menu. Sa
  confirmation reste un `ui.alert` natif, à dessein : une modale HTML ne rend
  pas le bouton choisi au script.

### Modifié

- Traductions et échappement repris du socle (`SocleLangues`, `SocleTexte`) au
  lieu de leur réécriture locale : une clé absente s'affiche `⟨cle⟩` au lieu de
  passer inaperçue, les pluriels suivent la règle de chaque langue, et le banc
  vérifie que les deux tables ont les mêmes clés.
- La langue n'est lue qu'une fois par exécution.

## [0.3.0] - 2026-09-25

Interface Material Design 3 et bilinguisme complet (Français / Anglais).

### Ajouté

- **Boîtes de dialogue Material Design 3 (MD3).** Les alertes brutes `ui.alert`
  cèdent la place à des modales immersives respectant la charte Google
  Workspace : typographie soignée, badges de statut colorés, et champ de recherche
  instantané dans le diagnostic des comptes.
- **Bilinguisme intégral (FR / EN).** Détection automatique de la langue de
  l'administrateur (`Session.getActiveUserLocale`) et centralisation de tous les
  libellés (menus, messages, dialogues) dans un dictionnaire unique `I18N`.
- **Échappement HTML systématique.** Toutes les variables injectées dans les
  dialogues passent par une fonction d'échappement rigoureuse (`echapperHtml_`).
- **Documentation bilingue.** `README.md` disponible intégralement en français
  et en anglais.

## [0.2.1] - 2026-09-25

Corrections issues d'une contre-revue de la 0.2.0.

### Corrigé

- **Injection de formule par un titre de fichier Drive.** Un document partagé
  intitulé `=IMAGE("https://…")` devenait une formule dans l'onglet
  « Détail Drive », qui appelait ce serveur à chaque ouverture du classeur. Un
  titre en forme de date devenait une date. Toute chaîne venue de l'extérieur
  est désormais forcée en texte.
- **L'état de reprise pouvait dépasser les 9 Ko de PropertiesService** : la
  liste des jours et un message par jour en échec, soit environ 31 Ko sur une
  fenêtre de 180 jours. Les jours sont recalculés et non stockés, et les
  messages sont dédoublonnés et limités à cinq.
- **La synthèse commençait sur un budget entamé.** Un budget de 30 secondes lui
  est réservé ; sinon elle attend la reprise suivante.

### Modifié

- Les erreurs d'une action de menu s'affichent dans une boîte de dialogue :
  le remède pour une erreur attendue, la mention « imprévue » et le message
  technique pour un défaut du code.
- « Détail Drive » reçoit des largeurs de colonnes fixes au lieu d'un
  redimensionnement automatique sur des milliers de lignes.
- `.gitignore` ajouté (`.clasp.json`, `.clasprc.json`).

## [0.2.0] - 2026-09-25

Revue complète de la version d'origine (`Code.gs`, non versionnée, notée ici
0.1.0). Le détail des défauts et de leurs causes est dans `RAPPORT-REVUE.md`.

### Corrigé

- **Le projet ne se chargeait pas.** Les seize gabarits de chaîne avaient perdu
  leurs accents graves : erreur de syntaxe, donc toutes les fonctions
  « introuvables », menu compris.
- **Un jour ou une page en échec était compté comme une journée calme**, sans
  aucune mention. Il est désormais exclu des cumuls, et le bandeau de la
  synthèse le dit.
- **Un paramètre refusé par l'API s'affichait 0** ; ses colonnes restent vides
  (« non mesuré »). Même règle pour les quotas absents.
- **Un groupe ou un alias en tête de la liste faisait échouer tout le rapport** :
  la date de référence est maintenant demandée pour `all`.
- **Le plafond des six minutes** était atteignable sur un domaine de quelques
  milliers de comptes. Le rapport s'exécute par étapes reprenables.

### Ajouté

- Cache des jours publiés (onglet masqué `_cache_usage`) : un rapport quotidien
  ne demande plus que le jour nouveau.
- Onglet « Paramètres » : fenêtres, seuils de statut et unité organisationnelle,
  modifiables sans déploiement.
- Bandeau de réserves, notes explicatives sur chaque en-tête, entrées de menu
  « Diagnostiquer les comptes », « Abandonner le rapport en cours » et « À propos ».
- Reprises sur erreur passagère (quotas, erreurs serveur).
- Verrou de document contre deux générations simultanées.
- `appsscript.json` avec des portées minimales et lisibles.
- Banc d'essai hors Google (`node banc/test.js`).

### Modifié

- Découpage en modules (`apps-script/`) et reprise des modules du socle
  (`SocleDates`, `SocleExecution`, `SocleReprises`, `SocleApi`).
- Les colonnes de date n'affichent plus que le jour.
- Libellés de statut dérivés des seuils réglables.
- Onglet « Détail Drive » à nom fixe (il était suffixé de la fenêtre).
- `CONFIG.SPREADSHEET_ID` retiré : le projet est lié au classeur.
