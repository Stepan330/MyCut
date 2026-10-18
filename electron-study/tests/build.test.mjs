import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { copyAsset } from '../scripts/copy-asset.mjs';

test('read-only assets support first build, repeated build and changed content', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mycut-copy-test-'));
  const source = path.join(directory, 'source.txt');
  const destination = path.join(directory, 'generated.txt');
  try {
    await writeFile(source, 'license v1');
    await chmod(source, 0o444);
    await copyAsset(source, destination);
    // Reproduce an output left by the previous build script.
    await chmod(destination, 0o444);
    await copyAsset(source, destination);
    assert.equal(await readFile(destination, 'utf8'), 'license v1');
    await chmod(source, 0o666);
    await writeFile(source, 'license v2');
    await chmod(source, 0o444);
    await copyAsset(source, destination);
    assert.equal(await readFile(destination, 'utf8'), 'license v2');
    await copyAsset(source, destination);
  } finally {
    for (const file of [source, destination]) await chmod(file, 0o666).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
