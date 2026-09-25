# Revue — Métrique d'usage

**Analysé** : l'ancien `Code.gs` (358 lignes, sans manifeste) · **Corrigé en** : v0.2.0 · les versions suivantes sont dans le [CHANGELOG](CHANGELOG.md).

**Verdict** : logique métier saine, et interroger `all` plutôt que chaque compte est le bon choix. Mais le fichier ne se chargeait pas, donnait des chiffres faux sans le dire dès qu'un appel échouait, et dépassait les 6 minutes sur un grand domaine.

Les numéros de ligne renvoient à l'ancien `Code.gs`.

## 🔴 Bloquant

| Défaut | Où | Correction |
|---|---|---|
| Seize textes à trous sans accents graves : erreur de syntaxe, **tout le projet** « introuvable ». | `61, 67, 71, 80…333` | Accents rétablis. |
| Un jour ou une page en échec compté comme une journée calme, sans mention. | `145-150, 183-190` | Reprise automatique ; sinon jour exclu des cumuls et nommé dans le bandeau. |
| Plafond des 6 minutes atteignable (30 jours × tranches de 1 000 utilisateurs). | `75-79` | Étapes reprenables + cache des jours publiés. |

## 🟠 Important

| Défaut | Où | Correction |
|---|---|---|
| Un groupe en tête de liste fait échouer tout le rapport. | `66, 100-111` | Date de référence demandée pour `all`. |
| Un paramètre refusé par l'API s'affiche 0. | `228, 254-255` | Cellule vide (« non mesuré »), paramètre nommé au bandeau. |
| Heure 23:59 inventée pour la dernière action Gmail. | `232-233, 350-354` | Les dates affichent le jour seul. |
| Deux clics = deux rapports concurrents. | `55` | Verrou de document. |
| Manifeste `appsscript.json` absent. | — | Livré, portées minimales (`spreadsheets.currentonly`). |
| Colonnes sans explication. | — | Note sur chaque en-tête, bandeau des réserves. |

## 🟡 Harmonisation

Découpage en modules `Metrique*.gs` · modules `Socle*` recopiés au lieu d'être réécrits · seuls les points d'entrée en `function` · noms globaux génériques renommés · `CONFIG` figé · version unique vérifiée par le banc · README, DEMARRAGE, CHANGELOG, LICENSE, banc d'essai.

## Changements de comportement

| Avant | Après |
|---|---|
| Jour en échec compté à zéro | exclu des cumuls, nommé au bandeau |
| Paramètre refusé ou quota absent : `0` | cellule vide |
| Dates avec heure | jour seul |
| « Actif cette semaine »… | « 🟢 Actif (≤ 7 j) »…, selon les seuils réglables |
| En-têtes « 30 j » fixes | suivent « Jours d'historique » |
| `CONFIG` dans le code | onglet « Paramètres » |
| Onglet « Détail Drive 7 j » | « Détail Drive » (supprimez l'ancien à la main) |
| `CONFIG.SPREADSHEET_ID` | retiré : projet lié au classeur |
| Une seule exécution | plusieurs si nécessaire, reprise automatique |
| Journal Drive illisible ignoré | compté au bandeau |

## Points à ta main

| Sujet | Décision attendue |
|---|---|
| Ancien `Code.gs` dans le projet Apps Script | À supprimer : il empêche tout le projet de se charger. |
| Seuils de statut | Comptés depuis aujourd'hui, alors que les compteurs ont 2 à 3 jours de retard. Les compter depuis la date d'arrêt ? |
| Cache des jours publiés | Suppose qu'un jour publié ne change plus. Si Google corrige tardivement, ne pas garder les 2 derniers jours. |
| Message « later than » de Google | Chaîne anglaise non documentée ; un repli existe, à surveiller. |
| Journal Drive très volumineux | Plafond de 200 000 événements par compte ; filtrer par type d'événement ? |
| Courriel en cas d'échec en arrière-plan | Non fait : Google notifie déjà le propriétaire du déclencheur. |
| Essai réel | Rien n'a tourné sur un vrai domaine : lancer le diagnostic, puis un rapport sur une UO restreinte. |
