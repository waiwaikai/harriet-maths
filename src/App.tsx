import { useEffect, useState } from 'react';
import type { ProgressState } from './content/types';
import { getBank, spine } from './content/loadBank';
import { planToday } from './engine/scheduler';
import { useTodayISO } from './useToday';
import { getState } from './store/progress';
import { saveState } from './store/persistence';
import { defaultState } from './store/persistence';
import { parseRestoreHash } from './engine/summary';
import { warmVoices } from './voice/tts';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Diagnostic } from './screens/Diagnostic';

export default function App() {
  const [state, setState] = useState<ProgressState>(() => {
    // opening a backup link restores the carried state onto this device
    const restored = parseRestoreHash();
    if (restored) {
      const merged: ProgressState = { ...defaultState(), ...restored, settings: { ...defaultState().settings, ...restored.settings } };
      saveState(merged);
      return merged;
    }
    return getState();
  });
  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const [inDiagnostic, setInDiagnostic] = useState(false);

  useEffect(() => { warmVoices(); }, []);

  const today = useTodayISO(state.settings.dateOverride);
  const plan = planToday(state, today, spine);

  if (inDiagnostic) {
    return <Diagnostic state={state} setState={setState} onExit={() => setInDiagnostic(false)} />;
  }

  if (activeWeekId) {
    const bank = getBank(activeWeekId);
    const week = spine.weeks.find(w => w.id === activeWeekId);
    if (bank && week) {
      return (
        <Session
          bank={bank}
          week={week}
          plan={plan}
          dateISO={today}
          state={state}
          setState={setState}
          onExit={() => setActiveWeekId(null)}
        />
      );
    }
  }

  return <Home state={state} setState={setState} plan={plan} today={today} onStart={setActiveWeekId} onStartDiagnostic={() => setInDiagnostic(true)} />;
}
