import { getAccountUiStatus, getAccountUiStatusLabel, type AccountUiStatus } from '../../../utils/accountStatus';

export type AccountDropdownItem = Readonly<{
  id: string; name: string; avatar: string; status: AccountUiStatus; statusLabel: string; pendingCount: number;
}>;

export const showsAccountDropdown = (accountCount: number): boolean => accountCount > 5;

export function buildAccountDropdownItems(
  accounts: Iterable<readonly [string, Parameters<typeof getAccountUiStatus>[0]]>,
  names: ReadonlyMap<string, string>,
  avatarForEntity: (entityId: string) => string,
): AccountDropdownItem[] {
  return [...accounts].map(([id, account]) => {
    const status = getAccountUiStatus(account);
    return {
      id, name: names.get(id.trim().toLowerCase()) || id, avatar: avatarForEntity(id),
      status, statusLabel: getAccountUiStatusLabel(status), pendingCount: account.mempool.length,
    };
  });
}
