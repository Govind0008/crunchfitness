// ADMS ("push") attendance records — the format eSSL/ZKTeco devices such as the F22 upload over
// HTTP when pointed at a server (POST /iclock/cdata?SN=<serial>&table=ATTLOG).
//
// Pure parsing only. The listener that receives these requests is part of the integration
// service (see ACCESS_CONTROL.md) and is NOT deployed: which fields and commands the gym's
// F22 firmware actually sends must be checked against the real device first.
//
// ATTLOG body: one scan per line, tab-separated:
//   <user id> \t <YYYY-MM-DD HH:MM:SS> \t <status> \t <verify> \t <work code> \t ...
import type { RawDeviceEvent, VerifyMethod } from './index';

/** Common ZKTeco verify codes. Anything else is kept as "unknown" (the raw code is preserved). */
const VERIFY: Record<string, VerifyMethod> = { '0': 'password', '1': 'fingerprint', '2': 'card', '3': 'password', '4': 'card', '15': 'face' };

export interface AttlogParse { events: RawDeviceEvent[]; skipped: { line: number; text: string; reason: string }[] }

export function parseAttlog(body: string, ctx: { gymId: string; deviceId: string }): AttlogParse {
  const events: RawDeviceEvent[] = [];
  const skipped: AttlogParse['skipped'] = [];
  body.split(/\r?\n/).forEach((text, i) => {
    if (!text.trim()) return;
    const [pin, time, status = '', verify = ''] = text.split('\t').map((s) => s.trim());
    if (!pin || !/^[A-Za-z0-9_-]{1,24}$/.test(pin)) { skipped.push({ line: i + 1, text, reason: 'No valid user ID' }); return; }
    if (!time || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(time)) { skipped.push({ line: i + 1, text, reason: 'No valid time' }); return; }
    events.push({ ...ctx, deviceUserId: pin, deviceTime: time, verify: VERIFY[verify] ?? 'unknown', statusCode: status });
  });
  return { events, skipped };
}
