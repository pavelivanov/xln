import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { createReactAppConfig } from '../../config/create-react-app-config';
import { WALLET_RUNTIME_DEPENDENCIES } from '../../config/wallet-runtime-dependencies';

export default defineConfig({ ...createReactAppConfig({
  surfaceId: 'wallet',
  rootDirectory: fileURLToPath(new URL('.', import.meta.url)),
  aliases: {
    '@xln/brainvault': fileURLToPath(new URL('../../../brainvault', import.meta.url)),
    '$lib': fileURLToPath(new URL('../../src/lib', import.meta.url)),
  },
}),
  // Recovery loads native capability bridges after the seed rehearsal. Resolve
  // their dependencies before navigation so optimization cannot reload the
  // document and erase the owner's in-memory recovery input.
  optimizeDeps: { include: [...WALLET_RUNTIME_DEPENDENCIES] },
});
