import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Member } from '@/lib/admin/members';

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Member photo, or their initials. Photos load lazily (only members who have one cost a request). */
const Avatar = ({ m, size = 40, className }: { m: Pick<Member, 'id' | 'name' | 'photo'>; size?: number; className?: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    setUrl(null);
    if (m.photo) import('@/lib/admin/photos').then(({ memberPhotoUrl }) => memberPhotoUrl(m.id, m.photo as never)).then((u) => { if (!off) setUrl(u); });
    return () => { off = true; };
  }, [m.id, m.photo]);
  return (
    <span className={cn('inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.08] font-semibold text-ink-200', className)} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(m.name)}
    </span>
  );
};

export default Avatar;
