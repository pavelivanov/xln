import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { createReactAppConfig } from '../../config/create-react-app-config';

export default defineConfig(createReactAppConfig({
  surfaceId: 'wallet',
  rootDirectory: fileURLToPath(new URL('.', import.meta.url)),
  aliases: {
    '@xln/brainvault': fileURLToPath(new URL('../../../brainvault', import.meta.url)),
    '$lib': fileURLToPath(new URL('../../src/lib', import.meta.url)),
  },
}));
