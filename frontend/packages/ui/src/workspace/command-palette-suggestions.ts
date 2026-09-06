import { findCommandPaletteEntities, type CommandPaletteView } from './command-palette-view';

export type CommandPaletteCommand =
  | Readonly<{ type: 'pay'; args: { amount: string; token: string; recipientId: string; recipientName: string } }>
  | Readonly<{ type: 'swap'; args: { amount: string; fromToken: string; toToken: string } }>
  | Readonly<{ type: 'open'; args: { entityId: string; name: string } }>
  | Readonly<{ type: 'navigate'; args: { tab: 'assets' | 'settings' } }>
  | Readonly<{ type: 'explore'; args: { entityId: string } }>;

export type CommandPaletteAction =
  | Readonly<{ type: 'input'; value: string }>
  | Readonly<{ type: 'hint' }>
  | Readonly<{ type: 'command'; command: CommandPaletteCommand }>;
export type CommandPaletteSuggestion = Readonly<{
  id: string; icon: string; label: string; sublabel: string; action: CommandPaletteAction;
}>;

export const localizeCommandPaletteSuggestion = (
  suggestion: CommandPaletteSuggestion,
  t: (key: string, params?: Record<string, string | number>) => string,
): CommandPaletteSuggestion => {
  const action = suggestion.action;
  if (action.type === 'input') return { ...suggestion, label: t(`workspace.${suggestion.id}`) };
  if (action.type === 'hint') return { ...suggestion, sublabel: suggestion.sublabel === 'No matching entity found' ? t('workspace.noMatches') : suggestion.sublabel };
  const command = action.command;
  if (command.type === 'pay') return { ...suggestion, label: t('workspace.payTo', { ...command.args, name: command.args.recipientName }), sublabel: t('workspace.sendHint') };
  if (command.type === 'swap') return { ...suggestion, label: t('workspace.swapFor', command.args), sublabel: t('workspace.swapHint') };
  if (command.type === 'open') return { ...suggestion, label: t('workspace.openWith', command.args) };
  if (command.type === 'navigate') return { ...suggestion,
    label: t(command.args.tab === 'assets' ? 'workspace.balances' : 'settings.title'),
    sublabel: t(command.args.tab === 'assets' ? 'workspace.balanceHint' : 'workspace.settingsHint'),
  };
  return suggestion;
};

  export function buildCommandPaletteSuggestions(query: string, view: CommandPaletteView): CommandPaletteSuggestion[] {
    if (!query.trim()) return defaultSuggestions();
    const q = query.trim().toLowerCase();
    const results: CommandPaletteSuggestion[] = [];

    // pay <amount> <token> to <name>
    const payMatch = q.match(/^pay\s+(\d+(?:\.\d+)?)\s*(\w+)?\s*(?:to\s+)?@?(.+)?$/i);
    if (payMatch) {
      const amount = payMatch[1] || '';
      const token = (payMatch[2] || 'usdc').toUpperCase();
      const recipient = payMatch[3]?.trim() || '';
      if (recipient) {
        const matches = findCommandPaletteEntities(recipient, view);
        for (const m of matches.slice(0, 3)) {
          results.push({
            id: `pay-${m.id}`,
            icon: '↗',
            label: `Pay ${amount} ${token} to ${m.name}`,
            sublabel: `Send via bilateral account`,
            action: { type: 'command', command: { type: 'pay', args: { amount, token, recipientId: m.id, recipientName: m.name } } },
          });
        }
      }
      if (results.length === 0) {
        results.push({
          id: 'pay-hint',
          icon: '↗',
          label: `Pay ${amount} ${token}${recipient ? ` to ${recipient}` : ''}`,
          sublabel: recipient ? 'No matching entity found' : 'Add recipient: pay 100 usdc to @name',
          action: { type: 'hint' },
        });
      }
    }

    // swap <amount> <token> for <token>
    const swapMatch = q.match(/^swap\s+(\d+(?:\.\d+)?)\s*(\w+)?\s*(?:for|to|->|→)\s*(\w+)?/i);
    if (swapMatch) {
      const amount = swapMatch[1] || '';
      const fromToken = (swapMatch[2] || 'usdc').toUpperCase();
      const toToken = (swapMatch[3] || 'weth').toUpperCase();
      results.push({
        id: 'swap',
        icon: '⇄',
        label: `Swap ${amount} ${fromToken} → ${toToken}`,
        sublabel: 'Open swap panel with prefilled amounts',
        action: { type: 'command', command: { type: 'swap', args: { amount, fromToken, toToken } } },
      });
    }

    // open <hub>
    const openMatch = q.match(/^open\s+(.+)/i);
    if (openMatch) {
      const hubQuery = openMatch[1]?.trim() ?? '';
      const matches = findCommandPaletteEntities(hubQuery, view);
      for (const m of matches.slice(0, 3)) {
        results.push({
          id: `open-${m.id}`,
          icon: '+',
          label: `Open account with ${m.name}`,
          sublabel: m.id.slice(0, 10) + '...',
          action: { type: 'command', command: { type: 'open', args: { entityId: m.id, name: m.name } } },
        });
      }
    }

    // balance / bal
    if (/^bal(ance)?$/i.test(q)) {
      results.push({
        id: 'balance',
        icon: '$',
        label: 'Show balances',
        sublabel: 'Switch to Assets tab',
        action: { type: 'command', command: { type: 'navigate', args: { tab: 'assets' } } },
      });
    }

    // settings
    if (/^set(tings)?$/i.test(q)) {
      results.push({
        id: 'settings',
        icon: '⚙',
        label: 'Open Settings',
        sublabel: 'Wallet, appearance, J-machines',
        action: { type: 'command', command: { type: 'navigate', args: { tab: 'settings' } } },
      });
    }

    // If no command matches, search the entity index by name.
    if (results.length === 0 && q.length >= 2) {
      const matches = findCommandPaletteEntities(q, view);
      for (const m of matches.slice(0, 5)) {
        results.push({
          id: `entity-${m.id}`,
          icon: '◉',
          label: m.name,
          sublabel: `${m.id.slice(0, 10)}... · ${m.isHub ? 'Hub' : 'Entity'}`,
          action: { type: 'command', command: { type: 'explore', args: { entityId: m.id } } },
        });
      }
    }

    return results;
  }

  function defaultSuggestions(): CommandPaletteSuggestion[] {
    return [
      { id: 'pay', icon: '↗', label: 'Pay', sublabel: 'pay 100 usdc to @name', action: { type: 'input', value: 'pay ' } },
      { id: 'swap', icon: '⇄', label: 'Swap', sublabel: 'swap 0.5 weth for usdc', action: { type: 'input', value: 'swap ' } },
      { id: 'balance', icon: '$', label: 'Balances', sublabel: 'View your assets', action: { type: 'command', command: { type: 'navigate', args: { tab: 'assets' } } } },
      { id: 'settings', icon: '⚙', label: 'Settings', sublabel: 'Wallet & appearance', action: { type: 'command', command: { type: 'navigate', args: { tab: 'settings' } } } },
    ];
  }
