export type AdminTab = 'posts' | 'team' | 'offers' | 'plans' | 'enquiries' | 'roster' | 'schedule' | 'accounts';
export const ADMIN_TABS: AdminTab[] = ['posts', 'team', 'offers', 'plans', 'enquiries', 'roster', 'schedule', 'accounts'];

/** Every place the sidebar can point at: new Admin 2.0 routes, or legacy dashboard tabs. */
export type NavKey = 'dashboard' | 'members' | 'trainers' | 'attendance' | 'events' | 'payments' | 'dues' | 'revenue' | 'reports' | 'activity' | 'settings' | AdminTab;
