import { EventEmitter } from 'node:events';
import { closeSync, existsSync, mkdtempSync, openSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type ProcessResult = Readonly<{
  exitCode: number | null;
  elapsedMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error: string | null;
}>;
type ProcessInput = Readonly<{
  command: string;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  input?: string;
  env?: Record<string, string | undefined>;
}>;

const OUTPUT_LIMIT = 2_000_000;

const outputSize = (path: string): number => (existsSync(path) ? statSync(path).size : 0);

const readOutput = (path: string, limit: number): string => {
  if (limit <= 0 || !existsSync(path)) return '';
  const buffer = Buffer.alloc(Math.min(outputSize(path), limit));
  const descriptor = openSync(path, 'r');
  try {
    const bytesRead = readSync(descriptor, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString();
  } finally {
    closeSync(descriptor);
  }
};

const terminateGroup = (pid: number | undefined): void => {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error;
  }
};

/** The deadline covers inherited pipes too; grandchildren cannot keep a finished child alive. */
export const runProcess = async (input: ProcessInput): Promise<ProcessResult> => {
  const started = performance.now();
  const outputDirectory = mkdtempSync(join(tmpdir(), 'xln-advisor-process-'));
  const stdoutPath = join(outputDirectory, 'stdout');
  const stderrPath = join(outputDirectory, 'stderr');
  const stdinPath = join(outputDirectory, 'stdin');
  if (input.input !== undefined) writeFileSync(stdinPath, input.input);
  const command = [input.command, ...input.args];
  const spawnOptions = {
    cwd: input.cwd,
    ...(input.env === undefined ? {} : { env: input.env }),
    detached: true,
    stdout: Bun.file(stdoutPath),
    stderr: Bun.file(stderrPath),
  } as const;
  const spawnChild = () =>
    input.input === undefined
      ? Bun.spawn(command, { ...spawnOptions, stdin: 'ignore' })
      : Bun.spawn(command, { ...spawnOptions, stdin: Bun.file(stdinPath) });
  let child: ReturnType<typeof spawnChild>;
  try {
    child = spawnChild();
  } catch {
    rmSync(outputDirectory, { recursive: true, force: true });
    return {
      exitCode: null,
      elapsedMs: Math.round(performance.now() - started),
      stdout: '',
      stderr: '',
      timedOut: false,
      error: 'spawn_failed',
    };
  }

  let error: string | null = null;
  let timedOut = false;
  const stop = (): void => terminateGroup(child.pid);
  const cancel = (): void => {
    error = 'interrupted';
    stop();
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, input.timeoutMs);
  const outputTimer = setInterval(() => {
    if (outputSize(stdoutPath) + outputSize(stderrPath) <= OUTPUT_LIMIT) return;
    error = 'output_limit';
    stop();
  }, 10);
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const exitCode = await child.exited;
  clearTimeout(timer);
  clearInterval(outputTimer);
  if (!timedOut && error !== 'interrupted' && error !== 'output_limit') stop();
  EventEmitter.prototype.removeListener.call(process, 'SIGINT', cancel);
  EventEmitter.prototype.removeListener.call(process, 'SIGTERM', cancel);
  const stdoutSize = outputSize(stdoutPath);
  const stderrSize = outputSize(stderrPath);
  if (stdoutSize + stderrSize > OUTPUT_LIMIT) error = 'output_limit';
  const stdout = readOutput(stdoutPath, OUTPUT_LIMIT);
  const stderr = readOutput(stderrPath, OUTPUT_LIMIT - Buffer.byteLength(stdout));
  rmSync(outputDirectory, { recursive: true, force: true });
  return { exitCode, elapsedMs: Math.round(performance.now() - started), stdout, stderr, timedOut, error };
};
