import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteEvent, type CrunchEvent } from '@/lib/events';
import { inputCls } from './shared';

/** Permanently delete an event. If people registered, the name must be typed to confirm. */
const DeleteEvent = ({ ev }: { ev: CrunchEvent }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsName = ev.registrationCount > 0;
  const ok = !needsName || typed.trim().toLowerCase() === ev.title.trim().toLowerCase();

  const run = async () => {
    setBusy(true); setError(null);
    try { await deleteEvent(ev); navigate('/admin/events', { replace: true }); }
    catch (e) { setError(`Couldn’t delete: ${(e as Error).message}`); setBusy(false); }
  };

  return (
    <section aria-labelledby="delete-heading" className="mt-14 rounded-2xl border border-red-500/25 p-5 sm:p-6">
      <h2 id="delete-heading" className="font-semibold text-white">Delete this event</h2>
      <p className="mt-1 text-sm text-ink-400">Removes the event from the website and the admin, with all its registrations, results, photos and activity.</p>
      <Button variant="destructive" className="mt-4" onClick={() => { setOpen(true); setTyped(''); setError(null); }}><Trash2 /> Delete event</Button>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent className="border-white/10 bg-ink-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl uppercase text-white">Delete “{ev.title}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-300">
              This permanently deletes the event{needsName ? ` and its ${ev.registrationCount} registration${ev.registrationCount === 1 ? '' : 's'}` : ''}, results, photos and activity log. It can’t be undone.
              {' '}Uploaded files stay in your Cloudinary media library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {needsName && (
            <label className="block">
              <span className="text-sm text-white">Type the event name to confirm</span>
              <input className={`${inputCls} mt-2`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={ev.title} autoFocus />
            </label>
          )}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!ok || busy} onClick={run}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default DeleteEvent;
