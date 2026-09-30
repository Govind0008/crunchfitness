import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, QrCode, Search, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { passNumber, setRegistrationStatus, type Registration } from '@/lib/events';
import { AdminShell, Empty, inputCls } from './shared';
import { useActor } from './actor';
import { useEventData } from './useEventData';
import { RegPill } from './RegistrationsTab';
import { matchReg } from './registrations';

type Flash = { kind: 'in' | 'already'; reg: Registration };

// Native QR scanning where the browser has it (Chrome on Android); typing always works
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const BarcodeDetectorCtor = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;

const Scanner = ({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) => {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    const detector = new BarcodeDetectorCtor!({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
      stream = s;
      if (!video.current) return;
      video.current.srcObject = s;
      video.current.play();
      const tick = async () => {
        if (video.current?.readyState === 4) {
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0]) { onCode(codes[0].rawValue); return; }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => setErr('Camera not available. Type the registration number instead.'));
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-label="Scan pass">
      <video ref={video} className="h-full w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-64 w-64 rounded-3xl border-2 border-brand-400" /></div>
      {err && <p className="absolute inset-x-6 top-24 rounded-xl bg-ink-900 p-4 text-center text-white">{err}</p>}
      <Button size="lg" variant="light" className="absolute bottom-10 left-1/2 -translate-x-1/2" onClick={onClose}><X /> Close</Button>
    </div>
  );
};

/** Event-day check-in. Fast search, one big button, an unmissable confirmation. */
const CheckIn = () => {
  const { id } = useParams();
  const actor = useActor();
  const { event: ev, registrations } = useEventData(id);
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState<Flash | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => (q.trim() ? registrations.filter((r) => matchReg(r, q)).slice(0, 12) : []), [q, registrations]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => { setFlash(null); input.current?.focus(); }, 3500); return () => clearTimeout(t); }, [flash]);

  if (!ev) return <AdminShell title="Check-in"><div className="h-40 animate-pulse rounded-3xl bg-ink-900" /></AdminShell>;
  const catName = (cid: string) => ev.categories.find((c) => c.id === cid)?.name ?? '';

  const checkIn = async (r: Registration) => {
    if (r.status === 'checked_in') { setFlash({ kind: 'already', reg: r }); return; }
    setBusy(r.id);
    try { await setRegistrationStatus(ev, r, 'checked_in', actor); setFlash({ kind: 'in', reg: r }); setQ(''); }
    finally { setBusy(null); }
  };
  const onCode = (text: string) => {
    setScanning(false);
    const passId = text.split('/pass/')[1]?.split(/[?#]/)[0];
    const reg = passId ? registrations.find((r) => r.passId === passId) : undefined;
    if (reg) checkIn(reg); else setQ(text);
  };

  return (
    <AdminShell title="Check-in" back={{ to: `/admin/events/${ev.id}`, label: ev.title }}>
      <p className="-mt-4 mb-6 text-lg text-ink-300"><span className="font-display text-3xl font-bold text-white tabular-nums">{ev.checkedInCount}</span> of {ev.registrationCount} checked in</p>

      <div className="flex gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Search participant</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden />
          <input ref={input} autoFocus className={cn(inputCls, 'h-16 pl-12 text-xl')} placeholder="Name, CR-number or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {BarcodeDetectorCtor && <Button size="lg" variant="outline" className="h-16 w-16 !px-0" aria-label="Scan pass QR code" onClick={() => setScanning(true)}><QrCode className="!size-6" /></Button>}
      </div>

      {q && !matches.length && <div className="mt-6"><Empty title="No match" body="Check the spelling, or try their registration number (e.g. 24) or phone number." /></div>}
      <ul className="mt-6 space-y-3">
        {matches.map((r) => (
          <li key={r.id} className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-ink-900 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-white">{r.name}</p>
              <p className="text-sm text-ink-400">{passNumber(r.number)} · {catName(r.categoryId)}</p>
            </div>
            {r.status === 'checked_in' ? <RegPill status="checked_in" /> : (
              <Button size="lg" disabled={busy === r.id} onClick={() => checkIn(r)} aria-label={`Check in ${r.name}`}>Check in</Button>
            )}
            {r.status === 'checked_in' && <Button variant="ghost" size="sm" onClick={() => checkIn(r)}>Details</Button>}
          </li>
        ))}
      </ul>

      {/* Confirmation — green for done, amber for "already in" so a double check-in is obvious */}
      {flash && (
        <button type="button" onClick={() => setFlash(null)} role="status" aria-live="assertive"
          className={cn('fixed inset-0 z-50 flex flex-col items-center justify-center p-8 text-center', flash.kind === 'in' ? 'bg-brand-400 text-on-brand' : 'bg-amber-300 text-on-brand')}>
          {flash.kind === 'in' ? <CheckCircle2 className="h-20 w-20" aria-hidden /> : <TriangleAlert className="h-20 w-20" aria-hidden />}
          <span className="mt-6 font-display text-6xl font-extrabold uppercase leading-none">{flash.kind === 'in' ? 'Checked in' : 'Already checked in'}</span>
          <span className="mt-6 text-3xl font-bold">{flash.reg.name}</span>
          <span className="mt-2 text-xl">Registration #{passNumber(flash.reg.number)} · {catName(flash.reg.categoryId)}</span>
          {flash.kind === 'already' && flash.reg.checkedInAt && (
            <span className="mt-4 text-base">at {flash.reg.checkedInAt.toDate().toLocaleTimeString('en-IN', { timeStyle: 'short' })} by {flash.reg.checkedInBy}</span>
          )}
          <span className="mt-10 text-sm opacity-70">Tap anywhere to continue</span>
        </button>
      )}
      {scanning && <Scanner onCode={onCode} onClose={() => setScanning(false)} />}
    </AdminShell>
  );
};

export default CheckIn;
