import { defineConfig } from 'vite';
import { env } from 'node:process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
function sourceVersion() {
  const hash = createHash('sha256').update('game-update-manifest-v1');
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else hash.update(relative(root, path).replaceAll('\\', '/')).update('\0').update(readFileSync(path)).update('\0');
    }
  };
  visit(resolve(root, 'src'));
  if (existsSync(resolve(root, 'public'))) visit(resolve(root, 'public'));
  for (const name of ['index.html', 'package.json', 'pnpm-lock.yaml', 'vite.config.ts']) hash.update(name).update(readFileSync(resolve(root, name)));
  return hash.digest('hex');
}

// Preserve the local dashboard route; hosts can set '/' or '/uisaeng-game/'.
export default defineConfig(({ command }) => {
  const version = sourceVersion();
  const displayVersion: string = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
  return {
    base: env.VITE_BASE_PATH || '/game/',
    define: { __APP_VERSION__: JSON.stringify(version), __APP_DISPLAY_VERSION__: JSON.stringify(displayVersion), __APP_UPDATES_ENABLED__: command === 'build' },
    plugins: [{ name: 'game-update-manifest', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
    } }],
  };
});
