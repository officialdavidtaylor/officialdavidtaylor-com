import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const rootPackagePath = path.join(repoRoot, 'package.json');
const strapiPackagePath = path.join(repoRoot, 'apps/strapi-cms/package.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function getCurrentVersion() {
  return readJson(rootPackagePath).version;
}

function getLatestTag() {
  try {
    const tag = runGit(['describe', '--tags', '--abbrev=0', '--match', 'v*']);
    return tag || null;
  } catch {
    return null;
  }
}

function getCommitMessages(sinceTag) {
  if (!sinceTag) {
    return [];
  }

  const args = ['log', '--format=%s%n%b%x1e'];
  args.splice(1, 0, `${sinceTag}..HEAD`);

  const output = runGit(args);

  if (!output) return [];

  return output
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCommitSubject(subject) {
  const match = subject.match(/^([a-z]+)(\([^)]+\))?(!)?:\s.+$/i);

  if (!match) {
    return null;
  }

  return {
    type: match[1].toLowerCase(),
    breaking: Boolean(match[3]),
  };
}

function getRecommendedBump(commits) {
  let level = 0;

  for (const commit of commits) {
    const [subject, ...bodyLines] = commit.split('\n');
    const body = bodyLines.join('\n');
    const parsed = parseCommitSubject(subject);

    if (!parsed) continue;

    if (parsed.breaking || body.includes('BREAKING CHANGE:')) {
      level = Math.max(level, 3);
      continue;
    }

    if (parsed.type === 'feat') {
      level = Math.max(level, 2);
      continue;
    }

    if (['fix', 'perf', 'revert', 'content'].includes(parsed.type)) {
      level = Math.max(level, 1);
    }
  }

  if (level === 3) return 'major';
  if (level === 2) return 'minor';
  if (level === 1) return 'patch';
  return null;
}

function bumpVersion(version, releaseType) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  let [, major, minor, patch] = match;
  let nextMajor = Number(major);
  let nextMinor = Number(minor);
  let nextPatch = Number(patch);

  switch (releaseType) {
    case 'major':
      nextMajor += 1;
      nextMinor = 0;
      nextPatch = 0;
      break;
    case 'minor':
      nextMinor += 1;
      nextPatch = 0;
      break;
    case 'patch':
      nextPatch += 1;
      break;
    default:
      throw new Error(`Unsupported release type: ${releaseType}`);
  }

  return `${nextMajor}.${nextMinor}.${nextPatch}`;
}

function syncVersions(nextVersion) {
  const rootPackage = readJson(rootPackagePath);
  const strapiPackage = readJson(strapiPackagePath);

  rootPackage.version = nextVersion;
  strapiPackage.version = nextVersion;

  writeJson(rootPackagePath, rootPackage);
  writeJson(strapiPackagePath, strapiPackage);
}

function printSummary(currentVersion, latestTag, commits, releaseType, nextVersion) {
  console.log(`current version: ${currentVersion}`);
  console.log(`latest tag: ${latestTag ?? '(none)'}`);
  console.log(`commits considered: ${commits.length}`);
  console.log(`recommended bump: ${releaseType ?? 'none'}`);
  console.log(`next version: ${nextVersion ?? currentVersion}`);
}

const command = process.argv[2] ?? 'check';
const currentVersion = getCurrentVersion();
const latestTag = getLatestTag();
const commits = getCommitMessages(latestTag);
const releaseType = getRecommendedBump(commits);
const nextVersion = releaseType ? bumpVersion(currentVersion, releaseType) : null;

switch (command) {
  case 'check':
    printSummary(currentVersion, latestTag, commits, releaseType, nextVersion);
    if (!latestTag) {
      console.log(
        `No release tag found. Run "yarn version:init" once to seed v${currentVersion}.`
      );
    }
    break;
  case 'apply':
    if (!nextVersion) {
      printSummary(currentVersion, latestTag, commits, releaseType, nextVersion);
      if (!latestTag) {
        console.log(
          `No release tag found. Run "yarn version:init" once to seed v${currentVersion}.`
        );
      }
      console.log('No releasable conventional commits found. Nothing changed.');
      process.exit(0);
    }

    syncVersions(nextVersion);
    printSummary(currentVersion, latestTag, commits, releaseType, nextVersion);
    console.log(`Applied version ${nextVersion} to package manifests.`);
    break;
  case 'init':
    if (latestTag) {
      console.log(`Release tag already exists: ${latestTag}`);
      process.exit(0);
    }

    runGit(['tag', `v${currentVersion}`]);
    console.log(`Created initial release tag v${currentVersion}.`);
    break;
  case 'tag':
    if (!nextVersion) {
      printSummary(currentVersion, latestTag, commits, releaseType, nextVersion);
      if (!latestTag) {
        console.log(
          `No release tag found. Run "yarn version:init" once to seed v${currentVersion}.`
        );
      }
      console.log('No releasable conventional commits found. No tag created.');
      process.exit(0);
    }

    syncVersions(nextVersion);
    runGit(['add', 'package.json', 'apps/strapi-cms/package.json']);
    runGit(['commit', '-m', `chore(release): ${nextVersion}`]);
    runGit(['tag', `v${nextVersion}`]);
    printSummary(currentVersion, latestTag, commits, releaseType, nextVersion);
    console.log(`Created release commit and tag v${nextVersion}.`);
    break;
  default:
    throw new Error(`Unknown command: ${command}`);
}
