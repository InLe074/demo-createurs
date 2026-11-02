# Chantelio · Atelier paiements

Prototype de rapprochement des paiements pour le projet suisse. Il prépare les règles métier et les écrans pendant la vérification des possibilités bancaires et SiteLink.

L’atelier accepte des données fictives ou anonymisées, en format CSV de travail. Il utilise exclusivement un connecteur SiteLink **simulé**. Aucun paiement réel, prélèvement, accès bancaire, appel Storable ou envoi de message n’est effectué.

## Ouvrir et essayer

Adresse de publication prévue : https://chantelio-paiements-lab.leines74.chatgpt.site

Le nouveau Site est privé. Le lien est destiné à la propriétaire pour cette phase de préparation.

Code : https://github.com/InLe074/demo-createurs/tree/paiements-suisse-prototype

1. Ouvrir le paiement d’Emma Laurent. La référence du scénario retrouve la facture DEMO-FACT-1001.
2. Confirmer l’affectation de CHF 180.00. La facture est réservée pour cette préparation ; aucun règlement n’est encore enregistré.
3. Cliquer sur « Simuler l’enregistrement ». Le faux connecteur renvoie un reçu et le solde devient nul dans le scénario.
4. Actualiser les dossiers. Le règlement n’est pas déduit une deuxième fois.
5. Télécharger le CSV d’exemple et l’importer avec le même compte et la même source : ses opérations sont reconnues comme doublons.
6. Regarder Camille Brun : son nom correspond à deux factures, ce qui exige une vérification manuelle.
7. Dans Connexions, essayer une réponse perdue ou un paiement saisi directement dans le système fictif.
8. Dans Rappels, vérifier les encaissements du scénario, puis préparer un brouillon. Aucun bouton d’envoi n’est présent.

## Ce qui fonctionne déjà

- Import de CSV avec BOM, séparateurs point-virgule, virgule ou tabulation, guillemets et cellules multilignes.
- Contrôles des montants, devises, dates, identifiants, colonnes et limites de fichier.
- Montants manipulés en centimes entiers.
- Normalisation des virements, QR-factures, cartes, TWINT, espèces, chèques, prélèvements déjà encaissés et autres modes.
- Distinction entre paiements clients, versements globaux de prestataires et remboursements.
- Détection des doublons et mise à l’écart des identifiants contradictoires, y compris dans un même fichier.
- Proposition d’affectation sur une référence exacte et unique. Un nom seul ne valide pas une facture.
- Affectation manuelle, paiements partiels et conservation des surplus non affectés.
- Préparations séparées des règlements enregistrés dans le système fictif.
- Vérification du solde courant par le faux connecteur, reçus fictifs et reprise après perte de confirmation.
- Actualisation d’un état source sans déduire une nouvelle fois les règlements déjà intégrés.
- Fiche par paiement, dossiers clients, vue des box en lecture seule et historique local.
- Brouillons de rappels conditionnés au solde et à la vérification des encaissements.
- Export CSV de suivi avec protection contre les formules de tableur.
- Échappement HTML des données affichées ; navigation clavier, dialogue et styles pour petits écrans.

## Format CSV de travail

Le fichier téléchargeable est `dist/examples/encaissements-multicanal.csv`. Ce n’est pas une spécification bancaire suisse ni un export SiteLink certifié.

| Colonne | Rôle |
| --- | --- |
| `transaction_id` | Identifiant stable de la transaction dans sa source ; obligatoire. |
| `date` | Date du règlement, `AAAA-MM-JJ` ou `JJ.MM.AAAA`. |
| `montant` | Montant signé, avec au maximum deux décimales. |
| `devise` | Code à trois lettres, par exemple `CHF`. |
| `moyen` | Virement, QR, carte, TWINT, espèces, chèque, prélèvement ou autre. |
| `reference` | Référence à rapprocher de la facture ; les espaces sont ignorés. |
| `client` | Nom servant à proposer des dossiers à vérifier, jamais à valider seul. |
| `type_operation` | Colonne obligatoire : `paiement`, `versement_global` ou `remboursement`. |
| `description` | Libellé libre. |

L’identifiant d’import est composé de la source, du compte et de `transaction_id`. Les identifiants du compte et de la source doivent donc rester stables. Les adaptateurs de production devront les établir à partir des systèmes autorisés, et non d’une saisie libre.

Les lignes non valides et les conflits sont explicitement exclus ; l’utilisateur confirme l’import des seules nouvelles lignes valides. Le prototype ne déduit pas qu’un versement bancaire net d’un prestataire correspond à un nouveau paiement locataire.

## Architecture

- `dist/import.js` : lecture CSV, normalisation, contrôles et export.
- `dist/domain.js` : import, rapprochement, affectations, états, rappels et scénario.
- `dist/mock-connector.js` : contrat de démonstration pour les opérations externes. Il ne reflète pas une méthode API SiteLink confirmée.
- `dist/view.js` : rendu des huit écrans et des fiches.
- `dist/app.js` : navigation, formulaires et persistance locale.
- `docs/CONTRAT_CONNECTEURS.md` : points à confirmer pour les futurs connecteurs.
- `tests/` : contrôles métier, import et rendu sans navigateur.

Aucune dépendance JavaScript externe ni compilation n’est nécessaire. Node.js 22 ou une version récente compatible suffit pour les contrôles :

```sh
npm run check
npm test
```

## Limites de cette livraison

- Les XML camt, formats propriétaires et accès EBICS/API bancaires ne sont pas encore implémentés.
- L’accès à SiteLink, l’accord tiers, les fonctions de lecture/écriture et leurs coûts restent à confirmer.
- Le faux connecteur garantit l’idempotence dans son propre contrat de test. Cette capacité devra être vérifiée et adaptée dans le raccordement réel.
- Aucun traitement quotidien côté serveur, authentification métier multiclient, base partagée, stockage documentaire ou service d’envoi n’est livré dans cette maquette statique.
- Les données sont conservées dans ce navigateur avec `localStorage`. Elles ne constituent pas un registre financier de production et ne sont pas partagées entre visiteurs.
- Le marquage « en simulation » ne prouve ni un encaissement bancaire ni un enregistrement dans SiteLink réel.
- Aucun prélèvement n’est créé. Les moyens d’encaissement récurrents, mandats, rejets et remboursements doivent être cadrés avec les prestataires.
- Les tests de rendu sans navigateur ne remplacent pas une vérification visuelle sur ordinateur et téléphone.

## Pour la prochaine étape

Obtenir le nom de la banque, les moyens de paiement et prestataires utilisés, la version de SiteLink et des exemples anonymisés cohérents (factures, encaissements, références). Vérifier ensuite les opérations autorisées avec SiteLink et les canaux de la banque avant un devis et un raccordement réel.

## Références de cadrage

- [Accord d’intégration tiers SiteLink](https://www.storable.com/privacy/sitelink-terms-of-service/), section 5.1.
- [Swiss Payment Standards](https://www.six-group.com/fr/products-services/banking-services/payment-standardization/downloads-faq/download-center.html).
- [eBill Direct Debit et sa disponibilité](https://www.ebill.ch/fr/home/business/direct-debit.html).

Les liens cadrent les vérifications à conduire ; ils ne constituent pas une validation de ce prototype par les éditeurs ou banques.
