import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { createReviewApi } from '../../lib/review.js';
import { CardContent } from '../Preview/PreviewPane.jsx';
import { commitSessionAction } from '../../utils/reviewSession.js';
import { localDateKey } from '../../utils/calendar.js';

const api = createReviewApi(supabase);
const button = 'px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-40';

export default function ReviewPane({ deckId, onClose, onCompleted, closeLabel = 'Back to editor' }) {
  const [summary, setSummary] = useState(null);
  const [limit, setLimit] = useState(20);
  const [queue, setQueue] = useState([]);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [phase, setPhase] = useState('setup');
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkInSaved, setCheckInSaved] = useState(false);
  const written = useRef(new Set());
  const lock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = await api.summary(deckId);
      setSummary(next);
      setLimit(Math.max(1, Math.min(200, Number(next.deck.daily_review_limit) || 20)));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [deckId]);
  useEffect(() => { void load(); }, [load]);

  async function start() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const cards = await api.start(deckId, limit);
      if (!cards.length) { await load(); return; }
      written.current = new Set();
      setQueue(cards); setTotal(cards.length); setCompleted(0); setFlipped(false); setPhase('review');
    } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }

  async function finish() {
    await api.checkIn(localDateKey());
    setCheckInSaved(true);
    onCompleted?.();
  }

  async function rate(feedback) {
    if (lock.current || !flipped || !queue.length) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { requeue } = await commitSessionAction(queue[0], feedback, written.current, api.persist);
      const next = requeue ? [...queue.slice(1), queue[0]] : queue.slice(1);
      setQueue(next); setFlipped(false);
      if (!requeue) setCompleted((value) => value + 1);
      if (!next.length) { setPhase('done'); await finish(); }
    } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }

  async function retryCheckIn() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await finish(); } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }

  function close() {
    if (busy) return;
    if (phase === 'review' && !window.confirm('Leave this review? Saved ratings remain, but the current session queue will be lost.')) return;
    onClose();
  }

  const allowance = summary ? Math.min(summary.due, Math.max(0, limit - summary.reviewed)) : 0;
  return <div className="review-page h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <div className="max-w-3xl mx-auto p-4 sm:p-8 flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Review · {summary?.deck.name ?? 'Deck'}</h1>
        <button className={button} disabled={busy} onClick={close}>{closeLabel}</button>
      </header>
      {error && <div role="alert" className="rounded-lg bg-red-50 text-red-700 p-3">{error}</div>}
      {loading ? <p role="status">Loading…</p> : phase === 'setup' ? <>
        {!summary ? <button className={button} onClick={load}>Retry</button> : <>
          <section className="rounded-xl bg-white dark:bg-gray-800 p-6 text-center">
            <p>Cards due today</p><p className="text-5xl leading-normal font-bold">{summary.due}</p>
          </section>
          <label className="flex items-center gap-3 justify-center">Daily review limit
            <input aria-label="Daily review limit" type="number" min="1" max="200" value={limit} disabled={busy}
              onChange={(event) => setLimit(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}
              className="w-24 rounded border p-2 bg-white dark:bg-gray-800" />
          </label>
          <p className="text-center">You will review {allowance} cards. {summary.reviewed} already reviewed today. Daily limits reset at 00:00 UTC.</p>
          <button className={button} disabled={busy || !allowance} onClick={start}>
            {busy ? 'Starting…' : !summary.due ? 'No cards due' : !allowance ? 'Daily limit reached' : 'Start Review'}
          </button>
        </>}
      </> : phase === 'done' ? <section className="text-center flex flex-col gap-4 py-8">
        <h2 className="text-2xl font-bold">Session complete!</h2>
        <p>You completed {completed} cards.</p>
        <p>{checkInSaved ? 'Daily check-in saved.' : 'Your ratings are saved. The daily check-in still needs to be saved.'}</p>
        {!checkInSaved && <button className={button} disabled={busy} onClick={retryCheckIn}>Retry check-in</button>}
        <button className={button} disabled={busy} onClick={close}>Done</button>
      </section> : <>
        <p className="text-center">Completed: {completed} / {total} · {queue.length} remaining</p>
        <section key={`${queue[0]?.id}-${flipped}`} aria-label={flipped ? 'Card answer' : 'Card question'} className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sm:p-8 min-h-64 max-h-[60vh] overflow-auto prose dark:prose-invert max-w-none">
          <CardContent content={flipped ? queue[0]?.back : queue[0]?.front} />
        </section>
        <button className={button} disabled={busy} onClick={() => setFlipped((value) => !value)}>{flipped ? 'Show question' : 'Reveal answer'}</button>
        {flipped && <div className="grid grid-cols-3 gap-2">
          {[['Forgotten', 'bg-red-600', 'Forgotten'], ['Unfamiliar', 'bg-amber-600', 'Unfamiliar'], ['Familiar', 'bg-green-600', 'Familiar']].map(([value, color, label]) =>
            <button key={value} disabled={busy} className={`rounded-lg p-3 text-white ${color} disabled:opacity-40`} onClick={() => rate(value)}>{label}</button>)}
        </div>}
        <p className="text-sm text-gray-500">Forgotten and Unfamiliar cards return later in this session. Familiar cards are completed.</p>
      </>}
    </div>
  </div>;
}
