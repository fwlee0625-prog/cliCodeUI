import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
// Source assets go through Vite so browsers receive a new URL when the mark changes.
const sourceDirectory = fileURLToPath(new URL('../src/shared/assets/', import.meta.url));
const logo = await readFile(path.join(sourceDirectory, 'brand-logo.svg'));
await writeFile(path.join(publicDirectory, 'logo.svg'), logo);
await sharp(logo).resize(64, 64).png().toFile(path.join(sourceDirectory, 'brand-favicon.png'));
await writeFile(path.join(publicDirectory, 'favicon.svg'), logo);
await mkdir(path.join(publicDirectory, 'icons'), { recursive: true });
for (const size of [32, 64, 128, 256, 512]) {
  await sharp(logo).resize(size, size).png().toFile(path.join(publicDirectory, `logo-${size}.png`));
}
await sharp(logo).resize(64, 64).png().toFile(path.join(publicDirectory, 'favicon.png'));
for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
  await sharp(logo).resize(size, size).png().toFile(path.join(publicDirectory, `icons/icon-${size}x${size}.png`));
  await writeFile(path.join(publicDirectory, `icons/icon-${size}x${size}.svg`), logo);
}
console.log('CLI Code UI web, notification, and PWA icons generated from src/shared/assets/brand-logo.svg.');
