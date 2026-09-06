import { createContext, useContext } from 'react';

export const OpsWorkspaceNavigation = createContext<((entityId: string, title: string) => void) | null>(null);
export const useOpenWorkspaceEntity = () => useContext(OpsWorkspaceNavigation);
export const OpsWorkspaceJurisdictionNavigation = createContext<((name: string) => void) | null>(null);
export const useOpenWorkspaceJurisdiction = () => useContext(OpsWorkspaceJurisdictionNavigation);
export const OpsWorkspaceWalletNavigation = createContext<((href: string) => void) | null>(null);
export const useOpenWorkspaceWallet = () => useContext(OpsWorkspaceWalletNavigation);
export const OpsWorkspaceIdentityNavigation = createContext<(() => void) | null>(null);
export const useOpenWorkspaceIdentity = () => useContext(OpsWorkspaceIdentityNavigation);
