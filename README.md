# Nocturne Runner (CJajlkPulse)

Petit jeu runner nocturne développé en HTML5 Canvas + JavaScript.

## Description
Jeu de type "lane runner" avec visuel néon, système de zones, skins débloquables via diamants, et sauvegarde de profil en local (ou via l'engine si disponible).

## Fonctionnalités principales
- Canvas 2D responsive et optimisé pour mobile
- Menu principal avec barre XP, aperçu de skin et affichage des diamants
- Système de zones (city / tunnel / space) et fond tilé sans seam
- Boutique interne pour acheter et équiper des skins (monnaie: diamants)
- Persistence du profil via `localStorage` (fichier: `js/cjplayer.js`)
- Mode basse-performance (réduit ombres/particules) détecté automatiquement

## Structure du projet
- `index.html` — page principale + menus/modals
- `css/style.css` — styles UI et responsive
- `js/` — code source
  - `game.js` — boucle principale, background, logique de run
  - `player.js`, `obstacle.js`, `bonus.js`, `main.js` — composants du jeu
  - `cjplayer.js` — gestion profil / sauvegarde / monnaies
  - `shop.js` — boutique UI & logique d'achat
- `assets/` — images et sons

## Lancer localement
Ouvrir `index.html` dans un navigateur (préférer un petit serveur local pour éviter des restrictions de fichiers). Exemples :

- Serveur Python 3 dans le dossier du projet :

```bash
python -m http.server 8000
# puis ouvrir http://localhost:8000/
```

## Notes d'optimisation mobile
- `js/game.js` détecte un `lowPerfMode` (mobile ou faible mémoire) et applique la classe CSS `lowPerf` qui supprime ombres/filtres coûteux.
- Le `canvas` utilise un `devicePixelRatio` plafonné pour éviter des résolutions trop élevées sur mobile.
- La carte du menu est scrollable sur petits écrans (`.menuCard { max-height: calc(100vh - 48px); overflow:auto }`).

## Dépannage rapide
- Si l'interface est coupée : vider le cache du navigateur ou recharger la page (Hard reload). Vérifier résolution et redimensionner la fenêtre pour tester le comportement responsive.
- Si achat/déduction de diamants ne fonctionne, vérifier la console pour erreurs et confirmer que `js/cjplayer.js` expose `addDiamonds` / `spendDiamonds` / `saveProfile`.

## Contribution
- Ouvrir une issue décrivant le bug ou la fonctionnalité demandée.
- Pour corrections rapides, modifier les fichiers sous `js/` ou `css/` et tester avec un serveur local.

## Licence
Code sans licence explicite — demander à l'auteur pour autorisations d'utilisation ou partage.

---
Fichier généré automatiquement — besoin d'un README plus détaillé ou d'EXEMPLE de build ? Dis-moi ce que tu veux ajouter.