import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { createReactAppConfig } from '../../config/create-react-app-config';
import { WALLET_RUNTIME_DEPENDENCIES } from '../../config/wallet-runtime-dependencies';

export default defineConfig({
  ...createReactAppConfig({
    surfaceId: 'ops',
    rootDirectory: fileURLToPath(new URL('.', import.meta.url)),
    aliases: {
      '$lib': fileURLToPath(new URL('../../src/lib', import.meta.url)),
      '@xln/brainvault': fileURLToPath(new URL('../../../brainvault', import.meta.url)),
    },
  }),
  // Workspace and owner-session imports arrive together on first navigation.
  // Prebundle their dependencies before serving either module so a late
  // optimizer pass cannot invalidate requests already in flight.
  optimizeDeps: {
    include: [...WALLET_RUNTIME_DEPENDENCIES, 'dockview', '@noble/hashes/sha3.js', '@noble/hashes/hkdf.js', 'three', 'three/examples/jsm/controls/OrbitControls.js', 'svelte/store', 'marked'],
  },
});
