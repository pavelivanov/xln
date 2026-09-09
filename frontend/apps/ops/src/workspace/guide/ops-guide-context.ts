import type { NetworkMachineStep } from '../../../../../src/lib/network3d/networkMachine';

export type OpsGuideFrameContext = Readonly<{
  key: string;
  label: string;
  description: string;
}>;

export const createOpsGuideFrameContext = (step: NetworkMachineStep | null): OpsGuideFrameContext => {
  if (!step) return {
    key: 'live',
    label: 'Live Runtime view',
    description: 'The workspace is showing the live Runtime view. No recorded frame is selected.',
  };
  const runtimeId = step.event.runtimeId;
  const height = step.event.height;
  return {
    key: `${runtimeId}:h${height}:${step.event.timestamp}`,
    label: `${runtimeId} · h${height}`,
    description: `The workspace is bound to recorded Runtime ${runtimeId} at committed height ${height} and timestamp ${step.event.timestamp}.`,
  };
};
