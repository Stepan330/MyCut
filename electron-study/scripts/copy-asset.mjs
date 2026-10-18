import { chmod, copyFile, readFile } from 'node:fs/promises';

// copyFile on Windows preserves a source's ReadOnly attribute. Do not touch
// source assets: only generated destinations may have their attributes changed.
export async function copyAsset(source, destination) {
  const sourceBytes = await readFile(source);
  let destinationBytes;
  try {
    destinationBytes = await readFile(destination);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (destinationBytes?.equals(sourceBytes)) return;
  if (destinationBytes) await chmod(destination, 0o666);
  await copyFile(source, destination);
  await chmod(destination, 0o666);
}
