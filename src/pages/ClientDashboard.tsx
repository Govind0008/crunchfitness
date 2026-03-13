import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useRole } from '../hooks/useRole';
import {
  LogOut, Dumbbell, Calendar, Clock, Users, Target,
  TrendingUp, MessageSquare, Send, CheckCircle,
  Layers, Activity, ChevronRight, UserCheck, Shield,
  LayoutDashboard, AlarmClock, Plus, XCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PTSession {
  id: string; clientId: string; date: string; time: string;
  duration: number; status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes: string;
}
interface Exercise { name: string; sets: number; reps: string; notes: string; }
interface WorkoutPlan {
  id: string; name: string; description: string;
  exercises: Exercise[]; assignedClientIds: string[];
}
interface ProgressLog {
  id: string; date: string; notes: string;
  weight?: number; bodyFat?: number; waist?: number;
  chest?: number; arms?: number; thigh?: number;
}
interface ChatMessage {
  id: string; senderId: string; senderName: string;
  text: string; createdAt: { seconds: number } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function today() { return new Date().toISOString().split('T')[0]; }

// ── Component ─────────────────────────────────────────────────────────────────
const ClientDashboard = () => {
  const navigate  = useNavigate();
  const { role, user } = useRole();
  const trainerId   = role?.trainerId ?? '';
  const clientId    = role?.clientId ?? '';
  const clientName  = role?.name ?? user?.email ?? '';
  const trainerName = role?.trainerName ?? 'Your Trainer';
  const clientGoal  = (role as any)?.goal ?? '';
  const convId      = trainerId && clientId ? `${trainerId}_${clientId}` : '';
  const todayStr    = today();

  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'workout' | 'progress' | 'messages'>('overview');

  // ── Data ──
  const [sessions, setSessions]     = useState<PTSession[]>([]);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [progress, setProgress]     = useState<ProgressLog[]>([]);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg]         = useState('');
  const [msgSending, setMsgSending] = useState(false);

  // Progress form
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [progressForm, setProgressForm] = useState({
    date: todayStr, weight: '', bodyFat: '', waist: '', chest: '', arms: '', thigh: '', notes: '',
  });
  const [progressSaving, setProgressSaving] = useState(false);

  // Unread badge
  const [unreadCount, setUnreadCount] = useState(0);
  const lastReadAt = useRef<number>(Date.now());

  const msgEndRef = useRef<HTMLDivElement>(null);

  // ── Firestore Listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!trainerId || !clientId) return;
    return onSnapshot(
      query(collection(db, 'trainerData', trainerId, 'sessions'), where('clientId', '==', clientId), orderBy('date', 'desc')),
      (s) => setSessions(s.docs.map((d) => ({ id: d.id, ...d.data() } as PTSession)))
    );
  }, [trainerId, clientId]);

  useEffect(() => {
    if (!trainerId || !clientId) return;
    return onSnapshot(
      collection(db, 'trainerData', trainerId, 'workoutPlans'),
      (s) => {
        const assigned = s.docs
          .map((d) => ({ id: d.id, ...d.data() } as WorkoutPlan))
          .find((p) => (p.assignedClientIds ?? []).includes(clientId));
        setWorkoutPlan(assigned ?? null);
      }
    );
  }, [trainerId, clientId]);

  useEffect(() => {
    if (!trainerId || !clientId) return;
    return onSnapshot(
      query(collection(db, 'trainerData', trainerId, 'clients', clientId, 'progressLogs'), orderBy('date', 'desc')),
      (s) => setProgress(s.docs.map((d) => ({ id: d.id, ...d.data() } as ProgressLog)))
    );
  }, [trainerId, clientId]);

  useEffect(() => {
    if (!convId) return;
    return onSnapshot(
      query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc')),
      (s) => {
        const msgs = s.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));
        setMessages(msgs);
        // Count messages received after last read when not on messages tab
        if (activeTab !== 'messages') {
          const newFromTrainer = msgs.filter(
            (m) => m.senderId !== user?.uid && (m.createdAt?.seconds ?? 0) * 1000 > lastReadAt.current
          ).length;
          setUnreadCount(newFromTrainer);
        }
      }
    );
  }, [convId, user?.uid]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (activeTab === 'messages') {
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
      lastReadAt.current = Date.now();
    }
  }, [messages, activeTab]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!newMsg.trim() || !convId) return;
    setMsgSending(true);
    try {
      await addDoc(collection(db, 'conversations', convId, 'messages'), {
        senderId: user?.uid,
        senderName: clientName,
        text: newMsg.trim(),
        createdAt: serverTimestamp(),
      });
      setNewMsg('');
    } catch (err) { console.error(err); }
    finally { setMsgSending(false); }
  };

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainerId || !clientId) return;
    setProgressSaving(true);
    try {
      const entry = {
        date: progressForm.date, notes: progressForm.notes,
        ...(progressForm.weight  ? { weight:  Number(progressForm.weight)  } : {}),
        ...(progressForm.bodyFat ? { bodyFat: Number(progressForm.bodyFat) } : {}),
        ...(progressForm.waist   ? { waist:   Number(progressForm.waist)   } : {}),
        ...(progressForm.chest   ? { chest:   Number(progressForm.chest)   } : {}),
        ...(progressForm.arms    ? { arms:    Number(progressForm.arms)    } : {}),
        ...(progressForm.thigh   ? { thigh:   Number(progressForm.thigh)   } : {}),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'trainerData', trainerId, 'clients', clientId, 'progressLogs'), entry);
      setShowProgressForm(false);
      setProgressForm({ date: todayStr, weight: '', bodyFat: '', waist: '', chest: '', arms: '', thigh: '', notes: '' });
    } catch (err) { console.error(err); }
    finally { setProgressSaving(false); }
  };

  const handleLogout = async () => { await signOut(auth); navigate('/client/login'); };

  // ── Derived ──────────────────────────────────────────────────────────────
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled' && s.date >= todayStr);
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const completionRate = sessions.length > 0 ? Math.round((completedSessions.length / sessions.length) * 100) : null;
  const lastProgress = progress[0];
  const prevProgress = progress[1];
  const weightDelta = lastProgress?.weight !== undefined && prevProgress?.weight !== undefined
    ? +(lastProgress.weight - prevProgress.weight).toFixed(1) : null;
  const bodyFatDelta = lastProgress?.bodyFat !== undefined && prevProgress?.bodyFat !== undefined
    ? +(lastProgress.bodyFat - prevProgress.bodyFat).toFixed(1) : null;
  const waistDelta = lastProgress?.waist !== undefined && prevProgress?.waist !== undefined
    ? +(lastProgress.waist - prevProgress.waist).toFixed(1) : null;
  const daysUntilNext = upcomingSessions[0]
    ? Math.max(0, Math.round((new Date(upcomingSessions[0].date + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000))
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 h-16 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-400/10 border border-blue-400/20 rounded-lg flex items-center justify-center">
            <Dumbbell size={16} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">{clientName}</p>
            <p className="text-xs text-gray-500">Client Portal</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 text-sm font-semibold transition-colors px-2 py-1.5 rounded-lg hover:bg-red-500/10">
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      {/* Tab Bar */}
      <div className="bg-zinc-900/60 border-b border-zinc-800 px-4">
        <div className="flex gap-0 max-w-3xl mx-auto overflow-x-auto">
          {([
            { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
            { id: 'sessions',  label: 'Sessions',  icon: Calendar },
            { id: 'workout',   label: 'Workout',   icon: Layers },
            { id: 'progress',  label: 'Progress',  icon: TrendingUp },
            { id: 'messages',  label: 'Messages',  icon: MessageSquare, badge: unreadCount },
          ] as const).map(({ id, label, icon: Icon, badge }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                activeTab === id ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              <Icon size={14} /> {label}
              {(badge ?? 0) > 0 && (
                <span className="absolute top-2 right-1 w-4 h-4 bg-blue-400 text-black text-[10px] font-black rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Greeting */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Welcome back</p>
                  <h2 className="text-xl font-black text-white">{clientName}</h2>
                  {clientGoal && (
                    <span className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-semibold ${GOAL_COLORS[clientGoal] ?? 'bg-zinc-700 text-gray-400'}`}>
                      {clientGoal}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Your Trainer</p>
                  <p className="text-sm font-bold text-white">{trainerName}</p>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Upcoming', value: upcomingSessions.length, icon: Calendar, color: 'text-blue-400', tab: 'sessions' as const },
                { label: 'Completed', value: completedSessions.length, icon: CheckCircle, color: 'text-green-400', tab: 'sessions' as const },
                { label: 'Progress Logs', value: progress.length, icon: TrendingUp, color: 'text-purple-400', tab: 'progress' as const },
              ].map(({ label, value, icon: Icon, color, tab }) => (
                <button key={label} onClick={() => setActiveTab(tab)}
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 text-center transition-all group">
                  <Icon size={20} className={`${color} mx-auto mb-1.5`} />
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </button>
              ))}
            </div>

            {/* Next session */}
            {upcomingSessions.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Next Session</h3>
                <div className="bg-zinc-900 border border-blue-500/20 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {daysUntilNext === 0
                          ? <span className="text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">Today!</span>
                          : daysUntilNext === 1
                          ? <span className="text-xs font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">Tomorrow</span>
                          : daysUntilNext !== null
                          ? <span className="text-xs font-semibold text-gray-400">in {daysUntilNext} days</span>
                          : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar size={12} /> {upcomingSessions[0].date}
                        <Clock size={12} className="ml-1" /> {fmt(upcomingSessions[0].time)}
                        <span>· {upcomingSessions[0].duration}min</span>
                      </div>
                      {upcomingSessions[0].notes && (
                        <p className="text-sm text-gray-300 mt-1 italic">{upcomingSessions[0].notes}</p>
                      )}
                    </div>
                    <span className="text-xs bg-blue-400/15 text-blue-400 border border-blue-400/30 px-2.5 py-1 rounded-full font-semibold">Scheduled</span>
                  </div>
                </div>
              </div>
            )}

            {/* Latest progress */}
            {lastProgress && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Latest Progress — {lastProgress.date}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'weight',  label: 'Weight', unit: 'kg',  val: lastProgress.weight },
                    { key: 'bodyFat', label: 'Body Fat', unit: '%', val: lastProgress.bodyFat },
                    { key: 'waist',   label: 'Waist',  unit: 'cm',  val: lastProgress.waist },
                  ].filter((m) => m.val !== undefined).map(({ label, unit, val }) => (
                    <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                      <p className="text-xl font-black text-white">{val}<span className="text-xs text-gray-500 ml-0.5">{unit}</span></p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lastProgress && prevProgress && (weightDelta !== null || bodyFatDelta !== null || waistDelta !== null) && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Since {prevProgress.date}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Weight', delta: weightDelta, unit: 'kg' },
                    { label: 'Body Fat', delta: bodyFatDelta, unit: '%' },
                    { label: 'Waist', delta: waistDelta, unit: 'cm' },
                  ].filter((m) => m.delta !== null).map(({ label, delta, unit }) => {
                    const isGood = delta! < 0;
                    const isNeutral = delta === 0;
                    return (
                      <div key={label} className={`bg-zinc-900 border rounded-xl p-3 text-center ${isNeutral ? 'border-zinc-800' : isGood ? 'border-green-500/25' : 'border-red-500/20'}`}>
                        <p className={`text-lg font-black ${isNeutral ? 'text-gray-400' : isGood ? 'text-green-400' : 'text-red-400'}`}>
                          {delta! > 0 ? '+' : ''}{delta}{unit}
                        </p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {completionRate !== null && sessions.length >= 3 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Session Completion Rate</p>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${completionRate >= 80 ? 'bg-green-400/10 text-green-400' : completionRate >= 50 ? 'bg-yellow-400/10 text-yellow-400' : 'bg-zinc-800 text-gray-400'}`}>
                    {completionRate}%
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${completionRate >= 80 ? 'bg-green-400' : completionRate >= 50 ? 'bg-yellow-400' : 'bg-zinc-600'}`} style={{ width: `${completionRate}%` }} />
                </div>
                <p className="text-xs text-gray-600 mt-1.5">{completedSessions.length} of {sessions.length} sessions completed</p>
              </div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-3">
              <Shield size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Your data is private. Only you and <span className="text-white font-semibold">{trainerName}</span> can see your sessions, progress, and messages.
              </p>
            </div>
          </>
        )}

        {/* ═══════════ SESSIONS TAB ═══════════ */}
        {activeTab === 'sessions' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Your personal training sessions with {trainerName}.</p>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-blue-400/10 text-blue-400 border border-blue-400/20 px-2.5 py-1 rounded-full font-semibold">
                  {upcomingSessions.length} upcoming
                </span>
                {completionRate !== null && sessions.length >= 2 && (
                  <span className="text-xs bg-green-400/10 text-green-400 border border-green-400/20 px-2.5 py-1 rounded-full font-semibold">
                    {completionRate}% done
                  </span>
                )}
              </div>
            </div>

            {sessions.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
                <Calendar size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No sessions scheduled yet.</p>
                <p className="text-gray-600 text-xs mt-1">Your trainer will schedule your sessions.</p>
              </div>
            ) : (
              <>
                {upcomingSessions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upcoming</p>
                    <div className="space-y-2">
                      {upcomingSessions.map((s) => (
                        <div key={s.id} className="bg-zinc-900 border border-blue-500/20 rounded-2xl px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <Calendar size={13} className="text-blue-400" /> {s.date}
                                <Clock size={12} className="text-gray-500 ml-1" />
                                <span className="text-gray-400 font-normal">{fmt(s.time)} · {s.duration}min</span>
                              </div>
                              {s.notes && <p className="text-xs text-gray-500 mt-1 italic">{s.notes}</p>}
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${SESSION_STATUS[s.status]}`}>{s.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sessions.filter((s) => s.status !== 'scheduled' || s.date < todayStr).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">History</p>
                    <div className="space-y-2">
                      {sessions
                        .filter((s) => s.status !== 'scheduled' || s.date < todayStr)
                        .map((s) => (
                          <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                  <Calendar size={12} /> {s.date}
                                  <Clock size={12} className="ml-1" /> {fmt(s.time)} · {s.duration}min
                                </div>
                                {s.notes && <p className="text-xs text-gray-600 mt-1 italic">{s.notes}</p>}
                              </div>
                              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${SESSION_STATUS[s.status]}`}>{s.status}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════ WORKOUT TAB ═══════════ */}
        {activeTab === 'workout' && (
          <>
            <p className="text-xs text-gray-500">Workout plan assigned by {trainerName}.</p>
            {workoutPlan ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 bg-purple-400/5 border-b border-zinc-800">
                  <p className="text-xs text-purple-400 font-bold uppercase tracking-wider">Your Plan</p>
                  <p className="text-xl font-black text-white mt-0.5">{workoutPlan.name}</p>
                  {workoutPlan.description && (
                    <p className="text-sm text-gray-400 mt-1 italic">{workoutPlan.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">{(workoutPlan.exercises ?? []).length} exercises</p>
                </div>
                <div className="divide-y divide-zinc-800">
                  {(workoutPlan.exercises ?? []).map((ex, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-600 w-6">{String(i + 1).padStart(2, '0')}</span>
                          <p className="text-sm font-bold text-white">{ex.name}</p>
                        </div>
                        {ex.notes && <p className="text-xs text-gray-500 ml-8 mt-0.5">{ex.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-purple-400">{ex.sets}×{ex.reps}</p>
                        <p className="text-xs text-gray-600">sets × reps</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
                <Layers size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No workout plan assigned yet.</p>
                <p className="text-gray-600 text-xs mt-1">Your trainer will assign a plan for you.</p>
              </div>
            )}
          </>
        )}

        {/* ═══════════ PROGRESS TAB ═══════════ */}
        {activeTab === 'progress' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Your body metrics over time</p>
              <button onClick={() => setShowProgressForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all">
                <Plus size={13} /> Log Entry
              </button>
            </div>

            {progress.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
                <TrendingUp size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No progress logs yet.</p>
                <p className="text-gray-600 text-xs mt-1">Log your first entry to start tracking.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {progress.map((log, idx) => {
                  const older = progress[idx + 1];
                  return (
                  <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-green-400" />
                        <span className="text-sm font-bold text-white">{log.date}</span>
                      </div>
                      {idx === 0 && progress.length > 1 && <span className="text-xs text-gray-600">Latest</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Weight', unit: 'kg',  val: log.weight },
                        { label: 'Body Fat', unit: '%', val: log.bodyFat },
                        { label: 'Waist',  unit: 'cm',  val: log.waist },
                        { label: 'Chest',  unit: 'cm',  val: log.chest },
                        { label: 'Arms',   unit: 'cm',  val: log.arms },
                        { label: 'Thigh',  unit: 'cm',  val: log.thigh },
                      ].filter((m) => m.val !== undefined).map(({ label, unit, val }) => (
                        <div key={label} className="bg-zinc-800 rounded-xl p-2.5 text-center">
                          <p className="text-lg font-black text-white">{val}<span className="text-xs text-gray-500 font-normal ml-0.5">{unit}</span></p>
                          <p className="text-xs text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                    {log.notes && <p className="text-xs text-gray-500 italic mt-2">{log.notes}</p>}
                    {older && (
                      <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-600">vs {older.date}:</span>
                        {[
                          { label: 'wt', val: log.weight, prev: older.weight, unit: 'kg' },
                          { label: 'bf', val: log.bodyFat, prev: older.bodyFat, unit: '%' },
                          { label: 'waist', val: log.waist, prev: older.waist, unit: 'cm' },
                        ].filter(m => m.val !== undefined && m.prev !== undefined).map(({ label, val, prev, unit }) => {
                          const d = +(val! - prev!).toFixed(1);
                          return (
                            <span key={label} className={`text-xs font-semibold ${d < 0 ? 'text-green-400' : d > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                              {label} {d > 0 ? '+' : ''}{d}{unit}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════ MESSAGES TAB ═══════════ */}
        {activeTab === 'messages' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
            <p className="text-xs text-gray-500 mb-4 flex-shrink-0">Chat with {trainerName}</p>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-2">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <MessageSquare size={36} className="text-gray-700 mb-3" />
                  <p className="text-gray-500 text-sm">No messages yet.</p>
                  <p className="text-gray-600 text-xs mt-1">Start the conversation with your trainer.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        {!isMe && <p className="text-xs text-gray-500 ml-1">{msg.senderName}</p>}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-blue-500 text-white rounded-br-sm'
                            : 'bg-zinc-800 text-white rounded-bl-sm'
                        }`}>
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
                placeholder="Message your trainer…"
                className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMsg.trim() || msgSending}
                className="px-4 py-2.5 bg-blue-400 hover:bg-blue-300 disabled:bg-zinc-800 disabled:text-gray-600 text-black font-bold rounded-xl transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ Progress Form Modal ══ */}
      {showProgressForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
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
                  { key: 'weight',  label: 'Weight (kg)', ph: '75' },
                  { key: 'bodyFat', label: 'Body Fat (%)', ph: '20' },
                  { key: 'waist',   label: 'Waist (cm)',   ph: '85' },
                  { key: 'chest',   label: 'Chest (cm)',   ph: '95' },
                  { key: 'arms',    label: 'Arms (cm)',    ph: '35' },
                  { key: 'thigh',   label: 'Thigh (cm)',   ph: '55' },
                ].map(({ key, label, ph }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                    <input
                      type="number" step="0.1" placeholder={ph}
                      value={(progressForm as Record<string, string>)[key]}
                      onChange={(e) => setProgressForm((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-green-400"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Notes</label>
                <input value={progressForm.notes} onChange={(e) => setProgressForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="How are you feeling?"
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
  );
};

export default ClientDashboard;
