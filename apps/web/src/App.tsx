import {
  Activity,
  BookOpen,
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
import ReactFlow, {applyNodeChanges, Background, Controls, Edge, Node, NodeChange} from 'reactflow';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type View = 'articles' | 'feeds' | 'graph' | 'settings' | 'digests' | 'telemetry';
type JsonRecord = Record<string, unknown>;

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
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

interface Notice {
  id: string;
  kind: 'info' | 'error';
  text: string;
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
  const [message, setMessage] = useState('');

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
      throw new Error(formatApiErrorText(text));
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }, [token]);

  useEffect(() => {
    localStorage.setItem('nih_token', token);
  }, [token]);

  if (location.pathname === '/verify') {
    return <Verify request={request} />;
  }

  if (!token) {
    return <AuthScreen setToken={setToken} setMessage={setMessage} message={message} />;
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
      <main className="mx-auto max-w-7xl px-4 py-5">
        {view === 'articles' && <Articles request={request} />}
        {view === 'feeds' && <Feeds request={request} />}
        {view === 'graph' && <Graph request={request} />}
        {view === 'settings' && <SettingsView request={request} />}
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
      {text}
    </div>
  );
}

function ErrorBlock({message, onRetry}: {message: string; onRetry: () => void}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
      <p>{message}</p>
      <button className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function AuthScreen(props: {
  setToken: (token: string) => void;
  setMessage: (message: string) => void;
  message: string;
}) {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('Password123!');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  async function submit() {
    props.setMessage('');
    const response = await fetch(`${apiUrl}/auth/${mode}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({email: email.trim(), password})
    });
    const data = await response.json() as ApiErrorBody & {accessToken?: string; devVerifyUrl?: string};
    if (!response.ok) {
      props.setMessage(formatAuthError(data));
      return;
    }
    if (mode === 'login') {
      props.setToken(data.accessToken ?? '');
    } else {
      props.setMessage(`DEV MODE verification link: ${data.devVerifyUrl}`);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl place-items-center px-4">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">News Intelligence Hub</h1>
        <div className="mt-5 grid gap-3">
          <input
            className="rounded-md border border-line px-3 py-2"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              props.setMessage('');
            }}
          />
          <input
            className="rounded-md border border-line px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              props.setMessage('');
            }}
          />
          <button className="rounded-md bg-accent px-4 py-2 text-white" onClick={submit}>
            {mode === 'login' ? 'Login' : 'Register'}
          </button>
          <button className="text-left text-sm text-accent" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Create account' : 'Use existing account'}
          </button>
          {props.message && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {props.message}
            </p>
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
  const [state, setState] = useState('Verifying email...');
  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token');
    request(`/auth/verify?token=${token}`).then(() => setState('Email verified. You can log in now.')).catch((error) => {
      setState(error.message);
    });
  }, [request]);
  return <main className="grid min-h-screen place-items-center text-lg">{state}</main>;
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
            {feeds.map((feed) => <option key={feed.id} value={feed.id}>{feed.title ?? feed.url}</option>)}
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
            <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-500 shadow-sm">
              No articles match the selected filters.
            </div>
          )}
          {!loading && !loadError && articles.map((article) => (
            <button key={article.id} className="rounded-lg border border-line bg-white p-4 text-left shadow-sm" onClick={() => setSelected(article)}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{article.feed?.title ?? 'Source'}</span>
                <span>{new Date(article.publishedAt).toLocaleString()}</span>
                <span className="rounded bg-slate-100 px-2 py-1">{article.importance}</span>
                <span>{article.similarCount} similar</span>
              </div>
              <h2 className="mt-2 text-base font-semibold">{article.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{article.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {(article.mentions ?? []).map(({entity}) => <span key={entity.id} className="rounded bg-teal-50 px-2 py-1 text-accent">{entity.canonicalName}</span>)}
              </div>
            </button>
          ))}
        </div>
      </div>
      <aside className="rounded-lg border border-line bg-white p-4 shadow-sm">
        {selected ? <ArticleDetail article={selected} request={request} /> : <p className="text-sm text-slate-500">Select an article.</p>}
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
      <h2 className="text-lg font-semibold">{full.title}</h2>
      <p className="text-sm text-slate-700">{full.fullSummary ?? full.summary}</p>
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
                    <p className="font-medium">{mentionedArticle.title}</p>
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
    try {
      await request('/feeds', {method: 'POST', body: JSON.stringify({url})});
      setUrl('');
      await load();
      setMessage(makeNotice('info', 'Feed added and queued for pulling.'));
    } catch (error) {
      setMessage(makeNotice('error', error instanceof Error ? error.message : 'Unable to add feed.'));
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
        <button className="flex h-10 items-center gap-2 rounded-md bg-accent px-3 text-white" onClick={add}><Plus size={16} />Add</button>
      </Toolbar>
      <Toast key={message?.id ?? 'feeds-toast'} notice={message} />
      {loading && <div className="mt-4"><LoadingBlock text="Loading feeds..." /></div>}
      {!loading && loadError && <div className="mt-4"><ErrorBlock message={loadError} onRetry={() => void load()} /></div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {!loading && !loadError && feeds.map((feed) => (
          <div key={feed.id} className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{feed.title ?? feed.url}</h2>
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
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedNode, setSelectedNode] = useState<JsonRecord | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Article | EntityDetail | null>(null);
  const loadGraph = useCallback(() => {
    const params = new URLSearchParams(Object.entries({nodeKind, category, q: search}).filter(([, value]) => value));
    setLoading(true);
    setLoadError('');
    request<{nodes: JsonRecord[]; edges: JsonRecord[]}>(`/graph?${params}`)
      .then(setGraph)
      .catch((error) => {
        setLoadError(errorMessage(error, 'Unable to load graph.'));
      })
      .finally(() => setLoading(false));
  }, [category, nodeKind, request, search]);
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
          data: {label: `${node.kind}: ${node.label}`},
          style: {borderColor: node.kind === 'article' ? '#0f766e' : '#64748b'}
        };
      });
    });
  }, [graph.nodes]);
  const visibleNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge, index) => ({
    id: `${edge.from}-${edge.to}-${index}`,
    source: String(edge.from),
    target: String(edge.to),
    label: String(edge.kind),
    animated: edge.kind === 'co_mention'
  })).filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)), [graph.edges, visibleNodeIds]);
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
        </Toolbar>
        <div className="mt-4 h-[680px] overflow-hidden rounded-lg border border-line bg-white">
          {loading && <div className="p-4"><LoadingBlock text="Loading graph..." /></div>}
          {!loading && loadError && <div className="p-4"><ErrorBlock message={loadError} onRetry={loadGraph} /></div>}
          {!loading && !loadError && (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              nodesConnectable={false}
              onNodesChange={onNodesChange}
              onNodeClick={(_, node) => selectNode(node.id)}
            >
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
          <p className="text-sm text-slate-500">Select a graph node.</p>
        )}
      </div>
    </section>
  );
}

function GraphNodeDetails(props: {node: JsonRecord; detail: Article | EntityDetail | null}) {
  const kind = String(props.node.kind);
  if (!props.detail) {
    return (
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-normal text-slate-500">{kind}</p>
        <h2 className="font-semibold">{String(props.node.label)}</h2>
        <p className="text-sm text-slate-500">Loading details...</p>
      </div>
    );
  }
  if (kind === 'article') {
    const article = props.detail as Article;
    return (
      <div className="grid gap-3">
        <p className="text-xs uppercase tracking-normal text-slate-500">Article</p>
        <h2 className="font-semibold">{article.title}</h2>
        <p className="text-sm text-slate-700">{article.fullSummary ?? article.summary}</p>
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
                <p className="font-medium">{article.title}</p>
                <p className="text-slate-500">{new Date(article.publishedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsView({request}: {request: <T>(path: string, init?: RequestInit) => Promise<T>}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [axes, setAxes] = useState<Axis[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [axisName, setAxisName] = useState('');
  const [axisValues, setAxisValues] = useState('');
  const [message, setMessage] = useState<Notice | null>(null);
  const [regeneration, setRegeneration] = useState<RegenerationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
    if (!regeneration || !['queued', 'running'].includes(regeneration.status)) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      request<RegenerationRun>(`/regenerations/${regeneration.id}`).then(setRegeneration);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [regeneration, request]);

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
    try {
      const run = await request<RegenerationRun>('/regenerations', {method: 'POST'});
      setRegeneration(run);
      setMessage(makeNotice('info', 'Regeneration queued.'));
    } catch (error) {
      setMessage(makeNotice('error', errorMessage(error, 'Unable to queue regeneration.')));
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
                {regeneration.status} · {regeneration.processed} of {regeneration.total} articles
              </p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs">{regeneration.id}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full bg-accent"
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
          <button className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm" onClick={regenerate}><RefreshCw size={16} />Regenerate</button>
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function Digests({request}: {request: <T>(path: string, init?: RequestInit) => Promise<T>}) {
  const [digests, setDigests] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setDigests(await request<JsonRecord[]>('/digests'));
    } catch (error) {
      setLoadError(errorMessage(error, 'Unable to load digests.'));
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  async function buildDailyDigest() {
    try {
      await request('/digests', {method: 'POST', body: JSON.stringify({period: 'day'})});
      await load();
    } catch (error) {
      setLoadError(errorMessage(error, 'Unable to build digest.'));
    }
  }
  return (
    <section>
      <Toolbar>
        <button className="rounded-md bg-accent px-3 py-2 text-white" onClick={() => void buildDailyDigest()}>Build daily digest</button>
      </Toolbar>
      <div className="mt-4 grid gap-3">
        {loading && <LoadingBlock text="Loading digests..." />}
        {!loading && loadError && <ErrorBlock message={loadError} onRetry={() => void load()} />}
        {!loading && !loadError && digests.length === 0 && (
          <div className="rounded-lg border border-line bg-white p-4 text-sm text-slate-500 shadow-sm">
            No digests have been built yet.
          </div>
        )}
        {!loading && !loadError && digests.map((digest) => <pre key={String(digest.id)} className="overflow-auto rounded-lg border border-line bg-white p-4 text-sm shadow-sm">{JSON.stringify(digest, null, 2)}</pre>)}
      </div>
    </section>
  );
}

function Telemetry({request}: {request: <T>(path: string) => Promise<T>}) {
  const [rows, setRows] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setRows(await request<JsonRecord[]>('/telemetry/llm'));
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
  return <pre className="overflow-auto rounded-lg border border-line bg-white p-4 text-sm shadow-sm">{JSON.stringify(rows, null, 2)}</pre>;
}

function Toolbar({children}: {children: React.ReactNode}) {
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3 shadow-sm">{children}</div>;
}

export default App;
