import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** The photo buttons next to a member's avatar (Take photo / Upload) */
export const photoButtonCls = "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-within:border-brand-400 [&_svg]:h-4 [&_svg]:w-4";

/** Side of the square photo taken from the camera (shrunk again before it's stored) */
const SHOT_SIDE = 640;

type State = { kind: 'starting' } | { kind: 'live' } | { kind: 'shot'; url: string; file: File } | { kind: 'error'; message: string };

const cameraError = (e: unknown) => {
  const name = (e as { name?: string }).name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was refused. Allow the camera from the icon in the address bar, or upload a photo instead.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device. Upload a photo instead.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera is being used by another app. Close it and try again.';
  return 'The camera couldn’t start. Try again, or upload a photo instead.';
};

/**
 * A live photo of the member at the desk: camera preview with a face guide, capture, then retake
 * or use. The camera is switched off whenever the window closes or a photo has been taken.
 */
const CameraCapture = ({ open, onOpenChange, onCapture }: { open: boolean; onOpenChange: (open: boolean) => void; onCapture: (file: File) => void }) => {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>({ kind: 'starting' });
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [front, setFront] = useState(true);

  const stop = useCallback(() => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; }, []);

  const start = useCallback(async (deviceId: string | null) => {
    stop();
    setState({ kind: 'starting' });
    if (!navigator.mediaDevices?.getUserMedia) { setState({ kind: 'error', message: 'This browser can’t use the camera here (it needs a secure https page). Upload a photo instead.' }); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 960 } } : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      stream.current = s;
      const track = s.getVideoTracks()[0];
      setFront(track?.getSettings().facingMode !== 'environment');
      setCameraId(track?.getSettings().deviceId ?? deviceId);
      // Labels and the full list are only available once permission is granted
      navigator.mediaDevices.enumerateDevices().then((d) => setCameras(d.filter((x) => x.kind === 'videoinput'))).catch(() => {});
      if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
      setState({ kind: 'live' });
    } catch (e) { setState({ kind: 'error', message: cameraError(e) }); }
  }, [stop]);

  useEffect(() => {
    if (open) start(cameraId);
    else stop();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (re)start only when the window opens
  }, [open]);
  useEffect(() => () => { if (state.kind === 'shot') URL.revokeObjectURL(state.url); }, [state]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    // The centre square of the frame — what the face guide shows
    const side = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(SHOT_SIDE, side);
    canvas.getContext('2d')!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => {
      if (!b) { setState({ kind: 'error', message: 'The photo couldn’t be taken. Please try again.' }); return; }
      stop();
      setState({ kind: 'shot', url: URL.createObjectURL(b), file: new File([b], 'member-photo.jpg', { type: 'image/jpeg' }) });
    }, 'image/jpeg', 0.9);
  };
  const switchCamera = () => {
    const i = cameras.findIndex((c) => c.deviceId === cameraId);
    start(cameras[(i + 1) % cameras.length]?.deviceId ?? null);
  };
  const use = () => { if (state.kind !== 'shot') return; onCapture(state.file); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 text-white sm:p-6" aria-describedby="cam-desc">
        <div className="pr-8">
          <DialogTitle className="text-lg font-semibold">Take photo</DialogTitle>
          <DialogDescription id="cam-desc" className="mt-1 text-sm text-ink-400">Face the camera, centred in the circle, in good light.</DialogDescription>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-ink-950">
          <video ref={video} playsInline muted aria-label="Camera preview"
            className={cn('h-full w-full object-cover', front && '-scale-x-100', state.kind !== 'live' && 'invisible')} />
          {state.kind === 'shot' && <img src={state.url} alt="Photo just taken" className="absolute inset-0 h-full w-full object-cover" />}
          {state.kind === 'live' && (
            // Face guide: a circle with the rest of the frame dimmed
            <div aria-hidden className="pointer-events-none absolute inset-[12%] rounded-full shadow-[0_0_0_999px_rgb(10_10_12/0.45)] ring-2 ring-white/70" />
          )}
          {state.kind === 'starting' && <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">Starting the camera…</p>}
          {state.kind === 'error' && (
            <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Camera className="h-8 w-8 text-ink-500" aria-hidden />
              <p className="text-sm text-ink-200">{state.message}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {state.kind === 'live' && (
            <>
              <Button type="button" size="lg" onClick={capture}><Camera /> Capture</Button>
              {cameras.length > 1 && <Button type="button" variant="outline" onClick={switchCamera}><SwitchCamera /> Switch camera</Button>}
            </>
          )}
          {state.kind === 'shot' && (
            <>
              <Button type="button" variant="outline" onClick={() => start(cameraId)}><RefreshCw /> Retake</Button>
              <Button type="button" onClick={use}>Use photo</Button>
            </>
          )}
          {state.kind === 'error' && (
            <>
              <Button type="button" variant="outline" onClick={() => start(null)}><RefreshCw /> Try again</Button>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraCapture;
