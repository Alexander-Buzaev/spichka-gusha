import { READINGS } from './readings.js';

const ACCOUNT_KEY = 'gusha.accounts.v1';
const AUTH_MODES = ['phone_only', 'full', 'disabled'];
export function authMode() {
  const mode = new URLSearchParams(location.search).get('auth');
  return AUTH_MODES.includes(mode) ? mode : 'phone_only';
}
const readAccounts = () => {
  try { const value = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
};
const identity = s => '+' + (s.countryCode || '7') + (s.phone || '');
export function signIn(s) {
  const returnTo = s.nameReturn;
  const saved = readAccounts()[identity(s)];
  s.profile = saved?.profile || { firstName: '', lastName: '' };
  s.readings = Array.isArray(saved?.readings) ? saved.readings : [];
  s.logged = true;
  s.nameReturn = returnTo === 'profile' ? 'profile' : 'stories';
}
export function persistAccount(s) {
  if (!s.logged || !s.phone) return;
  const accounts = readAccounts();
  accounts[identity(s)] = { profile: s.profile || {}, readings: s.readings || [] };
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts)); } catch { /* приватный режим */ }
}
export function beginTicket(s, sphere = false) {
  const run = crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
  s.readingRun = run;
  s.readingKind = sphere ? (s.sphere === 'career' ? 'career' : 'love') : 'full';
  s.activeReadingId = null;
  s.storyCursor = 0;
  s.storyFromProfile = false;
  if (sphere) s.sphereTicket = '00000000';
  else s.ticket = '00000000';
}
export function currentReading(s) {
  const saved = (s.readings || []).find(r => r.id === s.activeReadingId);
  if (saved) return saved;
  const kind = READINGS[s.readingKind] ? s.readingKind : 'full';
  const data = READINGS[kind];
  const reading = { id: s.readingRun || 'preview-' + kind, kind,
    label: data.label, summary: data.summary, chapters: data.chapters,
    createdAt: new Date().toISOString(), birth: s.birth || null };
  s.activeReadingId = reading.id;
  s.readings = [reading, ...(s.readings || []).filter(r => r.id !== reading.id)].slice(0, 40);
  persistAccount(s);
  return reading;
}
export function openReading(s, id) {
  const reading = (s.readings || []).find(r => r.id === id);
  if (!reading) return false;
  s.activeReadingId = reading.id;
  s.readingKind = reading.kind;
  s.storyCursor = 0;
  s.storyFromProfile = true;
  return true;
}
export function nextAfterPhone(s) {
  if (authMode() === 'full') return 'code';
  signIn(s);
  return 'name';
}
export function revealRoute(s) {
  if (s.logged || authMode() === 'disabled') return 'stories';
  return 'phone';
}
export function signOut(s) {
  persistAccount(s);
  for (const key of ['profile', 'readings', 'activeReadingId', 'readingRun', 'readingKind',
    'storyCursor', 'nameReturn', 'code', 'phone', 'logged', 'ticket', 'sphereTicket']) delete s[key];
}
