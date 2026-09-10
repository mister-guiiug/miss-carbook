/**
 * Rend l'icône maskable depuis public/pwa-512.png.
 *
 * POURQUOI UNE IMAGE SÉPARÉE. `pwa-512.png` était déclaré `any maskable` : la
 * même image servait au navigateur, qui la montre telle quelle, et à Android,
 * qui la rogne à son masque. Or c'est une TUILE ARRONDIE sur fond clair — le
 * masque lui coupait les coins, et le clair faisait un liseré autour du vert.
 *
 * POURQUOI PAS DEPUIS LE SVG. `public/pwa-512.svg` existe, mais ce n'est PAS
 * la source de `pwa-512.png` : il porte un tout autre dessin — une voiture
 * pleine surmontée d'un signet, là où l'icône livrée est une voiture au trait,
 * sans signet. Partir du SVG aurait changé l'identité de l'application au
 * lieu de réparer son maskable.
 *
 * COMMENT. La toile est remplie en entier par l'illustration elle-même : un
 * carré pris au centre de la tuile, agrandi et fondu. Pas de clair dedans, et
 * ses couleurs sont celles de la tuile posée par-dessus — le raccord n'a rien
 * à cacher. La tuile occupe 88 % de la toile : ses coins arrondis se fondent
 * dans le fond, et le dessin tient dans la zone de sécurité, le disque de
 * 80 %.
 *
 * Exécuter : npm run icons
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'pwa-512.png');
const sortie = join(root, 'public', 'pwa-maskable-512.png');

const tuile = await sharp(source).trim().png().toBuffer();
const { width } = await sharp(tuile).metadata();

// LE FOND EST UN DÉGRADÉ DE QUATRE POINTS, PAS UN FLOU DE L'IMAGE.
// Premier essai : le centre de la tuile, agrandi et fondu. Raté — le centre
// de cette tuile, c'est la VOITURE BLANCHE, et le fond sortait blanchâtre :
// un halo clair tout autour, le liseré qu'on venait supprimer. On échantillonne
// donc les quatre coins INTÉRIEURS de la tuile, à 12 % du bord, là où il n'y a
// que le dégradé. Ces quatre pixels forment une image 2×2 que sharp étire à
// 512 en interpolant : on retrouve le dégradé diagonal de la tuile, donc la
// teinte juste sous chacun de ses coins arrondis.
const coin = async (fx, fy) => {
  const { data } = await sharp(tuile)
    .extract({
      left: Math.round(width * fx),
      top: Math.round(width * fy),
      width: 8,
      height: 8,
    })
    .resize(1, 1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
};
const coins = [
  await coin(0.12, 0.12),
  await coin(0.86, 0.12),
  await coin(0.12, 0.86),
  await coin(0.86, 0.86),
];
const fond = await sharp(Buffer.from(coins.flat()), {
  raw: { width: 2, height: 2, channels: 3 },
})
  .resize(512, 512, { fit: 'fill', kernel: 'cubic' })
  .png()
  .toBuffer();

const dessus = await sharp(tuile)
  .resize(448, 448, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

await sharp(fond)
  .composite([{ input: dessus, top: 32, left: 32 }])
  .png()
  .toFile(sortie);

console.log('public/pwa-maskable-512.png écrit (512×512, maskable).');
