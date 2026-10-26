# Chantelio Box

Démonstration interactive d’un logiciel pour les centres de stockage indépendants, pensée pour présenter un parcours complet du premier contact à l’entrée dans le box.

## Découvrir

- `#/apercu` : espace gérant et priorités du jour.
- `#/presentation` : présentation du produit et du parcours client.
- `#/client` : parcours d’un locataire fictif.
- `#/reserver` : choix d’un box libre et création d’une demande.
- `#/guide` : visite guidée et cadre de la démonstration.

Le centre de démonstration est situé à Lausanne (CHF, 48 box). Les sociétés, clients, coordonnées, documents, montants et événements sont fictifs. Le scénario est daté du 26 octobre 2026.

## Fonctionnalités testables

- Tableau de bord : occupation, disponibilités, loyers, échéances et dossiers à débloquer.
- Réservations par étape ou en liste, avec recherche et export CSV.
- Attribution d’un box disponible et protection contre une double réservation.
- Plan d’état des box, fiches, filtres de surface, création d’un box et maintenance.
- Dossiers clients, notes internes et historique des locations.
- Réception de pièces fictives puis vérification distincte par le gérant.
- Exemple de contrat téléchargeable et signature explicitement simulée.
- Premier loyer et dépôt présentés séparément.
- Confirmation d’entrée conditionnée à un dossier vérifié, un contrat signé et un premier règlement reçu.
- Factures, échéances, règlements partiels, soldes recalculés et reçus fictifs.
- Planification d’une sortie et clôture de location avec conservation des factures.
- Brouillons de relance, règles activables et simulation d’exécution sans envoi.
- Analyses : étapes des demandes, surfaces libres, revenus potentiels et calculateur de temps à hypothèses modifiables.
- Recherche globale, visite guidée, FAQ, paramètres et réinitialisation.
- Parcours client relié aux mêmes données locales que l’espace gérant.
- Navigation adaptée aux petits écrans, libellés de formulaires, navigation au clavier et modales fermables avec Échap.

## Portée

Cette version est une démonstration locale au navigateur, publiable sur GitHub Pages. Les modifications utilisent `localStorage` et sont propres au navigateur du visiteur. Elles ne sont pas partagées avec les autres visiteurs. Une fenêtre privée ou une réinitialisation permet de repartir du scénario d’origine.

**Aucun email réel, aucune transaction financière et aucune signature contractuelle ne sont déclenchés.** Aucun document personnel ni numéro de carte bancaire n’est nécessaire. Les exemples téléchargeables portent une mention de démonstration.

Le dépôt illustratif est un paramètre fictif du centre et ne représente pas une règle juridique suisse.

## Architecture

`index.html`, `styles.css`, `app.js`, `model.js` et `favicon.svg` sont les fichiers nécessaires à l’application. Aucun outil de compilation ni dépendance JavaScript n’est nécessaire à l’exécution. Les typographies distantes ont des polices système de remplacement.

- `app.js` : écrans, navigation, formulaires et interactions.
- `model.js` : données fictives, transitions d’état, vérifications et calculs.
- `styles.css` : interface responsive et styles d’impression.
- `tests/` : tests métier et contrôles de rendu sans navigateur.

Les fichiers d’exécution sont dans `dist/` dans le checkout de travail et sont publiés directement à la racine du dossier `box/` dans GitHub Pages.

## Vérification

Dans le dossier publié `box/`, avec Node.js :

```sh
npm test
npm run check
```

Les contrôles couvrent 17 tests : cohérence des dossiers du centre et des montants en CHF, réservation exclusive, dates, vérification des pièces, activation conditionnelle, paiements partiels, clôture sans perte de factures, persistance et corruption du stockage, exports CSV, règles, rendu des 14 écrans, fenêtres et filtres.

Les tests de rendu utilisent un harnais DOM minimal et ne remplacent pas une vérification visuelle dans un vrai navigateur. L’aperçu navigateur de l’environnement de construction était indisponible lors de cette livraison.

## Pour un usage réel

Une mise en production avec de vrais clients nécessite notamment une authentification, une séparation des données de chaque centre, une base de données et un stockage documentaire sécurisés, les intégrations de messagerie, signature et paiement, ainsi que des modèles et paramètres adaptés à chaque centre et à son pays. Aucun secret ni identifiant de service n’est inclus dans ce dépôt.
