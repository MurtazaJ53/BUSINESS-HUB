import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const repoRoot = process.cwd();
const configHome = path.join(repoRoot, '.cache');
mkdirSync(configHome, { recursive: true });
const require = createRequire(import.meta.url);
const firebaseBin = require.resolve('firebase-tools/lib/bin/firebase.js');
const vitestBin = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');

const parseJavaMajor = (versionOutput) => {
  const javaMatch = versionOutput.match(/version "(\d+)(?:\.(\d+))?/);
  return javaMatch ? Number(javaMatch[1]) : 0;
};

const appendJavaHome = (baseEnv, javaHome) => ({
  ...baseEnv,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${baseEnv.PATH || ''}`,
});

const discoverJavaHomes = () => {
  const candidates = [];

  if (process.env.JAVA_HOME && existsSync(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'))) {
    candidates.push(process.env.JAVA_HOME);
  }

  if (process.platform === 'win32') {
    const roots = [
      path.join('C:', 'Program Files', 'Microsoft'),
      path.join('C:', 'Program Files', 'Eclipse Adoptium'),
      path.join('C:', 'Program Files', 'Java'),
    ];

    for (const root of roots) {
      if (!existsSync(root)) continue;
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const javaHome = path.join(root, entry.name);
        if (existsSync(path.join(javaHome, 'bin', 'java.exe'))) {
          candidates.push(javaHome);
        }
      }
    }
  }

  return [...new Set(candidates)];
};

const resolveJavaEnv = () => {
  const currentEnv = { ...process.env };
  const currentCheck = spawnSync('java', ['-version'], {
    encoding: 'utf8',
    env: currentEnv,
  });

  if (!currentCheck.error) {
    const currentOutput = `${currentCheck.stdout || ''}\n${currentCheck.stderr || ''}`;
    if (parseJavaMajor(currentOutput) >= 21) {
      return { env: currentEnv, source: 'PATH' };
    }
  }

  for (const javaHome of discoverJavaHomes()) {
    const candidateEnv = appendJavaHome(currentEnv, javaHome);
    const candidateCheck = spawnSync('java', ['-version'], {
      encoding: 'utf8',
      env: candidateEnv,
    });
    if (candidateCheck.error) continue;
    const candidateOutput = `${candidateCheck.stdout || ''}\n${candidateCheck.stderr || ''}`;
    if (parseJavaMajor(candidateOutput) >= 21) {
      return { env: candidateEnv, source: javaHome };
    }
  }

  const detected = currentCheck.error
    ? '`java` not found'
    : `${currentCheck.stdout || ''}\n${currentCheck.stderr || ''}`.trim().split('\n')[0] || 'unknown version';
  console.error(`Firestore emulator requires Java 21+ on PATH or in a standard install location. Detected: ${detected}`);
  process.exit(1);
};

const { env: javaEnv } = resolveJavaEnv();
const rulesCommand = `"${process.execPath}" "${vitestBin}" run functions/test/rules.test.ts`;

const child = spawn(
  process.execPath,
  [
    firebaseBin,
    'emulators:exec',
    '--project',
    'business-hub-pro',
    '--only',
    'firestore',
    rulesCommand,
  ],
  {
    stdio: 'inherit',
    env: {
      ...javaEnv,
      XDG_CONFIG_HOME: configHome,
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
