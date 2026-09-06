import { createContext, useContext } from 'react';
import { loadWalletRuntimeReadDependencies, type WalletRuntimeReadLoader } from './wallet-runtime-read-boundary';

// A dock supplies a borrowed Runtime connection. Source teardown releases only
// its observers; the workspace owns the sovereign adapter's lifetime.
export const WalletRuntimeScope = createContext<WalletRuntimeReadLoader>(loadWalletRuntimeReadDependencies);
export const useWalletRuntimeLoader = (): WalletRuntimeReadLoader => useContext(WalletRuntimeScope);
