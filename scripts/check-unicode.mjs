import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';

const forbidden = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/u;
const ignored = new Set(['node_modules', 'dist', '.git', 'coverage']);
const root = process.cwd();
const bad = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) {
      continue;
    }
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|json|md|yml|yaml|css|html|prisma|env)$/u.test(name)) {
      continue;
    }
    const text = readFileSync(path, 'utf8');
    if (forbidden.test(text)) {
      bad.push(path);
    }
  }
}

walk(root);
if (bad.length > 0) {
  console.error('Forbidden invisible Unicode characters found:');
  for (const path of bad) {
    console.error(`- ${path}`);
  }
  process.exit(1);
}

console.log('No forbidden invisible Unicode characters found.');
