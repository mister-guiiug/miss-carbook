import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAR_SVG_PATH = path.join(__dirname, '../public/unnamed.svg');
const OUTPUT_PATH = path.join(__dirname, '../public/logo.png');
const SIZE = 192;

const GRADIENT_COLORS = {
  start: '#0f766e',
  middle: '#0d9488',
  end: '#0891b2'
};

async function createLogo() {
  console.log('🚗 Création du logo PNG...');

  try {
    // 1. Lire le SVG et l'extraire en PNG sans crop
    console.log('   ↓ Conversion SVG → PNG...');
    const carPngBuffer = await sharp(CAR_SVG_PATH)
      .resize(SIZE, SIZE, {
        fit: 'contain',  // Contain pour ne pas croper
        withoutEnlargement: false
      })
      .toBuffer();

    // 2. Rendre le fond noir transparent
    const carMasked = await sharp(carPngBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = carMasked;
    const maskedData = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

      if (brightness > 50) {
        maskedData[i] = 255;
        maskedData[i + 1] = 255;
        maskedData[i + 2] = 255;
        maskedData[i + 3] = brightness > 240 ? 255 : Math.min(255, brightness * 2);
      } else {
        maskedData[i] = 0;
        maskedData[i + 1] = 0;
        maskedData[i + 2] = 0;
        maskedData[i + 3] = 0;
      }
    }

    const carTransparent = await sharp(maskedData, {
      raw: info
    }).png().toBuffer();

    // 3. Créer le fond dégradé avec coins arrondis
    const cornerRadius = 48;

    const gradientSvg = `
      <svg width="${SIZE}" height="${SIZE}">
        <defs>
          <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${GRADIENT_COLORS.start}"/>
            <stop offset="50%" stop-color="${GRADIENT_COLORS.middle}"/>
            <stop offset="100%" stop-color="${GRADIENT_COLORS.end}"/>
          </linearGradient>
          <clipPath id="rounded-corners">
            <rect width="${SIZE}" height="${SIZE}" rx="${cornerRadius}"/>
          </clipPath>
        </defs>
        <rect width="${SIZE}" height="${SIZE}" fill="url(#bg-grad)" clip-path="url(#rounded-corners)"/>
      </svg>
    `;

    const background = await sharp(Buffer.from(gradientSvg)).png().toBuffer();

    // 4. Ajouter l'effet de brillance
    const highlightSvg = `
      <svg width="${SIZE}" height="${SIZE}">
        <defs>
          <linearGradient id="hi-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="white" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="white" stop-opacity="0"/>
          </linearGradient>
          <clipPath id="rounded-corners-2">
            <rect width="${SIZE}" height="${SIZE}" rx="${cornerRadius}"/>
          </clipPath>
        </defs>
        <rect width="${SIZE}" height="${SIZE}" fill="url(#hi-grad)" clip-path="url(#rounded-corners-2)"/>
      </svg>
    `;

    const highlight = await sharp(Buffer.from(highlightSvg)).png().toBuffer();

    // 5. Combiner le tout
    await sharp(background)
      .composite([
        { input: highlight, blend: 'over' },
        { input: carTransparent, gravity: 'center', blend: 'over' }
      ])
      .png()
      .toFile(OUTPUT_PATH);

    console.log(`   ✅ Logo créé : ${OUTPUT_PATH}`);
    console.log(`   📐 Taille : ${SIZE}x${SIZE}px`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

createLogo().catch(console.error);
