// Website content and sales records managed from the admin: blog posts, team profiles, offers,
// membership plans and enquiries. The same documents and writes the old dashboard used — moved
// here so the redesigned screens (and the marketing desk) share one implementation.
import {
  collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where, type Unsubscribe,
} from 'firebase/firestore';
import { addDoc, deleteDoc, updateDoc } from '@/lib/admin/writes';
import { db } from '@/lib/firebase';
import { logAdmin, type AdminActor } from './activity';

const audit = (actor: AdminActor, action: string, refType: string, meta: Record<string, string | number | boolean | null> = {}) =>
  logAdmin(actor, action, refType, null, meta);
// The last snapshot of each list, so returning to a page shows it at once while the live
// listener catches up (in memory only).
const lastRows = new Map<string, unknown[]>();
const listen = <T,>(key: string, q: ReturnType<typeof query> | ReturnType<typeof collection>, cb: (rows: T[]) => void, onError: (e: Error) => void): Unsubscribe => {
  const seen = lastRows.get(key);
  if (seen) cb(seen as T[]);
  return onSnapshot(q, (s) => { const rows = s.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T); lastRows.set(key, rows); cb(rows); }, onError);
};

// ── Blog ─────────────────────────────────────────────────────────────────────
export interface BlogPost {
  id: string; title: string; slug: string; excerpt: string; content: string; coverImage: string; category: string; author: string;
  publishedAt: { seconds: number; toDate?: () => Date } | null; readTime: number; tags: string[]; published: boolean; seoTitle?: string; seoDescription?: string;
}
export const CATEGORIES = ['Fitness Tips', 'Nutrition', 'Workout Guide', 'Success Story', 'News'];
export interface PostInput { title: string; slug: string; excerpt: string; content: string; category: string; author: string; tags: string; published: boolean; seoTitle: string; seoDescription: string }
export const EMPTY_POST: PostInput = { title: '', slug: '', excerpt: '', content: '', category: 'Fitness Tips', author: 'Crunch Fitness Club', tags: '', published: false, seoTitle: '', seoDescription: '' };
export const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const readTime = (text: string) => Math.max(1, Math.ceil(text.split(/\s+/).length / 200));

export const watchPosts = (cb: (p: BlogPost[]) => void, onError: (e: Error) => void) => listen('posts', query(collection(db, 'posts'), orderBy('publishedAt', 'desc')), cb, onError);
export async function savePost(i: PostInput, coverImage: string | null, actor: AdminActor, editingId?: string) {
  const fields = {
    title: i.title, slug: i.slug || slugify(i.title), excerpt: i.excerpt, content: i.content, category: i.category, author: i.author || 'Crunch Fitness Club',
    tags: i.tags.split(',').map((t) => t.trim()).filter(Boolean), readTime: readTime(i.content), published: i.published,
    seoTitle: i.seoTitle.trim(), seoDescription: i.seoDescription.trim(),
  };
  if (editingId) await updateDoc(doc(db, 'posts', editingId), { ...fields, ...(coverImage ? { coverImage } : {}) });   // keeps the original date and cover
  else await addDoc(collection(db, 'posts'), { ...fields, coverImage: coverImage ?? '', publishedAt: serverTimestamp() });
  audit(actor, editingId ? 'Blog post updated' : i.published ? 'Blog post published' : 'Blog draft saved', 'post', { title: i.title });
}
export const setPostPublished = (p: BlogPost, published: boolean, actor: AdminActor) =>
  updateDoc(doc(db, 'posts', p.id), { published }).then(() => audit(actor, published ? 'Blog post published' : 'Blog post unpublished', 'post', { title: p.title }));
export const deletePost = (p: BlogPost, actor: AdminActor) => deleteDoc(doc(db, 'posts', p.id)).then(() => audit(actor, 'Blog post deleted', 'post', { title: p.title }));

// ── Team ─────────────────────────────────────────────────────────────────────
export interface TeamProfile {
  id: string; name: string; role: string; specialization: string; experience: string; bio: string; image: string; instagram: string;
  isOwner: boolean; objectPosition: string; order: number; visible: boolean;
}
export type TeamInput = Omit<TeamProfile, 'id' | 'image'>;
export const EMPTY_TEAM: TeamInput = { name: '', role: '', specialization: '', experience: '', bio: '', instagram: '', isOwner: false, objectPosition: 'center', order: 0, visible: true };
export const OBJECT_POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'center 20%', 'center 30%'];
export const watchTeam = (cb: (t: TeamProfile[]) => void, onError: (e: Error) => void) => listen('team', query(collection(db, 'teamMembers'), orderBy('order', 'asc')), cb, onError);
export async function saveTeamProfile(i: TeamInput, image: string, actor: AdminActor, editingId?: string) {
  const data = { ...i, image };
  if (editingId) await updateDoc(doc(db, 'teamMembers', editingId), data);
  else await addDoc(collection(db, 'teamMembers'), data);
  audit(actor, editingId ? 'Team profile updated' : 'Team profile added', 'team', { name: i.name });
}
export const setTeamVisible = (t: TeamProfile, visible: boolean) => updateDoc(doc(db, 'teamMembers', t.id), { visible });
/** Removes the profile and what hangs off it: their trainer login and any old roster/class records. */
export async function deleteTeamProfile(t: TeamProfile, actor: AdminActor) {
  const [duties, sessions, roles] = await Promise.all([
    getDocs(query(collection(db, 'duties'), where('trainerId', '==', t.id))),
    getDocs(query(collection(db, 'classSessions'), where('trainerId', '==', t.id))),
    getDocs(query(collection(db, 'userRoles'), where('trainerId', '==', t.id))),
  ]);
  await Promise.all([...duties.docs, ...sessions.docs, ...roles.docs].map((d) => deleteDoc(d.ref)).concat(deleteDoc(doc(db, 'teamMembers', t.id))));
  audit(actor, 'Team profile removed', 'team', { name: t.name });
}

// ── Offers ───────────────────────────────────────────────────────────────────
export interface Offer { id: string; title: string; description: string; badge: string; color: string; startDate: string; endDate: string; active: boolean }
export type OfferInput = Omit<Offer, 'id'>;
export const OFFER_COLORS = ['green', 'yellow', 'orange', 'red', 'blue', 'purple'];
export const OFFER_SWATCH: Record<string, string> = { green: 'bg-green-500', yellow: 'bg-yellow-400', orange: 'bg-orange-500', red: 'bg-red-500', blue: 'bg-blue-500', purple: 'bg-purple-500' };
export type OfferStatus = 'active' | 'scheduled' | 'expired' | 'draft';
/** Same rules the site's banner uses: switched off = draft; otherwise by its dates. */
export const offerStatus = (o: Pick<Offer, 'active' | 'startDate' | 'endDate'>, today: string): OfferStatus =>
  o.endDate < today ? 'expired' : !o.active ? 'draft' : o.startDate > today ? 'scheduled' : 'active';
export const watchOffers = (cb: (o: Offer[]) => void, onError: (e: Error) => void) => listen('offers', collection(db, 'offers'), cb, onError);
export async function saveOffer(i: OfferInput, actor: AdminActor, editingId?: string) {
  if (editingId) await updateDoc(doc(db, 'offers', editingId), { ...i });
  else await addDoc(collection(db, 'offers'), { ...i });
  audit(actor, editingId ? 'Offer updated' : 'Offer created', 'offer', { title: i.title });
}
export const setOfferActive = (o: Offer, active: boolean) => updateDoc(doc(db, 'offers', o.id), { active });
export const deleteOffer = (o: Offer, actor: AdminActor) => deleteDoc(doc(db, 'offers', o.id)).then(() => audit(actor, 'Offer deleted', 'offer', { title: o.title }));

// ── Plans ────────────────────────────────────────────────────────────────────
export interface Plan {
  id: string; order: number; duration: string; price: string; originalPrice: string; description: string; features: string[]; idealFor: string;
  savings: string; badge: string; isPopular: boolean; gradient: string; iconName: string; ctaText: string;
}
export type PlanInput = Omit<Plan, 'id' | 'features'> & { features: string };
export const GRADIENTS = ['from-blue-400 to-purple-600', 'from-green-400 to-emerald-600', 'from-purple-400 to-pink-600', 'from-yellow-400 to-orange-600', 'from-indigo-400 to-purple-600', 'from-red-400 to-orange-600', 'from-cyan-400 to-blue-600'];
export const PLAN_ICONS = ['Sparkles', 'Zap', 'Gift', 'Crown', 'Star', 'Shield', 'Award'];
export const EMPTY_PLAN: PlanInput = { order: 0, duration: '', price: '', originalPrice: '', description: '', features: '', idealFor: '', savings: '', badge: '', isPopular: false, gradient: 'from-green-400 to-emerald-600', iconName: 'Sparkles', ctaText: 'Get Started' };
export const watchPlans = (cb: (p: Plan[]) => void, onError: (e: Error) => void) => listen('plans', query(collection(db, 'plans'), orderBy('order', 'asc')), cb, onError);
export async function savePlan(i: PlanInput, actor: AdminActor, editingId?: string) {
  const data = { ...i, features: i.features.split('\n').map((f) => f.trim()).filter(Boolean) };
  if (editingId) await updateDoc(doc(db, 'plans', editingId), data);
  else await addDoc(collection(db, 'plans'), data);
  audit(actor, editingId ? 'Plan changed' : 'Plan added', 'plan', { name: i.duration, price: i.price });
}
export const deletePlan = (p: Plan, actor: AdminActor) => deleteDoc(doc(db, 'plans', p.id)).then(() => audit(actor, 'Plan deleted', 'plan', { name: p.duration }));

// ── Enquiries ────────────────────────────────────────────────────────────────
export type EnquiryStatus = 'new' | 'contacted' | 'follow_up' | 'converted' | 'closed';
export const ENQUIRY_STATUS: Record<EnquiryStatus, string> = { new: 'New', contacted: 'Contacted', follow_up: 'Follow-up', converted: 'Converted', closed: 'Closed' };
export const ENQUIRY_SOURCES = ['Website', 'Walk-in', 'Phone call', 'WhatsApp', 'Instagram', 'Referral', 'Other'] as const;
export interface Enquiry {
  id: string; name: string; email: string; phone: string; plan: string; message: string; submittedAt: { seconds: number; toDate?: () => Date } | null;
  status: EnquiryStatus; read: boolean; notes?: string;
  /** Where it came from — enquiries from the website form have no source field */
  source?: string;
  followUpOn?: string | null;
  lastContactAt?: { seconds: number; toDate?: () => Date } | null;
}
export const enquirySource = (e: Pick<Enquiry, 'source'>) => e.source || 'Website';
/** The newest 500 live (the counts on the dashboard and sidebar are separate count queries). */
export const ENQUIRY_WINDOW = 500;
export const watchEnquiries = (cb: (e: Enquiry[]) => void, onError: (e: Error) => void) => listen('enquiries', query(collection(db, 'enquiries'), orderBy('submittedAt', 'desc'), limit(ENQUIRY_WINDOW)), cb, onError);
export async function addEnquiry(i: { name: string; phone: string; email: string; plan: string; message: string; source: string; followUpOn: string }, actor: AdminActor) {
  await addDoc(collection(db, 'enquiries'), {
    name: i.name.trim(), phone: i.phone.trim(), email: i.email.trim(), plan: i.plan, message: i.message.trim(), source: i.source,
    followUpOn: i.followUpOn || null, status: 'new', read: true, notes: '', submittedAt: serverTimestamp(), createdBy: actor.email,
  });
  audit(actor, 'Enquiry added', 'enquiry', { name: i.name.trim(), source: i.source });
}
/** New → Contacted → Follow-up → Converted → Closed. Contacting someone records when. */
export async function setEnquiryStatus(e: Enquiry, status: EnquiryStatus, actor: AdminActor) {
  await updateDoc(doc(db, 'enquiries', e.id), { status, read: true, ...(status === 'contacted' || status === 'follow_up' ? { lastContactAt: serverTimestamp() } : {}) });
  audit(actor, 'Enquiry status changed', 'enquiry', { name: e.name, status: ENQUIRY_STATUS[status] });
}
export const saveEnquiryDetails = (e: Enquiry, patch: { notes?: string; followUpOn?: string | null }) => updateDoc(doc(db, 'enquiries', e.id), patch);
export const markEnquiryRead = (e: Enquiry) => (e.read ? Promise.resolve() : updateDoc(doc(db, 'enquiries', e.id), { read: true }));
export const deleteEnquiry = (e: Enquiry, actor: AdminActor) => deleteDoc(doc(db, 'enquiries', e.id)).then(() => audit(actor, 'Enquiry deleted', 'enquiry', { name: e.name }));

/** Pictures for blog covers and team photos go to the site's Cloudinary account (public site media). */
export const uploadImage = async (file: File, onProgress?: (p: number) => void) => (await import('@/lib/cloudinary')).uploadToCloudinary(file, onProgress).then((r) => r.url);
