import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  Plus, Trash2, LogOut, Eye, EyeOff, Upload,
  CheckCircle, XCircle, Loader, ImageIcon, Tag as TagIcon,
  Users, FileText, Edit2, Crown, Instagram, Megaphone, CreditCard,
  Calendar, Sparkles, Inbox, Phone, Mail, ChevronDown, ChevronUp,
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
  publishedAt: { seconds: number } | null;
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
  submittedAt: { seconds: number } | null;
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

// ─── Component ────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'posts' | 'team' | 'offers' | 'plans' | 'enquiries'>('posts');
  const [toast, setToast] = useState('');

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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Firestore listeners ──
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('publishedAt', 'desc'));
    return onSnapshot(q, (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost)))
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'teamMembers'), orderBy('order', 'asc'));
    return onSnapshot(q, (snap) =>
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamMember)))
    );
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'offers'), (snap) =>
      setOffers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Offer)))
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'plans'), orderBy('order', 'asc'));
    return onSnapshot(q, (snap) =>
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Plan)))
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'enquiries'), orderBy('submittedAt', 'desc'));
    return onSnapshot(q, (snap) =>
      setEnquiries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enquiry)))
    );
  }, []);

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

  const uploadToCloudinary = (file: File, onProgress: (p: number) => void): Promise<string> =>
    new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', 'crunchfitness_upload');
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => { const d = JSON.parse(xhr.responseText); d.secure_url ? resolve(d.secure_url) : reject(new Error('Upload failed')); };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('POST', 'https://api.cloudinary.com/v1_1/dkvlsn98d/image/upload');
      xhr.send(fd);
    });

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.title || !postForm.content || !postForm.excerpt) {
      showToast('Title, excerpt and content are required.'); return;
    }
    setPostSaving(true);
    try {
      let coverImage = '';
      if (postImageFile) {
        coverImage = await uploadToCloudinary(postImageFile, setPostProgress);
      }
      await addDoc(collection(db, 'posts'), {
        title: postForm.title, slug: postForm.slug || slugify(postForm.title),
        excerpt: postForm.excerpt, content: postForm.content, coverImage,
        category: postForm.category, author: postForm.author || 'Crunch Fitness Club',
        tags: postForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
        readTime: calcReadTime(postForm.content), published: postForm.published,
        publishedAt: serverTimestamp(),
      });
      setPostForm(EMPTY_POST); setPostImageFile(null); setPostPreview(''); setPostProgress(0);
      setShowPostForm(false); showToast('Post published successfully!');
    } catch (err) { console.error(err); showToast('Error saving post. Try again.'); }
    finally { setPostSaving(false); }
  };

  const handleDeletePost = async (post: BlogPost) => {
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      setDeletePostConfirm(null); showToast('Post deleted.');
    } catch { showToast('Error deleting post.'); }
  };

  const togglePublished = async (post: BlogPost) =>
    updateDoc(doc(db, 'posts', post.id), { published: !post.published });

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
      let image = memberImagePreview;

      if (memberImageFile) {
        image = await uploadToCloudinary(memberImageFile, setMemberProgress);
      }

      const data = {
        name: memberForm.name, role: memberForm.role,
        specialization: memberForm.specialization, experience: memberForm.experience,
        bio: memberForm.bio, instagram: memberForm.instagram,
        isOwner: memberForm.isOwner, objectPosition: memberForm.objectPosition,
        order: memberForm.order, visible: memberForm.visible,
        image,
      };

      if (editingMemberId) {
        await updateDoc(doc(db, 'teamMembers', editingMemberId), data);
        showToast('Member updated!');
      } else {
        await addDoc(collection(db, 'teamMembers'), data);
        showToast('Member added!');
      }

      setShowMemberForm(false); setMemberImageFile(null); setMemberPreview('');
    } catch (err) { console.error(err); showToast('Error saving member. Try again.'); }
    finally { setMemberSaving(false); }
  };

  const handleDeleteMember = async (member: TeamMember) => {
    try {
      await deleteDoc(doc(db, 'teamMembers', member.id));
      setDeleteMemberConfirm(null); showToast('Member removed.');
    } catch { showToast('Error deleting member.'); }
  };

  const toggleMemberVisible = async (member: TeamMember) =>
    updateDoc(doc(db, 'teamMembers', member.id), { visible: !member.visible });

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
        await updateDoc(doc(db, 'offers', editingOfferId), { ...offerForm });
        showToast('Offer updated!');
      } else {
        await addDoc(collection(db, 'offers'), { ...offerForm });
        showToast('Offer created!');
      }
      setShowOfferForm(false);
    } catch (err) { console.error(err); showToast('Error saving offer.'); }
    finally { setOfferSaving(false); }
  };
  const handleDeleteOffer = async (id: string) => {
    try { await deleteDoc(doc(db, 'offers', id)); setDeleteOfferConfirm(null); showToast('Offer deleted.'); }
    catch { showToast('Error deleting offer.'); }
  };
  const toggleOfferActive = (o: Offer) => updateDoc(doc(db, 'offers', o.id), { active: !o.active });

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
        await updateDoc(doc(db, 'plans', editingPlanId), data);
        showToast('Plan updated!');
      } else {
        await addDoc(collection(db, 'plans'), data);
        showToast('Plan added!');
      }
      setShowPlanForm(false);
    } catch (err) { console.error(err); showToast('Error saving plan.'); }
    finally { setPlanSaving(false); }
  };
  const handleDeletePlan = async (id: string) => {
    try { await deleteDoc(doc(db, 'plans', id)); setDeletePlanConfirm(null); showToast('Plan deleted.'); }
    catch { showToast('Error deleting plan.'); }
  };
  const seedDefaultPlans = async () => {
    setSeedingPlans(true);
    try {
      await Promise.all(DEFAULT_PLANS.map((p) => addDoc(collection(db, 'plans'), p)));
      showToast('Default plans loaded!');
    } catch { showToast('Error seeding plans.'); }
    finally { setSeedingPlans(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Enquiry handlers
  // ─────────────────────────────────────────────────────────────────────────
  const markEnquiryRead = (id: string) =>
    updateDoc(doc(db, 'enquiries', id), { read: true });

  const cycleEnquiryStatus = async (e: Enquiry) => {
    await updateDoc(doc(db, 'enquiries', e.id), {
      status: ENQUIRY_STATUS_NEXT[e.status],
      read: true,
    });
  };

  const handleDeleteEnquiry = async (id: string) => {
    try { await deleteDoc(doc(db, 'enquiries', id)); setDeleteEnquiryConfirm(null); showToast('Enquiry deleted.'); }
    catch { showToast('Error deleting enquiry.'); }
  };

  const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-green-400 text-black px-5 py-3 rounded-xl shadow-xl font-semibold text-sm animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/lovable-uploads/crunch.png" alt="logo" className="h-8 w-auto object-contain" />
            <div>
              <p className="font-bold text-sm text-white">Admin Dashboard</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
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
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl text-sm transition-colors"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 pb-0">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'posts'
                ? 'border-green-400 text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <FileText size={15} /> Blog Posts
            <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full">{posts.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'team' ? 'border-green-400 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <Users size={15} /> Team
            <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full">{members.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('offers')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'offers' ? 'border-green-400 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <Megaphone size={15} /> Offers
            <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full">{offers.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'plans' ? 'border-green-400 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <CreditCard size={15} /> Plans
            <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full">{plans.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('enquiries')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'enquiries' ? 'border-green-400 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            <Inbox size={15} /> Enquiries
            {enquiries.filter((e) => !e.read).length > 0 && (
              <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {enquiries.filter((e) => !e.read).length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">

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
                <p className="text-gray-500 mb-4">No plans in Firestore yet.</p>
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
                      ? new Date(enq.submittedAt.seconds * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
      </main>

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
    </div>
  );
};

export default AdminDashboard;
