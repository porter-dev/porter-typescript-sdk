import type { Sandboxes } from './resources/sandboxes.js';
import type { ExecResponse, LogLine, StatusResponse } from './_models.js';
import type { StatusResponsePhase } from './enums.js';

// Rich handle for a single sandbox. Constructed by the Sandboxes namespace —
// users don't instantiate this directly. Holds a back-reference to the
// underlying generated resource so lifecycle methods don't need to be
// re-passed a client.
export class Sandbox {
  readonly id: string;
  private status: StatusResponse | null;
  private readonly resource: Sandboxes;

  constructor(args: { id: string; resource: Sandboxes; status?: StatusResponse }) {
    this.id = args.id;
    this.resource = args.resource;
    this.status = args.status ?? null;
  }

  get phase(): StatusResponsePhase | null {
    return this.status?.phase ?? null;
  }

  get tags(): Record<string, string> | null {
    return this.status?.tags ?? null;
  }

  async refresh(): Promise<StatusResponse> {
    this.status = await this.resource.get(this.id);
    return this.status;
  }

  async terminate(): Promise<void> {
    await this.resource.delete(this.id);
  }

  async logs(options: { since?: string; limit?: number } = {}): Promise<LogLine[]> {
    const response = await this.resource.getLogs(this.id, options);
    return response.logs;
  }

  async exec(command: string[]): Promise<ExecResponse> {
    return this.resource.exec(this.id, { command });
  }
}
