import { useState } from 'react';
import {
  collection, query, where, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { QrCode, User, Phone, CheckCircle, XCircle, Loader, Dumbbell } from 'lucide-react';

type Step = 'pin' | 'details' | 'success' | 'error';

interface ClassSession {
  id: string;
  title: string;
  trainerName: string;
  area: string;
  startTime: string;
  duration: number;
  capacity: number;
  pin: string;
  pinValidFrom: string;
  pinValidTo: string;
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const CheckIn = () => {
  const [step, setStep]             = useState<Step>('pin');
  const [pin, setPin]               = useState('');
  const [name, setName]             = useState('');
  const [phone, setPhone]           = useState('');
  const [session, setSession]       = useState<ClassSession | null>(null);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      // Find session by PIN + today's date
      const q = query(
        collection(db, 'classSessions'),
        where('pin', '==', pin.trim()),
        where('date', '==', today),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setErrorMsg('PIN not found. Check the PIN shown in your class.');
        return;
      }

      const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as ClassSession;

      // Validate time window
      if (now < new Date(data.pinValidFrom)) {
        setErrorMsg(`Class hasn't started yet. Check-in opens at ${formatTime(data.startTime)}.`);
        return;
      }
      if (now > new Date(data.pinValidTo)) {
        setErrorMsg('Check-in window has closed for this class.');
        return;
      }

      setSession(data);
      setStep('details');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setLoading(true);
    setErrorMsg('');
    try {
      // Check capacity
      const existingQ = query(
        collection(db, 'attendance'),
        where('sessionId', '==', session.id),
      );
      const existing = await getDocs(existingQ);

      // Check if already checked in by phone
      const duplicate = existing.docs.find((d) => d.data().memberPhone === phone.trim());
      if (duplicate) {
        setAlreadyCheckedIn(true);
        setStep('success');
        return;
      }

      if (existing.size >= session.capacity) {
        setErrorMsg('This class is at full capacity.');
        return;
      }

      await addDoc(collection(db, 'attendance'), {
        sessionId: session.id,
        memberName: name.trim(),
        memberPhone: phone.trim(),
        checkedInAt: serverTimestamp(),
      });

      setStep('success');
    } catch {
      setErrorMsg('Could not record your check-in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/lovable-uploads/crunch.png" alt="Crunch Fitness" className="h-14 w-auto object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold text-white">Class Check-In</h1>
          <p className="text-gray-500 text-sm mt-1">Enter the PIN shown in your class</p>
        </div>

        {/* Step: Enter PIN */}
        {step === 'pin' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handlePinSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Class PIN</label>
                <div className="relative">
                  <QrCode size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit PIN"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 transition-colors text-center text-2xl font-mono tracking-[0.3em]"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                  <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full py-3.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? <Loader size={18} className="animate-spin" /> : <><QrCode size={16} /> Verify PIN</>}
              </button>
            </form>
          </div>
        )}

        {/* Step: Enter name + phone */}
        {step === 'details' && session && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            {/* Session info */}
            <div className="bg-green-400/10 border border-green-400/20 rounded-xl p-3 mb-5">
              <p className="text-green-400 font-bold text-sm">{session.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">{session.area} · {formatTime(session.startTime)} · {session.trainerName}</p>
            </div>

            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Your Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 transition-colors text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 transition-colors text-sm"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                  <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? <Loader size={18} className="animate-spin" /> : <><CheckCircle size={16} /> Mark Attendance</>}
              </button>
            </form>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && session && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-20 h-20 bg-green-400/10 border-2 border-green-400/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-green-400" />
            </div>
            {alreadyCheckedIn ? (
              <>
                <h2 className="text-xl font-bold text-white mb-2">Already Checked In</h2>
                <p className="text-gray-400 text-sm">Your attendance was already recorded for this class.</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white mb-2">You're Checked In!</h2>
                <p className="text-gray-400 text-sm">Welcome to <span className="text-white font-semibold">{session.title}</span>. Have a great workout!</p>
              </>
            )}
            <div className="mt-4 bg-green-400/10 border border-green-400/20 rounded-xl p-3">
              <p className="text-xs text-green-400">{session.area} · {formatTime(session.startTime)}</p>
            </div>
            <button
              onClick={() => { setStep('pin'); setPin(''); setName(''); setPhone(''); setSession(null); setAlreadyCheckedIn(false); }}
              className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Check in for another class
            </button>
          </div>
        )}

        <p className="text-center text-gray-600 text-xs mt-6 flex items-center justify-center gap-1.5">
          <Dumbbell size={11} /> Crunch Fitness Club
        </p>
      </div>
    </div>
  );
};

export default CheckIn;
