import { describe, expect, it } from 'vitest';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('../../packages/cli/bin/peel.mjs', import.meta.url));

const validPeel = `[P] Community festivals strengthen social cohesion.
[E1] Repeated shared activities create trust between neighbours who rarely meet.
[E2] A parent cooks a traditional dish with family members at a neighbourhood festival.
[L] Therefore, community festivals strengthen social cohesion.`;

async function runCli(args, input) {
  try {
    const { stdout } = await run(process.execPath, [CLI, ...args], {
      input,
      maxBuffer: 1024 * 1024,
    });
    return { exitCode: 0, stdout };
  } catch (error) {
    return { exitCode: error.code || 1, stdout: error.stdout || '' };
  }
}

describe('peel-hacker CLI', () => {
  it('classify prints the topic as JSON', async () => {
    const { exitCode, stdout } = await runCli([
      'classify',
      'Some people believe schools should receive more public investment than teachers.',
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.topicId).toBe('Education');
  });

  it('review exits 0 and ok:true for a valid PEEL', async () => {
    const { exitCode, stdout } = await runCli(['review', '--prompt', 'community change', validPeel]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.checks.semanticQuality).toBe('pass');
  });

  it('review exits 1 and reports semantic issues for an absurd PEEL', async () => {
    const absurd = `[P] Cats improve democracy.
[E1] Their whiskers make public institutions more accountable.
[E2] Students place paper ballots beside classroom whiteboards.
[L] Therefore, cats improve democracy.`;
    const { exitCode, stdout } = await runCli(['review', absurd]);
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.some((issue) => issue.code === 'P_TOPIC_ANCHOR')).toBe(true);
  });

  it('review reads PEEL text from stdin with "-"', async () => {
    const child = spawn(process.execPath, [CLI, 'review', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    const closed = new Promise((resolve) => child.on('close', resolve));
    child.stdin.write(validPeel);
    child.stdin.end();
    const exitCode = await closed;
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout).ok).toBe(true);
  });
});
