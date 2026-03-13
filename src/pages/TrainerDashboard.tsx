import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, setDoc,
} from 'firebase/firestore';
import { signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { auth, db, firebaseConfig } from '../lib/firebase';
import { useRole } from '../hooks/useRole';
import {
  LogOut, Dumbbell, Calendar, Clock, Users, MapPin,
  CheckCircle, QrCode, ChevronRight, Shield, Plus,
  Phone, Trash2, Edit2, XCircle,
  CheckSquare, LayoutDashboard, UserCheck, AlarmClock,
  TrendingUp, Search, Activity, Mail, ListChecks, X,
  Layers, ChevronLeft, MessageSquare, Send, Lock, Eye, EyeOff,
  BellRing, Menu,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Duty {
  id: string; trainerId: string; area: string; days: string[]; shift: string; weekStart: string;
}
interface ClassSession {
  id: string; trainerId: string; title: string; area: string;
  date: string; startTime: string; duration: number; capacity: number;
  pin: string; pinValidFrom: string; pinValidTo: string;
}
interface ClassAttendance {
  id: string; sessionId: string; memberName: string;
  memberPhone: string; checkedInAt: { seconds: number };
}
interface Client {
  id: string; name: string; email: string; phone: string;
  goal: string; trainerId: string; createdAt: { seconds: number } | null;
}
interface PTSession {
  id: string; clientId: string; trainerId: string;
  date: string; time: string; duration: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes: string; createdAt: { seconds: number } | null;
}
interface Exercise { name: string; sets: number; reps: string; notes: string; }
interface WorkoutPlan {
  id: string; name: string; description: string;
  exercises: Exercise[]; assignedClientIds: string[];
  createdAt: { seconds: number } | null;
}
interface ProgressLog {
  id: string; date: string; notes: string;
  weight?: number; bodyFat?: number; waist?: number;
  chest?: number; arms?: number; thigh?: number;
  createdAt: { seconds: number } | null;
}
interface Availability { id: string; day: string; startTime: string; endTime: string; }
interface SessionRequest {
  id: string; clientId: string; clientName: string;
  requestedDate: string; requestedTime: string;
  duration: number; notes: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: { seconds: number } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const AREA_COLORS: Record<string, string> = {
  'Cardio Zone':         'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Powerlifting':        'bg-red-500/15 text-red-400 border-red-500/30',
  'CrossFit':            'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Yoga & Flexibility':  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Functional Training': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Boxing':              'bg-pink-500/15 text-pink-400 border-pink-500/30',
  'Floor Duty':          'bg-green-500/15 text-green-400 border-green-500/30',
};
const SESSION_STATUS: Record<string, string> = {
  scheduled:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  completed:  'bg-green-500/15 text-green-400 border-green-500/30',
  cancelled:  'bg-zinc-700 text-gray-500 border-zinc-600',
  'no-show':  'bg-red-500/15 text-red-400 border-red-500/30',
};
const GOAL_COLORS: Record<string, string> = {
  'Fat Loss':        'bg-orange-500/15 text-orange-400',
  'Muscle Gain':     'bg-red-500/15 text-red-400',
  'Strength':        'bg-yellow-500/15 text-yellow-400',
  'Flexibility':     'bg-purple-500/15 text-purple-400',
  'General Fitness': 'bg-blue-500/15 text-blue-400',
  'Rehabilitation':  'bg-pink-500/15 text-pink-400',
  'Weight Gain':     'bg-green-500/15 text-green-400',
};
const GOALS = [...Object.keys(GOAL_COLORS), 'Other'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWeekStart(date = new Date()): string {
  const d = new Date(date); const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split('T')[0];
}
function getTodayName() { return new Date().toLocaleDateString('en-US', { weekday: 'long' }); }
function isPinActive(s: ClassSession) {
  const now = new Date(); return now >= new Date(s.pinValidFrom) && now <= new Date(s.pinValidTo);
}
function fmt(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function today() { return new Date().toISOString().split('T')[0]; }

// ── Component ──────────────────────────────────────────────────────────────────
const TrainerDashboard = () => {
  const navigate = useNavigate();
  const { role, user } = useRole();
  const trainerId   = role?.trainerId ?? user?.uid ?? '';
  const trainerName = role?.name ?? user?.email ?? '';
  const weekStart   = getWeekStart();
  const todayStr    = today();
  const todayName   = getTodayName();

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'workouts' | 'availability'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Dashboard (duty + class sessions) ──
  const [duties, setDuties]               = useState<Duty[]>([]);
  const [allSessions, setAllSessions]     = useState<PTSession[]>([]);
  const [classSessions, setClassSessions] = useState<ClassSession[]>([]);
  const [attendance, setAttendance]       = useState<Record<string, ClassAttendance[]>>({});
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  // ── Clients ──
  const [clients, setClients]               = useState<Client[]>([]);
  const [clientSearch, setClientSearch]     = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient]   = useState<Client | null>(null);
  const [clientForm, setClientForm]         = useState({ name: '', email: '', phone: '', goal: 'Fat Loss' });
  const [clientSaving, setClientSaving]     = useState(false);

  // ── Client detail ──
  const [selectedClient, setSelectedClient]     = useState<Client | null>(null);
  const [clientDetailTab, setClientDetailTab]   = useState<'sessions' | 'workout' | 'progress' | 'messages'>('sessions');
  const [clientSessions, setClientSessions]     = useState<PTSession[]>([]);
  const [clientProgress, setClientProgress]     = useState<ProgressLog[]>([]);

  // Sessions within client detail
  const [showSessionForm, setShowSessionForm]   = useState(false);
  const [editingSession, setEditingSession]     = useState<PTSession | null>(null);
  const [sessionForm, setSessionForm]           = useState({ date: todayStr, time: '06:00', duration: 60, notes: '', status: 'scheduled' as PTSession['status'] });
  const [sessionSaving, setSessionSaving]       = useState(false);

  // Progress within client detail
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [progressForm, setProgressForm]         = useState({ date: todayStr, weight: '', bodyFat: '', waist: '', chest: '', arms: '', thigh: '', notes: '' });
  const [progressSaving, setProgressSaving]     = useState(false);

  // ── Workout Plans ──
  const [workoutPlans, setWorkoutPlans]     = useState<WorkoutPlan[]>([]);
  const [showPlanForm, setShowPlanForm]     = useState(false);
  const [editingPlan, setEditingPlan]       = useState<WorkoutPlan | null>(null);
  const [planForm, setPlanForm]             = useState({ name: '', description: '' });
  const [planExercises, setPlanExercises]   = useState<Exercise[]>([]);
  const [newExercise, setNewExercise]       = useState({ name: '', sets: 3, reps: '10', notes: '' });
  const [planSaving, setPlanSaving]         = useState(false);
  const [expandedPlan, setExpandedPlan]     = useState<string | null>(null);

  // ── Messages ──
  const [chatMessages, setChatMessages]         = useState<{ id: string; senderId: string; senderName: string; text: string; createdAt: { seconds: number } | null }[]>([]);
  const [newMsg, setNewMsg]                     = useState('');
  const [msgSending, setMsgSending]             = useState(false);
  const msgEndRef                               = useRef<HTMLDivElement>(null);

  // ── Client Logins ──
  const [clientLoginMap, setClientLoginMap]     = useState<Record<string, { uid: string; email: string }>>({});
  const [showCreateLoginForm, setShowCreateLoginForm] = useState(false);
  const [createLoginForm, setCreateLoginForm]   = useState({ email: '', password: '' });
  const [createLoginSaving, setCreateLoginSaving] = useState(false);
  const [showLoginPw, setShowLoginPw]           = useState(false);

  // ── Availability ──
  const [availability, setAvailability]     = useState<Availability[]>([]);
  const [showAvailForm, setShowAvailForm]   = useState(false);
  const [availForm, setAvailForm]           = useState({ day: 'Monday', startTime: '06:00', endTime: '07:00' });
  const [availSaving, setAvailSaving]       = useState(false);

  // ── Session Requests ──
  const [sessionRequests, setSessionRequests]     = useState<SessionRequest[]>([]);
  const [requestProcessing, setRequestProcessing] = useState<string | null>(null);

  // ── Firestore Listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!trainerId) return;
    return onSnapshot(
      query(collection(db, 'duties'), where('trainerId', '==', trainerId), where('weekStart', '==', weekStart)),
      (s) => setDuties(s.docs.map((d) => ({ id: d.id, ...d.data() } as Duty)))
    );
  }, [trainerId, weekStart]);

  useEffect(() => {
    if (!trainerId) return;
    return onSnapshot(
      query(collection(db, 'classSessions'), where('trainerId', '==', trainerId), where('date', '==', todayStr), orderBy('startTime')),
      (s) => setClassSessions(s.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession)))
    );
  }, [trainerId, todayStr]);

  useEffect(() => {
    if (!classSessions.length) return;
    const ids = classSessions.map((s) => s.id);
    return onSnapshot(
      query(collection(db, 'attendance'), where('sessionId', 'in', ids)),
      (s) => {
        const map: Record<string, ClassAttendance[]> = {};
        s.docs.forEach((d) => {
          const a = { id: d.id, ...d.data() } as ClassAttendance;
          map[a.sessionId] = [...(map[a.sessionId] ?? []), a];
        });
        setAttendance(map);
      }
    );
  }, [classSessions]);

  useEffect(() => {
    if (!trainerId) return;
    return onSnapshot(
      query(collection(db, 'trainerData', trainerId, 'clients'), orderBy('createdAt', 'desc')),
      (s) => setClients(s.docs.map((d) => ({ id: d.id, ...d.data() } as Client)))
    );
  }, [trainerId]);

  useEffect(() => {
    if (!trainerId) return;
    return onSnapshot(
      query(collection(db, 'trainerData', trainerId, 'workoutPlans'), orderBy('createdAt', 'desc')),
      (s) => setWorkoutPlans(s.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutPlan)))
    );
  }, [trainerId]);

  useEffect(() => {
    if (!trainerId) return;
    return onSnapshot(
      collection(db, 'trainerData', trainerId, 'availability'),
      (s) => setAvailability(s.docs.map((d) => ({ id: d.id, ...d.data() } as Availability)))
    );
  }, [trainerId]);

  // Session requests listener
  useEffect(() => {
    if (!trainerId) return;
    return onSnapshot(
      query(collection(db, 'trainerData', trainerId, 'sessionRequests'), where('status', '==', 'pending')),
      (s) => setSessionRequests(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() } as SessionRequest))
          .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
      )
    );
  }, [trainerId]);

  // All sessions listener (for dashboard stats)
  useEffect(() => {
    if (!trainerId) return;
    return onSnapshot(
      query(collection(db, 'trainerData', trainerId, 'sessions'), orderBy('date', 'desc')),
      (s) => setAllSessions(s.docs.map((d) => ({ id: d.id, ...d.data() } as PTSession)))
    );
  }, [trainerId]);

  // Client sessions listener (only when client detail is open)
  useEffect(() => {
    if (!trainerId || !selectedClient) { setClientSessions([]); return; }
    return onSnapshot(
      query(collection(db, 'trainerData', trainerId, 'sessions'), where('clientId', '==', selectedClient.id), orderBy('date', 'desc')),
      (s) => setClientSessions(s.docs.map((d) => ({ id: d.id, ...d.data() } as PTSession)))
    );
  }, [trainerId, selectedClient]);

  // Client progress logs listener
  useEffect(() => {
    if (!trainerId || !selectedClient) { setClientProgress([]); return; }
    return onSnapshot(
      query(collection(db, 'trainerData', trainerId, 'clients', selectedClient.id, 'progressLogs'), orderBy('date', 'desc')),
      (s) => setClientProgress(s.docs.map((d) => ({ id: d.id, ...d.data() } as ProgressLog)))
    );
  }, [trainerId, selectedClient]);

  // Messages listener (when client detail is open)
  useEffect(() => {
    if (!trainerId || !selectedClient) { setChatMessages([]); return; }
    const convId = `${trainerId}_${selectedClient.id}`;
    return onSnapshot(
      query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc')),
      (s) => setChatMessages(s.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; senderId: string; senderName: string; text: string; createdAt: { seconds: number } | null })))
    );
  }, [trainerId, selectedClient]);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (clientDetailTab === 'messages') {
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, clientDetailTab]);

  // Client logins listener
  useEffect(() => {
    if (!trainerId) return;
    return onSnapshot(
      query(collection(db, 'userRoles'), where('trainerId', '==', trainerId), where('role', '==', 'client')),
      (s) => {
        const map: Record<string, { uid: string; email: string }> = {};
        s.docs.forEach((d) => {
          const data = d.data();
          if (data.clientId) map[data.clientId] = { uid: d.id, email: data.email };
        });
        setClientLoginMap(map);
      }
    );
  }, [trainerId]);

  // ── Client Handlers ───────────────────────────────────────────────────────
  const openAddClient = () => {
    setEditingClient(null);
    setClientForm({ name: '', email: '', phone: '', goal: 'Fat Loss' });
    setShowClientForm(true);
  };
  const openEditClient = (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(c);
    setClientForm({ name: c.name, email: c.email, phone: c.phone, goal: c.goal });
    setShowClientForm(true);
  };
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !trainerId) return;
    setClientSaving(true);
    try {
      if (editingClient) {
        await updateDoc(doc(db, 'trainerData', trainerId, 'clients', editingClient.id), { ...clientForm });
        if (selectedClient?.id === editingClient.id) setSelectedClient((p) => p ? { ...p, ...clientForm } : null);
      } else {
        await addDoc(collection(db, 'trainerData', trainerId, 'clients'), { ...clientForm, trainerId, createdAt: serverTimestamp() });
      }
      setShowClientForm(false);
    } catch (err) { console.error(err); }
    finally { setClientSaving(false); }
  };
  const handleDeleteClient = async (c: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${c.name}? Their sessions and progress logs will also be removed.`)) return;
    const [sessSnap, progressSnap] = await Promise.all([
      getDocs(query(collection(db, 'trainerData', trainerId, 'sessions'), where('clientId', '==', c.id))),
      getDocs(collection(db, 'trainerData', trainerId, 'clients', c.id, 'progressLogs')),
    ]);
    const planUpdates = workoutPlans
      .filter((p) => p.assignedClientIds?.includes(c.id))
      .map((p) => updateDoc(doc(db, 'trainerData', trainerId, 'workoutPlans', p.id), {
        assignedClientIds: p.assignedClientIds.filter((id) => id !== c.id),
      }));
    await Promise.all([
      ...sessSnap.docs.map((d) => deleteDoc(d.ref)),
      ...progressSnap.docs.map((d) => deleteDoc(d.ref)),
      ...planUpdates,
      deleteDoc(doc(db, 'trainerData', trainerId, 'clients', c.id)),
    ]);
    if (selectedClient?.id === c.id) setSelectedClient(null);
  };

  // ── Session Handlers ──────────────────────────────────────────────────────
  const openAddSession = () => {
    setEditingSession(null);
    setSessionForm({ date: todayStr, time: '06:00', duration: 60, notes: '', status: 'scheduled' });
    setShowSessionForm(true);
  };
  const openEditSession = (s: PTSession) => {
    setEditingSession(s);
    setSessionForm({ date: s.date, time: s.time, duration: s.duration, notes: s.notes, status: s.status });
    setShowSessionForm(true);
  };
  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !trainerId) return;
    setSessionSaving(true);
    try {
      if (editingSession) {
        await updateDoc(doc(db, 'trainerData', trainerId, 'sessions', editingSession.id), { ...sessionForm });
      } else {
        await addDoc(collection(db, 'trainerData', trainerId, 'sessions'), {
          ...sessionForm, clientId: selectedClient.id, trainerId, createdAt: serverTimestamp(),
        });
      }
      setShowSessionForm(false);
    } catch (err) { console.error(err); }
    finally { setSessionSaving(false); }
  };
  const handleSessionStatus = async (s: PTSession, status: PTSession['status']) => {
    await updateDoc(doc(db, 'trainerData', trainerId, 'sessions', s.id), { status });
  };
  const handleDeleteSession = async (id: string) => {
    await deleteDoc(doc(db, 'trainerData', trainerId, 'sessions', id));
  };

  // ── Progress Handlers ─────────────────────────────────────────────────────
  const openAddProgress = () => {
    setProgressForm({ date: todayStr, weight: '', bodyFat: '', waist: '', chest: '', arms: '', thigh: '', notes: '' });
    setShowProgressForm(true);
  };
  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !trainerId) return;
    setProgressSaving(true);
    try {
      const entry = {
        date: progressForm.date,
        notes: progressForm.notes,
        ...(progressForm.weight  ? { weight:  Number(progressForm.weight)  } : {}),
        ...(progressForm.bodyFat ? { bodyFat: Number(progressForm.bodyFat) } : {}),
        ...(progressForm.waist   ? { waist:   Number(progressForm.waist)   } : {}),
        ...(progressForm.chest   ? { chest:   Number(progressForm.chest)   } : {}),
        ...(progressForm.arms    ? { arms:    Number(progressForm.arms)    } : {}),
        ...(progressForm.thigh   ? { thigh:   Number(progressForm.thigh)   } : {}),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'trainerData', trainerId, 'clients', selectedClient.id, 'progressLogs'), entry);
      setShowProgressForm(false);
    } catch (err) { console.error(err); }
    finally { setProgressSaving(false); }
  };
  const handleDeleteProgress = async (id: string) => {
    if (!selectedClient) return;
    await deleteDoc(doc(db, 'trainerData', trainerId, 'clients', selectedClient.id, 'progressLogs', id));
  };

  // ── Workout Plan Handlers ─────────────────────────────────────────────────
  const openAddPlan = () => {
    setEditingPlan(null);
    setPlanForm({ name: '', description: '' });
    setPlanExercises([]);
    setNewExercise({ name: '', sets: 3, reps: '10', notes: '' });
    setShowPlanForm(true);
  };
  const openEditPlan = (plan: WorkoutPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlan(plan);
    setPlanForm({ name: plan.name, description: plan.description ?? '' });
    setPlanExercises(plan.exercises ?? []);
    setNewExercise({ name: '', sets: 3, reps: '10', notes: '' });
    setShowPlanForm(true);
  };
  const addExerciseToList = () => {
    if (!newExercise.name.trim()) return;
    setPlanExercises((prev) => [...prev, { ...newExercise }]);
    setNewExercise({ name: '', sets: 3, reps: '10', notes: '' });
  };
  const removeExercise = (idx: number) => {
    setPlanExercises((prev) => prev.filter((_, i) => i !== idx));
  };
  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name || !trainerId) return;
    setPlanSaving(true);
    try {
      const data = {
        ...planForm,
        exercises: planExercises,
        assignedClientIds: editingPlan?.assignedClientIds ?? [],
      };
      if (editingPlan) {
        await updateDoc(doc(db, 'trainerData', trainerId, 'workoutPlans', editingPlan.id), data);
      } else {
        await addDoc(collection(db, 'trainerData', trainerId, 'workoutPlans'), { ...data, createdAt: serverTimestamp() });
      }
      setShowPlanForm(false);
    } catch (err) { console.error(err); }
    finally { setPlanSaving(false); }
  };
  const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDoc(doc(db, 'trainerData', trainerId, 'workoutPlans', id));
  };
  const toggleAssignPlan = async (planId: string) => {
    if (!selectedClient) return;
    const plan = workoutPlans.find((p) => p.id === planId);
    if (!plan) return;
    const assigned = plan.assignedClientIds ?? [];
    const updated = assigned.includes(selectedClient.id)
      ? assigned.filter((id) => id !== selectedClient.id)
      : [...assigned, selectedClient.id];
    await updateDoc(doc(db, 'trainerData', trainerId, 'workoutPlans', planId), { assignedClientIds: updated });
  };

  // ── Availability Handlers ─────────────────────────────────────────────────
  const handleAvailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAvailSaving(true);
    try {
      await addDoc(collection(db, 'trainerData', trainerId, 'availability'), { ...availForm });
      setShowAvailForm(false);
    } catch (err) { console.error(err); }
    finally { setAvailSaving(false); }
  };
  const handleDeleteAvail = async (id: string) => {
    await deleteDoc(doc(db, 'trainerData', trainerId, 'availability', id));
  };

  // ── Message Handlers ─────────────────────────────────────────────────────
  // ── Session Request Handlers ──────────────────────────────────────────────
  const handleConfirmRequest = async (req: SessionRequest) => {
    setRequestProcessing(req.id);
    try {
      await addDoc(collection(db, 'trainerData', trainerId, 'sessions'), {
        clientId: req.clientId,
        trainerId,
        date: req.requestedDate,
        time: req.requestedTime,
        duration: req.duration,
        status: 'scheduled',
        notes: req.notes || '',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'trainerData', trainerId, 'sessionRequests', req.id), { status: 'confirmed' });
    } catch (err) { console.error(err); }
    finally { setRequestProcessing(null); }
  };

  const handleRejectRequest = async (req: SessionRequest) => {
    setRequestProcessing(req.id);
    try {
      await updateDoc(doc(db, 'trainerData', trainerId, 'sessionRequests', req.id), { status: 'rejected' });
    } catch (err) { console.error(err); }
    finally { setRequestProcessing(null); }
  };

  const handleSendMessage = async () => {
    if (!newMsg.trim() || !selectedClient || !trainerId) return;
    setMsgSending(true);
    try {
      const convId = `${trainerId}_${selectedClient.id}`;
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        senderId: user?.uid,
        senderName: trainerName,
        text: newMsg.trim(),
        createdAt: serverTimestamp(),
      });
      setNewMsg('');
    } catch (err) { console.error(err); }
    finally { setMsgSending(false); }
  };

  // ── Client Login Handlers ─────────────────────────────────────────────────
  const handleCreateClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !trainerId) return;
    setCreateLoginSaving(true);
    try {
      const secondaryApp = initializeApp(firebaseConfig, `client-create-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, createLoginForm.email, createLoginForm.password);
      await setDoc(doc(db, 'userRoles', cred.user.uid), {
        role: 'client',
        clientId: selectedClient.id,
        trainerId,
        trainerName,
        name: selectedClient.name,
        goal: selectedClient.goal,
        email: createLoginForm.email,
      });
      await deleteApp(secondaryApp);
      setShowCreateLoginForm(false);
      setCreateLoginForm({ email: '', password: '' });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create login');
    }
    finally { setCreateLoginSaving(false); }
  };
  const handleDeleteClientLogin = async (clientId: string) => {
    const login = clientLoginMap[clientId];
    if (!login || !confirm('Remove this client\'s portal access?')) return;
    await deleteDoc(doc(db, 'userRoles', login.uid));
  };

  const handleLogout = async () => { await signOut(auth); navigate('/trainer/login'); };

  // ── Derived ──────────────────────────────────────────────────────────────
  const todayDuty       = duties.find((d) => d.days.includes(todayName));
  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.goal.toLowerCase().includes(q);
  });
  const assignedPlan = selectedClient
    ? workoutPlans.find((p) => p.assignedClientIds?.includes(selectedClient.id))
    : null;

  // ── All-sessions derived ──────────────────────────────────────────────────
  const todaysPTSessions = allSessions
    .filter((s) => s.date === todayStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const sevenDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })();
  const weekPTSessions = allSessions.filter((s) => s.date >= sevenDaysAgo && s.date <= todayStr);
  const weekCompleted  = weekPTSessions.filter((s) => s.status === 'completed').length;

  const clientLastSessionMap: Record<string, string> = {};
  const clientSessionCountMap: Record<string, number> = {};
  allSessions.forEach((s) => {
    if (!clientLastSessionMap[s.clientId] || s.date > clientLastSessionMap[s.clientId]) {
      clientLastSessionMap[s.clientId] = s.date;
    }
    clientSessionCountMap[s.clientId] = (clientSessionCountMap[s.clientId] ?? 0) + 1;
  });

  const twoWeeksAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().split('T')[0]; })();
  const atRiskClients = clients.filter((c) => {
    const last = clientLastSessionMap[c.id];
    return last && last < twoWeeksAgo;
  });

  // Upcoming PT sessions (next 7 days, excluding today)
  const sevenDaysLater = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })();
  const upcomingWeekSessions = allSessions
    .filter((s) => s.status === 'scheduled' && s.date > todayStr && s.date <= sevenDaysLater)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  // All upcoming (today + future)
  const allUpcoming = allSessions
    .filter((s) => s.status === 'scheduled' && s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const weekCompletionRate = weekPTSessions.length > 0
    ? Math.round((weekCompleted / weekPTSessions.length) * 100) : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-zinc-950 text-white flex overflow-hidden">

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed top-0 left-0 h-screen w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        {/* Logo / Trainer info */}
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-green-400/10 border border-green-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Dumbbell size={16} className="text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{trainerName}</p>
              <p className="text-xs text-gray-500">Trainer Portal</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white p-1 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {([
            { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard, badge: sessionRequests.length, count: null },
            { id: 'clients',      label: 'Clients',      icon: UserCheck,       badge: 0,                     count: clients.length },
            { id: 'workouts',     label: 'Workout Plans',icon: ListChecks,      badge: 0,                     count: workoutPlans.length },
            { id: 'availability', label: 'Availability', icon: AlarmClock,      badge: 0,                     count: availability.length },
          ] as const).map(({ id, label, icon: Icon, badge, count }) => (
            <button key={id}
              onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === id ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'
              }`}>
              <Icon size={16} />
              {label}
              {(badge ?? 0) > 0
                ? <span className="ml-auto text-xs bg-orange-400 text-black px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">{badge}</span>
                : count !== null
                  ? <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-500">{count}</span>
                  : null
              }
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-zinc-800">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 md:ml-60 flex flex-col h-screen overflow-hidden w-full">

        {/* Top bar */}
        <header className="flex-shrink-0 z-20 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
              <Menu size={20} />
            </button>
            <div>
              <h1 className="font-bold text-white text-base leading-tight">
                {activeTab === 'dashboard'    && 'Dashboard'}
                {activeTab === 'clients'      && (selectedClient ? selectedClient.name : 'Clients')}
                {activeTab === 'workouts'     && 'Workout Plans'}
                {activeTab === 'availability' && 'Availability'}
              </h1>
              <p className="text-xs text-gray-500">
                {activeTab === 'clients' && selectedClient ? (
                  <button onClick={() => setSelectedClient(null)} className="text-green-400 hover:text-green-300 flex items-center gap-1">
                    <ChevronLeft size={11} /> All Clients
                  </button>
                ) : 'Trainer Portal'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'clients' && !selectedClient && (
              <button onClick={openAddClient}
                className="flex items-center gap-2 px-3 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all">
                <Plus size={13} /> Add Client
              </button>
            )}
            {activeTab === 'clients' && selectedClient && (
              <button onClick={openAddSession}
                className="flex items-center gap-2 px-3 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all">
                <Plus size={13} /> Schedule
              </button>
            )}
            {activeTab === 'workouts' && (
              <button onClick={openAddPlan}
                className="flex items-center gap-2 px-3 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all">
                <Plus size={13} /> New Plan
              </button>
            )}
            {activeTab === 'availability' && (
              <button onClick={() => setShowAvailForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all">
                <Plus size={13} /> Add Slot
              </button>
            )}
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* ═══════════════════ DASHBOARD TAB ═══════════════════ */}
        {activeTab === 'dashboard' && (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Clients', value: clients.length, icon: Users, color: 'text-blue-400', sub: atRiskClients.length > 0 ? `${atRiskClients.length} inactive` : undefined, subColor: 'text-yellow-400' },
                { label: 'Upcoming Sessions', value: allUpcoming.length, icon: Calendar, color: 'text-green-400', sub: todaysPTSessions.length > 0 ? `${todaysPTSessions.length} today` : undefined, subColor: 'text-green-400' },
                { label: "Today's Classes", value: classSessions.length, icon: QrCode, color: 'text-purple-400', sub: undefined, subColor: undefined },
                { label: 'Workout Plans', value: workoutPlans.length, icon: ListChecks, color: 'text-orange-400', sub: undefined, subColor: undefined },
              ].map(({ label, value, icon: Icon, color, sub, subColor }) => (
                <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                  <Icon size={18} className={`${color} mx-auto mb-1.5`} />
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  {sub && <p className={`text-xs mt-0.5 ${subColor ?? 'text-gray-400'}`}>{sub}</p>}
                </div>
              ))}
            </div>

            {/* Pending Session Requests */}
            {sessionRequests.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <BellRing size={13} className="text-orange-400" /> Session Requests
                  <span className="bg-orange-400/10 text-orange-400 border border-orange-400/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {sessionRequests.length} pending
                  </span>
                </h2>
                <div className="space-y-3">
                  {sessionRequests.map((req) => {
                    const client = clients.find((c) => c.id === req.clientId);
                    const isProcessing = requestProcessing === req.id;
                    return (
                      <div key={req.id} className="bg-zinc-900 border border-orange-500/20 rounded-2xl px-5 py-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-white">{req.clientName}</p>
                              <span className="text-xs text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded-full font-semibold">
                                New Request
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Calendar size={11} /> {req.requestedDate}</span>
                              <span className="flex items-center gap-1"><Clock size={11} /> {fmt(req.requestedTime)} · {req.duration}min</span>
                            </div>
                            {req.notes && <p className="text-xs text-gray-500 italic mt-1.5">{req.notes}</p>}
                          </div>
                          {client && (
                            <button
                              onClick={() => { setSelectedClient(client); setClientDetailTab('sessions'); setActiveTab('clients'); }}
                              className="text-xs text-gray-400 hover:text-gray-300 font-semibold px-2 py-1 rounded-lg hover:bg-zinc-800 transition-all whitespace-nowrap flex-shrink-0"
                            >
                              Profile →
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirmRequest(req)}
                            disabled={isProcessing}
                            className="flex-1 py-2 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 disabled:text-gray-500 text-black font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle size={13} /> {isProcessing ? 'Processing…' : 'Confirm & Schedule'}
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req)}
                            disabled={isProcessing}
                            className="py-2 px-4 bg-zinc-800 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50 text-gray-400 font-semibold rounded-xl text-xs transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Weekly performance bar */}
            {weekPTSessions.length >= 2 && weekCompletionRate !== null && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">This Week's Completion</p>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${weekCompletionRate >= 80 ? 'bg-green-400/10 text-green-400' : weekCompletionRate >= 50 ? 'bg-yellow-400/10 text-yellow-400' : 'bg-zinc-800 text-gray-400'}`}>
                    {weekCompletionRate}%
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${weekCompletionRate >= 80 ? 'bg-green-400' : weekCompletionRate >= 50 ? 'bg-yellow-400' : 'bg-zinc-600'}`} style={{ width: `${weekCompletionRate}%` }} />
                </div>
                <p className="text-xs text-gray-600 mt-1.5">{weekCompleted} of {weekPTSessions.length} sessions completed this week</p>
              </div>
            )}

            {/* Today's PT Sessions */}
            {todaysPTSessions.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <UserCheck size={13} /> Today's PT Schedule
                  <span className="bg-green-400/10 text-green-400 border border-green-400/20 px-2 py-0.5 rounded-full text-[10px] font-bold">{todaysPTSessions.length} session{todaysPTSessions.length !== 1 ? 's' : ''}</span>
                </h2>
                <div className="space-y-2">
                  {todaysPTSessions.map((s) => {
                    const client = clients.find((c) => c.id === s.clientId);
                    return (
                      <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">{client?.name ?? 'Unknown'}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${SESSION_STATUS[s.status]}`}>{s.status}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{fmt(s.time)} · {s.duration}min</p>
                        </div>
                        {client && (
                          <button
                            onClick={() => { setSelectedClient(client); setClientDetailTab('sessions'); setActiveTab('clients'); }}
                            className="text-xs text-green-400 hover:text-green-300 font-bold px-3 py-1.5 rounded-lg hover:bg-green-400/10 transition-all"
                          >
                            View →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Upcoming PT sessions this week */}
            {upcomingWeekSessions.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <AlarmClock size={13} /> Upcoming This Week
                  <span className="bg-blue-400/10 text-blue-400 border border-blue-400/20 px-2 py-0.5 rounded-full text-[10px] font-bold">{upcomingWeekSessions.length}</span>
                </h2>
                <div className="space-y-2">
                  {upcomingWeekSessions.map((s) => {
                    const client = clients.find((c) => c.id === s.clientId);
                    const daysAway = Math.round((new Date(s.date + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000);
                    return (
                      <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white">{client?.name ?? 'Unknown'}</p>
                            <span className="text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                              {daysAway === 1 ? 'Tomorrow' : `in ${daysAway} days`}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{s.date} · {fmt(s.time)} · {s.duration}min</p>
                          {s.notes && <p className="text-xs text-gray-600 italic mt-0.5">{s.notes}</p>}
                        </div>
                        {client && (
                          <button
                            onClick={() => { setSelectedClient(client); setClientDetailTab('sessions'); setActiveTab('clients'); }}
                            className="text-xs text-green-400 hover:text-green-300 font-bold px-3 py-1.5 rounded-lg hover:bg-green-400/10 transition-all whitespace-nowrap">
                            View →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Today's duty */}
            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Calendar size={13} /> Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              {todayDuty ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Area Assignment</p>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${AREA_COLORS[todayDuty.area] ?? AREA_COLORS['Floor Duty']}`}>
                        <MapPin size={13} /> {todayDuty.area}
                      </span>
                      <p className="text-white font-semibold mt-3">{todayDuty.shift}</p>
                    </div>
                    <Shield size={32} className="text-green-400/30" />
                  </div>
                  <div className="mt-4 flex gap-1.5 flex-wrap">
                    {DAYS.map((day) => (
                      <span key={day} className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                        todayDuty.days.includes(day)
                          ? day === todayName ? 'bg-green-400 text-black' : 'bg-green-400/15 text-green-400'
                          : 'bg-zinc-800 text-gray-600'
                      }`}>{day.slice(0, 3)}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
                  <p className="text-gray-500 text-sm">No duty assigned for today.</p>
                </div>
              )}
            </section>

            {/* Today's classes */}
            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <QrCode size={13} /> Today's Classes
              </h2>
              {classSessions.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
                  <p className="text-gray-500 text-sm">No classes scheduled today.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classSessions.map((session) => {
                    const active    = isPinActive(session);
                    const count     = (attendance[session.id] ?? []).length;
                    const expanded  = expandedClass === session.id;
                    const attendees = attendance[session.id] ?? [];
                    return (
                      <div key={session.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <button onClick={() => setExpandedClass(expanded ? null : session.id)} className="w-full text-left px-5 py-4 flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-white">{session.title}</p>
                              {active
                                ? <span className="text-xs bg-green-400/15 text-green-400 border border-green-400/30 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
                                : <span className="text-xs bg-zinc-800 text-gray-500 px-2 py-0.5 rounded-full">{new Date() < new Date(session.pinValidFrom) ? 'Upcoming' : 'Ended'}</span>
                              }
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Clock size={11} /> {fmt(session.startTime)}</span>
                              <span className="flex items-center gap-1"><Users size={11} /> {count}/{session.capacity}</span>
                            </div>
                          </div>
                          <ChevronRight size={16} className={`text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </button>
                        {expanded && (
                          <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
                            <div className="bg-zinc-800 rounded-xl p-4 text-center">
                              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Class PIN</p>
                              <p className="text-4xl font-mono font-black tracking-[0.3em] text-green-400">
                                {active ? session.pin : '••••••'}
                              </p>
                              {active && <p className="text-xs text-green-400/70 mt-1">Valid until {new Date(session.pinValidTo).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Checked In ({attendees.length})</p>
                              {attendees.length === 0
                                ? <p className="text-xs text-gray-600">No check-ins yet.</p>
                                : <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                  {attendees.map((a) => (
                                    <div key={a.id} className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle size={13} className="text-green-400" />
                                        <span className="text-sm text-white">{a.memberName}</span>
                                        <span className="text-xs text-gray-500">{a.memberPhone}</span>
                                      </div>
                                      <span className="text-xs text-gray-600">
                                        {new Date(a.checkedInAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {atRiskClients.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Activity size={13} /> Needs Attention
                  <span className="bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2 py-0.5 rounded-full text-[10px] font-bold">{atRiskClients.length}</span>
                </h2>
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4">
                  <p className="text-xs text-yellow-400/80 mb-3">No session in the last 2 weeks — consider reaching out.</p>
                  <div className="flex flex-wrap gap-2">
                    {atRiskClients.map((c) => (
                      <button key={c.id}
                        onClick={() => { setSelectedClient(c); setClientDetailTab('sessions'); setActiveTab('clients'); }}
                        className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-yellow-500/20 hover:border-yellow-500/40 text-yellow-400 px-3 py-1.5 rounded-lg transition-all font-semibold">
                        {c.name}
                        {clientLastSessionMap[c.id] && <span className="text-yellow-400/50">· {clientLastSessionMap[c.id]}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}


            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-3">
              <Shield size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Your <span className="text-white font-semibold">client data, workout plans, and progress logs</span> are private — only you can access them.
              </p>
            </div>
          </>
        )}

        {/* ═══════════════════ CLIENTS TAB ═══════════════════ */}
        {activeTab === 'clients' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search by name, phone, goal…"
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
              />
            </div>

            {filteredClients.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
                <UserCheck size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-semibold">
                  {clientSearch ? 'No clients match your search.' : 'No clients yet.'}
                </p>
                {!clientSearch && <p className="text-gray-600 text-xs mt-1">Add your first PT client to get started.</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredClients.map((c) => {
                  const goalColor = GOAL_COLORS[c.goal] ?? 'bg-zinc-700 text-gray-400';
                  return (
                    <div
                      key={c.id}
                      onClick={() => { setSelectedClient(c); setClientDetailTab('sessions'); }}
                      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl px-5 py-4 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white group-hover:text-green-400 transition-colors">{c.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${goalColor}`}>{c.goal}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            {c.phone && <span className="flex items-center gap-1"><Phone size={11} /> {c.phone}</span>}
                            {c.email && <span className="flex items-center gap-1"><Mail size={11} /> {c.email}</span>}
                            {clientLastSessionMap[c.id] && (
                              <span className={`flex items-center gap-1 ${clientLastSessionMap[c.id] < twoWeeksAgo ? 'text-yellow-500' : ''}`}>
                                <Calendar size={11} />
                                Last: {clientLastSessionMap[c.id]}
                                {clientLastSessionMap[c.id] < twoWeeksAgo && ' · inactive'}
                              </span>
                            )}
                            {clientSessionCountMap[c.id] > 0 && (
                              <span className="flex items-center gap-1">{clientSessionCountMap[c.id]} sessions total</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={(e) => openEditClient(c, e)}
                            className="p-2 text-gray-600 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={(e) => handleDeleteClient(c, e)}
                            className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 ml-1" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════ WORKOUTS TAB ═══════════════════ */}
        {activeTab === 'workouts' && (
          <>
            <p className="text-xs text-gray-500">Build workout plans and assign them to clients.</p>

            {workoutPlans.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
                <ListChecks size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-semibold">No workout plans yet.</p>
                <p className="text-gray-600 text-xs mt-1">Create a plan and assign it to clients.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workoutPlans.map((plan) => {
                  const expanded = expandedPlan === plan.id;
                  const assignedNames = (plan.assignedClientIds ?? [])
                    .map((id) => clients.find((c) => c.id === id)?.name)
                    .filter(Boolean);
                  return (
                    <div key={plan.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedPlan(expanded ? null : plan.id)}
                        className="w-full text-left px-5 py-4 flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white">{plan.name}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1"><Activity size={11} /> {(plan.exercises ?? []).length} exercises</span>
                            {assignedNames.length > 0 && (
                              <span className="flex items-center gap-1"><Users size={11} /> {assignedNames.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => openEditPlan(plan, e)}
                            className="p-2 text-gray-600 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={(e) => handleDeletePlan(plan.id, e)}
                            className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={14} className={`text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </div>
                      </button>
                      {expanded && (
                        <div className="border-t border-zinc-800 px-5 py-4 space-y-3">
                          {plan.description && (
                            <p className="text-sm text-gray-400 italic">{plan.description}</p>
                          )}
                          {(plan.exercises ?? []).length === 0 ? (
                            <p className="text-xs text-gray-600">No exercises added yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {plan.exercises.map((ex, i) => (
                                <div key={i} className="flex items-start justify-between bg-zinc-800/50 rounded-xl px-4 py-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{ex.name}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{ex.sets} sets × {ex.reps} reps{ex.notes ? ` · ${ex.notes}` : ''}</p>
                                  </div>
                                  <span className="text-xs text-gray-600 font-mono">{String(i + 1).padStart(2, '0')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Assigned clients */}
                          {clients.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assign to Clients</p>
                              <div className="flex flex-wrap gap-2">
                                {clients.map((c) => {
                                  const isAssigned = (plan.assignedClientIds ?? []).includes(c.id);
                                  return (
                                    <button
                                      key={c.id}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const assigned = plan.assignedClientIds ?? [];
                                        const updated = assigned.includes(c.id)
                                          ? assigned.filter((id) => id !== c.id)
                                          : [...assigned, c.id];
                                        await updateDoc(doc(db, 'trainerData', trainerId, 'workoutPlans', plan.id), { assignedClientIds: updated });
                                      }}
                                      className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                                        isAssigned
                                          ? 'bg-green-400/15 text-green-400 border-green-400/30'
                                          : 'bg-zinc-800 text-gray-500 border-zinc-700 hover:border-zinc-600'
                                      }`}
                                    >
                                      {isAssigned ? <CheckCircle size={11} className="inline mr-1" /> : null}{c.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════ AVAILABILITY TAB ═══════════════════ */}
        {activeTab === 'availability' && (
          <>
            <p className="text-xs text-gray-500">Set your available time slots for Personal Training sessions.</p>

            {DAYS.map((day) => {
              const slots = availability.filter((a) => a.day === day);
              if (slots.length === 0) return null;
              return (
                <div key={day} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-zinc-800/50 border-b border-zinc-800">
                    <span className="text-sm font-bold text-white">{day}</span>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {slots.map((slot) => (
                      <div key={slot.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AlarmClock size={14} className="text-green-400" />
                          <span className="text-sm text-white font-semibold">{fmt(slot.startTime)} — {fmt(slot.endTime)}</span>
                        </div>
                        <button onClick={() => handleDeleteAvail(slot.id)}
                          className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {availability.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
                <AlarmClock size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No availability set yet.</p>
                <p className="text-gray-600 text-xs mt-1">Add your available time slots for PT bookings.</p>
              </div>
            )}
          </>
        )}
      </div>
        </main>
      </div>{/* end main content */}

      {/* ═══════════════════ CLIENT FORM MODAL ═══════════════════ */}
      {showClientForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-bold text-white">{editingClient ? 'Edit Client' : 'Add PT Client'}</h3>
              <button onClick={() => setShowClientForm(false)} className="text-gray-400 hover:text-white"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleClientSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Full Name *</label>
                <input value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} required
                  placeholder="Client's full name"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Phone</label>
                  <input value={clientForm.phone} onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Mobile number"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Email</label>
                  <input type="email" value={clientForm.email} onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Email address"
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Fitness Goal</label>
                <select value={clientForm.goal} onChange={(e) => setClientForm((p) => ({ ...p, goal: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400">
                  {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowClientForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                <button type="submit" disabled={clientSaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm">
                  {clientSaving ? 'Saving…' : editingClient ? 'Update' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════ CLIENT DETAIL MODAL ═══════════════════ */}
      {selectedClient && (
        <div className="fixed inset-0 z-40 bg-black/90 backdrop-blur-sm flex flex-col">
          {/* Detail header */}
          <div className="bg-zinc-900 border-b border-zinc-800 px-4 h-16 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setSelectedClient(null)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-all">
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{selectedClient.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${GOAL_COLORS[selectedClient.goal] ?? 'bg-zinc-700 text-gray-400'}`}>
                {selectedClient.goal}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {selectedClient.phone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} /> {selectedClient.phone}</span>}
              {clientLoginMap[selectedClient.id] ? (
                <button
                  onClick={() => handleDeleteClientLogin(selectedClient.id)}
                  className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1.5 rounded-lg hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20 transition-all"
                  title="Click to revoke portal access"
                >
                  <Lock size={11} /> Portal Active
                </button>
              ) : (
                <button
                  onClick={() => { setCreateLoginForm({ email: selectedClient.email || '', password: '' }); setShowCreateLoginForm(true); }}
                  className="flex items-center gap-1 text-xs text-gray-400 bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 rounded-lg hover:border-zinc-600 hover:text-white transition-all"
                >
                  <Lock size={11} /> Create Login
                </button>
              )}
            </div>
          </div>

          {/* Detail sub-tabs */}
          <div className="bg-zinc-900/60 border-b border-zinc-800 px-4 flex-shrink-0">
            <div className="flex gap-0 overflow-x-auto">
              {([
                { id: 'sessions',  label: 'Sessions',  icon: Calendar },
                { id: 'workout',   label: 'Workout',   icon: Layers },
                { id: 'progress',  label: 'Progress',  icon: TrendingUp },
                { id: 'messages',  label: 'Messages',  icon: MessageSquare },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setClientDetailTab(id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                    clientDetailTab === id ? 'border-green-400 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Detail content */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-xl mx-auto space-y-4">

              {/* Sessions sub-tab */}
              {clientDetailTab === 'sessions' && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">PT sessions with {selectedClient.name}</p>
                    <button onClick={openAddSession}
                      className="flex items-center gap-2 px-3 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all">
                      <Plus size={13} /> Schedule
                    </button>
                  </div>

                  {clientSessions.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                      <Calendar size={32} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No sessions scheduled yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientSessions.map((s) => (
                        <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${SESSION_STATUS[s.status]}`}>{s.status}</span>
                                <span className="text-sm text-white font-semibold">{s.date}</span>
                                <span className="text-xs text-gray-500">{fmt(s.time)} · {s.duration}min</span>
                              </div>
                              {s.notes && <p className="text-xs text-gray-500 mt-1.5 italic">{s.notes}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {s.status === 'scheduled' && (
                                <button onClick={() => handleSessionStatus(s, 'completed')}
                                  className="p-1.5 text-gray-600 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all" title="Mark completed">
                                  <CheckSquare size={14} />
                                </button>
                              )}
                              <button onClick={() => openEditSession(s)}
                                className="p-1.5 text-gray-600 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDeleteSession(s.id)}
                                className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Workout sub-tab */}
              {clientDetailTab === 'workout' && (
                <>
                  <p className="text-xs text-gray-500">Assign a workout plan to {selectedClient.name}.</p>

                  {assignedPlan ? (
                    <div className="bg-zinc-900 border border-green-400/20 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 bg-green-400/5 border-b border-zinc-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-green-400 font-bold uppercase tracking-wider">Assigned Plan</span>
                          <p className="font-bold text-white mt-0.5">{assignedPlan.name}</p>
                        </div>
                        <button
                          onClick={() => toggleAssignPlan(assignedPlan.id)}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition-all"
                        >
                          Unassign
                        </button>
                      </div>
                      {assignedPlan.description && (
                        <p className="px-5 py-3 text-sm text-gray-400 italic border-b border-zinc-800">{assignedPlan.description}</p>
                      )}
                      <div className="divide-y divide-zinc-800">
                        {(assignedPlan.exercises ?? []).map((ex, i) => (
                          <div key={i} className="flex items-center justify-between px-5 py-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{ex.name}</p>
                              {ex.notes && <p className="text-xs text-gray-500">{ex.notes}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-400">{ex.sets}×{ex.reps}</p>
                              <p className="text-xs text-gray-600">sets × reps</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
                      <Layers size={28} className="text-gray-700 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No workout plan assigned.</p>
                    </div>
                  )}

                  {workoutPlans.filter((p) => !p.assignedClientIds?.includes(selectedClient.id)).length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Available Plans</p>
                      <div className="space-y-2">
                        {workoutPlans
                          .filter((p) => !p.assignedClientIds?.includes(selectedClient.id))
                          .map((p) => (
                            <button key={p.id} onClick={() => toggleAssignPlan(p.id)}
                              className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-4 py-3 transition-all group">
                              <div className="text-left">
                                <p className="text-sm font-semibold text-white group-hover:text-green-400 transition-colors">{p.name}</p>
                                <p className="text-xs text-gray-500">{(p.exercises ?? []).length} exercises</p>
                              </div>
                              <span className="text-xs text-green-400 font-bold">Assign →</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {workoutPlans.length === 0 && (
                    <p className="text-xs text-gray-600 text-center">No workout plans created yet. Go to the Workouts tab to create one.</p>
                  )}
                </>
              )}

              {/* Progress sub-tab */}
              {clientDetailTab === 'progress' && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Body metrics over time</p>
                    <button onClick={openAddProgress}
                      className="flex items-center gap-2 px-3 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all">
                      <Plus size={13} /> Log Entry
                    </button>
                  </div>

                  {clientProgress.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                      <TrendingUp size={32} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No progress logs yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clientProgress.map((log) => (
                        <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <Activity size={14} className="text-green-400" />
                              <span className="text-sm font-bold text-white">{log.date}</span>
                            </div>
                            <button onClick={() => handleDeleteProgress(log.id)}
                              className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { key: 'weight',  label: 'Weight', unit: 'kg',  value: log.weight },
                              { key: 'bodyFat', label: 'Body Fat', unit: '%', value: log.bodyFat },
                              { key: 'waist',   label: 'Waist',  unit: 'cm',  value: log.waist },
                              { key: 'chest',   label: 'Chest',  unit: 'cm',  value: log.chest },
                              { key: 'arms',    label: 'Arms',   unit: 'cm',  value: log.arms },
                              { key: 'thigh',   label: 'Thigh',  unit: 'cm',  value: log.thigh },
                            ].filter((m) => m.value !== undefined).map(({ label, unit, value }) => (
                              <div key={label} className="bg-zinc-800 rounded-xl p-2.5 text-center">
                                <p className="text-lg font-black text-white">{value}<span className="text-xs text-gray-500 font-normal ml-0.5">{unit}</span></p>
                                <p className="text-xs text-gray-500">{label}</p>
                              </div>
                            ))}
                          </div>
                          {log.notes && <p className="text-xs text-gray-500 italic mt-2">{log.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {/* ── Messages sub-tab ── */}
              {clientDetailTab === 'messages' && (
                <div className="flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
                  <p className="text-xs text-gray-500 mb-3 flex-shrink-0">
                    Chat with {selectedClient.name}
                    {!clientLoginMap[selectedClient.id] && (
                      <span className="text-yellow-400 ml-2">· Client needs a portal login to reply</span>
                    )}
                  </p>

                  {/* Message list */}
                  <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-2">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center">
                        <MessageSquare size={32} className="text-gray-700 mb-2" />
                        <p className="text-gray-500 text-sm">No messages yet.</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.senderId === user?.uid;
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                              {!isMe && <p className="text-xs text-gray-500 ml-1">{msg.senderName}</p>}
                              <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-green-500 text-black rounded-br-sm' : 'bg-zinc-800 text-white rounded-bl-sm'}`}>
                                {msg.text}
                              </div>
                              {msg.createdAt && (
                                <p className="text-[10px] text-gray-600 mx-1">
                                  {new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={msgEndRef} />
                  </div>

                  {/* Input */}
                  <div className="flex-shrink-0 flex gap-2 mt-3 pt-3 border-t border-zinc-800">
                    <input
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder={`Message ${selectedClient.name}…`}
                      className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMsg.trim() || msgSending}
                      className="px-4 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-800 disabled:text-gray-600 text-black font-bold rounded-xl transition-all"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── Create Login Modal (within client detail) ── */}
          {showCreateLoginForm && (
            <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                  <div>
                    <h3 className="font-bold text-white">Create Client Login</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Portal access for {selectedClient.name}</p>
                  </div>
                  <button onClick={() => setShowCreateLoginForm(false)} className="text-gray-400 hover:text-white"><XCircle size={20} /></button>
                </div>
                <form onSubmit={handleCreateClientLogin} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Email</label>
                    <input
                      type="email" required
                      value={createLoginForm.email}
                      onChange={(e) => setCreateLoginForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="client@email.com"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showLoginPw ? 'text' : 'password'} required minLength={6}
                        value={createLoginForm.password}
                        onChange={(e) => setCreateLoginForm((p) => ({ ...p, password: e.target.value }))}
                        placeholder="Min. 6 characters"
                        className="w-full px-3 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                      />
                      <button type="button" onClick={() => setShowLoginPw(!showLoginPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                        {showLoginPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Share these credentials with {selectedClient.name}. They log in at /client/login.</p>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowCreateLoginForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                    <button type="submit" disabled={createLoginSaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm">
                      {createLoginSaving ? 'Creating…' : 'Create Login'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Session Form (within client detail) ── */}
          {showSessionForm && (
            <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                  <h3 className="font-bold text-white">{editingSession ? 'Edit Session' : 'Schedule Session'}</h3>
                  <button onClick={() => setShowSessionForm(false)} className="text-gray-400 hover:text-white"><XCircle size={20} /></button>
                </div>
                <form onSubmit={handleSessionSubmit} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Date</label>
                      <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Time</label>
                      <input type="time" value={sessionForm.time} onChange={(e) => setSessionForm((p) => ({ ...p, time: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Duration (min)</label>
                      <input type="number" min={15} step={15} value={sessionForm.duration} onChange={(e) => setSessionForm((p) => ({ ...p, duration: Number(e.target.value) }))}
                        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Status</label>
                      <select value={sessionForm.status} onChange={(e) => setSessionForm((p) => ({ ...p, status: e.target.value as PTSession['status'] }))}
                        className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400">
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no-show">No Show</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Notes</label>
                    <textarea rows={2} value={sessionForm.notes} onChange={(e) => setSessionForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Focus area, reminders…"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400 resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowSessionForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                    <button type="submit" disabled={sessionSaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm">
                      {sessionSaving ? 'Saving…' : editingSession ? 'Update' : 'Schedule'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Progress Form (within client detail) ── */}
          {showProgressForm && (
            <div className="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                  <h3 className="font-bold text-white">Log Progress Entry</h3>
                  <button onClick={() => setShowProgressForm(false)} className="text-gray-400 hover:text-white"><XCircle size={20} /></button>
                </div>
                <form onSubmit={handleProgressSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Date</label>
                    <input type="date" value={progressForm.date} onChange={(e) => setProgressForm((p) => ({ ...p, date: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'weight',  label: 'Weight (kg)', placeholder: '75' },
                      { key: 'bodyFat', label: 'Body Fat (%)', placeholder: '20' },
                      { key: 'waist',   label: 'Waist (cm)',  placeholder: '85' },
                      { key: 'chest',   label: 'Chest (cm)',  placeholder: '95' },
                      { key: 'arms',    label: 'Arms (cm)',   placeholder: '35' },
                      { key: 'thigh',   label: 'Thigh (cm)',  placeholder: '55' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                        <input
                          type="number" step="0.1"
                          value={(progressForm as Record<string, string>)[key]}
                          onChange={(e) => setProgressForm((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Notes</label>
                    <input value={progressForm.notes} onChange={(e) => setProgressForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Observations, energy level…"
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400" />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowProgressForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                    <button type="submit" disabled={progressSaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm">
                      {progressSaving ? 'Saving…' : 'Save Log'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ WORKOUT PLAN FORM MODAL ═══════════════════ */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center px-4 py-6 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-bold text-white">{editingPlan ? 'Edit Workout Plan' : 'New Workout Plan'}</h3>
              <button onClick={() => setShowPlanForm(false)} className="text-gray-400 hover:text-white"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handlePlanSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Plan Name *</label>
                <input value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} required
                  placeholder="e.g. Fat Loss Phase 1"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Description</label>
                <textarea rows={2} value={planForm.description} onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Plan overview, target weeks, intensity…"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400 resize-none" />
              </div>

              {/* Exercise list */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Exercises ({planExercises.length})</p>
                {planExercises.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {planExercises.map((ex, i) => (
                      <div key={i} className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5">
                        <span className="text-xs text-gray-600 font-mono w-5 text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{ex.name}</p>
                          <p className="text-xs text-gray-500">{ex.sets} sets × {ex.reps} reps{ex.notes ? ` · ${ex.notes}` : ''}</p>
                        </div>
                        <button type="button" onClick={() => removeExercise(i)}
                          className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add exercise row */}
                <div className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-gray-500 font-semibold">Add Exercise</p>
                  <input
                    value={newExercise.name}
                    onChange={(e) => setNewExercise((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExerciseToList(); } }}
                    placeholder="Exercise name (e.g. Squats)"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Sets</label>
                      <input type="number" min={1} value={newExercise.sets}
                        onChange={(e) => setNewExercise((p) => ({ ...p, sets: Number(e.target.value) }))}
                        className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Reps</label>
                      <input value={newExercise.reps}
                        onChange={(e) => setNewExercise((p) => ({ ...p, reps: e.target.value }))}
                        placeholder="10 or 8-12"
                        className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Notes</label>
                      <input value={newExercise.notes}
                        onChange={(e) => setNewExercise((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Rest 60s"
                        className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400" />
                    </div>
                  </div>
                  <button type="button" onClick={addExerciseToList}
                    className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 text-gray-300 hover:text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
                    <Plus size={13} /> Add Exercise
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPlanForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                <button type="submit" disabled={planSaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm">
                  {planSaving ? 'Saving…' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════ AVAILABILITY FORM MODAL ═══════════════════ */}
      {showAvailForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-bold text-white">Add Availability Slot</h3>
              <button onClick={() => setShowAvailForm(false)} className="text-gray-400 hover:text-white"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleAvailSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Day</label>
                <select value={availForm.day} onChange={(e) => setAvailForm((p) => ({ ...p, day: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400">
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">From</label>
                  <input type="time" value={availForm.startTime} onChange={(e) => setAvailForm((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">To</label>
                  <input type="time" value={availForm.endTime} onChange={(e) => setAvailForm((p) => ({ ...p, endTime: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-400" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAvailForm(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm">Cancel</button>
                <button type="submit" disabled={availSaving} className="flex-1 py-2.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 text-black font-bold rounded-xl text-sm">
                  {availSaving ? 'Saving…' : 'Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerDashboard;
