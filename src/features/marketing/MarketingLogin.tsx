import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase-auth';
import { db } from '@/lib/firebase';
import { useRevealOnMount } from '@/hooks/useScrollReveal';
import Seo from '@/components/site/Seo';

const field = 'h-14 w-full border-0 border-b border-white/20 bg-transparent px-0 text-lg text-white placeholder:text-ink-600 focus:border-brand-400 focus:outline-none focus:ring-0';

/** /marketing/login — the same Firebase sign-in as the admin, for the marketing team's workspace. */
const MarketingLogin = () => {
  const navigate = useNavigate();
  const stage = useRevealOnMount<HTMLDivElement>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const role = await getDoc(doc(db, 'userRoles', cred.user.uid)).then((d) => d.data()?.role as string | undefined).catch(() => undefined);
      if (role === 'marketing' || role === 'admin') { navigate('/marketing'); return; }
      await signOut(auth);
      setError('This account isn’t on the marketing team. Ask the gym owner for access.');
    } catch {
      setError('That email and password don’t match. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <div ref={stage} className="grid min-h-screen bg-ink-950 text-white lg:grid-cols-[1.1fr_1fr]">
      <Seo title="Creative Desk sign in | Crunch Fitness" description="Marketing team sign in" noindex />
      {/* The picture: the gym itself, not decoration */}
      <div className="relative h-56 overflow-hidden sm:h-72 lg:h-auto">
        <div className="m-wipe-up absolute inset-0">
          <img src="/images/hero-deadlift-1200.webp" srcSet="/images/hero-deadlift-640.webp 640w, /images/hero-deadlift-1200.webp 1200w" sizes="(min-width: 1024px) 55vw, 100vw"
            alt="" className="m-settle h-full w-full object-cover object-center" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-ink-950/30 lg:to-ink-950" aria-hidden />
        <p className="hud absolute left-5 top-5 text-white/80 sm:left-8 sm:top-8">Crunch Fitness</p>
      </div>

      <main className="flex items-center px-5 pb-16 pt-2 sm:px-10 lg:px-16 lg:py-16">
        <div className="w-full max-w-md">
          <p className="hud text-brand-400 m-rise">The Creative Desk</p>
          <h1 className="mt-5 font-display text-5xl font-bold uppercase leading-[0.9] sm:text-6xl">
            <span className="m-line"><span>Build the brand.</span></span>
            <span className="m-line"><span style={{ transitionDelay: '90ms' }} className="text-brand-400">Tell the story.</span></span>
          </h1>

          <form onSubmit={submit} className="m-rise mt-12 space-y-8" style={{ '--d': 180 } as CSSProperties} noValidate>
            <div>
              <label htmlFor="mk-email" className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Email</label>
              <input id="mk-email" type="email" autoComplete="email" required className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="mk-password" className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Password</label>
              <div className="relative">
                <input id="mk-password" type={show ? 'text' : 'password'} autoComplete="current-password" required className={`${field} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-400 hover:text-white">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button type="submit" disabled={busy || !email || !password}
              className="group flex h-14 w-full items-center justify-between rounded-full bg-brand-400 pl-7 pr-2 text-base font-bold text-ink-950 transition-colors hover:bg-brand-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-ink-500">
              {busy ? 'Signing in…' : 'Enter Marketing Desk'}
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-950 text-brand-400 transition-transform duration-200 group-hover:translate-x-0.5 group-disabled:bg-white/10 group-disabled:text-ink-500"><ArrowRight size={18} /></span>
            </button>
          </form>
          <p className="mt-10 text-xs text-ink-500">Gym staff running members and payments? <Link to="/admin/login" className="text-ink-300 underline-offset-4 hover:underline">Admin sign in</Link></p>
        </div>
      </main>
    </div>
  );
};

export default MarketingLogin;
