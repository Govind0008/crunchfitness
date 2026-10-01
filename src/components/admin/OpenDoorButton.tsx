import { useEffect, useRef, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deviceHealth, type AccessDevice } from '@/lib/access';
import { listDevices, openDoor, watchDeviceCommand, type DeviceCommand } from '@/lib/access/store';
import ButtonLoader from '@/components/loading/ButtonLoader';
import { useActor } from '@/features/events/admin/actor';

type State =
  | { s: 'idle' } | { s: 'sending' } | { s: 'done' }
  | { s: 'failed'; why: string } | { s: 'offline' } | { s: 'noanswer' } | { s: 'nodevice' };
const NO_ANSWER_MS = 20_000;
const seen = (d: AccessDevice) => d.lastSeenAt?.toDate().getTime() ?? 0;
/** The gym's access device: the enabled one in touch most recently. */
const pick = (all: AccessDevice[]) => all.filter((d) => d.enabled).sort((a, b) => seen(b) - seen(a))[0] ?? null;

/**
 * "Open door" — the admin header's one-click door release (ADMS AC_UNLOCK to the access device).
 * No member, fingerprint, ID or confirmation. It never claims the door opened: "Door released"
 * appears only when the device itself answers that it carried the command out. If the device is
 * offline nothing is sent (a door must not open later, unexpectedly).
 */
const OpenDoorButton = () => {
  const actor = useActor();
  const [device, setDevice] = useState<AccessDevice | null | undefined>(undefined);
  const [state, setState] = useState<State>({ s: 'idle' });
  const stop = useRef<() => void>(() => {});
  const reset = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { listDevices().then((d) => setDevice(pick(d))).catch(() => setDevice(null)); }, []);
  useEffect(() => () => { stop.current(); clearTimeout(reset.current); }, []);
  const settle = (next: State) => {
    stop.current(); setState(next);
    clearTimeout(reset.current);
    reset.current = setTimeout(() => setState({ s: 'idle' }), next.s === 'done' ? 4000 : 7000);
  };

  const open = async () => {
    if (state.s === 'sending') return;
    clearTimeout(reset.current);
    setState({ s: 'sending' });
    try {
      // Fresh: is the device actually in touch right now?
      const d = pick(await listDevices());
      setDevice(d);
      if (!d) { settle({ s: 'nodevice' }); return; }
      if (deviceHealth(d) !== 'online') { settle({ s: 'offline' }); return; }
      const id = await openDoor(d.id, actor);
      const timer = setTimeout(() => settle({ s: 'noanswer' }), NO_ANSWER_MS);
      const off = watchDeviceCommand(d.id, id, (c: DeviceCommand | null) => {
        if (!c) return;
        if (c.status === 'done') { clearTimeout(timer); settle({ s: 'done' }); }
        if (c.status === 'failed') { clearTimeout(timer); settle({ s: 'failed', why: c.returnCode ? `code ${c.returnCode}` : c.error?.startsWith('Expired') ? 'expired' : 'refused' }); }
      });
      stop.current = () => { clearTimeout(timer); off(); };
    } catch (e) {
      settle({ s: 'failed', why: (e as Error).message.includes('permission') ? 'not allowed' : 'couldn’t send' });
    }
  };

  if (device === null && state.s === 'idle') return null;   // no access device set up
  const label = state.s === 'sending' ? 'Opening…' : state.s === 'done' ? 'Door released' : state.s === 'failed' ? `Not opened (${state.why})`
    : state.s === 'offline' ? 'Device offline' : state.s === 'noanswer' ? 'No answer from device' : state.s === 'nodevice' ? 'No access device' : 'Open door';
  const tone = state.s === 'done' ? 'border-brand-400/60 bg-brand-400/15 text-brand-fg' : ['failed', 'offline', 'noanswer', 'nodevice'].includes(state.s) ? 'border-amber-400/40 bg-amber-400/10 text-amber-100' : 'border-white/[0.12] text-white hover:border-white/30 hover:bg-white/[0.06]';
  return (
    <button type="button" onClick={open} disabled={state.s === 'sending' || device === undefined} aria-busy={state.s === 'sending' || undefined} aria-label="Open door"
      title={state.s !== 'idle' ? label : device ? `Release the door at ${device.name}` : 'Release the door'}
      className={cn('flex h-9 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-progress', tone)}>
      {state.s === 'sending' ? <ButtonLoader className="h-4 w-4" /> : <DoorOpen size={16} aria-hidden />}
      <span aria-hidden className={cn('max-w-[8.5rem] truncate sm:max-w-none', state.s === 'idle' && 'hidden sm:inline')}>{label}</span>
      <span className="sr-only" aria-live="polite">{state.s === 'idle' ? '' : label}</span>
    </button>
  );
};

export default OpenDoorButton;
