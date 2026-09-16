import type { EntityOpenAction } from '../../../../browser/src/workspace/panel-bridge';

export type ImmersiveWalletSurfaceAction = EntityOpenAction | 'close';

export const IMMERSIVE_WALLET_BUTTONS: Array<{
  action: ImmersiveWalletSurfaceAction;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}> = [
  { action: 'pay', label: 'PAY', x: 70, y: 480, width: 205, height: 92, color: '#22c55e' },
  { action: 'swap', label: 'SWAP', x: 300, y: 480, width: 205, height: 92, color: '#38bdf8' },
  { action: 'dispute', label: 'DISPUTE', x: 530, y: 480, width: 250, height: 92, color: '#fb7185' },
  { action: 'close', label: 'CLOSE', x: 805, y: 480, width: 150, height: 92, color: '#94a3b8' },
];

export const immersiveWalletActionAt = (x: number, y: number): ImmersiveWalletSurfaceAction | null =>
  IMMERSIVE_WALLET_BUTTONS.find(
    button => x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height,
  )?.action ?? null;
