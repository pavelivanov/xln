import type { RuntimeAdapterStorageSnapshot } from '../../../../../packages/browser/src/runtime/session/runtime-adapter-session';
import type { OpsWorkspaceRecording } from '../entity/ops-recorded-entity';
import {
  openOpsEntityRuntimeReadSession,
  OpsEntityWorkspaceSource,
  type RuntimeReadSession,
} from '../../entity-workspace/ops-entity-workspace-source';

type Connection = {
  session: Promise<RuntimeReadSession>;
  readers: number;
};

// Panel lifetime owns only a read lease. Closing one Entity must never
// disconnect its siblings or open a second sovereign Runtime connection.
export class OpsWorkspaceSession {
  private connection: Connection | null = null;
  private readonly sources = new Set<OpsEntityWorkspaceSource>();
  private recording: OpsWorkspaceRecording | null = null;

  constructor(private config: RuntimeAdapterStorageSnapshot) {}

  readonly trackSource = (source: OpsEntityWorkspaceSource): (() => void) => {
    this.sources.add(source);
    source.configure(this.config);
    if (this.recording) source.setRecording(this.recording);
    return () => { this.sources.delete(source); source.stop(); };
  };

  readonly setRecording = (recording: OpsWorkspaceRecording | null): void => {
    this.recording = recording;
    for (const source of this.sources) source.setRecording(recording);
  };

  readonly select = async (config: RuntimeAdapterStorageSnapshot): Promise<void> => {
    // Invalidate every panel before opening the replacement connection. Late
    // reads are discarded by each source's generation and cannot mix Runtimes.
    this.config = config;
    for (const source of this.sources) source.configure(config);
    this.connection = null;
    await Promise.all([...this.sources].map(source => source.start()));
  };

  readonly createEntitySource = (entityId?: string): OpsEntityWorkspaceSource => {
    if (entityId !== undefined && !/^0x[0-9a-f]{64}$/i.test(entityId)) {
      throw new Error('OPS_WORKSPACE_ENTITY_ID_INVALID');
    }
    return new OpsEntityWorkspaceSource(this.config, { openSession: this.acquire }, entityId);
  };

  private readonly acquire = async (): Promise<RuntimeReadSession> => {
    const connection = this.connection ?? {
      session: openOpsEntityRuntimeReadSession(this.config), readers: 0,
    };
    this.connection = connection;
    connection.readers += 1;
    let session: RuntimeReadSession;
    try {
      session = await connection.session;
    } catch (error: unknown) {
      this.releaseReader(connection);
      throw error;
    }
    let released = false;
    return { adapter: session.adapter, release: () => {
      if (released) return;
      released = true;
      if (this.releaseReader(connection)) session.release();
    } };
  };

  private releaseReader(connection: Connection): boolean {
    connection.readers -= 1;
    if (connection.readers !== 0) return false;
    if (this.connection === connection) this.connection = null;
    return true;
  }
}
