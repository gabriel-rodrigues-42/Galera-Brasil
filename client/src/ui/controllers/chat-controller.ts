import type { Network } from '../../network';
import type { ChatBox } from '../components/chat-box';
import { CHAT_SEND, CHAT_INPUT_CLOSED, type ChatSendDetail } from '../events';

export interface ChatControllerDeps {
  chatBox: ChatBox;
  network: Network;
  resetKeys(): void;
}

export interface ChatController {
  readonly isInputOpen: boolean;
  readonly isCompact: boolean;
  openInput(): void;
  closeInput(): void;
  toggleCompact(): void;
}

export function initChatController(deps: ChatControllerDeps): ChatController {
  let inputOpen = false;
  let compact = false;

  function openInput() {
    inputOpen = true;
    // don't keep sliding on stale held keys once typing starts
    deps.resetKeys();
    deps.chatBox.openInput();
  }

  function closeInput() {
    inputOpen = false;
    deps.chatBox.closeInput();
  }

  function toggleCompact() {
    compact = !compact;
    deps.chatBox.setCompact(compact);
  }

  deps.chatBox.addEventListener(CHAT_SEND, ((e: CustomEvent<ChatSendDetail>) => {
    deps.network.sendChat(e.detail.text);
  }) as EventListener);

  deps.chatBox.addEventListener(CHAT_INPUT_CLOSED, () => {
    inputOpen = false;
  });

  return {
    get isInputOpen() {
      return inputOpen;
    },
    get isCompact() {
      return compact;
    },
    openInput,
    closeInput,
    toggleCompact,
  };
}
