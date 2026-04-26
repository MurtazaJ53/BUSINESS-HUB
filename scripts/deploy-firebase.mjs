import fs from 'node:fs/promises';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash, createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serviceAccountPath = path.join(rootDir, 'service-account.json');
const firebaseJsonPath = path.join(rootDir, 'firebase.json');
const envPath = path.join(rootDir, '.env');
const firestoreRulesPath = path.join(rootDir, 'firestore.rules');
const storageRulesPath = path.join(rootDir, 'storage.rules');
const distDir = path.join(rootDir, 'dist');

const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));
const firebaseConfig = JSON.parse(await fs.readFile(firebaseJsonPath, 'utf8'));
const envFile = await fs.readFile(envPath, 'utf8');

const env = Object.fromEntries(
  envFile
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1)];
    }),
);

const projectId = serviceAccount.project_id;
const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET;
const siteId = projectId;

if (!storageBucket) {
  throw new Error('VITE_FIREBASE_STORAGE_BUCKET is missing from .env');
}

initializeApp({
  credential: cert(serviceAccount),
  projectId,
  storageBucket,
});

const rules = getSecurityRules();

const log = (msg) => process.stdout.write(`${msg}\n`);

const base64Url = (value) => Buffer.from(value).toString('base64url');

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
  };

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key).toString('base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  return json.access_token;
}

function toHeadersMap(entries = []) {
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
}

function normalizeHostingConfig(hostingConfig) {
  const config = {};

  if (Array.isArray(hostingConfig.headers)) {
    config.headers = hostingConfig.headers.map((header) => ({
      ...(header.source ? { glob: header.source } : {}),
      ...(header.regex ? { regex: header.regex } : {}),
      headers: toHeadersMap(header.headers),
    }));
  }

  if (Array.isArray(hostingConfig.redirects)) {
    config.redirects = hostingConfig.redirects.map((redirect) => ({
      ...(redirect.source ? { glob: redirect.source } : {}),
      ...(redirect.regex ? { regex: redirect.regex } : {}),
      location: redirect.destination,
      statusCode: redirect.type,
    }));
  }

  if (Array.isArray(hostingConfig.rewrites)) {
    config.rewrites = hostingConfig.rewrites.map((rewrite) => ({
      ...(rewrite.source ? { glob: rewrite.source } : {}),
      ...(rewrite.regex ? { regex: rewrite.regex } : {}),
      ...(rewrite.destination ? { path: rewrite.destination } : {}),
      ...(rewrite.function ? { function: rewrite.function } : {}),
      ...(rewrite.run ? { run: rewrite.run } : {}),
    }));
  }

  if (typeof hostingConfig.cleanUrls === 'boolean') {
    config.cleanUrls = hostingConfig.cleanUrls;
  }

  if (typeof hostingConfig.trailingSlash === 'boolean') {
    config.trailingSlashBehavior = hostingConfig.trailingSlash ? 'ADD' : 'REMOVE';
  }

  return config;
}

async function gzipBuffer(buffer) {
  const chunks = [];
  await pipeline(
    Readable.from(buffer),
    createGzip(),
    async function* (source) {
      for await (const chunk of source) {
        chunks.push(Buffer.from(chunk));
      }
    },
  );
  return Buffer.concat(chunks);
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function prepareHostingFiles() {
  const files = await walk(distDir);
  const mapping = new Map();
  for (const filePath of files) {
    const relativePath = path.relative(distDir, filePath).split(path.sep).join('/');
    const routePath = `/${relativePath}`;
    const contents = await fs.readFile(filePath);
    const gzipped = await gzipBuffer(contents);
    const hash = createHash('sha256').update(gzipped).digest('hex');
    mapping.set(routePath, { hash, gzipped });
  }
  return mapping;
}

async function apiRequest(url, accessToken, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function deployHosting(accessToken) {
  const hostingConfig = normalizeHostingConfig(firebaseConfig.hosting);
  const preparedFiles = await prepareHostingFiles();
  const fileMap = Object.fromEntries(
    Array.from(preparedFiles.entries()).map(([routePath, data]) => [routePath, data.hash]),
  );

  log(`Preparing Hosting version with ${preparedFiles.size} files...`);

  const createVersion = await apiRequest(
    `https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/versions`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ config: hostingConfig }),
    },
  );

  const versionName = createVersion.name;
  const populate = await apiRequest(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ files: fileMap }),
    },
  );

  const requiredHashes = new Set(populate.uploadRequiredHashes || []);
  const uploadUrl = populate.uploadUrl;

  for (const [routePath, data] of preparedFiles.entries()) {
    if (!requiredHashes.has(data.hash)) continue;
    log(`Uploading ${routePath}...`);
    const response = await fetch(`${uploadUrl}/${data.hash}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: data.gzipped,
    });
    if (!response.ok) {
      throw new Error(`Upload failed for ${routePath}: ${response.status} ${await response.text()}`);
    }
  }

  await apiRequest(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}?update_mask=status`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'FINALIZED' }),
    },
  );

  const release = await apiRequest(
    `https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/releases?versionName=${encodeURIComponent(versionName)}`,
    accessToken,
    {
      method: 'POST',
      headers: {},
    },
  );

  log(`Hosting released: ${release.name}`);
}

async function main() {
  log(`Deploying Firestore rules to project ${projectId}...`);
  await rules.releaseFirestoreRulesetFromSource(await fs.readFile(firestoreRulesPath, 'utf8'));

  log(`Deploying Storage rules to bucket ${storageBucket}...`);
  await rules.releaseStorageRulesetFromSource(await fs.readFile(storageRulesPath, 'utf8'), storageBucket);

  log('Requesting OAuth token for Hosting deploy...');
  const accessToken = await getAccessToken();

  await deployHosting(accessToken);

  log('Firebase deploy completed successfully.');
  log(`Firestore rules: updated`);
  log(`Storage rules: updated`);
  log(`Hosting URL: https://${siteId}.web.app`);
}

await main();
