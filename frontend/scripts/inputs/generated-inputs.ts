import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join, relative } from 'node:path';

import { safeStringify } from '../../../core/protocol/serialization';
import {
  PREPARED_GENERATED_INPUTS,
  getGeneratedInputDevelopmentConsumers,
  isCommandGeneratedInput,
  type CommandGeneratedInputDefinition,
  type GeneratedInputCopy,
  type GeneratedInputOwner,
  type PreparedGeneratedInputDefinition,
} from '../../config/generated-inputs';
import {
  assertCommandOutputs,
  assertGeneratedInputRelativePath,
  comparePaths,
  createPreparedManifest,
  toPortablePath,
  validatePreparedInput,
  walkPreparedPayload,
  type PreparedGeneratedInputManifest,
} from './generated-input-manifest';

export {
  readPreparedGeneratedInputs,
  type PreparedGeneratedInputFile,
  type PreparedGeneratedInputManifest,
  type ValidatedGeneratedInput,
} from './generated-input-manifest';

const COMMAND_OUTPUT_LIMIT = 4_000;
const SENSITIVE_ENVIRONMENT_KEY = /credential|key|mnemonic|password|secret|seed|token/i;
const COMMAND_CAPTURE_SCRIPT = String.raw`
const [requestPath, evidencePath] = process.argv.slice(1);
const command = await Bun.file(requestPath).json();
const limit = 4_000;
const collect = async (stream) => { let output = Buffer.alloc(0);
  for await (const chunk of stream) output = Buffer.concat([output, chunk]).subarray(-limit);
  return output.toString('utf8'); };
const redact = (output) => Object.entries(process.env)
  .filter(([key, value]) => /credential|key|mnemonic|password|secret|seed|token/i.test(key) && value)
  .map(([, value]) => value).sort((left, right) => right.length - left.length)
  .reduce((value, secret) => value.replaceAll(secret, '[REDACTED]'), output).slice(-limit);
try { const child = Bun.spawn(command, { cwd: process.cwd(), env: process.env, stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, collect(child.stdout), collect(child.stderr)]);
  await Bun.write(evidencePath, JSON.stringify({ exitCode, stdout: redact(stdout), stderr: redact(stderr) }));
  process.exit(exitCode === 0 ? 0 : 1);
} catch (error) { await Bun.write(evidencePath,
  JSON.stringify({ exitCode: -1, stdout: '', stderr: redact(String(error)) })); process.exit(1); }`;
type CommandEvidence = Readonly<{ exitCode: number; stdout: string; stderr: string }>;

const waitForCommandExit = (child: ChildProcess): Promise<number> =>
  new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode) => resolve(exitCode ?? -1));
  });

const redactCommandOutput = (output: string, environment: NodeJS.ProcessEnv): string => {
  const sensitiveValues = Object.entries(environment)
    .flatMap(([key, value]) => SENSITIVE_ENVIRONMENT_KEY.test(key) && value ? [value] : [])
    .sort((left, right) => right.length - left.length);
  return sensitiveValues
    .reduce((redacted, value) => redacted.replaceAll(value, '[REDACTED]'), output)
    .slice(-COMMAND_OUTPUT_LIMIT);
};

const walkSourceFiles = async (current: string): Promise<readonly string[]> => {
  const stats = await lstat(current);
  if (stats.isSymbolicLink()) throw new Error(`GENERATED_INPUT_SOURCE_SYMLINK:${current}`);
  if (stats.isFile()) return [current];
  if (!stats.isDirectory()) throw new Error(`GENERATED_INPUT_SOURCE_UNSUPPORTED:${current}`);

  const entries = await readdir(current, { withFileTypes: true });
  entries.sort(({ name: left }, { name: right }) => comparePaths(left, right));
  const files: string[] = [];
  for (const entry of entries) files.push(...await walkSourceFiles(join(current, entry.name)));
  return files;
};

const expandCopy = async (
  repositoryRoot: string,
  entry: GeneratedInputCopy,
): Promise<readonly Readonly<{ sourcePath: string; destinationPath: string }>[]> => {
  assertGeneratedInputRelativePath(entry.sourcePath, 'SOURCE_PATH');
  assertGeneratedInputRelativePath(entry.destinationPath, 'DESTINATION_PATH');
  const sourceRoot = join(repositoryRoot, entry.sourcePath);
  let files: readonly string[];
  try {
    files = await walkSourceFiles(sourceRoot);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`GENERATED_INPUT_SOURCE_MISSING:${entry.sourcePath}`);
    }
    throw error;
  }
  if (files.length === 0) throw new Error(`GENERATED_INPUT_SOURCE_EMPTY:${entry.sourcePath}`);
  const rootIsFile = files.length === 1 && files[0] === sourceRoot;
  return files.map((sourcePath) => ({
    sourcePath,
    destinationPath: rootIsFile
      ? entry.destinationPath
      : `${entry.destinationPath}/${toPortablePath(relative(sourceRoot, sourcePath))}`,
  }));
};


const pathExists = async (pathname: string): Promise<boolean> => {
  try {
    await lstat(pathname);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
};

const materializeCopies = async (
  repositoryRoot: string,
  payloadRoot: string,
  definitionId: string,
  entries: readonly GeneratedInputCopy[],
  sources: Map<string, string>,
): Promise<void> => {
  const expanded = (await Promise.all(
    entries.map((entry) => expandCopy(repositoryRoot, entry)),
  )).flat();
  expanded.sort(({ destinationPath: left }, { destinationPath: right }) => left.localeCompare(right));
  for (const file of expanded) {
    const outputPath = join(payloadRoot, file.destinationPath);
    if (sources.has(file.destinationPath) || await pathExists(outputPath)) {
      throw new Error(`GENERATED_INPUT_DESTINATION_COLLISION:${definitionId}:${file.destinationPath}`);
    }
    const bytes = await readFile(file.sourcePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes);
    sources.set(file.destinationPath, toPortablePath(relative(repositoryRoot, file.sourcePath)));
  }
};

const runGeneratedCommand = async (
  repositoryRoot: string,
  payloadRoot: string,
  definition: CommandGeneratedInputDefinition,
): Promise<void> => {
  await mkdir(payloadRoot, { recursive: true });
  const { outputPath } = definition.producer;
  if (outputPath !== undefined) assertGeneratedInputRelativePath(outputPath, 'OUTPUT_PATH');
  const commandOutput = outputPath === undefined ? payloadRoot : join(payloadRoot, outputPath);
  const [executable, ...args] = definition.producer.argv;
  if (executable === undefined) throw new Error(`GENERATED_INPUT_COMMAND_EMPTY:${definition.id}`);
  const environment = {
    ...process.env,
    ...definition.producer.environment,
    [definition.producer.outputEnvironment]: commandOutput,
  };
  const outputRoot = await mkdtemp(join(dirname(payloadRoot), '.command-output-'));
  const requestPath = join(outputRoot, 'request.json');
  const evidencePath = join(outputRoot, 'evidence.json');
  try {
    await writeFile(requestPath, JSON.stringify([
      executable === 'bun' ? process.execPath : executable,
      ...args,
    ]));
    const child = spawn(process.execPath, ['-e', COMMAND_CAPTURE_SCRIPT, requestPath, evidencePath], {
      cwd: repositoryRoot,
      env: environment,
      stdio: 'inherit',
    });
    const wrapperExitCode = await waitForCommandExit(child);
    let evidence: CommandEvidence;
    try {
      evidence = JSON.parse(await readFile(evidencePath, 'utf8')) as CommandEvidence;
    } catch (error: unknown) {
      throw new Error(`GENERATED_INPUT_CAPTURE_FAILED:${definition.id}:${wrapperExitCode}:${String(error)}`);
    }
    if (evidence.exitCode !== 0) {
      const stdout = redactCommandOutput(evidence.stdout, environment).trim();
      const stderr = redactCommandOutput(evidence.stderr, environment).trim();
      throw new Error([
        `GENERATED_INPUT_COMMAND_FAILED:${definition.id}:${evidence.exitCode}`,
        `stdout:${stdout || '<empty>'}`,
        `stderr:${stderr || '<empty>'}`,
      ].join('\n'));
    }
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
};

const prepareOne = async (
  repositoryRoot: string,
  frontendRoot: string,
  definition: PreparedGeneratedInputDefinition,
): Promise<PreparedGeneratedInputManifest> => {

  const inputsRoot = join(frontendRoot, '.artifacts', 'inputs');
  await mkdir(inputsRoot, { recursive: true });
  const temporaryRoot = await mkdtemp(join(inputsRoot, `.preparing-${definition.id}-`));
  try {
    const payloadRoot = join(temporaryRoot, 'files');
    const sources = new Map<string, string>();
    if (isCommandGeneratedInput(definition)) {
      await runGeneratedCommand(repositoryRoot, payloadRoot, definition);
      for (const pathname of await walkPreparedPayload(payloadRoot)) {
        sources.set(pathname, `command:${definition.id}`);
      }
      await materializeCopies(
        repositoryRoot,
        payloadRoot,
        definition.id,
        definition.producer.copies,
        sources,
      );
      await assertCommandOutputs(payloadRoot, definition);
    } else {
      await mkdir(payloadRoot, { recursive: true });
      await materializeCopies(
        repositoryRoot,
        payloadRoot,
        definition.id,
        definition.producer.entries,
        sources,
      );
    }
    const manifest = await createPreparedManifest(payloadRoot, definition, sources);
    await writeFile(join(temporaryRoot, 'input-manifest.json'), `${safeStringify(manifest, 2)}\n`);
    const outputRoot = join(inputsRoot, definition.id);
    await rm(outputRoot, { recursive: true, force: true });
    await rename(temporaryRoot, outputRoot);
    return manifest;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

const publishDevelopmentPublicDirectory = async (
  frontendRoot: string,
  owner: GeneratedInputOwner,
  definitions: readonly PreparedGeneratedInputDefinition[],
): Promise<void> => {
  const publicRoot = join(frontendRoot, '.artifacts', 'public');
  await mkdir(publicRoot, { recursive: true });
  const temporaryRoot = await mkdtemp(join(publicRoot, `.preparing-${owner}-`));
  try {
    const inputs = await Promise.all(definitions.map((definition) =>
      validatePreparedInput(frontendRoot, definition)));
    const destinations = new Set<string>();
    for (const file of inputs.flatMap(({ files }) => files)) {
      if (destinations.has(file.destinationPath)) {
        throw new Error(`GENERATED_INPUT_PUBLIC_COLLISION:${owner}:${file.destinationPath}`);
      }
      destinations.add(file.destinationPath);
      const outputPath = join(temporaryRoot, file.destinationPath);
      await mkdir(dirname(outputPath), { recursive: true });
      await copyFile(file.sourcePath, outputPath);
    }
    const outputRoot = join(publicRoot, owner);
    await rm(outputRoot, { recursive: true, force: true });
    await rename(temporaryRoot, outputRoot);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

export const prepareGeneratedInputs = async (
  repositoryRoot: string,
  frontendRoot: string,
  consumers: readonly GeneratedInputOwner[],
  definitions: readonly PreparedGeneratedInputDefinition[] = PREPARED_GENERATED_INPUTS,
): Promise<readonly PreparedGeneratedInputManifest[]> => {
  const selected = definitions.filter((definition) =>
    getGeneratedInputDevelopmentConsumers(definition).some((consumer) => consumers.includes(consumer)));
  const ids = selected.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error('GENERATED_INPUT_DEFINITION_DUPLICATE');
  const manifests: PreparedGeneratedInputManifest[] = [];
  for (const definition of selected) manifests.push(await prepareOne(repositoryRoot, frontendRoot, definition));
  for (const consumer of consumers) {
    const consumedDefinitions = selected.filter((definition) =>
      getGeneratedInputDevelopmentConsumers(definition).includes(consumer));
    if (consumedDefinitions.length === 0) continue;
    await publishDevelopmentPublicDirectory(
      frontendRoot,
      consumer,
      consumedDefinitions,
    );
  }
  return manifests;
};
