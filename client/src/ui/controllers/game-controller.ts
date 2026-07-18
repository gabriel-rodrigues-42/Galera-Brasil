import type { GameTimerHud } from '../components/game-timer-hud';
import type { GameQuestGuide } from '../components/game-quest-guide';
import type { GameAssemblyOverlay } from '../components/game-assembly-overlay';
import type { Network, DebrisNetState } from '../../network';

export interface GameControllerDeps {
  gameTimerHud: GameTimerHud;
  gameQuestGuide: GameQuestGuide;
  assemblyOverlay: GameAssemblyOverlay;
  blackoutVignette: HTMLDivElement;
  network: Network;
  announce(text: string, isBigAlert?: boolean): void;
  releasePointer(): void;
  resumeGame(): void;
}

export interface GameController {
  init(): void;
}

export function initGameController(deps: GameControllerDeps): GameController {
  const activeDebris = new Map<string, DebrisNetState>();

  function updateQuestGuide() {
    const total = activeDebris.size;
    let cleared = 0;
    activeDebris.forEach((d) => {
      if (d.status === 'cleared') cleared++;
    });

    let description = 'Limpem a praça e retirem os detritos!';
    const remaining: string[] = [];
    activeDebris.forEach((d) => {
      if (d.status !== 'cleared') remaining.push(d.kind);
    });

    if (remaining.includes('placa')) {
      description = 'Conserte as placas solares danificadas nas tendas!';
    } else if (remaining.includes('lixo')) {
      description = 'Recolha as pilhas de lixo espalhadas pela praça!';
    } else if (remaining.includes('vitoria_regia')) {
      description = 'Limpe as plantas poluídas no lago!';
    } else if (remaining.includes('mato')) {
      description = 'Apare os matos excessivos ao redor da praça!';
    } else if (total > 0 && cleared === total) {
      description = 'Bom trabalho! O mutirão foi um sucesso!';
    }

    deps.gameQuestGuide.updateProgress(cleared, total, description);
  }

  function syncAssemblyPlayers() {
    const playersList: any[] = [];
    deps.network.room?.state.players.forEach((p: any, sessionId: string) => {
      playersList.push({
        sessionId,
        name: p.name,
        isGhost: p.isGhost,
        hasVoted: p.voteTarget !== '',
      });
    });
    deps.assemblyOverlay.setPlayers(playersList);
  }

  function init() {
    deps.network.onGameStateChange = (gameState) => {
      if (gameState === 'playing') {
        deps.gameTimerHud.hidden = false;
        deps.gameQuestGuide.hidden = false;
      } else {
        deps.gameTimerHud.hidden = true;
        deps.gameQuestGuide.hidden = true;
        deps.assemblyOverlay.hidden = true;
        deps.blackoutVignette.classList.remove('active');
        activeDebris.clear();
      }
    };

    deps.network.onGameTimerChange = (gameTimer) => {
      deps.gameTimerHud.setTime(gameTimer);
    };

    deps.network.onDebrisAdd = (id, state) => {
      activeDebris.set(id, state);
      updateQuestGuide();
    };

    deps.network.onDebrisChange = (id, state) => {
      activeDebris.set(id, state);
      updateQuestGuide();
    };

    deps.network.onDebrisRemove = (id) => {
      activeDebris.delete(id);
      updateQuestGuide();
    };

    // Social deduction meeting updates
    deps.network.onMeetingStateChange = (meetingState) => {
      if (meetingState !== 'none') {
        deps.assemblyOverlay.hidden = false;
        deps.releasePointer();

        const me = deps.network.room?.state.players.get(deps.network.sessionId);
        deps.assemblyOverlay.setup(me?.isGhost || false);
        syncAssemblyPlayers();
      } else {
        deps.assemblyOverlay.hidden = true;
        deps.resumeGame();
      }
    };

    deps.network.onMeetingTimerChange = (meetingTimer) => {
      const state = deps.network.room?.state.meetingState;
      deps.assemblyOverlay.setTimer(meetingTimer, state);
      syncAssemblyPlayers();
    };

    deps.network.onBlackoutTimerChange = (blackoutTimer) => {
      if (blackoutTimer > 0) {
        deps.blackoutVignette.classList.add('active');
      } else {
        deps.blackoutVignette.classList.remove('active');
      }
    };

    deps.network.onRoleAssignment = (role) => {
      if (role === 'sabotador') {
        deps.announce('🚨 VOCÊ É O SABOTADOR! Use suas habilidades para impedir a limpeza!', true);
      } else {
        deps.announce('🛡️ Você é um Trabalhador! Limpe a praça e descubra quem sabotou!', true);
      }
    };

    deps.assemblyOverlay.addEventListener('cast-vote', (e: Event) => {
      const customEvent = e as CustomEvent<{ targetId: string }>;
      deps.network.sendCastVote(customEvent.detail.targetId);
    });
  }

  return {
    init,
  };
}
