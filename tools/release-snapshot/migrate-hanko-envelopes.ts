/** Offline data migration only. The live verifier continues to reject retired ABI envelopes. */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ethers } from 'ethers';
import { buffersEqual, safeStringify } from '../../core/protocol/serialization';
import { decodeReleaseManifest, decodeReleaseSnapshot } from '../../frontend/packages/ui/src/releases/release-catalog';
import {
  verifyReleaseAttestation,
  verifyReleaseManifestPolicy,
  verifyReleaseManifestSnapshotBinding,
  type ReleaseAttestation,
} from '../../frontend/packages/ui/src/releases/release-signature';

const RETIRED_ABI = 'tuple(bytes32[],bytes,tuple(bytes32,uint256[],uint256[],uint256,uint32,uint32,uint32)[])';
const CURRENT_ABI = 'tuple(bytes32[],bytes,tuple(bytes32,uint256[],uint256[],uint256,uint32,uint32,uint32)[],bytes[])';
const coder = ethers.AbiCoder.defaultAbiCoder();

export const migrateReleaseAttestation = (attestation: ReleaseAttestation): ReleaseAttestation => {
  if (verifyReleaseAttestation(attestation)) return attestation;
  const tuple: unknown = coder.decode([RETIRED_ABI], attestation.hanko)[0];
  if (!Array.isArray(tuple) || tuple.length !== 3 || coder.encode([RETIRED_ABI], [tuple]) !== attestation.hanko)
    throw new Error('RELEASE_MIGRATION_NON_CANONICAL_INPUT');
  // The original EOA signatures authorize the unchanged envelope digest and board.
  // No signer, threshold, nonce/domain or source-root substitution is permitted:
  // self-signed boards and corrupted proofs must fail the existing trust anchor.
  const migrated = { ...attestation, hanko: coder.encode([CURRENT_ABI], [[...tuple, []]]) };
  if (!verifyReleaseAttestation(migrated)) throw new Error('RELEASE_MIGRATION_ATTESTATION_INVALID');
  return migrated;
};

type FileChange = Readonly<{ path: string; before: string; after: string }>;
const requireAttestation = (value: ReleaseAttestation | undefined): ReleaseAttestation => {
  if (!value) throw new Error('RELEASE_MIGRATION_ATTESTATION_REQUIRED');
  return value;
};
const replaceHanko = (source: string, before: string, after: string): string => {
  const needle = JSON.stringify(before);
  if (source.split(needle).length !== 2) throw new Error('RELEASE_MIGRATION_HANKO_OCCURRENCE_INVALID');
  return source.replace(needle, JSON.stringify(after));
};

export const planReleaseHankoMigration = async (root: string): Promise<readonly FileChange[]> => {
  const path = resolve(root, 'docs/releases/manifest.json');
  const before = await readFile(path, 'utf8');
  const manifest = decodeReleaseManifest(JSON.parse(before));
  let after = before;
  const changes: FileChange[] = [];
  const releases = [];
  for (const entry of manifest.releases) {
    if (!/^\d+\.\d+\.\d+$/.test(entry.version)) throw new Error('RELEASE_MIGRATION_VERSION_INVALID');
    const attestation = migrateReleaseAttestation(requireAttestation(entry.attestation));
    const migratedEntry = { ...entry, attestation };
    const snapshotPath = resolve(root, `docs/releases/data/${entry.version}.json`);
    const snapshotBefore = await readFile(snapshotPath, 'utf8');
    const snapshot = decodeReleaseSnapshot(JSON.parse(snapshotBefore));
    const snapshotAttestation = migrateReleaseAttestation(requireAttestation(snapshot.attestation));
    const migratedSnapshot = { ...snapshot, attestation: snapshotAttestation };
    if (
      safeStringify(attestation) !== safeStringify(snapshotAttestation) ||
      !verifyReleaseManifestSnapshotBinding(migratedEntry, migratedSnapshot)
    )
      throw new Error(`RELEASE_MIGRATION_SNAPSHOT_BINDING_INVALID:${entry.version}`);
    const snapshotAfter = replaceHanko(
      snapshotBefore,
      requireAttestation(snapshot.attestation).hanko,
      snapshotAttestation.hanko,
    );
    if (snapshotAfter !== snapshotBefore)
      changes.push({ path: snapshotPath, before: snapshotBefore, after: snapshotAfter });
    after = replaceHanko(after, requireAttestation(entry.attestation).hanko, attestation.hanko);
    releases.push(migratedEntry);
  }
  if (!verifyReleaseManifestPolicy({ ...manifest, releases }, undefined, manifest.latest))
    throw new Error('RELEASE_MIGRATION_POLICY_INVALID');
  if (after !== before) changes.push({ path, before, after });
  return changes;
};

const run = async (): Promise<void> => {
  const [root, mode, ...extra] = Bun.argv.slice(2);
  if (!root || !['--check', '--write'].includes(mode ?? '') || extra.length)
    throw new Error('Usage: bun tools/release-snapshot/migrate-hanko-envelopes.ts <repository-root> --check|--write');
  const changes = await planReleaseHankoMigration(resolve(root));
  if (mode === '--write') {
    // Validate the complete catalog first; refuse concurrent edits before writing.
    for (const change of changes)
      if (!buffersEqual(await readFile(change.path), Buffer.from(change.before)))
        throw new Error(`RELEASE_MIGRATION_SOURCE_CHANGED:${change.path}`);
    for (const change of changes) {
      const staging = `${change.path}.migrating`;
      await writeFile(staging, change.after, { flag: 'wx' });
      await rename(staging, change.path);
    }
    if ((await planReleaseHankoMigration(resolve(root))).length !== 0)
      throw new Error('RELEASE_MIGRATION_POSTCHECK_FAILED');
  }
  console.info(`RELEASE_HANKO_MIGRATION mode=${mode} files=${changes.length} verified=true`);
};
if (import.meta.main) await run();
