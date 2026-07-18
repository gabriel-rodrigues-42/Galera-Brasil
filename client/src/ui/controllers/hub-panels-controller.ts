import { log } from '../../logger';
import * as api from '../../api';
import type { GuestbookPanel } from '../components/guestbook-panel';
import type { PostPanel } from '../components/post-panel';
import type { AddPostPanel } from '../components/add-post-panel';
import type { HubPost } from '../../hub-types';
import {
  GUESTBOOK_SUBMIT,
  GUESTBOOK_REACT,
  GUESTBOOK_ALLOW_TOGGLE,
  PANEL_CLOSE,
  POST_SUBMIT,
  type GuestbookSubmitDetail,
  type GuestbookReactDetail,
  type GuestbookAllowToggleDetail,
  type PostSubmitDetail,
} from '../events';

export interface HubPanelsControllerDeps {
  guestbookPanel: GuestbookPanel;
  postPanel: PostPanel;
  addPostPanel: AddPostPanel;

  getMyName(): string | null;
  getCurrentHubOwner(): string | null;
  resetKeys(): void;
  resetVelocity(): void;
  releasePointerForUI(): void;
  resumeAfterUI(): void;

  rebuildHub(owner: string): Promise<void>;
}

export interface HubPanelsController {
  readonly isGuestbookOpen: boolean;
  readonly isPostOpen: boolean;
  readonly isAddPostOpen: boolean;

  openGuestbook(): void;
  closeGuestbook(): void;
  openPost(post: HubPost): void;
  closePost(): void;
  openAddPost(): void;
  closeAddPost(): void;
}

export function initHubPanelsController(deps: HubPanelsControllerDeps): HubPanelsController {
  let guestbookOpen = false;
  let currentOpenPost: HubPost | null = null;
  let addPostOpen = false;

  function openGuestbook() {
    const owner = deps.getCurrentHubOwner();
    if (!owner) return;
    guestbookOpen = true;
    deps.resetVelocity();
    deps.releasePointerForUI();

    deps.guestbookPanel.hidden = false;
    deps.guestbookPanel.setComments([]); // clear list or show loading

    api
      .getHub(owner)
      .then((hub) => {
        const guestbookPosts = hub.posts.filter((p) => p.type === 'guestbook') as Extract<
          HubPost,
          { type: 'guestbook' }
        >[];
        const isOwner = owner === deps.getMyName();
        deps.guestbookPanel.setOwnerView(isOwner, hub.allowVisitorPosts);
        if (isOwner) {
          deps.guestbookPanel.setVisitorView(false);
        } else {
          deps.guestbookPanel.setVisitorView(true, hub.allowVisitorPosts);
        }
        deps.guestbookPanel.setComments(guestbookPosts);
      })
      .catch((err) => {
        log('error', `Failed to load guestbook for ${owner}: ${err}`);
      });
  }

  function closeGuestbook() {
    guestbookOpen = false;
    deps.guestbookPanel.hidden = true;
    log('info', 'guestbook panel closed');
  }

  function openPost(post: HubPost) {
    currentOpenPost = post;
    deps.postPanel.show(post);
    deps.postPanel.hidden = false;
    deps.resetVelocity();
    deps.releasePointerForUI();
    log('info', `post panel opened: ${post.type}/${post.id}`);
  }

  function closePost() {
    currentOpenPost = null;
    deps.postPanel.hidden = true;
    log('info', 'post panel closed');
  }

  function openAddPost() {
    addPostOpen = true;
    deps.resetKeys();
    deps.addPostPanel.open();
    deps.addPostPanel.hidden = false;
    deps.releasePointerForUI();
  }

  function closeAddPost() {
    addPostOpen = false;
    deps.addPostPanel.hidden = true;
  }

  // Set up guestbook event listeners
  deps.guestbookPanel.addEventListener(GUESTBOOK_SUBMIT, ((
    e: CustomEvent<GuestbookSubmitDetail>
  ) => {
    const { message } = e.detail;
    const owner = deps.getCurrentHubOwner();
    const myName = deps.getMyName();
    if (!message || !owner || !myName) return;

    api
      .addPost(owner, {
        type: 'guestbook',
        author: myName,
        message,
        isGm: true,
      })
      .then(() => {
        deps.guestbookPanel.clearInput();
        openGuestbook();
        return deps.rebuildHub(owner);
      })
      .catch((err) => {
        log('error', `Failed to submit guest message: ${err}`);
      });
  }) as EventListener);

  deps.guestbookPanel.addEventListener(GUESTBOOK_REACT, ((e: CustomEvent<GuestbookReactDetail>) => {
    const { postId, emoji } = e.detail;
    api
      .reactToPost(postId, emoji)
      .then((res) => {
        if (res.success) {
          deps.guestbookPanel.bumpReaction(postId, emoji);
        }
      })
      .catch((err) => {
        log('error', `Failed to react to post ${postId}: ${err}`);
      });
  }) as EventListener);

  deps.guestbookPanel.addEventListener(GUESTBOOK_ALLOW_TOGGLE, ((
    e: CustomEvent<GuestbookAllowToggleDetail>
  ) => {
    const owner = deps.getCurrentHubOwner();
    if (!owner || owner !== deps.getMyName()) return;
    const allowed = e.detail.allowed;

    api
      .updateHubSettings(owner, allowed)
      .then((res) => {
        if (res.success) {
          log('info', `Hub settings updated: allow_visitor_posts = ${allowed}`);
        }
      })
      .catch((err) => {
        log('error', `Failed to update hub settings: ${err}`);
      });
  }) as EventListener);

  deps.guestbookPanel.addEventListener(PANEL_CLOSE, () => {
    closeGuestbook();
    deps.resumeAfterUI();
  });

  // Set up post panel event listeners
  deps.postPanel.addEventListener(PANEL_CLOSE, () => {
    closePost();
    deps.resumeAfterUI();
  });

  // Set up add post panel event listeners
  deps.addPostPanel.addEventListener(POST_SUBMIT, ((e: CustomEvent<PostSubmitDetail>) => {
    const { title, body } = e.detail;
    const owner = deps.getCurrentHubOwner();
    if (!title || !body || !owner) return;

    api
      .addPost(owner, { type: 'text', title, body })
      .then(() => deps.rebuildHub(owner))
      .then(() => {
        log('info', `post added to hub "${owner}": "${title}"`);
        closeAddPost();
        deps.resumeAfterUI();
      })
      .catch((err) => {
        log('error', `failed to add post: ${err}`);
      });
  }) as EventListener);

  deps.addPostPanel.addEventListener(PANEL_CLOSE, () => {
    closeAddPost();
    deps.resumeAfterUI();
  });

  return {
    get isGuestbookOpen() {
      return guestbookOpen;
    },
    get isPostOpen() {
      return currentOpenPost !== null;
    },
    get isAddPostOpen() {
      return addPostOpen;
    },
    openGuestbook,
    closeGuestbook,
    openPost,
    closePost,
    openAddPost,
    closeAddPost,
  };
}
