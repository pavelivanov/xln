import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { createReactAppConfig } from '../../config/create-react-app-config';

export default defineConfig({
  ...createReactAppConfig({
    surfaceId: 'ops',
    rootDirectory: fileURLToPath(new URL('.', import.meta.url)),
  }),
  // Workspace and owner-session imports arrive together on first navigation.
  // Prebundle their dependencies before serving either module so a late
  // optimizer pass cannot invalidate requests already in flight.
  optimizeDeps: {
    include: ['dockview', 'jdenticon', '@noble/hashes/sha3.js', '@noble/hashes/hkdf.js'],
  },
});
