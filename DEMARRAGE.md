# Démarrage

Prérequis : un compte administrateur Google Workspace avec le privilège **Rapports**.

## 1. Installer

1. Créez un classeur Google Sheets, puis **Extensions > Apps Script** (le projet doit être lié au classeur).
2. Supprimez le `Code.gs` par défaut.
3. Recréez chaque fichier de `apps-script/` sous le même nom (**+ > Script**) et collez son contenu.
4. **Paramètres du projet** : cochez « Afficher le fichier manifeste », puis collez `appsscript.json`.
5. Vérifiez que le fuseau est **Europe/Paris** dans le projet *et* dans le classeur (*Fichier > Paramètres*).

> ⚠️ **Mise à jour d'un ancien projet** : supprimez l'ancien `Code.gs`, sinon plus rien ne se charge.

## 2. Premier lancement

1. Rechargez le classeur : le menu **Rapport d'activité** apparaît.
2. **Générer le rapport** : autorisez les [portées demandées](README.md#portées-demandées).
3. Il échoue avec « Aucune adresse valide » : normal, il vient de créer les onglets **Comptes** et **Paramètres**.

## 3. Saisir les comptes

Onglet **Comptes**, colonne A, une adresse par ligne à partir de la ligne 2.

**Diagnostiquer les comptes** montre ce que Google répond pour chacun, sans rien écrire. Un groupe ou un alias apparaît « ❔ Absent ».

## 4. Régler (facultatif)

| Réglage (onglet Paramètres) | Utilité |
|---|---|
| Unité organisationnelle | Sur un grand domaine, accélère fortement le rapport. |
| Jours d'historique | Fenêtre longue des cumuls (30 par défaut). |
| Langue de l'interface | Menu et fenêtres en français ou en anglais, si la détection automatique se trompe. Rouvrez le classeur. |

## 5. Programmer (facultatif)

Menu **Programmer le rapport hebdomadaire** : le rapport se génère seul, au jour et à l'heure de l'onglet **Paramètres**.

> ⚠️ Il tourne sous **votre** identité. Réservez la modification du classeur aux administrateurs : un éditeur pourrait modifier le script et agir avec vos droits.

Après avoir changé le jour ou l'heure, choisissez de nouveau **Programmer**.

## 6. Lire la synthèse

| Où | Ce que ça dit |
|---|---|
| Ligne 1 | Date d'arrêt des compteurs (2 à 3 jours de retard chez Google), date de génération, version. |
| Ligne 2 | Ce qui n'a pas pu être mesuré ; « ✅ » si tout est chargé. |
| En-têtes | Survolez-les : la note dit d'où vient le chiffre. |
| Cellule vide | Non mesuré, jamais zéro. |

## En cas de souci

| Situation | Que faire |
|---|---|
| Premier rapport long | Rien : il s'interrompt et reprend seul chaque minute. Vous pouvez fermer le classeur. |
| Rapport qui semble bloqué | Relancez **Générer le rapport** : il reprend, ou vous dit qu'il tourne encore. |
| Repartir de zéro | **Abandonner le rapport en cours**, puis relancez. |
| Échec en arrière-plan | Le motif s'affiche en ligne 1 de **Synthèse** ; Google envoie aussi un courriel. |

L'onglet masqué `_cache_usage` est le cache des jours déjà chargés : ne le modifiez pas.
