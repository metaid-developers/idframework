import test from 'node:test';
import assert from 'node:assert/strict';

function createDocumentStub() {
  return {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    createElement() {
      return {
        _text: '',
        set textContent(value) {
          this._text = value == null ? '' : String(value);
        },
        get innerHTML() {
          return this._text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        },
      };
    },
  };
}

function setupEnv() {
  const registry = new Map();

  class MockHTMLElement {
    constructor() {
      this.shadowRoot = null;
    }

    addEventListener() {}
    removeEventListener() {}

    attachShadow() {
      this.shadowRoot = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      return this.shadowRoot;
    }
  }

  globalThis.HTMLElement = MockHTMLElement;
  globalThis.customElements = {
    define(name, klass) {
      registry.set(name, klass);
    },
    get(name) {
      return registry.get(name);
    },
  };

  globalThis.document = createDocumentStub();
  globalThis.Alpine = {
    store() {
      return null;
    },
  };
  globalThis.requestAnimationFrame = (fn) => {
    if (typeof fn === 'function') fn();
    return 1;
  };

  return registry;
}

test('id-chat-groupmsg-list routes mention click to private conversation selection', async () => {
  const registry = setupEnv();
  const dispatchCalls = [];
  globalThis.window = {
    IDFramework: {
      dispatch: async (eventName, payload) => {
        dispatchCalls.push({ eventName, payload });
      },
    },
  };

  await import('../idframework/components/id-chat-groupmsg-list.js?case=mention-route');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  await instance._handleBubbleMentionClick({
    detail: {
      globalMetaId: 'peer_global_metaid',
    },
  });

  assert.equal(dispatchCalls.length, 1);
  assert.equal(dispatchCalls[0].eventName, 'selectConversation');
  assert.equal(dispatchCalls[0].payload.metaid, 'peer_global_metaid');
  assert.equal(dispatchCalls[0].payload.type, '2');
});

test('id-chat-groupmsg-list can disable mention navigation via attribute', async () => {
  const registry = setupEnv();
  const dispatchCalls = [];
  globalThis.window = {
    IDFramework: {
      dispatch: async (eventName, payload) => {
        dispatchCalls.push({ eventName, payload });
      },
    },
  };

  await import('../idframework/components/id-chat-groupmsg-list.js?case=mention-route-disabled');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();
  instance.getAttribute = (name) => (name === 'disable-mention-navigation' ? 'true' : null);

  await instance._handleBubbleMentionClick({
    detail: {
      globalMetaId: 'peer_global_metaid',
    },
  });

  assert.equal(dispatchCalls.length, 0);
});

test('id-chat-groupmsg-list highlights replied target message when jumping to index', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=reply-jump-highlight');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const classListOps = [];
  const target = {
    classList: {
      add(name) {
        classListOps.push(['add', name]);
      },
      remove(name) {
        classListOps.push(['remove', name]);
      },
    },
    scrollIntoView() {},
  };

  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '[data-msg-index="12"]') return target;
    return null;
  };

  instance._handleBubbleToTimestamp({
    detail: {
      index: 12,
    },
  });

  assert.equal(classListOps[0][0], 'add');
  assert.equal(classListOps[0][1], 'jump-highlight');
});

test('id-chat-groupmsg-list keeps pending scroll restore until older data is merged', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=pending-restore-gate');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 42,
    scrollHeight: 640,
    clientHeight: 320,
    querySelector: () => null,
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._pendingScrollRestore = {
    conversation: 'group_1',
    top: 42,
    height: 640,
    oldestIndex: 100,
    messageCount: 5,
    anchorIndex: '100',
    anchorOffset: 12,
  };

  const snapshot = {
    currentConversation: 'group_1',
    messages: [{ index: 100 }, { index: 101 }, { index: 102 }, { index: 103 }, { index: 104 }],
  };

  instance._postRenderScrollAdjust(snapshot, { nearBottom: false }, 'group_1', 104);

  assert.ok(instance._pendingScrollRestore, 'pending restore should stay until data window changes');
  assert.equal(container.scrollTop, 42);
});

test('id-chat-groupmsg-list ignores stale pending restore when only a newer tail message is appended', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=ignore-stale-pending-on-tail-append');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 42,
    scrollHeight: 640,
    clientHeight: 320,
    querySelector: () => null,
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._pendingScrollRestore = {
    conversation: 'group_1',
    top: 42,
    height: 640,
    oldestIndex: 100,
    messageCount: 5,
    anchorIndex: '100',
    anchorOffset: 12,
  };

  let scrollToBottomCalls = 0;
  instance._scrollToBottom = () => {
    scrollToBottomCalls += 1;
  };

  const snapshot = {
    currentConversation: 'group_1',
    messages: [{ index: 100 }, { index: 101 }, { index: 102 }, { index: 103 }, { index: 104 }, { index: 105 }],
  };

  instance._postRenderScrollAdjust(snapshot, { top: 500, nearBottom: true }, 'group_1', 104, 100);

  assert.equal(instance._pendingScrollRestore, null, 'stale restore should be cleared when window only grows at the tail');
  assert.equal(scrollToBottomCalls, 1, 'tail append near bottom should fall through to normal bottom stick behavior');
  assert.equal(container.scrollTop, 42, 'stale restore should not reset scroll position');
});

test('id-chat-groupmsg-list preserves scrollTop on cosmetic rerender when message window is unchanged', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=preserve-on-cosmetic-rerender');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 0,
    scrollHeight: 1200,
    clientHeight: 320,
    querySelector: () => null,
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._lastMessageCount = 4;
  instance._lastOldestIndex = 100;

  const snapshot = {
    currentConversation: 'group_1',
    messages: [{ index: 100 }, { index: 101 }, { index: 102 }, { index: 103 }],
  };

  instance._postRenderScrollAdjust(
    snapshot,
    { top: 420, nearBottom: false },
    'group_1',
    103,
    100
  );

  assert.equal(container.scrollTop, 420, 'rerender with unchanged message window should keep previous visual position');
});

test('id-chat-groupmsg-list clears pending restore after older-load attempt makes no progress', async () => {
  const registry = setupEnv();
  let phase = 0;
  globalThis.window = {
    IDFramework: {
      dispatch: async () => {
        phase = 1;
      },
    },
  };

  await import('../idframework/components/id-chat-groupmsg-list.js?case=clear-pending-after-no-progress-load');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 18,
    scrollHeight: 1200,
    clientHeight: 320,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0 }),
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._handleChatUpdated = () => {};
  instance._snapshot = () => (
    phase === 0
      ? {
          currentConversation: 'group_1',
          conversationType: '1',
          messages: [{ index: 100 }, { index: 101 }, { index: 102 }, { index: 103 }, { index: 104 }],
          selfGlobalMetaId: '',
        }
      : {
          currentConversation: 'group_1',
          conversationType: '1',
          messages: [{ index: 100 }, { index: 101 }, { index: 102 }, { index: 103 }, { index: 104 }],
          selfGlobalMetaId: '',
        }
  );

  await instance._loadOlderMessages();

  assert.equal(instance._pendingScrollRestore, null, 'no-progress load should not leave stale restore state behind');
});

test('id-chat-groupmsg-list uses recent restore anchor to refine cosmetic rerender position', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=preserve-refine-by-anchor');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const anchorNode = { offsetTop: 1520 };
  const container = {
    scrollTop: 0,
    scrollHeight: 1200,
    clientHeight: 320,
    querySelector: (selector) => (selector === '[data-msg-key="pin:abc"]' ? anchorNode : null),
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._lastMessageCount = 10;
  instance._lastOldestIndex = 100;
  instance._recentRestoreAnchor = {
    conversation: 'group_1',
    anchorKey: 'pin:abc',
    anchorIndex: '',
    anchorOffset: 8,
    top: 1512,
    mode: 'delta',
    appliedAt: Date.now(),
  };

  const snapshot = {
    currentConversation: 'group_1',
    messages: Array.from({ length: 10 }, (_, i) => ({ index: 100 + i })),
  };

  instance._postRenderScrollAdjust(
    snapshot,
    { top: 1660, nearBottom: false },
    'group_1',
    109,
    100
  );

  assert.equal(container.scrollTop, 1512, 'should pull back to recent restore anchor when cosmetic rerender drifts down');
});

test('id-chat-groupmsg-list allows slight cosmetic drift to avoid jitter after restore', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=preserve-allow-small-drift');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 0,
    scrollHeight: 1200,
    clientHeight: 320,
    querySelector: () => null,
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._lastMessageCount = 10;
  instance._lastOldestIndex = 100;
  instance._recentRestoreAnchor = {
    conversation: 'group_1',
    anchorKey: '',
    anchorIndex: '',
    anchorOffset: 0,
    top: 1512,
    mode: 'delta',
    appliedAt: Date.now(),
  };

  const snapshot = {
    currentConversation: 'group_1',
    messages: Array.from({ length: 10 }, (_, i) => ({ index: 100 + i })),
  };

  instance._postRenderScrollAdjust(
    snapshot,
    { top: 1520, nearBottom: false },
    'group_1',
    109,
    100
  );

  assert.equal(container.scrollTop, 1520, 'small downward shift should be preserved to avoid visual jitter');
});

test('id-chat-groupmsg-list stabilizer clamps downward rebound after restore without user down intent', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=stabilize-downward-rebound');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = { scrollTop: 1839.5 };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._lastConversation = 'group_1';
  instance._postRestoreStabilizer = {
    conversation: 'group_1',
    top: 1676,
    armedAt: Date.now(),
    until: Date.now() + 600,
  };
  instance._lastDownwardIntentAt = 0;
  instance._lastScrollTop = 0;

  instance._handleScroll();

  assert.equal(container.scrollTop, 1676, 'should clamp rebound drift back to restored top');
});

test('id-chat-groupmsg-list stabilizer respects recent downward intent', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=stabilize-respect-down-intent');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = { scrollTop: 1839.5 };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._lastConversation = 'group_1';
  instance._postRestoreStabilizer = {
    conversation: 'group_1',
    top: 1676,
    armedAt: Date.now(),
    until: Date.now() + 600,
  };
  instance._lastDownwardIntentAt = Date.now();
  instance._lastScrollTop = 0;

  instance._handleScroll();

  assert.equal(container.scrollTop, 1839.5, 'recent explicit downward gesture should not be overridden');
});

test('id-chat-groupmsg-list restores scroll by anchor when older page is prepended', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=restore-anchor');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const anchorNode = { offsetTop: 360 };
  const container = {
    scrollTop: 50,
    scrollHeight: 920,
    clientHeight: 320,
    querySelector: (selector) => (selector === '[data-msg-index="102"]' ? anchorNode : null),
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._pendingScrollRestore = {
    conversation: 'group_1',
    top: 50,
    height: 920,
    oldestIndex: 100,
    messageCount: 5,
    anchorIndex: '102',
    anchorOffset: 24,
  };

  const snapshot = {
    currentConversation: 'group_1',
    messages: [{ index: 80 }, { index: 81 }, { index: 82 }, { index: 102 }, { index: 103 }, { index: 104 }],
  };

  instance._postRenderScrollAdjust(snapshot, { nearBottom: false }, 'group_1', 104);

  assert.equal(instance._pendingScrollRestore, null);
  assert.equal(container.scrollTop, 336);
});

test('id-chat-groupmsg-list restores by anchor key before index to avoid wrong duplicate index match', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=restore-anchor-key-first');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const wrongIndexNode = { offsetTop: 10 };
  const rightKeyNode = { offsetTop: 360 };
  const container = {
    scrollTop: 50,
    scrollHeight: 920,
    clientHeight: 320,
    querySelector: (selector) => {
      if (selector === '[data-msg-key="pin:abc"]') return rightKeyNode;
      if (selector === '[data-msg-index="102"]') return wrongIndexNode;
      return null;
    },
  };

  instance._restoreScrollPosition(container, {
    top: 50,
    height: 920,
    anchorIndex: '102',
    anchorKey: 'pin:abc',
    anchorOffset: 24,
  });

  assert.equal(container.scrollTop, 336);
});

test('id-chat-groupmsg-list falls back to delta restore when anchor candidate is negative', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=restore-anchor-negative-fallback');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const anchorNode = { offsetTop: 10 };
  const container = {
    scrollTop: 50,
    scrollHeight: 1200,
    clientHeight: 320,
    querySelector: (selector) => (selector === '[data-msg-index="102"]' ? anchorNode : null),
  };

  instance._restoreScrollPosition(container, {
    top: 50,
    height: 900,
    anchorIndex: '102',
    anchorOffset: 24,
  });

  assert.equal(container.scrollTop, 350, 'should use delta fallback when anchor candidate is negative');
});

test('id-chat-groupmsg-list falls back to delta restore when anchor candidate is implausibly far from expected delta', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=restore-anchor-implausible-fallback');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const wrongAnchorNode = { offsetTop: 24 }; // candidateTop => 0
  const container = {
    scrollTop: 50,
    scrollHeight: 1200, // delta = +300
    clientHeight: 320,
    querySelector: (selector) => {
      if (selector === '[data-msg-index="102"]') return wrongAnchorNode;
      return null;
    },
  };

  instance._restoreScrollPosition(container, {
    top: 50,
    height: 900,
    anchorIndex: '102',
    anchorOffset: 24,
  });

  assert.equal(container.scrollTop, 350, 'should trust delta restore when index anchor candidate is implausible');
});

test('id-chat-groupmsg-list prefers key anchor even when delta-based expectation differs', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=restore-anchor-key-preferred-over-delta');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const keyAnchorNode = { offsetTop: 2024 }; // candidateTop => 2000
  const container = {
    scrollTop: 50,
    scrollHeight: 1200, // delta = +300 => expectedTop = 350
    clientHeight: 320,
    querySelector: (selector) => {
      if (selector === '[data-msg-key="pin:abc"]') return keyAnchorNode;
      return null;
    },
  };

  instance._restoreScrollPosition(container, {
    top: 50,
    height: 900,
    anchorKey: 'pin:abc',
    anchorOffset: 24,
  });

  assert.equal(container.scrollTop, 2000, 'key anchor should win over unreliable delta expectation');
});

test('id-chat-groupmsg-list wheel-up at top triggers loading older messages', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=wheel-trigger');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = { scrollTop: 0 };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  let calls = 0;
  instance._loadOlderMessages = async () => { calls += 1; };

  instance._nextAllowedLoadAt = 0;
  instance._topEdgeArmed = true;
  instance._handleWheel({ deltaY: -40 });
  instance._handleWheel({ deltaY: 20 });

  assert.equal(calls, 1);
});

test('id-chat-groupmsg-list scroll movement only re-arms edge trigger and does not load directly', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=scroll-arm-only');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = { scrollTop: 10 };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  let calls = 0;
  instance._requestOlderLoad = () => { calls += 1; };
  instance._nextAllowedLoadAt = 0;
  instance._isLoadingOlder = false;
  instance._topEdgeArmed = false;
  instance._lastScrollTop = 20;

  container.scrollTop = 180;
  instance._handleScroll();
  assert.equal(calls, 0, 'scroll should not load older messages directly');
  assert.equal(instance._topEdgeArmed, true, 'leaving top area should re-arm trigger');

  container.scrollTop = 6;
  instance._lastScrollTop = 180;
  instance._handleScroll();
  assert.equal(calls, 0, 'scroll-only top movement should remain non-triggering');
});

test('id-chat-groupmsg-list should not trigger older load from scroll-only events without wheel/touch intent', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=scroll-requires-intent');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = { scrollTop: 4 };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  let calls = 0;
  instance._requestOlderLoad = () => { calls += 1; };
  instance._nextAllowedLoadAt = 0;
  instance._isLoadingOlder = false;
  instance._topEdgeArmed = true;
  instance._lastScrollTop = 60;

  instance._handleScroll();
  assert.equal(calls, 0, 'scroll-only movement at top should not trigger load');
});

test('id-chat-groupmsg-list should only trigger one older load per wheel gesture', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=wheel-one-load-per-gesture');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = { scrollTop: 0 };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  let calls = 0;
  instance._loadOlderMessages = async () => { calls += 1; };
  instance._isLoadingOlder = false;
  instance._nextAllowedLoadAt = 0;
  instance._topEdgeArmed = true;

  const realNow = Date.now;
  let fakeNow = 1_700_000_000_000;
  Date.now = () => fakeNow;

  try {
    instance._handleWheel({ deltaY: -40 });
    assert.equal(calls, 1, 'first upward wheel at top should trigger load');

    instance._isLoadingOlder = false;
    instance._nextAllowedLoadAt = 0;
    container.scrollTop = 160;
    instance._lastScrollTop = 0;
    instance._handleScroll(); // re-arm by leaving top area
    container.scrollTop = 0;
    fakeNow += 80; // within same gesture gap
    instance._handleWheel({ deltaY: -20 });
    assert.equal(calls, 1, 'same wheel gesture should not trigger again');

    instance._isLoadingOlder = false;
    instance._nextAllowedLoadAt = 0;
    container.scrollTop = 160;
    instance._lastScrollTop = 0;
    instance._handleScroll(); // re-arm for next intent
    fakeNow += 500; // new gesture
    instance._handleWheel({ deltaY: -20 });
    container.scrollTop = 0;
    instance._lastScrollTop = 160;
    instance._handleScroll();
    instance._isLoadingOlder = false;
    instance._nextAllowedLoadAt = 0;
    instance._topEdgeArmed = true;
    instance._handleWheel({ deltaY: -20 });
    assert.equal(calls, 2, 'new wheel gesture should allow next load');
  } finally {
    Date.now = realNow;
  }
});

test('id-chat-groupmsg-list re-arms top edge after successful older load when still near top', async () => {
  const registry = setupEnv();
  globalThis.window = {
    IDFramework: {
      dispatch: async () => {},
    },
  };

  await import('../idframework/components/id-chat-groupmsg-list.js?case=rearm-after-load-at-top');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 0,
    scrollHeight: 900,
    clientHeight: 320,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0 }),
    querySelector: () => null,
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._topEdgeArmed = false;
  instance._lastLoadedGestureToken = 'wheel:8';
  instance._handleChatUpdated = () => {};

  let snapCount = 0;
  instance._snapshot = () => {
    snapCount += 1;
    if (snapCount === 1) {
      return {
        currentConversation: 'group_1',
        conversationType: '1',
        messages: [{ index: 100 }, { index: 101 }],
        selfGlobalMetaId: 'self',
      };
    }
    return {
      currentConversation: 'group_1',
      conversationType: '1',
      messages: [{ index: 80 }, { index: 81 }, { index: 100 }, { index: 101 }],
      selfGlobalMetaId: 'self',
    };
  };

  await instance._loadOlderMessages();
  assert.equal(instance._topEdgeArmed, true, 'successful load near top should re-arm for next gesture');
});

test('id-chat-groupmsg-list conversation switch always forces list to bottom', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=conversation-switch-force-bottom');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 420,
    scrollHeight: 2400,
    clientHeight: 640,
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  let bottomCalls = 0;
  instance._scrollToBottom = () => { bottomCalls += 1; };
  instance._syncScrollToBottomButton = () => {};

  instance._postRenderScrollAdjust(
    {
      currentConversation: 'group_a',
      messages: [{ index: 1 }, { index: 2 }, { index: 3 }],
    },
    { top: 420, nearBottom: false },
    'group_b',
    123,
    100
  );

  assert.equal(bottomCalls, 1, 'switching back to a conversation should not keep old scroll position');
});

test('id-chat-groupmsg-list conversation switch arms one-time force-bottom after bubble hydration', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=conversation-switch-arm-force-bottom-after-hydrate');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 320,
    scrollHeight: 2200,
    clientHeight: 640,
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._syncScrollToBottomButton = () => {};
  instance._scrollToBottom = () => {};

  instance._postRenderScrollAdjust(
    {
      currentConversation: 'group_a',
      messages: [{ index: 1 }, { index: 2 }, { index: 3 }],
    },
    { top: 320, nearBottom: false },
    'group_b',
    123,
    100
  );

  assert.equal(
    instance._pendingForceBottomConversation,
    'group_a',
    'conversation switch should arm one-time force-bottom after async bubble hydration'
  );
});

test('id-chat-groupmsg-list reapplies bottom after bubble hydration when switch-force flag is armed', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=force-bottom-after-hydrate');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const bubbles = [{}, {}];
  instance.shadowRoot.querySelectorAll = (selector) => {
    if (selector === 'id-chat-bubble') return bubbles;
    return [];
  };

  let bottomCalls = 0;
  instance._scrollToBottom = () => { bottomCalls += 1; };
  instance._pendingForceBottomConversation = 'group_1';

  instance._hydrateBubbles({
    currentConversation: 'group_1',
    conversationType: '1',
    messages: [{ index: 101 }, { index: 102 }],
    selfGlobalMetaId: 'self_global',
    selfMetaId: 'self_meta',
  });

  assert.equal(bottomCalls, 1, 'bubble hydration should re-apply bottom for freshly switched conversation');
  assert.equal(instance._pendingForceBottomConversation, '', 'force-bottom flag should be consumed after hydration');
});

test('id-chat-groupmsg-list scroll-to-bottom button visibility follows distance from bottom', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=scroll-bottom-button-visibility');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const button = { hidden: true };
  const container = {
    scrollTop: 120,
    scrollHeight: 2600,
    clientHeight: 600,
  };
  instance._snapshot = () => ({
    currentConversation: 'group_1',
    messages: [{ index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }],
  });
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    if (selector === '.scroll-to-bottom-button') return button;
    return null;
  };

  instance._syncScrollToBottomButton(container);
  assert.equal(instance._showScrollToBottomButton, true, 'button should be visible when user is far above bottom');
  assert.equal(button.hidden, false, 'button should unhide when far from bottom');

  container.scrollTop = 2010; // near bottom (distance = -10 => clamped 0)
  instance._syncScrollToBottomButton(container);
  assert.equal(instance._showScrollToBottomButton, false, 'button should hide near bottom');
  assert.equal(button.hidden, true, 'button should hide near bottom');
});

test('id-chat-groupmsg-list scroll-to-bottom button click jumps to bottom', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=scroll-bottom-button-click');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  let bottomCalls = 0;
  instance._scrollToBottom = () => { bottomCalls += 1; };

  instance._handleScrollToBottomClick({
    preventDefault() {},
  });

  assert.equal(bottomCalls, 1, 'clicking the floating button should jump to latest message');
});

test('id-chat-groupmsg-list initial chat update scrolls to bottom for current conversation', async () => {
  const registry = setupEnv();
  globalThis.window = {};
  globalThis.Alpine = {
    store(name) {
      if (name === 'chat') {
        return {
          currentConversation: 'group_1',
          currentConversationType: '1',
          messages: {
            group_1: [{ index: 101 }, { index: 102 }],
          },
          isLoading: false,
          error: '',
        };
      }
      if (name === 'wallet') return { globalMetaId: 'self_global' };
      if (name === 'user') return { user: { metaid: 'self_metaid' } };
      return null;
    },
  };

  await import('../idframework/components/id-chat-groupmsg-list.js?case=initial-scroll-bottom');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  let bottomCalls = 0;
  const container = { scrollTop: 0, scrollHeight: 1200 };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };
  instance._scrollToBottom = () => { bottomCalls += 1; };
  instance._bindScroll = () => {};
  instance._cryptoReady = true;

  instance._lastConversation = '';
  instance._lastSignature = '';
  instance._handleChatUpdated();

  assert.equal(bottomCalls, 1, 'first meaningful update for active conversation should scroll to bottom');
});

test('id-chat-groupmsg-list keeps forcing bottom while switch-force flag is armed (skip unchanged-window preserve)', async () => {
  const registry = setupEnv();
  globalThis.window = {};

  await import('../idframework/components/id-chat-groupmsg-list.js?case=force-bottom-pending-skip-preserve');
  const IdChatGroupmsgList = registry.get('id-chat-groupmsg-list');
  const instance = new IdChatGroupmsgList();

  const container = {
    scrollTop: 0,
    scrollHeight: 2400,
    clientHeight: 640,
    querySelector: () => null,
  };
  instance.shadowRoot.querySelector = (selector) => {
    if (selector === '.messages-container') return container;
    return null;
  };

  instance._pendingForceBottomConversation = 'group_1';
  instance._lastMessageCount = 10;
  instance._lastOldestIndex = 100;

  let bottomCalls = 0;
  instance._scrollToBottom = () => { bottomCalls += 1; };
  instance._syncScrollToBottomButton = () => {};

  instance._postRenderScrollAdjust(
    {
      currentConversation: 'group_1',
      messages: Array.from({ length: 10 }, (_, i) => ({ index: 100 + i })),
    },
    { top: 0, nearBottom: false },
    'group_1',
    109,
    100
  );

  assert.equal(bottomCalls, 1, 'armed switch-force should keep driving list to bottom');
  assert.equal(instance._postRestoreStabilizer, null, 'force-bottom path should not arm preserve stabilizer');
});
