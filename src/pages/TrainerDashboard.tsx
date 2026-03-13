import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, orderBy,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useRole } from '../hooks/useRole';
import {
  LogOut, Dumbbell, Calendar, Clock, Users, MapPin,
  CheckCircle, QrCode, ChevronRight, Shield,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Duty {
  id: string;
  trainerId: string;
  trainerName: string;
  area: string;
  days: string[];
  shift: string;
  weekStart: string;
}

interface ClassSession {
  id: string;
  trainerId: string;
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

interface Attendance {
  id: string;
  sessionId: string;
  memberName: string;
  memberPhone: string;
  checkedInAt: { seconds: number };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getTodayName(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function isPinActive(session: ClassSession): boolean {
  const now = new Date();
  return now >= new Date(session.pinValidFrom) && now <= new Date(session.pinValidTo);
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const AREA_COLORS: Record<string, string> = {
  'Cardio Zone':        'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Powerlifting':       'bg-red-500/15 text-red-400 border-red-500/30',
  'CrossFit':           'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Yoga & Flexibility': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Functional Training':'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Boxing':             'bg-pink-500/15 text-pink-400 border-pink-500/30',
  'Floor Duty':         'bg-green-500/15 text-green-400 border-green-500/30',
};

// ── Component ──────────────────────────────────────────────────────────────────
const TrainerDashboard = () => {
  const navigate = useNavigate();
  const { role, user } = useRole();

  const [duties, setDuties]     = useState<Duty[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>({});
  const [activeSession, setActiveSession] = useState<string | null>(null);

  const trainerId = role?.trainerId ?? user?.uid ?? '';
  const trainerName = role?.name ?? user?.email ?? '';
  const weekStart = getWeekStart(new Date());
  const today = new Date().toISOString().split('T')[0];
  const todayName = getTodayName();

  // Load this week's duties for this trainer
  useEffect(() => {
    if (!trainerId) return;
    const q = query(
      collection(db, 'duties'),
      where('trainerId', '==', trainerId),
      where('weekStart', '==', weekStart),
    );
    return onSnapshot(q, (snap) =>
      setDuties(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Duty)))
    );
  }, [trainerId, weekStart]);

  // Load today's class sessions for this trainer
  useEffect(() => {
    if (!trainerId) return;
    const q = query(
      collection(db, 'classSessions'),
      where('trainerId', '==', trainerId),
      where('date', '==', today),
      orderBy('startTime', 'asc'),
    );
    return onSnapshot(q, (snap) =>
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession)))
    );
  }, [trainerId, today]);

  // Load attendance for today's sessions
  useEffect(() => {
    if (sessions.length === 0) return;
    const sessionIds = sessions.map((s) => s.id);
    const q = query(
      collection(db, 'attendance'),
      where('sessionId', 'in', sessionIds),
    );
    return onSnapshot(q, (snap) => {
      const map: Record<string, Attendance[]> = {};
      snap.docs.forEach((d) => {
        const a = { id: d.id, ...d.data() } as Attendance;
        if (!map[a.sessionId]) map[a.sessionId] = [];
        map[a.sessionId].push(a);
      });
      setAttendance(map);
    });
  }, [sessions]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/trainer/login');
  };

  const todayDuty = duties.find((d) => d.days.includes(todayName));
  const areaStyle = todayDuty ? (AREA_COLORS[todayDuty.area] ?? AREA_COLORS['Floor Duty']) : '';

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 h-16 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-400/10 border border-green-400/20 rounded-lg flex items-center justify-center">
            <Dumbbell size={16} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">{trainerName}</p>
            <p className="text-xs text-gray-500">Trainer Portal</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
        >
          <LogOut size={15} /> Sign Out
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Today's Duty Card */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar size={13} /> Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          {todayDuty ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Area Assignment</p>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${areaStyle}`}>
                    <MapPin size={13} /> {todayDuty.area}
                  </span>
                  <p className="text-white font-semibold mt-3">{todayDuty.shift}</p>
                </div>
                <div className="text-right">
                  <Shield size={32} className="text-green-400/30 ml-auto" />
                  <p className="text-xs text-gray-600 mt-1">On Duty</p>
                </div>
              </div>
              {/* Week view */}
              <div className="mt-4 flex gap-1.5 flex-wrap">
                {DAYS.map((day) => (
                  <span
                    key={day}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                      todayDuty.days.includes(day)
                        ? day === todayName
                          ? 'bg-green-400 text-black'
                          : 'bg-green-400/15 text-green-400'
                        : 'bg-zinc-800 text-gray-600'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-gray-500 text-sm">No duty assignment for today.</p>
              <p className="text-gray-600 text-xs mt-1">Check with your admin if this seems wrong.</p>
            </div>
          )}
        </section>

        {/* Full week duty */}
        {duties.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              This Week's Schedule
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {DAYS.map((day) => {
                const duty = duties.find((d) => d.days.includes(day));
                const isToday = day === todayName;
                const style = duty ? (AREA_COLORS[duty.area] ?? AREA_COLORS['Floor Duty']) : '';
                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                      isToday ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-20 ${isToday ? 'text-green-400' : 'text-gray-400'}`}>
                        {day.slice(0, 3)}{isToday && <span className="text-xs ml-1 text-green-400">(Today)</span>}
                      </span>
                      {duty ? (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${style}`}>
                          {duty.area}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">— Off</span>
                      )}
                    </div>
                    {duty && <span className="text-xs text-gray-500">{duty.shift}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Today's Class Sessions */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <QrCode size={13} /> Today's Classes & Attendance PINs
          </h2>
          {sessions.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-gray-500 text-sm">No classes scheduled for today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const active = isPinActive(session);
                const count = (attendance[session.id] ?? []).length;
                const isExpanded = activeSession === session.id;
                const attendees = attendance[session.id] ?? [];

                return (
                  <div key={session.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setActiveSession(isExpanded ? null : session.id)}
                      className="w-full text-left px-5 py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-white">{session.title}</p>
                          {active ? (
                            <span className="text-xs bg-green-400/15 text-green-400 border border-green-400/30 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                              LIVE
                            </span>
                          ) : (
                            <span className="text-xs bg-zinc-800 text-gray-500 px-2 py-0.5 rounded-full">
                              {new Date() < new Date(session.pinValidFrom) ? 'Upcoming' : 'Ended'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Clock size={11} /> {formatTime(session.startTime)}</span>
                          <span className="flex items-center gap-1"><MapPin size={11} /> {session.area}</span>
                          <span className="flex items-center gap-1"><Users size={11} /> {count}/{session.capacity}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`text-gray-600 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-zinc-800 px-5 py-4 space-y-4">
                        {/* PIN display */}
                        <div className="bg-zinc-800 rounded-xl p-4 text-center">
                          <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Class PIN (members use this to check in)</p>
                          <p className="text-4xl font-mono font-black tracking-[0.3em] text-green-400">
                            {active ? session.pin : '••••••'}
                          </p>
                          {active ? (
                            <p className="text-xs text-green-400/70 mt-2">Valid until {new Date(session.pinValidTo).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          ) : (
                            <p className="text-xs text-gray-600 mt-2">PIN only visible during class window</p>
                          )}
                        </div>

                        {/* Attendance list */}
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Checked In ({attendees.length}/{session.capacity})
                          </p>
                          {attendees.length === 0 ? (
                            <p className="text-xs text-gray-600 py-2">No check-ins yet.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {attendees.map((a) => (
                                <div key={a.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                                    <span className="text-sm text-white font-medium">{a.memberName}</span>
                                    <span className="text-xs text-gray-500">{a.memberPhone}</span>
                                  </div>
                                  <span className="text-xs text-gray-600">
                                    {new Date(a.checkedInAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Notice */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-3">
          <Shield size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Attendance is <span className="text-white font-semibold">member self-check-in only</span>. PINs are time-locked to each class window and auto-expire. You cannot manually add members — this keeps attendance records accurate.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrainerDashboard;
