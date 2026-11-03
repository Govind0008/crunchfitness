// The "a command was just queued" signal shared by EVERY Cloudflare location (see the Open-door
// fast lane in worker.ts). The edge cache only reaches the location that served staff's notify
// call; when staff (e.g. a phone on mobile data) and the device reach different locations, the
// device never saw it and Open door waited for the periodic Firestore check. One Durable Object
// per device holds the signal instead, so the device's next poll finds it wherever it was raised.
//
// Free plan: one request per device poll (~29,000 a day at the X2008's 3-second polls) of the
// 100,000 a day; storage is touched only when a signal is raised or taken.
import { DurableObject } from 'cloudflare:workers';

/** A signal older than this is stale (an unlock expires after 30 s anyway). */
const SIGNAL_MAX_AGE_MS = 60_000;

export class CommandSignalObject extends DurableObject {
  /** When the signal was raised (null: none). Undefined until read from storage after a restart. */
  private at: number | null | undefined;

  async raise(): Promise<void> {
    this.at = Date.now();
    await this.ctx.storage.put('at', this.at);
  }

  /** Was a command queued since the last look? Clears the signal. */
  async take(): Promise<boolean> {
    if (this.at === undefined) this.at = (await this.ctx.storage.get<number>('at')) ?? null;
    if (this.at === null) return false;
    const fresh = Date.now() - this.at < SIGNAL_MAX_AGE_MS;
    this.at = null;
    await this.ctx.storage.delete('at');
    return fresh;
  }
}
