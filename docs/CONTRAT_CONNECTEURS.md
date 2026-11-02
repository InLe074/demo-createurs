# Contrat de travail pour les futurs connecteurs

Ce document définit les données et garanties nécessaires. Aucun nom de méthode ou champ ci-dessous n’est présenté comme une API SiteLink réelle. Les accès et contrats devront être vérifiés avec l’éditeur et les prestataires.

## 1. Source des clients, locations et montants dus

À obtenir avec les droits de lecture autorisés :

- Identifiants stables du centre, client, contrat/location, box et facture ou poste ouvert.
- Référence de paiement associée, période, échéance, devise, montant initial et solde courant.
- Règlements déjà enregistrés et identifiants des reçus.
- Modification ou annulation d’une facture, clôture d’une location et paiements saisis par ailleurs.
- Mécanisme d’actualisation, limites d’appels, fuseaux horaires, pagination et moment de cohérence des données.

SiteLink doit rester la référence pour les locations et soldes. Un import d’encaissements ne modifie jamais silencieusement le prix ou les conditions d’un contrat.

## 2. Enregistrement d’un règlement externe déjà encaissé

Question à confirmer : peut-on enregistrer un paiement reçu en CHF, rattaché à la bonne location ou facture, sans déclencher de nouveau débit ?

Le connecteur devra recevoir ou permettre de retrouver :

- une clé d’opération stable et la référence bancaire/prestataire ;
- le centre, client, location ou poste auquel imputer le règlement ;
- montant en centimes, devise, date de réception et méthode ;
- la confirmation de l’enregistrement et un identifiant de reçu ;
- le solde courant après affectation ou un mécanisme fiable de relecture ;
- la conduite à tenir en cas de réponse perdue, rejet ou résultat incertain.

La réexécution automatique d’une écriture n’est autorisée qu’après démonstration d’un mécanisme fiable de détection des opérations déjà enregistrées. Si cette garantie n’est pas possible, les résultats incertains doivent passer en vérification manuelle. Une simple nouvelle tentative aveugle est exclue.

À confirmer : traitement des paiements partiels, trop-perçus, multi-factures, acomptes/dépôts, annulations, remboursements, monnaies, journaux comptables et périodes verrouillées.

## 3. Encaissements de la banque et des prestataires

Pour chaque source :

- propriétaire du compte, identifiant stable de compte/source et devise ;
- format/version exact, identifiants de transaction et références disponibles ;
- opérations comptabilisées versus opérations en attente ;
- distinction paiement locataire / versement net regroupé / frais / retour / remboursement ;
- modalités des lots et détail des opérations sous-jacentes ;
- disponibilité des données, jours ouvrés, latence et fenêtre d’historique ;
- canal autorisé (fichier, EBICS ou API), permissions, authentification, rotation, coûts et environnement de test.

Les références et montants de plusieurs exports d’un même encaissement devront être corrélés pour éviter le double comptage entre transaction du prestataire et versement sur le compte bancaire. Les identifiants faibles ou instables devront bloquer l’automatisation concernée.

## 4. Paiement récurrent

Le rapprochement ne prélève pas un compte. Avant tout développement d’initiation, identifier le dispositif disponible, son prestataire, la couverture des banques et pays, les devises, le consentement/mandat, les notifications, l’état final du règlement, les rejets, contestations, retours et coûts.

Les fonds sont destinés au compte d’Extra Stockage via les services convenus avec ses prestataires. Le périmètre réglementaire et contractuel reste à valider avant mise en service, notamment pour les fonctions d’initiation.

## 5. Stockage, traitements et rappels en production

- Serveur et base de données privés, transactions atomiques, montants entiers et contraintes d’unicité.
- Identités et rôles, séparation par centre/organisation, secrets côté serveur et accès minimaux.
- Historique des imports et écritures, journal des exceptions, sauvegardes et essai de restauration.
- Ordonnancement et reprise après panne, alertes sur retard d’import et indisponibilité des prestataires.
- Une seule autorité d’envoi des relances, après vérification de la fraîcheur des données et des règlements en cours.
- Politique de conservation et traitement des données définis avec le client et les prestataires.

## 6. Critères de réussite du premier essai

1. Lire un jeu de clients et de factures fictifs ou un environnement de test autorisé.
2. Rapprocher un encaissement test sur sa référence, sa devise et son montant.
3. Enregistrer une seule fois le règlement dans le système de test et relire son reçu/solde.
4. Rejouer le fichier, une tâche interrompue et une confirmation perdue sans double écriture.
5. Laisser à vérifier les paiements inconnus, devises différentes et cas ambigus.
6. Tester un règlement partiel et un paiement déjà saisi ailleurs.
7. Confirmer les frais, droits et limites avant de planifier une mise en production.
