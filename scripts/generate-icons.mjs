/**
 * Rend TOUTES les icônes de Miss Carbook depuis DEUX sources SVG, et deux
 * seulement.
 *
 * POURQUOI CE SCRIPT REMPLACE LES DEUX PRÉCÉDENTS. `create-logo-png.js`
 * fabriquait `logo.png` depuis `public/unnamed.svg`, et `generate-maskable.mjs`
 * fabriquait le maskable depuis `public/pwa-512.png` — lequel n'était produit
 * par rien de versionné. Trois dessins coexistaient donc, et le commentaire de
 * l'ancien script le disait lui-même : « public/pwa-512.svg porte un tout autre
 * dessin » que l'icône livrée. Une modification du logo devait être répétée à
 * trois endroits, ou elle revenait au premier `npm run icons`.
 *
 * LES DEUX SOURCES, ET POURQUOI ELLES SONT DEUX :
 *  · `logo-source.svg` porte le fond `#f8fafc` — celui du `background_color`
 *    du manifeste. Il alimente tout ce qui est empaqueté en carré.
 *  · `favicon.svg` est la même marque SANS fond. Elle alimente `logo.png`,
 *    posé dans l'en-tête de l'app, qui a un thème clair ET un thème sombre :
 *    un carré clair y ferait une tache.
 *
 * LE MASKABLE NE DEMANDE AUCUN TRAITEMENT PARTICULIER. Le point le plus
 * extérieur de la marque — la pointe basse de l'écu, contour compris — tombe à
 * 25,2 unités du centre sur une grille de 64, soit 78,75 % du rayon. La zone
 * sûre d'Android est un disque de 80 %. Le rendu direct tient donc dedans, et
 * c'est délibéré : l'écu a été calé à 0,79 pour cette raison.
 *
 * Exécuter : npm run icons
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(racine, 'public');

/**
 * UNE SEULE SOURCE, et c'est celle qui est aussi SERVIE.
 *
 * Il y en a eu deux un instant — une transparente, une avec le fond clair déjà
 * peint dedans. La seconde était redondante : `flatten` compose exactement ce
 * rectangle sous la marque. Et elle partait dans `dist/`, servie pour rien.
 *
 * Les deux rendus ne sont pas identiques au BIT près — les empreintes SHA
 * diffèrent — mais les aplats le sont : fond `248,250,252`, écu `15,118,110`,
 * carrosserie `255,255,255`, relevés au pixel. L'écart tient à l'ordre de
 * composition de l'anticrénelage : librsvg mélange contre un rectangle pendant
 * la rastérisation, `flatten` mélange après. Invisible, et sans conséquence.
 */
const SOURCE = 'favicon.svg';

/** Le `background_color` du manifeste — icône et écran de démarrage assortis. */
const FOND = '#f8fafc';

/**
 * `opaque: true` aplatit le canal alpha sur le fond.
 *
 * iOS ignore la transparence de `apple-touch-icon` et compose sur du NOIR :
 * une marque claire à fond transparent arriverait cernée de sombre sur l'écran
 * d'accueil. Les sources carrées portent déjà leur fond, l'aplatissement n'est
 * donc qu'une ceinture — mais elle ne coûte rien et garantit le résultat si la
 * source change un jour.
 */
const RENDUS = [
  { sortie: 'pwa-192.png', taille: 192, opaque: true },
  { sortie: 'pwa-512.png', taille: 512, opaque: true },
  { sortie: 'pwa-maskable-512.png', taille: 512, opaque: true },
  { sortie: 'apple-touch-icon.png', taille: 180, opaque: true },
  { sortie: 'logo.png', taille: 192, opaque: false },
];

for (const { sortie, taille, opaque } of RENDUS) {
  let pipeline = sharp(join(publicDir, SOURCE), { density: 384 }).resize(
    taille,
    taille,
    {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }
  );
  if (opaque) pipeline = pipeline.flatten({ background: FOND });
  await pipeline.png().toFile(join(publicDir, sortie));
  console.log(
    `  ✓ ${sortie} (${taille}×${taille}, ${opaque ? 'opaque' : 'alpha'})`
  );
}

console.log(`Icônes régénérées depuis ${SOURCE}.`);
