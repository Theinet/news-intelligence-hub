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
import ReactFlow, {Background, Controls, Edge, Node} from 'reactflow';

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
  const [selected, setSelected] = useState<Article | null>(null);
  const [filters, setFilters] = useState({category: '', importance: '', status: ''});
  const load = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        params.append(key, trimmedValue);
      }
    });
    request<Article[]>(`/articles?${params}`).then(setArticles);
  }, [filters, request]);
  useEffect(() => {
    void load();
  }, [load]);

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
          <select className="h-10 rounded-md border border-line px-3" onChange={(e) => setFilters({...filters, importance: e.target.value})}>
            <option value="">All importance</option>
            <option value="high">Important</option>
            <option value="normal">Normal</option>
            <option value="junk">Junk</option>
          </select>
          <select className="h-10 rounded-md border border-line px-3" onChange={(e) => setFilters({...filters, status: e.target.value})}>
            <option value="">All states</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="filtered">Filtered</option>
          </select>
        </Toolbar>
        <div className="mt-4 grid gap-3">
          {articles.map((article) => (
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
              <p className="text-xs uppercase tracking-normal text-slate-500">{entityDetail.type}</p>
            </div>
            <span className="rounded bg-white px-2 py-1 text-xs">
              {entityDetail.mentions?.length ?? 0} mentions
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
  const [message, setMessage] = useState<{kind: 'info' | 'error'; text: string} | null>(null);
  const [busyId, setBusyId] = useState('');
  const load = useCallback(() => request<Feed[]>('/feeds').then(setFeeds), [request]);
  useEffect(() => {
    void load();
  }, [load]);
  async function add() {
    setMessage(null);
    try {
      await request('/feeds', {method: 'POST', body: JSON.stringify({url})});
      setUrl('');
      await load();
      setMessage({kind: 'info', text: 'Feed added and queued for pulling.'});
    } catch (error) {
      setMessage({kind: 'error', text: error instanceof Error ? error.message : 'Unable to add feed.'});
    }
  }
  async function runFeedAction(feedId: string, action: 'pull' | 'pause' | 'resume' | 'delete') {
    setMessage(null);
    setBusyId(feedId);
    try {
      if (action === 'delete') {
        await request(`/feeds/${feedId}`, {method: 'DELETE'});
        setMessage({kind: 'info', text: 'Feed deleted. Existing articles stay in the library.'});
      } else {
        const method = action === 'pull' ? 'POST' : 'PATCH';
        await request(`/feeds/${feedId}/${action}`, {method});
        setMessage({kind: 'info', text: action === 'pull' ? 'Feed pull queued.' : `Feed ${action}d.`});
      }
      await load();
    } catch (error) {
      setMessage({kind: 'error', text: error instanceof Error ? error.message : `Unable to ${action} feed.`});
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
      {message && (
        <p className={`mt-3 rounded-md px-3 py-2 text-sm ${
          message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-accent'
        }`}>
          {message.text}
        </p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {feeds.map((feed) => (
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
  const [nodeKind, setNodeKind] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(Object.entries({nodeKind, category}).filter(([, value]) => value));
    request<{nodes: JsonRecord[]; edges: JsonRecord[]}>(`/graph?${params}`).then(setGraph);
  }, [category, nodeKind, request]);
  const nodes = useMemo<Node[]>(() => graph.nodes.map((node, index) => ({
    id: String(node.id),
    position: {x: (index % 6) * 210, y: Math.floor(index / 6) * 120},
    data: {label: `${node.kind}: ${node.label}`},
    style: {borderColor: node.kind === 'article' ? '#0f766e' : '#64748b'}
  })), [graph.nodes]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge, index) => ({
    id: `${edge.from}-${edge.to}-${index}`,
    source: String(edge.from),
    target: String(edge.to),
    label: String(edge.kind),
    animated: edge.kind === 'co_mention'
  })), [graph.edges]);
  return (
    <section>
      <Toolbar>
        <select className="h-10 rounded-md border border-line px-3" onChange={(e) => setNodeKind(e.target.value)}>
          <option value="">All nodes</option>
          <option value="article">Articles</option>
          <option value="entity">Entities</option>
        </select>
        <input className="h-10 rounded-md border border-line px-3" placeholder="Category" onChange={(e) => setCategory(e.target.value)} />
      </Toolbar>
      <div className="mt-4 h-[680px] overflow-hidden rounded-lg border border-line bg-white">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </section>
  );
}

function SettingsView({request}: {request: <T>(path: string, init?: RequestInit) => Promise<T>}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [axes, setAxes] = useState<Axis[]>([]);
  const [name, setName] = useState('');
  const load = useCallback(() => {
    request<Category[]>('/categories').then(setCategories);
    request<Axis[]>('/axes').then(setAxes);
  }, [request]);
  useEffect(load, [load]);
  async function regenerate() {
    await request('/regenerations', {method: 'POST'});
    load();
  }
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Categories</h2>
        <div className="mt-3 flex gap-2">
          <input className="h-10 flex-1 rounded-md border border-line px-3" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="rounded-md bg-accent px-3 text-white" onClick={() => request('/categories', {method: 'POST', body: JSON.stringify({name})}).then(load)}>Add</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{categories.map((item) => <span key={item.id} className="rounded bg-teal-50 px-2 py-1 text-sm text-accent">{item.name}</span>)}</div>
      </div>
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Categorization axes</h2>
          <button className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm" onClick={regenerate}><RefreshCw size={16} />Regenerate</button>
        </div>
        <div className="mt-3 grid gap-3">
          {axes.map((axis) => (
            <div key={axis.id} className="rounded-md bg-panel p-3">
              <input className="w-full rounded border border-line px-2 py-1" value={axis.name} onChange={(e) => setAxes(axes.map((item) => item.id === axis.id ? {...item, name: e.target.value} : item))} />
              <input className="mt-2 w-full rounded border border-line px-2 py-1" value={axis.values.join(', ')} onChange={(e) => setAxes(axes.map((item) => item.id === axis.id ? {...item, values: e.target.value.split(',').map((value) => value.trim())} : item))} />
              <button className="mt-2 rounded border border-line px-3 py-1 text-sm" onClick={() => request(`/axes/${axis.id}`, {method: 'PATCH', body: JSON.stringify({name: axis.name, values: axis.values})}).then(load)}>Save</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Digests({request}: {request: <T>(path: string, init?: RequestInit) => Promise<T>}) {
  const [digests, setDigests] = useState<JsonRecord[]>([]);
  const load = useCallback(() => request<JsonRecord[]>('/digests').then(setDigests), [request]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section>
      <Toolbar>
        <button className="rounded-md bg-accent px-3 py-2 text-white" onClick={() => request('/digests', {method: 'POST', body: JSON.stringify({period: 'day'})}).then(load)}>Build daily digest</button>
      </Toolbar>
      <div className="mt-4 grid gap-3">
        {digests.map((digest) => <pre key={String(digest.id)} className="overflow-auto rounded-lg border border-line bg-white p-4 text-sm shadow-sm">{JSON.stringify(digest, null, 2)}</pre>)}
      </div>
    </section>
  );
}

function Telemetry({request}: {request: <T>(path: string) => Promise<T>}) {
  const [rows, setRows] = useState<JsonRecord[]>([]);
  useEffect(() => {
    request<JsonRecord[]>('/telemetry/llm').then(setRows);
  }, [request]);
  return <pre className="overflow-auto rounded-lg border border-line bg-white p-4 text-sm shadow-sm">{JSON.stringify(rows, null, 2)}</pre>;
}

function Toolbar({children}: {children: React.ReactNode}) {
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3 shadow-sm">{children}</div>;
}

export default App;
