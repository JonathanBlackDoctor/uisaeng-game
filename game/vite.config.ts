import { defineConfig } from 'vite';
import { env } from 'node:process';

// Preserve the local dashboard route; hosts can set '/' or '/uisaeng-game/'.
export default defineConfig({ base: env.VITE_BASE_PATH || '/game/' });
