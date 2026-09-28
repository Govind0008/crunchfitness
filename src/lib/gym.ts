// The gym this deployment runs for — one typed place for identity, money and access settings.
//
// Today there is one gym (Crunch Fitness Club) and its details come from `SITE`, the public
// site's single source of truth, so nothing is duplicated. When a second gym is provisioned, the
// same shape moves to a Firestore document (gyms/{gymId}) and `GYM` becomes that document —
// see PRODUCTION_CONFIGURATION.md → "Provisioning another gym". Nothing reads a gyms/ collection yet.
import { HOURS_LABELS, SITE } from './site';

export interface GymConfig {
  id: string;
  name: string;
  logo: string;
  address: readonly string[];
  postalCode: string;
  phone: string;
  email: string;
  whatsappNumber: string;
  timezone: string;
  currency: 'INR';
  hours: readonly { days: string; time: string }[];
  payments: {
    /** Receipt numbers are `${receiptPrefix}${4-digit sequence}` — CR-R-0001 */
    receiptPrefix: string;
    methods: readonly ('cash' | 'upi' | 'card' | 'bank_transfer' | 'other')[];
    /** No GST/tax registration is configured, so receipts are payment receipts, not tax invoices */
    tax: null | { gstin: string; ratePercent: number };
  };
  /** Physical access control (biometric door). Not connected until the device model is confirmed. */
  access: { provider: null | string };
}

const postalCode = SITE.address.join(' ').match(/\b(\d{6})\b/)?.[1] ?? '';

export const GYM: GymConfig = {
  id: 'crunch-wakad',
  name: SITE.name,
  logo: '/images/logo.webp',
  address: SITE.address,
  postalCode,
  phone: SITE.phone,
  email: SITE.email,
  whatsappNumber: SITE.whatsappNumber,
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  hours: HOURS_LABELS,
  payments: { receiptPrefix: 'CR-R-', methods: ['cash', 'upi', 'card', 'bank_transfer', 'other'], tax: null },
  access: { provider: null },
};

export const receiptNumber = (seq: number, prefix = GYM.payments.receiptPrefix) => `${prefix}${String(seq).padStart(4, '0')}`;
