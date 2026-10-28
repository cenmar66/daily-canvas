// Generates the browser-tab icon (src/app/favicon.ico + src/app/icon.svg).
// A simple shape that stays readable at 16px: a green page with a white tick.
// Run: node scripts/make-favicon.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" rx="14" fill="#5f8f6c"/>
  <path d="M18 33l9 9 19-20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
writeFileSync("src/app/icon.svg", svg);

// An .ico file can hold PNGs directly; pack 16, 32 and 48px versions.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp(Buffer.from(svg)).resize(s, s).png().toBuffer()));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...entries, ...pngs]));
console.log("wrote src/app/favicon.ico and src/app/icon.svg");
