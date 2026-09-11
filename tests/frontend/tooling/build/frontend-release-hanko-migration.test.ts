import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import { decodeHankoEnvelope } from '../../../../core/hanko/codec';
import { decodeReleaseSnapshot } from '../../../../frontend/packages/ui/src/releases/release-catalog';
import { verifyReleaseAttestation } from '../../../../frontend/packages/ui/src/releases/release-signature';
import {
  migrateReleaseAttestation,
  planReleaseHankoMigration,
} from '../../../../tools/release-snapshot/migrate-hanko-envelopes';

const oldAttestation = () => {
  const snapshot = decodeReleaseSnapshot(JSON.parse(readFileSync('docs/releases/data/0.1.31.json', 'utf8')));
  const old: unknown = JSON.parse(
    readFileSync('tests/frontend/tooling/fixtures/release-0.1.31-three-field-hanko.json', 'utf8'),
  );
  const attestation = decodeReleaseSnapshot({ schemaVersion: 1, ...snapshot, attestation: old }).attestation;
  if (!attestation) throw new Error('TEST_ATTESTATION_REQUIRED');
  return attestation;
};
const RETIRED_ABI = 'tuple(bytes32[],bytes,tuple(bytes32,uint256[],uint256[],uint256,uint32,uint32,uint32)[])';

describe('offline Foundation release Hanko migration', () => {
  test('preserves every original signed byte and claim while the live decoder rejects retired input', () => {
    const original = oldAttestation();
    expect(verifyReleaseAttestation(original)).toBe(false);
    expect(() => decodeHankoEnvelope(original.hanko)).toThrow('HANKO_ABI_DECODE_INVALID');
    const migrated = migrateReleaseAttestation(original);
    expect(verifyReleaseAttestation(migrated)).toBe(true);
    expect({ ...migrated, hanko: original.hanko }).toEqual(original);
    const decoded = decodeHankoEnvelope(migrated.hanko);
    expect(decoded.memberSignatures).toEqual([]);
    const reconstructed = ethers.AbiCoder.defaultAbiCoder().encode(
      [RETIRED_ABI],
      [
        [
          decoded.placeholders,
          decoded.packedSignatures,
          decoded.claims.map(claim => [
            claim.entityId,
            claim.entityIndexes,
            claim.weights,
            claim.threshold,
            claim.boardChangeDelay,
            claim.controlChangeDelay,
            claim.dividendChangeDelay,
          ]),
        ],
      ],
    );
    expect(reconstructed).toBe(original.hanko);
    expect(migrateReleaseAttestation(migrated)).toBe(migrated);
  });

  test('rejects changed signed payload, board authority and signer-count claims', () => {
    const original = oldAttestation();
    for (const altered of [
      { ...original, envelope: { ...original.envelope, sourceCommit: '00'.repeat(20) } },
      { ...original, board: { ...original.board, threshold: 1 } },
      { ...original, signerCount: 1 },
    ])
      expect(() => migrateReleaseAttestation(altered)).toThrow('RELEASE_MIGRATION_ATTESTATION_INVALID');
  });

  test('rejects signature corruption and noncanonical padding without repairing evidence', () => {
    const original = oldAttestation();
    const tuple: unknown = ethers.AbiCoder.defaultAbiCoder().decode([RETIRED_ABI], original.hanko)[0];
    if (!Array.isArray(tuple) || typeof tuple[1] !== 'string') throw new Error('TEST_RETIRED_TUPLE_REQUIRED');
    const packed = tuple[1];
    const corrupted = `0x${packed.slice(2, 4) === '00' ? '01' : '00'}${packed.slice(4)}`;
    expect(() =>
      migrateReleaseAttestation({ ...original, hanko: original.hanko.replace(packed.slice(2), corrupted.slice(2)) }),
    ).toThrow('RELEASE_MIGRATION_ATTESTATION_INVALID');
    expect(() => migrateReleaseAttestation({ ...original, hanko: `${original.hanko}00` })).toThrow(
      'RELEASE_MIGRATION_NON_CANONICAL_INPUT',
    );
  });

  test('preflights the complete saved catalog and all signed snapshot bindings', async () => {
    const changes = await planReleaseHankoMigration(process.cwd());
    expect(changes).toEqual([]);
  });
});
