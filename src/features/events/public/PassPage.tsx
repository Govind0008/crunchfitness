import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Seo from '@/components/site/Seo';
import { Button } from '@/components/ui/button';
import { Hud } from '@/components/motion';
import { SITE } from '@/lib/site';
import { formatEventDate, formatTime, getPass, passNumber, watchEventBySlug, type CrunchEvent, type Pass } from '@/lib/events';
import { StatusMark } from './shared';
import { savedPass } from './lib';

/** The participant's pass — name, event, category, number and a QR for check-in. No contact details. */
const PassPage = () => {
  const { slug = '', passId = '' } = useParams();
  const [ev, setEv] = useState<CrunchEvent | null | undefined>(undefined);
  const [pass, setPass] = useState<Pass | null | undefined>(undefined);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => watchEventBySlug(slug, setEv, () => setEv(null)), [slug]);
  useEffect(() => {
    if (!ev) return;
    getPass(ev.id, passId).then((p) => { setPass(p); if (p) savedPass.set(ev.id, passId); }).catch(() => setPass(null));
  }, [ev?.id, passId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pass || !ev) return;
    // The QR carries the pass URL; staff scan it at check-in
    import('qrcode').then((QR) => QR.toDataURL(`${SITE.url}/events/${ev.slug}/pass/${passId}`, { margin: 1, width: 480, color: { dark: '#0a0a0b', light: '#ffffff' } })).then(setQr);
  }, [pass, ev, passId]);

  const loading = ev === undefined || (ev && pass === undefined);
  const category = ev?.categories.find((c) => c.id === pass?.categoryId)?.name;

  return (
    <main className="min-h-[calc(100svh-var(--page-top))] bg-ink-950 px-4 py-8 sm:py-14">
      <Seo title="Your event pass | Crunch Fitness" description="Your Crunch Fitness event registration pass." noindex />
      <div className="mx-auto max-w-md">
        <Link to={ev ? `/events/${ev.slug}` : '/events'} className="mb-6 inline-flex items-center gap-2 text-sm text-ink-400 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> {ev?.title ?? 'Events'}</Link>
        {loading && <div className="aspect-[3/5] animate-pulse rounded-3xl bg-ink-900" aria-label="Loading pass" />}
        {!loading && (!ev || !pass) && (
          <div className="rounded-3xl border border-white/10 p-8">
            <h1 className="font-display text-4xl font-bold uppercase text-white">Pass not found</h1>
            <p className="mt-3 text-ink-300">Check the link, or ask the Crunch team at the front desk — they can find you by name.</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/events">All events</Link></Button>
          </div>
        )}
        {ev && pass && (
          <article className="pass-card overflow-hidden rounded-3xl bg-white text-ink-950" aria-label="Event pass">
            <div className="bg-ink-950 p-6 text-white">
              <div className="flex items-center justify-between gap-3"><Hud index="Crunch" label="Event pass" /><StatusMark ev={ev} /></div>
              <h1 className="mt-6 font-display text-4xl font-extrabold uppercase leading-[0.9]">{ev.title}</h1>
              <p className="mt-3 text-sm text-white/70">{formatEventDate(ev.eventDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{ev.startTime && ` · ${formatTime(ev.startTime)}`}<br />{ev.location}</p>
            </div>
            {/* Perforation */}
            <div className="relative h-0 border-t-2 border-dashed border-ink-200" aria-hidden>
              <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-ink-950" /><span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-ink-950" />
            </div>
            <div className="p-6">
              <dl className="grid grid-cols-2 gap-5">
                <div className="col-span-2"><dt className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Athlete</dt><dd id="pass-name" className="mt-1 font-display text-3xl font-bold uppercase leading-tight">{pass.name}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Registration</dt><dd className="mt-1 font-display text-2xl font-bold">#{passNumber(pass.number)}</dd></div>
                {category && <div><dt className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Category</dt><dd className="mt-1 font-display text-2xl font-bold uppercase leading-tight">{category}</dd></div>}
              </dl>
              <div className="mt-6 flex flex-col items-center">
                {qr ? <img src={qr} alt={`QR code for registration ${passNumber(pass.number)}`} width={240} height={240} className="h-60 w-60" /> : <div className="h-60 w-60 animate-pulse rounded-xl bg-ink-100" />}
                <p className="mt-3 text-center text-xs text-ink-500">Show this at check-in. A screenshot works too.</p>
              </div>
            </div>
          </article>
        )}
      </div>
    </main>
  );
};

export default PassPage;
