import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ArrowDown, ArrowRight, Ticket } from 'lucide-react';
import Footer from '@/components/Footer';
import Seo from '@/components/site/Seo';
import { Section } from '@/components/site/Section';
import Lightbox, { type LightboxImage } from '@/components/site/Lightbox';
import { Button } from '@/components/ui/button';
import { Hud, TickRail } from '@/components/motion';
import { useRevealOnMount } from '@/hooks/useScrollReveal';
import { cn } from '@/lib/utils';
import { GYM } from '@/lib/gym';
import { SITE } from '@/lib/site';
import {
  formatEventDate, formatScore, formatTime, getPublicMedia, passNumber, rankCategory, register, registrationBlocker, winsLabel,
  watchEventBySlug, watchPublicResults, type Category, type CrunchEvent, type Media, type Result,
} from '@/lib/events';
import { StatusMark } from './shared';
import { coverOf, savedPass } from './lib';

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;
const pad = (n: number) => String(n).padStart(2, '0');

// ── Live leaderboard ── rows are absolutely stacked so rank changes glide into place
const ROW = 64;
const Leaderboard = ({ cat, results }: { cat: Category; results: Result[] }) => {
  const ranked = rankCategory(results, cat);
  if (!ranked.length) return <p className="py-10 text-center text-ink-400">First scores will appear here as soon as they’re in.</p>;
  return (
    <ol className="relative" style={{ height: ranked.length * ROW }} aria-label={`${cat.name} leaderboard`}>
      {ranked.map((r, i) => (
        <li key={r.id} className="board-row absolute inset-x-0 flex items-center gap-4 border-b border-white/[0.08] sm:gap-6"
          style={{ height: ROW, transform: `translate3d(0, ${i * ROW}px, 0)` }}>
          <span className={cn('w-12 font-display text-3xl font-extrabold tabular-nums', r.rank === 1 ? 'text-brand-400' : 'text-ink-500')}>{pad(r.rank)}</span>
          <span className="min-w-0 flex-1 truncate font-display text-xl font-bold uppercase tracking-wide text-white sm:text-2xl">{r.displayName}</span>
          <span className="font-display text-2xl font-bold tabular-nums text-white">{formatScore(r.score, cat)}</span>
        </li>
      ))}
    </ol>
  );
};

// ── Results podium ── each category's top three rise in sequence
const Podium = ({ cat, results, index }: { cat: Category; results: Result[]; index: number }) => {
  const ref = useRevealOnMount<HTMLDivElement>();
  const ranked = rankCategory(results, cat);
  const top = ranked.filter((r) => r.rank <= 3);
  return (
    <div ref={ref} className="border-t border-white/[0.08] pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-3xl font-bold uppercase text-white md:text-4xl">{cat.name}</h3>
        <span className="hud">{winsLabel(cat)}</span>
      </div>
      {top.length ? (
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {top.map((r, i) => (
            <li key={r.id} className="m-rise" style={d(index * 120 + i * 160)}>
              <p className={cn('font-display text-[5.5rem] font-extrabold leading-[0.8] tabular-nums md:text-[7rem]', r.rank === 1 ? 'text-brand-400' : 'text-outline')}>{pad(r.rank)}</p>
              <p className="mt-4 font-display text-2xl font-bold uppercase leading-tight text-white md:text-3xl">{r.displayName}</p>
              <p className="mt-1 text-lg tabular-nums text-ink-300">{formatScore(r.score, cat)}</p>
            </li>
          ))}
        </ol>
      ) : <p className="mt-6 text-ink-400">No results in this category.</p>}
      {ranked.length > 3 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-white">Full results ({ranked.length})</summary>
          <ol className="mt-4 divide-y divide-white/[0.06]">
            {ranked.map((r) => (
              <li key={r.id} className="flex items-center gap-4 py-3 text-sm">
                <span className="w-8 tabular-nums text-ink-500">{pad(r.rank)}</span>
                <span className="flex-1 text-white">{r.displayName}</span>
                <span className="tabular-nums text-ink-300">{formatScore(r.score, cat)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
};

// ── Registration ──
const RegisterForm = ({ ev }: { ev: CrunchEvent }) => {
  const [form, setForm] = useState({ name: '', phone: '', email: '', categoryId: ev.categories.length === 1 ? ev.categories[0].id : '', showName: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ number: number; passId: string } | null>(null);
  const blocked = registrationBlocker(ev);
  const field = 'h-14 w-full rounded-xl border border-white/15 bg-ink-950 px-4 text-base text-white placeholder:text-ink-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) return setError('Please enter your full name.');
    if (form.phone.replace(/\D/g, '').length < 8) return setError('Please enter a valid phone number.');
    if (!form.categoryId) return setError('Choose your category.');
    setBusy(true);
    try {
      const res = await register(ev.id, form);
      savedPass.set(ev.id, res.passId);
      setDone(res);
    } catch (err) {
      const msg = (err as { code?: string; message: string }).code === 'permission-denied' ? 'Registration just closed or the event is full.' : (err as Error).message;
      setError(msg);
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="register-done rounded-3xl bg-brand-400 p-8 text-ink-950 sm:p-12" role="status">
        <p className="hud !text-ink-950/70">Registration #{passNumber(done.number)}</p>
        <p className="mt-4 font-display text-[clamp(3.5rem,2rem+6vw,7rem)] font-extrabold uppercase leading-[0.84]">You’re in.</p>
        <p className="mt-6 text-lg font-medium">{ev.title}<br />{formatEventDate(ev.eventDate)} · {ev.location}</p>
        <Button asChild size="lg" className="mt-8 bg-ink-950 text-white hover:bg-ink-800">
          <Link to={`/events/${ev.slug}/pass/${done.passId}`}><Ticket /> View pass</Link>
        </Button>
        <p className="mt-4 text-sm text-ink-900/70">Save your pass — show it at check-in on the day.</p>
      </div>
    );
  }
  if (blocked) return <p className="rounded-2xl border border-white/10 p-8 text-lg text-ink-200">{blocked}</p>;

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate aria-describedby="reg-privacy">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2"><span className="text-sm font-semibold text-white">Full name</span>
          <input className={field} autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold text-white">Phone</span>
          <input className={field} type="tel" autoComplete="tel" inputMode="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold text-white">Email <span className="font-normal text-ink-500">(optional)</span></span>
          <input className={field} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        {ev.categories.length > 1 && (
          <label className="grid gap-2"><span className="text-sm font-semibold text-white">Category</span>
            <select className={field} required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Choose a category</option>
              {ev.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        )}
      </div>
      <label className="flex items-start gap-3 text-sm text-ink-300">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#b0d43f]" checked={form.showName} onChange={(e) => setForm({ ...form, showName: e.target.checked })} />
        Show my name on the public leaderboard and results. If unticked, you’ll appear as your registration number.
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={busy} loadingText="Registering…">{<>Register <ArrowRight /></>}</Button>
        <p id="reg-privacy" className="text-xs text-ink-500">Your phone and email are only seen by Crunch staff.</p>
      </div>
    </form>
  );
};

/** The hero mounts only once the event has loaded, so its entrance runs when it's actually on screen. */
const HeroFrame = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  const ref = useRevealOnMount<HTMLElement>();
  return <header ref={ref} className={className}>{children}</header>;
};

// ── Event page ──
const EventPage = () => {
  const { slug = '' } = useParams();
  const [ev, setEv] = useState<CrunchEvent | null | undefined>(undefined);
  const [results, setResults] = useState<Result[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [boardCat, setBoardCat] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ index: number; origin: DOMRect | null } | null>(null);

  useEffect(() => watchEventBySlug(slug, setEv, () => setEv(null)), [slug]);
  // Realtime results only where they matter: LIVE and published
  useEffect(() => (ev ? watchPublicResults(ev, setResults) ?? undefined : undefined), [ev?.id, ev?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ev) getPublicMedia(ev.id).then(setMedia).catch(() => setMedia([])); }, [ev?.id, ev?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const photos = useMemo(() => media.filter((m) => m.type === 'photo'), [media]);
  const lbImages: LightboxImage[] = photos.map((m) => ({ src: m.url, title: m.caption || (ev ? `${ev.title} — photo` : 'Event photo'), caption: m.kind === 'winner' ? 'Winner' : undefined }));

  if (ev === undefined) return <div className="min-h-screen"><div className="h-[80svh] animate-pulse bg-ink-900" aria-label="Loading event" /></div>;
  if (ev === null) {
    return (
      <div className="min-h-screen">
        <Seo title="Event not found | Crunch Fitness Club" description="This event isn’t available." noindex />
        <main className="container flex min-h-[70svh] flex-col items-start justify-center py-20">
          <Hud index="Crunch" label="Events" />
          <h1 className="mt-6 font-display text-display-lg font-extrabold uppercase text-white">This event isn’t on the floor.</h1>
          <p className="mt-4 text-ink-300">It may have been moved or isn’t public yet.</p>
          <Button asChild size="lg" variant="outline" className="mt-8"><Link to="/events">All events <ArrowRight /></Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  const cover = coverOf(ev);
  const live = ev.status === 'live';
  const published = ev.status === 'results_published' || ev.status === 'archived';
  const canRegister = !registrationBlocker(ev);
  const myPass = savedPass.get(ev.id);
  const currentCat = ev.categories.find((c) => c.id === (boardCat ?? ev.currentCategoryId)) ?? ev.categories[0];
  const [dd, mm] = formatEventDate(ev.eventDate, { day: 'numeric', month: 'long' }).split(' ');
  const info = [
    ['Date', formatEventDate(ev.eventDate, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })],
    ev.startTime && ['Time', `${formatTime(ev.startTime)}${ev.endTime ? ` – ${formatTime(ev.endTime)}` : ''}`],
    ['Location', ev.location],
    ev.categories.length > 0 && ['Categories', String(ev.categories.length)],
    ev.registrationCount > 0 && ['Registered', String(ev.registrationCount)],
    ev.status === 'registration_open' && ev.capacity != null && ['Places left', String(Math.max(0, ev.capacity - ev.registrationCount))],
  ].filter(Boolean) as [string, string][];

  const primary = canRegister ? { href: '#register', label: 'Register now' }
    : live ? { href: '#live', label: 'Live leaderboard' }
    : published ? { href: '#results', label: 'See the results' } : null;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'SportsEvent', name: ev.title,
    description: ev.shortDescription || ev.description.slice(0, 200) || undefined,
    startDate: ev.startTime ? `${ev.eventDate}T${ev.startTime}:00+05:30` : ev.eventDate,
    endDate: ev.endTime ? `${ev.eventDate}T${ev.endTime}:00+05:30` : undefined,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: ev.coverImage ? [ev.coverImage] : undefined,
    location: { '@type': 'Place', name: ev.location, address: { '@type': 'PostalAddress', streetAddress: SITE.address.slice(0, 2).join(', '), addressLocality: 'Pune', addressRegion: 'Maharashtra', postalCode: GYM.postalCode, addressCountry: 'IN' } },
    organizer: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    url: `${SITE.url}/events/${ev.slug}`,
  };

  return (
    <div className="min-h-screen">
      <Seo title={`${ev.title} | Crunch Fitness Events`} description={ev.shortDescription || `${ev.title} at ${ev.location} on ${formatEventDate(ev.eventDate)}.`} image={ev.coverImage || '/images/squat-1200.webp'} type="article" />
      <Helmet><script type="application/ld+json">{JSON.stringify(jsonLd)}</script></Helmet>
      <main>
        {/* OPEN → REVEAL → STATUS → DETAILS → ACTION */}
        <HeroFrame className={cn('event-hero relative isolate flex min-h-[calc(92svh-var(--page-top))] flex-col justify-end overflow-hidden', live && 'is-live')}>
          <div className="absolute inset-0 -z-10" aria-hidden>
            <div className="m-wipe-up absolute inset-0"><img src={cover.src} srcSet={cover.srcSet} sizes="100vw" alt="" {...{ fetchpriority: 'high' }} className="m-settle h-full w-full object-cover" /></div>
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/20" />
          </div>
          <div className="container pb-10 pt-24 md:pb-14">
            <div className="m-rise flex flex-wrap items-center gap-3" style={d(250)}>
              <Hud index="Crunch" label="Fitness" />
              <StatusMark ev={ev} />
            </div>
            <h1 className="mt-6 max-w-5xl font-display text-[clamp(3.25rem,1.5rem+8vw,9.5rem)] font-extrabold uppercase leading-[0.84] text-white text-balance">
              <span className="m-line"><span style={d(380)}>{ev.title}</span></span>
            </h1>
            {ev.shortDescription && <p className="m-rise mt-5 max-w-xl text-lg text-white/80 md:text-xl" style={d(520)}>{ev.shortDescription}</p>}
            <div className="m-rise mt-8 flex flex-wrap items-end gap-x-10 gap-y-6" style={d(620)}>
              <p className="font-display font-extrabold uppercase leading-[0.85] text-white">
                <span className="block text-6xl md:text-7xl">{dd}</span><span className="block text-2xl text-brand-400 md:text-3xl">{mm}</span>
              </p>
              <p className="max-w-[14rem] pb-1 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{ev.location}</p>
              <div className="flex flex-wrap gap-3 pb-1">
                {primary && <Button asChild size="lg"><a href={primary.href}>{primary.label} <ArrowDown /></a></Button>}
                {myPass && <Button asChild size="lg" variant="outline" className="bg-ink-950/40 backdrop-blur-sm"><Link to={`/events/${ev.slug}/pass/${myPass}`}><Ticket /> My pass</Link></Button>}
              </div>
            </div>
          </div>
          <span className="m-fill-x absolute inset-x-0 bottom-0 h-px bg-brand-400" style={d(700)} aria-hidden />
        </HeroFrame>

        {/* DETAILS — the info rail */}
        <section aria-label="Event details" className="border-b border-white/[0.06]">
          <dl className="container grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-3 lg:flex lg:justify-between">
            {info.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="hud">{k}</dt>
                <dd className="mt-2 font-display text-2xl font-bold uppercase leading-tight text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* LIVE */}
        {live && (
          <Section id="live" aria-labelledby="live-heading">
            <div className="flex flex-wrap items-center gap-4">
              <StatusMark ev={ev} />
              <span className="hud">{ev.checkedInCount > 0 ? `${ev.checkedInCount} athletes on the floor` : `${ev.registrationCount} registered`}</span>
            </div>
            <h2 id="live-heading" className="mt-6 font-display text-display-lg font-extrabold uppercase text-white">Live leaderboard</h2>
            {currentCat && (
              <>
                {ev.categories.length > 1 && (
                  <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Category">
                    {ev.categories.map((c) => (
                      <button key={c.id} type="button" aria-pressed={c.id === currentCat.id} onClick={() => setBoardCat(c.id)}
                        className={cn('rounded-full border px-4 py-2 text-sm font-semibold transition-colors', c.id === currentCat.id ? 'border-white bg-white text-ink-950' : 'border-white/15 text-ink-300 hover:text-white')}>
                        {c.name}{c.id === ev.currentCategoryId && <span className="ml-2 text-red-500" aria-label="(now on)">●</span>}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-6 hud">{currentCat.id === ev.currentCategoryId ? 'Now on the floor' : 'Category'} · {currentCat.name}</p>
                <div className="mt-4 rounded-2xl border border-white/[0.08] bg-ink-900 px-4 sm:px-8"><Leaderboard cat={currentCat} results={results} /></div>
                <p className="mt-3 text-xs text-ink-500">Scores update live as the judges enter them. Final positions are confirmed when results are published.</p>
              </>
            )}
          </Section>
        )}

        {ev.status === 'results_pending' && (
          <Section aria-labelledby="pending-heading">
            <h2 id="pending-heading" className="font-display text-display-lg font-extrabold uppercase text-white"><span className="m-line"><span>Results aren’t in yet.</span></span></h2>
            <p className="m-rise mt-4 max-w-lg text-lg text-ink-300" style={d(150)}>The competition is over and the scores are being checked. Final results will appear here once they’re confirmed.</p>
          </Section>
        )}

        {/* RESULTS */}
        {published && (
          <Section id="results" aria-labelledby="results-heading">
            <div className="mb-10 flex items-center gap-4"><Hud index="Final" label="Results" className="m-rise" /><TickRail className="w-24" /></div>
            <h2 id="results-heading" className="font-display text-[clamp(3rem,1.5rem+6vw,7rem)] font-extrabold uppercase leading-[0.86] text-white">
              <span className="m-line"><span>The results</span></span>
            </h2>
            <div className="mt-12 space-y-14">
              {ev.categories.map((c, i) => <Podium key={c.id} cat={c} results={results} index={i} />)}
            </div>
          </Section>
        )}

        {/* ACTION — registration */}
        {ev.status === 'registration_open' && ev.registrationEnabled && (
          <Section id="register" tone="raised" aria-labelledby="register-heading">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <Hud index="Register" label={ev.capacity ? `${Math.max(0, ev.capacity - ev.registrationCount)} places left` : 'Open'} className="m-rise" />
                <h2 id="register-heading" className="mt-5 font-display text-display-lg font-extrabold uppercase text-white"><span className="m-line"><span>Take your place.</span></span></h2>
                {ev.registrationCloseAt && <p className="m-rise mt-4 text-ink-300" style={d(150)}>Registration closes {new Date(ev.registrationCloseAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}.</p>}
              </div>
              <div className="m-rise lg:col-span-7" style={d(200)}><RegisterForm ev={ev} /></div>
            </div>
          </Section>
        )}

        {/* About */}
        {(ev.description || ev.eligibility || ev.rules || ev.categories.length > 0) && (
          <Section aria-labelledby="about-heading">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <h2 id="about-heading" className="font-display text-display-md font-bold uppercase text-white"><span className="m-line"><span>The event</span></span></h2>
                {ev.description && <p className="m-rise mt-6 whitespace-pre-line text-lg leading-relaxed text-ink-200">{ev.description}</p>}
                {ev.rules && (
                  <details className="m-rise mt-8 rounded-2xl border border-white/[0.08] p-5">
                    <summary className="cursor-pointer font-semibold text-white">Rules</summary>
                    <p className="mt-4 whitespace-pre-line text-ink-300">{ev.rules}</p>
                  </details>
                )}
              </div>
              <div className="space-y-8 lg:col-span-5">
                {ev.categories.length > 0 && (
                  <div>
                    <p className="hud">Categories</p>
                    <ul className="mt-4 divide-y divide-white/[0.08] border-y border-white/[0.08]">
                      {ev.categories.map((c, i) => (
                        <li key={c.id} className="flex items-baseline gap-4 py-4">
                          <span className="text-xs font-semibold tabular-nums text-brand-400">{pad(i + 1)}</span>
                          <span className="flex-1 font-display text-xl font-bold uppercase text-white">{c.name}</span>
                          <span className="text-xs text-ink-400">{winsLabel(c)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {ev.eligibility && <div><p className="hud">Who can take part</p><p className="mt-3 whitespace-pre-line text-ink-200">{ev.eligibility}</p></div>}
              </div>
            </div>
          </Section>
        )}

        {/* ARCHIVE — the day, in real photos */}
        {(media.length > 0 || published || ev.status === 'results_pending') && (
          <Section tone="raised" aria-labelledby="day-heading">
            <div className="mb-10 flex items-center gap-4"><Hud index="Archive" label="The day" className="m-rise" /><TickRail className="w-24" /></div>
            <h2 id="day-heading" className="sr-only">Photos from the day</h2>
            {media.length ? (
              <ul className="event-sheet grid auto-rows-[11rem] grid-cols-2 gap-3 md:auto-rows-[15rem] md:grid-cols-4">
                {media.map((m, i) => {
                  const photoIndex = photos.indexOf(m);
                  return (
                    <li key={m.id} className={cn(i === 0 ? 'col-span-2 row-span-2' : i % 5 === 3 ? 'col-span-2' : '', 'overflow-hidden rounded-2xl bg-ink-800')}>
                      {m.type === 'video' ? (
                        <video src={m.url} controls playsInline preload="metadata" className="h-full w-full object-cover" aria-label={m.caption || 'Event video'} />
                      ) : (
                        <button type="button" className="group relative block h-full w-full" aria-label={`View larger: ${m.caption || 'event photo'}`}
                          onClick={(e) => setLightbox({ index: photoIndex, origin: e.currentTarget.querySelector('img')?.getBoundingClientRect() ?? null })}>
                          <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform [transition-duration:900ms] ease-out-expo group-hover:scale-[1.04]" />
                          {m.kind === 'winner' && <span className="hud absolute left-3 top-3 rounded-full bg-ink-950/70 px-2.5 py-1.5 text-brand-400">Winner</span>}
                          {m.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent p-4 pt-10 text-left text-sm text-white">{m.caption}</span>}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="max-w-xl">
                <p className="font-display text-display-md font-extrabold uppercase text-white">The camera is ready.</p>
                <p className="mt-3 text-ink-300">Event highlights will appear here after the competition.</p>
              </div>
            )}
          </Section>
        )}

        <nav aria-label="More events" className="container border-t border-white/[0.06] py-10">
          <Link to="/events" className="link-drive inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-brand-400">All events <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </nav>
      </main>
      <Lightbox images={lbImages} index={lightbox?.index ?? null} onIndexChange={(i) => setLightbox(i === null ? null : { ...lightbox!, index: i })} originRect={lightbox?.origin} />
      <Footer />
    </div>
  );
};

export default EventPage;
