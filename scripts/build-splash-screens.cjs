// Renders the iOS launch images listed in web/src/lib/splash-screens.json.
// The wordmark uses Georgia, so run this on a Mac to match the committed images.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('../web/node_modules/sharp');
const screens = require('../web/src/lib/splash-screens.json');

const CREAM = '#f4f1e8';
const INK = '#23372a';
const TILE_SHARE_OF_WIDTH = 0.26;
const TILE_CENTRE_SHARE_OF_HEIGHT = 0.42;
const WORDMARK_SHARE_OF_WIDTH = 0.1;

const outputDirectory = path.join(__dirname, '../web/public/splash');
const icon = fs.readFileSync(path.join(__dirname, '../assets/images/favicon.svg'), 'utf8')
  .replace('<svg ', '<svg x="{x}" y="{y}" width="{size}" height="{size}" ');

function splashSvg(width, height) {
  const tile = Math.round(width * TILE_SHARE_OF_WIDTH);
  const x = Math.round((width - tile) / 2);
  const y = Math.round(height * TILE_CENTRE_SHARE_OF_HEIGHT - tile / 2);
  const fontSize = Math.round(width * WORDMARK_SHARE_OF_WIDTH);
  const tileSvg = icon.replace('{x}', x).replace('{y}', y).replaceAll('{size}', tile);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<rect width="100%" height="100%" fill="${CREAM}"/>
${tileSvg}
<text x="50%" y="${y + tile + fontSize * 1.4}" text-anchor="middle" font-family="Georgia, serif"
  font-size="${fontSize}" letter-spacing="${-fontSize / 60}" fill="${INK}">Rubsta Open</text>
</svg>`;
}

(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const { width, height, ratio } of screens) {
    const [pixelWidth, pixelHeight] = [width * ratio, height * ratio];
    const file = path.join(outputDirectory, `${pixelWidth}x${pixelHeight}.png`);
    await sharp(Buffer.from(splashSvg(pixelWidth, pixelHeight))).png().toFile(file);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
