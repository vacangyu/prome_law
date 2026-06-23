const ORIGINAL_FILE = "동아리 회칙 원본.md";
const REVISED_FILE = "동아리 회칙 062326 개정본.md";
const STORAGE_KEY = "prome-law-diff-state-v1";
const AUTHOR_STORAGE_KEY = "prome-law-selected-author-v1";
const APP_CONFIG = window.PROME_LAW_CONFIG || {};
const APP_MODE = APP_CONFIG.mode || (window.location.pathname.startsWith("/edit/") ? "edit" : (window.location.pathname.startsWith("/present") ? "present" : "viewer"));
const IS_EDIT_MODE = APP_MODE === "edit";
const IS_PRESENT_MODE = APP_MODE === "present";
const EDIT_TOKEN = APP_CONFIG.editToken || (IS_EDIT_MODE ? decodeURIComponent(window.location.pathname.split("/").filter(Boolean)[1] || "") : "");
const REALTIME_ENABLED = APP_CONFIG.realtime !== false;
const TITLE_ORIGINAL_ID = "original-title";
const TITLE_REVISED_ID = "revised-title";
const PATCH_TYPES = ["수정", "신설", "삭제"];
const PATCH_LEVELS = ["0단계", "1단계", "2단계", "3단계", "4단계", "5단계", "N단계"];
const CIRCLED_INSERT_MARKERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];
const NOTE_KINDS = ["개정이유", "댓글"];
const NOTE_LEVELS = ["0단계", "1단계", "2단계", "3단계", "4단계", "5단계"];
const NOTE_AUTHORS = ["박찬미", "남홍석", "박광규", "신재성", "이지원", "최윤용", "한태연"];
const NOTE_LEVEL_META = {
  "0단계": {
    name: "정리·편집",
    criteria: "실질 의미 변화가 없고 회칙을 읽기 좋게 정돈한 변경",
    reasons: ["오탈자 수정", "띄어쓰기·문장부호 수정", "구어적 표현 수정", "조항 번호 변경", "조항 재배치", "조항 통합", "조항 분리", "마크다운 형식 정리"],
  },
  "1단계": {
    name: "용어·표현 명확화",
    criteria: "의미는 거의 같지만 표현·제목·개념의 정확도를 높인 변경",
    reasons: ["단어 재정립", "조제목 수정", "주체 명칭 통일", "문장 구조 명확화", "포괄 표현 구체화", "중복 표현 정리", "법적 표현 정교화"],
  },
  "2단계": {
    name: "현행화·관행 반영",
    criteria: "이미 그렇게 운영되고 있거나, 과거 조항을 정리해도 회원 생활은 거의 바뀌지 않는 변경",
    reasons: ["한시 조항 삭제", "과거 상황 정리", "현행 관행 반영", "외부 규정 최신화", "사실관계 추가", "행사명·활동명 최신화", "운영 용어 최신화"],
  },
  "3단계": {
    name: "절차 보완",
    criteria: "기존 회칙의 빈틈을 민주적·상식적 원칙에 따라 메운 변경",
    reasons: ["이의제기 후속 절차 명시", "공고·고지 기간 명확화", "효력 발생 시점 명확화", "임기 시작·종료 기준 명확화", "궐위 시 절차 보완", "인수인계 절차 보완", "흠결 발생 시 처리 기준 명시"],
  },
  "4단계": {
    name: "제한적 실질 변경",
    criteria: "특정 회원군, 특정 활동, 특정 절차에 실질적 영향을 주며 가치판단이 들어간 변경",
    reasons: ["특정 회원군 권리 확대", "특정 회원군 권리 제한", "후보·임명 자격 변경", "활동 참여 자격 변경", "간사 자격 변경", "회비·특별회비 결정권 변경", "운영진 재량 범위 변경", "총회·운영 방식 변경"],
  },
  "5단계": {
    name: "중대 실질 변경",
    criteria: "다수 또는 전체 회원의 자격·권리·의무·활동 방식에 직접적이고 반복적인 영향을 주는 변경",
    reasons: ["회원 자격 체계 재설계", "자격 유지·탈퇴·휴면 자동처리 변경", "모든 활동 회원의 의무 변경", "핵심 활동 참여 구조 변경", "선거권·피선거권·의결권의 중대한 제한", "금전 부담의 중대한 변경", "징계·권리 박탈 등 중대한 불이익 신설"],
  },
};
const NOTE_LEVEL_REASONS = Object.fromEntries(
  Object.entries(NOTE_LEVEL_META).map(([level, meta]) => [level, meta.reasons]),
);
const DEFAULT_SPLIT_RATIO = 50;
const MIN_SPLIT_RATIO = 28;
const MAX_SPLIT_RATIO = 72;
const SNAP_MIN_SPLIT_RATIO = 47;
const SNAP_MAX_SPLIT_RATIO = 53;
const DEFAULT_LINE_HEIGHT_UNIT = 23;
const LINE_RESIZE_HIT_SLOP = 1.5;
const LINE_NUMBER_DRAG_THRESHOLD = 3;
const LINE_LINK_RESISTANCE_RADIUS = 40;
const LINE_LINK_DISSOLVE_START = 24;
const LINE_LINK_RESISTANCE = 0.45;
const MOBILE_BOND_LAYOUT_MAX_WIDTH = 768;

const state = {
  originalText: "",
  revisedText: "",
  originalDoc: null,
  revisedDoc: null,
  alignments: {},
  deletedRows: [],
  lineHeights: {},
  lineOffsets: {},
  lineBonds: [],
  selectedRevisedId: null,
  selectedType: "수정",
  selectedLevel: "N단계",
  filter: "all",
  allowDuplicate: false,
  draggedOriginalId: null,
  draggedAnnotationId: null,
  draggedAnnotationTargetId: null,
  draggedLineKey: null,
  splitRatio: DEFAULT_SPLIT_RATIO,
  editingRevisedId: null,
  editingDraft: "",
  editingSaving: false,
  annotations: [],
  annotationDefaults: {},
  deletedAnnotations: {},
  selectedAuthor: "",
  noteComposer: null,
  noteComposerOpening: null,
  noteComposerClosing: null,
  highlightPreviewNoteId: null,
  presentationIndex: 0,
  mobileBondLayout: false,
};

const els = {};
const dragPreview = {
  placeholder: null,
  height: 72,
};
const lineResize = {
  active: null,
};
const annotationBodyPointer = {
  active: false,
  moved: false,
  suppressClick: false,
  target: null,
  startX: 0,
  startY: 0,
};
const highlightSelectionStart = {
  lineKey: "",
  offset: 0,
  targetId: "",
};
const lineNumberDrag = {
  active: false,
  sourceLine: null,
  sourceNumber: null,
  sourceAnchor: null,
  overlay: null,
  ghost: null,
  connector: null,
  icon: null,
  pointerId: null,
  startX: 0,
  startY: 0,
};
const renderLineNumbers = {
  original: 0,
  revised: 0,
};
let lineBondLayoutFrame = 0;
let lineBondLayoutSaveTimer = 0;
let viewportGeometryFrame = 0;
let isApplyingRemoteState = false;
let remoteSaveTimer = 0;
let remoteSaveInFlight = false;
let remoteSavePending = false;
let remoteFetchInFlight = false;
let pendingRemoteRevision = 0;
let lastServerRevision = 0;
let eventSource = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  document.body.classList.toggle("is-edit-mode", IS_EDIT_MODE);
  document.body.classList.toggle("is-viewer-mode", !IS_EDIT_MODE && !IS_PRESENT_MODE);
  document.body.classList.toggle("is-present-mode", IS_PRESENT_MODE);
  document.body.classList.toggle("is-print-page", isPrintView());
  updatePageTitle();
  restoreDeviceAuthor();
  syncViewportGeometry();
  syncTopNavHeight();
  syncResponsiveLayoutMode();
  bindEvents();
  loadVersionInfo();
  renderChips();
  await loadDocuments();
  await restoreLocalState();
  if (!Object.keys(state.alignments).length) {
    runAutoMatch({ silent: true });
  }
  state.selectedRevisedId = state.selectedRevisedId || state.revisedDoc.articles[0]?.id || null;
  renderAll();
  connectRealtime();
  maybeAutoPrintViewer();
  if (!isPrintView()) showToast("회칙 파일을 읽었습니다.");
}

function updatePageTitle() {
  const title = IS_EDIT_MODE
    ? "프로메테우스 회칙 개정안 검토"
    : IS_PRESENT_MODE
      ? "프로메테우스 회칙 개정안"
      : "프로메테우스 회칙 개정안";
  document.title = title;
  document.querySelector(".brand-block h1").textContent = title;
}

function restoreDeviceAuthor() {
  try {
    const author = localStorage.getItem(AUTHOR_STORAGE_KEY) || "";
    state.selectedAuthor = NOTE_AUTHORS.includes(author) ? author : "";
  } catch {
    state.selectedAuthor = "";
  }
}

function persistDeviceAuthor(author) {
  if (!NOTE_AUTHORS.includes(author)) return;
  state.selectedAuthor = author;
  try {
    localStorage.setItem(AUTHOR_STORAGE_KEY, author);
  } catch {
    // Device preference persistence is best-effort.
  }
}

function cacheElements() {
  els.board = document.querySelector("#alignmentBoard");
  els.unassigned = document.querySelector("#unassignedOriginals");
  els.fileStatus = document.querySelector("#fileStatus");
  els.validationStatus = document.querySelector("#validationStatus");
  els.selectedArticleLabel = document.querySelector("#selectedArticleLabel");
  els.typeChips = document.querySelector("#typeChips");
  els.levelChips = document.querySelector("#levelChips");
  els.tagInput = document.querySelector("#tagInput");
  els.noteDescription = document.querySelector("#noteDescription");
  els.patchNoteList = document.querySelector("#patchNoteList");
  els.plusNoteList = document.querySelector("#plusNoteList");
  els.validationList = document.querySelector("#validationList");
  els.toast = document.querySelector("#toast");
  els.environmentInput = document.querySelector("#environmentInput");
  els.duplicateToggle = document.querySelector("#duplicateToggle");
  els.columnDivider = document.querySelector("#columnDivider");
  els.mobileMenuButton = document.querySelector("#mobileMenuButton");
  els.headerActions = document.querySelector("#headerActions");
  els.commitRef = document.querySelector("#commitRef");
}

function bindEvents() {
  window.addEventListener("resize", handleWindowResize);
  window.addEventListener("orientationchange", scheduleViewportGeometrySync);
  window.addEventListener("blur", cleanupTransientDragState);
  window.visualViewport?.addEventListener("resize", scheduleViewportGeometrySync);
  window.visualViewport?.addEventListener("scroll", scheduleViewportGeometrySync);
  bindColumnDividerEvents();
  document.addEventListener("pointermove", syncDesktopHighlightHoverPreview);
  if (IS_PRESENT_MODE) {
    document.addEventListener("keydown", handlePresentationKeydown);
    return;
  }
  if (!IS_EDIT_MODE) return;
  document.querySelector("#autoMatchButton")?.addEventListener("click", () => runAutoMatch());
  document.querySelector("#saveEnvButton")?.addEventListener("click", () => {
    setMobileHeaderMenuOpen(false);
    saveEnvironment();
  });
  document.querySelector("#loadEnvButton")?.addEventListener("click", () => {
    setMobileHeaderMenuOpen(false);
    els.environmentInput.click();
  });
  els.mobileMenuButton?.addEventListener("click", toggleMobileHeaderMenu);
  document.addEventListener("click", closeMobileHeaderMenuFromOutside);
  document.addEventListener("keydown", closeMobileHeaderMenuWithEscape);
  document.querySelector("#exportMdButton")?.addEventListener("click", exportRevisedMarkdown);
  document.querySelector("#printPdfButton")?.addEventListener("click", openViewerPrintPage);
  document.querySelector("#presentButton")?.addEventListener("click", openPresentationPage);
  document.querySelector("#addPatchNoteButton")?.addEventListener("click", addManualPatchNote);
  document.addEventListener("pointerdown", recordHighlightSelectionStart);
  document.addEventListener("mouseup", handleHighlightSelection);
  els.environmentInput.addEventListener("change", loadEnvironment);
  els.duplicateToggle?.addEventListener("change", (event) => {
    state.allowDuplicate = event.target.checked;
    persistLocalState();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => {
        item.className = item === button ? "category-tab-active" : "category-tab";
      });
      renderBoard();
    });
  });
}

function cleanupTransientDragState() {
  cleanupLineNumberPointerDrag();
  cleanupAnnotationDrag();
}

function handlePresentationKeydown(event) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    movePresentationSlide(-1);
  } else if (event.key === "ArrowRight" || event.key === " ") {
    event.preventDefault();
    movePresentationSlide(1);
  }
}

async function loadVersionInfo() {
  if (!IS_EDIT_MODE || !els.commitRef) return;
  try {
    const response = await fetch("/api/version", { cache: "no-store" });
    if (!response.ok) throw new Error("version unavailable");
    const version = await response.json();
    renderCommitRef(version);
  } catch {
    els.commitRef.hidden = false;
    els.commitRef.textContent = "last commit ref: 확인 불가";
  }
}

function renderCommitRef(version) {
  const ref = version.shortCommit || (version.commit ? String(version.commit).slice(0, 7) : "");
  const timeValue = version.pushedAt || version.committedAt || version.builtAt || version.serverStartedAt || "";
  const timeText = formatVersionTime(timeValue);
  const label = ref ? `last commit ref: ${ref}` : "last commit ref: unknown";
  els.commitRef.hidden = false;
  els.commitRef.textContent = timeText ? `${label} · ${timeText}` : label;
  els.commitRef.title = [
    version.commit ? `commit: ${version.commit}` : "",
    version.pushedAt ? `pushed: ${version.pushedAt}` : "",
    version.committedAt ? `committed: ${version.committedAt}` : "",
    version.builtAt ? `built: ${version.builtAt}` : "",
    version.serverStartedAt ? `server started: ${version.serverStartedAt}` : "",
    version.source ? `source: ${version.source}` : "",
  ].filter(Boolean).join("\n");
}

function formatVersionTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function openViewerPrintPage() {
  setMobileHeaderMenuOpen(false);
  window.open("/?print=1", "_blank", "noopener");
}

function openPresentationPage() {
  setMobileHeaderMenuOpen(false);
  window.open("/present", "_blank", "noopener");
}

function maybeAutoPrintViewer() {
  if (IS_EDIT_MODE || IS_PRESENT_MODE) return;
  if (!isPrintView()) return;
  window.setTimeout(() => window.print(), 450);
}

function isPrintView() {
  return new URLSearchParams(window.location.search).has("print");
}

function handleHighlightSelection() {
  const composer = state.noteComposer;
  if (!IS_EDIT_MODE || !composer?.highlightMode || composer.kind !== "개정이유" || !composer.editingId) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

  const panel = document.querySelector(`[data-note-panel="${CSS.escape(composer.targetId)}"]`);
  const row = panel?.closest(".alignment-row");
  if (!row || !row.contains(selection.anchorNode) || !row.contains(selection.focusNode)) return;

  const range = selection.getRangeAt(0);
  const highlights = getHighlightsFromRange(range, row);
  if (!highlights.length) return;

  const shouldErase = isSelectionStartingOnHighlight(row, composer);
  composer.highlights = shouldErase
    ? subtractStoredHighlights(composer.highlights || [], highlights, row)
    : mergeStoredHighlights([...(composer.highlights || []), ...highlights]);
  saveLiveNoteComposer();
  selection.removeAllRanges();
  resetHighlightSelectionStart();
  renderBoard();
}

function recordHighlightSelectionStart(event) {
  const composer = state.noteComposer;
  resetHighlightSelectionStart();
  if (!IS_EDIT_MODE || !composer?.highlightMode || composer.kind !== "개정이유" || !composer.editingId) return;
  if (event.button !== 0) return;

  const content = event.target?.closest?.(".law-line-content");
  const line = content?.closest?.(".law-line[data-line-key]");
  const row = line?.closest?.(".alignment-row");
  const panel = document.querySelector(`[data-note-panel="${CSS.escape(composer.targetId)}"]`);
  if (!content || !line || !row || panel?.closest(".alignment-row") !== row) return;

  highlightSelectionStart.lineKey = line.dataset.lineKey || "";
  highlightSelectionStart.offset = getCaretTextOffsetFromPoint(content, event.clientX, event.clientY);
  highlightSelectionStart.targetId = composer.editingId;
}

function resetHighlightSelectionStart() {
  highlightSelectionStart.lineKey = "";
  highlightSelectionStart.offset = 0;
  highlightSelectionStart.targetId = "";
}

function previewAnnotationHighlight(annotationId) {
  if (isDesktopHighlightPreviewMode()) return;
  if (!annotationId) return;
  setHighlightPreview(annotationId);
  const stopPreview = () => {
    clearHighlightPreview(annotationId);
    window.removeEventListener("pointerup", stopPreview);
    window.removeEventListener("pointercancel", stopPreview);
  };
  window.addEventListener("pointerup", stopPreview, { once: true });
  window.addEventListener("pointercancel", stopPreview, { once: true });
}

function setHighlightPreview(annotationId) {
  if (!annotationId || state.highlightPreviewNoteId === annotationId) return;
  state.highlightPreviewNoteId = annotationId;
  renderBoard();
}

function clearHighlightPreview(annotationId = "") {
  if (!state.highlightPreviewNoteId) return;
  if (annotationId && state.highlightPreviewNoteId !== annotationId) return;
  state.highlightPreviewNoteId = null;
  renderBoard();
}

function syncDesktopHighlightHoverPreview(event) {
  if (!isDesktopHighlightPreviewMode() || !state.highlightPreviewNoteId) return;
  const item = document.elementFromPoint(event.clientX, event.clientY)?.closest(".annotation-item");
  if (item?.dataset.annotationId === state.highlightPreviewNoteId) return;
  clearHighlightPreview();
}

function isDesktopHighlightPreviewMode() {
  return window.matchMedia("(min-width: 769px) and (hover: hover) and (pointer: fine)").matches;
}

function getHighlightsFromRange(range, row) {
  return [...row.querySelectorAll(".law-line[data-line-key] .law-line-content")]
    .filter((content) => range.intersectsNode(content))
    .map((content) => {
      const text = content.textContent || "";
      const start = content.contains(range.startContainer) ? getTextOffsetInElement(content, range.startContainer, range.startOffset) : 0;
      const end = content.contains(range.endContainer) ? getTextOffsetInElement(content, range.endContainer, range.endOffset) : text.length;
      const normalizedStart = Math.max(0, Math.min(start, end, text.length));
      const normalizedEnd = Math.max(0, Math.min(Math.max(start, end), text.length));
      return {
        lineKey: content.closest(".law-line").dataset.lineKey,
        start: normalizedStart,
        end: normalizedEnd,
        text: text.slice(normalizedStart, normalizedEnd).trim(),
      };
    })
    .filter((highlight) => highlight.text);
}

function getTextOffsetInElement(element, container, offset) {
  const range = document.createRange();
  range.selectNodeContents(element);
  try {
    range.setEnd(container, offset);
    return range.toString().length;
  } catch {
    return 0;
  }
}

function isSelectionStartingOnHighlight(row, composer) {
  if (highlightSelectionStart.targetId !== composer.editingId) return false;
  const lineKey = highlightSelectionStart.lineKey;
  const content = row.querySelector(`.law-line[data-line-key="${CSS.escape(lineKey)}"] .law-line-content`);
  if (!content || !lineKey) return false;

  const textLength = (content.textContent || "").length;
  if (!textLength) return false;

  const probeOffset = Math.min(Math.max(0, highlightSelectionStart.offset), textLength - 1);
  return normalizeNoteHighlights(composer.highlights).some((highlight) => {
    return highlight.lineKey === lineKey && highlight.start <= probeOffset && probeOffset < highlight.end;
  });
}

function getCaretTextOffsetFromPoint(element, x, y) {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position?.offsetNode && element.contains(position.offsetNode)) {
    return getTextOffsetInElement(element, position.offsetNode, position.offset);
  }

  const range = document.caretRangeFromPoint?.(x, y);
  if (range?.startContainer && element.contains(range.startContainer)) {
    return getTextOffsetInElement(element, range.startContainer, range.startOffset);
  }

  return 0;
}

function mergeStoredHighlights(highlights) {
  const byLine = new Map();
  normalizeNoteHighlights(highlights).forEach((highlight) => {
    const list = byLine.get(highlight.lineKey) || [];
    list.push(highlight);
    byLine.set(highlight.lineKey, list);
  });
  return [...byLine.entries()].flatMap(([lineKey, list]) => {
    return mergeHighlightRanges(list).map((highlight) => ({ ...highlight, lineKey }));
  });
}

function subtractStoredHighlights(storedHighlights, erasureHighlights, row) {
  const erasuresByLine = new Map();
  mergeStoredHighlights(erasureHighlights).forEach((highlight) => {
    const list = erasuresByLine.get(highlight.lineKey) || [];
    list.push(highlight);
    erasuresByLine.set(highlight.lineKey, list);
  });

  return normalizeNoteHighlights(storedHighlights).flatMap((highlight) => {
    const erasures = erasuresByLine.get(highlight.lineKey) || [];
    if (!erasures.length) return [highlight];

    const remaining = erasures.reduce((parts, erasure) => {
      return parts.flatMap((part) => {
        if (erasure.end <= part.start || erasure.start >= part.end) return [part];
        const nextParts = [];
        if (erasure.start > part.start) {
          nextParts.push({ start: part.start, end: Math.min(erasure.start, part.end) });
        }
        if (erasure.end < part.end) {
          nextParts.push({ start: Math.max(erasure.end, part.start), end: part.end });
        }
        return nextParts;
      });
    }, [{ start: highlight.start, end: highlight.end }]);

    const lineText = getRenderedLineText(row, highlight.lineKey);
    return remaining.map((part) => ({
      lineKey: highlight.lineKey,
      start: part.start,
      end: part.end,
      text: lineText.slice(part.start, part.end),
    }));
  });
}

function getRenderedLineText(row, lineKey) {
  if (!row || !lineKey) return "";
  return row.querySelector(`.law-line[data-line-key="${CSS.escape(lineKey)}"] .law-line-content`)?.textContent || "";
}

function toggleMobileHeaderMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  setMobileHeaderMenuOpen(!document.body.classList.contains("is-mobile-header-menu-open"));
}

function setMobileHeaderMenuOpen(isOpen) {
  document.body.classList.toggle("is-mobile-header-menu-open", isOpen);
  els.mobileMenuButton?.setAttribute("aria-expanded", String(isOpen));
  els.mobileMenuButton?.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
}

function closeMobileHeaderMenuFromOutside(event) {
  if (!document.body.classList.contains("is-mobile-header-menu-open")) return;
  if (event.target.closest(".top-nav")) return;
  setMobileHeaderMenuOpen(false);
}

function closeMobileHeaderMenuWithEscape(event) {
  if (event.key !== "Escape" || !document.body.classList.contains("is-mobile-header-menu-open")) return;
  setMobileHeaderMenuOpen(false);
  els.mobileMenuButton?.focus();
}

function handleWindowResize() {
  syncViewportGeometry();
  syncTopNavHeight();
  if (!isMobileBondLayoutViewport()) setMobileHeaderMenuOpen(false);
  if (syncResponsiveLayoutMode()) {
    renderBoard();
    return;
  }
  scheduleLineBondLayoutRefresh();
}

function scheduleViewportGeometrySync() {
  if (viewportGeometryFrame) return;
  viewportGeometryFrame = requestAnimationFrame(() => {
    viewportGeometryFrame = 0;
    syncViewportGeometry();
    syncTopNavHeight();
    scheduleLineBondLayoutRefresh({ persist: false });
  });
}

function syncViewportGeometry() {
  const offsetTop = window.visualViewport ? Math.max(0, window.visualViewport.offsetTop || 0) : 0;
  document.documentElement.style.setProperty("--visual-viewport-offset-top", `${Math.round(offsetTop)}px`);
}

function syncTopNavHeight() {
  const topNav = document.querySelector(".top-nav");
  if (!topNav) return;
  document.documentElement.style.setProperty("--top-nav-height", `${topNav.getBoundingClientRect().height}px`);
}

function syncResponsiveLayoutMode() {
  const nextMobileBondLayout = isMobileBondLayoutViewport();
  const didChange = state.mobileBondLayout !== nextMobileBondLayout;
  state.mobileBondLayout = nextMobileBondLayout;
  document.body.classList.toggle("is-mobile-bond-layout", nextMobileBondLayout);
  return didChange;
}

function isMobileBondLayoutViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_BOND_LAYOUT_MAX_WIDTH}px)`).matches;
}

function isMobileBondLayoutActive() {
  return state.mobileBondLayout || isMobileBondLayoutViewport();
}

function bindColumnDividerEvents() {
  if (!els.columnDivider) return;

  els.columnDivider.addEventListener("pointerdown", (event) => {
    if (!canResizeColumnsFromPoint(event.clientX, event.clientY)) return;
    event.preventDefault();
    document.body.classList.add("is-resizing-columns");
    updateSplitFromPointer(event.clientX);

    const handlePointerMove = (moveEvent) => updateSplitFromPointer(moveEvent.clientX);
    const stopResize = () => {
      document.body.classList.remove("is-resizing-columns");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      scheduleLineBondLayoutRefresh({ persist: true });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  });

  els.columnDivider.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowLeft") setSplitRatio(state.splitRatio - step, { persist: true });
    if (event.key === "ArrowRight") setSplitRatio(state.splitRatio + step, { persist: true });
    if (event.key === "Home") setSplitRatio(MIN_SPLIT_RATIO, { persist: true });
    if (event.key === "End") setSplitRatio(MAX_SPLIT_RATIO, { persist: true });
    scheduleLineBondLayoutRefresh({ persist: true });
  });
}

function canResizeColumnsFromPoint(clientX, clientY) {
  const elements = document.elementsFromPoint(clientX, clientY).filter((element) => element !== els.columnDivider);
  if (elements.some((element) => element.closest(".row-annotation-panel, .chapter-band, .between-row-drop-zone"))) {
    return false;
  }
  return elements.some((element) => element.closest(".article-slot"));
}

function updateSplitFromPointer(clientX) {
  const boardRect = els.board?.getBoundingClientRect();
  if (!boardRect?.width) return;
  const nextRatio = ((clientX - boardRect.left) / boardRect.width) * 100;
  setSplitRatio(nextRatio);
  scheduleLineBondLayoutRefresh({ persist: false });
}

function setSplitRatio(value, options = {}) {
  state.splitRatio = normalizeSplitRatio(value);
  document.documentElement.style.setProperty("--split-left", `${state.splitRatio}%`);
  els.columnDivider?.setAttribute("aria-valuenow", String(Math.round(state.splitRatio)));
  if (options.persist) persistLocalState();
}

function normalizeSplitRatio(value) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : DEFAULT_SPLIT_RATIO;
  const clampedValue = Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, safeValue));
  if (clampedValue >= SNAP_MIN_SPLIT_RATIO && clampedValue <= SNAP_MAX_SPLIT_RATIO) {
    return DEFAULT_SPLIT_RATIO;
  }
  return Math.round(clampedValue * 10) / 10;
}

async function loadDocuments() {
  if (REALTIME_ENABLED) {
    const payload = await fetchInitialDocumentPayload();
    if (payload && applyDocumentPayload(payload)) {
      updateFileStatus();
      return;
    }
  }
  state.originalText = await fetchTextFile(ORIGINAL_FILE);
  state.revisedText = await fetchTextFile(REVISED_FILE);
  state.originalDoc = parseDocument(state.originalText, "original");
  state.revisedDoc = parseDocument(state.revisedText, "revised");
  updateFileStatus();
}

async function fetchInitialDocumentPayload() {
  try {
    const response = await fetch("/api/state", {
      cache: "no-store",
      headers: getEditRequestHeaders(),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function updateFileStatus() {
  if (els.fileStatus) {
    els.fileStatus.textContent = `${state.originalDoc.articles.length}개 원본 조문 · ${state.revisedDoc.articles.length}개 개정 조문`;
  }
}

async function fetchTextFile(fileName) {
  const response = await fetch(`/${encodeURI(fileName)}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${fileName} 파일을 읽지 못했습니다.`);
  }
  return response.text();
}

function parseDocument(text, kind) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const articles = [];
  const patchNotes = [];
  const plusNotes = [];
  const title = parseDocumentTitle(lines);
  let currentArticle = null;
  let currentChapter = "";
  let pendingPatchNotes = [];
  let pendingPlusNotes = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const chapterMatch = line.match(/^##\s+(제\d+장\s+.+)$/);
    if (chapterMatch) {
      currentChapter = chapterMatch[1].trim();
      currentArticle = null;
      return;
    }

    const articleMatch = line.match(/^제(\d+)조\s*\(([^)]*)\)(.*)$/);
    if (articleMatch) {
      currentArticle = {
        id: `${kind}-article-${articleMatch[1]}`,
        number: Number(articleMatch[1]),
        label: `제${articleMatch[1]}조`,
        title: articleMatch[2].trim(),
        chapter: currentChapter,
        heading: line,
        startLine: lineNumber,
        endLine: lineNumber,
        contentLines: [line],
        patchNoteIds: [],
        plusNoteIds: [],
      };
      articles.push(currentArticle);
      pendingPatchNotes.forEach((note) => attachPatchNote(note, currentArticle));
      pendingPlusNotes.forEach((note) => attachPlusNote(note, currentArticle));
      pendingPatchNotes = [];
      pendingPlusNotes = [];
      return;
    }

    const patchNote = parsePatchLine(line, lineNumber);
    if (patchNote) {
      patchNotes.push(patchNote);
      if (currentArticle) {
        attachPatchNote(patchNote, currentArticle);
      } else {
        pendingPatchNotes.push(patchNote);
      }
      return;
    }

    const plusNote = parsePlusLine(line, lineNumber);
    if (plusNote) {
      plusNotes.push(plusNote);
      if (currentArticle) {
        attachPlusNote(plusNote, currentArticle);
      } else {
        pendingPlusNotes.push(plusNote);
      }
      return;
    }

    if (currentArticle) {
      currentArticle.contentLines.push(line);
      currentArticle.endLine = lineNumber;
    }
  });

  return {
    kind,
    lines,
    title,
    articles,
    patchNotes,
    plusNotes,
    hash: hashText(text),
  };
}

function parseDocumentTitle(lines) {
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex < 0) {
    return {
      text: "",
      sourceLine: 1,
    };
  }

  return {
    text: lines[titleIndex].replace(/^#\s+/, "").trim(),
    sourceLine: titleIndex + 1,
  };
}

function attachPatchNote(note, article) {
  note.targetId = article.id;
  article.patchNoteIds.push(note.id);
}

function attachPlusNote(note, article) {
  note.targetId = article.id;
  article.plusNoteIds.push(note.id);
}

function parsePatchLine(line, lineNumber) {
  const trimmed = line.trim();
  if (!trimmed.startsWith(">")) return null;
  const body = trimmed.replace(/^>\s*/, "");
  if (!body.startsWith("|")) return null;
  const parts = body.split("|").slice(1).map((part) => part.trim());
  const type = PATCH_TYPES.includes(parts[0]) ? parts[0] : "수정";
  let level = "N단계";
  let missingLevel = true;
  let descriptionParts = parts.slice(1);

  const levelMatch = (parts[1] || "").match(/([0-5N]단계)/);
  if (levelMatch) {
    level = levelMatch[1];
    missingLevel = false;
    descriptionParts = parts.slice(2);
  }

  let description = descriptionParts.join(" | ").trim();
  const tagMatch = description.match(/\*\*\s*(.*?)\s*\*\*/);
  const commonTags = tagMatch ? [tagMatch[1].trim()] : [];
  if (tagMatch) {
    description = description.replace(tagMatch[0], "").trim();
  }

  return {
    id: `patch-${lineNumber}`,
    type,
    level,
    commonTags,
    description,
    source: "blockquote",
    sourceLine: lineNumber,
    targetId: null,
    status: missingLevel || hasDraftMarker(description) ? "검토 필요" : "초안",
    missingLevel,
    deleted: false,
  };
}

function parsePlusLine(line, lineNumber) {
  const trimmed = line.trim();
  if (!/^\+{2,}/.test(trimmed)) return null;
  let body = trimmed.replace(/^\+{2,}\s*/, "").replace(/\s*\+{2,}\s*$/, "");
  body = body.replace(/\\\[/g, "[").replace(/\\\]/g, "]");
  const authorMatch = body.match(/^\[([^\]]+)\]\s*(.*)$/);
  return {
    id: `plus-${lineNumber}`,
    rawText: authorMatch ? authorMatch[2].trim() : body.trim(),
    authorLabel: authorMatch ? authorMatch[1].trim() : "",
    sourceLine: lineNumber,
    targetId: null,
    convertedPatchNoteId: null,
  };
}

function runAutoMatch(options = {}) {
  const usedOriginals = new Set();
  const nextAlignments = {};

  state.revisedDoc.articles.forEach((revisedArticle) => {
    const scored = state.originalDoc.articles
      .filter((originalArticle) => !usedOriginals.has(originalArticle.id))
      .map((originalArticle) => ({
        article: originalArticle,
        score: similarityScore(articleComparableText(originalArticle), articleComparableText(revisedArticle)),
      }))
      .sort((a, b) => b.score - a.score);

    const matches = [];
    const best = scored[0];
    const second = scored[1];
    if (best && best.score >= 0.18) {
      matches.push(best.article.id);
      usedOriginals.add(best.article.id);
    }
    if (second && second.score >= 0.32 && best && second.score > best.score * 0.72) {
      matches.push(second.article.id);
      usedOriginals.add(second.article.id);
    }

    nextAlignments[revisedArticle.id] = {
      revisedArticleId: revisedArticle.id,
      originalArticleIds: matches,
      manual: false,
      spacerHeight: 0,
    };
  });

  nextAlignments[TITLE_REVISED_ID] = {
    revisedArticleId: TITLE_REVISED_ID,
    originalArticleIds: [TITLE_ORIGINAL_ID],
    manual: false,
    spacerHeight: 0,
  };
  state.alignments = nextAlignments;
  state.deletedRows = [];
  persistLocalState();
  renderAll();
  if (!options.silent) showToast("유사도 기반 자동 매칭을 적용했습니다.");
}

function renderAll() {
  if (els.duplicateToggle) els.duplicateToggle.checked = state.allowDuplicate;
  if (IS_PRESENT_MODE) {
    renderPresentation();
  } else {
    renderBoard();
  }
  renderInspector();
  renderValidation();
}

function renderChips() {
  if (!els.typeChips || !els.levelChips) return;
  els.typeChips.innerHTML = PATCH_TYPES.map((type) => {
    return `<button class="chip ${type === state.selectedType ? "is-active" : ""}" data-type="${type}" type="button">${type}</button>`;
  }).join("");
  els.levelChips.innerHTML = PATCH_LEVELS.map((level) => {
    return `<button class="chip ${level === state.selectedLevel ? "is-active" : ""}" data-level="${level}" type="button">${level}</button>`;
  }).join("");
  els.typeChips.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedType = button.dataset.type;
      renderChips();
    });
  });
  els.levelChips.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLevel = button.dataset.level;
      renderChips();
    });
  });
}

function renderBoard() {
  document.body.classList.toggle("has-note-composer", Boolean(state.noteComposer || state.noteComposerClosing));
  ensureTitleAlignment();
  resetRenderLineNumbers();
  const rows = state.revisedDoc.articles.filter((article) => rowPassesFilter(article));
  const chapterSections = [];
  let currentSection = null;
  const titleSection = renderTitleSection();

  rows.forEach((revisedArticle) => {
    const chapter = revisedArticle.chapter || "기타";
    if (!currentSection || currentSection.chapter !== chapter) {
      currentSection = { chapter, rows: [] };
      chapterSections.push(currentSection);
    }
    if (currentSection.rows.length) {
      currentSection.rows.push(renderBetweenRowDropZone(revisedArticle.id));
    }
    getDeletedRowsBefore(revisedArticle.id).forEach((row) => {
      currentSection.rows.push(renderDeletedOriginalRow(row));
    });
    currentSection.rows.push(renderAlignmentRow(revisedArticle));
  });

  const unassignedRows = IS_EDIT_MODE ? getUnassignedOriginalArticles().map((article) => renderUnassignedOriginalRow(article)) : [];
  els.board.innerHTML = [
    titleSection,
    ...chapterSections.map((section) => renderChapterSection(section.chapter, section.rows.join(""))),
    ...unassignedRows,
  ].join("");
  if (els.unassigned) {
    els.unassigned.innerHTML = getUnassignedOriginalArticles().map((article) => renderOriginalArticleCard(article, null)).join("");
  }
  bindBoardEvents();
  refreshAllLineBonds({ persist: true });
  state.noteComposerOpening = null;
  flushPendingRemoteStateIfIdle();
}

function renderPresentation() {
  document.body.classList.remove("has-note-composer");
  ensureTitleAlignment();
  resetRenderLineNumbers();
  const notes = getPresentationNotes();
  if (!notes.length) {
    setPresentationProgress(0);
    els.board.innerHTML = `
      <section class="presentation-empty">
        <h2>공개된 개정이유가 없습니다.</h2>
      </section>
    `;
    return;
  }

  state.presentationIndex = clamp(state.presentationIndex, 0, notes.length - 1);
  const note = notes[state.presentationIndex];
  setPresentationProgress(((state.presentationIndex + 1) / notes.length) * 100);
  els.board.innerHTML = `
    <section class="presentation-shell">
      ${renderPresentationContextBand(note)}
      <div class="presentation-cells">
        ${renderPresentationCellPair(note)}
      </div>
      <article class="presentation-note ${levelClassName(note.level)}">
        <div class="presentation-note-meta">
          <strong>${escapeHtml(displayPatchType(note.type))}</strong>
          <span class="level-chip ${levelClassName(note.level)}">
            <span class="level-roman">${escapeHtml(levelRoman(note.level))}</span>
            <span>${escapeHtml(levelName(note.level))}</span>
          </span>
        </div>
        <p>${escapeHtml(annotationBodyText(note))}</p>
        ${renderPresentationNoteIndicators(note, notes)}
      </article>
      <button class="presentation-nav presentation-prev" type="button" data-presentation-prev aria-label="이전">‹</button>
      <button class="presentation-nav presentation-next" type="button" data-presentation-next aria-label="다음">›</button>
    </section>
  `;
  bindPresentationEvents();
  schedulePresentationLayoutRefresh();
}

function getPresentationNotes() {
  return state.annotations.filter((note) => note.kind !== "댓글" && note.isPublic !== false);
}

function setPresentationProgress(progress) {
  document.documentElement.style.setProperty("--presentation-progress", `${clamp(progress, 0, 100)}%`);
}

function renderPresentationContextBand(note) {
  return renderChapterBand(getPresentationContextText(note), "presentation-context-band");
}

function renderPresentationNoteIndicators(activeNote, notes) {
  const targetNotes = notes.filter((note) => note.targetId === activeNote.targetId);
  if (targetNotes.length < 2) return "";
  return `
    <div class="presentation-note-indicators" aria-label="이 조의 개정이유 위치">
      ${targetNotes.map((note, index) => `
        <button
          class="presentation-note-dot ${note.id === activeNote.id ? "is-active" : ""}"
          type="button"
          data-presentation-note-id="${escapeAttribute(note.id)}"
          aria-label="${index + 1}번째 개정이유로 이동"
          aria-current="${note.id === activeNote.id ? "true" : "false"}"
        ></button>
      `).join("")}
    </div>
  `;
}

function getPresentationContextText(note) {
  if (note.targetId === TITLE_REVISED_ID) return "제목";
  const article = findRevisedArticle(note.targetId);
  if (!article) return "대상 조문 없음";
  return `${formatPresentationChapter(article.chapter)} - ${formatPresentationArticle(article)}`;
}

function formatPresentationChapter(chapter) {
  const text = chapter || "기타";
  const match = text.match(/^(제\d+장)\s+(.+)$/);
  return match ? `${match[1]} (${match[2]})` : text;
}

function formatPresentationArticle(article) {
  const label = article.label || `제${article.number || "?"}조`;
  return article.title ? `${label} (${article.title})` : label;
}

function renderPresentationCellPair(note) {
  if (note.targetId === TITLE_REVISED_ID) {
    const revisedTitle = getTitleArticle(state.revisedDoc, "revised");
    const alignment = getAlignment(TITLE_REVISED_ID);
    const originals = alignment.originalArticleIds.map((id) => findOriginalArticle(id)).filter(Boolean);
    const originalText = originals.flatMap((article) => cleanArticleLines(article));
    const revisedText = cleanArticleLines(revisedTitle);
    const revisedDiff = buildLineRenderDiff(originalText, revisedText);
    return `
      <div class="article-slot">${originals.map((article) => renderOriginalArticleCard(article, TITLE_REVISED_ID, buildLineRenderDiff(cleanArticleLines(article), revisedText).oldLines)).join("")}</div>
      <div class="article-slot">${renderTitleArticleCard("revised", revisedTitle, revisedDiff.newLines)}</div>
    `;
  }

  const revisedArticle = findRevisedArticle(note.targetId);
  if (!revisedArticle) return `<div class="presentation-missing">대상 조문을 찾을 수 없습니다.</div>`;
  const alignment = getAlignment(revisedArticle.id);
  const originals = alignment.originalArticleIds.map((id) => findOriginalArticle(id)).filter(Boolean);
  const originalText = originals.flatMap((article) => cleanArticleLines(article));
  const revisedText = cleanArticleLines(revisedArticle);
  const revisedDiff = buildLineRenderDiff(originalText, revisedText);
  return `
    <div class="article-slot">${originals.map((article) => renderOriginalArticleCard(article, revisedArticle.id, buildLineRenderDiff(cleanArticleLines(article), revisedText).oldLines)).join("")}</div>
    <div class="article-slot">${renderRevisedArticleCard(revisedArticle, revisedDiff.newLines)}</div>
  `;
}

function bindPresentationEvents() {
  document.querySelector("[data-presentation-prev]")?.addEventListener("click", () => movePresentationSlide(-1));
  document.querySelector("[data-presentation-next]")?.addEventListener("click", () => movePresentationSlide(1));
  document.querySelectorAll("[data-presentation-note-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const notes = getPresentationNotes();
      const nextIndex = notes.findIndex((note) => note.id === button.dataset.presentationNoteId);
      if (nextIndex < 0) return;
      state.presentationIndex = nextIndex;
      renderPresentation();
    });
  });
}

function movePresentationSlide(delta) {
  const notes = getPresentationNotes();
  if (!notes.length) return;
  state.presentationIndex = clamp(state.presentationIndex + delta, 0, notes.length - 1);
  renderPresentation();
}

function schedulePresentationLayoutRefresh() {
  if (!IS_PRESENT_MODE) return;
  window.requestAnimationFrame(() => {
    refreshAllLineBonds({ persist: false });
    window.requestAnimationFrame(scrollPresentationHighlightsIntoView);
  });
}

function scrollPresentationHighlightsIntoView() {
  if (!IS_PRESENT_MODE) return;
  const highlightGroups = new Map();
  document.querySelectorAll(".presentation-cells .law-user-highlight").forEach((highlight) => {
    const container = highlight.closest(".article-slot");
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const rect = highlight.getBoundingClientRect();
    const relativeTop = rect.top - containerRect.top + container.scrollTop;
    const relativeBottom = rect.bottom - containerRect.top + container.scrollTop;
    const group = highlightGroups.get(container) || { top: Infinity, bottom: -Infinity };
    group.top = Math.min(group.top, relativeTop);
    group.bottom = Math.max(group.bottom, relativeBottom);
    highlightGroups.set(container, group);
  });

  highlightGroups.forEach((group, container) => {
    const padding = 28;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (group.top >= viewTop + padding && group.bottom <= viewBottom - padding) return;

    const highlightHeight = group.bottom - group.top;
    const targetTop = highlightHeight + (padding * 2) <= container.clientHeight
      ? group.top - ((container.clientHeight - highlightHeight) / 2)
      : group.top - padding;
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTo({
      top: clamp(Math.round(targetTop), 0, maxScrollTop),
      behavior: "smooth",
    });
  });
}

function renderTitleSection() {
  return renderChapterSection("제목", renderTitleAlignmentRow());
}

function renderChapterSection(chapter, rowsHtml) {
  return `
    <section class="chapter-section">
      ${renderChapterBand(chapter)}
      ${rowsHtml}
    </section>
  `;
}

function renderChapterBand(chapter, extraClass = "") {
  const className = extraClass ? `chapter-band ${extraClass}` : "chapter-band";
  return `
    <section class="${className}" aria-label="${escapeAttribute(chapter)}">
      <span class="chapter-title">${escapeHtml(chapter)}</span>
    </section>
  `;
}

function renderTitleAlignmentRow() {
  const revisedTitle = getTitleArticle(state.revisedDoc, "revised");
  const alignment = getAlignment(TITLE_REVISED_ID);
  const originals = alignment.originalArticleIds.map((id) => findOriginalArticle(id)).filter(Boolean);
  const originalText = originals.flatMap((article) => cleanArticleLines(article));
  const revisedText = cleanArticleLines(revisedTitle);
  const revisedDiff = buildLineRenderDiff(originalText, revisedText);
  const slotClass = originals.length ? "article-slot" : "article-slot empty";
  const slotContent = originals.length
    ? originals.map((article) => {
        const diff = buildLineRenderDiff(cleanArticleLines(article), revisedText);
        return renderOriginalArticleCard(article, TITLE_REVISED_ID, diff.oldLines);
      }).join("")
    : "";

  return `
    <article class="alignment-row title-row ${state.selectedRevisedId === TITLE_REVISED_ID ? "is-selected" : ""}" data-title-row="true" data-revised-id="${TITLE_REVISED_ID}">
      <div class="${slotClass}" data-drop-zone="${TITLE_REVISED_ID}" style="min-height: ${88 + alignment.spacerHeight}px">
        ${slotContent}
      </div>
      <div class="article-slot" data-select-row="${TITLE_REVISED_ID}" style="min-height: ${88 + alignment.spacerHeight}px">
        ${renderTitleArticleCard("revised", revisedTitle, revisedDiff.newLines)}
      </div>
      ${renderRowAnnotationPanel(TITLE_REVISED_ID)}
    </article>
  `;
}

function renderTitleArticleCard(kind, article, statuses = []) {
  const lineKey = `${kind}:title:${article.startLine || 1}`;
  const lines = cleanArticleLines(article);
  const isEditing = kind === "revised" && state.editingRevisedId === article.id;
  if (isEditing) allocateRenderLineNumbers("revised", lines.length);
  const handleHtml = kind === "original"
    ? (IS_EDIT_MODE ? '<button class="row-line-handle drag-handle title-handle" type="button" draggable="true" title="제목 드래그 핸들" aria-label="제목 드래그 핸들">::</button>' : "")
    : renderRevisedCellActions(article.id, isEditing, "title-handle");
  const originalAttribute = kind === "original" ? ` data-original-id="${escapeAttribute(article.id)}"` : "";
  return `
    <section class="article-card ${kind} document-article title-article-card"${originalAttribute} ${kind === "revised" ? `data-revised-card="${escapeAttribute(article.id)}"` : ""}>
      ${handleHtml}
      ${isEditing
        ? renderRevisedEditor(article)
        : `<div class="law-text">${renderLawLines(lines, statuses, { lineNumbers: allocateRenderLineNumbers(kind, lines.length), lineKeys: [lineKey] })}</div>`}
    </section>
  `;
}

function formatTitleDisplayText(text) {
  return String(text);
}

function resetRenderLineNumbers() {
  renderLineNumbers.original = 0;
  renderLineNumbers.revised = 0;
}

function allocateRenderLineNumbers(kind, count) {
  const side = kind === "revised" ? "revised" : "original";
  return Array.from({ length: count }, () => {
    renderLineNumbers[side] += 1;
    return renderLineNumbers[side];
  });
}

function renderBetweenRowDropZone(beforeRevisedId) {
  if (!IS_EDIT_MODE) return "";
  const revisedArticle = findRevisedArticle(beforeRevisedId);
  const label = revisedArticle ? `${revisedArticle.label} 앞에 원본 조문 단독 삽입` : "원본 조문 단독 삽입";
  return `
    <div
      class="between-row-drop-zone"
      data-insert-before="${escapeAttribute(beforeRevisedId)}"
      aria-label="${escapeAttribute(label)}"
    ></div>
  `;
}

function renderAlignmentRow(revisedArticle) {
  const alignment = getAlignment(revisedArticle.id);
  const originals = alignment.originalArticleIds.map((id) => findOriginalArticle(id)).filter(Boolean);
  const originalText = originals.flatMap((article) => cleanArticleLines(article));
  const revisedText = cleanArticleLines(revisedArticle);
  const revisedDiff = buildLineRenderDiff(originalText, revisedText);
  const slotClass = originals.length ? "article-slot" : "article-slot empty";
  const slotContent = originals.length
    ? originals.map((article) => {
        const diff = buildLineRenderDiff(cleanArticleLines(article), revisedText);
        return renderOriginalArticleCard(article, revisedArticle.id, diff.oldLines);
      }).join("")
    : "";

  return `
    <article class="alignment-row ${state.selectedRevisedId === revisedArticle.id ? "is-selected" : ""}" data-revised-id="${revisedArticle.id}">
      <div class="${slotClass}" data-drop-zone="${revisedArticle.id}" style="min-height: ${72 + alignment.spacerHeight}px">
        ${slotContent}
      </div>
      <div class="article-slot" data-select-row="${revisedArticle.id}" style="min-height: ${72 + alignment.spacerHeight}px">
        ${renderRevisedArticleCard(revisedArticle, revisedDiff.newLines)}
      </div>
      ${renderRowAnnotationPanel(revisedArticle.id)}
    </article>
  `;
}

function renderDeletedOriginalRow(row) {
  const article = findOriginalArticle(row.originalArticleId);
  if (!article) return "";
  const removedLines = cleanArticleLines(article).map((line) => renderWholeChangedLine(line, "removed"));
  const minHeight = Math.max(72, row.height || 72);
  const virtualLineKey = `virtual:${row.id}:1`;

  return `
    <article class="alignment-row deleted-original-row" data-deleted-row-id="${escapeAttribute(row.id)}" data-before-revised="${escapeAttribute(row.beforeRevisedId)}">
      <div class="article-slot deleted-original-slot" style="min-height: ${minHeight}px">
        ${renderOriginalArticleCard(article, row.beforeRevisedId, removedLines)}
      </div>
      <div class="article-slot virtual-revised-slot" style="min-height: ${minHeight}px" aria-label="대응되는 신규 개정안 없음">
        <section class="article-card revised virtual-revised-card" style="min-height: ${minHeight}px">
          ${renderRevisedDummyHandle()}
          <div class="law-text">${renderLawLines([""], [], { lineNumbers: allocateRenderLineNumbers("revised", 1), lineKeys: [virtualLineKey] })}</div>
        </section>
      </div>
      ${renderRowAnnotationPanel(getDeletedRowNoteTarget(row.id))}
    </article>
  `;
}

function renderUnassignedOriginalRow(article) {
  return `
    <article class="alignment-row unassigned-row">
      <div class="article-slot">
        ${renderOriginalArticleCard(article, null, cleanArticleLines(article).map((line) => renderWholeChangedLine(line, "removed")))}
      </div>
      <div class="article-slot empty"></div>
    </article>
  `;
}

function renderOriginalArticleCard(article, revisedId, statuses = []) {
  if (article.isTitle) {
    return renderTitleArticleCard("original", article, statuses);
  }
  const entries = cleanArticleLineEntries(article);
  const lines = entries.map((entry) => entry.text);
  const lineKeys = entries.map((entry) => `original:${article.id}:${entry.sourceLine}`);

  return `
    <section class="article-card original document-article" data-original-id="${article.id}">
      ${IS_EDIT_MODE ? '<button class="row-line-handle drag-handle" type="button" draggable="true" title="조문 드래그 핸들" aria-label="조문 드래그 핸들">::</button>' : ""}
      <div class="law-text">${renderLawLines(lines, statuses, { lineNumbers: allocateRenderLineNumbers("original", lines.length), lineKeys })}</div>
    </section>
  `;
}

function renderRevisedArticleCard(article, statuses) {
  if (article.isTitle) {
    return renderTitleArticleCard("revised", article, statuses);
  }
  const isEditing = state.editingRevisedId === article.id;
  const entries = cleanArticleLineEntries(article);
  const lines = entries.map((entry) => entry.text);
  const lineKeys = entries.map((entry) => `revised:${article.id}:${entry.sourceLine}`);
  if (isEditing) allocateRenderLineNumbers("revised", lines.length);

  return `
    <section class="article-card revised document-article" data-revised-card="${escapeAttribute(article.id)}">
      ${renderRevisedCellActions(article.id, isEditing)}
      ${isEditing
        ? renderRevisedEditor(article)
        : `<div class="law-text">${renderLawLines(lines, statuses, { lineNumbers: allocateRenderLineNumbers("revised", lines.length), lineKeys })}</div>`}
    </section>
  `;
}

function renderRevisedCellActions(revisedId, isEditing, extraClass = "") {
  if (!IS_EDIT_MODE) return "";
  const escapedId = escapeAttribute(revisedId);
  return `
    ${renderRevisedDummyHandle(extraClass)}
    <button
      class="row-line-handle edit-handle ${isEditing ? "is-saving-mode" : ""} ${extraClass}"
      type="button"
      data-edit-revised="${escapedId}"
      title="${isEditing ? "저장" : "편집"}"
      aria-label="${isEditing ? "저장" : "편집"}"
      ${state.editingSaving ? "disabled" : ""}
    >${isEditing ? renderSaveIcon() : renderPencilIcon()}</button>
  `;
}

function renderRevisedDummyHandle(extraClass = "") {
  return `<span class="row-line-handle dummy-revised-handle ${extraClass}" aria-hidden="true">::</span>`;
}

function getDeletedRowNoteTarget(rowId) {
  return `deleted:${rowId}`;
}

function renderRowAnnotationPanel(targetId) {
  const notes = getAnnotationsForTarget(targetId);
  if (!IS_EDIT_MODE && !notes.length) return "";
  const composer = state.noteComposer?.targetId === targetId ? state.noteComposer : null;
  const closingComposer = state.noteComposerClosing?.targetId === targetId ? state.noteComposerClosing : null;
  const visibleComposer = composer || closingComposer;
  const inlineComposer = composer?.editingId ? composer : null;
  const inlineClosingComposer = closingComposer?.editingId ? closingComposer : null;
  const newComposer = composer && !composer.editingId ? composer : null;
  const newClosingComposer = closingComposer && !closingComposer.editingId ? closingComposer : null;

  return `
    <section class="row-annotation-panel ${visibleComposer?.kind === "댓글" ? "is-comment-mode" : ""}" data-note-panel="${escapeAttribute(targetId)}">
      ${notes.length ? `<div class="annotation-list" data-annotation-list="${escapeAttribute(targetId)}">${notes.map((note) => renderAnnotationEntry(note, inlineComposer, inlineClosingComposer)).join("")}</div>` : ""}
      ${IS_EDIT_MODE ? `<button class="note-add-row-button" type="button" data-note-target="${escapeAttribute(targetId)}" title="개정이유 또는 댓글 작성" aria-label="개정이유 또는 댓글 작성">+</button>` : ""}
      ${newComposer ? renderNoteComposer(newComposer) : ""}
      ${newClosingComposer ? renderNoteComposer(newClosingComposer, { closing: true }) : ""}
    </section>
  `;
}

function renderAnnotationEntry(note, activeComposer = null, closingComposer = null) {
  const inlineComposer = activeComposer?.editingId === note.id ? activeComposer : null;
  const closingInlineComposer = closingComposer?.editingId === note.id ? closingComposer : null;
  const isOpen = Boolean(inlineComposer || closingInlineComposer);
  const entryClass = [
    "annotation-entry",
    note.kind === "댓글" ? "is-comment-entry" : "",
    isOpen ? "is-open" : "",
  ].filter(Boolean).join(" ");

  return `
    <div class="${entryClass}" data-annotation-entry="${escapeAttribute(note.id)}" data-annotation-target="${escapeAttribute(note.targetId)}">
      ${renderAnnotationItem(note)}
      ${inlineComposer ? renderNoteComposer(inlineComposer, { inline: true }) : ""}
      ${closingInlineComposer ? renderNoteComposer(closingInlineComposer, { closing: true, inline: true }) : ""}
    </div>
  `;
}

function renderAnnotationItem(note) {
  const isOpen = state.noteComposer?.editingId === note.id || state.noteComposerClosing?.editingId === note.id;
  const bodyClass = `annotation-body ${isAnnotationBodyEmpty(note) ? "is-placeholder" : ""}`;
  const itemDragAttributes = IS_EDIT_MODE && !isOpen
    ? ` draggable="true" data-drag-annotation="${escapeAttribute(note.id)}" data-drag-annotation-target="${escapeAttribute(note.targetId)}"`
    : "";
  if (note.kind === "댓글") {
    return `
      <article class="annotation-item annotation-comment ${isOpen ? "is-open" : ""}" data-annotation-id="${escapeAttribute(note.id)}"${itemDragAttributes}>
        ${renderAnnotationDragHandle(note)}
        ${renderAnnotationKindText(note)}
        <span class="${bodyClass}">${escapeHtml(annotationBodyText(note))}</span>
        ${renderAnnotationActions(note)}
      </article>
    `;
  }

  return `
    <article class="annotation-item annotation-reason ${isOpen ? "is-open" : ""}" data-annotation-id="${escapeAttribute(note.id)}"${itemDragAttributes}>
      ${renderAnnotationDragHandle(note)}
      ${renderAnnotationKindText(note)}
      <span class="level-chip ${levelClassName(note.level)}" title="${escapeAttribute(levelCriteria(note.level))}">
        <span class="level-roman">${escapeHtml(levelRoman(note.level))}</span>
        <span>${escapeHtml(levelName(note.level))}</span>
      </span>
      <span class="${bodyClass}">${escapeHtml(annotationBodyText(note))}</span>
      ${renderAnnotationHighlightPreview(note)}
      ${renderAnnotationActions(note)}
    </article>
  `;
}

function renderAnnotationKindText(note) {
  const kindText = note.kind === "댓글" ? "메모" : displayPatchType(note.type);
  const author = IS_EDIT_MODE && typeof note.author === "string" ? note.author.trim() : "";
  const isPublic = note.kind === "댓글" ? false : note.isPublic !== false;
  return `
    <strong class="annotation-kind-text ${note.kind === "댓글" ? "annotation-comment-kind" : ""}">
      <span>${escapeHtml(kindText)}</span>
      ${author ? `<span class="annotation-author-separator" aria-hidden="true">·</span><span class="annotation-author">${escapeHtml(author)}</span>` : ""}
      <span class="annotation-public-badge ${isPublic ? "is-public" : "is-private"}">${isPublic ? "공개" : "비공개"}</span>
    </strong>
  `;
}

function renderAnnotationDragHandle(note) {
  if (!IS_EDIT_MODE) return "";
  return `
    <button
      class="annotation-drag-handle"
      type="button"
      draggable="true"
      data-drag-annotation="${escapeAttribute(note.id)}"
      data-drag-annotation-target="${escapeAttribute(note.targetId)}"
      title="개정이유 순서 이동"
      aria-label="개정이유 순서 이동"
    >::</button>
  `;
}

function annotationBodyText(note) {
  if (note.body?.trim()) return note.body;
  return note.kind === "댓글" ? "댓글을 입력하세요" : "개정이유를 입력하세요";
}

function isAnnotationBodyEmpty(note) {
  return !note.body?.trim();
}

function renderAnnotationActions(note) {
  if (!IS_EDIT_MODE) return "";
  const escapedId = escapeAttribute(note.id);
  const isOpening = state.noteComposerOpening?.editingId === note.id;
  const isClosing = state.noteComposerClosing?.editingId === note.id;
  const isOpen = state.noteComposer?.editingId === note.id || isClosing;
  const actionClasses = [
    "annotation-actions",
    isOpen ? "is-open" : "",
    isOpening ? "is-opening" : "",
    isClosing ? "is-closing" : "",
  ].filter(Boolean).join(" ");
  return `
    <span class="${actionClasses}">
      ${isOpen ? `<button class="annotation-action-button annotation-trash-button" type="button" data-delete-annotation="${escapedId}" title="삭제" aria-label="삭제">${renderTrashIcon()}</button>` : ""}
      <button class="annotation-action-button annotation-chevron-button" type="button" data-toggle-annotation="${escapedId}" title="${isOpen ? "접고 저장" : "펼치기"}" aria-label="${isOpen ? "접고 저장" : "펼치기"}">${renderChevronIcon(isOpen)}</button>
    </span>
  `;
}

function renderAnnotationHighlightPreview(note) {
  if (!hasNoteHighlights(note)) return "";
  return `
    <button class="annotation-highlight-preview" type="button" data-preview-highlight="${escapeAttribute(note.id)}">
      <span class="annotation-highlight-preview-desktop">손을 올려 개정 부분 강조 표시</span>
      <span class="annotation-highlight-preview-mobile">여기를 탭하여 강조 표시</span>
    </button>
  `;
}

function hasNoteHighlights(note) {
  return normalizeNoteHighlights(note?.highlights).length > 0;
}

function renderChevronIcon(isOpen = false) {
  return `<svg class="${isOpen ? "is-open" : ""}" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3 3.5-3"></path></svg>`;
}

function renderTrashIcon() {
  return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.4 6.4v5"></path><path d="M8 6.4v5"></path><path d="M10.6 6.4v5"></path><path d="M3.8 4.4h8.4"></path><path d="M6.3 4.4l.5-1h2.4l.5 1"></path><path d="M4.8 4.4l.5 8.1h5.4l.5-8.1"></path></svg>';
}

function renderNoteComposer(composer, options = {}) {
  const isComment = composer.kind === "댓글";
  const isReason = composer.kind === "개정이유";
  const isPublic = isComment ? false : composer.isPublic !== false;
  const canWrite = canWriteNoteBody(composer);
  const isOpening = !options.closing
    && state.noteComposerOpening?.targetId === composer.targetId
    && state.noteComposerOpening?.editingId === composer.editingId;
  const openingClass = isOpening ? " is-opening" : "";
  const closingClass = options.closing ? " is-closing" : "";
  const editingClass = composer.editingId ? " is-editing" : "";
  const inlineClass = options.inline ? " is-inline" : "";

  return `
    <div class="note-composer ${isComment ? "is-comment" : ""}${editingClass}${inlineClass}${openingClass}${closingClass}" data-note-composer="${escapeAttribute(composer.targetId)}">
      <div class="note-public-row ${isComment ? "is-disabled" : ""}">
        <span class="note-public-label">최종 공개</span>
        <button
          class="note-public-toggle ${isPublic ? "is-on" : ""}"
          type="button"
          data-note-public-toggle
          aria-pressed="${isPublic ? "true" : "false"}"
          ${isComment ? "disabled" : ""}
        >
          <span class="note-public-toggle-thumb" aria-hidden="true"></span>
        </button>
      </div>
      <div class="note-chip-group">
        <span class="note-chip-label">유형</span>
        <div class="note-chip-row" role="group" aria-label="작성 유형">
          ${NOTE_KINDS.map((kind) => renderNoteChip("kind", kind, composer.kind)).join("")}
        </div>
      </div>
      ${isReason ? `
        <div class="note-switch-group">
          <span class="note-chip-label">하이라이트</span>
          <button
            class="note-switch-toggle ${composer.highlightMode ? "is-on" : ""}"
            type="button"
            data-note-highlight-toggle
            aria-pressed="${composer.highlightMode ? "true" : "false"}"
          >
            <span class="note-switch-toggle-thumb" aria-hidden="true"></span>
            <span class="note-switch-text">하이라이트 모드</span>
          </button>
        </div>
        <div class="note-chip-group">
          <span class="note-chip-label">방식</span>
          <div class="note-chip-row" role="group" aria-label="개정 방식">
            ${PATCH_TYPES.map((type) => renderNoteChip("type", type, composer.type)).join("")}
          </div>
        </div>
        <div class="note-chip-group">
          <span class="note-chip-label">단계</span>
          <div class="note-stage-row">
            <div class="note-chip-row" role="group" aria-label="개정 단계">
              ${NOTE_LEVELS.map((level) => renderNoteChip("level", level, composer.level, { roman: levelRoman(level), label: levelName(level), title: levelCriteria(level) })).join("")}
            </div>
            <select class="note-select" data-note-field="reason" ${composer.level ? "" : "disabled"}>
              <option value="">단계별 사유 (선택)</option>
              ${(NOTE_LEVEL_REASONS[composer.level] || []).map((reason) => `<option value="${escapeAttribute(reason)}" ${composer.reason === reason ? "selected" : ""}>${escapeHtml(reason)}</option>`).join("")}
              <option value="기타" ${composer.reason === "기타" ? "selected" : ""}>기타</option>
            </select>
            ${composer.reason === "기타" ? `
              <input
                class="note-inline-input"
                data-note-field="customReason"
                type="text"
                placeholder="단계 선정 이유를 입력하세요…"
                value="${escapeAttribute(composer.customReason || "")}"
              />
            ` : ""}
          </div>
        </div>
        <div class="note-chip-group">
          <span class="note-chip-label">작성자</span>
          <div class="note-chip-row" role="group" aria-label="작성자">
            ${NOTE_AUTHORS.map((author) => renderNoteChip("author", author, composer.author)).join("")}
          </div>
        </div>
      ` : ""}
      ${isReason ? renderReasonNoteInputs(composer, canWrite) : renderCommentNoteInputs(composer, canWrite)}
    </div>
  `;
}

function renderNoteChip(field, value, selectedValue, options = {}) {
  const icon = field === "kind" ? renderNoteKindIcon(value) : (options.roman ? `<span class="note-chip-roman">${escapeHtml(options.roman)}</span>` : "");
  const label = options.label || value;
  const titleAttribute = options.title ? ` title="${escapeAttribute(options.title)}"` : "";
  return `
    <button
      class="note-chip note-chip-${escapeAttribute(field)} ${value === selectedValue ? "is-active" : ""}"
      type="button"
      data-note-chip="${field}"
      data-note-value="${escapeAttribute(value)}"
      ${titleAttribute}
    >${icon}<span>${escapeHtml(label)}</span></button>
  `;
}

function renderNoteKindIcon(value) {
  if (value === "개정이유") {
    return '<svg class="note-chip-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8.8 7.8 4.2"></path><path d="M6.4 2.8 9.2 5.6"></path><path d="M2.1 9.7 6.2 13.8"></path><path d="M1.6 14.4h5.2"></path><path d="M8.3 6.1 13.2 11"></path></svg>';
  }
  if (value === "댓글") {
    return '<svg class="note-chip-icon is-filled" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5c3.3 0 6 2.1 6 4.8S11.3 12 8 12c-.7 0-1.4-.1-2-.3-.7.5-1.6.8-2.5.8.4-.4.7-.9.8-1.5C2.9 10.1 2 8.8 2 7.3 2 4.6 4.7 2.5 8 2.5Z"></path></svg>';
  }
  return "";
}

function renderReasonNoteInputs(composer, canWrite) {
  return `
    <div class="note-input-grid ${canWrite ? "" : "is-disabled"}">
      <textarea class="note-body-input" data-note-field="body" placeholder="개정이유를 입력하세요" ${canWrite ? "" : "disabled"}>${escapeHtml(composer.body || "")}</textarea>
      ${renderNoteSubmitControls(composer)}
    </div>
  `;
}

function renderCommentNoteInputs(composer, canWrite) {
  return `
    <div class="note-comment-input ${canWrite ? "" : "is-disabled"}">
      <textarea class="note-body-input" data-note-field="body" placeholder="댓글을 입력하세요" ${canWrite ? "" : "disabled"}>${escapeHtml(composer.body || "")}</textarea>
      ${renderNoteSubmitControls(composer)}
    </div>
  `;
}

function renderNoteSubmitControls(composer) {
  return `<button class="note-submit-button note-close-save-button" type="button" data-note-submit ${canCloseNoteComposer(composer) ? "" : "disabled"}>저장하고 닫기</button>`;
}

function renderRevisedEditor(article) {
  const draft = state.editingRevisedId === article.id ? state.editingDraft : getEditableRevisedText(article);
  return `
    <div class="law-text revised-editor-shell">
      <textarea class="revised-editor-input" data-revised-editor="${escapeAttribute(article.id)}" spellcheck="false">${escapeHtml(draft)}</textarea>
      <div class="circled-insert-toolbar" aria-label="동그라미 번호 삽입">
        ${CIRCLED_INSERT_MARKERS.map((marker) => `<button type="button" data-insert-circled="${escapeAttribute(marker)}">${escapeHtml(marker)}</button>`).join("")}
      </div>
    </div>
  `;
}

function renderPencilIcon() {
  return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11.7 1.9 14.1 4.3 5.6 12.8 2.4 13.6 3.2 10.4 11.7 1.9Z"></path><path d="m10.4 3.2 2.4 2.4"></path></svg>';
}

function renderSaveIcon() {
  return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h8.2L13 4.3v9.2H3V2.5Z"></path><path d="M5 2.5v4h5v-4"></path><path d="M5.2 10.5h5.6v3"></path></svg>';
}

function renderLawLines(lines, statuses = [], options = {}) {
  const ignoreBondLayout = isMobileBondLayoutActive();
  return lines.map((line, index) => {
    const rendered = statuses[index] || {
      className: line.trim() ? "" : "line-muted",
      html: renderPlainLawLine(line),
    };
    const lineNumber = options.lineNumbers?.[index] ?? "";
    const lineKey = options.lineKeys?.[index] || "";
    const savedHeight = getSavedLineHeight(lineKey);
    const savedOffset = getSavedLineOffset(lineKey);
    const lineKeyAttribute = lineKey ? ` data-line-key="${escapeAttribute(lineKey)}"` : "";
    const lineStyles = [];
    if (savedHeight) lineStyles.push(`min-height: ${savedHeight}px`);
    if (savedOffset) lineStyles.push(`--line-link-offset: ${savedOffset}px`, `padding-top: ${savedOffset}px`);
    const lineStyle = lineStyles.length ? ` style="${lineStyles.join("; ")}"` : "";
    const bondClass = !ignoreBondLayout && isLineBonded(lineKey) ? " is-line-bonded" : "";
    const unbondKeyAttribute = lineKey ? ` data-unbond-line="${escapeAttribute(lineKey)}"` : "";
    const lineHtml = applyActiveHighlightsToLine(rendered.html, lineKey);
    return `
      <div class="law-line ${rendered.className}${bondClass}"${lineKeyAttribute}${lineStyle}>
        <span class="law-line-marker">
          <button class="line-lock-button" type="button"${unbondKeyAttribute} aria-label="결속 해제" title="결속 해제">
            <span class="line-lock-icon" aria-hidden="true"></span>
          </button>
          <span class="law-line-number">${escapeHtml(lineNumber)}</span>
        </span>
        <span class="law-line-content">${lineHtml}</span>
      </div>
    `;
  }).join("");
}

function applyActiveHighlightsToLine(html, lineKey) {
  if (!lineKey) return html;
  const ranges = getActiveHighlightRangesForLine(lineKey);
  if (!ranges.length) return html;
  return applyHighlightRangesToHtml(html, ranges);
}

function getActiveHighlightRangesForLine(lineKey) {
  const noteIds = getActiveHighlightNoteIds();
  if (!noteIds.length) return [];
  return noteIds.flatMap((noteId) => {
    const note = getHighlightSourceNote(noteId);
    return normalizeNoteHighlights(note?.highlights).filter((highlight) => highlight.lineKey === lineKey);
  });
}

function getActiveHighlightNoteIds() {
  const ids = [];
  if (state.highlightPreviewNoteId) ids.push(state.highlightPreviewNoteId);
  if (state.noteComposer?.editingId) ids.push(state.noteComposer.editingId);
  if (IS_PRESENT_MODE) {
    const note = getPresentationNotes()[state.presentationIndex];
    if (note?.id) ids.push(note.id);
  }
  return [...new Set(ids)];
}

function getHighlightSourceNote(noteId) {
  if (state.noteComposer?.editingId === noteId) return state.noteComposer;
  return state.annotations.find((note) => note.id === noteId);
}

function applyHighlightRangesToHtml(html, ranges) {
  const mergedRanges = mergeHighlightRanges(ranges);
  if (!mergedRanges.length) return html;

  const template = document.createElement("template");
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const length = node.nodeValue.length;
    textNodes.push({ node, start: offset, end: offset + length });
    offset += length;
  }

  textNodes.forEach(({ node, start, end }) => {
    const overlaps = mergedRanges
      .map((range) => ({ start: Math.max(range.start, start), end: Math.min(range.end, end) }))
      .filter((range) => range.end > range.start);
    if (!overlaps.length) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    overlaps.forEach((range) => {
      const localStart = range.start - start;
      const localEnd = range.end - start;
      if (localStart > cursor) fragment.append(document.createTextNode(node.nodeValue.slice(cursor, localStart)));
      const mark = document.createElement("span");
      mark.className = "law-user-highlight";
      mark.textContent = node.nodeValue.slice(localStart, localEnd);
      fragment.append(mark);
      cursor = localEnd;
    });
    if (cursor < node.nodeValue.length) fragment.append(document.createTextNode(node.nodeValue.slice(cursor)));
    node.parentNode.replaceChild(fragment, node);
  });

  return template.innerHTML;
}

function mergeHighlightRanges(ranges) {
  const sorted = normalizeNoteHighlights(ranges).sort((first, second) => first.start - second.start || first.end - second.end);
  return sorted.reduce((merged, range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      previous.text = `${previous.text}${range.text ? ` ${range.text}` : ""}`.trim();
    } else {
      merged.push({ ...range });
    }
    return merged;
  }, []);
}

function bindBoardEvents() {
  if (!IS_EDIT_MODE) {
    bindAnnotationHighlightPreviewEvents();
    return;
  }
  document.querySelectorAll(".article-card.original[data-original-id]").forEach((card) => {
    const dragHandle = card.querySelector(".drag-handle");
    if (!dragHandle) return;

    dragHandle.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    dragHandle.addEventListener("dragstart", (event) => {
      if (document.body.classList.contains("is-resizing-line")) {
        event.preventDefault();
        return;
      }
      state.draggedOriginalId = card.dataset.originalId;
      dragPreview.height = Math.max(48, Math.round(card.getBoundingClientRect().height));
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", state.draggedOriginalId);
      setOriginalDragImage(event, card);
      card.classList.add("dragging");
      document.body.classList.add("is-dragging-original");
    });
    dragHandle.addEventListener("dragend", () => {
      state.draggedOriginalId = null;
      card.classList.remove("dragging");
      cleanupDropPreview();
    });
  });

  document.querySelectorAll("[data-drop-zone]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      if (state.draggedAnnotationId) return;
      if (state.draggedLineKey) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearInsertDropTargets();
      zone.classList.add("is-drop-target");
      updateDropPreview(zone, event.clientY);
    });
    zone.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
      zone.classList.remove("is-drop-target");
    });
    zone.addEventListener("drop", (event) => {
      if (state.draggedAnnotationId) return;
      if (state.draggedLineKey) return;
      event.preventDefault();
      const originalId = event.dataTransfer.getData("text/plain") || state.draggedOriginalId;
      const insertIndex = getDropPreviewIndex(zone);
      cleanupDropPreview();
      assignOriginalToRevised(originalId, zone.dataset.dropZone, insertIndex);
    });
  });

  document.querySelectorAll("[data-insert-before]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      if (state.draggedLineKey) return;
      if (!state.draggedOriginalId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".article-slot.is-drop-target").forEach((slot) => slot.classList.remove("is-drop-target"));
      dragPreview.placeholder?.remove();
      clearInsertDropTargets();
      zone.classList.add("is-insert-target");
    });
    zone.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
      zone.classList.remove("is-insert-target");
    });
    zone.addEventListener("drop", (event) => {
      if (state.draggedLineKey) return;
      event.preventDefault();
      const originalId = event.dataTransfer.getData("text/plain") || state.draggedOriginalId;
      const beforeRevisedId = zone.dataset.insertBefore;
      cleanupDropPreview();
      assignOriginalToDeletedRow(originalId, beforeRevisedId);
    });
  });

  document.querySelectorAll("[data-select-row]").forEach((element) => {
    element.addEventListener("click", () => {
      if (hasActiveTextSelection()) return;
      state.selectedRevisedId = element.dataset.selectRow;
      persistLocalState();
      renderAll();
    });
  });

  document.querySelectorAll("[data-note-target]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (button.dataset.noteTarget) toggleNoteComposer(button.dataset.noteTarget);
    });
  });

  document.querySelectorAll("[data-drag-annotation]").forEach((handle) => {
    handle.addEventListener("click", (event) => event.stopPropagation());
    handle.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      state.draggedAnnotationId = handle.dataset.dragAnnotation || null;
      state.draggedAnnotationTargetId = handle.dataset.dragAnnotationTarget || null;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", state.draggedAnnotationId || "");
      handle.closest(".annotation-entry")?.classList.add("is-annotation-dragging");
      document.body.classList.add("is-dragging-annotation");
    });
    handle.addEventListener("dragend", () => cleanupAnnotationDrag());
  });

  document.querySelectorAll("[data-annotation-entry]").forEach((entry) => {
    entry.addEventListener("dragover", (event) => {
      if (!canDropAnnotationOnEntry(entry)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      markAnnotationDropTarget(entry, event.clientY);
    });
    entry.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && entry.contains(event.relatedTarget)) return;
      entry.classList.remove("is-annotation-drop-before", "is-annotation-drop-after");
    });
    entry.addEventListener("drop", (event) => {
      if (!canDropAnnotationOnEntry(entry)) return;
      event.preventDefault();
      event.stopPropagation();
      const placement = getAnnotationDropPlacement(entry, event.clientY);
      const draggedId = event.dataTransfer.getData("text/plain") || state.draggedAnnotationId;
      const targetId = entry.dataset.annotationEntry;
      cleanupAnnotationDrag({ render: false });
      reorderAnnotationWithinTarget(draggedId, targetId, placement);
    });
  });

  document.querySelectorAll("[data-note-chip]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      updateNoteComposerField(button.dataset.noteChip, button.dataset.noteValue);
    });
  });
  document.querySelectorAll("[data-note-public-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const composer = state.noteComposer;
      if (!composer || composer.kind === "댓글") return;
      updateNoteComposerField("isPublic", composer.isPublic === false);
    });
  });
  document.querySelectorAll("[data-note-highlight-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const composer = state.noteComposer;
      if (!composer || composer.kind !== "개정이유") return;
      updateNoteComposerField("highlightMode", !composer.highlightMode);
    });
  });
  document.querySelectorAll(".note-composer [data-note-field]").forEach((field) => {
    const eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, (event) => {
      event.stopPropagation();
      updateNoteComposerField(field.dataset.noteField, field.value, { preserveFocus: field.tagName !== "SELECT" });
    });
    if (field.classList.contains("note-body-input")) {
      field.addEventListener("keydown", handleNoteBodyKeydown);
    }
    field.addEventListener("click", (event) => event.stopPropagation());
  });
  bindNoteComposerActionButtons(document);
  document.querySelectorAll(".annotation-item .annotation-body").forEach((body) => {
    body.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      annotationBodyPointer.active = true;
      annotationBodyPointer.moved = false;
      annotationBodyPointer.suppressClick = false;
      annotationBodyPointer.target = body;
      annotationBodyPointer.startX = event.clientX;
      annotationBodyPointer.startY = event.clientY;
    });
    body.addEventListener("pointermove", (event) => {
      if (!annotationBodyPointer.active || annotationBodyPointer.target !== body) return;
      const distance = Math.hypot(event.clientX - annotationBodyPointer.startX, event.clientY - annotationBodyPointer.startY);
      if (distance > 3) {
        annotationBodyPointer.moved = true;
        annotationBodyPointer.suppressClick = true;
      }
    });
    body.addEventListener("pointerup", () => {
      annotationBodyPointer.active = false;
      window.setTimeout(() => {
        annotationBodyPointer.suppressClick = false;
        annotationBodyPointer.target = null;
      }, 0);
    });
    body.addEventListener("click", (event) => {
      const selectionText = window.getSelection()?.toString() || "";
      if (annotationBodyPointer.moved || annotationBodyPointer.suppressClick || selectionText.trim()) {
        event.stopPropagation();
      }
      annotationBodyPointer.moved = false;
    });
  });
  document.querySelectorAll(".annotation-item").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      const annotationId = item.dataset.annotationId;
      if (!isDesktopHighlightPreviewMode()) return;
      if (hasNoteHighlights(state.annotations.find((note) => note.id === annotationId))) {
        setHighlightPreview(annotationId);
      }
    });
    item.addEventListener("mouseleave", () => {
      if (isDesktopHighlightPreviewMode()) clearHighlightPreview(item.dataset.annotationId);
    });
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!IS_EDIT_MODE) return;
      const annotationId = item.dataset.annotationId;
      if (annotationId) toggleAnnotationEditor(annotationId);
    });
  });
  document.querySelectorAll("[data-toggle-annotation]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleAnnotationEditor(button.dataset.toggleAnnotation);
    });
  });
  document.querySelectorAll("[data-delete-annotation]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteAnnotation(button.dataset.deleteAnnotation);
    });
  });
  document.querySelectorAll("[data-preview-highlight]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (isDesktopHighlightPreviewMode()) return;
      previewAnnotationHighlight(button.dataset.previewHighlight);
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });

  document.querySelectorAll("[data-edit-revised]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handleRevisedEditAction(button.dataset.editRevised);
    });
  });
  document.querySelectorAll("[data-revised-editor]").forEach((editor) => {
    editor.addEventListener("click", (event) => event.stopPropagation());
    editor.addEventListener("input", () => {
      state.editingDraft = editor.value;
      autoResizeRevisedEditor(editor);
    });
    editor.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleRevisedEditAction(editor.dataset.revisedEditor);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRevisedEdit();
      }
    });
    autoResizeRevisedEditor(editor);
  });
  document.querySelectorAll("[data-insert-circled]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      insertCircledMarker(button.dataset.insertCircled);
    });
  });

  document.querySelectorAll("[data-remove-original]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeOriginalFromRevised(button.dataset.removeOriginal, button.dataset.fromRevised);
    });
  });

  document.querySelectorAll("[data-spacer-plus]").forEach((button) => {
    button.addEventListener("click", () => changeSpacer(button.dataset.spacerPlus, 80));
  });
  document.querySelectorAll("[data-spacer-minus]").forEach((button) => {
    button.addEventListener("click", () => changeSpacer(button.dataset.spacerMinus, -80));
  });
  bindLineResizeEvents();
  bindLineNumberBondEvents();
}

function bindAnnotationHighlightPreviewEvents() {
  document.querySelectorAll(".annotation-item").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      const annotationId = item.dataset.annotationId;
      if (isPrintView()) return;
      if (!isDesktopHighlightPreviewMode()) return;
      if (hasNoteHighlights(state.annotations.find((note) => note.id === annotationId))) {
        setHighlightPreview(annotationId);
      }
    });
    item.addEventListener("mouseleave", () => {
      if (isDesktopHighlightPreviewMode()) clearHighlightPreview(item.dataset.annotationId);
    });
    item.addEventListener("pointerdown", (event) => {
      if (isPrintView() || isDesktopHighlightPreviewMode()) return;
      const annotationId = item.dataset.annotationId;
      if (!hasNoteHighlights(state.annotations.find((note) => note.id === annotationId))) return;
      event.stopPropagation();
      previewAnnotationHighlight(annotationId);
    });
  });
  document.querySelectorAll("[data-preview-highlight]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (isDesktopHighlightPreviewMode()) return;
      previewAnnotationHighlight(button.dataset.previewHighlight);
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
}

function setOriginalDragImage(event, card) {
  if (!event.dataTransfer?.setDragImage) return;
  const rect = card.getBoundingClientRect();
  event.dataTransfer.setDragImage(card, event.clientX - rect.left, event.clientY - rect.top);
}

function bindLineResizeEvents() {
  document.querySelectorAll(".law-line[data-line-key]").forEach((line) => {
    line.addEventListener("pointerenter", handleLinePointerEnter);
    line.addEventListener("pointermove", handleLinePointerMove);
    line.addEventListener("pointerleave", handleLinePointerLeave);
    line.addEventListener("pointerdown", handleLinePointerDown);
  });
}

function bindLineNumberBondEvents() {
  document.querySelectorAll(".law-line[data-line-key] .law-line-number").forEach((number) => {
    number.addEventListener("pointerdown", handleLineNumberPointerDown);
    number.addEventListener("click", (event) => event.stopPropagation());
  });
  document.querySelectorAll(".line-lock-button[data-unbond-line]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", handleLineLockClick);
  });
}

function handleLineLockClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const lineKey = event.currentTarget.dataset.unbondLine;
  const bond = findLineBond(lineKey);
  if (!bond) return;

  removeLineBond(bond);
  refreshAllLineBonds({ persist: true });
  persistLocalState();
}

function handleRevisedEditAction(revisedId) {
  if (!revisedId || state.editingSaving) return;
  if (state.editingRevisedId === revisedId) {
    saveRevisedEdit(revisedId);
    return;
  }
  startRevisedEdit(revisedId);
}

function startRevisedEdit(revisedId) {
  const article = findRevisedArticle(revisedId);
  if (!article) return;
  state.editingRevisedId = revisedId;
  state.editingDraft = getEditableRevisedText(article);
  renderBoard();
  requestAnimationFrame(() => {
    const editor = document.querySelector(`[data-revised-editor="${CSS.escape(revisedId)}"]`);
    if (!editor) return;
    editor.focus();
    editor.selectionStart = editor.value.length;
    editor.selectionEnd = editor.value.length;
    autoResizeRevisedEditor(editor);
  });
}

function cancelRevisedEdit() {
  state.editingRevisedId = null;
  state.editingDraft = "";
  renderBoard();
}

async function saveRevisedEdit(revisedId) {
  const article = findRevisedArticle(revisedId);
  const editor = document.querySelector(`[data-revised-editor="${CSS.escape(revisedId)}"]`);
  if (!article || !editor) return;

  const nextText = normalizeEditorText(editor.value);
  const previousText = getEditableRevisedText(article);
  if (nextText === previousText) {
    state.editingRevisedId = null;
    state.editingDraft = "";
    renderBoard();
    return;
  }
  if (!nextText.trim()) {
    showToast("빈 셀은 저장할 수 없습니다.");
    return;
  }

  state.editingSaving = true;
  renderBoard();

  const oldDoc = state.revisedDoc;
  const oldArticle = findRevisedArticle(revisedId);
  const nextMarkdown = buildRevisedMarkdownWithCellEdit(oldArticle, nextText);
  const changedLineKeys = getChangedRevisedLineKeys(oldArticle, nextText);

  try {
    await persistRevisedMarkdown(nextMarkdown);
    changedLineKeys.forEach((lineKey) => removeLineBondByKey(lineKey));
    const nextDoc = parseDocument(nextMarkdown, "revised");
    migrateRevisedLineState(oldDoc, nextDoc);
    state.revisedText = nextMarkdown;
    state.revisedDoc = nextDoc;
    state.editingRevisedId = null;
    state.editingDraft = "";
    state.editingSaving = false;
    persistLocalState();
    renderAll();
    showToast("개정안 md에 저장했습니다.");
  } catch (error) {
    state.editingSaving = false;
    state.editingRevisedId = revisedId;
    state.editingDraft = nextText;
    renderBoard();
    showToast(error.message || "개정안 md 저장에 실패했습니다.");
  }
}

function getEditableRevisedText(article) {
  if (!article) return "";
  if (article.isTitle) return article.title || article.heading || "";
  return cleanArticleLines(article).join("\n");
}

function normalizeEditorText(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

function autoResizeRevisedEditor(editor) {
  editor.style.height = "auto";
  editor.style.height = `${Math.max(getLineHeightUnit(), editor.scrollHeight)}px`;
}

function insertCircledMarker(marker) {
  const editor = document.querySelector(`[data-revised-editor="${CSS.escape(state.editingRevisedId || "")}"]`);
  if (!editor || !marker) return;
  const start = editor.selectionStart ?? editor.value.length;
  const end = editor.selectionEnd ?? start;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  editor.value = `${before}${marker}${after}`;
  const nextCursor = start + marker.length;
  editor.selectionStart = nextCursor;
  editor.selectionEnd = nextCursor;
  state.editingDraft = editor.value;
  editor.focus();
  autoResizeRevisedEditor(editor);
}

function toggleNoteComposer(targetId) {
  if (!targetId) return;
  if (state.noteComposer?.editingId && canWriteNoteBody(state.noteComposer)) {
    saveNoteComposer(state.noteComposer);
  }
  const note = createDraftAnnotation(targetId);
  state.noteComposer = createNoteComposerFromAnnotation(note);
  state.noteComposerOpening = { targetId, editingId: note.id };
  state.noteComposerClosing = null;
  renderBoard();
}

function createNoteComposer(targetId) {
  const defaults = getAnnotationDefaults(targetId);
  return {
    targetId,
    editingId: null,
    isPublic: true,
    kind: "개정이유",
    type: defaults.type,
    level: defaults.level,
    reason: defaults.reason,
    customReason: defaults.customReason,
    originalLines: "",
    revisedLines: "",
    author: state.selectedAuthor,
    highlights: [],
    highlightMode: true,
    body: "",
  };
}

function createDraftAnnotation(targetId) {
  const now = new Date().toISOString();
  const defaults = getAnnotationDefaults(targetId);
  const note = {
    id: `annotation-${Date.now()}`,
    targetId,
    isPublic: true,
    kind: "개정이유",
    type: defaults.type,
    level: defaults.level,
    reason: defaults.reason,
    customReason: defaults.customReason,
    originalLines: "",
    revisedLines: "",
    author: state.selectedAuthor,
    highlights: [],
    body: "",
    createdAt: now,
    updatedAt: now,
  };
  state.annotations.push(note);
  persistLocalState();
  return note;
}

function getAnnotationDefaults(targetId) {
  const defaults = state.annotationDefaults?.[targetId] || {};
  return {
    type: PATCH_TYPES.includes(defaults.type) ? defaults.type : "수정",
    level: NOTE_LEVELS.includes(defaults.level) ? defaults.level : "0단계",
    reason: typeof defaults.reason === "string" ? defaults.reason : "",
    customReason: typeof defaults.customReason === "string" ? defaults.customReason : "",
  };
}

function rememberAnnotationDefaults(composer = state.noteComposer) {
  if (!composer?.targetId) return;
  const nextDefaults = {
    type: PATCH_TYPES.includes(composer.type) ? composer.type : "수정",
    level: NOTE_LEVELS.includes(composer.level) ? composer.level : "0단계",
    reason: composer.reason || "",
    customReason: composer.customReason || "",
  };
  state.annotationDefaults = {
    ...state.annotationDefaults,
    [composer.targetId]: nextDefaults,
  };
}

function createNoteComposerFromAnnotation(note) {
  return {
    targetId: note.targetId,
    editingId: note.id,
    isPublic: note.kind === "댓글" ? false : note.isPublic !== false,
    kind: note.kind || "",
    type: note.type || "",
    level: note.level || "",
    reason: note.reason || "",
    customReason: note.customReason || "",
    originalLines: note.originalLines || "",
    revisedLines: note.revisedLines || "",
    author: NOTE_AUTHORS.includes(note.author) ? note.author : state.selectedAuthor,
    highlights: normalizeNoteHighlights(note.highlights),
    highlightMode: true,
    body: note.body || "",
  };
}

function updateNoteComposerField(field, value, options = {}) {
  const composer = state.noteComposer;
  if (!composer) return;

  if (field === "kind") {
    composer.kind = value;
    if (value === "댓글") {
      composer.isPublic = false;
    }
    if (value === "개정이유" && (!composer.type || !composer.level)) {
      const defaults = getAnnotationDefaults(composer.targetId);
      composer.type = composer.type || defaults.type;
      composer.level = composer.level || defaults.level;
      composer.reason = composer.reason || defaults.reason;
      composer.customReason = composer.customReason || defaults.customReason;
    }
  } else if (field === "type") {
    composer.type = value;
    rememberAnnotationDefaults(composer);
  } else if (field === "level") {
    composer.level = value;
    composer.reason = "";
    composer.customReason = "";
    rememberAnnotationDefaults(composer);
  } else if (field === "reason") {
    composer.reason = value;
    if (value !== "기타") composer.customReason = "";
    rememberAnnotationDefaults(composer);
  } else if (field === "customReason") {
    composer.customReason = value;
    rememberAnnotationDefaults(composer);
  } else if (field === "author") {
    composer.author = value;
    persistDeviceAuthor(value);
  } else if (field === "isPublic") {
    composer.isPublic = composer.kind === "댓글" ? false : value !== false && value !== "false";
  } else if (field === "highlightMode") {
    composer.highlightMode = value !== false && value !== "false";
  } else {
    composer[field] = value;
  }

  saveLiveNoteComposer();
  if (options.preserveFocus) {
    refreshNoteComposerControls();
    if (field === "body") {
      refreshInlineAnnotationBody(composer);
    }
  } else {
    renderBoard();
  }
}

function canWriteNoteBody(composer = state.noteComposer) {
  if (!composer?.kind) return false;
  if (!NOTE_AUTHORS.includes(composer.author)) return false;
  if (composer.kind === "댓글") return true;
  return Boolean(composer.type && composer.level);
}

function canSubmitNote(composer = state.noteComposer) {
  return Boolean(canWriteNoteBody(composer) && composer.body?.trim());
}

function canCloseNoteComposer(composer = state.noteComposer) {
  if (!composer?.editingId) return canSubmitNote(composer);
  return canWriteNoteBody(composer);
}

function refreshNoteComposerControls() {
  const composer = state.noteComposer;
  if (!composer) return;
  const panel = document.querySelector(`[data-note-composer="${CSS.escape(composer.targetId)}"]`);
  if (!panel) return;
  panel.querySelector("[data-note-submit]")?.toggleAttribute("disabled", !canCloseNoteComposer(composer));
}

function refreshInlineAnnotationBody(composer = state.noteComposer) {
  if (!composer?.editingId) return;
  const entry = document.querySelector(`[data-annotation-entry="${CSS.escape(composer.editingId)}"]`);
  const body = entry?.querySelector(".annotation-item .annotation-body");
  if (!body) return;
  body.textContent = annotationBodyText(composer);
  body.classList.toggle("is-placeholder", isAnnotationBodyEmpty(composer));
}

function bindNoteComposerActionButtons(root) {
  root.querySelectorAll("[data-note-submit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      submitNoteComposer();
    });
  });
}

function handleNoteBodyKeydown(event) {
  if (
    event.key !== "Enter"
    || event.shiftKey
    || event.isComposing
    || event.metaKey
    || event.ctrlKey
    || event.altKey
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  submitNoteComposer();
}

function submitNoteComposer() {
  const composer = state.noteComposer;
  if (!canCloseNoteComposer(composer)) return;

  saveNoteComposer(composer);
  animateCloseNoteComposer(composer);
}

function saveLiveNoteComposer() {
  const composer = state.noteComposer;
  if (!composer?.editingId) return;
  if (!canWriteNoteBody(composer) && composer.kind !== "댓글") return;
  saveNoteComposer(composer);
}

function saveNoteComposer(composer) {
  const nextAnnotation = {
    id: composer.editingId || `annotation-${Date.now()}`,
    targetId: composer.targetId,
    isPublic: composer.kind === "댓글" ? false : composer.isPublic !== false,
    kind: composer.kind,
    type: composer.type || "",
    level: composer.level || "",
    reason: composer.reason || "",
    customReason: composer.customReason || "",
    originalLines: composer.originalLines || "",
    revisedLines: composer.revisedLines || "",
    author: NOTE_AUTHORS.includes(composer.author) ? composer.author : "",
    highlights: normalizeNoteHighlights(composer.highlights),
    body: composer.body.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (composer.editingId) {
    const existing = state.annotations.find((note) => note.id === composer.editingId);
    nextAnnotation.createdAt = existing?.createdAt || nextAnnotation.createdAt;
    state.annotations = state.annotations.map((note) => note.id === composer.editingId ? nextAnnotation : note);
  } else {
    state.annotations.push(nextAnnotation);
  }
  delete state.deletedAnnotations[nextAnnotation.id];
  persistLocalState();
  return nextAnnotation;
}

function toggleAnnotationEditor(annotationId) {
  if (state.noteComposer?.editingId === annotationId) {
    if (!canCloseNoteComposer(state.noteComposer)) {
      showToast("저장할 내용을 완성하세요.");
      return;
    }
    saveNoteComposer(state.noteComposer);
    animateCloseNoteComposer(state.noteComposer);
    return;
  }
  editAnnotation(annotationId);
}

function editAnnotation(annotationId) {
  const note = state.annotations.find((item) => item.id === annotationId);
  if (!note) return;
  state.noteComposer = createNoteComposerFromAnnotation(note);
  state.noteComposerOpening = { targetId: note.targetId, editingId: note.id };
  state.noteComposerClosing = null;
  renderBoard();
}

function animateCloseNoteComposer(composer) {
  if (!composer) return;
  const closingComposer = { ...composer };
  state.noteComposer = null;
  state.noteComposerOpening = null;
  state.noteComposerClosing = closingComposer;
  renderBoard();
  window.clearTimeout(animateCloseNoteComposer.timeoutId);
  animateCloseNoteComposer.timeoutId = window.setTimeout(() => {
    if (state.noteComposerClosing?.targetId === closingComposer.targetId && state.noteComposerClosing?.editingId === closingComposer.editingId) {
      state.noteComposerClosing = null;
      renderBoard();
    }
  }, 190);
}

function deleteAnnotation(annotationId) {
  state.annotations = state.annotations.filter((note) => note.id !== annotationId);
  state.deletedAnnotations[annotationId] = new Date().toISOString();
  if (state.noteComposer?.editingId === annotationId) {
    state.noteComposer = null;
    state.noteComposerOpening = null;
  }
  if (state.noteComposerClosing?.editingId === annotationId) {
    state.noteComposerClosing = null;
  }
  persistLocalState();
  renderBoard();
}

function getAnnotationsForTarget(targetId) {
  return state.annotations.filter((note) => {
    if (note.targetId !== targetId) return false;
    if (IS_EDIT_MODE) return true;
    return note.kind !== "댓글" && note.isPublic !== false;
  });
}

function isNoteComposerDirty(composer = state.noteComposer) {
  if (!composer?.editingId) return false;
  const note = state.annotations.find((item) => item.id === composer.editingId);
  if (!note) return true;
  return JSON.stringify(getAnnotationComparable(note)) !== JSON.stringify(getComposerComparable(composer));
}

function getAnnotationComparable(note) {
  return {
    isPublic: note.kind === "댓글" ? false : note.isPublic !== false,
    kind: note.kind || "",
    type: note.type || "",
    level: note.level || "",
    reason: note.reason || "",
    customReason: note.customReason || "",
    originalLines: note.originalLines || "",
    revisedLines: note.revisedLines || "",
    author: note.author || "",
    highlights: normalizeNoteHighlights(note.highlights),
    body: String(note.body || "").trim(),
  };
}

function getComposerComparable(composer) {
  return {
    isPublic: composer.kind === "댓글" ? false : composer.isPublic !== false,
    kind: composer.kind || "",
    type: composer.type || "",
    level: composer.level || "",
    reason: composer.reason || "",
    customReason: composer.customReason || "",
    originalLines: composer.originalLines || "",
    revisedLines: composer.revisedLines || "",
    author: composer.author || "",
    highlights: normalizeNoteHighlights(composer.highlights),
    body: String(composer.body || "").trim(),
  };
}

function normalizeNoteHighlights(highlights) {
  if (!Array.isArray(highlights)) return [];
  return highlights
    .map((highlight) => ({
      lineKey: typeof highlight?.lineKey === "string" ? highlight.lineKey : "",
      start: Number(highlight?.start),
      end: Number(highlight?.end),
      text: typeof highlight?.text === "string" ? highlight.text : "",
    }))
    .filter((highlight) => highlight.lineKey && Number.isFinite(highlight.start) && Number.isFinite(highlight.end) && highlight.end > highlight.start)
    .map((highlight) => ({
      ...highlight,
      start: Math.max(0, Math.floor(highlight.start)),
      end: Math.max(0, Math.floor(highlight.end)),
    }));
}

function levelClassName(level) {
  return `level-${String(level || "").replace(/[^0-9N]/g, "") || "none"}`;
}

function levelRoman(level) {
  const value = String(level || "").match(/[0-5]/)?.[0];
  return ["0", "I", "II", "III", "IV", "V"][Number(value)] || "?";
}

function levelName(level) {
  return NOTE_LEVEL_META[level]?.name || String(level || "단계");
}

function levelCriteria(level) {
  return NOTE_LEVEL_META[level]?.criteria || levelName(level);
}

function displayPatchType(type) {
  return type === "삭제" ? "제거" : type || "유형";
}

async function persistRevisedMarkdown(text) {
  const response = await fetch("/api/revised", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getEditRequestHeaders() },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    let message = "개정안 md 저장 API를 사용할 수 없습니다.";
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      // Keep the default message when the dev server cannot provide JSON.
    }
    throw new Error(message);
  }
}

function buildRevisedMarkdownWithCellEdit(article, nextText) {
  const nextLines = normalizeEditorText(nextText).split("\n");
  const lines = [...state.revisedDoc.lines];
  if (article.isTitle) {
    lines.splice((article.startLine || 1) - 1, 1, `# ${nextLines.join(" ").trim()}`);
    return lines.join("\n");
  }

  const trailingBlankLines = [];
  for (let index = article.contentLines.length - 1; index >= 0; index -= 1) {
    if (article.contentLines[index].trim() !== "") break;
    trailingBlankLines.unshift(article.contentLines[index]);
  }
  const replacement = [...nextLines, ...trailingBlankLines];
  lines.splice(article.startLine - 1, article.endLine - article.startLine + 1, ...replacement);
  return lines.join("\n");
}

function getChangedRevisedLineKeys(article, nextText) {
  if (article.isTitle) return [`revised:title:${article.startLine || 1}`];
  const oldEntries = cleanArticleLineEntries(article);
  const oldLines = oldEntries.map((entry) => entry.text);
  const nextLines = normalizeEditorText(nextText).split("\n").filter((line) => line.trim() !== "");
  if (oldLines.length !== nextLines.length) {
    return getArticleLineKeys("revised", article);
  }
  return oldEntries
    .filter((entry, index) => entry.text !== nextLines[index])
    .map((entry) => `revised:${article.id}:${entry.sourceLine}`);
}

function migrateRevisedLineState(oldDoc, nextDoc) {
  const keyMap = buildRevisedLineKeyMap(oldDoc, nextDoc);
  state.lineBonds = state.lineBonds
    .map((bond) => ({
      leftKey: mapRevisedLineKey(bond.leftKey, keyMap),
      rightKey: mapRevisedLineKey(bond.rightKey, keyMap),
    }))
    .filter((bond) => bond.leftKey && bond.rightKey);
  state.lineHeights = mapLineStateObject(state.lineHeights, keyMap);
  state.lineOffsets = mapLineStateObject(state.lineOffsets, keyMap);
  state.annotations = state.annotations.map((note) => mapAnnotationLineKeys(note, keyMap));
  state.lineBonds = normalizeLineBonds(state.lineBonds);
  repairAnnotationHighlightsForCurrentDocuments();
}

function buildRevisedLineKeyMap(oldDoc, nextDoc) {
  const map = new Map();
  const oldTitleKey = `revised:title:${oldDoc.title?.sourceLine || 1}`;
  const nextTitleKey = `revised:title:${nextDoc.title?.sourceLine || 1}`;
  map.set(oldTitleKey, nextTitleKey);

  oldDoc.articles.forEach((oldArticle) => {
    const nextArticle = nextDoc.articles.find((article) => article.id === oldArticle.id);
    if (!nextArticle) return;
    const oldEntries = cleanArticleLineEntries(oldArticle);
    const nextEntries = cleanArticleLineEntries(nextArticle);
    matchLineEntriesByContent(oldEntries, nextEntries).forEach(([oldEntry, nextEntry]) => {
      map.set(getArticleLineKey("revised", oldArticle, oldEntry), getArticleLineKey("revised", nextArticle, nextEntry));
    });
  });
  return map;
}

function matchLineEntriesByContent(oldEntries, nextEntries) {
  const oldKeys = oldEntries.map((entry) => normalizeLine(entry.text));
  const nextKeys = nextEntries.map((entry) => normalizeLine(entry.text));
  const dp = Array.from({ length: oldKeys.length + 1 }, () => Array(nextKeys.length + 1).fill(0));
  for (let oldIndex = oldKeys.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let nextIndex = nextKeys.length - 1; nextIndex >= 0; nextIndex -= 1) {
      dp[oldIndex][nextIndex] = oldKeys[oldIndex] && oldKeys[oldIndex] === nextKeys[nextIndex]
        ? dp[oldIndex + 1][nextIndex + 1] + 1
        : Math.max(dp[oldIndex + 1][nextIndex], dp[oldIndex][nextIndex + 1]);
    }
  }

  const pairs = [];
  const usedOld = new Set();
  const usedNext = new Set();
  let oldIndex = 0;
  let nextIndex = 0;
  while (oldIndex < oldKeys.length && nextIndex < nextKeys.length) {
    if (oldKeys[oldIndex] && oldKeys[oldIndex] === nextKeys[nextIndex]) {
      pairs.push([oldEntries[oldIndex], nextEntries[nextIndex]]);
      usedOld.add(oldIndex);
      usedNext.add(nextIndex);
      oldIndex += 1;
      nextIndex += 1;
    } else if (dp[oldIndex + 1][nextIndex] >= dp[oldIndex][nextIndex + 1]) {
      oldIndex += 1;
    } else {
      nextIndex += 1;
    }
  }

  oldEntries.forEach((oldEntry, index) => {
    if (usedOld.has(index) || usedNext.has(index) || !nextEntries[index]) return;
    pairs.push([oldEntry, nextEntries[index]]);
    usedOld.add(index);
    usedNext.add(index);
  });
  return pairs;
}

function mapRevisedLineKey(lineKey, keyMap) {
  if (!lineKey?.startsWith("revised:")) return lineKey;
  return keyMap.get(lineKey) || "";
}

function mapAnnotationLineKeys(note, keyMap) {
  return {
    ...note,
    highlights: normalizeNoteHighlights(note.highlights)
      .map((highlight) => {
        if (!highlight.lineKey.startsWith("revised:")) return highlight;
        const nextLineKey = mapRevisedLineKey(highlight.lineKey, keyMap);
        return nextLineKey ? { ...highlight, lineKey: nextLineKey } : null;
      })
      .filter(Boolean),
  };
}

function repairAnnotationHighlightsForCurrentDocuments() {
  state.annotations = state.annotations.map((note) => ({
    ...note,
    highlights: normalizeNoteHighlights(note.highlights)
      .map((highlight) => repairAnnotationHighlight(note, highlight))
      .filter(Boolean),
  }));
}

function repairAnnotationHighlight(note, highlight) {
  if (!highlight.text) return highlight;
  const currentText = getDocumentLineTextByKey(highlight.lineKey);
  const currentFit = fitHighlightToLine(highlight, currentText, highlight.lineKey);
  if (currentFit) return currentFit;
  return findHighlightLineCandidate(note, highlight) || highlight;
}

function fitHighlightToLine(highlight, lineText, lineKey) {
  if (typeof lineText !== "string") return null;
  if (lineText.slice(highlight.start, highlight.end) === highlight.text) return { ...highlight, lineKey };
  const index = lineText.indexOf(highlight.text);
  if (index < 0) return null;
  return {
    ...highlight,
    lineKey,
    start: index,
    end: index + highlight.text.length,
  };
}

function findHighlightLineCandidate(note, highlight) {
  const parsed = parseLawLineKey(highlight.lineKey);
  if (!parsed) return null;
  const entries = getCandidateHighlightLineEntries(note, parsed);
  return entries
    .sort((first, second) => Math.abs(first.sourceLine - parsed.sourceLine) - Math.abs(second.sourceLine - parsed.sourceLine))
    .map((entry) => fitHighlightToLine(highlight, entry.text, entry.lineKey))
    .find(Boolean) || null;
}

function getCandidateHighlightLineEntries(note, parsedLineKey) {
  const article = getHighlightArticleForParsedKey(note, parsedLineKey);
  if (!article) return [];
  if (article.isTitle) {
    return [{
      text: cleanArticleLines(article)[0] || "",
      sourceLine: article.startLine || 1,
      lineKey: `${parsedLineKey.kind}:title:${article.startLine || 1}`,
    }];
  }
  return cleanArticleLineEntries(article).map((entry) => ({
    ...entry,
    lineKey: getArticleLineKey(parsedLineKey.kind, article, entry),
  }));
}

function getHighlightArticleForParsedKey(note, parsedLineKey) {
  if (parsedLineKey.kind === "revised") {
    if (parsedLineKey.isTitle || note.targetId === TITLE_REVISED_ID) return getTitleArticle(state.revisedDoc, "revised");
    return findRevisedArticle(note.targetId) || findRevisedArticle(parsedLineKey.articleId);
  }
  if (parsedLineKey.kind === "original") {
    if (parsedLineKey.isTitle) return getTitleArticle(state.originalDoc, "original");
    return findOriginalArticle(parsedLineKey.articleId);
  }
  return null;
}

function getDocumentLineTextByKey(lineKey) {
  const parsed = parseLawLineKey(lineKey);
  if (!parsed) return "";
  const article = getHighlightArticleForParsedKey({ targetId: parsed.articleId }, parsed);
  if (!article) return "";
  if (article.isTitle) return cleanArticleLines(article)[0] || "";
  return cleanArticleLineEntries(article).find((entry) => entry.sourceLine === parsed.sourceLine)?.text || "";
}

function parseLawLineKey(lineKey) {
  const parts = String(lineKey || "").split(":");
  const kind = parts[0];
  if (!["original", "revised"].includes(kind)) return null;
  if (parts[1] === "title") {
    return {
      kind,
      isTitle: true,
      articleId: "",
      sourceLine: Number(parts[2]) || 1,
    };
  }
  return {
    kind,
    isTitle: false,
    articleId: parts[1] || "",
    sourceLine: Number(parts[2]) || 0,
  };
}

function mapLineStateObject(lineState, keyMap) {
  return Object.fromEntries(
    Object.entries(lineState || {})
      .map(([lineKey, value]) => [mapRevisedLineKey(lineKey, keyMap), value])
      .filter(([lineKey]) => lineKey),
  );
}

function handleLinePointerEnter(event) {
  if (isMobileBondLayoutActive()) return;
  updateLineResizeReady(event.currentTarget, event);
}

function handleLinePointerMove(event) {
  if (isMobileBondLayoutActive()) return;
  if (!lineResize.active) updateLineResizeReady(event.currentTarget, event);
}

function handleLinePointerLeave(event) {
  if (lineResize.active?.line === event.currentTarget) return;
  event.currentTarget.classList.remove("is-resize-ready");
}

function handleLinePointerDown(event) {
  if (isMobileBondLayoutActive()) return;
  const line = event.currentTarget;
  const hit = getLineResizeHit(line, event);
  if (event.button !== 0 || !hit.isHit) return;
  const lineKey = line.dataset.lineKey;
  if (!lineKey) return;

  event.preventDefault();
  event.stopPropagation();

  const autoHeight = measureAutoLineHeight(line);
  const savedHeight = getSavedLineHeight(lineKey);
  const startHeight = Math.max(hit.guideHeight, autoHeight);

  lineResize.active = {
    line,
    lineKey,
    startY: event.clientY,
    startHeight,
    autoHeight,
    nextHeight: savedHeight || null,
  };

  line.classList.add("is-resizing");
  document.body.classList.add("is-resizing-line");

  window.addEventListener("pointermove", handleActiveLineResizeMove);
  window.addEventListener("pointerup", stopActiveLineResize);
  window.addEventListener("pointercancel", stopActiveLineResize);
}

function handleActiveLineResizeMove(event) {
  if (!lineResize.active) return;
  const { line, startY, startHeight, autoHeight } = lineResize.active;
  const targetHeight = startHeight + event.clientY - startY;
  const nextHeight = snapLineHeight(targetHeight, autoHeight);

  if (nextHeight) {
    line.style.minHeight = `${nextHeight}px`;
  } else {
    line.style.removeProperty("min-height");
  }
  lineResize.active.nextHeight = nextHeight;
  syncBondedLineHeights(lineResize.active.lineKey, { sourceLine: line });
}

function stopActiveLineResize() {
  if (!lineResize.active) return;
  const { line, lineKey, nextHeight } = lineResize.active;

  if (isLineBonded(lineKey)) {
    syncBondedLineHeights(lineKey, { persist: true, sourceLine: line });
  } else if (nextHeight) {
    state.lineHeights[lineKey] = nextHeight;
  } else {
    delete state.lineHeights[lineKey];
  }

  line.classList.remove("is-resizing", "is-resize-ready");
  document.body.classList.remove("is-resizing-line");
  lineResize.active = null;
  persistLocalState();

  window.removeEventListener("pointermove", handleActiveLineResizeMove);
  window.removeEventListener("pointerup", stopActiveLineResize);
  window.removeEventListener("pointercancel", stopActiveLineResize);
}

function updateLineResizeReady(line, event) {
  if (isMobileBondLayoutActive()) {
    line.classList.remove("is-resize-ready");
    return { isHit: false, guideHeight: 0 };
  }
  const hit = getLineResizeHit(line, event);
  line.classList.toggle("is-resize-ready", hit.isHit);
  return hit;
}

function measureAutoLineHeight(line) {
  const existingMinHeight = line.style.minHeight;
  line.style.removeProperty("min-height");
  const height = line.getBoundingClientRect().height;
  if (existingMinHeight) line.style.minHeight = existingMinHeight;
  return Math.max(getLineHeightUnit(), height);
}

function snapLineHeight(targetHeight, autoHeight) {
  const unit = getLineHeightUnit();
  const snapped = snapToLineUnit(targetHeight, unit);
  const autoCeiling = Math.max(unit, Math.ceil(autoHeight / unit) * unit);
  return snapped <= autoCeiling ? null : snapped;
}

function getLineResizeHit(line, event) {
  const unit = getLineHeightUnit();
  const rect = line.getBoundingClientRect();
  const localY = event.clientY - rect.top;
  const guideHeight = Math.round(localY / unit) * unit;
  const maxGuideHeight = Math.max(unit, Math.round(rect.height / unit) * unit);
  const isGuideInRange = guideHeight >= unit && guideHeight <= maxGuideHeight;
  const distance = Math.abs(localY - guideHeight);
  return {
    isHit: isGuideInRange && distance <= LINE_RESIZE_HIT_SLOP,
    guideHeight,
  };
}

function snapToLineUnit(value, unit = getLineHeightUnit()) {
  return Math.max(unit, Math.round(value / unit) * unit);
}

function getLineHeightUnit() {
  const source = IS_PRESENT_MODE
    ? document.querySelector(".presentation-cells") || document.documentElement
    : document.documentElement;
  const value = Number.parseFloat(getComputedStyle(source).getPropertyValue("--law-line-step"));
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LINE_HEIGHT_UNIT;
}

function handleLineNumberPointerDown(event) {
  if (isMobileBondLayoutActive()) return;
  if (event.button !== 0 || document.body.classList.contains("is-resizing-line")) return;
  event.stopPropagation();
  event.preventDefault();

  const number = event.currentTarget;
  const line = number.closest(".law-line[data-line-key]");
  if (!line || !line.dataset.lineKey || !getLineNumberText(line)) {
    shakeLineNumber(number);
    return;
  }

  state.draggedLineKey = line.dataset.lineKey;
  lineNumberDrag.active = false;
  lineNumberDrag.sourceLine = line;
  lineNumberDrag.sourceNumber = number;
  lineNumberDrag.sourceAnchor = getLineNumberCenter(number);
  lineNumberDrag.pointerId = event.pointerId;
  lineNumberDrag.startX = event.clientX;
  lineNumberDrag.startY = event.clientY;
  try {
    number.setPointerCapture(event.pointerId);
  } catch {
    // Some browsers release capture automatically when native dragging is interrupted.
  }

  window.addEventListener("pointermove", handleActiveLineNumberPointerMove);
  window.addEventListener("pointerup", stopLineNumberPointerDrag);
  window.addEventListener("pointercancel", cancelLineNumberPointerDrag);
}

function handleActiveLineNumberPointerMove(event) {
  if (!lineNumberDrag.sourceLine) return;
  const distance = Math.hypot(event.clientX - lineNumberDrag.startX, event.clientY - lineNumberDrag.startY);
  if (distance < LINE_NUMBER_DRAG_THRESHOLD && !lineNumberDrag.active) return;
  if (!lineNumberDrag.active) startLineNumberDragVisual();
  lineNumberDrag.active = true;
  lineNumberDrag.sourceNumber?.classList.add("is-line-number-dragging");
  document.body.classList.add("is-dragging-line-number");
  updateLineNumberDragVisual(event.clientX, event.clientY);
}

function stopLineNumberPointerDrag(event) {
  const wasActive = lineNumberDrag.active;
  const sourceLine = lineNumberDrag.sourceLine;
  const sourceNumber = lineNumberDrag.sourceNumber;

  if (!wasActive || !sourceLine) {
    cleanupLineNumberPointerDrag();
    return;
  }
  const targetElement = document.elementFromPoint(event.clientX, event.clientY);
  const targetLine = targetElement?.closest(".law-line[data-line-key]");
  const targetNumber = targetLine?.querySelector(".law-line-number");
  if (!targetNumber || !targetLine || !isValidLineBondPair(sourceLine, targetLine)) {
    cleanupLineNumberPointerDrag();
    if (targetNumber) shakeLineNumber(targetNumber);
    if (sourceNumber) shakeLineNumber(sourceNumber);
    return;
  }

  createLineBond(sourceLine, targetLine, { alignPositions: true });
  cleanupLineNumberPointerDrag();
}

function cancelLineNumberPointerDrag() {
  cleanupLineNumberPointerDrag();
}

function cleanupLineNumberPointerDrag() {
  if (lineNumberDrag.pointerId !== null) {
    try {
      lineNumberDrag.sourceNumber?.releasePointerCapture(lineNumberDrag.pointerId);
    } catch {
      // Capture may already be released by pointerup or pointercancel.
    }
  }
  lineNumberDrag.sourceNumber?.classList.remove("is-line-number-dragging");
  removeLineNumberDragVisual();
  lineNumberDrag.active = false;
  lineNumberDrag.sourceLine = null;
  lineNumberDrag.sourceNumber = null;
  lineNumberDrag.sourceAnchor = null;
  lineNumberDrag.pointerId = null;
  state.draggedLineKey = null;
  document.body.classList.remove("is-dragging-line-number");
  window.removeEventListener("pointermove", handleActiveLineNumberPointerMove);
  window.removeEventListener("pointerup", stopLineNumberPointerDrag);
  window.removeEventListener("pointercancel", cancelLineNumberPointerDrag);
}

function startLineNumberDragVisual() {
  if (lineNumberDrag.overlay || !lineNumberDrag.sourceNumber) return;
  const overlay = document.createElement("div");
  overlay.className = "line-link-drag-overlay";
  overlay.innerHTML = `
    <span class="line-link-connector" aria-hidden="true"></span>
    <span class="line-link-ghost" aria-hidden="true">${escapeHtml(getLineNumberText(lineNumberDrag.sourceLine))}</span>
    <span class="line-link-icon" aria-hidden="true"></span>
  `;
  document.body.append(overlay);
  lineNumberDrag.overlay = overlay;
  lineNumberDrag.connector = overlay.querySelector(".line-link-connector");
  lineNumberDrag.ghost = overlay.querySelector(".line-link-ghost");
  lineNumberDrag.icon = overlay.querySelector(".line-link-icon");
}

function updateLineNumberDragVisual(clientX, clientY) {
  if (!lineNumberDrag.overlay || !lineNumberDrag.sourceAnchor) return;

  const anchor = lineNumberDrag.sourceAnchor;
  const dx = clientX - anchor.x;
  const dy = clientY - anchor.y;
  const distance = Math.hypot(dx, dy);
  const unitX = distance ? dx / distance : 0;
  const unitY = distance ? dy / distance : 0;
  const resistedDistance = Math.min(distance, LINE_LINK_RESISTANCE_RADIUS) * LINE_LINK_RESISTANCE;
  const dissolveProgress = clamp((distance - LINE_LINK_DISSOLVE_START) / (LINE_LINK_RESISTANCE_RADIUS - LINE_LINK_DISSOLVE_START), 0, 1);
  const ghostX = anchor.x + unitX * resistedDistance;
  const ghostY = anchor.y + unitY * resistedDistance;

  positionCenteredElement(lineNumberDrag.ghost, ghostX, ghostY);
  positionCenteredElement(lineNumberDrag.icon, clientX, clientY);
  lineNumberDrag.ghost.style.opacity = String(1 - dissolveProgress);
  lineNumberDrag.icon.style.opacity = String(dissolveProgress);
  lineNumberDrag.icon.classList.toggle("is-active", dissolveProgress >= 1);
  updateLineLinkConnector(anchor.x, anchor.y, clientX, clientY, dissolveProgress);
}

function updateLineLinkConnector(startX, startY, endX, endY, opacity) {
  const connector = lineNumberDrag.connector;
  if (!connector) return;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy);
  connector.style.left = `${startX}px`;
  connector.style.top = `${startY}px`;
  connector.style.width = `${Math.max(0, length - 9)}px`;
  connector.style.opacity = String(opacity);
  connector.style.transform = `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`;
}

function positionCenteredElement(element, x, y) {
  if (!element) return;
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
}

function removeLineNumberDragVisual() {
  lineNumberDrag.overlay?.remove();
  lineNumberDrag.overlay = null;
  lineNumberDrag.ghost = null;
  lineNumberDrag.connector = null;
  lineNumberDrag.icon = null;
}

function getLineNumberCenter(number) {
  const rect = number.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getLineSide(line) {
  const card = line.closest(".article-card");
  if (!card) return null;
  return card.classList.contains("original") ? "left" : "right";
}

function getLineNumberText(line) {
  return line.querySelector(".law-line-number")?.textContent.trim() || "";
}

function hasActiveTextSelection() {
  const selection = window.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

function isValidLineBondPair(firstLine, secondLine) {
  if (!firstLine || !secondLine || firstLine === secondLine) return false;
  const firstSide = getLineSide(firstLine);
  const secondSide = getLineSide(secondLine);
  const sameRow = firstLine.closest(".alignment-row") === secondLine.closest(".alignment-row");
  return Boolean(sameRow && firstLine.dataset.lineKey && secondLine.dataset.lineKey && getLineNumberText(firstLine) && getLineNumberText(secondLine) && firstSide && secondSide && firstSide !== secondSide);
}

function createLineBond(firstLine, secondLine, options = {}) {
  if (isMobileBondLayoutActive()) return;
  const firstSide = getLineSide(firstLine);
  const secondSide = getLineSide(secondLine);
  if (!firstSide || !secondSide || firstSide === secondSide) {
    shakeLineNumber(firstLine.querySelector(".law-line-number"));
    return;
  }

  const leftLine = firstSide === "left" ? firstLine : secondLine;
  const rightLine = firstSide === "right" ? firstLine : secondLine;
  const leftKey = leftLine.dataset.lineKey;
  const rightKey = rightLine.dataset.lineKey;
  if (!leftKey || !rightKey) return;

  removeLineBondByKey(leftKey);
  removeLineBondByKey(rightKey);
  state.lineBonds.push({ leftKey, rightKey });
  refreshAllLineBonds({ persist: true });
  persistLocalState();
}

function removeLineBond(bond) {
  clearLineOffset(bond.leftKey, { persist: true });
  clearLineOffset(bond.rightKey, { persist: true });
  clearLineHeight(bond.leftKey, { persist: true });
  clearLineHeight(bond.rightKey, { persist: true });
  state.lineBonds = state.lineBonds.filter((entry) => entry !== bond);
}

function removeLineBondByKey(lineKey) {
  const removedBonds = state.lineBonds.filter((bond) => bond.leftKey === lineKey || bond.rightKey === lineKey);
  removedBonds.forEach((bond) => {
    clearLineOffset(bond.leftKey, { persist: true });
    clearLineOffset(bond.rightKey, { persist: true });
    clearLineHeight(bond.leftKey, { persist: true });
    clearLineHeight(bond.rightKey, { persist: true });
  });
  state.lineBonds = state.lineBonds.filter((bond) => bond.leftKey !== lineKey && bond.rightKey !== lineKey);
}

function releaseLineBondsForOriginal(originalId) {
  const article = findOriginalArticle(originalId);
  if (!article) return;
  getArticleLineKeys("original", article).forEach((lineKey) => removeLineBondByKey(lineKey));
}

function getArticleLineKeys(kind, article) {
  if (!article) return [];
  if (article.isTitle) return [`${kind}:title:${article.startLine || 1}`];
  return cleanArticleLineEntries(article).map((entry) => getArticleLineKey(kind, article, entry));
}

function getArticleLineKey(kind, article, entry) {
  if (article?.isTitle) return `${kind}:title:${article.startLine || 1}`;
  return `${kind}:${article.id}:${entry.sourceLine}`;
}

function findLineBond(lineKey) {
  if (!lineKey) return null;
  return state.lineBonds.find((bond) => bond.leftKey === lineKey || bond.rightKey === lineKey) || null;
}

function isLineBonded(lineKey) {
  return Boolean(findLineBond(lineKey));
}

function getBondedLineKeys(lineKey) {
  const bond = findLineBond(lineKey);
  return bond ? [bond.leftKey, bond.rightKey] : [];
}

function applyLineBondClasses() {
  document.querySelectorAll(".law-line.is-line-bonded").forEach((line) => line.classList.remove("is-line-bonded"));
  if (isMobileBondLayoutActive()) return;
  state.lineBonds.forEach((bond) => {
    [bond.leftKey, bond.rightKey].forEach((lineKey) => {
      findRenderedLine(lineKey)?.classList.add("is-line-bonded");
    });
  });
}

function scheduleLineBondLayoutRefresh(options = {}) {
  const shouldPersist = options.persist !== false;
  if (lineBondLayoutFrame) cancelAnimationFrame(lineBondLayoutFrame);
  window.clearTimeout(lineBondLayoutSaveTimer);

  lineBondLayoutFrame = requestAnimationFrame(() => {
    lineBondLayoutFrame = 0;
    refreshAllLineBonds({ persist: shouldPersist });
  });

  if (!shouldPersist) return;
  lineBondLayoutSaveTimer = window.setTimeout(() => {
    refreshAllLineBonds({ persist: true });
    persistLocalState();
  }, 180);
}

function refreshAllLineBonds(options = {}) {
  const shouldPersist = options.persist !== false;
  if (isMobileBondLayoutActive()) {
    clearRenderedLineLayoutAdjustments();
    applyLineBondClasses();
    return;
  }
  const orderedBonds = getRenderedLineBondsInDocumentOrder();
  const bondedLineKeys = new Set(orderedBonds.flatMap((bond) => [bond.leftKey, bond.rightKey]));

  bondedLineKeys.forEach((lineKey) => {
    clearLineOffset(lineKey, { persist: shouldPersist });
    clearLineHeight(lineKey, { persist: shouldPersist });
  });

  orderedBonds.forEach((bond) => {
    alignBondedLinePositions(bond.leftKey, bond.rightKey, { persist: shouldPersist });
    syncBondedLineHeights(bond.leftKey, { persist: shouldPersist });
  });
  applyLineBondClasses();
}

function clearRenderedLineLayoutAdjustments() {
  document.querySelectorAll(".law-line[data-line-key]").forEach((line) => {
    line.style.removeProperty("min-height");
    line.style.removeProperty("padding-top");
    line.style.removeProperty("--line-link-offset");
  });
}

function getRenderedLineBondsInDocumentOrder() {
  return state.lineBonds
    .map((bond) => {
      const leftLine = findRenderedLine(bond.leftKey);
      const rightLine = findRenderedLine(bond.rightKey);
      if (!leftLine || !rightLine) return null;
      const top = Math.min(leftLine.getBoundingClientRect().top, rightLine.getBoundingClientRect().top);
      return { ...bond, top };
    })
    .filter(Boolean)
    .sort((first, second) => first.top - second.top);
}

function alignBondedLinePositions(leftKey, rightKey, options = {}) {
  const leftLine = findRenderedLine(leftKey);
  const rightLine = findRenderedLine(rightKey);
  if (!leftLine || !rightLine) return;

  clearLineOffset(leftKey, options);
  clearLineOffset(rightKey, options);

  const leftY = getLineNumberAnchorY(leftLine);
  const rightY = getLineNumberAnchorY(rightLine);
  const offset = Math.round(Math.abs(leftY - rightY));
  if (offset < 1) return;

  const lineToMove = leftY < rightY ? leftLine : rightLine;
  applyLineOffset(lineToMove, offset, options);
}

function getLineNumberAnchorY(line) {
  return line.querySelector(".law-line-number")?.getBoundingClientRect().top || line.getBoundingClientRect().top;
}

function syncBondedLineHeights(lineKey, options = {}) {
  const lineKeys = getBondedLineKeys(lineKey);
  if (lineKeys.length !== 2) return null;

  const lines = lineKeys.map(findRenderedLine);
  if (lines.some((line) => !line)) return null;

  const sourceLine = options.sourceLine || findRenderedLine(lineKey);
  const sourceHeight = sourceLine ? getLineHeightMetrics(sourceLine).currentVisualHeight : 0;
  const lineMetrics = lines.map(getLineHeightMetrics);
  const candidateHeights = options.useCurrentHeights
    ? lineMetrics.map((metrics) => metrics.currentVisualHeight)
    : [sourceHeight, ...lineMetrics.map((metrics) => metrics.autoVisualHeight)];
  const targetVisualHeight = snapToLineUnit(Math.max(...candidateHeights));
  lines.forEach((line) => applyLineVisualHeight(line, targetVisualHeight, options));
  return targetVisualHeight;
}

function getLineHeightMetrics(line) {
  const unit = getLineHeightUnit();
  const offset = getLineOffsetHeight(line);
  const currentHeight = line.getBoundingClientRect().height;
  const autoHeight = measureAutoLineHeight(line);
  return {
    offset,
    currentHeight,
    autoHeight,
    currentVisualHeight: Math.max(unit, currentHeight - offset),
    autoVisualHeight: Math.max(unit, autoHeight - offset),
  };
}

function getLineOffsetHeight(line) {
  const inlineOffset = Number.parseFloat(line.style.paddingTop);
  if (Number.isFinite(inlineOffset)) return Math.max(0, inlineOffset);
  const computedOffset = Number.parseFloat(getComputedStyle(line).paddingTop);
  return Number.isFinite(computedOffset) ? Math.max(0, computedOffset) : 0;
}

function applyLineVisualHeight(line, targetVisualHeight, options = {}) {
  const lineKey = line.dataset.lineKey;
  const metrics = getLineHeightMetrics(line);
  const snappedVisualHeight = snapToLineUnit(targetVisualHeight);
  const nextHeight = snappedVisualHeight > metrics.autoVisualHeight ? Math.round(metrics.offset + snappedVisualHeight) : null;

  if (nextHeight) {
    line.style.minHeight = `${nextHeight}px`;
    if (options.persist && lineKey) state.lineHeights[lineKey] = nextHeight;
  } else {
    line.style.removeProperty("min-height");
    if (options.persist && lineKey) delete state.lineHeights[lineKey];
  }
}

function clearLineHeight(lineKey, options = {}) {
  const line = findRenderedLine(lineKey);
  if (line) line.style.removeProperty("min-height");
  if (options.persist && lineKey) delete state.lineHeights[lineKey];
}

function applyLineOffset(line, offset, options = {}) {
  const lineKey = line.dataset.lineKey;
  const nextOffset = Math.max(0, Math.round(Number(offset) || 0));
  if (nextOffset) {
    line.style.paddingTop = `${nextOffset}px`;
    line.style.setProperty("--line-link-offset", `${nextOffset}px`);
    if (options.persist && lineKey) state.lineOffsets[lineKey] = nextOffset;
  } else {
    line.style.removeProperty("padding-top");
    line.style.removeProperty("--line-link-offset");
    if (options.persist && lineKey) delete state.lineOffsets[lineKey];
  }
}

function clearLineOffset(lineKey, options = {}) {
  const line = findRenderedLine(lineKey);
  if (line) {
    line.style.removeProperty("padding-top");
    line.style.removeProperty("--line-link-offset");
  }
  if (options.persist && lineKey) delete state.lineOffsets[lineKey];
}

function findRenderedLine(lineKey) {
  if (!lineKey) return null;
  return document.querySelector(`.law-line[data-line-key="${CSS.escape(lineKey)}"]`);
}

function shakeLineNumber(number) {
  if (!number) return;
  number.classList.remove("is-line-bond-error");
  void number.offsetWidth;
  number.classList.add("is-line-bond-error");
}

function canDropAnnotationOnEntry(entry) {
  return Boolean(
    state.draggedAnnotationId
    && state.draggedAnnotationTargetId
    && entry.dataset.annotationTarget === state.draggedAnnotationTargetId,
  );
}

function getAnnotationDropPlacement(entry, clientY) {
  const rect = entry.getBoundingClientRect();
  return clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function markAnnotationDropTarget(entry, clientY) {
  clearAnnotationDropTargets();
  entry.classList.add(getAnnotationDropPlacement(entry, clientY) === "before" ? "is-annotation-drop-before" : "is-annotation-drop-after");
}

function reorderAnnotationWithinTarget(annotationId, overId, placement = "after") {
  if (!annotationId || !overId || annotationId === overId) {
    renderBoard();
    return;
  }
  const dragged = state.annotations.find((note) => note.id === annotationId);
  const over = state.annotations.find((note) => note.id === overId);
  if (!dragged || !over || dragged.targetId !== over.targetId) {
    renderBoard();
    return;
  }

  const targetNotes = state.annotations.filter((note) => note.targetId === dragged.targetId && note.id !== annotationId);
  const overIndex = targetNotes.findIndex((note) => note.id === overId);
  if (overIndex === -1) {
    renderBoard();
    return;
  }
  const insertIndex = placement === "before" ? overIndex : overIndex + 1;
  targetNotes.splice(insertIndex, 0, dragged);

  const nextByTarget = [...targetNotes];
  state.annotations = state.annotations.map((note) => {
    if (note.targetId !== dragged.targetId) return note;
    return nextByTarget.shift();
  });
  persistLocalState();
  renderBoard();
}

function clearAnnotationDropTargets() {
  document.querySelectorAll(".annotation-entry.is-annotation-drop-before, .annotation-entry.is-annotation-drop-after").forEach((entry) => {
    entry.classList.remove("is-annotation-drop-before", "is-annotation-drop-after");
  });
}

function cleanupAnnotationDrag(options = {}) {
  state.draggedAnnotationId = null;
  state.draggedAnnotationTargetId = null;
  document.body.classList.remove("is-dragging-annotation");
  document.querySelectorAll(".annotation-entry.is-annotation-dragging").forEach((entry) => {
    entry.classList.remove("is-annotation-dragging");
  });
  clearAnnotationDropTargets();
  if (options.render) renderBoard();
}

function updateDropPreview(zone, clientY) {
  if (!state.draggedOriginalId) return;
  const placeholder = getDropPlaceholder();
  const cards = [...zone.querySelectorAll(".article-card.original:not(.dragging)")];
  const beforeCard = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });

  if (beforeCard) {
    zone.insertBefore(placeholder, beforeCard);
  } else {
    zone.appendChild(placeholder);
  }

  requestAnimationFrame(() => {
    placeholder.style.height = `${dragPreview.height}px`;
  });
}

function getDropPlaceholder() {
  if (dragPreview.placeholder) return dragPreview.placeholder;
  const placeholder = document.createElement("div");
  placeholder.className = "article-drop-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.style.height = "0px";
  dragPreview.placeholder = placeholder;
  return placeholder;
}

function getDropPreviewIndex(zone) {
  const placeholder = dragPreview.placeholder;
  if (!placeholder || placeholder.parentElement !== zone) return null;
  return [...zone.children]
    .filter((child) => child.matches(".article-card.original, .article-drop-placeholder") && !child.classList.contains("dragging"))
    .indexOf(placeholder);
}

function cleanupDropPreview() {
  document.body.classList.remove("is-dragging-original");
  document.querySelectorAll(".article-slot.is-drop-target").forEach((zone) => zone.classList.remove("is-drop-target"));
  clearInsertDropTargets();
  dragPreview.placeholder?.remove();
  dragPreview.placeholder = null;
}

function clearInsertDropTargets() {
  document.querySelectorAll(".between-row-drop-zone.is-insert-target").forEach((zone) => zone.classList.remove("is-insert-target"));
}

function assignOriginalToRevised(originalId, revisedId, insertIndex = null) {
  if (!originalId || !revisedId) return;
  releaseLineBondsForOriginal(originalId);
  removeOriginalFromDeletedRows(originalId);
  if (!state.allowDuplicate) {
    removeOriginalFromAlignments(originalId);
  }
  const alignment = getAlignment(revisedId);
  alignment.originalArticleIds = alignment.originalArticleIds.filter((id) => id !== originalId);
  const safeIndex = insertIndex === null
    ? alignment.originalArticleIds.length
    : Math.max(0, Math.min(insertIndex, alignment.originalArticleIds.length));
  alignment.originalArticleIds.splice(safeIndex, 0, originalId);
  alignment.manual = true;
  state.selectedRevisedId = revisedId;
  persistLocalState();
  renderAll();
}

function assignOriginalToDeletedRow(originalId, beforeRevisedId) {
  if (!originalId || !beforeRevisedId) return;
  const article = findOriginalArticle(originalId);
  if (!article) return;

  releaseLineBondsForOriginal(originalId);
  removeOriginalFromAlignments(originalId);
  removeOriginalFromDeletedRows(originalId);
  state.deletedRows.push({
    id: `deleted-row-${originalId}`,
    originalArticleId: originalId,
    beforeRevisedId,
    height: Math.max(72, dragPreview.height || 72),
  });
  state.selectedRevisedId = beforeRevisedId;
  persistLocalState();
  renderAll();
}

function removeOriginalFromAlignments(originalId) {
  Object.values(state.alignments).forEach((alignment) => {
    alignment.originalArticleIds = alignment.originalArticleIds.filter((id) => id !== originalId);
  });
}

function removeOriginalFromDeletedRows(originalId) {
  state.deletedRows = state.deletedRows.filter((row) => row.originalArticleId !== originalId);
}

function removeOriginalFromRevised(originalId, revisedId) {
  const alignment = getAlignment(revisedId);
  releaseLineBondsForOriginal(originalId);
  alignment.originalArticleIds = alignment.originalArticleIds.filter((id) => id !== originalId);
  alignment.manual = true;
  persistLocalState();
  renderAll();
}

function changeSpacer(revisedId, amount) {
  const alignment = getAlignment(revisedId);
  alignment.spacerHeight = Math.max(0, Math.min(640, (alignment.spacerHeight || 0) + amount));
  alignment.manual = true;
  persistLocalState();
  renderBoard();
}

function renderInspector() {
  if (!els.selectedArticleLabel || !els.patchNoteList || !els.plusNoteList) return;
  const article = findRevisedArticle(state.selectedRevisedId);
  if (!article) return;
  els.selectedArticleLabel.textContent = `${article.label}(${article.title})`;
  els.patchNoteList.innerHTML = article.patchNoteIds
    .map((id) => findPatchNote(id))
    .filter((note) => note && !note.deleted)
    .map(renderPatchNoteEditor)
    .join("") || `<div class="validation-item">연결된 패치노트가 없습니다.</div>`;
  els.plusNoteList.innerHTML = article.plusNoteIds
    .map((id) => findPlusNote(id))
    .filter(Boolean)
    .map(renderPlusNoteCard)
    .join("") || `<div class="validation-item">전환 대기 메모가 없습니다.</div>`;
  bindInspectorEvents();
}

function renderPatchNoteEditor(note) {
  return `
    <section class="note-card" data-note-id="${note.id}">
      <div class="note-select-row">
        <select data-note-field="type">
          ${PATCH_TYPES.map((type) => `<option value="${type}" ${note.type === type ? "selected" : ""}>${type}</option>`).join("")}
        </select>
        <select data-note-field="level">
          ${PATCH_LEVELS.map((level) => `<option value="${level}" ${note.level === level ? "selected" : ""}>${level}</option>`).join("")}
        </select>
      </div>
      <input class="text-input" data-note-field="commonTags" type="text" value="${escapeAttribute(note.commonTags.join(", "))}" placeholder="반복 변경 태그" />
      <textarea class="text-input" data-note-field="description">${escapeHtml(note.description)}</textarea>
      <div class="note-actions">
        <span class="badge-pill ${note.status === "검토 필요" ? "warning" : ""}">${note.status}</span>
        <button class="mini-button danger" data-delete-note="${note.id}" type="button">삭제</button>
      </div>
    </section>
  `;
}

function renderPlusNoteCard(note) {
  const converted = note.convertedPatchNoteId ? "converted" : "";
  const convertedLabel = note.convertedPatchNoteId ? "전환 완료" : "패치노트로 변환";
  return `
    <section class="note-card ${converted}">
      <p><strong>${escapeHtml(note.authorLabel || "메모")}</strong></p>
      <p>${escapeHtml(note.rawText)}</p>
      <div class="note-actions">
        <span class="badge-pill">${note.sourceLine}행</span>
        <button class="mini-button" data-convert-plus="${note.id}" type="button" ${note.convertedPatchNoteId ? "disabled" : ""}>${convertedLabel}</button>
      </div>
    </section>
  `;
}

function bindInspectorEvents() {
  els.patchNoteList.querySelectorAll("[data-note-field]").forEach((field) => {
    field.addEventListener("change", () => updatePatchNoteField(field));
    field.addEventListener("input", () => updatePatchNoteField(field, { quiet: true }));
  });
  els.patchNoteList.querySelectorAll("[data-delete-note]").forEach((button) => {
    button.addEventListener("click", () => deletePatchNote(button.dataset.deleteNote));
  });
  els.plusNoteList.querySelectorAll("[data-convert-plus]").forEach((button) => {
    button.addEventListener("click", () => convertPlusNote(button.dataset.convertPlus));
  });
}

function updatePatchNoteField(field, options = {}) {
  const noteId = field.closest("[data-note-id]").dataset.noteId;
  const note = findPatchNote(noteId);
  if (!note) return;
  const key = field.dataset.noteField;
  if (key === "commonTags") {
    note.commonTags = field.value.split(",").map((item) => item.trim()).filter(Boolean);
  } else {
    note[key] = field.value;
  }
  note.status = note.level === "N단계" || hasDraftMarker(note.description) ? "검토 필요" : "초안";
  persistLocalState();
  if (!options.quiet) renderAll();
}

function addManualPatchNote() {
  const article = findRevisedArticle(state.selectedRevisedId);
  if (!article) return;
  const description = els.noteDescription.value.trim();
  if (!description) {
    showToast("패치노트 설명을 입력하세요.");
    return;
  }
  const note = {
    id: `patch-manual-${Date.now()}`,
    type: state.selectedType,
    level: state.selectedLevel,
    commonTags: els.tagInput.value.split(",").map((item) => item.trim()).filter(Boolean),
    description,
    source: "manual",
    sourceLine: null,
    targetId: article.id,
    status: state.selectedLevel === "N단계" || hasDraftMarker(description) ? "검토 필요" : "초안",
    missingLevel: state.selectedLevel === "N단계",
    deleted: false,
  };
  state.revisedDoc.patchNotes.push(note);
  article.patchNoteIds.push(note.id);
  els.tagInput.value = "";
  els.noteDescription.value = "";
  persistLocalState();
  renderAll();
}

function convertPlusNote(plusNoteId) {
  const plusNote = findPlusNote(plusNoteId);
  const article = findRevisedArticle(plusNote?.targetId);
  if (!plusNote || !article || plusNote.convertedPatchNoteId) return;
  const note = {
    id: `patch-converted-${plusNote.sourceLine}`,
    type: "수정",
    level: "N단계",
    commonTags: plusNote.authorLabel ? [plusNote.authorLabel] : [],
    description: plusNote.rawText,
    source: "converted-plus-note",
    sourceLine: plusNote.sourceLine,
    targetId: article.id,
    status: "검토 필요",
    missingLevel: true,
    deleted: false,
  };
  state.revisedDoc.patchNotes.push(note);
  article.patchNoteIds.push(note.id);
  plusNote.convertedPatchNoteId = note.id;
  persistLocalState();
  renderAll();
}

function deletePatchNote(noteId) {
  const note = findPatchNote(noteId);
  if (!note) return;
  note.deleted = true;
  const article = findRevisedArticle(note.targetId);
  if (article) article.patchNoteIds = article.patchNoteIds.filter((id) => id !== noteId);
  state.revisedDoc.plusNotes.forEach((plusNote) => {
    if (plusNote.convertedPatchNoteId === noteId) plusNote.convertedPatchNoteId = null;
  });
  persistLocalState();
  renderAll();
}

function renderValidation() {
  if (!els.validationStatus || !els.validationList) return;
  const warnings = collectWarnings();
  els.validationStatus.textContent = warnings.length ? `${warnings.length}개 검토 필요` : "검증 통과";
  els.validationStatus.className = warnings.length ? "badge-pill warning" : "badge-pill success";
  els.validationList.innerHTML = warnings.slice(0, 12).map((warning) => {
    return `<div class="validation-item ${warning.severity}">${escapeHtml(warning.message)}</div>`;
  }).join("") || `<div class="validation-item">현재 표시할 경고가 없습니다.</div>`;
}

function collectWarnings() {
  const warnings = [];
  state.revisedDoc.patchNotes.filter((note) => !note.deleted).forEach((note) => {
    if (note.level === "N단계") warnings.push({ severity: "warning", message: `${articleLabel(note.targetId)}: N단계가 남아 있습니다.` });
    if (note.missingLevel) warnings.push({ severity: "warning", message: `${articleLabel(note.targetId)}: 원문 패치노트에 단계가 없습니다.` });
    if (!note.description || hasDraftMarker(note.description)) warnings.push({ severity: "warning", message: `${articleLabel(note.targetId)}: 패치노트 설명을 다듬어야 합니다.` });
  });
  state.revisedDoc.plusNotes.forEach((note) => {
    if (!note.convertedPatchNoteId) warnings.push({ severity: "warning", message: `${articleLabel(note.targetId)}: ++ 메모가 패치노트로 전환되지 않았습니다.` });
  });
  state.revisedDoc.articles.forEach((article) => {
    const text = article.contentLines.join("\n");
    if (/수정 필요|보충 작성 필요|미완성|<삭제>/.test(text)) {
      warnings.push({ severity: "warning", message: `${article.label}: 임시 표현이 남아 있습니다.` });
    }
  });
  return warnings;
}

function rowPassesFilter(article) {
  if (state.filter === "all") return true;
  const alignment = getAlignment(article.id);
  if (state.filter === "changed") {
    return alignment.originalArticleIds.length !== 1 || article.patchNoteIds.length || article.plusNoteIds.length;
  }
  if (state.filter === "notes") {
    return article.patchNoteIds.length || article.plusNoteIds.length;
  }
  if (state.filter === "needsReview") {
    return collectWarnings().some((warning) => warning.message.startsWith(article.label));
  }
  return true;
}

function getAlignment(revisedId) {
  if (!state.alignments[revisedId]) {
    state.alignments[revisedId] = {
      revisedArticleId: revisedId,
      originalArticleIds: [],
      manual: false,
      spacerHeight: 0,
    };
  }
  return state.alignments[revisedId];
}

function ensureTitleAlignment() {
  if (state.alignments[TITLE_REVISED_ID]) return;
  state.alignments[TITLE_REVISED_ID] = {
    revisedArticleId: TITLE_REVISED_ID,
    originalArticleIds: [TITLE_ORIGINAL_ID],
    manual: false,
    spacerHeight: 0,
  };
}

function getTitleArticle(doc, kind) {
  const title = doc?.title || { text: "", sourceLine: 1 };
  const patchNoteIds = kind === "revised"
    ? (doc.patchNotes || []).filter((note) => note.targetId === TITLE_REVISED_ID && !note.deleted).map((note) => note.id)
    : [];
  return {
    id: kind === "original" ? TITLE_ORIGINAL_ID : TITLE_REVISED_ID,
    number: 0,
    label: "제목",
    title: title.text || "",
    chapter: "제목",
    heading: title.text || "",
    startLine: title.sourceLine || 1,
    endLine: title.sourceLine || 1,
    contentLines: [formatTitleDisplayText(title.text || "")],
    patchNoteIds,
    plusNoteIds: [],
    isTitle: true,
  };
}

function getDeletedRowsBefore(revisedId) {
  return state.deletedRows.filter((row) => row.beforeRevisedId === revisedId && findOriginalArticle(row.originalArticleId));
}

function getUnassignedOriginalArticles() {
  const assigned = new Set();
  Object.values(state.alignments).forEach((alignment) => {
    alignment.originalArticleIds.forEach((id) => assigned.add(id));
  });
  state.deletedRows.forEach((row) => assigned.add(row.originalArticleId));
  return [getTitleArticle(state.originalDoc, "original"), ...state.originalDoc.articles].filter((article) => !assigned.has(article.id));
}

function getSavedLineHeight(lineKey) {
  if (isMobileBondLayoutActive()) return null;
  const unit = DEFAULT_LINE_HEIGHT_UNIT;
  const height = Number(state.lineHeights?.[lineKey]);
  if (!Number.isFinite(height) || height <= unit) return null;
  return Math.round(height * getLineLayoutScale());
}

function getSavedLineOffset(lineKey) {
  if (isMobileBondLayoutActive()) return null;
  const offset = Number(state.lineOffsets?.[lineKey]);
  return Number.isFinite(offset) && offset > 0 ? Math.round(offset * getLineLayoutScale()) : null;
}

function getLineLayoutScale() {
  return IS_PRESENT_MODE ? 2 : 1;
}

function cleanArticleLineEntries(article) {
  if (!article) return [];
  return article.contentLines
    .map((line, index) => ({
      text: line,
      sourceLine: article.startLine + index,
    }))
    .filter((entry) => entry.text.trim() !== "");
}

function cleanArticleLines(article) {
  return cleanArticleLineEntries(article).map((entry) => entry.text);
}

function getArticleLineNumbers(article) {
  return cleanArticleLineEntries(article).map((entry) => entry.sourceLine);
}

function buildFollowingLineNumbers(referenceArticle, count) {
  const referenceNumbers = getArticleLineNumbers(referenceArticle);
  const firstLine = referenceNumbers[0] || referenceArticle?.startLine || 1;
  const lastReferenceLine = referenceNumbers[referenceNumbers.length - 1] || firstLine - 1;

  return Array.from({ length: count }, (_, index) => {
    if (referenceNumbers[index]) return referenceNumbers[index];
    return lastReferenceLine + index - referenceNumbers.length + 1;
  });
}

function articleComparableText(article) {
  return cleanArticleLines(article).join("\n");
}

function similarityScore(a, b) {
  const aSet = new Set(charGrams(a));
  const bSet = new Set(charGrams(b));
  if (!aSet.size || !bSet.size) return 0;
  let intersection = 0;
  aSet.forEach((gram) => {
    if (bSet.has(gram)) intersection += 1;
  });
  return intersection / (aSet.size + bSet.size - intersection);
}

function charGrams(text) {
  const compact = normalizeLine(text).replace(/[^\p{L}\p{N}가-힣§¤]/gu, "");
  const grams = [];
  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.push(compact.slice(index, index + 2));
  }
  return grams;
}

function buildLineRenderDiff(oldLines, newLines) {
  const oldResult = Array(oldLines.length).fill(null);
  const newResult = Array(newLines.length).fill(null);
  const matches = findLineMatches(oldLines, newLines);
  let oldCursor = 0;
  let newCursor = 0;

  matches.forEach((match) => {
    renderChangedLineGroup(oldLines, newLines, oldResult, newResult, oldCursor, match.oldIndex, newCursor, match.newIndex);
    oldResult[match.oldIndex] = {
      className: oldLines[match.oldIndex].trim() ? "" : "line-muted",
      html: renderPlainLawLine(oldLines[match.oldIndex]),
    };
    newResult[match.newIndex] = {
      className: newLines[match.newIndex].trim() ? "" : "line-muted",
      html: renderPlainLawLine(newLines[match.newIndex]),
    };
    oldCursor = match.oldIndex + 1;
    newCursor = match.newIndex + 1;
  });

  renderChangedLineGroup(oldLines, newLines, oldResult, newResult, oldCursor, oldLines.length, newCursor, newLines.length);

  return {
    oldLines: oldResult.map((line, index) => line || renderWholeChangedLine(oldLines[index], "removed")),
    newLines: newResult.map((line, index) => line || renderWholeChangedLine(newLines[index], "added")),
  };
}

function findLineMatches(oldLines, newLines) {
  const oldNorm = oldLines.map(normalizeLine);
  const newNorm = newLines.map(normalizeLine);
  const dp = Array.from({ length: oldNorm.length + 1 }, () => Array(newNorm.length + 1).fill(0));
  for (let i = oldNorm.length - 1; i >= 0; i -= 1) {
    for (let j = newNorm.length - 1; j >= 0; j -= 1) {
      dp[i][j] = oldNorm[i] === newNorm[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const matches = [];
  let i = 0;
  let j = 0;
  while (i < oldNorm.length && j < newNorm.length) {
    if (oldNorm[i] === newNorm[j]) {
      matches.push({ oldIndex: i, newIndex: j });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return matches;
}

function renderChangedLineGroup(oldLines, newLines, oldResult, newResult, oldStart, oldEnd, newStart, newEnd) {
  const oldIndexes = range(oldStart, oldEnd);
  const newIndexes = range(newStart, newEnd);
  const usedNewIndexes = new Set();

  oldIndexes.forEach((oldIndex) => {
    let bestNewIndex = null;
    let bestScore = 0;
    newIndexes.forEach((newIndex) => {
      if (usedNewIndexes.has(newIndex)) return;
      const score = similarityScore(oldLines[oldIndex], newLines[newIndex]);
      if (score > bestScore) {
        bestScore = score;
        bestNewIndex = newIndex;
      }
    });

    if (bestNewIndex !== null && bestScore >= 0.12) {
      usedNewIndexes.add(bestNewIndex);
      const hasMeaningfulChange = normalizeLine(oldLines[oldIndex]) !== normalizeLine(newLines[bestNewIndex]);
      oldResult[oldIndex] = {
        className: hasMeaningfulChange ? "line-removed" : "",
        html: renderInlineCharDiff(oldLines[oldIndex], newLines[bestNewIndex], "old"),
      };
      newResult[bestNewIndex] = {
        className: hasMeaningfulChange ? "line-added" : "",
        html: renderInlineCharDiff(oldLines[oldIndex], newLines[bestNewIndex], "new"),
      };
    } else {
      oldResult[oldIndex] = renderWholeChangedLine(oldLines[oldIndex], "removed");
    }
  });

  newIndexes.forEach((newIndex) => {
    if (!usedNewIndexes.has(newIndex) && !newResult[newIndex]) {
      newResult[newIndex] = renderWholeChangedLine(newLines[newIndex], "added");
    }
  });
}

function renderWholeChangedLine(line, direction) {
  const className = direction === "added" ? "line-added" : "line-removed";
  return {
    className,
    html: renderDiffParts(tokenizeDiffLine(line).map((unit) => ({
      kind: unit.kind,
      marker: unit.marker,
      text: unit.text,
      type: unit.kind === "word" ? direction : "same",
    }))),
  };
}

function renderPlainLawLine(line) {
  return renderDiffParts(tokenizeDiffLine(line).map((unit) => ({
    kind: unit.kind,
    marker: unit.marker,
    text: unit.text,
    type: "same",
  })));
}

function renderInlineCharDiff(oldLine, newLine, side) {
  const oldUnits = tokenizeDiffLine(oldLine);
  const newUnits = tokenizeDiffLine(newLine);
  const dp = Array.from({ length: oldUnits.length + 1 }, () => Array(newUnits.length + 1).fill(0));
  for (let i = oldUnits.length - 1; i >= 0; i -= 1) {
    for (let j = newUnits.length - 1; j >= 0; j -= 1) {
      dp[i][j] = oldUnits[i].key === newUnits[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const oldParts = [];
  const newParts = [];
  let i = 0;
  let j = 0;
  while (i < oldUnits.length && j < newUnits.length) {
    if (oldUnits[i].key === newUnits[j].key) {
      oldParts.push({ kind: oldUnits[i].kind, marker: oldUnits[i].marker, type: "same", text: oldUnits[i].text });
      newParts.push({ kind: newUnits[j].kind, marker: newUnits[j].marker, type: "same", text: newUnits[j].text });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      oldParts.push({
        kind: oldUnits[i].kind,
        marker: oldUnits[i].marker,
        type: oldUnits[i].kind === "ignored" ? "same" : "removed",
        text: oldUnits[i].text,
      });
      i += 1;
    } else {
      newParts.push({
        kind: newUnits[j].kind,
        marker: newUnits[j].marker,
        type: newUnits[j].kind === "ignored" ? "same" : "added",
        text: newUnits[j].text,
      });
      j += 1;
    }
  }
  while (i < oldUnits.length) {
    oldParts.push({
      kind: oldUnits[i].kind,
      marker: oldUnits[i].marker,
      type: oldUnits[i].kind === "ignored" ? "same" : "removed",
      text: oldUnits[i].text,
    });
    i += 1;
  }
  while (j < newUnits.length) {
    newParts.push({
      kind: newUnits[j].kind,
      marker: newUnits[j].marker,
      type: newUnits[j].kind === "ignored" ? "same" : "added",
      text: newUnits[j].text,
    });
    j += 1;
  }

  return renderDiffParts(side === "old" ? oldParts : newParts);
}

function tokenizeDiffLine(line) {
  const trimmedLine = String(line || "").trimEnd();
  const units = [];
  let cursor = 0;
  let seenContent = false;

  while (cursor < trimmedLine.length) {
    const rest = trimmedLine.slice(cursor);
    const spaceMatch = rest.match(/^\s+/);
    if (spaceMatch) {
      units.push({ key: "WS", kind: "space", text: spaceMatch[0] });
      cursor += spaceMatch[0].length;
      continue;
    }

    if (!seenContent) {
      const articleMarkerMatch = rest.match(/^제\s*\d+\s*조/);
      if (articleMarkerMatch) {
        units.push({ key: "LEADING_ARTICLE_MARKER", kind: "ignored", marker: "article", text: articleMarkerMatch[0] });
        cursor += articleMarkerMatch[0].length;
        seenContent = true;
        continue;
      }

      const markerMatch = rest.match(/^(\(?\d+\)|\d+\\?\.|[가-힣]\\?\.|[⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿])/);
      if (markerMatch) {
        const marker = /^[⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿]/.test(markerMatch[0]) ? "circled" : "item";
        units.push({ key: "LEADING_ITEM_MARKER", kind: "ignored", marker, text: markerMatch[0] });
        cursor += markerMatch[0].length;
        seenContent = true;
        continue;
      }
    }

    const wordMatch = rest.match(/^\S+/);
    if (wordMatch) {
      pushWordDiffUnits(units, wordMatch[0]);
      cursor += wordMatch[0].length;
      seenContent = true;
    } else {
      cursor += 1;
    }
  }

  return units.length ? units : [{ key: "EMPTY_LINE", kind: "space", text: " " }];
}

function pushWordDiffUnits(units, text) {
  pushWordSegment(units, text);
}

function pushWordSegment(units, text) {
  if (!text) return;
  units.push({ key: text, kind: "word", text });
}

function renderDiffParts(parts) {
  const decorated = parts.map((part) => ({
    ...part,
    highlight: part.kind === "word" && (part.type === "added" || part.type === "removed"),
  }));

  decorated.forEach((part, index) => {
    if (part.kind !== "space") return;
    const previous = decorated[index - 1];
    const next = decorated[index + 1];
    if (previous?.highlight && next?.highlight && previous.type === next.type) {
      part.type = previous.type;
      part.highlight = true;
    }
  });

  const chunks = [];
  decorated.forEach((part) => {
    const key = getRenderChunkKey(part);
    const previous = chunks[chunks.length - 1];
    if (previous && previous.key === key) {
      previous.text += part.text;
    } else {
      chunks.push({ key, text: part.text });
    }
  });

  return chunks.map((chunk) => {
    if (chunk.key === "same") return escapeHtml(chunk.text);
    if (chunk.key === "ignored") return `<span class="diff-ignored-token">${escapeHtml(chunk.text)}</span>`;
    if (chunk.key === "article-marker") return `<span class="diff-ignored-token article-marker">${escapeHtml(chunk.text)}</span>`;
    if (chunk.key === "circled-marker") return renderCircledMarker(chunk.text);
    if (chunk.key === "item-marker") return `<span class="diff-ignored-token item-marker">${escapeHtml(renderDisplayText(chunk.text))}</span>`;
    const className = chunk.key === "added" ? "diff-added-char" : "diff-removed-char";
    return `<span class="${className}">${escapeHtml(chunk.text)}</span>`;
  }).join("");
}

function getRenderChunkKey(part) {
  if (part.highlight) return part.type;
  if (part.kind !== "ignored") return "same";
  if (part.marker === "article") return "article-marker";
  if (part.marker === "circled") return "circled-marker";
  if (part.marker === "item") return "item-marker";
  return "ignored";
}

function renderDisplayText(text) {
  return String(text).replace(/\\\./g, ".");
}

function renderCircledMarker(text) {
  return `<span class="diff-ignored-token circled-marker">${escapeHtml(text)}</span>`;
}

function range(start, end) {
  const indexes = [];
  for (let index = start; index < end; index += 1) indexes.push(index);
  return indexes;
}

function buildLineStatus(oldLines, newLines) {
  const oldNorm = oldLines.map(normalizeLine);
  const newNorm = newLines.map(normalizeLine);
  const dp = Array.from({ length: oldNorm.length + 1 }, () => Array(newNorm.length + 1).fill(0));
  for (let i = oldNorm.length - 1; i >= 0; i -= 1) {
    for (let j = newNorm.length - 1; j >= 0; j -= 1) {
      dp[i][j] = oldNorm[i] === newNorm[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const oldStatuses = Array(oldLines.length).fill("removed");
  const newStatuses = Array(newLines.length).fill("added");
  let i = 0;
  let j = 0;
  while (i < oldNorm.length && j < newNorm.length) {
    if (oldNorm[i] === newNorm[j]) {
      oldStatuses[i] = "same";
      newStatuses[j] = "same";
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return { oldStatuses, newStatuses };
}

function normalizeLine(line) {
  return maskIgnoredLineStartMarkers(String(line || "").trimEnd()).replace(/\s+/g, "").trim();
}

function maskIgnoredLineStartMarkers(text) {
  return text.replace(
    /^(\s*)(제\s*\d+\s*조|\(?\d+\)|\d+\\?\.|[가-힣]\\?\.|[⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿])/,
    "$1¤",
  );
}

async function saveEnvironment() {
  await persistOpenEditorsBeforeWorkspaceSave();
  await flushRemoteStateSaveNow();
  const localPayload = buildEnvironmentPayload({ includeDocuments: true });
  const serverPayload = await fetchServerState({ silent: true, apply: false });
  const payload = serverPayload ? mergeEnvironmentPayloads(serverPayload, localPayload) : localPayload;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  await saveBlob(blob, buildWorkspaceSaveFileName(), "application/json");
}

async function persistOpenEditorsBeforeWorkspaceSave() {
  if (state.noteComposer?.editingId && canWriteNoteBody(state.noteComposer)) {
    saveNoteComposer(state.noteComposer);
  }
  if (state.editingRevisedId && !state.editingSaving) {
    await saveRevisedEdit(state.editingRevisedId);
  }
}

function buildWorkspaceSaveFileName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const date = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("");
  const time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");
  return `prome-law.workspace.${date}-${time}.json`;
}

function buildEnvironmentPayload(options = {}) {
  const includeDocuments = options.includeDocuments === true;
  const files = {
    original: { name: ORIGINAL_FILE, hash: state.originalDoc.hash },
    revised: { name: REVISED_FILE, hash: state.revisedDoc.hash },
  };
  if (includeDocuments) {
    files.original.text = state.originalText;
    files.revised.text = state.revisedText;
  }

  return {
    version: 2,
    savedAt: new Date().toISOString(),
    files,
    documents: includeDocuments ? {
      original: { name: ORIGINAL_FILE, text: state.originalText },
      revised: { name: REVISED_FILE, text: state.revisedText },
    } : undefined,
    layout: {
      alignments: state.alignments,
      deletedRows: state.deletedRows,
    },
    alignments: state.alignments,
    deletedRows: state.deletedRows,
    lineHeights: state.lineHeights,
    lineOffsets: state.lineOffsets,
    lineBonds: state.lineBonds,
    annotations: state.annotations.map(normalizeAnnotationForPersistence),
    annotationDefaults: state.annotationDefaults,
    deletedAnnotations: normalizeDeletedAnnotations(state.deletedAnnotations),
    selectedRevisedId: state.selectedRevisedId,
    splitRatio: state.splitRatio,
    patchNotes: state.revisedDoc.patchNotes,
    plusNotes: state.revisedDoc.plusNotes,
  };
}

function normalizeAnnotationForPersistence(note) {
  return {
    ...note,
    isPublic: note.kind === "댓글" ? false : note.isPublic !== false,
    highlights: normalizeNoteHighlights(note.highlights),
  };
}

function normalizeDeletedAnnotations(deletedAnnotations) {
  if (!deletedAnnotations || typeof deletedAnnotations !== "object") return {};
  return Object.fromEntries(
    Object.entries(deletedAnnotations)
      .filter(([id, deletedAt]) => id && typeof deletedAt === "string" && deletedAt)
      .map(([id, deletedAt]) => [id, deletedAt]),
  );
}

function mergeEnvironmentPayloads(serverPayload, localPayload) {
  const merged = {
    ...localPayload,
    ...serverPayload,
  };
  merged.annotations = mergeAnnotationPayloads(serverPayload, localPayload);
  merged.deletedAnnotations = mergeDeletedAnnotationPayloads(serverPayload, localPayload);
  return merged;
}

function mergeAnnotationPayloads(serverPayload, localPayload) {
  const deletedAnnotations = mergeDeletedAnnotationPayloads(serverPayload, localPayload);
  const byId = new Map();
  const pushNote = (note) => {
    if (!note?.id) return;
    const normalized = normalizeAnnotationForPersistence(note);
    const existing = byId.get(normalized.id);
    if (!existing || compareAnnotationTimestamp(normalized, existing) >= 0) {
      byId.set(normalized.id, normalized);
    }
  };
  (serverPayload?.annotations || []).forEach(pushNote);
  (localPayload?.annotations || []).forEach(pushNote);

  const orderedIds = [
    ...(serverPayload?.annotations || []).map((note) => note.id),
    ...(localPayload?.annotations || []).map((note) => note.id),
  ];
  return [...new Set(orderedIds)]
    .map((id) => byId.get(id))
    .filter((note) => note && !isAnnotationDeletedByTombstone(note, deletedAnnotations));
}

function mergeDeletedAnnotationPayloads(serverPayload, localPayload) {
  const merged = {};
  [serverPayload?.deletedAnnotations, localPayload?.deletedAnnotations].forEach((deletedAnnotations) => {
    Object.entries(normalizeDeletedAnnotations(deletedAnnotations)).forEach(([id, deletedAt]) => {
      if (!merged[id] || deletedAt > merged[id]) merged[id] = deletedAt;
    });
  });
  return merged;
}

function compareAnnotationTimestamp(first, second) {
  return getAnnotationTimestamp(first).localeCompare(getAnnotationTimestamp(second));
}

function getAnnotationTimestamp(note) {
  return String(note?.updatedAt || note?.createdAt || "");
}

function isAnnotationDeletedByTombstone(note, deletedAnnotations) {
  const deletedAt = deletedAnnotations?.[note.id];
  return Boolean(deletedAt && deletedAt >= getAnnotationTimestamp(note));
}

function getEditRequestHeaders() {
  return IS_EDIT_MODE && EDIT_TOKEN ? { "X-PromeLaw-Edit-Token": EDIT_TOKEN } : {};
}

async function fetchServerState(options = {}) {
  if (!REALTIME_ENABLED || remoteFetchInFlight) return null;
  remoteFetchInFlight = true;
  try {
    const response = await fetch("/api/state", {
      cache: "no-store",
      headers: getEditRequestHeaders(),
    });
    if (!response.ok) throw new Error("서버 상태를 가져오지 못했습니다.");
    const payload = await response.json();
    lastServerRevision = Number(payload.serverRevision) || lastServerRevision;
    if (options.apply !== false) {
      isApplyingRemoteState = true;
      applyEnvironmentPayload(payload, { persist: false });
      isApplyingRemoteState = false;
    }
    return payload;
  } catch (error) {
    isApplyingRemoteState = false;
    if (!options.silent) {
      console.warn(error);
    }
    return null;
  } finally {
    remoteFetchInFlight = false;
  }
}

function connectRealtime() {
  if (!REALTIME_ENABLED || !window.EventSource) return;
  const params = new URLSearchParams();
  if (IS_EDIT_MODE && EDIT_TOKEN) params.set("token", EDIT_TOKEN);
  if (lastServerRevision) params.set("last", String(lastServerRevision));
  eventSource?.close();
  eventSource = new EventSource(`/api/events${params.toString() ? `?${params}` : ""}`);
  eventSource.addEventListener("state", (event) => {
    try {
      const payload = JSON.parse(event.data);
      handleRemoteRevision(Number(payload.revision) || 0);
    } catch {
      // Ignore malformed realtime events.
    }
  });
}

function handleRemoteRevision(revision) {
  if (!revision || revision <= lastServerRevision) return;
  if (hasActiveLocalEditing()) {
    pendingRemoteRevision = Math.max(pendingRemoteRevision, revision);
    return;
  }
  fetchServerState({ silent: true });
}

function hasActiveLocalEditing() {
  return Boolean(
    state.editingRevisedId
    || state.noteComposer
    || state.draggedOriginalId
    || state.draggedAnnotationId
    || state.draggedLineKey
    || lineResize.active,
  );
}

function flushPendingRemoteStateIfIdle() {
  if (!pendingRemoteRevision || hasActiveLocalEditing() || isApplyingRemoteState) return;
  pendingRemoteRevision = 0;
  fetchServerState({ silent: true });
}

function scheduleRemoteStateSave() {
  if (!REALTIME_ENABLED || !IS_EDIT_MODE || isApplyingRemoteState) return;
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(pushStateToServer, 180);
}

async function flushRemoteStateSaveNow() {
  if (!REALTIME_ENABLED || !IS_EDIT_MODE) return;
  window.clearTimeout(remoteSaveTimer);
  if (remoteSaveInFlight) {
    remoteSavePending = true;
    await waitForRemoteSaveIdle();
  }
  window.clearTimeout(remoteSaveTimer);
  await pushStateToServer();
  await waitForRemoteSaveIdle();
}

function waitForRemoteSaveIdle(timeout = 5000) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (!remoteSaveInFlight && !remoteSavePending) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        resolve();
        return;
      }
      window.setTimeout(check, 50);
    };
    check();
  });
}

async function pushStateToServer(options = {}) {
  if (!state.originalDoc || !state.revisedDoc || !IS_EDIT_MODE) return;
  if (remoteSaveInFlight) {
    remoteSavePending = true;
    return;
  }
  remoteSaveInFlight = true;
  try {
    const payload = buildEnvironmentPayload({ includeDocuments: true });
    const headers = { "Content-Type": "application/json", ...getEditRequestHeaders() };
    if (options.replace) headers["X-PromeLaw-State-Mode"] = "replace";
    const response = await fetch("/api/state", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("서버 상태 저장에 실패했습니다.");
    const result = await response.json();
    lastServerRevision = Number(result.revision) || lastServerRevision;
  } catch (error) {
    console.warn(error);
  } finally {
    remoteSaveInFlight = false;
    if (remoteSavePending) {
      remoteSavePending = false;
      scheduleRemoteStateSave();
    }
  }
}

async function loadEnvironment(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const payload = JSON.parse(await file.text());
  await flushRemoteStateSaveNow();
  applyEnvironmentPayload(payload, { remote: false });
  await pushStateToServer({ replace: true });
  event.target.value = "";
  showToast("저장된 대응 환경을 서버에 복구했습니다.");
}

function applyEnvironmentPayload(payload, options = {}) {
  applyDocumentPayload(payload);
  const alignments = payload.alignments || payload.layout?.alignments || {};
  const deletedRows = payload.deletedRows || payload.layout?.deletedRows || [];

  state.alignments = alignments;
  state.deletedRows = Array.isArray(deletedRows) ? deletedRows.filter((row) => {
    return row?.originalArticleId && row?.beforeRevisedId && findOriginalArticle(row.originalArticleId) && findRevisedArticle(row.beforeRevisedId);
  }) : [];
  state.lineHeights = normalizeLineHeights(payload.lineHeights);
  state.lineOffsets = normalizeLineOffsets(payload.lineOffsets);
  state.lineBonds = normalizeLineBonds(payload.lineBonds);
  state.annotations = Array.isArray(payload.annotations)
    ? payload.annotations.filter((note) => note?.id && note?.targetId && note?.kind).map(normalizeAnnotationForPersistence)
    : [];
  repairAnnotationHighlightsForCurrentDocuments();
  state.annotationDefaults = normalizeAnnotationDefaults(payload.annotationDefaults);
  state.deletedAnnotations = normalizeDeletedAnnotations(payload.deletedAnnotations);
  state.noteComposer = null;
  state.noteComposerOpening = null;
  state.noteComposerClosing = null;
  state.selectedRevisedId = findRevisedArticle(payload.selectedRevisedId)
    ? payload.selectedRevisedId
    : state.revisedDoc.articles[0]?.id || null;
  setSplitRatio(payload.splitRatio ?? DEFAULT_SPLIT_RATIO);
  if (Array.isArray(payload.patchNotes)) {
    mergePatchNotes(payload.patchNotes);
  }
  if (Array.isArray(payload.plusNotes)) {
    mergePlusNotes(payload.plusNotes);
  }
  if (options.persist !== false) persistLocalState({ remote: options.remote !== false });
  renderAll();
}

function applyDocumentPayload(payload) {
  const originalText = getPayloadDocumentText(payload, "original");
  const revisedText = getPayloadDocumentText(payload, "revised");
  if (typeof originalText !== "string" || typeof revisedText !== "string") return false;

  state.originalText = originalText;
  state.revisedText = revisedText;
  state.originalDoc = parseDocument(originalText, "original");
  state.revisedDoc = parseDocument(revisedText, "revised");
  updateFileStatus();
  return true;
}

function getPayloadDocumentText(payload, kind) {
  const documentText = payload.documents?.[kind]?.text;
  if (typeof documentText === "string") return documentText;
  const fileText = payload.files?.[kind]?.text;
  return typeof fileText === "string" ? fileText : null;
}

function mergePatchNotes(notes) {
  const byId = new Map(notes.map((note) => [note.id, note]));
  state.revisedDoc.patchNotes = state.revisedDoc.patchNotes.map((note) => byId.get(note.id) || note);
  notes.filter((note) => !state.revisedDoc.patchNotes.some((existing) => existing.id === note.id)).forEach((note) => {
    state.revisedDoc.patchNotes.push(note);
    const article = findRevisedArticle(note.targetId);
    if (article && !article.patchNoteIds.includes(note.id) && !note.deleted) article.patchNoteIds.push(note.id);
  });
}

function mergePlusNotes(notes) {
  const byId = new Map(notes.map((note) => [note.id, note]));
  state.revisedDoc.plusNotes = state.revisedDoc.plusNotes.map((note) => byId.get(note.id) || note);
}

function normalizeLineHeights(lineHeights) {
  if (!lineHeights || typeof lineHeights !== "object") return {};
  const unit = getLineHeightUnit();
  return Object.fromEntries(
    Object.entries(lineHeights)
      .map(([key, value]) => [key, Number(value)])
      .filter(([key, value]) => key && Number.isFinite(value) && value > unit)
      .map(([key, value]) => [key, Math.round(value)]),
  );
}

function normalizeLineOffsets(lineOffsets) {
  if (!lineOffsets || typeof lineOffsets !== "object") return {};
  return Object.fromEntries(
    Object.entries(lineOffsets)
      .map(([key, value]) => [key, Number(value)])
      .filter(([key, value]) => key && Number.isFinite(value) && value > 0)
      .map(([key, value]) => [key, Math.round(value)]),
  );
}

function normalizeLineBonds(lineBonds) {
  if (!Array.isArray(lineBonds)) return [];
  const seen = new Set();
  return lineBonds.reduce((bonds, bond) => {
    const leftKey = typeof bond?.leftKey === "string" ? bond.leftKey : "";
    const rightKey = typeof bond?.rightKey === "string" ? bond.rightKey : "";
    if (!leftKey || !rightKey || seen.has(leftKey) || seen.has(rightKey)) return bonds;
    seen.add(leftKey);
    seen.add(rightKey);
    bonds.push({ leftKey, rightKey });
    return bonds;
  }, []);
}

function normalizeAnnotationDefaults(defaults) {
  if (!defaults || typeof defaults !== "object") return {};
  return Object.fromEntries(
    Object.entries(defaults)
      .filter(([targetId, value]) => targetId && value && typeof value === "object")
      .map(([targetId, value]) => {
        const normalized = {
          type: PATCH_TYPES.includes(value.type) ? value.type : "수정",
          level: NOTE_LEVELS.includes(value.level) ? value.level : "0단계",
          reason: typeof value.reason === "string" ? value.reason : "",
          customReason: typeof value.customReason === "string" ? value.customReason : "",
        };
        return [targetId, normalized];
      }),
  );
}

async function restoreLocalState() {
  if (REALTIME_ENABLED) {
    const serverPayload = await fetchServerState({ silent: true });
    if (serverPayload) {
      seedEmptyServerFromLocalState(serverPayload);
      return;
    }
  }
  if (!IS_EDIT_MODE) return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const payload = JSON.parse(raw);
    const sameOriginal = payload.files?.original?.name === ORIGINAL_FILE && payload.files?.original?.hash === state.originalDoc.hash;
    const sameRevisedFile = payload.files?.revised?.name === REVISED_FILE;
    if (sameOriginal && sameRevisedFile) {
      applyEnvironmentPayload(payload);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function seedEmptyServerFromLocalState(serverPayload) {
  if (!IS_EDIT_MODE || !isPristineServerPayload(serverPayload)) return;
  const localPayload = readLocalStatePayload();
  if (!hasMeaningfulLocalPayload(localPayload)) return;
  applyEnvironmentPayload(localPayload, { persist: true });
  showToast("로컬 작업 상태를 서버에 올렸습니다.");
}

function readLocalStatePayload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isPristineServerPayload(payload) {
  return !Number(payload?.serverRevision || 0)
    && !Object.keys(payload?.alignments || {}).length
    && !(payload?.deletedRows || []).length
    && !(payload?.lineBonds || []).length
    && !(payload?.annotations || []).length
    && !Object.keys(payload?.deletedAnnotations || {}).length;
}

function hasMeaningfulLocalPayload(payload) {
  return Boolean(
    payload
    && (
      Object.keys(payload.alignments || {}).length
      || (payload.deletedRows || []).length
      || (payload.lineBonds || []).length
      || (payload.annotations || []).length
      || Object.keys(payload.deletedAnnotations || {}).length
    ),
  );
}

function persistLocalState(options = {}) {
  if (!state.originalDoc || !state.revisedDoc) return;
  if (IS_EDIT_MODE) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildEnvironmentPayload()));
    if (options.remote !== false) scheduleRemoteStateSave();
  }
}

async function exportRevisedMarkdown() {
  const blob = new Blob([state.revisedText], { type: "text/markdown;charset=utf-8" });
  await saveBlob(blob, "동아리 회칙 062326 개정본.export.md", "text/markdown");
}

function serializePatchNote(note) {
  const tag = note.commonTags.length ? ` **${note.commonTags.join(", ")}**` : "";
  return `> | ${note.type} | ${note.level} |${tag} ${note.description}`.trimEnd();
}

async function saveBlob(blob, suggestedName, mimeType) {
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: suggestedName, accept: { [mimeType]: [`.${suggestedName.split(".").pop()}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      showToast(`${suggestedName} 파일을 저장했습니다.`);
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast(`${suggestedName} 파일을 내려받았습니다.`);
}

function findOriginalArticle(id) {
  if (id === TITLE_ORIGINAL_ID) return getTitleArticle(state.originalDoc, "original");
  return state.originalDoc.articles.find((article) => article.id === id);
}

function findRevisedArticle(id) {
  if (id === TITLE_REVISED_ID) return getTitleArticle(state.revisedDoc, "revised");
  return state.revisedDoc.articles.find((article) => article.id === id);
}

function findPatchNote(id) {
  return state.revisedDoc.patchNotes.find((note) => note.id === id);
}

function findPlusNote(id) {
  return state.revisedDoc.plusNotes.find((note) => note.id === id);
}

function articleLabel(articleId) {
  const article = findRevisedArticle(articleId);
  return article ? article.label : "문서 상단";
}

function hasDraftMarker(text) {
  return !text || /-{3,}|~{2,}|파트\s*$|수정 필요|보충|미완성/.test(text);
}

function hashText(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
    hash &= 0xffffffff;
  }
  return String(hash >>> 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2200);
}
