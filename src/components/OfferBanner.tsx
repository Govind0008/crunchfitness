import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X } from 'lucide-react';

interface Offer {
  id: string;
  title: string;
  description: string;
  badge: string;
  color: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

interface Props {
  onVisibilityChange?: (visible: boolean) => void;
}

const COLOR_MAP: Record<string, { bar: string; text: string; badge: string }> = {
  green:  { bar: 'bg-green-500',  text: 'text-white', badge: 'bg-white/25' },
  yellow: { bar: 'bg-yellow-400', text: 'text-black', badge: 'bg-black/15' },
  orange: { bar: 'bg-orange-500', text: 'text-white', badge: 'bg-white/25' },
  red:    { bar: 'bg-red-500',    text: 'text-white', badge: 'bg-white/25' },
  blue:   { bar: 'bg-blue-500',   text: 'text-white', badge: 'bg-white/25' },
  purple: { bar: 'bg-purple-500', text: 'text-white', badge: 'bg-white/25' },
};

const OfferBanner = ({ onVisibilityChange }: Props) => {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const visible = !!offer && !dismissed;

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'offers'), (snap) => {
      const today = new Date().toISOString().split('T')[0];
      const dismissedId = sessionStorage.getItem('dismissedOffer');
      const active = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Offer))
        .find((o) => o.active && o.startDate <= today && o.endDate >= today && o.id !== dismissedId);
      setOffer(active ?? null);
    });
    return unsub;
  }, []);

  const handleDismiss = useCallback(() => {
    if (!offer) return;
    sessionStorage.setItem('dismissedOffer', offer.id);
    setDismissed(true);
  }, [offer]);

  if (!visible || !offer) return null;

  const style = COLOR_MAP[offer.color] ?? COLOR_MAP.green;

  // Build one marquee segment — repeated 8× for seamless infinite scroll
  const segments = Array.from({ length: 8 }).map((_, i) => (
    <span key={i} className="inline-flex items-center gap-3 px-10 flex-shrink-0">
      {offer.badge && (
        <span className={`${style.badge} px-2.5 py-0.5 rounded-full text-xs font-bold`}>
          {offer.badge}
        </span>
      )}
      <span className="font-semibold">{offer.title}</span>
      {offer.description && (
        <span className="opacity-75">— {offer.description}</span>
      )}
      <span className="opacity-30 mx-1">✦</span>
    </span>
  ));

  return (
    <div className={`${style.bar} ${style.text} fixed top-0 left-0 right-0 z-[61] h-9 flex items-center overflow-hidden`}>
      {/* Scrolling track — duplicated so the loop is seamless */}
      <div className="animate-marquee flex whitespace-nowrap text-sm select-none">
        {segments}
        {segments.map((s, i) => <span key={`dup-${i}`}>{s}</span>)}
      </div>

      {/* Dismiss — always pinned to the right */}
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/20 transition-colors z-10 flex-shrink-0"
        aria-label="Dismiss offer"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default OfferBanner;
