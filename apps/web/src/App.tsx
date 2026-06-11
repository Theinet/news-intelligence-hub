import {
  Activity,
  BookOpen,
  ExternalLink,
  Eye,
  GitBranch,
  LogOut,
  Plus,
  RefreshCw,
  Rss,
  Settings,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import ReactFlow, {applyNodeChanges, Background, Controls, Edge, Node, NodeChange, Panel} from 'reactflow';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const showQueueLink = import.meta.env.VITE_SHOW_QUEUE_LINK === 'true';
const REGENERATION_STORAGE_KEY = 'nih_regeneration_id';

type View = 'articles' | 'feeds' | 'graph' | 'settings' | 'digests' | 'telemetry';
type JsonRecord = Record<string, unknown>;

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

interface SimilarArticle {
  id: string;
  title: string;
  publishedAt: string;
  feed?: {title?: string};
  feedTitle?: string | null;
  similarityScore?: number | null;
}

interface Article extends JsonRecord {
  id: string;
  title: string;
  summary?: string;
  fullSummary?: string;
  importance: string;
  status: string;
  publishedAt: string;
  categories: string[];
  axes: Record<string, string>;
  similarCount: number;
  similar?: SimilarArticle[];
  feed?: {title?: string};
  mentions?: Array<{entity: Entity}>;
}

interface Entity extends JsonRecord {
  id: string;
  canonicalName: string;
  type: string;
  aliases: string[];
  description?: string;
}

interface EntityDetail extends Entity {
  mentions?: Array<{article: {id: string; title: string; publishedAt: string; summary?: string}}>;
  related?: Array<{entity?: Entity; weight: number}>;
  activity?: Array<{publishedAt: string; _count: {_all: number}}>;
}

interface Feed extends JsonRecord {
  id: string;
  title?: string;
  url: string;
  status: string;
  lastError?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Axis {
  id: string;
  name: string;
  values: string[];
}

interface RegenerationRun {
  id: string;
  status: string;
  total: number;
  processed: number;
}

interface DigestCount {
  name: string;
  count: number;
}

interface DigestArticle {
  id: string;
  title: string;
  summary?: string | null;
}

interface Digest extends JsonRecord {
  id: string;
  status: string;
  period: string;
  categoryNames: string[];
  entityIds: string[];
  topEntities: DigestCount[];
  topCategories: DigestCount[];
  keyArticles: DigestArticle[];
  summary?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TelemetrySums {
  calls?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}

interface TelemetryCounts {
  _all?: number | null;
}

interface TelemetryRow extends JsonRecord {
  operation: string;
  provider: string;
  model: string;
  _sum: TelemetrySums;
  _count: TelemetryCounts;
}

interface Notice {
  id: string;
  kind: 'info' | 'error';
  text: string;
}

interface AuthMessage {
  kind: 'info' | 'error';
  text: string;
  href?: string;
}

function decodeHtmlEntities(value: string): string {
  if (!value.includes('&')) {
    return value;
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function displayText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return decodeHtmlEntities(value);
}

function makeNotice(kind: Notice['kind'], text: string): Notice {
  return {
    id: `${Date.now()}-${Math.random()}`,
    kind,
    text
  };
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('nih_token') ?? '');
  const [view, setView] = useState<View>('articles');
  const [authMessage, setAuthMessage] = useState<AuthMessage | null>(null);
  const [regeneration, setRegeneration] = useState<RegenerationRun | null>(null);

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? {authorization: `Bearer ${token}`} : {}),
        ...(init.headers ?? {})
      }
    });
    const text = await response.text();
    if (!response.ok) {
      if (response.status === 401 && token) {
        setToken('');
        localStorage.removeItem('nih_token');
      }
      throw new Error(formatApiErrorText(text));
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }, [token]);

  useEffect(() => {
    localStorage.setItem('nih_token', token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setRegeneration(null);
      sessionStorage.removeItem(REGENERATION_STORAGE_KEY);
      return;
    }
    const storedId = sessionStorage.getItem(REGENERATION_STORAGE_KEY);
    if (storedId) {
      request<RegenerationRun | null>(`/regenerations/${storedId}`)
        .then((run) => {
          if (run && ['queued', 'running'].includes(run.status)) {
            setRegeneration(run);
          } else {
            sessionStorage.removeItem(REGENERATION_STORAGE_KEY);
          }
        })
        .catch(() => sessionStorage.removeItem(REGENERATION_STORAGE_KEY));
      return;
    }
    request<RegenerationRun | null>('/regenerations/active')
      .then((run) => {
        if (run) {
          setRegeneration(run);
          sessionStorage.setItem(REGENERATION_STORAGE_KEY, run.id);
        }
      })
      .catch(() => undefined);
  }, [token, request]);

  useEffect(() => {
    if (!regeneration || !['queued', 'running'].includes(regeneration.status)) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      request<RegenerationRun>(`/regenerations/${regeneration.id}`)
        .then((run) => {
          setRegeneration(run);
          if (['done', 'failed'].includes(run.status)) {
            sessionStorage.removeItem(REGENERATION_STORAGE_KEY);
          }
        })
        .catch(() => {
          sessionStorage.removeItem(REGENERATION_STORAGE_KEY);
          setRegeneration((current) => current ? {...current, status: 'failed'} : current);
        });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [regeneration, request]);

  function handleRegenerationStart(run: RegenerationRun) {
    setRegeneration(run);
    sessionStorage.setItem(REGENERATION_STORAGE_KEY, run.id);
  }

  if (location.pathname === '/verify') {
    return <Verify request={request} />;
  }

  if (!token) {
    return <AuthScreen setToken={setToken} setMessage={setAuthMessage} message={authMessage} />;
  }

  const nav = [
    ['articles', BookOpen, 'Articles'],
    ['feeds', Rss, 'Feeds'],
    ['graph', GitBranch, 'Graph'],
    ['settings', Settings, 'Settings'],
    ['digests', ShieldCheck, 'Digests'],
    ['telemetry', Activity, 'Telemetry']
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-normal">News Intelligence Hub</h1>
            <p className="text-sm text-slate-600">RSS analysis through deterministic queues and semantic graphing.</p>
          </div>
          <nav className="flex flex-wrap gap-2 md:ml-auto">
            {nav.map(([id, Icon, label]) => (
              <button
                key={id}
                className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm ${
                  view === id ? 'border-accent bg-teal-50 text-accent' : 'border-line bg-white'
                }`}
                onClick={() => setView(id)}
                title={label}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
            {showQueueLink && (
              <a
                className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm hover:border-accent hover:text-accent"
                href={`${apiUrl}/admin/queues`}
                target="_blank"
                rel="noopener noreferrer"
                title="Queue Monitor"
              >
                <ExternalLink size={16} />
                <span>Queue Monitor</span>
              </a>
            )}
            <button
              className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm"
              onClick={() => setToken('')}
              title="Log out"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </header>
      {regeneration && ['queued', 'running'].includes(regeneration.status) && (
        <div className="border-b border-line bg-teal-50">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-accent">Regeneration in progress</p>
              <p className="text-xs text-slate-600">
                {regenerationStatusText(regeneration)} — {regeneration.processed} of {regeneration.total} articles
              </p>
            </div>
            <div className="h-2 w-full max-w-xs overflow-hidden rounded bg-white sm:mt-0">
              <div
                className="h-full bg-accent"
                style={{width: `${progressPercent(regeneration)}%`}}
              />
            </div>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-5">
        {view === 'articles' && <Articles request={request} />}
        {view === 'feeds' && <Feeds request={request} />}
        {view === 'graph' && <Graph request={request} />}
        {view === 'settings' && (
          <SettingsView
            request={request}
            regeneration={regeneration}
            onRegenerationStart={handleRegenerationStart}
            onRegenerationUpdate={setRegeneration}
          />
        )}
        {view === 'digests' && <Digests request={request} />}
        {view === 'telemetry' && <Telemetry request={request} />}
      </main>
    </div>
  );
}

function Toast({notice}: {notice: Notice | null}) {
  if (!notice) {
    return null;
  }

  const isError = notice.kind === 'error';
  return (
    <div
      key={notice.id}
      className={`toast-enter fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-lg border bg-white p-4 shadow-lg ${
        isError ? 'border-red-200 text-red-700' : 'border-teal-200 text-accent'
      }`}
      role={isError ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isError ? 'bg-red-500' : 'bg-accent'}`} />
        <p className="text-sm font-medium">{notice.text}</p>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className="toast-progress h-full rounded-full bg-current" />
      </div>
    </div>
  );
}

function LoadingBlock({text}: {text: string}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-500 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <span>{text}</span>
      </div>
    </div>
  );
}

function ErrorBlock({message, onRetry}: {message: string; onRetry: () => void}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
      <p className="font-medium">{friendlyLoadError(message)}</p>
      <p className="mt-1 text-red-600">
        The API may still be starting. Try again in a few seconds or check the service logs.
      </p>
      <button className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function friendlyLoadError(message: string) {
  return message.toLowerCase().includes('internal server error')
    ? 'The server returned an error while loading this view.'
    : message;
}

function EmptyState({title, description}: {title: string; description: string}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white p-5 text-sm shadow-sm">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-slate-500">{description}</p>
    </div>
  );
}

function AuthScreen(props: {
  setToken: (token: string) => void;
  setMessage: (message: AuthMessage | null) => void;
  message: AuthMessage | null;
}) {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('Password123!');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const isLogin = mode === 'login';
  const showResend = isLogin && props.message?.kind === 'error' && props.message.text.includes('not verified');

  async function submit() {
    props.setMessage(null);
    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/auth/${mode}`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email: email.trim(), password})
      });
      const data = await response.json() as ApiErrorBody & {accessToken?: string; devVerifyUrl?: string};
      if (!response.ok) {
        props.setMessage({kind: 'error', text: formatAuthError(data)});
        return;
      }
      if (mode === 'login') {
        props.setToken(data.accessToken ?? '');
      } else {
        props.setMessage({
          kind: 'info',
          text: data.devVerifyUrl
            ? 'DEV MODE verification link created.'
            : 'Registration created. Check service logs for the DEV MODE verification link.',
          href: data.devVerifyUrl
        });
      }
    } catch (error) {
      props.setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Unable to complete authentication.'
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    setResending(true);
    props.setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/auth/resend`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email: email.trim()})
      });
      const data = await response.json() as ApiErrorBody & {devVerifyUrl?: string};
      if (!response.ok) {
        props.setMessage({kind: 'error', text: formatAuthError(data)});
        return;
      }
      props.setMessage({
        kind: 'info',
        text: 'Verification email resent. Open the DEV MODE link below.',
        href: data.devVerifyUrl
      });
    } catch (error) {
      props.setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Unable to resend verification email.'
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl place-items-center px-4">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">News Intelligence Hub</h1>
        <div className="mt-4 rounded-md border border-teal-100 bg-teal-50 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-accent">
              {isLogin ? 'Sign in to your account' : 'Create a new account'}
            </h2>
            <span className="rounded bg-white px-2 py-1 text-xs font-medium text-accent">
              {isLogin ? 'Login' : 'Registration'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {isLogin
              ? 'Use verified credentials to open your news workspace.'
              : 'Register first, then confirm the DEV MODE email link.'}
          </p>
        </div>
        <div className="mt-5 grid gap-3">
          <input
            className="rounded-md border border-line px-3 py-2"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              props.setMessage(null);
            }}
          />
          <div className="relative">
            <input
              className="w-full rounded-md border border-line px-3 py-2 pr-12"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                props.setMessage(null);
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-line bg-white text-slate-600 hover:text-accent"
              title="Hold to show password"
              aria-label="Hold to show password"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowPassword(true);
              }}
              onMouseUp={() => setShowPassword(false)}
              onMouseLeave={() => setShowPassword(false)}
              onTouchStart={() => setShowPassword(true)}
              onTouchEnd={() => setShowPassword(false)}
              onTouchCancel={() => setShowPassword(false)}
              onBlur={() => setShowPassword(false)}
            >
              <Eye size={16} />
            </button>
          </div>
          <button
            className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-60"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? 'Please wait...' : isLogin ? 'Login' : 'Register'}
          </button>
          <button className="text-left text-sm text-accent" onClick={() => setMode(isLogin ? 'register' : 'login')}>
            {isLogin ? 'Create account' : 'Use existing account'}
          </button>
          {showResend && (
            <button
              className="text-left text-sm text-accent disabled:opacity-60"
              onClick={() => void resendVerification()}
              disabled={resending}
            >
              {resending ? 'Sending...' : 'Resend verification email'}
            </button>
          )}
          {props.message && (
            <div
              className={`rounded-md border p-3 text-sm ${
                props.message.kind === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-teal-200 bg-teal-50 text-accent'
              }`}
            >
              <p>{props.message.text}</p>
              {props.message.href && (
                <>
                  <a
                    className="mt-2 inline-block font-medium underline"
                    href={props.message.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open verification link
                  </a>
                  <span className="mt-1 block break-all text-xs text-slate-600">{props.message.href}</span>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function formatAuthError(data: ApiErrorBody): string {
  const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
  if (message === 'Bad credentials') {
    return 'Wrong email or password.';
  }
  if (message === 'Email is not verified') {
    return 'Email is not verified. Use the DEV MODE verification link from registration.';
  }
  if (message === 'Account already exists') {
    return 'Account already exists. Use existing account.';
  }
  return message ?? data.error ?? 'Unable to complete authentication.';
}

function formatApiErrorText(text: string): string {
  try {
    const data = JSON.parse(text) as ApiErrorBody;
    return formatAuthError(data);
  } catch {
    return text || 'Request failed.';
  }
}

function Verify({request}: {request: <T>(path: string, init?: RequestInit) => Promise<T>}) {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying email...');
  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token');
    request(`/auth/verify?token=${token}`)
      .then(() => {
        setState('success');
        setMessage('Email verified successfully');
      })
      .catch((error) => {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Verification failed.');
      });
  }, [request]);
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
      <section className="w-full rounded-lg border border-line bg-white p-6 text-center shadow-sm">
        <p className={`text-lg ${state === 'error' ? 'text-red-700' : 'text-slate-900'}`}>{message}</p>
        {state === 'success' && (
          <a
            className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-white"
            href="/"
          >
            Go to Login
          </a>
        )}
      </section>
    </main>
  );
}

function Articles({request}: {request: <T>(path: string) => Promise<T>}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selected, setSelected] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState({category: '', feedId: '', importance: '', status: '', timeWindow: ''});
  const load = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      const trimmedValue = value.trim();
      if (trimmedValue && key !== 'timeWindow') {
        params.append(key, trimmedValue);
      }
    });
    const range = timeWindowRange(filters.timeWindow);
    if (range) {
      params.append('from', range.from);
      params.append('to', range.to);
    }
    setLoading(true);
    setLoadError('');
    request<Article[]>(`/articles?${params}`)
      .then((loadedArticles) => {
        setArticles(loadedArticles);
      })
      .catch((error) => {
        setLoadError(errorMessage(error, 'Unable to load articles.'));
      })
      .finally(() => setLoading(false));
  }, [filters, request]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    request<Feed[]>('/feeds').then(setFeeds).catch(() => setFeeds([]));
  }, [request]);

  const hasArticleFilters = Object.values(filters).some((value) => value.trim());

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div>
        <Toolbar>
          <input
            className="h-10 rounded-md border border-line px-3"
            placeholder="Category"
            value={filters.category}
            onChange={(event) => setFilters({...filters, category: event.target.value})}
          />
          <select
            className="h-10 rounded-md border border-line px-3"
            value={filters.feedId}
            onChange={(event) => setFilters({...filters, feedId: event.target.value})}
          >
            <option value="">All feeds</option>
            {feeds.map((feed) => <option key={feed.id} value={feed.id}>{displayText(feed.title) || feed.url}</option>)}
          </select>
          <select
            className="h-10 rounded-md border border-line px-3"
            value={filters.importance}
            onChange={(event) => setFilters({...filters, importance: event.target.value})}
          >
            <option value="">All importance</option>
            <option value="high">Important</option>
            <option value="normal">Normal</option>
            <option value="junk">Junk</option>
          </select>
          <select
            className="h-10 rounded-md border border-line px-3"
            value={filters.status}
            onChange={(event) => setFilters({...filters, status: event.target.value})}
          >
            <option value="">All states</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="filtered">Filtered</option>
          </select>
          <select
            className="h-10 rounded-md border border-line px-3"
            value={filters.timeWindow}
            onChange={(event) => setFilters({...filters, timeWindow: event.target.value})}
          >
            <option value="">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </Toolbar>
        <div className="mt-4 grid gap-3">
          {loading && <LoadingBlock text="Loading articles..." />}
          {!loading && loadError && <ErrorBlock message={loadError} onRetry={load} />}
          {!loading && !loadError && articles.length === 0 && (
            <EmptyState
              title={hasArticleFilters ? 'No articles match these filters.' : 'No articles yet.'}
              description={
                hasArticleFilters
                  ? 'Clear one or more filters, or switch the time window back to All time.'
                  : 'Add a feed, run Pull, or use the seeded demo data after startup.'
              }
            />
          )}
          {!loading && !loadError && articles.map((article) => (
            <button key={article.id} className="rounded-lg border border-line bg-white p-4 text-left shadow-sm" onClick={() => setSelected(article)}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{displayText(article.feed?.title) || 'Source'}</span>
                <span>{new Date(article.publishedAt).toLocaleString()}</span>
                <span className="rounded bg-slate-100 px-2 py-1">{article.importance}</span>
                <span>{article.similarCount} similar</span>
              </div>
              <h2 className="mt-2 text-base font-semibold">{displayText(article.title)}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{displayText(article.summary)}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {(article.mentions ?? []).map(({entity}) => <span key={entity.id} className="rounded bg-teal-50 px-2 py-1 text-accent">{entity.canonicalName}</span>)}
              </div>
            </button>
          ))}
        </div>
      </div>
      <aside className="rounded-lg border border-line bg-white p-4 shadow-sm">
        {selected ? (
          <ArticleDetail article={selected} request={request} />
        ) : (
          <EmptyState title="Select an article." description="Click a card to view its summary, entities, categories, and axes." />
        )}
      </aside>
    </section>
  );
}

function timeWindowRange(value: string): {from: string; to: string} | null {
  const now = new Date();
  const from = new Date(now);
  if (value === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (value === '7d') {
    from.setDate(from.getDate() - 7);
  } else if (value === '30d') {
    from.setDate(from.getDate() - 30);
  } else {
    return null;
  }
  return {from: from.toISOString(), to: now.toISOString()};
}

function titleCase(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function ActivityChart({activity}: {activity: Array<{publishedAt: string; _count: {_all: number}}>}) {
  const buckets = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const row of activity) {
      const day = new Date(row.publishedAt).toLocaleDateString();
      byDay.set(day, (byDay.get(day) ?? 0) + (row._count._all ?? 0));
    }
    return Array.from(byDay.entries())
      .sort(([left], [right]) => new Date(left).getTime() - new Date(right).getTime())
      .slice(-14);
  }, [activity]);
  if (buckets.length === 0) {
    return <p className="text-xs text-slate-500">No mention activity yet.</p>;
  }
  const max = Math.max(...buckets.map(([, count]) => count), 1);
  return (
    <div className="mt-2 grid gap-1">
      <div className="flex items-end gap-1" style={{height: '72px'}}>
        {buckets.map(([day, count]) => (
          <div key={day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${day}: ${count}`}>
            <div className="w-full rounded-t bg-accent/80" style={{height: `${Math.max(8, (count / max) * 100)}%`}} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{buckets[0]?.[0]}</span>
        <span>{buckets[buckets.length - 1]?.[0]}</span>
      </div>
    </div>
  );
}

function SimilarArticlesBlock({similar}: {similar?: SimilarArticle[]}) {
  const items = similar ?? [];
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Similar / Duplicate Articles</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No similar articles found</p>
      ) : (
        <div className="mt-2 grid gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded bg-white p-2 text-xs">
              <p className="font-medium">{displayText(item.title)}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-slate-500">
                <span>{displayText(item.feed?.title ?? item.feedTitle) || 'Unknown feed'}</span>
                <span>{new Date(item.publishedAt).toLocaleString()}</span>
                {item.similarityScore != null && (
                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">
                    score {item.similarityScore.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleDetail({article, request}: {article: Article; request: <T>(path: string) => Promise<T>}) {
  const [full, setFull] = useState<Article>(article);
  const [entityDetail, setEntityDetail] = useState<EntityDetail | null>(null);
  const originalUrl = String(full.url ?? '');
  const canOpenOriginal = /^https?:\/\//u.test(originalUrl) && !originalUrl.includes('demo.local');
  useEffect(() => {
    setEntityDetail(null);
    request<Article>(`/articles/${article.id}`).then(setFull);
  }, [article.id, request]);
  return (
    <div className="grid gap-3">
      <h2 className="text-lg font-semibold">{displayText(full.title)}</h2>
      <p className="text-sm text-slate-700">{displayText(full.fullSummary ?? full.summary)}</p>
      {canOpenOriginal ? (
        <a className="text-sm text-accent" href={originalUrl} target="_blank">Open original</a>
      ) : (
        <span className="text-sm text-slate-500">Original link is unavailable for demo data.</span>
      )}
      <div className="flex flex-wrap gap-2">
        {(full.mentions ?? []).map(({entity}) => (
          <button
            key={entity.id}
            className="rounded bg-slate-100 px-2 py-1 text-left text-xs hover:bg-teal-50 hover:text-accent"
            onClick={() => request<EntityDetail>(`/entities/${entity.id}`).then(setEntityDetail)}
          >
            {entity.canonicalName} / {entity.type}
          </button>
        ))}
      </div>
      <div className="rounded-md bg-panel p-3">
        <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Categories</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {full.categories.length > 0 ? full.categories.map((category) => (
            <span key={category} className="rounded bg-white px-2 py-1 text-xs">{category}</span>
          )) : <span className="text-xs text-slate-500">None</span>}
        </div>
        <h3 className="mt-3 text-xs font-semibold uppercase tracking-normal text-slate-500">Axes</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(full.axes).length > 0 ? Object.entries(full.axes).map(([axis, value]) => (
            <span key={axis} className="rounded bg-white px-2 py-1 text-xs">
              {axis}: {value}
            </span>
          )) : <span className="text-xs text-slate-500">None</span>}
        </div>
      </div>
      <SimilarArticlesBlock similar={full.similar} />
      {entityDetail && (
        <div className="rounded-md border border-line bg-panel p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{entityDetail.canonicalName}</h3>
              <p className="text-xs text-slate-500">{titleCase(entityDetail.type)}</p>
            </div>
            <span className="rounded bg-white px-2 py-1 text-xs">
              {entityDetail.mentions?.length ?? 0} {pluralize(entityDetail.mentions?.length ?? 0, 'mention', 'mentions')}
            </span>
          </div>
          {entityDetail.description && (
            <p className="mt-2 text-sm text-slate-700">{entityDetail.description}</p>
          )}
          {(entityDetail.aliases?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Aliases: {entityDetail.aliases.join(', ')}
            </p>
          )}
          {(entityDetail.activity?.length ?? 0) > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Mentions over time</h4>
              <ActivityChart activity={entityDetail.activity ?? []} />
            </div>
          )}
          {(entityDetail.related?.length ?? 0) > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Related</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {entityDetail.related?.map((item) => item.entity && (
                  <span key={item.entity.id} className="rounded bg-white px-2 py-1 text-xs">
                    {item.entity.canonicalName} ({item.weight})
                  </span>
                ))}
              </div>
            </div>
          )}
          {(entityDetail.mentions?.length ?? 0) > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Mentioned in</h4>
              <div className="mt-2 grid gap-2">
                {entityDetail.mentions?.slice(0, 4).map(({article: mentionedArticle}) => (
                  <div key={mentionedArticle.id} className="rounded bg-white p-2 text-xs">
                    <p className="font-medium">{displayText(mentionedArticle.title)}</p>
                    <p className="text-slate-500">{new Date(mentionedArticle.publishedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Feeds({request}: {request: <T>(path: string, init?: RequestInit) => Promise<T>}) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setFeeds(await request<Feed[]>('/feeds'));
    } catch (error) {
      setLoadError(errorMessage(error, 'Unable to load feeds.'));
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  async function add() {
    setMessage(null);
    setAdding(true);
    try {
      await request('/feeds', {method: 'POST', body: JSON.stringify({url})});
      setUrl('');
      await load();
      setMessage(makeNotice('info', 'Feed added and queued for pulling.'));
    } catch (error) {
      setMessage(makeNotice('error', error instanceof Error ? error.message : 'Unable to add feed.'));
    } finally {
      setAdding(false);
    }
  }
  async function runFeedAction(feedId: string, action: 'pull' | 'pause' | 'resume' | 'delete') {
    setMessage(null);
    setBusyId(feedId);
    try {
      if (action === 'delete') {
        await request(`/feeds/${feedId}`, {method: 'DELETE'});
        setMessage(makeNotice('info', 'Feed deleted. Existing articles stay in the library.'));
      } else {
        const method = action === 'pull' ? 'POST' : 'PATCH';
        await request(`/feeds/${feedId}/${action}`, {method});
        setMessage(makeNotice('info', action === 'pull' ? 'Feed pull queued.' : `Feed ${action}d.`));
      }
      await load();
    } catch (error) {
      setMessage(makeNotice('error', error instanceof Error ? error.message : `Unable to ${action} feed.`));
    } finally {
      setBusyId('');
    }
  }
  return (
    <section>
      <Toolbar>
        <input className="h-10 min-w-72 rounded-md border border-line px-3" placeholder="RSS or Atom URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="flex h-10 items-center gap-2 rounded-md bg-accent px-3 text-white disabled:opacity-60"
          onClick={() => void add()}
          disabled={adding}
        >
          <Plus size={16} />{adding ? 'Adding...' : 'Add'}
        </button>
      </Toolbar>
      <Toast key={message?.id ?? 'feeds-toast'} notice={message} />
      {loading && <div className="mt-4"><LoadingBlock text="Loading feeds..." /></div>}
      {!loading && loadError && <div className="mt-4"><ErrorBlock message={loadError} onRetry={() => void load()} /></div>}
      {!loading && !loadError && feeds.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="No feeds yet."
            description="Paste an RSS or Atom URL, then add it to queue the first pull."
          />
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {!loading && !loadError && feeds.map((feed) => (
          <div key={feed.id} className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{displayText(feed.title) || feed.url}</h2>
                <p className="break-all text-sm text-slate-500">{feed.url}</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs">{feed.status}</span>
            </div>
            {feed.lastError && <p className="mt-2 text-sm text-red-700">{feed.lastError}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"
                disabled={busyId === feed.id}
                onClick={() => void runFeedAction(feed.id, 'pull')}
              >
                <RefreshCw size={14} />Pull
              </button>
              {feed.status === 'active' ? (
                <button
                  className="rounded-md border border-line px-3 py-2 text-sm"
                  disabled={busyId === feed.id}
                  onClick={() => void runFeedAction(feed.id, 'pause')}
                >
                  Pause
                </button>
              ) : (
                <button
                  className="rounded-md border border-line px-3 py-2 text-sm"
                  disabled={busyId === feed.id}
                  onClick={() => void runFeedAction(feed.id, 'resume')}
                >
                  Resume
                </button>
              )}
              <button
                className="ml-auto flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700"
                disabled={busyId === feed.id}
                onClick={() => void runFeedAction(feed.id, 'delete')}
              >
                <Trash2 size={14} />Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Graph({request}: {request: <T>(path: string) => Promise<T>}) {
  const [graph, setGraph] = useState<{nodes: JsonRecord[]; edges: JsonRecord[]}>({nodes: [], edges: []});
  const [nodes, setNodes] = useState<Node[]>([]);
  const [nodeKind, setNodeKind] = useState('');
  const [edgeMode, setEdgeMode] = useState<'core' | 'all' | 'similar'>('core');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedNode, setSelectedNode] = useState<JsonRecord | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Article | EntityDetail | null>(null);
  const loadGraph = useCallback(() => {
    const params = new URLSearchParams(
      Object.entries({nodeKind, category, q: search, timeWindow}).filter(([, value]) => value)
    );
    setLoading(true);
    setLoadError('');
    request<{nodes: JsonRecord[]; edges: JsonRecord[]}>(`/graph?${params}`)
      .then(setGraph)
      .catch((error) => {
        setLoadError(errorMessage(error, 'Unable to load graph.'));
      })
      .finally(() => setLoading(false));
  }, [category, nodeKind, request, search, timeWindow]);
  useEffect(() => {
    loadGraph();
  }, [loadGraph]);
  useEffect(() => {
    if (selectedNode && !graph.nodes.some((node) => String(node.id) === String(selectedNode.id))) {
      setSelectedNode(null);
      setSelectedDetail(null);
    }
  }, [graph.nodes, selectedNode]);
  useEffect(() => {
    setNodes((currentNodes) => {
      const positionsById = new Map(currentNodes.map((node) => [node.id, node.position]));
      return graph.nodes.map((node, index) => {
        const id = String(node.id);
        return {
          id,
          position: positionsById.get(id) ?? {x: (index % 6) * 210, y: Math.floor(index / 6) * 120},
          data: {label: `${node.kind}: ${displayText(String(node.label))}`},
          style: {borderColor: node.kind === 'article' ? '#0f766e' : '#64748b'}
        };
      });
    });
  }, [graph.nodes]);
  const visibleNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo<Edge[]>(() => graph.edges
    .filter((edge) => {
      const kind = String(edge.kind);
      if (edgeMode === 'core') {
        return kind !== 'similar';
      }
      if (edgeMode === 'similar') {
        return kind === 'similar';
      }
      return true;
    })
    .map((edge, index) => {
      const kind = String(edge.kind);
      const score = Number(edge.score);
      return {
        id: `${edge.from}-${edge.to}-${kind}-${index}`,
        source: String(edge.from),
        target: String(edge.to),
        label: kind === 'similar' && Number.isFinite(score) ? score.toFixed(2) : kind,
        animated: kind === 'similar',
        style: {
          opacity: kind === 'similar' ? 0.65 : 1,
          stroke: kind === 'similar' ? '#7c3aed' : kind === 'co_mention' ? '#94a3b8' : '#64748b',
          strokeDasharray: kind === 'similar' || kind === 'co_mention' ? '5 5' : undefined
        }
      };
    })
    .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
  [edgeMode, graph.edges, visibleNodeIds]);
  const hasGraphFilters = Boolean(nodeKind || category.trim() || search.trim() || timeWindow);
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);
  function selectNode(nodeId: string) {
    const rawNode = graph.nodes.find((node) => String(node.id) === nodeId) ?? null;
    setSelectedNode(rawNode);
    setSelectedDetail(null);
    if (!rawNode) {
      return;
    }
    if (rawNode.kind === 'article') {
      request<Article>(`/articles/${nodeId}`).then(setSelectedDetail);
    } else if (rawNode.kind === 'entity') {
      request<EntityDetail>(`/entities/${nodeId}`).then(setSelectedDetail);
    }
  }
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div>
        <Toolbar>
          <select className="h-10 rounded-md border border-line px-3" value={nodeKind} onChange={(e) => setNodeKind(e.target.value)}>
            <option value="">All nodes</option>
            <option value="article">Articles</option>
            <option value="entity">Entities</option>
          </select>
          <input className="h-10 rounded-md border border-line px-3" placeholder="Search graph" value={search} onChange={(e) => setSearch(e.target.value)} />
          <input className="h-10 rounded-md border border-line px-3" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <select className="h-10 rounded-md border border-line px-3" value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}>
            <option value="">All time</option>
            <option value="1d">Last day</option>
            <option value="7d">Last week</option>
            <option value="30d">Last month</option>
          </select>
          <select className="h-10 rounded-md border border-line px-3" value={edgeMode} onChange={(e) => setEdgeMode(e.target.value as 'core' | 'all' | 'similar')}>
            <option value="core">Core links</option>
            <option value="all">All links</option>
            <option value="similar">Similar only</option>
          </select>
        </Toolbar>
        <div className="mt-4 h-[680px] overflow-hidden rounded-lg border border-line bg-white">
          {loading && <div className="p-4"><LoadingBlock text="Loading graph..." /></div>}
          {!loading && loadError && <div className="p-4"><ErrorBlock message={loadError} onRetry={loadGraph} /></div>}
          {!loading && !loadError && nodes.length === 0 && (
            <div className="p-4">
              <EmptyState
                title={hasGraphFilters ? 'No graph nodes match these filters.' : 'No graph data yet.'}
                description={
                  hasGraphFilters
                    ? 'Clear search, node type, or category filters to bring nodes back.'
                    : 'Process demo data or pull a feed so article and entity nodes can be built.'
                }
              />
            </div>
          )}
          {!loading && !loadError && nodes.length > 0 && (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              nodesConnectable={false}
              onNodesChange={onNodesChange}
              onNodeClick={(_, node) => selectNode(node.id)}
            >
              <GraphLegend edgeMode={edgeMode} />
              <Background />
              <Controls />
            </ReactFlow>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        {selectedNode ? (
          <GraphNodeDetails node={selectedNode} detail={selectedDetail} />
        ) : (
          <EmptyState
            title="Select a graph node."
            description="Click an article or entity to inspect its details and linked records."
          />
        )}
      </div>
    </section>
  );
}

type LegendEdgeKind = 'mentions' | 'co_mention' | 'similar';

function GraphLegend({edgeMode}: {edgeMode: 'core' | 'all' | 'similar'}) {
  const rows: {
    kind: LegendEdgeKind;
    label: string;
    description: string;
    className: string;
  }[] = [
    {
      kind: 'mentions',
      label: 'Mentions',
      description: 'article to entity',
      className: 'border-slate-500'
    },
    {
      kind: 'co_mention',
      label: 'Co-mention',
      description: 'entity pair weight',
      className: 'border-slate-400 border-dashed'
    },
    {
      kind: 'similar',
      label: 'Similar',
      description: 'article similarity score',
      className: 'border-violet-500 border-dashed'
    }
  ];
  const visibleRows = rows.filter((row) => {
    if (edgeMode === 'core') {
      return row.kind !== 'similar';
    }
    if (edgeMode === 'similar') {
      return row.kind === 'similar';
    }
    return true;
  });

  return (
    <Panel position="top-left" className="rounded-md border border-line bg-white/95 p-2 text-xs shadow-sm">
      <div className="mb-1 font-medium text-slate-700">Graph links</div>
      <div className="grid gap-1">
        {visibleRows.map((row) => (
          <div className="grid grid-cols-[72px_1fr] items-center gap-2" key={row.kind}>
            <span className={`inline-block w-14 border-t-2 ${row.className}`} />
            <span>
              <span className="font-medium text-slate-700">{row.label}</span>
              <span className="ml-1 text-slate-500">{row.description}</span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function GraphNodeDetails(props: {node: JsonRecord; detail: Article | EntityDetail | null}) {
  const kind = String(props.node.kind);
  if (!props.detail) {
    return (
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-normal text-slate-500">{kind}</p>
        <h2 className="font-semibold">{displayText(String(props.node.label))}</h2>
        <p className="text-sm text-slate-500">Loading details...</p>
      </div>
    );
  }
  if (kind === 'article') {
    const article = props.detail as Article;
    return (
      <div className="grid gap-3">
        <p className="text-xs uppercase tracking-normal text-slate-500">Article</p>
        <h2 className="font-semibold">{displayText(article.title)}</h2>
        <p className="text-sm text-slate-700">{displayText(article.fullSummary ?? article.summary)}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-1">{article.importance}</span>
          <span className="rounded bg-slate-100 px-2 py-1">{article.status}</span>
          <span className="rounded bg-slate-100 px-2 py-1">{new Date(article.publishedAt).toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {article.categories.map((category) => <span key={category} className="rounded bg-teal-50 px-2 py-1 text-accent">{category}</span>)}
        </div>
        <div className="grid gap-1 text-xs text-slate-600">
          {(article.mentions ?? []).map(({entity}) => (
            <span key={entity.id}>{entity.canonicalName} / {entity.type}</span>
          ))}
        </div>
      </div>
    );
  }
  const entity = props.detail as EntityDetail;
  return (
    <div className="grid gap-3">
      <p className="text-xs uppercase tracking-normal text-slate-500">Entity</p>
      <div>
        <h2 className="font-semibold">{entity.canonicalName}</h2>
        <p className="text-sm text-slate-500">{titleCase(entity.type)}</p>
      </div>
      {entity.description && <p className="text-sm text-slate-700">{entity.description}</p>}
      {(entity.aliases?.length ?? 0) > 0 && <p className="text-xs text-slate-500">Aliases: {entity.aliases.join(', ')}</p>}
      {(entity.activity?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Mentions over time</h3>
          <ActivityChart activity={entity.activity ?? []} />
        </div>
      )}
      {(entity.related?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Related</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {entity.related?.map((item) => item.entity && (
              <span key={item.entity.id} className="rounded bg-slate-100 px-2 py-1">{item.entity.canonicalName} ({item.weight})</span>
            ))}
          </div>
        </div>
      )}
      {(entity.mentions?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Mentioned in</h3>
          <div className="mt-2 grid gap-2">
            {entity.mentions?.slice(0, 5).map(({article}) => (
              <div key={article.id} className="rounded bg-panel p-2 text-xs">
                <p className="font-medium">{displayText(article.title)}</p>
                <p className="text-slate-500">{new Date(article.publishedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsView(props: {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  regeneration: RegenerationRun | null;
  onRegenerationStart: (run: RegenerationRun) => void;
  onRegenerationUpdate: (run: RegenerationRun | null) => void;
}) {
  const {request, regeneration, onRegenerationStart, onRegenerationUpdate} = props;
  const [categories, setCategories] = useState<Category[]>([]);
  const [axes, setAxes] = useState<Axis[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [axisName, setAxisName] = useState('');
  const [axisValues, setAxisValues] = useState('');
  const [message, setMessage] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [loadedCategories, loadedAxes] = await Promise.all([
        request<Category[]>('/categories'),
        request<Axis[]>('/axes')
      ]);
      setCategories(loadedCategories);
      setAxes(loadedAxes);
    } catch (error) {
      setLoadError(errorMessage(error, 'Unable to load settings.'));
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (regeneration?.status !== 'done') {
      return undefined;
    }
    setMessage(makeNotice('info', 'Regeneration completed.'));
    const timer = window.setTimeout(() => onRegenerationUpdate(null), 3000);
    return () => window.clearTimeout(timer);
  }, [regeneration?.status, onRegenerationUpdate]);

  async function addCategory() {
    const name = categoryName.trim();
    if (!name) {
      setMessage(makeNotice('error', 'Category name is required.'));
      return;
    }
    try {
      await request('/categories', {method: 'POST', body: JSON.stringify({name})});
      setCategoryName('');
      await load();
      setMessage(makeNotice('info', 'Category added.'));
    } catch (error) {
      setMessage(makeNotice('error', errorMessage(error, 'Unable to add category.')));
    }
  }

  async function saveCategory(category: Category) {
    const name = category.name.trim();
    if (!name) {
      setMessage(makeNotice('error', 'Category name is required.'));
      return;
    }
    try {
      await request(`/categories/${category.id}`, {method: 'PATCH', body: JSON.stringify({name})});
      await load();
      setMessage(makeNotice('info', 'Category saved.'));
    } catch (error) {
      setMessage(makeNotice('error', errorMessage(error, 'Unable to save category.')));
    }
  }

  async function deleteCategory(id: string) {
    try {
      await request(`/categories/${id}`, {method: 'DELETE'});
      await load();
      setMessage(makeNotice('info', 'Category deleted.'));
    } catch (error) {
      setMessage(makeNotice('error', errorMessage(error, 'Unable to delete category.')));
    }
  }

  async function addAxis() {
    const name = axisName.trim();
    const values = parseCsvValues(axisValues);
    if (!name || values.length === 0) {
      setMessage(makeNotice('error', 'Axis name and at least one value are required.'));
      return;
    }
    try {
      await request('/axes', {method: 'POST', body: JSON.stringify({name, values})});
      setAxisName('');
      setAxisValues('');
      await load();
      setMessage(makeNotice('info', 'Axis added.'));
    } catch (error) {
      setMessage(makeNotice('error', errorMessage(error, 'Unable to add axis.')));
    }
  }

  async function saveAxis(axis: Axis) {
    const name = axis.name.trim();
    const values = axis.values.map((value) => value.trim()).filter(Boolean);
    if (!name || values.length === 0) {
      setMessage(makeNotice('error', 'Axis name and at least one value are required.'));
      return;
    }
    try {
      await request(`/axes/${axis.id}`, {method: 'PATCH', body: JSON.stringify({name, values})});
      await load();
      setMessage(makeNotice('info', 'Axis saved.'));
    } catch (error) {
      setMessage(makeNotice('error', errorMessage(error, 'Unable to save axis.')));
    }
  }

  async function deleteAxis(id: string) {
    try {
      await request(`/axes/${id}`, {method: 'DELETE'});
      await load();
      setMessage(makeNotice('info', 'Axis deleted.'));
    } catch (error) {
      setMessage(makeNotice('error', errorMessage(error, 'Unable to delete axis.')));
    }
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const run = await request<RegenerationRun>('/regenerations', {method: 'POST'});
      onRegenerationStart(run);
      setMessage(makeNotice('info', 'Regeneration queued.'));
    } catch (error) {
      setMessage(makeNotice('error', errorMessage(error, 'Unable to queue regeneration.')));
    } finally {
      setRegenerating(false);
    }
  }
  return (
    <section className="grid gap-5">
      <Toast key={message?.id ?? 'settings-toast'} notice={message} />
      {loading && <LoadingBlock text="Loading settings..." />}
      {!loading && loadError && <ErrorBlock message={loadError} onRetry={() => void load()} />}
      {regeneration && (
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Regeneration</h2>
              <p className="text-sm text-slate-500">
                {regenerationStatusText(regeneration)} - {regeneration.processed} of {regeneration.total} articles
              </p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs">{regeneration.id}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded bg-slate-100">
            <div
              className={`h-full ${regeneration.status === 'failed' ? 'bg-red-500' : 'bg-accent'}`}
              style={{width: `${progressPercent(regeneration)}%`}}
            />
          </div>
        </div>
      )}
      {!loading && !loadError && <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Categories</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="h-10 flex-1 rounded-md border border-line px-3"
            placeholder="New category"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <button className="flex h-10 items-center gap-2 rounded-md bg-accent px-3 text-white" onClick={() => void addCategory()}>
            <Plus size={16} />Add
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {categories.map((category) => (
            <div key={category.id} className="flex flex-wrap items-center gap-2 rounded-md bg-panel p-2">
              <input
                className="h-9 min-w-52 flex-1 rounded border border-line px-2"
                value={category.name}
                onChange={(event) => setCategories(categories.map((item) => (
                  item.id === category.id ? {...item, name: event.target.value} : item
                )))}
              />
              <button className="rounded border border-line px-3 py-2 text-sm" onClick={() => void saveCategory(category)}>
                Save
              </button>
              <button
                className="flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-700"
                onClick={() => void deleteCategory(category.id)}
              >
                <Trash2 size={14} />Delete
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Categorization axes</h2>
          <button
            className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-60"
            onClick={() => void regenerate()}
            disabled={regenerating || Boolean(regeneration && ['queued', 'running'].includes(regeneration.status))}
          >
            <RefreshCw size={16} />{regenerating ? 'Queueing...' : 'Regenerate'}
          </button>
        </div>
        <div className="mt-3 grid gap-2 rounded-md border border-line p-3">
          <input
            className="h-10 rounded-md border border-line px-3"
            placeholder="New axis"
            value={axisName}
            onChange={(event) => setAxisName(event.target.value)}
          />
          <input
            className="h-10 rounded-md border border-line px-3"
            placeholder="Values, comma separated"
            value={axisValues}
            onChange={(event) => setAxisValues(event.target.value)}
          />
          <button className="flex h-10 w-fit items-center gap-2 rounded-md bg-accent px-3 text-white" onClick={() => void addAxis()}>
            <Plus size={16} />Add axis
          </button>
        </div>
        <div className="mt-3 grid gap-3">
          {axes.map((axis) => (
            <div key={axis.id} className="rounded-md bg-panel p-3">
              <input
                className="w-full rounded border border-line px-2 py-1"
                value={axis.name}
                onChange={(event) => setAxes(axes.map((item) => (
                  item.id === axis.id ? {...item, name: event.target.value} : item
                )))}
              />
              <input
                className="mt-2 w-full rounded border border-line px-2 py-1"
                value={axis.values.join(', ')}
                onChange={(event) => setAxes(axes.map((item) => (
                  item.id === axis.id ? {...item, values: parseEditableCsvValues(event.target.value)} : item
                )))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="rounded border border-line px-3 py-1 text-sm" onClick={() => void saveAxis(axis)}>Save</button>
                <button
                  className="flex items-center gap-2 rounded border border-red-200 px-3 py-1 text-sm text-red-700"
                  onClick={() => void deleteAxis(axis.id)}
                >
                  <Trash2 size={14} />Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>}
    </section>
  );
}

function parseCsvValues(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseEditableCsvValues(value: string): string[] {
  return value.split(',').map((item) => item.trim());
}

function progressPercent(run: RegenerationRun): number {
  if (run.total <= 0) {
    return run.status === 'done' ? 100 : 0;
  }
  return Math.min(100, Math.round((run.processed / run.total) * 100));
}

function regenerationStatusText(run: RegenerationRun): string {
  if (run.status === 'done') {
    return 'Completed';
  }
  if (run.status === 'failed') {
    return 'Failed';
  }
  if (run.status === 'running') {
    return 'Running';
  }
  return 'Queued';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function Digests({request}: {request: <T>(path: string, init?: RequestInit) => Promise<T>}) {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [period, setPeriod] = useState('day');
  const [categoryName, setCategoryName] = useState('');
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setLoadError('');
    try {
      setDigests(await request<Digest[]>('/digests'));
    } catch (error) {
      setLoadError(errorMessage(error, 'Unable to load digests.'));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    async function loadOptions() {
      try {
        const [categoryRows, entityRows] = await Promise.all([
          request<Category[]>('/categories'),
          request<Entity[]>('/entities')
        ]);
        setCategories(categoryRows);
        setEntities(entityRows);
      } catch (error) {
        setLoadError(errorMessage(error, 'Unable to load digest filters.'));
      }
    }
    void loadOptions();
  }, [request]);
  useEffect(() => {
    if (!digests.some((digest) => digest.status === 'queued')) {
      return;
    }
    const timer = window.setTimeout(() => void load(false), 2000);
    return () => window.clearTimeout(timer);
  }, [digests, load]);
  async function buildDigest() {
    setBuilding(true);
    try {
      await request('/digests', {
        method: 'POST',
        body: JSON.stringify({
          period,
          categoryNames: categoryName ? [categoryName] : [],
          entityIds: entityId ? [entityId] : []
        })
      });
      await load(false);
    } catch (error) {
      setLoadError(errorMessage(error, 'Unable to build digest.'));
    } finally {
      setBuilding(false);
    }
  }
  return (
    <section>
      <Toolbar>
        <select
          className="h-10 rounded-md border border-line bg-white px-3"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
        <select
          className="h-10 min-w-48 rounded-md border border-line bg-white px-3"
          value={categoryName}
          onChange={(event) => setCategoryName(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.name}>{category.name}</option>
          ))}
        </select>
        <select
          className="h-10 min-w-48 rounded-md border border-line bg-white px-3"
          value={entityId}
          onChange={(event) => setEntityId(event.target.value)}
        >
          <option value="">All entities</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>{entity.canonicalName}</option>
          ))}
        </select>
        <button
          className="rounded-md bg-accent px-3 py-2 text-white disabled:opacity-60"
          disabled={building}
          onClick={() => void buildDigest()}
        >
          {building ? 'Building...' : `Build ${period} digest`}
        </button>
      </Toolbar>
      <div className="mt-4 grid gap-3">
        {loading && <LoadingBlock text="Loading digests..." />}
        {!loading && loadError && <ErrorBlock message={loadError} onRetry={() => void load()} />}
        {!loading && !loadError && digests.length === 0 && (
          <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-500 shadow-sm">
            No digests have been built yet.
          </div>
        )}
        {!loading && !loadError && digests.map((digest) => (
          <DigestCard
            key={digest.id}
            digest={digest}
            entityNames={entitiesById(entities, digest.entityIds ?? [])}
          />
        ))}
      </div>
    </section>
  );
}

function DigestCard({digest, entityNames}: {digest: Digest; entityNames: string[]}) {
  const topEntities = Array.isArray(digest.topEntities) ? digest.topEntities : [];
  const topCategories = Array.isArray(digest.topCategories) ? digest.topCategories : [];
  const keyArticles = Array.isArray(digest.keyArticles) ? digest.keyArticles : [];
  const categoryNames = Array.isArray(digest.categoryNames) ? digest.categoryNames : [];
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded bg-slate-100 px-2 py-1">{digestStatusLabel(digest.status)}</span>
            <span className="rounded bg-slate-100 px-2 py-1">{titleCase(digest.period)}</span>
            <span>{new Date(digest.createdAt).toLocaleString()}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold">{titleCase(digest.period)} news digest</h2>
          {(categoryNames.length > 0 || entityNames.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {categoryNames.map((category) => (
                <span key={category} className="rounded bg-teal-50 px-2 py-1 text-accent">{category}</span>
              ))}
              {entityNames.map((entity) => (
                <span key={entity} className="rounded bg-slate-100 px-2 py-1">{entity}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {digest.status === 'queued' && (
        <p className="mt-3 rounded bg-teal-50 p-3 text-sm text-accent">
          Digest is queued. The page will refresh it automatically.
        </p>
      )}
      {digest.status === 'error' && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {digest.error ?? 'Digest build failed.'}
        </p>
      )}
      {digest.summary && <p className="mt-3 text-sm text-slate-700">{displayText(String(digest.summary))}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DigestCountList title="Top entities" items={topEntities} emptyText="No entities in this period." />
        <DigestCountList title="Top categories" items={topCategories} emptyText="No categories in this period." />
      </div>
      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">Key articles</h3>
        <div className="mt-2 grid gap-2">
          {keyArticles.length === 0 && <p className="text-sm text-slate-500">No key articles in this period.</p>}
          {keyArticles.map((article) => (
            <div key={article.id} className="rounded bg-panel p-3 text-sm">
              <p className="font-medium">{displayText(article.title)}</p>
              {article.summary && <p className="mt-1 line-clamp-2 text-slate-600">{displayText(article.summary)}</p>}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function entitiesById(entities: Entity[], ids: string[]): string[] {
  const names = new Map(entities.map((entity) => [entity.id, entity.canonicalName]));
  return ids.map((id) => names.get(id) ?? id);
}

function DigestCountList(props: {title: string; items: DigestCount[]; emptyText: string}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-normal text-slate-500">{props.title}</h3>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {props.items.length === 0 && <p className="text-sm text-slate-500">{props.emptyText}</p>}
        {props.items.map((item) => (
          <span key={item.name} className="rounded bg-slate-100 px-2 py-1">
            {item.name} ({item.count})
          </span>
        ))}
      </div>
    </div>
  );
}

function digestStatusLabel(status: string): string {
  if (status === 'ready') {
    return 'Ready';
  }
  if (status === 'error') {
    return 'Error';
  }
  return 'Queued';
}

function Telemetry({request}: {request: <T>(path: string) => Promise<T>}) {
  const [rows, setRows] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setRows(await request<TelemetryRow[]>('/telemetry/llm'));
    } catch (error) {
      setLoadError(errorMessage(error, 'Unable to load telemetry.'));
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading) {
    return <LoadingBlock text="Loading telemetry..." />;
  }
  if (loadError) {
    return <ErrorBlock message={loadError} onRetry={() => void load()} />;
  }
  const totals = rows.reduce(
    (accumulator, row) => ({
      calls: accumulator.calls + (row._sum.calls ?? 0),
      inputTokens: accumulator.inputTokens + (row._sum.inputTokens ?? 0),
      outputTokens: accumulator.outputTokens + (row._sum.outputTokens ?? 0),
      totalTokens: accumulator.totalTokens + (row._sum.totalTokens ?? 0)
    }),
    {calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0}
  );
  return (
    <section className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="LLM calls" value={totals.calls} />
        <MetricCard label="Input tokens" value={totals.inputTokens} />
        <MetricCard label="Output tokens" value={totals.outputTokens} />
        <MetricCard label="Total tokens" value={totals.totalTokens} />
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_.7fr_1fr_1fr_1fr] gap-3 border-b border-line bg-panel p-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Operation</span>
          <span>Provider</span>
          <span>Model</span>
          <span>Calls</span>
          <span>Input</span>
          <span>Output</span>
          <span>Total</span>
        </div>
        {rows.length === 0 && (
          <div className="p-4 text-sm text-slate-500">No LLM telemetry has been recorded yet.</div>
        )}
        {rows.map((row) => (
          <div
            key={`${row.operation}-${row.provider}-${row.model}`}
            className="grid grid-cols-[1.3fr_1fr_1fr_.7fr_1fr_1fr_1fr] gap-3 border-b border-line p-3 text-sm last:border-b-0"
          >
            <span className="font-medium">{operationLabel(row.operation)}</span>
            <span>{row.provider}</span>
            <span>{row.model}</span>
            <span>{formatNumber(row._sum.calls ?? 0)}</span>
            <span>{formatNumber(row._sum.inputTokens ?? 0)}</span>
            <span>{formatNumber(row._sum.outputTokens ?? 0)}</span>
            <span>{formatNumber(row._sum.totalTokens ?? 0)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Toolbar({children}: {children: React.ReactNode}) {
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3 shadow-sm">{children}</div>;
}

function MetricCard({label, value}: {label: string; value: number}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{formatNumber(value)}</p>
    </div>
  );
}

function operationLabel(operation: string): string {
  return titleCase(operation.split('_').join(' '));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export default App;
