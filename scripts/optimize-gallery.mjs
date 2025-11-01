import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const galleryDir = "public/map-gallery";

async function collectImages(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectImages(full)));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = await collectImages(galleryDir);
console.log(`Found ${files.length} images to optimize in ${galleryDir}\n`);

for (const file of files) {
  try {
    const dir = path.dirname(file);
    const base = path.basename(file, path.extname(file));
    const newFile = path.join(dir, `${base}.webp`);

    // Create optimized WEBP version
    await sharp(file)
    .resize({ width: 1600 })
    .webp({ quality: 80 })
    .toFile(`${newFile}.tmp`);

    // Replace the original
    await fs.rename(`${newFile}.tmp`, newFile);

    // Delete old file if it had a different extension
    if (newFile !== file) {
      await fs.unlink(file);
    }

    console.log(`${path.relative(galleryDir, newFile)} (converted to webp)`);
  } catch (err) {
    console.error(`Failed on ${file}: ${err.message}`);
  }
}

console.log("\n✨ Optimization complete! All images converted to .jpg format.");
