import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Account, Client, Databases, ID, Permission, Query, Role } from 'appwrite';
import './styles.css';
import './controls.css';

const SIZE = 100;
const EMPTY = Array(SIZE * SIZE).fill('#F4F0E8');
const COLORS = [
  { name: 'Ink', value: '#17212B' }, { name: 'Tomato', value: '#F04438' },
  { name: 'Tangerine', value: '#F59E0B' }, { name: 'Lemon', value: '#F8D34F' },
  { name: 'Mint', value: '#3CCB8E' }, { name: 'Aqua', value: '#38BDF8' },
  { name: 'Blue', value: '#4878F5' }, { name: 'Violet', value: '#9B5DE5' },
  { name: 'Pink', value: '#F472B6' }, { name: 'Paper', value: '#F4F0E8' }
];

const config = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  project: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  database: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  collection: import.meta.env.VITE_APPWRITE_COLLECTION_ID || 'canvas',
  board: import.meta.env.VITE_APPWRITE_BOARD_DOCUMENT_ID || 'main-board'
};

const client = new Client();
if (config.project) client.setEndpoint(config.endpoint).setProject(config.project);
const account = new Account(client);
const databases = new Databases(client);

function isConfigured() { return Boolean(config.project && config.database); }
function makeBoard(cells = EMPTY) { return { cells: cells.join(','), updatedAt: new Date().toISOString(), pixels: cells.filter(c => c !== COLORS[9].value).length }; }

async function getBoard() {
  const doc = await databases.getDocument(config.database, config.collection, config.board);
  return { ...makeBoard(), ...doc, cells: doc.cells.split(',') };
}

async function ensureBoard() {
  try { return await getBoard(); }
  catch (error) {
    if (error?.code !== 404) throw error;
    const permissions = [Permission.read(Role.any()), Permission.update(Role.users())];
    const doc = await databases.createDocument(config.database, config.collection, config.board, makeBoard(), permissions);
    return { ...doc, cells: doc.cells.split(',') };
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [cells, setCells] = useState(EMPTY);
  const [selected, setSelected] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(1);
  const [shade, setShade] = useState('solid');
  const [controlsOpen, setControlsOpen] = useState(true);
  const [status, setStatus] = useState(isConfigured() ? 'Connecting to the board…' : 'Demo preview — connect Appwrite to paint');
  const [modal, setModal] = useState(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const filled = useMemo(() => cells.filter((c) => c !== COLORS[9].value).length, [cells]);

  useEffect(() => {
    if (!isConfigured()) { setStatus('Demo preview'); return undefined; }
    let unsubscribe;
    (async () => {
      try {
        const current = await account.get(); setUser(current);
      } catch { setUser(null); }
      try {
        const board = await ensureBoard(); setCells(board.cells); setStatus('Live board');
        unsubscribe = client.subscribe(`databases.${config.database}.collections.${config.collection}.documents.${config.board}`, (event) => {
          if (event.events.some((item) => item.includes('.update') || item.includes('.create'))) {
            setCells(event.payload.cells.split(',')); setStatus('Live board');
          }
        });
      } catch (error) { setStatus(error?.message || 'Could not load board'); }
    })();
    return () => unsubscribe?.();
  }, []);

  async function handleAuth(event) {
    event.preventDefault(); setBusy(true);
    try {
      if (modal === 'signup') {
        await account.create(ID.unique(), authForm.email, authForm.password, authForm.name);
        await account.createEmailPasswordSession(authForm.email, authForm.password);
      } else await account.createEmailPasswordSession(authForm.email, authForm.password);
      setUser(await account.get()); setModal(null); setStatus('Live board');
    } catch (error) { setStatus(error?.message || 'Could not sign you in'); }
    finally { setBusy(false); }
  }

  async function logout() { await account.deleteSession('current'); setUser(null); }

  function paintColor(hex) {
    if (shade === 'solid') return hex;
    const amount = shade === 'light' ? 0.34 : 0.22;
    const target = shade === 'light' ? [255, 255, 255] : [0, 0, 0];
    const rgb = hex.match(/[A-Fa-f0-9]{2}/g).map(value => parseInt(value, 16));
    return `#${rgb.map((value, i) => Math.round(value + (target[i] - value) * amount).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }

  async function paint(index) {
    if (!user) { setModal('login'); return; }
    const next = [...cells];
    const row = Math.floor(index / SIZE); const col = index % SIZE;
    const color = paintColor(selected); const radius = Math.floor(brushSize / 2);
    for (let y = Math.max(0, row - radius); y <= Math.min(SIZE - 1, row + radius); y += 1) {
      for (let x = Math.max(0, col - radius); x <= Math.min(SIZE - 1, col + radius); x += 1) next[y * SIZE + x] = color;
    }
    if (next.join(',') === cells.join(',')) return;
    setCells(next); setStatus('Saving…');
    try { await databases.updateDocument(config.database, config.collection, config.board, { cells: next.join(','), updatedAt: new Date().toISOString(), pixels: next.filter(c => c !== COLORS[9].value).length }); setStatus('Live board'); }
    catch (error) { setStatus(error?.message || 'Could not save pixel'); setCells(cells); }
  }

  return <main>
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">✳</span><span>Canvas<br /><em>For All</em></span></a><div className="top-actions"><span className="live"><i /> {status}</span>{user ? <button className="user-button" onClick={logout}><span>{(user.name || user.email)[0].toUpperCase()}</span>{user.name || user.email}<small>Log out</small></button> : <button className="button dark small" onClick={() => setModal('login')}>Log in to paint <span>↗</span></button>}</div></header>
    <section className="tool-tray"><button className="fold-button" onClick={() => setControlsOpen(!controlsOpen)}><span>✦</span>{controlsOpen ? 'Hide drawing controls' : 'Show drawing controls'}<b>{controlsOpen ? '⌃' : '⌄'}</b></button>{controlsOpen && <div className="tool-options"><div><small>Brush size</small><div className="brush-options">{[1, 2, 3].map(size => <button className={brushSize === size ? 'option-active' : ''} key={size} onClick={() => setBrushSize(size)}><span style={{ width: size * 5 + 3, height: size * 5 + 3 }} />{size}px</button>)}</div></div><div><small>Shading</small><div className="shade-options">{[['light', 'Light'], ['solid', 'Solid'], ['dark', 'Dark']].map(([value, label]) => <button className={shade === value ? 'option-active' : ''} key={value} onClick={() => setShade(value)}>{label}</button>)}</div></div></div>}</section>
    <section className="hero"><div className="eyebrow">A social art experiment <span>✦</span> 100 × 100 pixels</div><h1>Make your mark.<br /><i>Together.</i></h1><p>One canvas. Everyone's invited. Pick a color, place a pixel, and see what the internet makes of it.</p></section>
    <section className="workspace"><aside className="side-panel"><div className="panel-label">01 / Choose a color</div><div className="palette">{COLORS.map((color) => <button key={color.value} className={`swatch ${selected === color.value ? 'active' : ''}`} style={{ background: color.value }} title={color.name} aria-label={`Choose ${color.name}`} onClick={() => setSelected(color.value)}><span>{selected === color.value ? '✓' : ''}</span></button>)}</div><div className="selected-readout"><span className="mini-swatch" style={{ background: selected }} /> <div><small>Selected color</small><strong>{COLORS.find(c => c.value === selected)?.name}</strong></div></div><div className="rule" /><div className="panel-label">02 / Paint the canvas</div><p className="hint">Click any square to add your pixel. Your changes are shared live with everyone here.</p><div className="keyboard"><kbd>CLICK</kbd><span>to paint</span></div></aside><div className="canvas-area"><div className="canvas-heading"><div><span className="panel-label">THE ONE AND ONLY</span><h2>Shared board</h2></div><div className="counter"><strong>{filled.toLocaleString()}</strong><span>pixels placed</span></div></div><div className="canvas-frame"><div className="grid" role="grid" aria-label="Shared 100 by 100 pixel canvas">{cells.map((color, index) => <button key={index} className="pixel" style={{ backgroundColor: color }} onClick={() => paint(index)} aria-label={`Pixel ${index + 1}`} />)}</div></div><div className="canvas-footer"><span><i className="pulse" /> Everyone sees this board</span><span>Refresh-safe <b>↻</b></span></div></div></section>
    <footer><span>Built for curious humans.</span><span>Canvas For All <b>© 2026</b></span></footer>
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setModal(null)}>×</button><div className="modal-icon">✳</div><div className="eyebrow">Join the canvas</div><h2>{modal === 'signup' ? 'Create your account.' : 'Welcome back.'}</h2><p>{modal === 'signup' ? 'Make a little space on the internet.' : 'Log in to place your pixel.'}</p><form onSubmit={handleAuth}>{modal === 'signup' && <input required placeholder="Your name" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} />}<input required type="email" placeholder="Email address" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} /><input required minLength="8" type="password" placeholder="Password (8+ characters)" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} /><button className="button dark" disabled={busy}>{busy ? 'One sec…' : modal === 'signup' ? 'Create account ↗' : 'Log in ↗'}</button></form><button className="switch" onClick={() => setModal(modal === 'signup' ? 'login' : 'signup')}>{modal === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account'}</button></div></div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
