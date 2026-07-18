import { log } from '../../logger';
import type { JoinOverlay } from '../components/join-overlay';
import { JOIN_SUBMIT, RESUME_CLICK, type JoinSubmitDetail } from '../events';

export interface JoinControllerDeps {
  overlay: JoinOverlay;
  connect(name: string): Promise<void>;
  ensureOwnHub(name: string): Promise<void>;
  setMyName(name: string): void;
  setConnected(connected: boolean): void;
  appendSystemChatLine(text: string): void;
  requestLock(): void;
  onJoined(): void;
}

export interface JoinController {
  init(): void;
  setStatus(text: string): void;
}

export function initJoinController(deps: JoinControllerDeps): JoinController {
  const SAVED_NAME_KEY = 'galera-brasil-name';

  function init() {
    const savedName = localStorage.getItem(SAVED_NAME_KEY) ?? '';
    deps.overlay.setName(savedName);

    deps.overlay.addEventListener(JOIN_SUBMIT, ((e: CustomEvent<JoinSubmitDetail>) => {
      const { name } = e.detail;
      deps.overlay.setLoading(true);
      deps.overlay.setStatus('Conectando...');

      deps
        .connect(name)
        .then(() => deps.ensureOwnHub(name))
        .then(() => {
          localStorage.setItem(SAVED_NAME_KEY, name);
          deps.setMyName(name);
          deps.setConnected(true);
          deps.appendSystemChatLine('Você entrou na praça');
          deps.overlay.setConnected(true);
          deps.overlay.setLoading(false);
          deps.overlay.setStatus('');
          deps.onJoined();
          deps.requestLock();
        })
        .catch((err) => {
          log('error', `Failed to connect: ${err}`);
          deps.overlay.setStatus('Não foi possível conectar ao servidor. Tente novamente.');
          deps.overlay.setLoading(false);
        });
    }) as EventListener);

    deps.overlay.addEventListener(RESUME_CLICK, () => {
      deps.requestLock();
    });
  }

  return {
    init,
    setStatus: (text) => deps.overlay.setStatus(text),
  };
}
