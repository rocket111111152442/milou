import sharp from 'sharp';
const [,, src, out, w] = process.argv;
await sharp(src).resize({ width: +w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
