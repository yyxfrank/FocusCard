import { useEffect, useMemo, useState } from 'react';
import { createAIAnswerController, requestAIAnswer } from '../lib/aiAssistant.js';
import { supabase } from '../lib/supabase.js';

export function useAIAnswer({ front, back, deckId, cardId, active, settings, onAnswer }) {
  const [state, setState] = useState({ busy: false, error: '', generated: false });
  const controller = useMemo(() => createAIAnswerController({
    requestAnswer: (chosen, question, signal) => requestAIAnswer(supabase, chosen, question, signal),
    onAnswer, onState: setState,
  }), [onAnswer]);
  useEffect(() => {
    // Content changes, navigation, credentials changes and unmount invalidate work.
    controller.cancel();
    setState((previous) => previous.busy ? { busy: false, error: '', generated: false } : previous);
    return () => controller.cancel(false);
  }, [controller, front, back, deckId, cardId, active, settings]);
  return { ...state, cancel: controller.cancel, generate: () => controller.generate(settings, front) };
}
