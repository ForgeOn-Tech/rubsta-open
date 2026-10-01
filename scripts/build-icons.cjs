const fs = require('node:fs');
const path = require('node:path');
const sharp = require('../web/node_modules/sharp');

(async () => {
  const directory = path.join(__dirname, '../assets/images');
  const source = path.join(directory, 'favicon.svg');
  const png = await sharp(source).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(directory, 'favicon-32.png'), png);
  await sharp(source).resize(180, 180).png().toFile(path.join(directory, 'apple-touch-icon.png'));
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(directory, 'favicon.ico'), Buffer.concat([header, png]));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
