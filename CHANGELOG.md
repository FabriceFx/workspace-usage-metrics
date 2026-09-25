# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit le [Semantic Versioning](https://semver.org/lang/fr/).

## [0.5.1] - 2026-09-25

Corrections issues d'une revue de code.

### Corrigé

- Changer d'unité organisationnelle vide désormais le cache : un compte hors de la nouvelle UO survivait par les jours déjà chargés.
- Un compte dont le journal Drive n'avait pas commencé quand le temps s'épuisait était sauté sans être signalé.
- « Francais » sans cédille était accepté par le menu mais refusé par le rapport.
- Une adresse commençant par un tiret (« -accueil@… ») devenait une formule dans le cache.
- Programmer sans adresse connue permettait à un second administrateur de doubler le rapport programmé.

### Modifié

- Le journal Drive se relit par en-tête, deux colonnes seulement et par blocs.
- Les rapports d'usage sont filtrés page par page, sans garder tout le domaine en mémoire.
- Une reprise lit les jours complets sans décoder tout le cache.
- La largeur de la synthèse vient des en-têtes, et non plus d'une constante.
- Banc : le faux Google applique l'unité organisationnelle, ne rend à chacun que ses propres déclencheurs et compte les cellules lues.

## [0.5.0] - 2026-09-25

### Ajouté

- Colonne « Signal Gmail sans connexion » : repère les boîtes utilisées sans jamais se connecter, typiquement par délégation. Présomption, sans effet sur les statuts.

### Modifié

- Colonnes de date repérées par leur en-tête, et non plus par leur rang.

## [0.4.2] - 2026-09-25

### Ajouté

- À l'installation, la première feuille vide de Google (« Feuille 1 », « Sheet1 », ou « Feuil1 » d'un .xlsx importé) est retirée.

### Modifié

- Modules du socle en 0.12.2 ; `SocleFeuilles` ajouté.

## [0.4.1] - 2026-09-25

### Corrigé

- Menu en anglais sur un compte en français : réglage « Langue de l'interface » (automatique, français, anglais) pour trancher.

### Ajouté

- « À propos » et le journal d'exécution indiquent la langue que Google rapporte, et celle retenue.

## [0.4.0] - 2026-09-25

### Ajouté

- Rapport programmé chaque semaine (menu « Programmer le rapport hebdomadaire »), jour et heure dans « Paramètres ».
- Confirmation avant de programmer, qui rappelle que le rapport tourne sous l'identité de l'administrateur.
- README : comparaison avec la console d'administration.

### Modifié

- Nouvelle portée `userinfo.email`, pour savoir qui a programmé le rapport.

## [0.3.2] - 2026-09-25

### Corrigé

- Le bandeau d'échec est toujours en français ; il mélangeait la langue du document et celle de l'administrateur.

## [0.3.1] - 2026-09-25

### Corrigé

- Bilinguisme réellement complet pour tout ce que l'outil dit (erreurs, notifications, diagnostic) ; le contenu du classeur reste en français.
- Le diagnostic décide du statut à la source, au lieu de le déduire du texte du message.
- Retrait de `texteBrut`, crochet de test ajouté à l'objet HtmlOutput de Google.
- Le diagnostic s'arrête avant 6 minutes et marque « Non vérifié » les comptes restants.
- « Abandonner le rapport en cours » affiche ses erreurs comme les autres entrées de menu.

### Modifié

- Traductions et échappement repris du socle (`SocleLangues`, `SocleTexte`).
- La langue n'est lue qu'une fois par exécution.

## [0.3.0] - 2026-09-25

### Ajouté

- Boîtes de dialogue Material Design 3 : « À propos », diagnostic avec recherche, messages.
- Interface français / anglais selon la langue du compte (incomplète, voir 0.3.1).
- README bilingue.

## [0.2.1] - 2026-09-25

### Corrigé

- Un titre de fichier Drive comme `=IMAGE(…)` devenait une formule active : forcé en texte.
- L'état de reprise pouvait dépasser les 9 Ko de PropertiesService.
- La synthèse démarrait sur un budget de temps entamé.

### Modifié

- Erreurs des actions de menu affichées dans une boîte de dialogue.
- Largeurs fixes pour « Détail Drive ».
- `.gitignore` ajouté.

## [0.2.0] - 2026-09-25

Revue de la version d'origine (`Code.gs`, notée 0.1.0) : voir `RAPPORT-REVUE.md`.

### Corrigé

- Le projet ne se chargeait pas (seize textes à trous sans accents graves).
- Un jour ou une page en échec était compté comme une journée calme, sans mention.
- Un paramètre refusé par l'API s'affichait 0 au lieu de « non mesuré ».
- Un groupe en tête de liste faisait échouer tout le rapport.
- Le plafond des 6 minutes était atteignable sur un grand domaine.

### Ajouté

- Cache des jours publiés (onglet masqué `_cache_usage`).
- Onglet « Paramètres » : fenêtres, seuils, unité organisationnelle.
- Bandeau de réserves et notes sur chaque en-tête.
- Menu : « Diagnostiquer les comptes », « Abandonner le rapport en cours », « À propos ».
- Reprise automatique sur erreur passagère, verrou contre deux rapports simultanés.
- `appsscript.json` à portées minimales, banc d'essai `node banc/test.js`.

### Modifié

- Découpage en modules et reprise des modules du socle.
- Dates affichées au jour, sans heure.
- Statuts dérivés des seuils réglables.
- Onglet « Détail Drive » à nom fixe.
- `CONFIG.SPREADSHEET_ID` retiré : le projet est lié au classeur.
