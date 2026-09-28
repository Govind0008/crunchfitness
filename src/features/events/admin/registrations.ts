import type { Registration, RegistrationStatus } from '@/lib/events';

export const REG_LABEL: Record<RegistrationStatus, string> = { registered: 'Registered', checked_in: 'Checked in', no_show: 'No-show' };
export const REG_PILL: Record<RegistrationStatus, string> = { registered: 'bg-white/10 text-ink-200', checked_in: 'bg-brand-400 text-ink-950', no_show: 'bg-red-500/15 text-red-200' };

/** Name / number search used by the list and the check-in screen. */
export function matchReg(r: Registration, q: string) {
  const s = q.trim().toLowerCase().replace(/^cr-?/, '');
  if (!s) return true;
  return r.name.toLowerCase().includes(s) || String(r.number) === s.replace(/^0+/, '') || r.phone.replace(/\D/g, '').endsWith(s.replace(/\D/g, '') || '∅');
}
