import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, trainer as trainerApi, apiLogout } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import {
  Plus, Trash2, LogOut, Eye, EyeOff, Upload,
  CheckCircle, XCircle, Loader, ImageIcon, Tag as TagIcon,
  Users, FileText, Edit2, Crown, Instagram, Megaphone, CreditCard,
  Calendar, Sparkles, Inbox, Phone, Mail, ChevronDown, ChevronUp, Menu, X,
} from 'lucide-react';

// ─── Blog Types ──────────────────────────────────────────────────────────────
interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;

  category: string;
  author: string;
  publishedAt: string | null;
  readTime: number;
  tags: string[];
  published: boolean;
}

const CATEGORIES = ['Fitness Tips', 'Nutrition', 'Workout Guide', 'Success Story', 'News'];

const EMPTY_POST = {
  title: '', slug: '', excerpt: '', content: '',
  category: 'Fitness Tips', author: 'Crunch Fitness Club',
  tags: '', published: false,
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function calcReadTime(text: string) {
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

// ─── Team Types ───────────────────────────────────────────────────────────────
interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialization: string;
  experience: string;
  bio: string;
  image: string;
  instagram: string;
  isOwner: boolean;
  objectPosition: string;
  order: number;
  visible: boolean;
}

const OBJECT_POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'center 20%', 'center 30%'];

const EMPTY_MEMBER = {
  name: '', role: '', specialization: '', experience: '',
  bio: '', instagram: '', isOwner: false,
  objectPosition: 'center', order: 0, visible: true,
};

// ─── Offer Types ──────────────────────────────────────────────────────────────
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

const OFFER_COLORS = ['green', 'yellow', 'orange', 'red', 'blue', 'purple'];
const OFFER_COLOR_PREVIEW: Record<string, string> = {
  green: 'bg-green-500', yellow: 'bg-yellow-400', orange: 'bg-orange-500',
  red: 'bg-red-500', blue: 'bg-blue-500', purple: 'bg-purple-500',
};

const today = () => new Date().toISOString().split('T')[0];
const EMPTY_OFFER = {
  title: '', description: '', badge: '🔥 LIMITED TIME',
  color: 'green', startDate: today(), endDate: today(), active: true,
};

// ─── Enquiry Types ────────────────────────────────────────────────────────────
type EnquiryStatus = 'new' | 'contacted' | 'converted' | 'closed';

interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  message: string;
  submittedAt: string | null;
  status: EnquiryStatus;
  read: boolean;
}

const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: 'New Lead', contacted: 'Contacted', converted: 'Converted', closed: 'Closed',
};
const ENQUIRY_STATUS_COLOR: Record<EnquiryStatus, string> = {
  new: 'bg-green-400/15 text-green-400 border-green-400/30',
  contacted: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
  converted: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
  closed: 'bg-zinc-700 text-gray-400 border-zinc-600',
};
const ENQUIRY_STATUS_NEXT: Record<EnquiryStatus, EnquiryStatus> = {
  new: 'contacted', contacted: 'converted', converted: 'closed', closed: 'new',
};

// ─── Plan Types ───────────────────────────────────────────────────────────────
interface Plan {
  id: string;
  order: number;
  duration: string;
  price: string;
  originalPrice: string;
  description: string;
  features: string[];
  idealFor: string;
  savings: string;
  badge: string;
  isPopular: boolean;
  gradient: string;
  iconName: string;
  ctaText: string;
}

const GRADIENTS = [
  'from-blue-400 to-purple-600', 'from-green-400 to-emerald-600',
  'from-purple-400 to-pink-600', 'from-yellow-400 to-orange-600',
  'from-indigo-400 to-purple-600', 'from-red-400 to-orange-600',
  'from-cyan-400 to-blue-600',
];
const PLAN_ICONS = ['Sparkles', 'Zap', 'Gift', 'Crown', 'Star', 'Shield', 'Award'];

const EMPTY_PLAN = {
  order: 0, duration: '', price: '', originalPrice: '', description: '',
  features: '', idealFor: '', savings: '', badge: '', isPopular: false,
  gradient: 'from-green-400 to-emerald-600', iconName: 'Sparkles', ctaText: 'Get Started',
};

const DEFAULT_PLANS = [
  { order: 0, duration: '1 Day', price: '₹300', originalPrice: '', isPopular: false, badge: 'Trial', iconName: 'Sparkles', gradient: 'from-blue-400 to-purple-600', description: 'Perfect for first-time visitors', features: ['Full gym access for one day', 'All equipment usage', 'Complimentary fitness assessment', 'Trial of group classes', 'Locker facility'], idealFor: 'First-time visitors, travelers', savings: '', ctaText: 'Try Today' },
  { order: 1, duration: '1 Month', price: '₹3,000', originalPrice: '', isPopular: false, badge: 'Starter', iconName: 'Zap', gradient: 'from-green-400 to-emerald-600', description: 'Great for short-term goals', features: ['Complete gym access', 'All equipment usage', 'Basic trainer guidance', 'Locker facility', 'Mobile app access', 'Progress tracking'], idealFor: 'Short-term goals, beginners', savings: '', ctaText: 'Get Started' },
  { order: 2, duration: '3 Months', price: '₹6,500', originalPrice: '₹9,000', isPopular: false, badge: 'Value', iconName: 'Gift', gradient: 'from-purple-400 to-pink-600', description: 'Build lasting fitness habits', features: ['Everything in 1 Month plan', 'Quarterly progress assessment', 'Nutrition consultation session', 'Priority class booking', 'Guest pass (2 per quarter)', 'Diet planning guidance'], idealFor: 'Habit building, seasonal goals', savings: '₹2,500', ctaText: 'Build Habits' },
  { order: 3, duration: '6 Months', price: '₹8,000', originalPrice: '₹18,000', isPopular: true, badge: 'Most Popular', iconName: 'Crown', gradient: 'from-yellow-400 to-orange-600', description: 'Complete transformation package', features: ['Everything in 3 Month plan', 'Bi-weekly trainer consultations', 'Customized workout plans', 'Body composition analysis', 'Guest passes (4 per half-year)', 'Priority equipment access', 'Injury prevention guidance'], idealFor: 'Body transformation, serious goals', savings: '₹10,000', ctaText: 'Transform Now' },
  { order: 4, duration: '12 Months', price: '₹12,000', originalPrice: '₹36,000', isPopular: false, badge: 'Best Value', iconName: 'Star', gradient: 'from-indigo-400 to-purple-600', description: 'Ultimate fitness investment', features: ['Everything in 6 Month plan', 'Monthly personal training sessions', 'Advanced nutrition planning', 'Supplement recommendations', 'VIP member benefits', 'Unlimited guest passes', 'Free merchandise', 'Priority support'], idealFor: 'Long-term commitment, maximum value', savings: '₹24,000', ctaText: 'Maximum Value' },
];

// ─── Duty / Schedule Types ────────────────────────────────────────────────────
const AREAS = ['Cardio Zone', 'Powerlifting', 'CrossFit', 'Yoga & Flexibility', 'Functional Training', 'Boxing', 'Floor Duty'];
const SHIFTS = ['Morning (6am – 2pm)', 'Evening (2pm – 10pm)', 'Full Day (6am – 10pm)'];
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Duty {
  id: string;
  trainerId: string;
  trainerName: string;
  trainerImage: string;
  area: string;
  days: string[];
  shift: string;
  weekStart: string;
}

interface ClassSession {
  id: string;
  trainerId: string;
  trainerName: string;
  title: string;
  area: string;
  date: string;
  startTime: string;
  duration: number;
  capacity: number;
  pin: string;
  pinValidFrom: string;
  pinValidTo: string;
}

interface TrainerAccount {
  id: string;
  email: string;
  name: string;
  trainerId: string;
  role: 'trainer';
}

function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function pinWindow(date: string, startTime: string, duration: number) {
  const base = new Date(`${date}T${startTime}:00`);
  const from = new Date(base.getTime() - 30 * 60 * 1000);
  const to   = new Date(base.getTime() + (duration + 30) * 60 * 1000);
  return { pinValidFrom: from.toISOString(), pinValidTo: to.toISOString() };
}

const EMPTY_DUTY = { trainerId: '', area: AREAS[0], days: [] as string[], shift: SHIFTS[0] };
const EMPTY_SESSION = { trainerId: '', title: '', area: AREAS[0], date: today(), startTime: '06:00', duration: 60, capacity: 20 };

const AREA_COLORS: Record<string, string> = {
  'Cardio Zone':         'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Powerlifting':        'bg-red-500/15 text-red-400 border-red-500/30',
  'CrossFit':            'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Yoga & Flexibility':  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Functional Training': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Boxing':              'bg-pink-500/15 text-pink-400 border-pink-500/30',
  'Floor Duty':          'bg-green-500/15 text-green-400 border-green-500/30',
};

// ─── Component ────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'posts' | 'team' | 'offers' | 'plans' | 'enquiries' | 'roster' | 'schedule' | 'accounts'>('posts');
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Blog state ──
  const [posts, setPosts]           = useState<BlogPost[]>([]);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postForm, setPostForm]     = useState(EMPTY_POST);
  const [postImageFile, setPostImageFile]   = useState<File | null>(null);
  const [postImagePreview, setPostPreview]  = useState('');
  const [postUploadProgress, setPostProgress] = useState(0);
  const [postSaving, setPostSaving] = useState(false);
  const [deletePostConfirm, setDeletePostConfirm] = useState<string | null>(null);
  const postFileRef = useRef<HTMLInputElement>(null);

  // ── Team state ──
  const [members, setMembers]           = useState<TeamMember[]>([]);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm]     = useState(EMPTY_MEMBER);
  const [memberImageFile, setMemberImageFile] = useState<File | null>(null);
  const [memberImagePreview, setMemberPreview] = useState('');
  const [memberUploadProgress, setMemberProgress] = useState(0);
  const [memberSaving, setMemberSaving] = useState(false);
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState<string | null>(null);
  const memberFileRef = useRef<HTMLInputElement>(null);

  // ── Offers state ──
  const [offers, setOffers]                 = useState<Offer[]>([]);
  const [showOfferForm, setShowOfferForm]   = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offerForm, setOfferForm]           = useState(EMPTY_OFFER);
  const [offerSaving, setOfferSaving]       = useState(false);
  const [deleteOfferConfirm, setDeleteOfferConfirm] = useState<string | null>(null);

  // ── Plans state ──
  const [plans, setPlans]               = useState<Plan[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm]         = useState(EMPTY_PLAN);
  const [planSaving, setPlanSaving]     = useState(false);
  const [deletePlanConfirm, setDeletePlanConfirm] = useState<string | null>(null);
  const [seedingPlans, setSeedingPlans] = useState(false);

  // ── Enquiries state ──
  const [enquiries, setEnquiries]         = useState<Enquiry[]>([]);
  const [enquiryFilter, setEnquiryFilter] = useState<EnquiryStatus | 'all'>('all');
  const [expandedEnquiry, setExpandedEnquiry] = useState<string | null>(null);
  const [deleteEnquiryConfirm, setDeleteEnquiryConfirm] = useState<string | null>(null);

  // ── Duty Roster state ──
  const [duties, setDuties]           = useState<Duty[]>([]);
  const [showDutyForm, setShowDutyForm] = useState(false);
  const [editingDutyId, setEditingDutyId] = useState<string | null>(null);
  const [dutyForm, setDutyForm]       = useState({ ...EMPTY_DUTY });
  const [dutySaving, setDutySaving]   = useState(false);
  const [rosterWeek, setRosterWeek]   = useState(getWeekStart());

  // ── Class Sessions state ──
  const [sessions, setSessions]       = useState<ClassSession[]>([]);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({ ...EMPTY_SESSION });
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionDate, setSessionDate] = useState(today());

  // ── Trainer Accounts state ──
  const [trainerAccounts, setTrainerAccounts] = useState<TrainerAccount[]>([]);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ email: '', password: '', name: '', trainerId: '' });
  const [accountSaving, setAccountSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── API data fetchers ──
  const loadPosts    = () => admin.listPosts().then(setPosts).catch(console.error);
  const loadMembers  = () => admin.listTeam().then(setMembers).catch(console.error);
  const loadOffers   = () => admin.listOffers().then(setOffers).catch(console.error);
  const loadPlans    = () => admin.listPlans().then(setPlans).catch(console.error);
  const loadEnquiries = () => admin.listEnquiries().then(setEnquiries).catch(console.error);
  const loadDuties   = (week: string) => admin.listDuties(week).then(setDuties).catch(console.error);
  const loadSessions = (date: string) => admin.listClassSessions({ date }).then(setSessions).catch(console.error);
  const loadTrainerAccounts = () => admin.listTrainerAccounts().then(setTrainerAccounts).catch(console.error);

  useEffect(() => { loadPosts(); }, []);
  useEffect(() => { loadMembers(); }, []);
  useEffect(() => { loadOffers(); }, []);
  useEffect(() => { loadPlans(); }, []);
  useEffect(() => { loadEnquiries(); }, []);
  useEffect(() => { loadDuties(rosterWeek); }, [rosterWeek]);
  useEffect(() => { loadSessions(sessionDate); }, [sessionDate]);
  useEffect(() => { loadTrainerAccounts(); }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Blog handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handlePostImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostImageFile(file);
    setPostPreview(URL.createObjectURL(file));
  };

  const handlePostFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setPostForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'title' ? { slug: slugify(value) } : {}),
    }));
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.title || !postForm.content || !postForm.excerpt) {
      showToast('Title, excerpt and content are required.'); return;
    }
    setPostSaving(true);
    try {
      const newPost = await admin.createPost({
        title: postForm.title, slug: postForm.slug || slugify(postForm.title),
        excerpt: postForm.excerpt, content: postForm.content,
        category: postForm.category, author: postForm.author || 'Crunch Fitness Club',
        tags: postForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        readTime: calcReadTime(postForm.content), published: postForm.published,
      });
      if (postImageFile) {
        setPostProgress(50);
        await admin.uploadPostCover(newPost.id, postImageFile);
        setPostProgress(100);
      }
      setPostForm(EMPTY_POST); setPostImageFile(null); setPostPreview(''); setPostProgress(0);
      setShowPostForm(false); showToast('Post published successfully!');
      await loadPosts();
    } catch (err) { console.error(err); showToast('Error saving post. Try again.'); }
    finally { setPostSaving(false); }
  };

  const handleDeletePost = async (post: BlogPost) => {
    try {
      await admin.deletePost(post.id);
      setDeletePostConfirm(null); showToast('Post deleted.');
      await loadPosts();
    } catch { showToast('Error deleting post.'); }
  };

  const togglePublished = async (post: BlogPost) => {
    await admin.updatePost(post.id, { published: !post.published });
    await loadPosts();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Team handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleMemberImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMemberImageFile(file);
    setMemberPreview(URL.createObjectURL(file));
  };

  const handleMemberFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setMemberForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'order' ? Number(value) : value,
    }));
  };

  const openAddMember = () => {
    setEditingMemberId(null);
    setMemberForm({ ...EMPTY_MEMBER, order: members.length });
    setMemberImageFile(null); setMemberPreview(''); setMemberProgress(0);
    setShowMemberForm(true);
  };

  const openEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setMemberForm({
      name: member.name, role: member.role, specialization: member.specialization,
      experience: member.experience, bio: member.bio, instagram: member.instagram || '',
      isOwner: member.isOwner, objectPosition: member.objectPosition,
      order: member.order, visible: member.visible,
    });
    setMemberImageFile(null); setMemberPreview(member.image); setMemberProgress(0);
    setShowMemberForm(true);
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.name || !memberForm.role) { showToast('Name and role are required.'); return; }
    setMemberSaving(true);
    try {
      const data = {
        name: memberForm.name, role: memberForm.role,
        specialization: memberForm.specialization, experience: memberForm.experience,
        bio: memberForm.bio, instagram: memberForm.instagram,
        isOwner: memberForm.isOwner, objectPosition: memberForm.objectPosition,
        order: memberForm.order, visible: memberForm.visible,
      };

      if (editingMemberId) {
        await admin.updateTeamMember(editingMemberId, data);
        if (memberImageFile) {
          setMemberProgress(50);
          await admin.uploadTeamImage(editingMemberId, memberImageFile);
          setMemberProgress(100);
        }
        showToast('Member updated!');
      } else {
        const newMember = await admin.createTeamMember(data);
        if (memberImageFile) {
          setMemberProgress(50);
          await admin.uploadTeamImage(newMember.id, memberImageFile);
          setMemberProgress(100);
        }
        showToast('Member added!');
      }

      setShowMemberForm(false); setMemberImageFile(null); setMemberPreview(''); setMemberProgress(0);
      await loadMembers();
    } catch (err) { console.error(err); showToast('Error saving member. Try again.'); }
    finally { setMemberSaving(false); }
  };

  const handleDeleteMember = async (member: TeamMember) => {
    try {
      await admin.deleteTeamMember(member.id);
      setDeleteMemberConfirm(null);
      showToast('Member and all associated data removed.');
      await loadMembers();
    } catch { showToast('Error deleting member.'); }
  };

  const toggleMemberVisible = async (member: TeamMember) => {
    await admin.updateTeamMember(member.id, { visible: !member.visible });
    await loadMembers();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Offer handlers
  // ─────────────────────────────────────────────────────────────────────────
  const openAddOffer = () => { setEditingOfferId(null); setOfferForm(EMPTY_OFFER); setShowOfferForm(true); };
  const openEditOffer = (o: Offer) => {
    setEditingOfferId(o.id);
    setOfferForm({ title: o.title, description: o.description, badge: o.badge, color: o.color, startDate: o.startDate, endDate: o.endDate, active: o.active });
    setShowOfferForm(true);
  };
  const handleOfferFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setOfferForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerForm.title) { showToast('Title is required.'); return; }
    setOfferSaving(true);
    try {
      if (editingOfferId) {
        await admin.updateOffer(editingOfferId, { ...offerForm });
        showToast('Offer updated!');
      } else {
        await admin.createOffer({ ...offerForm });
        showToast('Offer created!');
      }
      setShowOfferForm(false);
      await loadOffers();
    } catch (err) { console.error(err); showToast('Error saving offer.'); }
    finally { setOfferSaving(false); }
  };
  const handleDeleteOffer = async (id: string) => {
    try {
      await admin.deleteOffer(id); setDeleteOfferConfirm(null); showToast('Offer deleted.');
      await loadOffers();
    }
    catch { showToast('Error deleting offer.'); }
  };
  const toggleOfferActive = async (o: Offer) => {
    await admin.updateOffer(o.id, { active: !o.active });
    await loadOffers();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Plan handlers
  // ─────────────────────────────────────────────────────────────────────────
  const openAddPlan = () => {
    setEditingPlanId(null);
    setPlanForm({ ...EMPTY_PLAN, order: plans.length });
    setShowPlanForm(true);
  };
  const openEditPlan = (p: Plan) => {
    setEditingPlanId(p.id);
    setPlanForm({ order: p.order, duration: p.duration, price: p.price, originalPrice: p.originalPrice || '', description: p.description, features: p.features.join('\n'), idealFor: p.idealFor, savings: p.savings || '', badge: p.badge, isPopular: p.isPopular, gradient: p.gradient, iconName: p.iconName, ctaText: p.ctaText });
    setShowPlanForm(true);
  };
  const handlePlanFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setPlanForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : name === 'order' ? Number(value) : value }));
  };
  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.duration || !planForm.price) { showToast('Duration and price are required.'); return; }
    setPlanSaving(true);
    try {
      const data = { ...planForm, features: planForm.features.split('\n').map((f) => f.trim()).filter(Boolean) };
      if (editingPlanId) {
        await admin.updatePlan(editingPlanId, data);
        showToast('Plan updated!');
      } else {
        await admin.createPlan(data);
        showToast('Plan added!');
      }
      setShowPlanForm(false);
      await loadPlans();
    } catch (err) { console.error(err); showToast('Error saving plan.'); }
    finally { setPlanSaving(false); }
  };
  const handleDeletePlan = async (id: string) => {
    try {
      await admin.deletePlan(id); setDeletePlanConfirm(null); showToast('Plan deleted.');
      await loadPlans();
    }
    catch { showToast('Error deleting plan.'); }
  };
  const seedDefaultPlans = async () => {
    setSeedingPlans(true);
    try {
      await Promise.all(DEFAULT_PLANS.map((p) => admin.createPlan(p)));
      showToast('Default plans loaded!');
      await loadPlans();
    } catch { showToast('Error seeding plans.'); }
    finally { setSeedingPlans(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Enquiry handlers
  // ─────────────────────────────────────────────────────────────────────────
  const markEnquiryRead = async (id: string) => {
    await admin.updateEnquiry(id, { read: true });
    await loadEnquiries();
  };

  const cycleEnquiryStatus = async (e: Enquiry) => {
    await admin.updateEnquiry(e.id, {
      status: ENQUIRY_STATUS_NEXT[e.status],
      read: true,
    });
    await loadEnquiries();
  };

  const handleDeleteEnquiry = async (id: string) => {
    try {
      await admin.deleteEnquiry(id); setDeleteEnquiryConfirm(null); showToast('Enquiry deleted.');
      await loadEnquiries();
    }
    catch { showToast('Error deleting enquiry.'); }
  };

  const handleLogout = async () => { await apiLogout(); navigate('/admin/login'); };

  // ─────────────────────────────────────────────────────────────────────────
  // Duty Roster handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleDutySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dutyForm.trainerId || dutyForm.days.length === 0) { showToast('Select trainer and at least one day.'); return; }
    setDutySaving(true);
    try {
      const trainerMember = members.find((m) => m.id === dutyForm.trainerId);
      const data = {
        ...dutyForm,
        trainerName: trainerMember?.name ?? '',
        trainerImage: trainerMember?.image ?? '',
        weekStart: rosterWeek,
        weekEnd: getWeekEnd(rosterWeek),
      };
      if (editingDutyId) {
        await admin.updateDuty(editingDutyId, data);
        showToast('Duty updated!');
      } else {
        await admin.createDuty(data);
        showToast('Duty assigned!');
      }
      setShowDutyForm(false);
      setEditingDutyId(null);
      setDutyForm({ ...EMPTY_DUTY });
      await loadDuties(rosterWeek);
    } catch (err) { console.error(err); showToast('Error saving duty.'); }
    finally { setDutySaving(false); }
  };

  const handleDeleteDuty = async (id: string) => {
    try {
      await admin.deleteDuty(id); showToast('Duty removed.');
      await loadDuties(rosterWeek);
    }
    catch { showToast('Error deleting duty.'); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Class Session handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.trainerId || !sessionForm.title) { showToast('Title and trainer are required.'); return; }
    setSessionSaving(true);
    try {
      const trainerMember = members.find((m) => m.id === sessionForm.trainerId);
      const { pinValidFrom, pinValidTo } = pinWindow(sessionForm.date, sessionForm.startTime, sessionForm.duration);
      const data = {
        ...sessionForm,
        trainerName: trainerMember?.name ?? '',
        pinValidFrom,
        pinValidTo,
      };
      if (editingSessionId) {
        await trainerApi.updateClassSession(editingSessionId, data);
        showToast('Session updated!');
      } else {
        await trainerApi.createClassSession({ ...data, pin: generatePin() });
        showToast('Class session created!');
      }
      setShowSessionForm(false);
      setEditingSessionId(null);
      setSessionForm({ ...EMPTY_SESSION, date: sessionDate });
      await loadSessions(sessionDate);
    } catch (err) { console.error(err); showToast('Error saving session.'); }
    finally { setSessionSaving(false); }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await trainerApi.deleteClassSession(id); showToast('Session deleted.');
      await loadSessions(sessionDate);
    }
    catch { showToast('Error deleting session.'); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Trainer Account handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleCreateTrainerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.email || !accountForm.password || !accountForm.trainerId) {
      showToast('Email, password and trainer are required.'); return;
    }
    setAccountSaving(true);
    try {
      const trainerMember = members.find((m) => m.id === accountForm.trainerId);
      await admin.createTrainerAccount({
        email: accountForm.email,
        password: accountForm.password,
        name: trainerMember?.name ?? accountForm.name,
        trainerId: accountForm.trainerId,
      });
      showToast('Trainer account created!');
      setShowAccountForm(false);
      setAccountForm({ email: '', password: '', name: '', trainerId: '' });
      await loadTrainerAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating account.';
      showToast(msg.includes('already') ? 'Email already in use.' : msg);
    } finally {
      setAccountSaving(false);
    }
  };

  const handleDeleteTrainerAccount = async (uid: string) => {
    try {
      await admin.deleteTrainerAccount(uid);
      showToast('Trainer account and schedule data removed.');
      await loadTrainerAccounts();
    } catch { showToast('Error removing account.'); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-zinc-950 text-white flex overflow-hidden">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed top-0 left-0 h-screen w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <img src="/lovable-uploads/crunch.png" alt="logo" className="h-10 w-auto object-contain" />
            <p className="text-xs text-gray-500 mt-1 truncate">{user?.email}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('posts'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'posts' ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <FileText size={16} /> Blog Posts
            <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{posts.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('team'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'team' ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Users size={16} /> Team & Trainers
            <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{members.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('offers'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'offers' ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Megaphone size={16} /> Offers & Promos
            <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{offers.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('plans'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'plans' ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <CreditCard size={16} /> Membership Plans
            <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{plans.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('enquiries'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'enquiries' ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Inbox size={16} /> Enquiries
            {enquiries.filter((e) => !e.read).length > 0 ? (
              <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {enquiries.filter((e) => !e.read).length}
              </span>
            ) : (
              <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{enquiries.length}</span>
            )}
          </button>

          {/* Trainer section divider */}
          <p className="px-3 pt-4 pb-1 text-[10px] font-bold text-gray-600 uppercase tracking-widest">Trainer Portal</p>
          <button
            onClick={() => { setActiveTab('roster'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'roster' ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Calendar size={16} /> Duty Roster
          </button>
          <button
            onClick={() => { setActiveTab('schedule'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'schedule' ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Sparkles size={16} /> Class Schedule
            <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{sessions.length}</span>
          </button>
          <button
            onClick={() => { setActiveTab('accounts'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'accounts' ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`}
          >
            <Crown size={16} /> Trainer Accounts
            <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{trainerAccounts.length}</span>
          </button>
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 md:ml-60 flex flex-col h-screen overflow-hidden w-full">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-green-400 text-black px-5 py-3 rounded-xl shadow-xl font-semibold text-sm animate-fade-in">
            {toast}
          </div>
        )}

        {/* Top bar */}
        <header className="flex-shrink-0 z-30 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="font-bold text-white text-base">
                {activeTab === 'posts' && 'Blog Posts'}
                {activeTab === 'team' && 'Team & Trainers'}
                {activeTab === 'offers' && 'Offers & Promotions'}
                {activeTab === 'plans' && 'Membership Plans'}
                {activeTab === 'enquiries' && 'Customer Enquiries'}
                {activeTab === 'roster' && 'Duty Roster'}
                {activeTab === 'schedule' && 'Class Schedule'}
                {activeTab === 'accounts' && 'Trainer Accounts'}
              </h1>
              <p className="text-xs text-gray-500">Crunch Fitness Club — Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'posts' && (
              <button onClick={() => { setShowPostForm(true); setPostForm(EMPTY_POST); setPostPreview(''); setPostImageFile(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all duration-200 hover:scale-105">
                <Plus size={16} /> New Post
              </button>
            )}
            {activeTab === 'team' && (
              <button onClick={openAddMember}
                className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all duration-200 hover:scale-105">
                <Plus size={16} /> Add Member
              </button>
            )}
            {activeTab === 'offers' && (
              <button onClick={openAddOffer}
                className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all duration-200 hover:scale-105">
                <Plus size={16} /> New Offer
              </button>
            )}
            {activeTab === 'plans' && (
              <button onClick={openAddPlan}
                className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all duration-200 hover:scale-105">
                <Plus size={16} /> Add Plan
              </button>
            )}
            {activeTab === 'roster' && (
              <button onClick={() => { setEditingDutyId(null); setDutyForm({ ...EMPTY_DUTY }); setShowDutyForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all duration-200 hover:scale-105">
                <Plus size={16} /> Assign Duty
              </button>
            )}
            {activeTab === 'schedule' && (
              <button onClick={() => { setEditingSessionId(null); setSessionForm({ ...EMPTY_SESSION, date: sessionDate }); setShowSessionForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all duration-200 hover:scale-105">
                <Plus size={16} /> Add Class
              </button>
            )}
            {activeTab === 'accounts' && (
              <button onClick={() => { setAccountForm({ email: '', password: '', name: '', trainerId: '' }); setShowAccountForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all duration-200 hover:scale-105">
                <Plus size={16} /> Create Login
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6 w-full">

        {/* ── Blog Posts Tab ── */}
        {activeTab === 'posts' && (
          <>
            <h2 className="text-2xl font-heading font-bold mb-6">
              All Posts <span className="text-gray-500 text-base font-normal">({posts.length})</span>
            </h2>
            {posts.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No posts yet. Click "New Post" to create your first article.
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                      {post.coverImage
                        ? <img src={post.coverImage} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-zinc-600" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{post.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{post.excerpt}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{post.category}</span>
                        <span className="text-xs text-gray-600">{post.readTime} min read</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => togglePublished(post)}
                        title={post.published ? 'Unpublish' : 'Publish'}
                        className={`p-2 rounded-xl transition-colors ${post.published ? 'bg-green-400/15 text-green-400 hover:bg-green-400/25' : 'bg-zinc-800 text-gray-500 hover:bg-zinc-700'}`}
                      >
                        {post.published ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button
                        onClick={() => setDeletePostConfirm(post.id)}
                        className="p-2 rounded-xl bg-zinc-800 text-gray-500 hover:bg-red-400/15 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Team Members Tab ── */}
        {activeTab === 'team' && (
          <>
            <h2 className="text-2xl font-heading font-bold mb-6">
              Team Members <span className="text-gray-500 text-base font-normal">({members.length})</span>
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Changes here update the Team page live. Use <span className="text-gray-300 font-semibold">Order</span> to control display sequence. Toggle visibility to show/hide a member without deleting them.
            </p>
            {members.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No team members yet. Click "Add Member" to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                    {/* Photo */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                      {member.image
                        ? <img src={member.image} alt={member.name} className="w-full h-full object-cover" style={{ objectPosition: member.objectPosition }} />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-zinc-600" /></div>
                      }
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold text-sm truncate">{member.name}</p>
                        {member.isOwner && <Crown size={13} className="text-yellow-400 flex-shrink-0" />}
                      </div>
                      <p className="text-green-400 text-xs mt-0.5">{member.role}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{member.experience}</span>
                        <span className="text-xs text-gray-700">·</span>
                        <span className="text-xs text-gray-500">Order #{member.order}</span>
                        {!member.visible && (
                          <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">Hidden</span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleMemberVisible(member)}
                        title={member.visible ? 'Hide member' : 'Show member'}
                        className={`p-2 rounded-xl transition-colors ${member.visible ? 'bg-green-400/15 text-green-400 hover:bg-green-400/25' : 'bg-zinc-800 text-gray-500 hover:bg-zinc-700'}`}
                      >
                        {member.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button
                        onClick={() => openEditMember(member)}
                        className="p-2 rounded-xl bg-zinc-800 text-gray-400 hover:bg-blue-400/15 hover:text-blue-400 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteMemberConfirm(member.id)}
                        className="p-2 rounded-xl bg-zinc-800 text-gray-500 hover:bg-red-400/15 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Offers Tab ── */}
        {activeTab === 'offers' && (
          <>
            <h2 className="text-2xl font-heading font-bold mb-2">Offers & Promotions</h2>
            <p className="text-gray-500 text-sm mb-6">Active offers within their date range appear as a banner on all public pages.</p>
            {offers.length === 0 ? (
              <div className="text-center py-20 text-gray-500">No offers yet. Click "New Offer" to create a promotion.</div>
            ) : (
              <div className="space-y-3">
                {offers.map((offer) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isLive = offer.active && offer.startDate <= todayStr && offer.endDate >= todayStr;
                  return (
                    <div key={offer.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                      <div className={`w-3 h-12 rounded-full flex-shrink-0 ${OFFER_COLOR_PREVIEW[offer.color] ?? 'bg-green-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold text-sm truncate">{offer.title}</p>
                          {isLive && <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex-shrink-0">LIVE</span>}
                          {!offer.active && <span className="text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0">Inactive</span>}
                        </div>
                        {offer.description && <p className="text-gray-500 text-xs mt-0.5 truncate">{offer.description}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar size={11} className="text-gray-600" />
                          <span className="text-xs text-gray-600">{offer.startDate} → {offer.endDate}</span>
                          {offer.badge && <span className="text-xs text-gray-400 bg-zinc-800 px-2 py-0.5 rounded-full">{offer.badge}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => toggleOfferActive(offer)} title={offer.active ? 'Deactivate' : 'Activate'}
                          className={`p-2 rounded-xl transition-colors ${offer.active ? 'bg-green-400/15 text-green-400 hover:bg-green-400/25' : 'bg-zinc-800 text-gray-500 hover:bg-zinc-700'}`}>
                          {offer.active ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button onClick={() => openEditOffer(offer)} className="p-2 rounded-xl bg-zinc-800 text-gray-400 hover:bg-blue-400/15 hover:text-blue-400 transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => setDeleteOfferConfirm(offer.id)} className="p-2 rounded-xl bg-zinc-800 text-gray-500 hover:bg-red-400/15 hover:text-red-400 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Plans Tab ── */}
        {activeTab === 'plans' && (
          <>
            <h2 className="text-2xl font-heading font-bold mb-2">Membership Plans</h2>
            <p className="text-gray-500 text-sm mb-6">Changes update the Plans page live. Prices, features, and details are fully editable.</p>
            {plans.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles size={32} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No plans yet.</p>
                <button onClick={seedDefaultPlans} disabled={seedingPlans}
                  className="px-6 py-3 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm transition-all flex items-center gap-2 mx-auto">
                  {seedingPlans ? <Loader size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  {seedingPlans ? 'Loading…' : 'Load Default Plans'}
                </button>
                <p className="text-gray-600 text-xs mt-3">This seeds all 5 default plans so you can start editing them.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-bold">#{plan.order}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold text-sm">{plan.duration}</p>
                        {plan.isPopular && <Crown size={13} className="text-yellow-400" />}
                        <span className="text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full">{plan.badge}</span>
                      </div>
                      <p className="text-green-400 text-sm font-bold mt-0.5">{plan.price}
                        {plan.originalPrice && <span className="text-gray-600 line-through text-xs ml-2">{plan.originalPrice}</span>}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{plan.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => openEditPlan(plan)} className="p-2 rounded-xl bg-zinc-800 text-gray-400 hover:bg-blue-400/15 hover:text-blue-400 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => setDeletePlanConfirm(plan.id)} className="p-2 rounded-xl bg-zinc-800 text-gray-500 hover:bg-red-400/15 hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Enquiries Tab ── */}
        {activeTab === 'enquiries' && (() => {
          const unread = enquiries.filter((e) => !e.read).length;
          const filtered = enquiryFilter === 'all' ? enquiries : enquiries.filter((e) => e.status === enquiryFilter);
          const statusCounts = {
            all: enquiries.length,
            new: enquiries.filter((e) => e.status === 'new').length,
            contacted: enquiries.filter((e) => e.status === 'contacted').length,
            converted: enquiries.filter((e) => e.status === 'converted').length,
            closed: enquiries.filter((e) => e.status === 'closed').length,
          };
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-heading font-bold">
                    Enquiries <span className="text-gray-500 text-base font-normal">({enquiries.length})</span>
                  </h2>
                  {unread > 0 && (
                    <p className="text-sm text-red-400 mt-0.5">{unread} unread</p>
                  )}
                </div>
                {/* Filter pills */}
                <div className="flex flex-wrap gap-2">
                  {(['all', 'new', 'contacted', 'converted', 'closed'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setEnquiryFilter(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        enquiryFilter === s
                          ? 'bg-green-400 text-black border-green-400'
                          : 'bg-zinc-900 border-zinc-700 text-gray-400 hover:border-zinc-500'
                      }`}
                    >
                      {s === 'all' ? 'All' : ENQUIRY_STATUS_LABEL[s]} ({statusCounts[s]})
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <Inbox size={40} className="mx-auto mb-3 text-zinc-700" />
                  {enquiries.length === 0
                    ? 'No enquiries yet. They will appear here when someone submits the contact form.'
                    : 'No enquiries match this filter.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((enq) => {
                    const isExpanded = expandedEnquiry === enq.id;
                    const date = enq.submittedAt
                      ? new Date(enq.submittedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—';
                    return (
                      <div
                        key={enq.id}
                        className={`bg-zinc-900 border rounded-2xl transition-colors ${!enq.read ? 'border-green-500/40' : 'border-zinc-800'}`}
                        onClick={() => { if (!enq.read) markEnquiryRead(enq.id); }}
                      >
                        {/* Card header */}
                        <div className="p-4 flex items-start gap-4">
                          {/* Unread dot */}
                          <div className="flex-shrink-0 mt-1.5">
                            {!enq.read
                              ? <div className="w-2 h-2 rounded-full bg-green-400" />
                              : <div className="w-2 h-2 rounded-full bg-zinc-700" />
                            }
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-white font-semibold text-sm">{enq.name}</span>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ENQUIRY_STATUS_COLOR[enq.status]}`}>
                                {ENQUIRY_STATUS_LABEL[enq.status]}
                              </span>
                              {enq.plan && (
                                <span className="text-[11px] text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full">
                                  {enq.plan}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                              {enq.email && (
                                <span className="flex items-center gap-1"><Mail size={11} />{enq.email}</span>
                              )}
                              {enq.phone && (
                                <span className="flex items-center gap-1"><Phone size={11} />{enq.phone}</span>
                              )}
                              <span>{date}</span>
                            </div>
                            {/* Message preview / expanded */}
                            {enq.message && (
                              <p className={`text-gray-400 text-xs mt-2 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                                {enq.message}
                              </p>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {enq.message && (
                              <button
                                onClick={(ev) => { ev.stopPropagation(); setExpandedEnquiry(isExpanded ? null : enq.id); }}
                                className="p-2 rounded-xl bg-zinc-800 text-gray-400 hover:bg-zinc-700 transition-colors"
                                title={isExpanded ? 'Collapse' : 'Expand message'}
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </button>
                            )}
                            <button
                              onClick={(ev) => { ev.stopPropagation(); cycleEnquiryStatus(enq); }}
                              className="px-3 py-1.5 rounded-xl bg-zinc-800 text-gray-300 hover:bg-zinc-700 text-xs font-semibold transition-colors whitespace-nowrap"
                              title={`Move to: ${ENQUIRY_STATUS_LABEL[ENQUIRY_STATUS_NEXT[enq.status]]}`}
                            >
                              → {ENQUIRY_STATUS_LABEL[ENQUIRY_STATUS_NEXT[enq.status]]}
                            </button>
                            <button
                              onClick={(ev) => { ev.stopPropagation(); setDeleteEnquiryConfirm(enq.id); }}
                              className="p-2 rounded-xl bg-zinc-800 text-gray-500 hover:bg-red-400/15 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
        {/* ── Duty Roster Tab ── */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            {/* Week picker */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-semibold text-gray-400">Week starting:</label>
              <input
                type="date"
                value={rosterWeek}
                onChange={(e) => setRosterWeek(e.target.value)}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400"
              />
              <button
                onClick={() => setRosterWeek(getWeekStart())}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl text-sm font-semibold transition-all"
              >
                This Week
              </button>
              <button
                onClick={() => { const d = new Date(rosterWeek); d.setDate(d.getDate() + 7); setRosterWeek(d.toISOString().split('T')[0]); }}
                className="px-3 py-2 bg-green-400/10 hover:bg-green-400/20 text-green-400 border border-green-400/20 rounded-xl text-sm font-semibold transition-all"
              >
                Next Week →
              </button>
              <span className="text-xs text-gray-600 ml-auto">{rosterWeek} → {getWeekEnd(rosterWeek)}</span>
            </div>

            {/* Roster grid */}
            {WEEK_DAYS.map((day) => {
              const dayDuties = duties.filter((d) => d.days.includes(day));
              return (
                <div key={day} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-zinc-800/50 border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{day}</span>
                    <span className="text-xs text-gray-500">{dayDuties.length} trainer{dayDuties.length !== 1 ? 's' : ''} assigned</span>
                  </div>
                  {dayDuties.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-600">No duties assigned.</p>
                  ) : (
                    <div className="divide-y divide-zinc-800">
                      {dayDuties.map((duty) => (
                        <div key={duty.id} className="flex items-center gap-3 px-4 py-3">
                          {duty.trainerImage
                            ? <img src={duty.trainerImage} alt={duty.trainerName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            : <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-400">{duty.trainerName?.[0]}</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{duty.trainerName}</p>
                            <p className="text-xs text-gray-500">{duty.shift}</p>
                          </div>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${AREA_COLORS[duty.area] ?? AREA_COLORS['Floor Duty']}`}>
                            {duty.area}
                          </span>
                          <button onClick={() => handleDeleteDuty(duty.id)} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Class Schedule Tab ── */}
        {activeTab === 'schedule' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-semibold text-gray-400">Date:</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400"
              />
              <button onClick={() => setSessionDate(today())} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl text-sm font-semibold">Today</button>
            </div>

            {sessions.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                <p className="text-gray-500 text-sm">No classes scheduled for this date.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-white">{s.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${AREA_COLORS[s.area] ?? AREA_COLORS['Floor Duty']}`}>{s.area}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.trainerName} · {s.startTime} · {s.duration} min · Cap {s.capacity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-zinc-800 rounded-lg px-3 py-1.5 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">PIN</p>
                        <p className="font-mono font-black text-green-400 text-lg tracking-widest">{s.pin}</p>
                      </div>
                      <button
                        onClick={() => { setEditingSessionId(s.id); setSessionForm({ trainerId: s.trainerId, title: s.title, area: s.area, date: s.date, startTime: s.startTime, duration: s.duration, capacity: s.capacity }); setShowSessionForm(true); }}
                        className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all"
                      ><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteSession(s.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Trainer Accounts Tab ── */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-xs text-gray-400 flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">⚠</span>
              Trainer logins are created with email + password. They can only see their own schedule and duty — not blog, plans, or enquiries.
              <a href="/checkin" target="_blank" rel="noopener noreferrer" className="ml-auto text-green-400 whitespace-nowrap hover:underline">Member check-in →</a>
            </div>

            {trainerAccounts.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                <Crown size={32} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No trainer accounts yet. Create one to give portal access.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trainerAccounts.map((acc) => {
                  const member = members.find((m) => m.id === acc.trainerId);
                  return (
                    <div key={acc.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-4">
                      {member?.image
                        ? <img src={member.image} alt={acc.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-gray-400 flex-shrink-0">{acc.name?.[0]}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">{acc.name}</p>
                        <p className="text-xs text-gray-500">{acc.email}</p>
                      </div>
                      <span className="text-xs bg-green-400/10 text-green-400 border border-green-400/20 px-2 py-0.5 rounded-full">Trainer</span>
                      <button onClick={() => handleDeleteTrainerAccount(acc.id)} className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        </main>
      </div> {/* end main content area */}

      {/* ═══════════════════════════════════════════════════════════════════════
          Blog Post Form Modal
      ═══════════════════════════════════════════════════════════════════════ */}
      {showPostForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-lg">New Blog Post</h3>
              <button onClick={() => setShowPostForm(false)} className="text-gray-400 hover:text-white transition-colors">
                <XCircle size={22} />
              </button>
            </div>
            <form onSubmit={handlePostSubmit} className="p-6 space-y-5">
              {/* Cover image */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Cover Image</label>
                <div
                  onClick={() => postFileRef.current?.click()}
                  className="relative h-40 rounded-xl border-2 border-dashed border-zinc-700 hover:border-green-400/60 cursor-pointer overflow-hidden transition-colors"
                >
                  {postImagePreview
                    ? <img src={postImagePreview} alt="preview" className="w-full h-full object-cover" />
                    : <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><Upload size={24} /><span className="text-sm">Click to upload image</span></div>
                  }
                </div>
                <input ref={postFileRef} type="file" accept="image/*" onChange={handlePostImageChange} className="hidden" />
                {postUploadProgress > 0 && postUploadProgress < 100 && (
                  <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 transition-all" style={{ width: `${postUploadProgress}%` }} />
                  </div>
                )}
              </div>
              {/* Title + Slug */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Title *</label>
                  <input name="title" value={postForm.title} onChange={handlePostFormChange} placeholder="Your blog title" required
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Slug (auto)</label>
                  <input name="slug" value={postForm.slug} onChange={handlePostFormChange} placeholder="url-slug"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
                </div>
              </div>
              {/* Category + Author */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Category</label>
                  <select name="category" value={postForm.category} onChange={handlePostFormChange}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm transition-colors">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Author</label>
                  <input name="author" value={postForm.author} onChange={handlePostFormChange} placeholder="Author name"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
                </div>
              </div>
              {/* Excerpt */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Short Excerpt *</label>
                <textarea name="excerpt" value={postForm.excerpt} onChange={handlePostFormChange} rows={2} placeholder="A one-line summary shown on blog cards…" required
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors resize-none" />
              </div>
              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Full Content *</label>
                <textarea name="content" value={postForm.content} onChange={handlePostFormChange} rows={12} placeholder="Write your full article here…" required
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors resize-none" />
                <p className="text-gray-600 text-xs mt-1">
                  ~{calcReadTime(postForm.content)} min read · {postForm.content.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5 flex items-center gap-1">
                  <TagIcon size={13} /> Tags (comma separated)
                </label>
                <input name="tags" value={postForm.tags} onChange={handlePostFormChange} placeholder="fitness, weight loss, gym tips"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
              </div>
              {/* Publish toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setPostForm((f) => ({ ...f, published: !f.published }))}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${postForm.published ? 'bg-green-400' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${postForm.published ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-300">{postForm.published ? 'Publish immediately' : 'Save as draft'}</span>
              </label>
              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPostForm(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-semibold rounded-xl transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={postSaving}
                  className="flex-1 py-3 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm">
                  {postSaving ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {postSaving ? 'Saving…' : 'Save Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Team Member Form Modal
      ═══════════════════════════════════════════════════════════════════════ */}
      {showMemberForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-lg">
                {editingMemberId ? 'Edit Team Member' : 'Add Team Member'}
              </h3>
              <button onClick={() => setShowMemberForm(false)} className="text-gray-400 hover:text-white transition-colors">
                <XCircle size={22} />
              </button>
            </div>
            <form onSubmit={handleMemberSubmit} className="p-6 space-y-5">
              {/* Photo upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Photo</label>
                <div
                  onClick={() => memberFileRef.current?.click()}
                  className="relative h-48 rounded-xl border-2 border-dashed border-zinc-700 hover:border-green-400/60 cursor-pointer overflow-hidden transition-colors"
                >
                  {memberImagePreview
                    ? <img src={memberImagePreview} alt="preview" className="w-full h-full object-cover" style={{ objectPosition: memberForm.objectPosition }} />
                    : <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><Upload size={24} /><span className="text-sm">Click to upload photo</span></div>
                  }
                </div>
                <input ref={memberFileRef} type="file" accept="image/*" onChange={handleMemberImageChange} className="hidden" />
                {memberUploadProgress > 0 && memberUploadProgress < 100 && (
                  <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 transition-all" style={{ width: `${memberUploadProgress}%` }} />
                  </div>
                )}
              </div>

              {/* Name + Role */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Name *</label>
                  <input name="name" value={memberForm.name} onChange={handleMemberFormChange} placeholder="e.g. Nilima Patil" required
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Role *</label>
                  <input name="role" value={memberForm.role} onChange={handleMemberFormChange} placeholder="e.g. Founder & Head Trainer" required
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
                </div>
              </div>

              {/* Specialization + Experience */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Specialization</label>
                  <input name="specialization" value={memberForm.specialization} onChange={handleMemberFormChange} placeholder="e.g. Weight Training, Fat Loss"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Experience</label>
                  <input name="experience" value={memberForm.experience} onChange={handleMemberFormChange} placeholder="e.g. 5+ Years"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Bio</label>
                <textarea name="bio" value={memberForm.bio} onChange={handleMemberFormChange} rows={3}
                  placeholder="Short bio shown on hover…"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors resize-none" />
              </div>

              {/* Instagram + Object Position */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Instagram size={13} /> Instagram URL
                  </label>
                  <input name="instagram" value={memberForm.instagram} onChange={handleMemberFormChange} placeholder="https://instagram.com/username"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Photo Position</label>
                  <select name="objectPosition" value={memberForm.objectPosition} onChange={handleMemberFormChange}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm transition-colors">
                    {OBJECT_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <p className="text-gray-600 text-xs mt-1">Controls which part of the photo is visible</p>
                </div>
              </div>

              {/* Order */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Display Order</label>
                  <input type="number" name="order" value={memberForm.order} onChange={handleMemberFormChange} min={0}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm transition-colors" />
                  <p className="text-gray-600 text-xs mt-1">Lower number = appears first</p>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => setMemberForm((f) => ({ ...f, isOwner: !f.isOwner }))}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${memberForm.isOwner ? 'bg-yellow-400' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${memberForm.isOwner ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm text-gray-300 flex items-center gap-1.5">
                    <Crown size={13} className="text-yellow-400" /> Mark as Gym Owner
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => setMemberForm((f) => ({ ...f, visible: !f.visible }))}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${memberForm.visible ? 'bg-green-400' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${memberForm.visible ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm text-gray-300">
                    {memberForm.visible ? 'Visible on Team page' : 'Hidden from Team page'}
                  </span>
                </label>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowMemberForm(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-semibold rounded-xl transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={memberSaving}
                  className="flex-1 py-3 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm">
                  {memberSaving ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {memberSaving ? 'Saving…' : editingMemberId ? 'Update Member' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Delete Confirm Modals
      ═══════════════════════════════════════════════════════════════════════ */}
      {deletePostConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
            <h4 className="text-white font-bold text-lg mb-2">Delete this post?</h4>
            <p className="text-gray-400 text-sm mb-6">This action cannot be undone. The post and its image will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletePostConfirm(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm transition-colors">Cancel</button>
              <button onClick={() => { const p = posts.find((x) => x.id === deletePostConfirm); if (p) handleDeletePost(p); }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl font-bold text-sm transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteMemberConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
            <h4 className="text-white font-bold text-lg mb-2">Remove this member?</h4>
            <p className="text-gray-400 text-sm mb-6">This will remove them from the Team page. Their photo will also be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteMemberConfirm(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm transition-colors">Cancel</button>
              <button onClick={() => { const m = members.find((x) => x.id === deleteMemberConfirm); if (m) handleDeleteMember(m); }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl font-bold text-sm transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Offer Form Modal ═══ */}
      {showOfferForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-lg">{editingOfferId ? 'Edit Offer' : 'New Offer'}</h3>
              <button onClick={() => setShowOfferForm(false)} className="text-gray-400 hover:text-white"><XCircle size={22} /></button>
            </div>
            <form onSubmit={handleOfferSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Title *</label>
                <input name="title" value={offerForm.title} onChange={handleOfferFormChange} required placeholder="e.g. Summer Special – 20% Off!"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Subtitle / Description</label>
                <input name="description" value={offerForm.description} onChange={handleOfferFormChange} placeholder="e.g. Valid on 6-month plans only"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Badge Text</label>
                  <input name="badge" value={offerForm.badge} onChange={handleOfferFormChange} placeholder="🔥 LIMITED TIME"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Banner Color</label>
                  <select name="color" value={offerForm.color} onChange={handleOfferFormChange}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm">
                    {OFFER_COLORS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Start Date</label>
                  <input type="date" name="startDate" value={offerForm.startDate} onChange={handleOfferFormChange}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">End Date</label>
                  <input type="date" name="endDate" value={offerForm.endDate} onChange={handleOfferFormChange}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setOfferForm((f) => ({ ...f, active: !f.active }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${offerForm.active ? 'bg-green-400' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${offerForm.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-300">{offerForm.active ? 'Active' : 'Inactive'}</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowOfferForm(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-semibold rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={offerSaving}
                  className="flex-1 py-3 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                  {offerSaving ? <Loader size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  {offerSaving ? 'Saving…' : editingOfferId ? 'Update' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Plan Form Modal ═══ */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-lg">{editingPlanId ? 'Edit Plan' : 'Add Plan'}</h3>
              <button onClick={() => setShowPlanForm(false)} className="text-gray-400 hover:text-white"><XCircle size={22} /></button>
            </div>
            <form onSubmit={handlePlanSubmit} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Duration *</label>
                  <input name="duration" value={planForm.duration} onChange={handlePlanFormChange} required placeholder="e.g. 6 Months"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Price *</label>
                  <input name="price" value={planForm.price} onChange={handlePlanFormChange} required placeholder="₹8,000"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Original Price</label>
                  <input name="originalPrice" value={planForm.originalPrice} onChange={handlePlanFormChange} placeholder="₹18,000 (strikethrough)"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Savings Label</label>
                  <input name="savings" value={planForm.savings} onChange={handlePlanFormChange} placeholder="₹10,000"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Badge</label>
                  <input name="badge" value={planForm.badge} onChange={handlePlanFormChange} placeholder="Most Popular"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">CTA Button Text</label>
                  <input name="ctaText" value={planForm.ctaText} onChange={handlePlanFormChange} placeholder="Get Started"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Description</label>
                <input name="description" value={planForm.description} onChange={handlePlanFormChange} placeholder="Short tagline shown under the duration"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Features <span className="text-gray-500 font-normal">(one per line)</span></label>
                <textarea name="features" value={planForm.features} onChange={handlePlanFormChange} rows={6}
                  placeholder={"Full gym access\nPersonal trainer sessions\nNutrition consultation"}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Ideal For</label>
                <input name="idealFor" value={planForm.idealFor} onChange={handlePlanFormChange} placeholder="e.g. Body transformation, serious goals"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm" />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Gradient</label>
                  <select name="gradient" value={planForm.gradient} onChange={handlePlanFormChange}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm">
                    {GRADIENTS.map((g) => <option key={g} value={g}>{g.replace('from-', '').replace(' to-', ' → ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Icon</label>
                  <select name="iconName" value={planForm.iconName} onChange={handlePlanFormChange}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm">
                    {PLAN_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Display Order</label>
                  <input type="number" name="order" value={planForm.order} onChange={handlePlanFormChange} min={0}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setPlanForm((f) => ({ ...f, isPopular: !f.isPopular }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${planForm.isPopular ? 'bg-yellow-400' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${planForm.isPopular ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-300 flex items-center gap-1.5"><Crown size={13} className="text-yellow-400" /> Mark as Most Popular</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPlanForm(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-semibold rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={planSaving}
                  className="flex-1 py-3 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                  {planSaving ? <Loader size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  {planSaving ? 'Saving…' : editingPlanId ? 'Update Plan' : 'Add Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Offer Delete Confirm ═══ */}
      {deleteOfferConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
            <h4 className="text-white font-bold text-lg mb-2">Delete this offer?</h4>
            <p className="text-gray-400 text-sm mb-6">The banner will stop showing immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteOfferConfirm(null)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={() => handleDeleteOffer(deleteOfferConfirm)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl font-bold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Plan Delete Confirm ═══ */}
      {deletePlanConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
            <h4 className="text-white font-bold text-lg mb-2">Delete this plan?</h4>
            <p className="text-gray-400 text-sm mb-6">It will be removed from the Plans page immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletePlanConfirm(null)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={() => handleDeletePlan(deletePlanConfirm)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl font-bold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Enquiry Delete Confirm ═══ */}
      {deleteEnquiryConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
            <h4 className="text-white font-bold text-lg mb-2">Delete this enquiry?</h4>
            <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteEnquiryConfirm(null)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
              <button onClick={() => handleDeleteEnquiry(deleteEnquiryConfirm)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl font-bold text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Duty Form Modal ═══ */}
      {showDutyForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-lg">{editingDutyId ? 'Edit Duty' : 'Assign Duty'}</h3>
              <button onClick={() => setShowDutyForm(false)} className="text-gray-400 hover:text-white"><XCircle size={22} /></button>
            </div>
            <form onSubmit={handleDutySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Trainer *</label>
                <select
                  value={dutyForm.trainerId}
                  onChange={(e) => setDutyForm((p) => ({ ...p, trainerId: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400"
                >
                  <option value="">Select trainer…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Area *</label>
                <select
                  value={dutyForm.area}
                  onChange={(e) => setDutyForm((p) => ({ ...p, area: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400"
                >
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Shift *</label>
                <select
                  value={dutyForm.shift}
                  onChange={(e) => setDutyForm((p) => ({ ...p, shift: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400"
                >
                  {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Days on duty *</label>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setDutyForm((p) => ({
                        ...p,
                        days: p.days.includes(day) ? p.days.filter((d) => d !== day) : [...p.days, day],
                      }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        dutyForm.days.includes(day)
                          ? 'bg-green-400 text-black border-green-400'
                          : 'bg-zinc-800 text-gray-400 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDutyForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                <button type="submit" disabled={dutySaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                  {dutySaving ? <Loader size={16} className="animate-spin" /> : editingDutyId ? 'Update' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Session Form Modal ═══ */}
      {showSessionForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-lg">{editingSessionId ? 'Edit Class' : 'Add Class Session'}</h3>
              <button onClick={() => setShowSessionForm(false)} className="text-gray-400 hover:text-white"><XCircle size={22} /></button>
            </div>
            <form onSubmit={handleSessionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Class Title *</label>
                <input
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Cardio Blast, Deadlift Workshop"
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Trainer *</label>
                  <select
                    value={sessionForm.trainerId}
                    onChange={(e) => setSessionForm((p) => ({ ...p, trainerId: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400"
                  >
                    <option value="">Select…</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Area</label>
                  <select
                    value={sessionForm.area}
                    onChange={(e) => setSessionForm((p) => ({ ...p, area: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400"
                  >
                    {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Date</label>
                  <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Start Time</label>
                  <input type="time" value={sessionForm.startTime} onChange={(e) => setSessionForm((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Duration (min)</label>
                  <input type="number" min={15} max={180} value={sessionForm.duration} onChange={(e) => setSessionForm((p) => ({ ...p, duration: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Capacity</label>
                <input type="number" min={1} max={200} value={sessionForm.capacity} onChange={(e) => setSessionForm((p) => ({ ...p, capacity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
              </div>
              {!editingSessionId && (
                <p className="text-xs text-gray-500 bg-zinc-800 rounded-lg px-3 py-2">
                  A 6-digit PIN is auto-generated. It activates 30 min before the class and expires 30 min after it ends.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSessionForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                <button type="submit" disabled={sessionSaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                  {sessionSaving ? <Loader size={16} className="animate-spin" /> : editingSessionId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Trainer Account Form Modal ═══ */}
      {showAccountForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-lg">Create Trainer Login</h3>
              <button onClick={() => setShowAccountForm(false)} className="text-gray-400 hover:text-white"><XCircle size={22} /></button>
            </div>
            <form onSubmit={handleCreateTrainerAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Link to Trainer *</label>
                <select
                  value={accountForm.trainerId}
                  onChange={(e) => {
                    const m = members.find((x) => x.id === e.target.value);
                    setAccountForm((p) => ({ ...p, trainerId: e.target.value, name: m?.name ?? p.name }));
                  }}
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400"
                >
                  <option value="">Select trainer profile…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Login Email *</label>
                <input
                  type="email"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="trainer@gmail.com"
                  required
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Password *</label>
                <input
                  type="password"
                  value={accountForm.password}
                  onChange={(e) => setAccountForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <p className="text-xs text-gray-500 bg-zinc-800 rounded-lg px-3 py-2">
                Share this email + password with the trainer. They log in at <span className="text-green-400">/trainer/login</span>
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAccountForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                <button type="submit" disabled={accountSaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                  {accountSaving ? <Loader size={16} className="animate-spin" /> : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
