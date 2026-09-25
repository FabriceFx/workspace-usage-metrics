# Démarrage

Ce guide prend l'installation depuis un classeur vide. Il faut un compte
administrateur Google Workspace disposant du privilège **Rapports**.

## 1. Créer le projet

1. Créez un classeur Google Sheets.
2. **Extensions > Apps Script.** Le projet créé ainsi est *lié* au classeur :
   c'est indispensable, le menu en dépend.
3. Supprimez le fichier `Code.gs` proposé par défaut.
4. Recréez chaque fichier de `apps-script/` (bouton **+ > Script**), sous le
   même nom et sans l'extension, et collez-y son contenu.
5. **Paramètres du projet** (roue dentée) : cochez « Afficher le fichier
   manifeste `appsscript.json` », puis remplacez son contenu par celui du dépôt.
   C'est lui qui active le service avancé *Admin SDK Reports* et déclare les
   portées.
6. Vérifiez dans le même écran que le fuseau est **Europe/Paris**, et dans
   *Fichier > Paramètres* du classeur que le fuseau est le même. Un écart
   décale les dates d'un jour autour de minuit.

> **Si vous mettez à jour un projet existant**, supprimez l'ancien `Code.gs` :
> il déclare `CONFIG` comme `Metrique.gs`, et deux déclarations du même nom
> empêchent **tout** le projet de se charger — toutes les fonctions deviennent
> « introuvables », menu compris.

## 2. Premier lancement

1. Rechargez le classeur. Le menu **Rapport d'activité** apparaît.
2. Choisissez **Générer le rapport**. Google demande d'autoriser les portées ;
   la liste et leur raison d'être sont dans le [README](README.md#portées-demandées).
3. Ce premier lancement échoue avec « Aucune adresse valide dans l'onglet
   Comptes » : c'est attendu, il vient de créer les onglets **Comptes** et
   **Paramètres**.

## 3. Saisir les comptes

Dans l'onglet **Comptes**, une adresse par ligne en colonne A, à partir de la
ligne 2. Les doublons et les lignes qui ne sont pas des adresses sont ignorés ;
la casse n'a pas d'importance.

Un groupe ou un alias n'a pas de rapport d'usage : il apparaîtra
« ❔ Absent du rapport d'usage ». **Diagnostiquer les comptes** dit, compte par
compte, ce que Google répond — sans rien écrire.

## 4. Régler (facultatif)

L'onglet **Paramètres** porte une explication par ligne. Les plus utiles :

- **Unité organisationnelle** : sur un grand domaine, renseigner l'UO qui
  contient les comptes suivis divise d'autant la durée du rapport ;
- **Jours d'historique** : la fenêtre longue des cumuls (30 par défaut).

Une valeur invalide est refusée au lancement suivant, avec ce qu'il faut saisir.

## 5. Lire la synthèse

- **Ligne 1** : la date à laquelle s'arrêtent les compteurs (Google les publie
  avec 2 à 3 jours de décalage), la date de génération et la version.
- **Ligne 2** : ce qui n'a pas pu être mesuré. « ✅ » si tout a été chargé.
  Un jour listé ici est **exclu** des cumuls, pas compté à zéro.
- **Survolez un en-tête** : sa note dit d'où vient le chiffre.
- Une cellule vide veut dire « non mesuré », jamais zéro.

## Si le rapport est long

Sur un grand domaine, le premier rapport peut prendre plusieurs minutes. Il
s'interrompt de lui-même avant le plafond de six minutes et reprend seul une
minute plus tard : un message l'annonce, et la synthèse est mise à jour à la
fin. Vous pouvez fermer le classeur entre-temps.

Les rapports suivants sont bien plus courts : les jours déjà chargés sont en
cache (onglet masqué `_cache_usage`, à ne pas modifier).

- **Un rapport semble bloqué ?** Relancez **Générer le rapport** : s'il est
  réellement interrompu, il reprend ; s'il tourne encore, un message le dit.
- **Repartir de zéro ?** **Abandonner le rapport en cours**, puis relancez.
- **Un échec en arrière-plan** s'affiche en tête de l'onglet Synthèse, avec
  ce qu'il faut faire ; Google en envoie aussi la notification par courriel.
