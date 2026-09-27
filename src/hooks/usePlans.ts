import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Plan {
  id: string;
  duration: string;
  price: string;
  originalPrice?: string | null;
  description?: string;
  features: string[];
  idealFor?: string;
  savings?: string | null;
  badge?: string;
  isPopular?: boolean;
  ctaText?: string;
}

// Shown until (or if) the admin has not published plans to Firestore
const FALLBACK_PLANS: Plan[] = [
  {
    id: 'static-1d', duration: '1 Day', price: '₹300', badge: 'Trial',
    description: 'Perfect for first-time visitors',
    features: ['Full gym access for one day', 'All equipment usage', 'Complimentary fitness assessment', 'Trial of group classes', 'Locker facility'],
    idealFor: 'First-time visitors, travelers', ctaText: 'Try today',
  },
  {
    id: 'static-1m', duration: '1 Month', price: '₹3,000', badge: 'Starter',
    description: 'Great for short-term goals',
    features: ['Complete gym access', 'All equipment usage', 'Basic trainer guidance', 'Locker facility', 'Mobile app access', 'Progress tracking'],
    idealFor: 'Short-term goals, beginners', ctaText: 'Get started',
  },
  {
    id: 'static-3m', duration: '3 Months', price: '₹6,500', originalPrice: '₹9,000', savings: '₹2,500', badge: 'Value',
    description: 'Build lasting fitness habits',
    features: ['Everything in 1 Month plan', 'Quarterly progress assessment', 'Nutrition consultation session', 'Priority class booking', 'Guest pass (2 per quarter)', 'Diet planning guidance'],
    idealFor: 'Habit building, seasonal goals', ctaText: 'Build habits',
  },
  {
    id: 'static-6m', duration: '6 Months', price: '₹8,000', originalPrice: '₹18,000', savings: '₹10,000', badge: 'Most Popular', isPopular: true,
    description: 'Complete transformation package',
    features: ['Everything in 3 Month plan', 'Bi-weekly trainer consultations', 'Customized workout plans', 'Body composition analysis', 'Guest passes (4 per half-year)', 'Priority equipment access', 'Injury prevention guidance'],
    idealFor: 'Body transformation, serious goals', ctaText: 'Transform now',
  },
  {
    id: 'static-12m', duration: '12 Months', price: '₹12,000', originalPrice: '₹36,000', savings: '₹24,000', badge: 'Best Value',
    description: 'Ultimate fitness investment',
    features: ['Everything in 6 Month plan', 'Monthly personal training sessions', 'Advanced nutrition planning', 'Supplement recommendations', 'VIP member benefits', 'Unlimited guest passes', 'Free merchandise', 'Priority support'],
    idealFor: 'Long-term commitment, maximum value', ctaText: 'Maximum value',
  },
];

/** Live membership plans from Firestore (`plans`, ordered), falling back to the static list. */
export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'plans'), orderBy('order', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        setPlans(snap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, ...data, features: Array.isArray(data.features) ? data.features : [] } as Plan;
        }));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  return { plans: !loading && plans.length > 0 ? plans : FALLBACK_PLANS, loading };
}
