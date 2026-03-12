import { useState, useEffect } from 'react';
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

const COLOR_MAP: Record<string, { bar: string; text: string; badge: string }> = {
  green:  { bar: 'bg-green-500',  text: 'text-white', badge: 'bg-white/25' },
  yellow: { bar: 'bg-yellow-400', text: 'text-black', badge: 'bg-black/15' },
  orange: { bar: 'bg-orange-500', text: 'text-white', badge: 'bg-white/25' },
  red:    { bar: 'bg-red-500',    text: 'text-white', badge: 'bg-white/25' },
  blue:   { bar: 'bg-blue-500',   text: 'text-white', badge: 'bg-white/25' },
  purple: { bar: 'bg-purple-500', text: 'text-white', badge: 'bg-white/25' },
};

const OfferBanner = () => {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [dismissed, setDismissed] = useState(false);

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

  if (!offer || dismissed) return null;

  const style = COLOR_MAP[offer.color] ?? COLOR_MAP.green;

  const handleDismiss = () => {
    sessionStorage.setItem('dismissedOffer', offer.id);
    setDismissed(true);
  };

  return (
    <div className={`${style.bar} ${style.text} relative z-[60] w-full`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold">
        {offer.badge && (
          <span className={`${style.badge} px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0`}>
            {offer.badge}
          </span>
        )}
        <span className="text-center">{offer.title}</span>
        {offer.description && (
          <span className="hidden sm:inline opacity-75">— {offer.description}</span>
        )}
        <button
          onClick={handleDismiss}
          className="ml-2 p-1 rounded-full hover:bg-black/20 transition-colors flex-shrink-0"
          aria-label="Dismiss offer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default OfferBanner;
