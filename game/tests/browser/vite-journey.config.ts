import { defineConfig } from 'vite';
// Keep visual QA stable while independent chats edit this shared workspace.
export default defineConfig({ base: '/game/', server: { host: '127.0.0.1', hmr: false } });
