import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, ExternalLink, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CATEGORIES, EMPTY_POST, deletePost, savePost, setPostPublished, slugify, uploadImage, watchPosts, type BlogPost, type PostInput } from '@/lib/admin/content';
import { AdminShell, ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { EmptyNote, ErrorNote, ListBox, ListToolbar, Pill, SideDrawer, SkeletonRows } from '../kit';
import { useOpenFromParam } from '../useOpenFromParam';
import ImagePick from './ImagePick';

const postDate = (p: BlogPost) => (p.publishedAt ? new Date(p.publishedAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Blog — articles on the website. Shared by the admin and the marketing desk. */
const BlogPage = () => {
  const actor = useActor();
  const [rows, setRows] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [editing, setEditing] = useState<BlogPost | 'new' | null>(null);
  const [f, setF] = useState<PostInput>(EMPTY_POST);
  const [cover, setCover] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [seo, setSeo] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => watchPosts(setRows, (e) => setError(e.message)), []);

  const published = (rows ?? []).filter((p) => p.published).length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((p) => (filter === 'all' || (filter === 'published') === p.published) && (!s || p.title.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)));
  }, [rows, filter, q]);
  const openForm = (p: BlogPost | 'new') => {
    setEditing(p); setCover(null); setFormErr(null); setSeo(false); setProgress(0);
    setF(p === 'new' ? EMPTY_POST : { title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content, category: p.category, author: p.author, tags: (p.tags ?? []).join(', '), published: p.published, seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '' });
  };
  useOpenFromParam(() => openForm('new'));
  const save = async (e: FormEvent, publish?: boolean) => {
    e.preventDefault();
    if (!f.title.trim() || !f.content.trim()) { setFormErr('A post needs a title and some content.'); return; }
    setBusy(true); setFormErr(null);
    try {
      const url = cover ? await uploadImage(cover, setProgress) : null;
      await savePost({ ...f, published: publish ?? f.published }, url, actor, editing && editing !== 'new' ? editing.id : undefined);
      setEditing(null);
    } catch { setFormErr('The post couldn’t be saved. Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell title="Blog" nav="posts" area="Growth" subtitle={rows ? `${published} published · ${rows.length - published} draft${rows.length - published === 1 ? '' : 's'}` : '…'}
      actions={<Button onClick={() => openForm('new')}><Plus /> New post</Button>}>
      {error && <div className="mb-5"><ErrorNote what="Couldn’t load posts." error={error} /></div>}
      <ListToolbar search={q} onSearch={setQ} placeholder="Search posts" label="Filter posts" value={filter} onChange={(k) => setFilter(k as typeof filter)}
        segments={[{ id: 'all', label: 'All', count: rows?.length }, { id: 'published', label: 'Published', count: rows ? published : undefined }, { id: 'draft', label: 'Drafts', count: rows ? rows.length - published : undefined }]} />
      {!rows ? <SkeletonRows rows={4} /> : shown.length === 0 ? (
        rows.length === 0 ? <EmptyNote title="No posts" body="Write the first article for the website."><Button onClick={() => openForm('new')}><Plus /> New post</Button></EmptyNote>
          : <EmptyNote title="Nothing here" body="No posts match this filter." />
      ) : (
        <ListBox label="Posts">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-2 pr-3">
              <button type="button" onClick={() => openForm(p)} aria-label={`Edit ${p.title}`} className="grid min-w-0 flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_auto]">
                <span className="flex h-12 w-16 items-center justify-center overflow-hidden rounded-lg bg-ink-800">{p.coverImage ? <img src={p.coverImage} alt="" loading="lazy" className="h-full w-full object-cover" /> : <FileText className="h-5 w-5 text-ink-500" aria-hidden />}</span>
                <span className="min-w-0"><span className="block truncate font-semibold text-white">{p.title}</span><span className="block truncate text-xs text-ink-400">{p.category} · {p.author} · {postDate(p)}</span></span>
                <span className="hidden truncate text-sm text-ink-400 md:block">{p.readTime} min read</span>
                <Pill tone={p.published ? 'ok' : 'muted'}>{p.published ? 'Published' : 'Draft'}</Pill>
              </button>
              {p.published && <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="hidden rounded-lg p-2 text-ink-400 hover:bg-white/[0.06] hover:text-white sm:block" aria-label={`Preview ${p.title}`}><ExternalLink className="h-4 w-4" aria-hidden /></a>}
            </li>
          ))}
        </ListBox>
      )}

      <SideDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'New post' : 'Edit post'} description={editing && editing !== 'new' ? (editing.published ? 'Live on the website' : 'Draft — only staff can see it') : 'Save as a draft or publish straight away'}>
        <form onSubmit={(e) => save(e)} className="space-y-5" noValidate aria-label="Post">
          {formErr && <p role="alert" className="text-sm text-red-300">{formErr}</p>}
          <ImagePick label="Cover image" current={editing && editing !== 'new' ? editing.coverImage : ''} onPick={setCover} />
          {busy && cover && progress > 0 && progress < 100 && <p className="text-xs text-ink-400" role="status">Uploading cover… {progress}%</p>}
          <Field label="Title" htmlFor="bp-title"><input id="bp-title" className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: editing === 'new' ? slugify(e.target.value) : f.slug })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="bp-cat"><select id="bp-cat" className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Author" htmlFor="bp-author"><input id="bp-author" className={inputCls} value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></Field>
          </div>
          <Field label="Summary" hint="Shown on the blog list" htmlFor="bp-excerpt"><textarea id="bp-excerpt" rows={2} className={cn(inputCls, 'h-auto py-3')} value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></Field>
          <Field label="Content" hint="Markdown supported" htmlFor="bp-content"><textarea id="bp-content" rows={12} className={cn(inputCls, 'h-auto py-3 font-mono text-sm')} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
          <button type="button" onClick={() => setSeo(!seo)} aria-expanded={seo} className="flex items-center gap-2 text-sm font-semibold text-ink-300 hover:text-white"><ChevronDown size={16} className={cn('transition-transform', !seo && '-rotate-90')} aria-hidden /> Link, tags and search appearance</button>
          {seo && (
            <div className="space-y-4">
              <Field label="Link" hint={`/blog/${f.slug || '…'}`} htmlFor="bp-slug"><input id="bp-slug" className={inputCls} value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} /></Field>
              <Field label="Tags" hint="Comma separated" htmlFor="bp-tags"><input id="bp-tags" className={inputCls} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
              <Field label="Search title" hint="Optional" htmlFor="bp-seot"><input id="bp-seot" className={inputCls} value={f.seoTitle} onChange={(e) => setF({ ...f, seoTitle: e.target.value })} /></Field>
              <Field label="Search description" hint="Optional" htmlFor="bp-seod"><textarea id="bp-seod" rows={2} className={cn(inputCls, 'h-auto py-3')} value={f.seoDescription} onChange={(e) => setF({ ...f, seoDescription: e.target.value })} /></Field>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
            {editing === 'new' ? <>
              <Button type="button" disabled={busy} onClick={(e) => save(e, true)}>{busy ? 'Saving…' : 'Publish'}</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={(e) => save(e, false)}>Save draft</Button>
            </> : <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>}
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            {editing && editing !== 'new' && <>
              <Button type="button" variant="outline" className="ml-auto" onClick={async () => { await setPostPublished(editing, !editing.published, actor); setEditing(null); }}>{editing.published ? 'Unpublish' : 'Publish'}</Button>
              {editing.published && <Button asChild variant="ghost"><a href={`/blog/${editing.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Preview</a></Button>}
              <ConfirmButton size="default" variant="secondary" confirm={{ title: `Delete “${editing.title}”?`, body: 'The post is removed from the website. This can’t be undone.' }} onConfirm={async () => { await deletePost(editing, actor); setEditing(null); }}><Trash2 /><span className="sr-only">Delete post</span></ConfirmButton>
            </>}
          </div>
        </form>
      </SideDrawer>
    </AdminShell>
  );
};

export default BlogPage;
