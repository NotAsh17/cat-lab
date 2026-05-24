import { useEffect, useMemo, useState } from 'react';
import { Cloud, CloudOff, Download, LogOut, RefreshCcw, Save, ShieldCheck, Trash2, Upload, UserRound } from 'lucide-react';
import { CloudSync } from '../services/cloudSync';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { Storage } from '../services/storage';

function formatDate(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function mergeById(localRows, cloudRows) {
  const map = new Map();
  (cloudRows || []).forEach((row) => map.set(row.id, row));
  (localRows || []).forEach((row) => {
    if (!map.has(row.id)) map.set(row.id, row);
  });
  return Array.from(map.values());
}

export default function ProfileSync({ theme, setTheme, profile, setProfile, onDataChanged }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState(profile || 'User');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState(() => ({
    history: Storage.getHistory().length,
    bookmarks: Storage.getBookmarks().length,
  }));

  const userEmail = session?.user?.email;
  const protocol = useMemo(() => [
    'Shared papers use only seed + bank version. Profile history never changes daily or weekly paper generation.',
    'Submitted attempts are append-only. Bookmarks and settings use last-write-wins.',
    'Every accepted cloud row belongs to auth.uid() through Supabase RLS.',
    'Local mode remains usable without login. Cloud sync starts only after sign-in.',
  ], []);

  const refreshLocalCounts = () => {
    setCounts({
      history: Storage.getHistory().length,
      bookmarks: Storage.getBookmarks().length,
    });
  };

  useEffect(() => {
    if (!CloudSync.isConfigured) return undefined;
    CloudSync.getSession()
      .then((nextSession) => {
        setSession(nextSession);
        if (nextSession?.user?.email) setEmail(nextSession.user.email);
      })
      .catch((error) => setStatus(error.message));
    const sub = CloudSync.onAuthStateChange((nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.email) setEmail(nextSession.user.email);
    });
    return () => sub?.unsubscribe?.();
  }, []);

  const run = async (label, fn) => {
    setBusy(true);
    setStatus(`${label}...`);
    try {
      await fn();
      Storage.setLastSync();
      refreshLocalCounts();
      onDataChanged?.();
      setStatus(`${label} complete.`);
    } catch (error) {
      setStatus(error.message || String(error));
    } finally {
      setBusy(false);
    }
  };

  const signIn = () => run('Sending magic link', async () => {
    await CloudSync.signInWithEmail(email.trim());
    setStatus('Magic link sent. Open it on this device to finish login.');
  });

  const signOut = () => run('Signing out', async () => {
    await CloudSync.signOut();
    setSession(null);
  });

  const saveProfileSettings = () => run('Saving settings', async () => {
    await CloudSync.ensureProfile(displayName || userEmail || 'CAT User');
    await CloudSync.updateSettings({ theme, activeLocalProfile: profile, extra: { displayName } });
  });

  const pushLocal = () => run('Pushing local state', async () => {
    await CloudSync.ensureProfile(displayName || userEmail || 'CAT User');
    await CloudSync.updateSettings({ theme, activeLocalProfile: profile, extra: { displayName } });
    const bankVersion = Storage.getBankVersion();
    for (const bookmark of Storage.getBookmarks()) {
      await CloudSync.saveBookmark(bookmark, bankVersion);
    }
    for (const attempt of Storage.getHistory()) {
      await CloudSync.saveAttempt(attempt, bankVersion);
    }
  });

  const pullCloud = () => run('Pulling cloud state', async () => {
    await CloudSync.ensureProfile(displayName || userEmail || 'CAT User');
    const [settings, bookmarks, attempts] = await Promise.all([
      CloudSync.loadSettings(),
      CloudSync.loadBookmarks(),
      CloudSync.loadAttempts(),
    ]);
    if (settings?.theme) setTheme(settings.theme);
    if (settings?.active_local_profile) setProfile(settings.active_local_profile);
    Storage.setBookmarks(mergeById(Storage.getBookmarks(), bookmarks));
    Storage.setHistory(mergeById(Storage.getHistory(), attempts));
  });

  const clearLocal = (scope) => {
    if (!window.confirm(`Clear local ${scope} data on this browser?`)) return;
    Storage.clearLocal(scope);
    refreshLocalCounts();
    onDataChanged?.();
    setStatus(`Local ${scope} cleared.`);
  };

  const clearCloud = (scope) => {
    if (!window.confirm(`Clear cloud ${scope} data for ${userEmail}? This cannot be undone.`)) return;
    run(`Clearing cloud ${scope}`, () => CloudSync.clearCloud(scope));
  };

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn px-6 py-8 pb-16 font-sans">
      <div className="mb-8 border-b border-border-subtle pb-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-brand-gold">Account & Sync</span>
        <h2 className="mt-1 font-serif text-3xl font-bold tracking-tight text-text-main">Profile & Cloud Sync</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
          Sync bookmarks, attempts, and settings across devices. The question bank stays static; your profile only stores practice state.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/5 p-5">
          <div className="flex items-start gap-3">
            <CloudOff className="mt-0.5 h-5 w-5 text-brand-red" />
            <div>
              <h3 className="font-mono text-sm font-bold text-text-main">Supabase is not configured yet</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`, then run the SQL in `supabase/schema.sql`.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border-subtle bg-bg-surface p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold text-text-main">Cloud Account</h3>
              <p className="mt-1 text-xs text-text-muted">{userEmail ? `Signed in as ${userEmail}` : 'Magic-link sign in. No password needed.'}</p>
            </div>
            {userEmail ? <Cloud className="h-5 w-5 text-brand-green" /> : <CloudOff className="h-5 w-5 text-text-faint" />}
          </div>

          {!userEmail ? (
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={!isSupabaseConfigured || busy}
                className="w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-main outline-none focus:border-brand-gold"
              />
              <button
                type="button"
                onClick={signIn}
                disabled={!isSupabaseConfigured || busy || !email.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 font-mono text-xs font-bold text-bg-base transition hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <UserRound className="h-3.5 w-3.5" />
                Send Magic Link
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-faint">Display name</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-bg-base px-4 py-3 text-sm text-text-main outline-none focus:border-brand-gold"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button onClick={saveProfileSettings} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 font-mono text-xs font-bold text-bg-base hover:bg-brand-gold-hover disabled:opacity-40">
                  <Save className="h-3.5 w-3.5" />
                  Save Settings
                </button>
                <button onClick={signOut} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2.5 font-mono text-xs font-bold text-text-muted hover:text-text-main disabled:opacity-40">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-border-subtle bg-bg-card p-3 font-mono text-xs text-text-muted">
            {status || `Last sync: ${formatDate(Storage.getLastSync())}`}
          </div>
        </section>

        <section className="rounded-xl border border-border-subtle bg-bg-surface p-6">
          <h3 className="font-serif text-xl font-bold text-text-main">Sync Actions</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Local now has {counts.history} attempts and {counts.bookmarks} bookmarks.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3">
            <button onClick={pushLocal} disabled={!userEmail || busy} className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-card px-4 py-3 text-left transition hover:border-brand-gold/40 disabled:opacity-40">
              <span><b className="block text-sm text-text-main">Push local to cloud</b><span className="text-xs text-text-muted">Upload this browser's bookmarks and attempts.</span></span>
              <Upload className="h-4 w-4 text-brand-gold" />
            </button>
            <button onClick={pullCloud} disabled={!userEmail || busy} className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-card px-4 py-3 text-left transition hover:border-brand-gold/40 disabled:opacity-40">
              <span><b className="block text-sm text-text-main">Pull cloud to local</b><span className="text-xs text-text-muted">Merge cloud bookmarks and attempts into this browser.</span></span>
              <Download className="h-4 w-4 text-brand-gold" />
            </button>
            <button onClick={() => { pushLocal(); }} disabled={!userEmail || busy} className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-card px-4 py-3 text-left transition hover:border-brand-gold/40 disabled:opacity-40">
              <span><b className="block text-sm text-text-main">Manual sync now</b><span className="text-xs text-text-muted">Same as push. Pull separately when changing devices.</span></span>
              <RefreshCcw className="h-4 w-4 text-brand-gold" />
            </button>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 text-brand-green" />
          <div>
            <h3 className="font-serif text-xl font-bold text-text-main">Rigid Sync Protocol</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {protocol.map((item) => (
                <div key={item} className="rounded-lg border border-border-subtle bg-bg-card p-3 text-xs leading-relaxed text-text-muted">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-brand-red/20 bg-bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-brand-red" />
          <h3 className="font-serif text-xl font-bold text-text-main">Reset Controls</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {['history', 'bookmarks', 'daily', 'settings', 'all'].map((scope) => (
            <button key={`local-${scope}`} onClick={() => clearLocal(scope)} className="rounded-lg border border-border-subtle px-3 py-2 font-mono text-[10px] font-bold uppercase text-text-muted hover:border-brand-red/50 hover:text-brand-red">
              Clear local {scope}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['history', 'bookmarks', 'daily', 'settings', 'all'].map((scope) => (
            <button key={`cloud-${scope}`} onClick={() => clearCloud(scope)} disabled={!userEmail || busy} className="rounded-lg border border-brand-red/20 px-3 py-2 font-mono text-[10px] font-bold uppercase text-brand-red/80 hover:border-brand-red disabled:cursor-not-allowed disabled:opacity-40">
              Clear cloud {scope}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
