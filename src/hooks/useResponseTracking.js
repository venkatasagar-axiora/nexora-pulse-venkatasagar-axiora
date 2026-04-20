import { useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useResponseTracking(responseIdRef) {
  const enterTimes = useRef({});
  const timings    = useRef({});
  const edits      = useRef({});
  const backs      = useRef(0);
  const currentQ   = useRef(null);
  const saveTimer  = useRef(null);

  const device = (() => {
    const w = window.innerWidth;
    if (w < 640)  return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  })();

  const onEnter = useCallback((qId) => {
    currentQ.current = qId;
    enterTimes.current[qId] = Date.now();
  }, []);

  const onLeave = useCallback((qId) => {
    if (!enterTimes.current[qId]) return;
    const secs = (Date.now() - enterTimes.current[qId]) / 1000;
    timings.current[qId] = (timings.current[qId] || 0) + secs;
    delete enterTimes.current[qId];
  }, []);

  const onEdit = useCallback((qId) => {
    edits.current[qId] = (edits.current[qId] || 0) + 1;
  }, []);

  const onBack = useCallback(() => { backs.current += 1; }, []);

  function computeQuality(answers, questions) {
    if (!questions?.length) return 100;
    let score = 100;
    const totalSecs = Object.values(timings.current).reduce((a, b) => a + b, 0);
    const avgSecs   = totalSecs / Math.max(questions.length, 1);
    if (avgSecs < 3)  score -= 40;
    else if (avgSecs < 7) score -= 15;
    const scaleQs = questions.filter(q => ['rating', 'scale'].includes(q.question_type));
    if (scaleQs.length >= 3) {
      const vals   = scaleQs.map(q => String(answers[q.id] ?? '')).filter(Boolean);
      const unique = new Set(vals);
      if (unique.size === 1 && vals.length === scaleQs.length) score -= 25;
    }
    questions.filter(q => ['short_text', 'long_text'].includes(q.question_type)).forEach(q => {
      if (answers[q.id] && !edits.current[q.id]) score -= 5;
    });
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  const flush = useCallback(async (extra = {}) => {
    const id = responseIdRef?.current;
    if (!id) return;
    if (currentQ.current && enterTimes.current[currentQ.current]) {
      const secs = (Date.now() - enterTimes.current[currentQ.current]) / 1000;
      timings.current[currentQ.current] = (timings.current[currentQ.current] || 0) + secs;
      enterTimes.current[currentQ.current] = Date.now();
    }
    const metadata = {
      time_per_question: { ...timings.current },
      edit_counts:       { ...edits.current },
      back_count:        backs.current,
      device,
      drop_off_at:       currentQ.current,
      ...extra,
    };
    try {
      await supabase.from('survey_responses').update({ metadata }).eq('id', id);
    } catch (e) {
      console.warn('[Tracker] flush failed silently:', e?.message);
    }
  }, [responseIdRef, device]);

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush(), 20_000);
  }, [flush]);

  const onSubmit = useCallback(async (answers, questions) => {
    if (currentQ.current) onLeave(currentQ.current);
    const quality = computeQuality(answers, questions);
    await flush({ quality_score: quality, drop_off_at: null });
    clearTimeout(saveTimer.current);
    return quality;
  }, [flush, onLeave]);

  // BUG FIX: sendBeacon was missing the required `apikey` and `Authorization`
  // headers, so every abandon event silently returned 401 from Supabase and
  // was never recorded. The Fetch keepalive approach is more compatible with
  // CORS preflight requirements while still firing on page unload reliably.
  const onAbandon = useCallback(() => {
    if (currentQ.current) onLeave(currentQ.current);
    const id = responseIdRef?.current;
    if (!id) return;

    const metadata = {
      time_per_question: { ...timings.current },
      edit_counts:       { ...edits.current },
      back_count:        backs.current,
      device,
      drop_off_at:       currentQ.current,
    };

    const url  = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/survey_responses?id=eq.${id}`;
    const body = JSON.stringify({ metadata, status: 'abandoned' });
    const headers = {
      'Content-Type':  'application/json',
      'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Prefer':        'return=minimal',
    };

    try {
      // fetch with keepalive works on page unload (like sendBeacon) but
      // supports custom headers that sendBeacon cannot send.
      fetch(url, { method: 'PATCH', headers, body, keepalive: true });
    } catch (_) {
      // Last-ditch: fire-and-forget via supabase client
      supabase.from('survey_responses').update({ metadata, status: 'abandoned' }).eq('id', id);
    }
  }, [responseIdRef, device, onLeave]);

  return { onEnter, onLeave, onEdit, onBack, onSubmit, onAbandon, flush, scheduleSave };
}
