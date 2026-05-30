import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_PATH = path.join(__dirname, '../public/logo.png');

async function generateIcons() {
  console.log('🎨 Génération des icônes PWA...');

  await sharp(LOGO_PATH)
    .resize(192, 192)
    .toFile(path.join(__dirname, '../public/pwa-192.png'));

  await sharp(LOGO_PATH)
    .resize(512, 512)
    .toFile(path.join(__dirname, '../public/pwa-512.png'));

  console.log('   ✅ pwa-192.png créé');
  console.log('   ✅ pwa-512.png créé');
}

generateIcons().catch(console.error);
