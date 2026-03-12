import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { signOut } from 'firebase/auth';
import { db, storage, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  Plus, Trash2, LogOut, Eye, EyeOff, Upload,
  CheckCircle, XCircle, Loader, ImageIcon, Tag as TagIcon,
} from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  coverImagePath: string;
  category: string;
  author: string;
  publishedAt: { seconds: number } | null;
  readTime: number;
  tags: string[];
  published: boolean;
}

const CATEGORIES = ['Fitness Tips', 'Nutrition', 'Workout Guide', 'Success Story', 'News'];

const EMPTY_FORM = {
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

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts]           = useState<BlogPost[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setPreview]  = useState('');
  const [uploadProgress, setProgress] = useState(0);
  const [saving, setSaving]         = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast]           = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('publishedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost)));
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'title' ? { slug: slugify(value) } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content || !form.excerpt) {
      showToast('Title, excerpt and content are required.');
      return;
    }
    setSaving(true);
    try {
      let coverImage = '';
      let coverImagePath = '';

      if (imageFile) {
        const path = `blogs/${Date.now()}_${imageFile.name}`;
        const storageRef = ref(storage, path);
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, imageFile);
          task.on(
            'state_changed',
            (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            async () => {
              coverImage = await getDownloadURL(task.snapshot.ref);
              coverImagePath = path;
              resolve();
            },
          );
        });
      }

      await addDoc(collection(db, 'posts'), {
        title:           form.title,
        slug:            form.slug || slugify(form.title),
        excerpt:         form.excerpt,
        content:         form.content,
        coverImage,
        coverImagePath,
        category:        form.category,
        author:          form.author || 'Crunch Fitness Club',
        tags:            form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        readTime:        calcReadTime(form.content),
        published:       form.published,
        publishedAt:     serverTimestamp(),
      });

      setForm(EMPTY_FORM);
      setImageFile(null);
      setPreview('');
      setProgress(0);
      setShowForm(false);
      showToast('Post published successfully!');
    } catch (err) {
      console.error(err);
      showToast('Error saving post. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      if (post.coverImagePath) {
        await deleteObject(ref(storage, post.coverImagePath)).catch(() => {});
      }
      setDeleteConfirm(null);
      showToast('Post deleted.');
    } catch {
      showToast('Error deleting post.');
    }
  };

  const togglePublished = async (post: BlogPost) => {
    await updateDoc(doc(db, 'posts', post.id), { published: !post.published });
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin/login');
  };

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
              <p className="font-bold text-sm text-white">Blog Admin</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setPreview(''); setImageFile(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl text-sm transition-all duration-200 hover:scale-105"
            >
              <Plus size={16} /> New Post
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl text-sm transition-colors"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-heading font-bold mb-6">
          All Posts <span className="text-gray-500 text-base font-normal">({posts.length})</span>
        </h2>

        {/* Posts table */}
        {posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            No posts yet. Click "New Post" to create your first article.
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4"
              >
                {/* Cover thumb */}
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                  {post.coverImage ? (
                    <img src={post.coverImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={20} className="text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{post.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">{post.excerpt}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-600">{post.readTime} min read</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => togglePublished(post)}
                    title={post.published ? 'Unpublish' : 'Publish'}
                    className={`p-2 rounded-xl transition-colors ${
                      post.published
                        ? 'bg-green-400/15 text-green-400 hover:bg-green-400/25'
                        : 'bg-zinc-800 text-gray-500 hover:bg-zinc-700'
                    }`}
                  >
                    {post.published ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(post.id)}
                    className="p-2 rounded-xl bg-zinc-800 text-gray-500 hover:bg-red-400/15 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New post modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-lg">New Blog Post</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white transition-colors">
                <XCircle size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Cover image */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Cover Image</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="relative h-40 rounded-xl border-2 border-dashed border-zinc-700 hover:border-green-400/60 cursor-pointer overflow-hidden transition-colors"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                      <Upload size={24} />
                      <span className="text-sm">Click to upload image</span>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Title *</label>
                  <input
                    name="title" value={form.title} onChange={handleFormChange}
                    placeholder="Your blog title"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Slug (auto)</label>
                  <input
                    name="slug" value={form.slug} onChange={handleFormChange}
                    placeholder="url-slug"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors"
                  />
                </div>
              </div>

              {/* Category + Author */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Category</label>
                  <select
                    name="category" value={form.category} onChange={handleFormChange}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-green-400 text-sm transition-colors"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Author</label>
                  <input
                    name="author" value={form.author} onChange={handleFormChange}
                    placeholder="Author name"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors"
                  />
                </div>
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Short Excerpt *</label>
                <textarea
                  name="excerpt" value={form.excerpt} onChange={handleFormChange}
                  rows={2} placeholder="A one-line summary shown on blog cards…"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors resize-none"
                  required
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Full Content *</label>
                <textarea
                  name="content" value={form.content} onChange={handleFormChange}
                  rows={12} placeholder="Write your full article here…"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors resize-none"
                  required
                />
                <p className="text-gray-600 text-xs mt-1">
                  ~{calcReadTime(form.content)} min read · {form.content.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5 flex items-center gap-1">
                  <TagIcon size={13} /> Tags (comma separated)
                </label>
                <input
                  name="tags" value={form.tags} onChange={handleFormChange}
                  placeholder="fitness, weight loss, gym tips"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-green-400 text-sm transition-colors"
                />
              </div>

              {/* Publish toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setForm((f) => ({ ...f, published: !f.published }))}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                    form.published ? 'bg-green-400' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    form.published ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </div>
                <span className="text-sm text-gray-300">
                  {form.published ? 'Publish immediately' : 'Save as draft'}
                </span>
              </label>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-semibold rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-green-400 hover:bg-green-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                >
                  {saving ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {saving ? 'Saving…' : 'Save Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
            <h4 className="text-white font-bold text-lg mb-2">Delete this post?</h4>
            <p className="text-gray-400 text-sm mb-6">This action cannot be undone. The post and its image will be permanently deleted.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-xl font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const post = posts.find((p) => p.id === deleteConfirm);
                  if (post) handleDelete(post);
                }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl font-bold text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
