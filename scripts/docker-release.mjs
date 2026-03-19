import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
);

const version = packageJson.version;
const registry = process.env.REGISTRY ?? 'registry.emfsoft.com';
const namespace = process.env.IMAGE_NAMESPACE ?? 'officialdavidtaylor';

const webImage = `${registry}/${namespace}/web`;
const strapiImage = `${registry}/${namespace}/strapi-cms`;
const target = process.argv[3] ?? 'all';

if (!['all', 'strapi', 'web'].includes(target)) {
  throw new Error(`Unknown target: ${target}`);
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function shouldInclude(name) {
  return target === 'all' || target === name;
}

function build() {
  if (shouldInclude('strapi')) {
    run('docker', [
      'build',
      '-f',
      'apps/strapi-cms/Dockerfile',
      '-t',
      `${strapiImage}:${version}`,
      '-t',
      `${strapiImage}:latest`,
      '.',
    ]);
  }

  if (shouldInclude('web')) {
    run('docker', [
      'build',
      '-t',
      `${webImage}:${version}`,
      '-t',
      `${webImage}:latest`,
      '--build-arg',
      `STRAPI_URL=${requireEnv('STRAPI_URL')}`,
      '--build-arg',
      `STRAPI_PUBLIC_URL=${requireEnv('STRAPI_PUBLIC_URL')}`,
      '--build-arg',
      `STRAPI_API_TOKEN=${requireEnv('STRAPI_API_TOKEN')}`,
      '--build-arg',
      `STRAPI_FETCH_RETRIES=${process.env.STRAPI_FETCH_RETRIES ?? '3'}`,
      '.',
    ]);
  }
}

function push() {
  const images = [];

  if (shouldInclude('strapi')) {
    images.push(strapiImage);
  }

  if (shouldInclude('web')) {
    images.push(webImage);
  }

  for (const image of images) {
    run('docker', ['push', `${image}:${version}`]);
    run('docker', ['push', `${image}:latest`]);
  }
}

const command = process.argv[2] ?? 'build';

if (command === 'build') {
  build();
} else if (command === 'push') {
  push();
} else {
  throw new Error(`Unknown command: ${command}`);
}
