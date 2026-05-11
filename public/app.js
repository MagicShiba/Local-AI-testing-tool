const state = {
  tree: { sets: [] },
  selectedQuestionPath: "",
  currentQuestion: null,
  settings: { presets: [], activePresetId: "", systemPromptPresets: [], defaultSystemPrompt: "" },
  testingSet: "",
  testingPresetId: "",
  testingItems: [],
  testingSelectedPath: "",
  stopAllRequested: false,
  isBatchRunning: false,
  isLoadingResult: false,
  hasUnsavedChanges: false,
  notes: [],
  currentNoteId: "",
  currentNote: null,
  noteViewMode: "markdown",
  noteSortBy: "name",
  pendingTestingFocusPath: "",
  menuSidebarExpanded: false,
  availableResults: [],
  compareResultIds: [],
  compareResults: [],
  compareSet: "",
  compareQuestionCache: new Map(),
  compareSelectedPath: "",
  compareCollapsedFolders: {},
  compareCollapsedQuestions: {},
  compareFilters: {
    differentAnswerOnly: false,
    differentScoreOnly: false,
    hideSystemPrompt: false,
  },
  excludedTestingFolders: new Set(),
  compareExcludedFolders: new Set(),
  checkerTemplates: [],
  chats: [],
  currentChat: null,
  currentChatId: "",
  chatFolders: [],
  chatComposeRole: "user",
  chatThinkReasoning: "medium",
  chatPresetId: "",
};

const DEBUG_TEST_FLOW = false;
const LAST_PAGE_KEY = "lastActivePage";
const LAST_TESTING_SET_KEY = "lastTestingSet";
const LAST_NOTE_SORT_KEY = "lastNoteSortBy";
const MENU_SIDEBAR_EXPANDED_KEY = "menuSidebarExpanded";
const PAGE_SCROLL_KEY_PREFIX = "pageScroll:";

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  pages: [...document.querySelectorAll(".page")],
  tree: document.getElementById("tree"),
  editorEmpty: document.getElementById("editorEmpty"),
  editorPanelHeader: document.getElementById("editorPanelHeader"),
  questionForm: document.getElementById("questionForm"),
  saveQuestionBtn: document.getElementById("saveQuestionBtn"),
  quickRunQuestionBtn: document.getElementById("quickRunQuestionBtn"),
  questionPath: document.getElementById("questionPath"),
  title: document.getElementById("title"),
  score: document.getElementById("score"),
  systemPrompt: document.getElementById("systemPrompt"),
  note: document.getElementById("note"),
  rounds: document.getElementById("rounds"),
  expectedAnswer: document.getElementById("expectedAnswer"),
  checker: document.getElementById("checker"),
  newSetName: document.getElementById("newSetName"),
  newFolderName: document.getElementById("newFolderName"),
  newQuestionName: document.getElementById("newQuestionName"),
  presetName: document.getElementById("presetName"),
  baseUrl: document.getElementById("baseUrl"),
  model: document.getElementById("model"),
  apiKey: document.getElementById("apiKey"),
  extraConfig: document.getElementById("extraConfig"),
  chatContinueMode: document.getElementById("chatContinueMode"),
  presetCards: document.getElementById("presetCards"),
  testingSetSelect: document.getElementById("testingSetSelect"),
  testingPresetSelect: document.getElementById("testingPresetSelect"),
  testingList: document.getElementById("testingList"),
  scoreSummary: document.getElementById("scoreSummary"),
  scoreStatsBtn: document.getElementById("scoreStatsBtn"),
  closeScoreStatsBtn: document.getElementById("closeScoreStatsBtn"),
  scoreStatsPopover: document.getElementById("scoreStatsPopover"),
  scoreStatsContent: document.getElementById("scoreStatsContent"),
  scoreStatsPercent: document.getElementById("scoreStatsPercent"),
  savedResultSelect: document.getElementById("savedResultSelect"),
  comparePageResultList: document.getElementById("comparePageResultList"),
  comparePageBoard: document.getElementById("comparePageBoard"),
  comparePageEmpty: document.getElementById("comparePageEmpty"),
  compareTree: document.getElementById("compareTree"),
  resultName: document.getElementById("resultName"),
  testingTree: document.getElementById("testingTree"),
  collapseAllFloatBtn: document.getElementById("collapseAllFloatBtn"),
  scrollTopBtn: document.getElementById("scrollTopBtn"),
  stopTestBtn: document.getElementById("stopTestBtn"),
  notesList: document.getElementById("notesList"),
  notesEmpty: document.getElementById("notesEmpty"),
  notesEditor: document.getElementById("notesEditor"),
  noteTitle: document.getElementById("noteTitle"),
  noteContent: document.getElementById("noteContent"),
  notePreview: document.getElementById("notePreview"),
  toastContainer: document.getElementById("toastContainer"),
  menuSidebar: document.getElementById("menuSidebar"),
  menuSidebarToggle: document.getElementById("menuSidebarToggle"),
  compareDiffAnswerBtn: document.getElementById("compareDiffAnswerBtn"),
  compareDiffScoreBtn: document.getElementById("compareDiffScoreBtn"),
  compareHideSystemBtn: document.getElementById("compareHideSystemBtn"),
  checkerTemplateSelect: document.getElementById("checkerTemplateSelect"),
  insertCheckerTemplateBtn: document.getElementById("insertCheckerTemplateBtn"),
  checkerTemplateList: document.getElementById("checkerTemplateList"),
  addCheckerTemplateBtn: document.getElementById("addCheckerTemplateBtn"),
  saveCheckerTemplatesBtn: document.getElementById("saveCheckerTemplatesBtn"),
  chatList: document.getElementById("chatList"),
  chatEmpty: document.getElementById("chatEmpty"),
  chatEditor: document.getElementById("chatEditor"),
  chatTitle: document.getElementById("chatTitle"),
  chatPresetSelect: document.getElementById("chatPresetSelect"),
  chatMessages: document.getElementById("chatMessages"),
  chatInput: document.getElementById("chatInput"),
  chatImageInput: document.getElementById("chatImageInput"),
  newChatBtn: document.getElementById("newChatBtn"),
  newChatFolderBtn: document.getElementById("newChatFolderBtn"),
  saveChatBtn: document.getElementById("saveChatBtn"),
  sendChatBtn: document.getElementById("sendChatBtn"),
  insertChatBtn: document.getElementById("insertChatBtn"),
  chatRoleToggleBtn: document.getElementById("chatRoleToggleBtn"),
  chatThinkToggleBtn: document.getElementById("chatThinkToggleBtn"),
  chatThinkSelect: document.getElementById("chatThinkSelect"),
  exportChatQuestionBtn: document.getElementById("exportChatQuestionBtn"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.body.classList.add("app-loading");
  bindEvents();
  const initialPage = normalizePage(localStorage.getItem(LAST_PAGE_KEY));
  const savedSet = localStorage.getItem(LAST_TESTING_SET_KEY);
  if (savedSet) {
    state.testingSet = savedSet;
  }
  const savedNoteSortBy = localStorage.getItem(LAST_NOTE_SORT_KEY);
  if (savedNoteSortBy === "name" || savedNoteSortBy === "time") {
    state.noteSortBy = savedNoteSortBy;
  }
  state.menuSidebarExpanded = localStorage.getItem(MENU_SIDEBAR_EXPANDED_KEY) === "1";
  updateMenuSidebar();
  await Promise.all([loadTree(), loadSettings(), loadResults(), loadNotes(), loadCheckerTemplates(), loadChats()]);
  await syncTestingSelectors();
  renderEditor();
  renderNotes();
  switchPage(initialPage, { skipUnsavedCheck: true, skipScrollSave: true, immediateScrollRestore: true });
  document.body.classList.remove("app-loading");
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchPage(tab.dataset.page)));
  document.getElementById("refreshTreeBtn").addEventListener("click", loadTree);
  document.getElementById("newNoteBtn").addEventListener("click", createNewNote);
  document.getElementById("saveNoteBtn").addEventListener("click", () => saveNote({ showToast: true }));
  document.getElementById("deleteNoteBtn").addEventListener("click", deleteNote);
  document.getElementById("viewMarkdownBtn").addEventListener("click", () => setNoteViewMode("markdown"));
  document.getElementById("viewRawBtn").addEventListener("click", () => setNoteViewMode("raw"));
  els.noteContent.addEventListener("input", () => {
    if (state.noteViewMode === "markdown") {
      renderNotePreview();
    }
  });
  document.getElementById("createSetBtn").addEventListener("click", createSet);
  document.getElementById("createFolderBtn").addEventListener("click", createFolder);
  document.getElementById("createQuestionBtn").addEventListener("click", createQuestion);
  document.getElementById("addRoundBtn").addEventListener("click", () => addRound());
  document.getElementById("sortByNameBtn").addEventListener("click", () => setNoteSortBy("name"));
  document.getElementById("sortByTimeBtn").addEventListener("click", () => setNoteSortBy("time"));
  els.testingSetSelect.addEventListener("change", () => {
    state.testingSet = els.testingSetSelect.value;
    state.compareSet = state.testingSet;
    localStorage.setItem(LAST_TESTING_SET_KEY, state.testingSet);
    const currentPage = localStorage.getItem(LAST_PAGE_KEY);
    if (currentPage === "editor") {
      renderEditorTree();
    } else if (currentPage === "testing") {
      state.testingSelectedPath = "";
      renderTestingList();
    } else if (currentPage === "compare") {
      state.compareResultIds = state.compareResultIds.filter((id) => {
        const result = state.availableResults.find((item) => item.id === id);
        return result?.dataset === state.compareSet;
      });
      state.compareResults = state.compareResults.filter((result) => result.dataset === state.compareSet && state.compareResultIds.includes(result.id));
      renderComparePage();
      loadCompareResults();
    }
  });
  els.saveQuestionBtn.addEventListener("click", () => saveQuestion({ showToast: true }));
  els.quickRunQuestionBtn.addEventListener("click", quickRunCurrentQuestion);
  document.getElementById("newPresetBtn").addEventListener("click", createPreset);
  document.getElementById("deletePresetBtn").addEventListener("click", deletePreset);
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  document.querySelectorAll("[data-settings-target]").forEach((btn) => {
    btn.addEventListener("click", () => document.getElementById(btn.dataset.settingsTarget)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  });
  document.getElementById("reloadTestingBtn").addEventListener("click", async () => {
    await loadTree();
    renderTestingList();
  });
  document.getElementById("runAllBtn").addEventListener("click", runAllTests);
  document.getElementById("collapseAllBtn").addEventListener("click", () => toggleAllTests(false));
  document.getElementById("expandAllBtn").addEventListener("click", () => toggleAllTests(true));
  document.getElementById("clearTestingBtn").addEventListener("click", clearTestingContent);
  document.getElementById("saveResultBtn").addEventListener("click", saveResult);
  els.collapseAllFloatBtn.addEventListener("click", () => toggleAllTests(false));
  els.scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  els.stopTestBtn.addEventListener("click", stopAllTests);
  els.menuSidebarToggle?.addEventListener("click", toggleMenuSidebar);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("click", handleCheckerActionClick);
  els.testingPresetSelect.addEventListener("change", () => {
    state.testingPresetId = els.testingPresetSelect.value;
  });
  els.savedResultSelect.addEventListener("focus", loadSavedResultsIfNeeded);
  els.savedResultSelect.addEventListener("change", loadSelectedResult);
  els.comparePageResultList?.addEventListener("change", handleCompareResultChecklistChange);
  document.getElementById("compareClearBtn")?.addEventListener("click", clearCompareResults);
  document.getElementById("compareSelectAllBtn")?.addEventListener("click", async () => {
    state.compareResultIds = getAvailableCompareResults().map((item) => item.id);
    renderCompareResultOptions();
    await loadCompareResults();
  });
  els.compareDiffAnswerBtn?.addEventListener("click", () => {
    state.compareFilters.differentAnswerOnly = !state.compareFilters.differentAnswerOnly;
    renderComparePage();
  });
  els.compareDiffScoreBtn?.addEventListener("click", () => {
    state.compareFilters.differentScoreOnly = !state.compareFilters.differentScoreOnly;
    renderComparePage();
  });
  els.compareHideSystemBtn?.addEventListener("click", () => {
    state.compareFilters.hideSystemPrompt = !state.compareFilters.hideSystemPrompt;
    renderComparePage();
  });
  els.insertCheckerTemplateBtn?.addEventListener("click", insertCheckerTemplate);
  els.addCheckerTemplateBtn?.addEventListener("click", addCheckerTemplateEditor);
  els.saveCheckerTemplatesBtn?.addEventListener("click", saveCheckerTemplates);
  const settingsPanelTitles = { apiSettings: "接口设置", chatSettings: "聊天设置", systemPrompts: "系统提示词", checkerTemplate: "检测模板" };
  document.querySelectorAll(".settings-sidebar-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".settings-sidebar-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".settings-panel").forEach(p => p.classList.add("hidden"));
      const panelId = `panel-${btn.dataset.settingsPanel}`;
      document.getElementById(panelId)?.classList.remove("hidden");
      const titleEl = document.getElementById("settingsPanelTitle");
      if (titleEl && settingsPanelTitles[btn.dataset.settingsPanel]) {
        titleEl.textContent = settingsPanelTitles[btn.dataset.settingsPanel];
      }
    });
  });
  document.getElementById("addSystemPromptBtn")?.addEventListener("click", addSystemPromptPreset);
  els.newChatBtn?.addEventListener("click", createNewChat);
  els.newChatFolderBtn?.addEventListener("click", createChatFolder);
  els.saveChatBtn?.addEventListener("click", () => saveCurrentChat({ showToast: true }));
  els.sendChatBtn?.addEventListener("click", sendChatMessage);
  els.insertChatBtn?.addEventListener("click", insertChatMessage);
  els.chatRoleToggleBtn?.addEventListener("click", toggleChatComposeRole);
  els.chatThinkToggleBtn?.addEventListener("click", toggleChatThink);
  els.chatPresetSelect?.addEventListener("change", () => {
    state.chatPresetId = els.chatPresetSelect.value;
  });
  els.exportChatQuestionBtn?.addEventListener("click", exportCurrentChatToQuestion);
  [els.chatTitle].forEach((el) => el?.addEventListener("input", () => {
    if (!state.currentChat) return;
    state.currentChat.title = els.chatTitle.value;
  }));
  els.scoreStatsBtn?.addEventListener("click", () => {
    updateScoreSummary();
    els.scoreStatsPopover?.classList.toggle("hidden");
  });
  els.closeScoreStatsBtn?.addEventListener("click", () => {
    els.scoreStatsPopover?.classList.add("hidden");
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      const page = getActivePage();
      if (page === "editor" && state.selectedQuestionPath) {
        saveQuestion({ showToast: true });
      } else if (page === "notes" && state.currentNoteId) {
        saveNote({ showToast: true });
      }
    }
  });
  els.title.addEventListener("input", () => {
    if (!state.hasUnsavedChanges) {
      state.hasUnsavedChanges = true;
      updateUnsavedIndicator();
    }
  });
  [els.score, els.systemPrompt, els.note, els.expectedAnswer, els.checker].forEach((el) => {
    el?.addEventListener("input", () => {
      if (!state.hasUnsavedChanges) {
        state.hasUnsavedChanges = true;
        updateUnsavedIndicator();
      }
    });
  });
  els.rounds.addEventListener("input", () => {
    if (!state.hasUnsavedChanges) {
      state.hasUnsavedChanges = true;
      updateUnsavedIndicator();
    }
  });
}

function switchPage(page, options = {}) {
  page = normalizePage(page);
  const skipUnsavedCheck = Boolean(options.skipUnsavedCheck);
  const skipScrollSave = Boolean(options.skipScrollSave);
  const immediateScrollRestore = Boolean(options.immediateScrollRestore);
  if (!skipUnsavedCheck && state.hasUnsavedChanges && !confirm("当前题目有未保存的更改，确定要离开吗？")) {
    return;
  }
  const currentPage = getActivePage();
  if (!skipScrollSave && currentPage) {
    savePageScroll(currentPage);
  }
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.page === page));
  els.pages.forEach((section) => section.classList.toggle("active", section.id === `page-${page}`));
  localStorage.setItem(LAST_PAGE_KEY, page);
  updateEditorSetSelectVisibility(page);
  if (page === "editor") {
    renderEditorTree();
  } else if (page === "testing") {
    renderTestingList();
  } else if (page === "compare") {
    renderComparePage();
  } else if (page === "chat") {
    renderChats();
    renderChatEditor();
  }
  restorePageScroll(page, immediateScrollRestore);
}

function updateMenuSidebar() {
  if (!els.menuSidebar) return;
  els.menuSidebar.classList.toggle("expanded", state.menuSidebarExpanded);
  els.menuSidebar.classList.toggle("collapsed", !state.menuSidebarExpanded);
}

function toggleMenuSidebar() {
  state.menuSidebarExpanded = !state.menuSidebarExpanded;
  localStorage.setItem(MENU_SIDEBAR_EXPANDED_KEY, state.menuSidebarExpanded ? "1" : "0");
  updateMenuSidebar();
}

function updateEditorSetSelectVisibility(page) {
  const editorSetSelectEl = document.querySelector(".editor-set-select");
  if (!editorSetSelectEl) return;
  if (page === "editor" || page === "testing" || page === "compare") {
    editorSetSelectEl.classList.remove("hidden");
  } else {
    editorSetSelectEl.classList.add("hidden");
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function loadTree() {
  state.tree = await api("/api/tree");
  renderTree();
  await syncTestingSelectors();
}

function renderTree() {
  renderEditorTree();
}

function renderEditorTree() {
  els.tree.innerHTML = "";
  const currentSet = state.testingSet || state.tree.sets[0]?.name || "";
  const set = state.tree.sets.find((s) => s.name === currentSet);
  if (!set) return;
  const setEl = document.createElement("div");
  setEl.className = "tree-set";
  setEl.innerHTML = `<strong>${escapeHtml(set.name)}</strong>`;
  set.folders.forEach((folder) => {
    const folderEl = document.createElement("div");
    folderEl.className = "tree-folder";
    folderEl.innerHTML = `<div><strong>${escapeHtml(folder.name)}</strong></div>`;
    enableFolderDrop(folderEl, set.name, folder.name);
    folder.questions.forEach((question) => {
      const qEl = document.createElement("div");
      qEl.className = `tree-question${state.selectedQuestionPath === question.path ? " active" : ""}`;
      qEl.draggable = true;
      qEl.dataset.path = question.path;
      qEl.innerHTML = `<div>${escapeHtml(question.title || question.name)}</div><div class="muted">${escapeHtml(question.name)}${question.score == null ? " · 未加载分值" : ` · ${question.score}分`}</div>`;
      qEl.addEventListener("click", () => openQuestion(question.path));
      qEl.addEventListener("dragstart", (event) => {
        qEl.classList.add("dragging");
        event.dataTransfer.setData("text/plain", question.path);
      });
      qEl.addEventListener("dragend", () => qEl.classList.remove("dragging"));
      folderEl.appendChild(qEl);
    });
    setEl.appendChild(folderEl);
  });
  els.tree.appendChild(setEl);
}

function fillEditorSetSelect() {
  if (!els.testingSetSelect) return;
  els.testingSetSelect.innerHTML = "";
  state.tree.sets.forEach((set) => {
    const option = document.createElement("option");
    option.value = set.name;
    option.textContent = set.name;
    option.selected = set.name === state.testingSet;
    els.testingSetSelect.appendChild(option);
  });
  state.testingSet = els.testingSetSelect.value || state.tree.sets[0]?.name || "";
}

function enableFolderDrop(folderEl, setName, folderName) {
  folderEl.addEventListener("dragover", (event) => {
    event.preventDefault();
    folderEl.classList.add("drop-target");
  });
  folderEl.addEventListener("dragleave", () => folderEl.classList.remove("drop-target"));
  folderEl.addEventListener("drop", async (event) => {
    event.preventDefault();
    folderEl.classList.remove("drop-target");
    const fromPath = event.dataTransfer.getData("text/plain");
    if (!fromPath) return;
    await api("/api/move-question", { method: "POST", body: JSON.stringify({ fromPath, toSetName: setName, toFolderName: folderName }) });
    await loadTree();
  });
}

async function createSet() {
  const name = els.newSetName.value.trim();
  if (!name) return;
  await api("/api/create-set", { method: "POST", body: JSON.stringify({ name }) });
  els.newSetName.value = "";
  await loadTree();
}

async function createFolder() {
  const folderName = els.newFolderName.value.trim();
  const setName = getSelectedSetName() || state.tree.sets[0]?.name || "";
  if (!folderName || !setName) return;
  await api("/api/create-folder", { method: "POST", body: JSON.stringify({ setName, folderName }) });
  els.newFolderName.value = "";
  await loadTree();
}

let pendingTitle = "";

async function createQuestion() {
  const rawName = els.newQuestionName.value.trim();
  const fileName = rawName || "问题1.json";
  const questionTitle = fileName.replace(/\.json$/i, "");
  const target = getSelectedFolderTarget();
  if (!target.setName || !target.folderName) return;
  pendingTitle = questionTitle;
  const result = await api("/api/create-question", { method: "POST", body: JSON.stringify({ setName: target.setName, folderName: target.folderName, fileName }) });
  els.newQuestionName.value = "";
  await loadTree();
  await openQuestion(result.path);
}

function getSelectedSetName() {
  return (state.selectedQuestionPath || "").split("/")[0] || "";
}

function getSelectedFolderTarget() {
  const parts = (state.selectedQuestionPath || "").split("/");
  if (parts.length >= 2) {
    return { setName: parts[0], folderName: parts[1] };
  }
  const firstSet = state.tree.sets[0];
  return {
    setName: firstSet?.name || "",
    folderName: firstSet?.folders[0]?.name || "",
  };
}

function updateUnsavedIndicator() {
  const wrap = els.title.closest(".title-input-wrap");
  if (wrap) {
    if (state.hasUnsavedChanges) {
      wrap.classList.add("unsaved");
    } else {
      wrap.classList.remove("unsaved");
    }
  }
}

function checkUnsavedAndProceed(callback) {
  if (!state.hasUnsavedChanges) {
    callback();
    return;
  }
  if (confirm("当前题目有未保存的更改，是否保存？")) {
    saveQuestion().then(() => callback());
  } else {
    state.hasUnsavedChanges = false;
    callback();
  }
}

async function openQuestion(questionPath) {
  if (state.selectedQuestionPath && state.hasUnsavedChanges) {
    checkUnsavedAndProceed(() => doOpenQuestion(questionPath));
  } else {
    doOpenQuestion(questionPath);
  }
}

async function doOpenQuestion(questionPath) {
  const payload = await api(`/api/question?path=${encodeURIComponent(questionPath)}`);
  state.selectedQuestionPath = questionPath;
  state.currentQuestion = payload.content;
  renderTree();
  renderEditor();
}

function renderEditor() {
  if (!state.currentQuestion) {
    els.editorPanelHeader?.classList.add("hidden");
    els.editorEmpty.classList.remove("hidden");
    els.questionForm.classList.add("hidden");
    return;
  }
  els.editorPanelHeader?.classList.remove("hidden");
  els.editorEmpty.classList.add("hidden");
  els.questionForm.classList.remove("hidden");
  const question = state.currentQuestion;
  els.questionPath.value = state.selectedQuestionPath;
  els.title.value = question.title || "";
  els.score.value = Number(question.score ?? 1);
  els.systemPrompt.value = question.systemPrompt || "";
  els.note.value = question.note || "";
  els.expectedAnswer.value = question.expectedAnswer || "";
  els.checker.value = question.checker || "";
  els.rounds.innerHTML = "";
  (question.conversation || []).forEach((round, index) => els.rounds.appendChild(createRoundEditor(round, index)));
  if (pendingTitle) {
    els.title.value = pendingTitle;
    question.title = pendingTitle;
    const firstRound = els.rounds.children[0];
    const textField = firstRound?.querySelector(".part-text");
    if (textField) {
      textField.value = pendingTitle;
      if (question.conversation?.[0]?.user?.parts?.[0]) {
        question.conversation[0].user.parts[0].text = pendingTitle;
      }
    }
    pendingTitle = "";
    state.hasUnsavedChanges = true;
  }
  state.hasUnsavedChanges = !!pendingTitle;
  updateUnsavedIndicator();
}

function createRoundEditor(round, index) {
  const roundEl = document.getElementById("roundTemplate").content.firstElementChild.cloneNode(true);
  roundEl.querySelector(".round-title").textContent = `轮次 ${index + 1}`;
  const userPartsEl = roundEl.querySelector(".user-parts");
  const assistantListEl = roundEl.querySelector(".assistant-list");
  (round.user?.parts || []).forEach((part) => userPartsEl.appendChild(createPartEditor(part)));
  (round.assistant || []).forEach((assistant) => assistantListEl.appendChild(createAssistantEditor(assistant)));
  roundEl.querySelector(".addTextPartBtn").addEventListener("click", () => userPartsEl.appendChild(createPartEditor({ type: "text", text: "" })));
  roundEl.querySelector(".addImagePartBtn").addEventListener("click", () => userPartsEl.appendChild(createPartEditor({ type: "image", assetPath: "" })));
  roundEl.querySelector(".addAssistantBtn").addEventListener("click", () => assistantListEl.appendChild(createAssistantEditor({ mode: "generate", content: "" })));
  roundEl.querySelector(".removeRoundBtn").addEventListener("click", () => roundEl.remove());
  return roundEl;
}

function createPartEditor(part) {
  const wrap = document.createElement("div");
  wrap.className = `part-card ${part.type === "image" ? "image" : "text"}`;
  if (part.type === "image") {
    wrap.innerHTML = `<div class="inline-grid"><div class="field"><label>图片资源</label><select class="part-asset-select"></select></div><div class="field"><label>上传新图</label><input class="part-upload" type="file" accept="image/*" /></div><div class="field buttons"><button type="button" class="removePartBtn">删除</button></div></div><div class="part-preview"></div>`;
    fillAssetSelect(wrap.querySelector(".part-asset-select"), part.assetPath || "");
    wrap.querySelector(".part-asset-select").addEventListener("change", () => refreshImagePreview(wrap));
    wrap.querySelector(".part-upload").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const setName = getCurrentSetName();
      if (!setName) return;
      const base64 = await fileToBase64(file);
      const uploaded = await api("/api/upload-asset", { method: "POST", body: JSON.stringify({ setName, fileName: file.name, base64 }) });
      await fillAssetSelect(wrap.querySelector(".part-asset-select"), `${setName}/assets/${uploaded.name}`);
      refreshImagePreview(wrap);
    });
    refreshImagePreview(wrap);
  } else {
    wrap.innerHTML = `<div class="field"><label>用户文本</label><textarea class="part-text" rows="5"></textarea></div><div class="toolbar"><button type="button" class="removePartBtn">删除</button></div>`;
    wrap.querySelector(".part-text").value = part.text || "";
  }
  wrap.querySelector(".removePartBtn").addEventListener("click", () => wrap.remove());
  return wrap;
}

async function fillAssetSelect(selectEl, value) {
  const setName = getCurrentSetName();
  if (!setName) {
    selectEl.innerHTML = `<option value="">请先选择题目</option>`;
    return;
  }
  const assets = await api(`/api/assets?setName=${encodeURIComponent(setName)}`);
  selectEl.innerHTML = `<option value="">请选择图片</option>`;
  assets.forEach((asset) => {
    const option = document.createElement("option");
    option.value = `${setName}/assets/${asset.name}`;
    option.textContent = asset.name;
    option.selected = option.value === value;
    selectEl.appendChild(option);
  });
}

function refreshImagePreview(wrap) {
  const select = wrap.querySelector(".part-asset-select");
  const preview = wrap.querySelector(".part-preview");
  preview.innerHTML = select.value ? `<img src="/dataset-file/${encodeURIComponent(select.value)}" alt="" />` : `<div class="muted">未选择图片</div>`;
}

function createAssistantEditor(item) {
  const wrap = document.createElement("div");
  wrap.className = "assistant-card";
  wrap.innerHTML = `<div class="inline-grid"><div class="field"><label>助手回答内容</label><textarea class="assistant-content" rows="2"></textarea></div><div class="field"><label>助手回答模式</label><select class="assistant-mode"><option value="generate">留空时由模型生成</option><option value="seed">视作已有助手回答</option><option value="continue">作为助手续写上下文</option></select></div></div><div class="field buttons"><button type="button" class="removeAssistantBtn">删除</button></div>`;
  wrap.querySelector(".assistant-mode").value = item.mode || "generate";
  wrap.querySelector(".assistant-content").value = item.content || "";
  wrap.querySelector(".removeAssistantBtn").addEventListener("click", () => wrap.remove());
  return wrap;
}

function collectQuestionFromForm() {
  return {
    version: 1,
    title: els.title.value.trim(),
      score: Number(els.score.value || 0),
      systemPrompt: els.systemPrompt.value,
      note: els.note.value,
      expectedAnswer: els.expectedAnswer.value,
    checker: els.checker.value,
    conversation: [...els.rounds.children].map((roundEl) => ({
      user: {
        parts: [...roundEl.querySelector(".user-parts").children].map((partEl) => partEl.classList.contains("image") ? { type: "image", assetPath: partEl.querySelector(".part-asset-select").value } : { type: "text", text: partEl.querySelector(".part-text").value }),
      },
      assistant: [...roundEl.querySelector(".assistant-list").children].map((assistantEl) => ({
        mode: assistantEl.querySelector(".assistant-mode").value,
        content: assistantEl.querySelector(".assistant-content").value,
      })),
    })),
    metadata: state.currentQuestion?.metadata || {},
  };
}

async function saveQuestion(options = {}) {
  if (!state.selectedQuestionPath) return;
  const showToastOnSuccess = Boolean(options.showToast);
  const content = collectQuestionFromForm();
  await api("/api/question", { method: "POST", body: JSON.stringify({ path: state.selectedQuestionPath, content }) });
  state.currentQuestion = content;
  const existingTestingItem = state.testingItems.find((item) => item.path === state.selectedQuestionPath);
  if (existingTestingItem) {
    existingTestingItem.question = cloneSimpleJson(content);
    existingTestingItem.title = content.title || existingTestingItem.fileName || existingTestingItem.title;
    existingTestingItem.score = Number(content.score || 0);
  }
  state.hasUnsavedChanges = false;
  updateUnsavedIndicator();
  await loadTree();
  await renderTestingList();
  if (showToastOnSuccess) {
    showToast("题目已保存");
  }
}

async function quickRunCurrentQuestion() {
  if (!state.selectedQuestionPath) return;
  await saveQuestion();
  await loadTree();
  state.testingSet = getCurrentSetName();
  localStorage.setItem(LAST_TESTING_SET_KEY, state.testingSet);
  state.pendingTestingFocusPath = state.selectedQuestionPath;
  state.testingSelectedPath = state.selectedQuestionPath;
  await syncTestingSelectors();
  switchPage("testing", { immediateScrollRestore: true });
  const item = state.testingItems.find((entry) => entry.path === state.selectedQuestionPath);
  if (item) {
    item.result = null;
    item.running = false;
    item.open = true;
    setTestingSelected(item.path);
    await focusTestingCard(item.path);
    await runSingleTest(item.path);
  }
}

function addRound(round = null) {
  els.rounds.appendChild(createRoundEditor(round || { user: { parts: [{ type: "text", text: "" }] }, assistant: [{ mode: "generate", content: "" }] }, els.rounds.children.length));
}

async function loadSettings() {
  state.settings = await api("/api/settings");
  if (!state.settings.presets.length) {
    state.settings = { activePresetId: "default", chatContinueMode: "completions", presets: [{ id: "default", name: "默认预设", model: "", baseUrl: "http://127.0.0.1:1234/v1", apiKey: "", extraConfig: "{}" }], systemPromptPresets: [], defaultSystemPrompt: "", continuePrompt: "请续写上一条回答，只输出续写部分，不要重复前文。" };
  }
  state.settings.chatContinueMode = state.settings.chatContinueMode || "completions";
  if (!state.settings.systemPromptPresets || !state.settings.systemPromptPresets.length) {
    state.settings.systemPromptPresets = [{ id: "default", name: "默认助手", content: "You are a helpful AI assistant.\n使用中文回答用户问题。" }];
    state.settings.defaultSystemPrompt = state.settings.systemPromptPresets[0].id;
  }
  if (!state.settings.continuePrompt) {
    state.settings.continuePrompt = "请续写上一条回答，只输出续写部分，不要重复前文。";
  }
  renderSettings();
}

function renderSettings() {
  els.presetCards.innerHTML = "";
  els.testingPresetSelect.innerHTML = "";
  if (els.chatPresetSelect) els.chatPresetSelect.innerHTML = "";
  state.settings.presets.forEach((preset) => {
    const card = document.createElement("div");
    card.className = `preset-card${preset.id === state.settings.activePresetId ? " active" : ""}`;
    card.innerHTML = `<div class="preset-card-title">${escapeHtml(preset.model || preset.name || "未命名模型")}</div><div>${escapeHtml(preset.name || "")}</div><div class="preset-card-meta">${escapeHtml(preset.baseUrl || "")}</div>`;
    card.addEventListener("click", () => {
      state.settings.activePresetId = preset.id;
      renderSettings();
    });
    els.presetCards.appendChild(card);

    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.model ? `${preset.model} · ${preset.name}` : preset.name;
    option.selected = preset.id === state.testingPresetId || (!state.testingPresetId && preset.id === state.settings.activePresetId);
    els.testingPresetSelect.appendChild(option);
    if (els.chatPresetSelect) {
      const chatOption = option.cloneNode(true);
      chatOption.selected = preset.id === (state.chatPresetId || state.testingPresetId || state.settings.activePresetId);
      els.chatPresetSelect.appendChild(chatOption);
    }
  });
  state.testingPresetId = els.testingPresetSelect.value || state.settings.presets[0]?.id || "";
  state.chatPresetId = els.chatPresetSelect?.value || state.chatPresetId || state.testingPresetId;
  if (els.chatContinueMode) els.chatContinueMode.value = state.settings.chatContinueMode || "completions";
  const continuePromptEl = document.getElementById("continuePrompt");
  if (continuePromptEl) {
    continuePromptEl.value = state.settings.continuePrompt || "请续写上一条回答，只输出续写部分，不要重复前文。";
  }
  renderPresetFields();
  renderCheckerTemplateControls();
  renderSystemPromptPresets();
}

function renderSystemPromptPresets() {
  const list = document.getElementById("systemPromptsList");
  if (!list) return;
  list.innerHTML = "";
  state.settings.systemPromptPresets?.forEach((preset) => {
    const card = document.createElement("div");
    card.className = "system-prompt-card";
    card.innerHTML = `<div class="system-prompt-card-header">
      <span class="system-prompt-card-title">${escapeHtml(preset.name)}</span>
      <div class="system-prompt-card-actions">
        <button type="button" class="editSystemPromptBtn" data-id="${preset.id}">编辑</button>
        <button type="button" class="deleteSystemPromptBtn" data-id="${preset.id}">删除</button>
      </div>
    </div>
    <textarea rows="3" class="system-prompt-content" data-id="${preset.id}" placeholder="系统提示词内容">${escapeHtml(preset.content || "")}</textarea>`;
    list.appendChild(card);
  });
  list.querySelectorAll(".editSystemPromptBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const textarea = list.querySelector(`.system-prompt-content[data-id="${id}"]`);
      const newName = prompt("输入预设名称", state.settings.systemPromptPresets.find(p => p.id === id)?.name || "");
      if (!newName) return;
      const preset = state.settings.systemPromptPresets.find(p => p.id === id);
      if (preset) {
        preset.name = newName;
        preset.content = textarea.value;
        saveSettings();
      }
    });
  });
  list.querySelectorAll(".deleteSystemPromptBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (state.settings.systemPromptPresets.length <= 1) return alert("至少保留一个预设");
      state.settings.systemPromptPresets = state.settings.systemPromptPresets.filter(p => p.id !== id);
      if (state.settings.defaultSystemPrompt === id) {
        state.settings.defaultSystemPrompt = state.settings.systemPromptPresets[0]?.id || "";
      }
      saveSettings();
    });
  });
  list.querySelectorAll(".system-prompt-content").forEach(textarea => {
    textarea.addEventListener("change", () => {
      const id = textarea.dataset.id;
      const preset = state.settings.systemPromptPresets.find(p => p.id === id);
      if (preset) {
        preset.content = textarea.value;
        saveSettings();
      }
    });
  });
}

function addSystemPromptPreset() {
  const name = prompt("输入预设名称", "新预设");
  if (!name) return;
  state.settings.systemPromptPresets = state.settings.systemPromptPresets || [];
  state.settings.systemPromptPresets.push({ id: `sp-${Date.now()}`, name, content: "" });
  renderSettings();
  saveSettings();
}

function renderPresetFields() {
  const preset = getActivePreset();
  if (!preset) return;
  els.presetName.value = preset.name || "";
  els.baseUrl.value = preset.baseUrl || "";
  els.model.value = preset.model || "";
  els.apiKey.value = preset.apiKey || "";
  els.extraConfig.value = preset.extraConfig || "{}";
}

function createPreset() {
  const name = (els.presetName.value || "").trim();
  if (!name) return;
  const id = `preset-${Date.now()}`;
  state.settings.presets.push({ id, name, model: name, baseUrl: "http://127.0.0.1:1234/v1", apiKey: "", extraConfig: "{}" });
  state.settings.activePresetId = id;
  renderSettings();
}

function deletePreset() {
  if (state.settings.presets.length <= 1) return;
  state.settings.presets = state.settings.presets.filter((item) => item.id !== state.settings.activePresetId);
  state.settings.activePresetId = state.settings.presets[0].id;
  renderSettings();
}

async function saveSettings() {
  const preset = getActivePreset();
  if (!preset) return;
  preset.name = els.presetName.value.trim() || preset.name;
  preset.baseUrl = els.baseUrl.value.trim();
  preset.model = els.model.value.trim();
  preset.apiKey = els.apiKey.value.trim();
  preset.extraConfig = els.extraConfig.value.trim() || "{}";
  state.settings.chatContinueMode = els.chatContinueMode?.value || "completions";
  const continuePromptEl = document.getElementById("continuePrompt");
  if (continuePromptEl) {
    state.settings.continuePrompt = continuePromptEl.value;
  }
  await api("/api/settings", { method: "POST", body: JSON.stringify(state.settings) });
  renderSettings();
}

async function syncTestingSelectors() {
  const savedSet = localStorage.getItem(LAST_TESTING_SET_KEY);
  state.testingSet = state.testingSet || savedSet || state.tree.sets[0]?.name || "";
  state.compareSet = state.compareSet || state.testingSet || state.tree.sets[0]?.name || "";
  els.testingSetSelect.innerHTML = "";
  state.tree.sets.forEach((set) => {
    const option = document.createElement("option");
    option.value = set.name;
    option.textContent = set.name;
    option.selected = set.name === state.testingSet;
    els.testingSetSelect.appendChild(option);
  });
  if (!state.testingSet && state.tree.sets[0]) {
    state.testingSet = state.tree.sets[0].name;
    els.testingSetSelect.value = state.testingSet;
  }
  if (!state.tree.sets.some((set) => set.name === state.testingSet)) {
    state.testingSet = state.tree.sets[0]?.name || "";
    els.testingSetSelect.value = state.testingSet;
  }
  if (!state.tree.sets.some((set) => set.name === state.compareSet)) {
    state.compareSet = state.tree.sets[0]?.name || "";
  }
  if (!state.testingPresetId) state.testingPresetId = state.settings.activePresetId || state.settings.presets[0]?.id || "";
  await renderTestingList();
  renderComparePage();
}

async function renderTestingList() {
  const set = state.tree.sets.find((item) => item.name === state.testingSet);
  const items = [];
  if (set) {
    set.folders.forEach((folder) => folder.questions.forEach((question) => items.push({ path: question.path, title: question.title || question.name, fileName: question.name, folderName: folder.name, score: question.score || 0, open: false, running: false, result: null, manualScore: null, followUpText: "" })));
  }
  const oldMap = new Map(state.testingItems.map((item) => [item.path, item]));
  state.testingItems = items.map((item) => {
    const old = oldMap.get(item.path);
    if (old) {
      Object.assign(old, {
        ...item,
        result: old.result,
        manualScore: old.manualScore,
        open: old.open,
        running: old.running,
        stopRequested: old.stopRequested || false,
        abortController: old.abortController || null,
        question: old.question || null,
        followUpText: old.followUpText || "",
      });
      return old;
    }
    return item;
  });
  await refreshTestingView();
  renderTestingTree();
}

async function createTestingCard(item) {
  const shouldLoadQuestion = Boolean(item.open || item.question || item.result);
  const questionData = shouldLoadQuestion ? (item.question || (await api(`/api/question?path=${encodeURIComponent(item.path)}`)).content) : null;
  if (questionData) {
    item.question = questionData;
    item.title = questionData.title || item.fileName || item.title;
    item.score = Number(questionData.score || 0);
  }
  const details = document.createElement("details");
  const isSelected = item.path === state.testingSelectedPath;
  details.className = `test-card ${getTestStatusClass(item)}${isSelected ? " selected" : ""}`;
  details.dataset.path = item.path;
  details.open = Boolean(item.open);
  details.addEventListener("toggle", () => {
    item.open = details.open;
    if (details.open && !item.question) {
      refreshTestingView();
      return;
    }
    if (!details.open) {
      requestAnimationFrame(() => scrollCardBelowFolderHeader(details));
    }
  });
  details.addEventListener("click", (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("textarea")) return;
    setTestingSelected(item.path);
    highlightSelectedCard(item.path);
  });

  const summary = document.createElement("summary");
  const runStat = getRunStat(item.result);
  const fullScore = item.score;
  summary.innerHTML = `<div class="test-header"><div class="test-title">${escapeHtml(item.title)}</div><div class="score-badge">${formatScore(item.manualScore ?? item.result?.score?.earned ?? 0)} / ${formatScore(item.score)}</div><div class="header-score-input"><div class="header-score-label">手动分数</div><div class="score-input-row"><input class="manualScoreInput" type="number" min="0" step="0.5" /><div class="quick-score-btns"><button type="button" class="quick-score-btn" data-score="${fullScore}">对</button><button type="button" class="quick-score-btn" data-score="0">错</button><button type="button" class="quick-score-btn" data-score="${fullScore / 2}">半</button></div></div></div><div class="run-stats">${runStat}</div></div>`;
  details.appendChild(summary);

  const body = document.createElement("div");
  body.className = "test-body";
  const conversation = document.createElement("div");
  const side = document.createElement("div");
  side.className = "test-side";
  const expectedText = questionData?.expectedAnswer?.trim() ? escapeHtml(questionData.expectedAnswer) : "展开后加载";
  const noteText = questionData?.note?.trim() ? escapeHtml(questionData.note) : "展开后加载";
  side.innerHTML = `<div class="toolbar"><button type="button" class="runOneBtn">${item.running ? "停止本题" : "测试本题"}</button></div><div class="status-line">${item.running ? "正在按轮次自动测试..." : "就绪"}</div><div class="status-extra">${renderStatusExtra(item, expectedText, noteText)}</div>`;
  const runButton = side.querySelector(".runOneBtn");
  runButton.disabled = false;
  runButton.addEventListener("click", () => {
    if (item.running) {
      stopSingleTest(item.path);
      return;
    }
    runSingleTest(item.path);
  });
  const headerScoreInput = summary.querySelector(".manualScoreInput");
  headerScoreInput.value = item.manualScore ?? item.result?.score?.earned ?? 0;
  headerScoreInput.addEventListener("change", async (event) => {
    item.manualScore = event.target.value === "" ? null : Number(event.target.value);
    setTestingSelected(item.path);
    updateScoreSummary();
    await refreshTestingView();
  });
  const quickScoreBtns = summary.querySelectorAll(".quick-score-btn");
  quickScoreBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const score = Number(btn.dataset.score);
      item.manualScore = score;
      headerScoreInput.value = score;
      setTestingSelected(item.path);
      updateScoreSummary();
      await refreshTestingView();
    });
  });

  body.append(conversation, side);
  details.appendChild(body);
  if (questionData) {
    renderQuestionConversation(item, conversation);
  } else {
    conversation.innerHTML = `<div class="empty-state">展开题目后加载完整内容</div>`;
  }
  return details;
}

async function renderQuestionConversation(item, targetEl) {
  if (!item.question) {
    item.question = (await api(`/api/question?path=${encodeURIComponent(item.path)}`)).content;
  }
  renderConversationContent(item.question, item.result?.transcript, targetEl, { isLoadedResult: state.isLoadingResult });

  const followWrap = document.createElement("details");
  followWrap.className = "drawer";
  followWrap.open = false;
  followWrap.innerHTML = `<summary style="position: unset;">追问 ▾</summary><div class="field"><textarea class="followUpInput" rows="3" placeholder="会以当前上下文继续提问"></textarea></div><div class="toolbar"><button type="button" class="sendFollowUpBtn">发送追问</button></div>`;
  followWrap.querySelector(".followUpInput").value = item.followUpText || "";
  followWrap.querySelector(".followUpInput").addEventListener("input", (event) => {
    item.followUpText = event.target.value;
  });
  followWrap.querySelector(".sendFollowUpBtn").addEventListener("click", async () => {
    if (!item.followUpText.trim()) return;
    setTestingSelected(item.path);
    await runSingleTest(item.path);
  });
  targetEl.appendChild(followWrap);
}

function renderConversationContent(question, transcript, targetEl, options = {}) {
  targetEl.innerHTML = "";
  const hasSystemInTranscript = transcript?.some((e) => e.role === "system");
  if (!options.hideSystemPrompt && question?.systemPrompt && !hasSystemInTranscript) {
    targetEl.appendChild(renderMessageBubble("system", question.systemPrompt));
  }
  const draftTranscript = buildDraftTranscript(question || {});
  const mergedTranscript = mergeTranscriptWithDraft(transcript, draftTranscript).filter((entry) => !options.hideSystemPrompt || entry.role !== "system");
  mergedTranscript.forEach((entry, index) => {
    targetEl.appendChild(renderTranscriptEntry(entry, index, mergedTranscript, Boolean(options.isLoadedResult), question));
  });
}

async function ensureCompareQuestion(path) {
  if (!state.compareQuestionCache.has(path)) {
    state.compareQuestionCache.set(path, api(`/api/question?path=${encodeURIComponent(path)}`).then((payload) => payload.content));
  }
  return await state.compareQuestionCache.get(path);
}

async function renderCompareConversation(item, questionInfo, targetEl, options = {}) {
  const question = await ensureCompareQuestion(questionInfo.path);
  renderConversationContent(question, item.result?.transcript, targetEl, { isLoadedResult: true, hideSystemPrompt: Boolean(options.hideSystemPrompt) });
}

function mergeTranscriptWithDraft(transcript, draft) {
  if (!transcript || transcript.length === 0) {
    return draft;
  }

  const result = [];

  const draftSystem = draft.find(e => e.role === "system");
  const transcriptSystem = transcript.find(e => e.role === "system");
  if (draftSystem && !transcriptSystem) {
    result.push(draftSystem);
  } else if (transcriptSystem) {
    result.push(transcriptSystem);
  }

  const transcriptUsers = transcript.filter(e => e.role === "user");
  const transcriptAssistants = transcript.filter(e => e.role === "assistant");
  const draftUserCount = draft.filter(e => e.role === "user").length;
  const draftAssistantCount = draft.filter(e => e.role === "assistant").length;

  const hasAllDraftEntries = transcriptUsers.length >= draftUserCount && transcriptAssistants.length >= draftAssistantCount;
  if (hasAllDraftEntries) {
    return [...result, ...transcript.filter(e => e.role !== "system")];
  }

  let draftUserIdx = 0;
  let draftAssistantIdx = 0;

  for (const entry of draft) {
    if (entry.role === "system") {
      continue;
    } else if (entry.role === "user") {
      if (draftUserIdx < transcriptUsers.length) {
        result.push(transcriptUsers[draftUserIdx]);
      } else {
        result.push(entry);
      }
      draftUserIdx++;
    } else {
      if (draftAssistantIdx < transcriptAssistants.length) {
        result.push(transcriptAssistants[draftAssistantIdx]);
      } else {
        result.push(entry);
      }
      draftAssistantIdx++;
    }
  }

  return result;
}

function buildDraftTranscript(question) {
  const transcript = [];
  (question.conversation || []).forEach((round) => {
    transcript.push({ role: "user", content: [...(round.user?.parts || [])] });
    (round.assistant || []).forEach((assistant) => {
      if (assistant.content) transcript.push({ role: "assistant", content: assistant.content, mode: assistant.mode || "seed" });
      else transcript.push({ role: "assistant", content: "", mode: assistant.mode || "generate", pending: true });
    });
  });
  return transcript;
}

function findAssetPathForUserEntry(userEntryIndex, conversationRounds) {
  if (userEntryIndex < 0 || userEntryIndex >= conversationRounds.length) return null;
  const round = conversationRounds[userEntryIndex];
  const parts = round?.user?.parts || [];
  const imagePart = parts.find(p => p.type === "image" && p.assetPath);
  return imagePart?.assetPath || null;
}

function renderTranscriptEntry(entry, index, transcript, isLoadedResult = false, question = null) {
  const conversationRounds = question?.conversation || [];
  const userEntryCount = transcript.slice(0, index + 1).filter(e => e.role === "user").length;
  if (entry.role === "system") {
    return renderMessageBubble("system", entry.content);
  }

  if (entry.role === "user") {
    const wrap = document.createElement("div");
    (entry.content || []).forEach((part) => {
      if (part.type === "image" && part.assetPath) {
        const bubble = document.createElement("div");
        bubble.className = "message-bubble message-user";
        const imgSrc = `/dataset-file/${encodeURIComponent(part.assetPath)}`;
        const img = document.createElement("img");
        img.src = imgSrc;
        img.alt = "";
        img.style.maxWidth = "280px";
        img.style.borderRadius = "8px";
        img.style.cursor = "zoom-in";
        img.addEventListener("click", () => {
          const modalOverlay = document.getElementById("modal-overlay");
          const modalBody = document.getElementById("modal-body");
          if (modalOverlay && modalBody) {
            let is1to1 = false;
            modalBody.innerHTML = "";
            const imgFull = document.createElement("img");
            imgFull.src = imgSrc;
            imgFull.classList.add("modal-full-img");
            const toggleBtn = document.createElement("button");
            toggleBtn.textContent = "1:1";
            toggleBtn.classList.add("modal-toggle-btn");
            toggleBtn.addEventListener("click", () => {
              is1to1 = !is1to1;
              if (is1to1) {
                imgFull.style.maxWidth = "none";
                imgFull.style.maxHeight = "none";
                imgFull.style.width = "auto";
                imgFull.style.height = "auto";
              } else {
                imgFull.style.maxWidth = "100%";
                imgFull.style.maxHeight = "calc(100vh - 100px)";
                imgFull.style.width = "";
                imgFull.style.height = "";
              }
              toggleBtn.textContent = is1to1 ? "适应窗口" : "1:1";
            });
            const toggleBtn2 = document.createElement("button");
            toggleBtn2.textContent = "切换背景";
            toggleBtn2.classList.add("modal-toggle-btn");
            let isDark = false;
            toggleBtn2.addEventListener("click", () => {
              isDark = !isDark;
              const modalContent = document.querySelector(".modal-content");
              if (modalContent) {
                modalContent.classList.toggle("dark", isDark);
              }
            });
            modalBody.appendChild(toggleBtn);
            modalBody.appendChild(toggleBtn2);
            modalBody.appendChild(imgFull);
            modalOverlay.style.display = "flex";
            modalOverlay.onclick = (e) => {
              if (e.target === modalOverlay) {
                modalOverlay.style.display = "none";
              }
            };
          }
        });
        bubble.appendChild(img);
        wrap.appendChild(bubble);
      } else if (part.type === "image_url" && part.image_url?.url) {
        const url = part.image_url.url;
        if (url.startsWith("data:") || url.startsWith("/dataset-file/")) {
          let displayUrl = url;
          if (url.startsWith("data:") && conversationRounds.length > 0) {
            const assetPath = findAssetPathForUserEntry(userEntryCount - 1, conversationRounds);
            if (assetPath) {
              displayUrl = `/dataset-file/${encodeURIComponent(assetPath)}`;
            }
          }
          const bubble = document.createElement("div");
          bubble.className = "message-bubble message-user";
          const imgSrc = displayUrl;
          const img = document.createElement("img");
          img.src = imgSrc;
          img.alt = "";
          img.style.maxWidth = "280px";
          img.style.borderRadius = "8px";
          if (url.startsWith("data:")) {
            img.style.cursor = "zoom-in";
            img.addEventListener("click", () => {
              const modalOverlay = document.getElementById("modal-overlay");
              const modalBody = document.getElementById("modal-body");
              if (modalOverlay && modalBody) {
                modalBody.innerHTML = "";
                const imgFull = document.createElement("img");
                imgFull.src = imgSrc;
                imgFull.style.display = "block";
                imgFull.style.maxWidth = "100%";
                imgFull.style.maxHeight = "calc(100vh - 100px)";
                modalBody.appendChild(imgFull);
                modalOverlay.style.display = "flex";
                modalOverlay.onclick = (e) => {
                  if (e.target === modalOverlay) {
                    modalOverlay.style.display = "none";
                  }
                };
              }
            });
          }
          bubble.appendChild(img);
          wrap.appendChild(bubble);
        }
      } else {
        wrap.appendChild(renderMessageBubble("user", part.text || ""));
      }
    });
    return wrap;
  }

  const wrap = document.createElement("div");
  wrap.className = "message-assistant-wrap";
  wrap.appendChild(renderMessageBubble("assistant", entry.content || (entry.pending ? "_等待模型回答_" : ""), entry.reasoning || ""));
  
  const showMetaButton = !isLoadedResult || entry.role === "assistant";
  
  if (showMetaButton && (entry.request || entry.response || entry.meta)) {
    const controls = document.createElement("div");
    controls.className = "message-controls";
    if (entry.request || entry.response || entry.meta) {
      const rawBtn = document.createElement("button");
      rawBtn.type = "button";
      rawBtn.textContent = "元数据";

      rawBtn.addEventListener("click", () => {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        if (modalOverlay && modalBody) {
          modalBody.textContent = JSON.stringify({ meta: entry.meta, request: entry.request, response: entry.response }, null, 2);
          modalOverlay.style.display = 'flex';

          modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
              modalOverlay.style.display = 'none';
            }
          };
        }
      });

      controls.appendChild(rawBtn);
    }

    if (entry.reasoning) {
        const reasonBtn = document.createElement("button");
        reasonBtn.type = "button";
        reasonBtn.textContent = "思考过程";

        reasonBtn.addEventListener("click", () => {
          const modalOverlay = document.getElementById('modal-overlay');
          const modalBody = document.getElementById('modal-body');
          if (modalOverlay && modalBody) {
            modalBody.textContent = entry.reasoning;
            modalOverlay.style.display = 'flex';

            modalOverlay.onclick = (e) => {
              if (e.target === modalOverlay) {
                modalOverlay.style.display = 'none';
              }
            };
          }
        });

      controls.appendChild(reasonBtn);
    }

    wrap.appendChild(controls);
  } else if (entry.reasoning) {
    const controls = document.createElement("div");
    controls.className = "message-controls";
    const reasonBtn = document.createElement("button");
    reasonBtn.type = "button";
    reasonBtn.textContent = "思考过程";

    reasonBtn.addEventListener("click", () => {
      const modalOverlay = document.getElementById('modal-overlay');
      const modalBody = document.getElementById('modal-body');
      if (modalOverlay && modalBody) {
        modalBody.textContent = entry.reasoning;
        modalOverlay.style.display = 'flex';

        modalOverlay.onclick = (e) => {
          if (e.target === modalOverlay) {
            modalOverlay.style.display = 'none';
          }
        };
      }
    });

    controls.appendChild(reasonBtn);
    wrap.appendChild(controls);
  }
  return wrap;
}



async function runSingleTest(questionPath, step = null) {
  const item = state.testingItems.find((entry) => entry.path === questionPath);
  if (!item) return;
  const isTopLevelRun = step === null;
  if (isTopLevelRun) {
    item.stopRequested = false;
  }
  if ((state.isBatchRunning && state.stopAllRequested) || item.stopRequested) {
    item.running = false;
    return;
  }
  if (item.running && isTopLevelRun) return;
  const preset = getTestingPreset();
  if (!preset) return;
  if (!item.question) item.question = (await api(`/api/question?path=${encodeURIComponent(questionPath)}`)).content;

  const conversationRounds = item.question.conversation || [];
  const hasFollowUpText = item.followUpText && item.followUpText.trim();
  const hasExistingAssistant = Boolean(item.result?.transcript?.some(e => e.role === "assistant"));
  const isFollowUpCall = isTopLevelRun && hasFollowUpText && hasExistingAssistant;
  const isInitialRun = isTopLevelRun && !isFollowUpCall;
  
  let currentStep;
  if (isInitialRun) {
    currentStep = 1;
  } else if (step !== null) {
    currentStep = step;
  } else if (isFollowUpCall) {
    currentStep = conversationRounds.length + 1;
  } else {
    const existingUserCount = (item.result?.transcript || []).filter(e => e.role === "user").length;
    currentStep = Math.max(1, existingUserCount + 1);
  }
  
  const maxStep = hasFollowUpText ? conversationRounds.length + 1 : conversationRounds.length;
  if (DEBUG_TEST_FLOW) {
    console.log("[runSingleTest:start]", {
      questionPath,
      inputStep: step,
      currentStep,
      maxStep,
      isInitialRun,
      isFollowUpCall,
      hasFollowUpText: Boolean(hasFollowUpText),
      existingTranscriptLength: item.result?.transcript?.length || 0,
    });
  }

  if (isInitialRun) {
    item.running = true;
    item.stopRequested = false;
    item.result = null;
    item.manualScore = null;
  } else {
    item.running = true;
  }

  updateStopButton();
  await refreshTestingView();
  const startTime = Date.now();
  const controller = new AbortController();
  item.abortController = controller;
  try {
    const existingTranscript = isInitialRun ? [] : (item.result?.transcript || []);
    const apiResult = await api("/api/run-test", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        preset,
        question: item.question,
        followUpText: isFollowUpCall ? item.followUpText : "",
        step: currentStep,
        preserveMetadata: true,
        existingTranscript
      })
    });
    const duration = Date.now() - startTime;
    if (DEBUG_TEST_FLOW) {
      console.log("[runSingleTest:apiResult]", {
        questionPath,
        currentStep,
        maxStep,
        durationMs: duration,
        transcriptLength: apiResult?.transcript?.length || 0,
        assistantCount: (apiResult?.transcript || []).filter((e) => e.role === "assistant").length,
        userCount: (apiResult?.transcript || []).filter((e) => e.role === "user").length,
      });
    }

    if (currentStep >= maxStep) {
      item.result = { ...item.result, ...apiResult, _duration: (item.result?._duration || 0) + duration };
      setTestingSelected(item.path);
    } else {
      if ((state.isBatchRunning && state.stopAllRequested) || item.stopRequested) {
        return;
      }
      item.result = {
        ...item.result,
        ...apiResult,
        score: { earned: 0, total: item.score, passed: false },
        _duration: (item.result?._duration || 0) + duration,
      };
      item.running = true;
      setTestingSelected(item.path);
      await refreshTestingView();
      const nextStep = currentStep + 1;
      await runSingleTest(questionPath, nextStep);
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      if (DEBUG_TEST_FLOW) {
        console.warn("[runSingleTest:aborted]", { questionPath, currentStep });
      }
      return;
    }
    if (DEBUG_TEST_FLOW) {
      console.error("[runSingleTest:error]", { questionPath, currentStep, message: error.message });
    }
    const prevResult = item.result || {};
    item.result = {
      ...prevResult,
      answer: prevResult.answer || "",
      transcript: prevResult.transcript || [],
      score: { earned: 0, total: item.score, passed: false, error: error.message },
    };
  } finally {
    if (item.abortController === controller) {
      item.abortController = null;
    }
    item.stopRequested = false;
    item.running = false;
    updateStopButton();
    await refreshTestingView();
  }
}

async function runAllTests() {
  state.isBatchRunning = true;
  state.stopAllRequested = false;
  state.testingItems.forEach((item) => {
    item.stopRequested = false;
  });
  updateStopButton();
  for (const item of state.testingItems) {
    if (state.excludedTestingFolders.has(item.folderName || "未分组")) continue;
    if (state.stopAllRequested) break;
    await runSingleTest(item.path, null);
  }
  state.isBatchRunning = false;
  state.stopAllRequested = false;
  updateStopButton();
}

function stopAllTests() {
  if (state.isBatchRunning) {
    state.stopAllRequested = true;
  }
  state.testingItems.forEach((item) => {
    item.stopRequested = true;
    if (item.abortController) {
      item.abortController.abort();
    }
  });
  updateStopButton();
}

function stopSingleTest(questionPath) {
  const item = state.testingItems.find((entry) => entry.path === questionPath);
  if (!item) return;
  item.stopRequested = true;
  if (item.abortController) {
    item.abortController.abort();
  }
  updateStopButton();
}

function updateStopButton() {
  const isRunning = state.testingItems.some((item) => item.running);
  if (els.stopTestBtn) {
    els.stopTestBtn.style.display = isRunning ? "block" : "none";
  }
}

async function refreshTestingView() {
  const openMap = new Map();
  [...els.testingList.querySelectorAll(".test-card")].forEach((card, index) => openMap.set(state.testingItems[index]?.path, card.open));
  els.testingList.innerHTML = "";
  
  const itemsByFolder = {};
  for (const item of state.testingItems) {
    const folder = item.folderName || "未分组";
    if (!itemsByFolder[folder]) itemsByFolder[folder] = [];
    itemsByFolder[folder].push(item);
  }
  
  const folderOrder = Object.keys(itemsByFolder).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  
  for (const folderName of folderOrder) {
    const folderHeader = document.createElement("div");
    folderHeader.className = "testing-folder-header";
    folderHeader.dataset.folder = folderName;
    const folderStats = computeScoreStats(itemsByFolder[folderName]);
    const excluded = state.excludedTestingFolders.has(folderName);
    folderHeader.classList.toggle("excluded", excluded);
    folderHeader.innerHTML = `<div class="testing-folder-main"><span class="testing-folder-toggle">▾</span><strong class="folder-display-name">${escapeHtml(getFolderDisplayName(folderName))}</strong><span class="testing-folder-count">(${itemsByFolder[folderName].length}题)</span></div><div class="testing-folder-score">${excluded ? "已排除" : `得分:${formatScore(folderStats.earned)} / ${formatScore(folderStats.total)} / ${formatScore(folderStats.measuredTotal)}`}</div><div class="testing-folder-actions"><button type="button" class="exclude-folder-btn">${excluded ? "取消排除" : "排除本组"}</button><button type="button" class="run-folder-btn">测试本组</button></div>`;
    folderHeader.addEventListener("click", () => {
      folderHeader.classList.toggle("collapsed");
      const toggle = folderHeader.querySelector(".testing-folder-toggle");
      toggle.textContent = folderHeader.classList.contains("collapsed") ? "▸" : "▾";
      const folderBody = document.querySelector(`.testing-folder-body[data-folder="${cssEscape(folderName)}"]`);
      if (folderBody) folderBody.classList.toggle("hidden", folderHeader.classList.contains("collapsed"));
    });
    folderHeader.querySelector(".run-folder-btn").addEventListener("click", async (event) => {
      event.stopPropagation();
      await runFolderTests(folderName);
    });
    folderHeader.querySelector(".exclude-folder-btn").addEventListener("click", async (event) => {
      event.stopPropagation();
      if (state.excludedTestingFolders.has(folderName)) state.excludedTestingFolders.delete(folderName);
      else state.excludedTestingFolders.add(folderName);
      await refreshTestingView();
    });
    els.testingList.appendChild(folderHeader);
    
    const folderBody = document.createElement("div");
    folderBody.className = "testing-folder-body";
    folderBody.dataset.folder = folderName;
    
    for (const item of itemsByFolder[folderName]) {
      if (openMap.has(item.path)) item.open = openMap.get(item.path);
      const card = await createTestingCard(item);
      folderBody.appendChild(card);
    }
    
    els.testingList.appendChild(folderBody);
  }
  
  updateScoreSummary();
  highlightSelectedTestingTree();
  highlightSelectedCard(state.testingSelectedPath);
  if (state.pendingTestingFocusPath && getActivePage() === "testing") {
    const targetPath = state.pendingTestingFocusPath;
    const card = await ensureTestingCardReady(targetPath);
    if (card) {
      scrollToTestingCard(targetPath, { behavior: "auto" });
      state.pendingTestingFocusPath = "";
    }
  }
}

function updateScoreSummary() {
  const summary = computeScoreStats(getIncludedTestingItems());
  els.scoreSummary.textContent = `总分: ${formatScore(summary.earned)}/${formatScore(summary.total)}/${formatScore(summary.measuredTotal)}`;
  if (els.scoreStatsPercent) {
    const percent = summary.measuredTotal > 0 ? ((summary.measuredEarned / summary.measuredTotal) * 100).toFixed(1) : "0.0";
    els.scoreStatsPercent.textContent = `${percent}`;
  }
  renderScoreStatsPanel();
}

function toggleAllTests(expanded) {
  [...els.testingList.querySelectorAll(".testing-folder-header")].forEach((header) => {
    header.classList.toggle("collapsed", !expanded);
    const toggle = header.querySelector(".testing-folder-toggle");
    toggle.textContent = expanded ? "▾" : "▸";
    const folderName = header.dataset.folder || "";
    const folderBody = document.querySelector(`.testing-folder-body[data-folder="${cssEscape(folderName)}"]`);
    if (folderBody) folderBody.classList.toggle("hidden", !expanded);
  });
  [...els.testingList.querySelectorAll(".test-card")].forEach((el, index) => {
    el.open = expanded;
    if (state.testingItems[index]) state.testingItems[index].open = expanded;
  });
}

async function saveResult() {
  const preset = getTestingPreset();
  const dataset = state.testingSet;
  const name = els.resultName.value.trim() || `${dataset}-${preset?.model || "未命名模型"}-${formatNow()}`;
  
  const itemsToSave = state.testingItems.map((item) => {
    const result = item.result ? { ...item.result } : null;
    if (result && result.transcript) {
      const aggregatedUsage = aggregateAssistantUsage(result.transcript);
      const assistantEntries = result.transcript.filter(e => e.role === "assistant");
      const lastAssistantIndex = assistantEntries.length - 1;
      result.transcript = result.transcript.map((entry, idx) => {
        if (entry.role !== "assistant") return entry;
        const currentIdx = assistantEntries.indexOf(entry);
        const isLast = currentIdx === lastAssistantIndex;
        if (!isLast) {
          return { ...entry, meta: undefined, request: undefined, response: undefined };
        }
        const mergedResponse = entry.response ? mergeUsageIntoUsageCarrier(entry.response, aggregatedUsage) : entry.response;
        const mergedMeta = entry.meta ? mergeUsageIntoUsageCarrier(entry.meta, aggregatedUsage) : entry.meta;
        return {
          ...entry,
          response: mergedResponse,
          meta: mergedMeta,
          stats: {
            completionTokens: aggregatedUsage.completion_tokens,
            promptTokens: aggregatedUsage.prompt_tokens,
            totalTokens: aggregatedUsage.total_tokens,
          },
        };
      });
      result.stats = {
        completionTokens: aggregatedUsage.completion_tokens,
        promptTokens: aggregatedUsage.prompt_tokens,
        totalTokens: aggregatedUsage.total_tokens,
      };
    }
    return { path: item.path, title: item.title, fileName: item.fileName, score: item.score, manualScore: item.manualScore, followUpText: item.followUpText, result };
  });
  
  const payload = {
    name,
    dataset,
    model: { presetId: preset?.id || "", presetName: preset?.name || "", model: preset?.model || "", baseUrl: preset?.baseUrl || "" },
    items: itemsToSave,
  };
  await api("/api/save-result", { method: "POST", body: JSON.stringify(payload) });
  await loadResults();
}

async function loadResults() {
  const results = await api("/api/results");
  state.availableResults = results;
  els.savedResultSelect.innerHTML = `<option value="">选择一个结果</option>`;
  results.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name || item.id;
    els.savedResultSelect.appendChild(option);
  });
}

async function loadResultsIfNeeded() {
  if (state.availableResults.length === 0) {
    await loadResults();
    renderCompareResultOptions();
  }
}

async function loadSavedResultsIfNeeded() {
  if (!els.savedResultSelect.dataset.loaded) {
    await loadResults();
    els.savedResultSelect.dataset.loaded = "1";
  }
}

function renderCompareResultOptions() {
  if (!els.comparePageResultList) return;
  const selectedIds = new Set(state.compareResultIds);
  els.comparePageResultList.innerHTML = "";
  getAvailableCompareResults().forEach((item) => {
    const label = document.createElement("label");
    label.className = "compare-result-option";
    const checked = selectedIds.has(item.id) ? "checked" : "";
    const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN") : "";
    label.innerHTML = `<div class="checkbox-wrapper"><input type="checkbox" value="${escapeHtml(item.id)}" ${checked} /></div><span class="compare-result-option-text"><span class="compare-result-option-name">${escapeHtml(item.name || item.id)}</span><span class="compare-result-option-meta">${escapeHtml(createdAt)}</span></span>`;
    els.comparePageResultList.appendChild(label);
  });
}

function handleCompareResultChecklistChange(event) {
  const target = event.target;
  if (!target || target.type !== "checkbox") return;
  const id = target.value;
  if (target.checked) {
    state.compareResultIds = [...state.compareResultIds.filter((item) => item !== id), id];
  } else {
    state.compareResultIds = state.compareResultIds.filter((item) => item !== id);
  }
  loadCompareResults();
}

async function loadCompareResults() {
  if (!els.comparePageResultList) return;
  const ids = state.compareResultIds.filter(Boolean);
  if (!ids.length) {
    state.compareResults = [];
    renderCompareResults();
    return;
  }
  const results = await Promise.all(ids.map((id) => api(`/api/result?id=${encodeURIComponent(id)}`)));
  state.compareResults = results;
  renderCompareResults();
}

function clearCompareResults() {
  state.compareResultIds = [];
  state.compareResults = [];
  if (els.comparePageResultList) {
    [...els.comparePageResultList.querySelectorAll('input[type="checkbox"]')].forEach((input) => {
      input.checked = false;
    });
  }
  renderCompareResults();
}

function getAvailableCompareResults() {
  return state.availableResults.filter((item) => !state.compareSet || item.dataset === state.compareSet);
}

function renderComparePage() {
  state.compareSet = state.testingSet || state.compareSet || state.tree.sets[0]?.name || "";
  updateCompareFilterButtons();
  loadResultsIfNeeded();
  renderCompareResultOptions();
  renderCompareTree();
  renderCompareResults();
}

function updateCompareFilterButtons() {
  els.compareDiffAnswerBtn?.classList.toggle("active", state.compareFilters.differentAnswerOnly);
  els.compareDiffScoreBtn?.classList.toggle("active", state.compareFilters.differentScoreOnly);
  els.compareHideSystemBtn?.classList.toggle("active", state.compareFilters.hideSystemPrompt);
}

function getCompareSet() {
  return state.tree.sets.find((item) => item.name === state.compareSet);
}

function getFolderNameFromPath(itemPath) {
  return String(itemPath || "").split("/")[1] || "未分组";
}

function renderCompareScoreStats(result) {
  const groups = {};
  (result.items || []).forEach((item) => {
    const folder = getFolderNameFromPath(item.path);
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(item);
  });
  const overall = computeScoreStats((result.items || []).filter((item) => !state.compareExcludedFolders.has(getFolderNameFromPath(item.path))));
  const rows = [`<div class="score-stats-item score-stats-overall"><strong>总计</strong><span>已测:${formatScore(overall.measuredEarned)}/${formatScore(overall.measuredTotal)}</span><span>未测:${formatScore(overall.unmeasuredTotal)}</span></div>`];
  Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).forEach((folder) => {
    const excluded = state.compareExcludedFolders.has(folder);
    const stat = computeScoreStats(excluded ? [] : groups[folder]);
    rows.push(`<div class="score-stats-item${excluded ? " score-stats-excluded" : ""}"><strong>${escapeHtml(folder)}</strong><span>${excluded ? "已排除" : `已测:${formatScore(stat.measuredEarned)}/${formatScore(stat.measuredTotal)}`}</span><span>未测:${formatScore(stat.unmeasuredTotal)}</span></div>`);
  });
  return `<div class="score-stats-content">${rows.join("")}</div>`;
}

function renderCompareTree() {
  if (!els.compareTree) return;
  els.compareTree.innerHTML = "";
  const set = getCompareSet();
  if (!set) return;
  set.folders.forEach((folder) => {
    const folderEl = document.createElement("div");
    folderEl.className = `tree-folder${state.compareCollapsedFolders[folder.name] ? " collapsed" : ""}`;
    folderEl.innerHTML = `<div class="tree-folder-header"><span class="tree-folder-toggle">${state.compareCollapsedFolders[folder.name] ? "▸" : "▾"}</span><strong class="folder-display-name">${escapeHtml(getFolderDisplayName(folder.name))}</strong></div>`;
    const header = folderEl.querySelector(".tree-folder-header");
    const toggle = folderEl.querySelector(".tree-folder-toggle");
    header.addEventListener("click", () => {
      const collapsed = !state.compareCollapsedFolders[folder.name];
      state.compareCollapsedFolders[folder.name] = collapsed;
      folderEl.classList.toggle("collapsed", collapsed);
      toggle.textContent = collapsed ? "▸" : "▾";
      renderCompareResults();
    });
    folder.questions.forEach((question) => {
      const qEl = document.createElement("div");
      qEl.className = `tree-question${state.compareSelectedPath === question.path ? " active" : ""}`;
      qEl.dataset.path = question.path;
      qEl.innerHTML = `<div>${escapeHtml(question.title || question.name)}</div>`;
      qEl.addEventListener("click", () => {
        state.compareSelectedPath = question.path;
        highlightCompareTree();
        ensureCompareFolderExpanded(folder.name);
        state.compareCollapsedQuestions[question.path] = false;
        renderCompareResults();
        requestAnimationFrame(() => scrollToCompareQuestion(question.path));
      });
      folderEl.appendChild(qEl);
    });
    els.compareTree.appendChild(folderEl);
  });
  highlightCompareTree();
}

function highlightCompareTree() {
  if (!els.compareTree) return;
  [...els.compareTree.querySelectorAll(".tree-question")].forEach((node) => {
    node.classList.toggle("active", node.dataset.path === state.compareSelectedPath);
  });
}

function ensureCompareFolderExpanded(folderName) {
  state.compareCollapsedFolders[folderName] = false;
}

function scrollToCompareQuestion(path) {
  const row = els.comparePageBoard?.querySelector(`.compare-question-wrap[data-path="${cssEscape(path)}"]`);
  if (!row) return;
  const topbarHeight = document.querySelector(".topbar")?.offsetHeight || 60;
  const y = row.getBoundingClientRect().top + window.scrollY - topbarHeight - 50;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
}

function getResultItemMap(result) {
  return new Map((result.items || []).map((item) => [item.path, item]));
}

function getCompareLastAnswer(item) {
  const transcript = item?.result?.transcript || [];
  const lastAssistant = [...transcript].reverse().find((entry) => entry.role === "assistant");
  return String(lastAssistant?.content || item?.result?.answer || "").trim();
}

function normalizeCompareAnswer(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function getCompareScoreValue(item, questionInfo) {
  return Number(item?.manualScore ?? item?.result?.score?.earned ?? 0).toFixed(3);
}

function shouldShowCompareQuestion(questionInfo, resultMaps) {
  const items = resultMaps.map((map) => map.get(questionInfo.path) || null);
  if (state.compareFilters.differentAnswerOnly) {
    const values = new Set(items.map((item) => normalizeCompareAnswer(getCompareLastAnswer(item) || "__EMPTY__")));
    if (values.size <= 1) return false;
  }
  if (state.compareFilters.differentScoreOnly) {
    const values = new Set(items.map((item) => getCompareScoreValue(item, questionInfo)));
    if (values.size <= 1) return false;
  }
  return true;
}

async function renderCompareResults() {
  const board = els.comparePageBoard;
  const empty = els.comparePageEmpty;
  if (!board || !empty) return;
  if (!state.compareResults.length || !state.compareSet) {
    board.classList.add("hidden");
    board.innerHTML = "";
    empty.textContent = state.compareSet ? "选择同一测试集下的多个历史结果后，将按题目完整并排对比。" : "当前没有可用于对比的测试集。";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  board.classList.remove("hidden");
  board.style.setProperty("--compare-result-count", String(Math.max(1, state.compareResults.length)));

  const set = getCompareSet();
  const resultMaps = state.compareResults.map((result) => getResultItemMap(result));
  const grid = document.createElement("div");
  grid.className = "compare-board-grid";
  const header = document.createElement("div");
  header.className = "compare-board-header";
  state.compareResults.forEach((result) => {
    const cell = document.createElement("div");
    cell.className = "compare-result-header";
    const createdAt = result.createdAt ? new Date(result.createdAt).toLocaleString("zh-CN") : "";
    const modelName = result.model?.model || result.model?.presetName || "";
    const stats = computeScoreStats((result.items || []).filter((item) => !state.compareExcludedFolders.has(getFolderNameFromPath(item.path))).map((item) => ({
      score: item.score ?? item.result?.score?.total ?? 0,
      manualScore: item.manualScore ?? null,
      result: item.result || null,
    })));
    let totalTokens = 0;
    let totalDuration = 0;
    (result.items || []).forEach((item) => {
      if (item.result?.transcript) {
        item.result.transcript.forEach((round) => {
          if (round.response?.usage) {
            totalTokens += (round.response.usage.total_tokens || round.response.usage.completion_tokens || 0);
          }
          if (round._duration) {
            totalDuration += round._duration;
          }
        });
      }
    });
    const metaInfo = [];
    metaInfo.push(`总分${formatScore(stats.earned)}/${formatScore(stats.total)}/${formatScore(stats.measuredTotal)}`);
    if (totalTokens > 0) {
      metaInfo.push(`tokens${totalTokens.toLocaleString()}`);
      if (totalDuration > 0) {
        metaInfo.push(`耗时${(totalDuration / 1000).toFixed(1)}s`);
        metaInfo.push(`速度${(totalTokens / (totalDuration / 1000)).toFixed(1)}t/s`);
      }
    }
    cell.innerHTML = `<div class="compare-result-name">${escapeHtml(result.name || result.id || "未命名结果")}</div><div class="compare-result-meta">${escapeHtml(modelName)} ${metaInfo.join(" ")}</div><button type="button" class="compare-score-detail-btn">详细分数</button><div class="compare-score-popover hidden">${renderCompareScoreStats(result)}</div>`;
    cell.querySelector(".compare-score-detail-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      cell.querySelector(".compare-score-popover")?.classList.toggle("hidden");
    });
    header.appendChild(cell);
  });
  const refCell = document.createElement("div");
  refCell.className = "compare-result-header compare-reference-header";
  refCell.innerHTML = `<div class="compare-result-name">预设与备注</div><div class="compare-result-meta">固定窄列</div>`;
  header.appendChild(refCell);
  grid.appendChild(header);

  for (const folder of set?.folders || []) {
    const visibleQuestions = folder.questions
      .map((question) => ({
        path: question.path,
        title: question.title || question.name,
        fileName: question.name,
        folderName: folder.name,
        score: Number(question.score || 0),
      }))
      .filter((questionInfo) => shouldShowCompareQuestion(questionInfo, resultMaps));
    if (!visibleQuestions.length) continue;

    const folderHeader = document.createElement("div");
    const excluded = state.compareExcludedFolders.has(folder.name);
    folderHeader.className = `testing-folder-header compare-folder-header${state.compareCollapsedFolders[folder.name] ? " collapsed" : ""}${excluded ? " excluded" : ""}`;
    folderHeader.dataset.folder = folder.name;
    const folderStatsText = state.compareResults.map((result, index) => {
      const stat = computeScoreStats(visibleQuestions.map((questionInfo) => {
        const item = resultMaps[index].get(questionInfo.path);
        return {
          score: questionInfo.score,
          manualScore: item?.manualScore ?? null,
          result: item?.result || null,
        };
      }));
      return `${escapeHtml(result.name || result.id || "未命名")} ${excluded ? "已排除" : `${formatScore(stat.earned)}/${formatScore(stat.total)}/${formatScore(stat.measuredTotal)}`}`;
    }).join(" | ");
    folderHeader.innerHTML = `<div class="testing-folder-main"><span class="testing-folder-toggle">${state.compareCollapsedFolders[folder.name] ? "▸" : "▾"}</span><strong class="folder-display-name">${escapeHtml(getFolderDisplayName(folder.name))}</strong><span class="testing-folder-count">(${visibleQuestions.length}题)</span></div><div class="testing-folder-score">${folderStatsText}</div><div class="testing-folder-actions"><button type="button" class="compare-exclude-folder-btn">${excluded ? "取消排除" : "排除本组"}</button></div>`;
    folderHeader.addEventListener("click", () => {
      state.compareCollapsedFolders[folder.name] = !state.compareCollapsedFolders[folder.name];
      renderComparePage();
    });
    folderHeader.querySelector(".compare-exclude-folder-btn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.compareExcludedFolders.has(folder.name)) state.compareExcludedFolders.delete(folder.name);
      else state.compareExcludedFolders.add(folder.name);
      renderComparePage();
    });
    grid.appendChild(folderHeader);

    if (excluded || state.compareCollapsedFolders[folder.name]) {
      continue;
    }

    for (const questionInfo of visibleQuestions) {
      const questionWrap = document.createElement("div");
      questionWrap.className = "compare-question-wrap";
      questionWrap.dataset.path = questionInfo.path;
      const questionHeader = document.createElement("div");
      questionHeader.className = `compare-question-toggle${state.compareSelectedPath === questionInfo.path ? " selected" : ""}`;
      questionHeader.innerHTML = `<div class="test-header"><div class="test-title">${escapeHtml(questionInfo.title)}</div><div class="score-badge">${formatScore(questionInfo.score)}分</div></div>`;
      questionHeader.addEventListener("click", () => {
        state.compareSelectedPath = questionInfo.path;
        state.compareCollapsedQuestions[questionInfo.path] = !state.compareCollapsedQuestions[questionInfo.path];
        highlightCompareTree();
        renderCompareResults();
      });
      questionWrap.appendChild(questionHeader);

      if (!state.compareCollapsedQuestions[questionInfo.path]) {
        const questionBody = document.createElement("div");
        questionBody.className = "compare-board-row compare-question-body-row";
        for (const [index, result] of state.compareResults.entries()) {
          const item = resultMaps[index].get(questionInfo.path);
          questionBody.appendChild(renderCompareResultColumn(result, item, questionInfo));
        }
        const refBody = document.createElement("div");
        refBody.className = "compare-reference-cell";
        const question = await ensureCompareQuestion(questionInfo.path);
        refBody.innerHTML = `<div><strong>预设：</strong></div><div class="status-extra">${escapeHtml(question.expectedAnswer?.trim() || "未设置")}</div><div><strong>备注：</strong></div><div class="status-extra">${escapeHtml(question.note?.trim() || "无")}</div>`;
        questionBody.appendChild(refBody);
        questionWrap.appendChild(questionBody);
      }
      grid.appendChild(questionWrap);
    }
  }
  board.innerHTML = "";
  board.appendChild(grid);
}

function renderCompareResultColumn(result, item, questionInfo) {
  const cell = document.createElement("div");
  cell.className = "compare-result-cell";
  if (!item) {
    cell.innerHTML = `<div class="compare-no-result">未测试</div>`;
    return cell;
  }
  const statusClass = getTestStatusClass({
    score: questionInfo.score,
    manualScore: item.manualScore ?? null,
    result: item.result || null,
  });
  const card = document.createElement("div");
  card.className = `test-card compare-test-card ${statusClass}`;
  const score = Number(item.manualScore ?? item.result?.score?.earned ?? 0);
  const total = Number(item.score ?? item.result?.score?.total ?? questionInfo.score ?? 0);
  const header = document.createElement("div");
  header.className = `compare-test-card-header ${statusClass}`;
  header.innerHTML = `<div><div class="run-stats">${getRunStat(item.result).replace(/<br\s*\/?>/gi, ' ') || "无统计"}</div></div><div class="compare-score-edit"><span class="score-badge">${formatScore(score)} / ${formatScore(total)}</span><input class="compareManualScoreInput" type="number" min="0" step="0.5" value="${score}" title="修改本次对比分数" /></div>`;
  header.querySelector(".compareManualScoreInput")?.addEventListener("change", (event) => {
    item.manualScore = event.target.value === "" ? null : Number(event.target.value);
    renderComparePage();
  });
  const body = document.createElement("div");
  body.className = "compare-test-card-body";
  card.appendChild(header);
  card.appendChild(body);
  cell.appendChild(card);
  const injectedHtml = item.result?.score?.statusHtml || "";
  if (injectedHtml) {
    const extra = document.createElement("div");
    extra.className = "status-extra compare-status-extra";
    extra.innerHTML = injectedHtml;
    body.appendChild(extra);
  }
  renderCompareConversation(item, questionInfo, body, { hideSystemPrompt: state.compareFilters.hideSystemPrompt });
  return cell;
}

async function loadSelectedResult() {
  const id = els.savedResultSelect.value;
  if (!id) return;
  state.isLoadingResult = true;
  try {
    const result = await api(`/api/result?id=${encodeURIComponent(id)}`);
    if (result.dataset) {
      state.testingSet = result.dataset;
      localStorage.setItem(LAST_TESTING_SET_KEY, state.testingSet);
      if (els.testingSetSelect) {
        els.testingSetSelect.value = state.testingSet;
      }
      await renderTestingList();
      renderEditorTree();
      renderTestingTree();
    }
    const map = new Map((result.items || []).map((item) => [item.path, item]));
    state.testingItems.forEach((item) => {
      const saved = map.get(item.path);
      item.result = saved?.result || null;
      item.manualScore = saved?.manualScore ?? null;
      item.followUpText = saved?.followUpText || "";
    });
    await refreshTestingView();
  } finally {
    state.isLoadingResult = false;
  }
}

async function clearTestingContent() {
  stopAllTests();
  state.isLoadingResult = false;
  state.pendingTestingFocusPath = "";
  state.testingSelectedPath = "";
  if (els.savedResultSelect) {
    els.savedResultSelect.value = "";
  }
  state.testingItems.forEach((item) => {
    item.result = null;
    item.manualScore = null;
    item.followUpText = "";
    item.running = false;
    item.stopRequested = false;
    item.abortController = null;
  });
  await refreshTestingView();
}

function renderTestingTree() {
  els.testingTree.innerHTML = "";
  const set = state.tree.sets.find((item) => item.name === state.testingSet);
  if (!set) return;
  set.folders.forEach((folder) => {
    const folderEl = document.createElement("div");
    folderEl.className = "tree-folder";
    folderEl.innerHTML = `<div class="tree-folder-header"><span class="tree-folder-toggle">▾</span><strong class="folder-display-name">${escapeHtml(getFolderDisplayName(folder.name))}</strong></div>`;
    const header = folderEl.querySelector(".tree-folder-header");
    const toggle = folderEl.querySelector(".tree-folder-toggle");
    header.addEventListener("click", () => {
      folderEl.classList.toggle("collapsed");
      toggle.textContent = folderEl.classList.contains("collapsed") ? "▸" : "▾";
    });
    folder.questions.forEach((question) => {
      const qEl = document.createElement("div");
      qEl.className = "tree-question";
      qEl.dataset.path = question.path;
      qEl.innerHTML = `<div>${escapeHtml(question.title || question.name)}</div>`;
      qEl.addEventListener("click", () => {
        setTestingSelected(question.path);
        scrollToTestingCard(question.path);
      });
      folderEl.appendChild(qEl);
    });
    els.testingTree.appendChild(folderEl);
  });
  highlightSelectedTestingTree();
}

function setTestingSelected(path) {
  state.testingSelectedPath = path;
  highlightSelectedTestingTree();
  highlightSelectedCard(path);
}

function highlightSelectedTestingTree() {
  if (!els.testingTree) return;
  [...els.testingTree.querySelectorAll(".tree-question")].forEach((node) => {
    node.classList.toggle("active", node.dataset.path === state.testingSelectedPath);
  });
}

function highlightSelectedCard(path) {
  if (!els.testingList) return;
  [...els.testingList.querySelectorAll(".test-card")].forEach((card) => {
    card.classList.toggle("selected", card.dataset.path === path);
  });
}

//目录中点击题目时测试列表跳转至对应问题
function scrollToTestingCard(path, options = {}) {
  const selector = `[data-path="${cssEscape(path)}"]`;
  const card = els.testingList.querySelector(selector);
  if (!card) return;
  ensureTestingCardExpanded(path, card);
  card.open = true;
  const item = state.testingItems.find((entry) => entry.path === path);
  if (item) item.open = true;
  const topbarHeight = document.querySelector(".topbar")?.offsetHeight || 60;
  const folderHeaderHeight = card.closest(".testing-folder-body")?.previousElementSibling?.offsetHeight || 0;
  const y = card.getBoundingClientRect().top + window.scrollY - topbarHeight - folderHeaderHeight;
  window.scrollTo({ top: Math.max(0, y), behavior: options.behavior || "smooth" });
}

function scrollCardBelowFolderHeader(card) {
  if (!card) return;
  const topbarHeight = document.querySelector(".topbar")?.offsetHeight || 60;
  const folderHeader = card.closest(".testing-folder-body")?.previousElementSibling;
  const folderMain = folderHeader?.querySelector(".testing-folder-main");
  const cardTop = card.getBoundingClientRect().top + window.scrollY;
  const folderAnchorHeight = folderMain?.offsetHeight || folderHeader?.offsetHeight || 0;
  const targetTop = Math.max(0, cardTop - topbarHeight - folderAnchorHeight);
  window.scrollTo({ top: targetTop, behavior: "smooth" });
}

function getTestStatusClass(item) {
  const score = item.manualScore ?? item.result?.score;
  if (score === undefined || score === null) return "status-unanswered";
  if (item.manualScore !== undefined && item.manualScore !== null) {
    const earned = Number(item.manualScore);
    const total = Number(item.score);
    if (earned >= total) return "status-correct";
    if (earned <= 0) return "status-wrong";
    return "status-partial";
  }
  const earned = score?.earned ?? 0;
  if (!score?.hasExpectedAnswer) return "status-unscored";
  const total = Number(score?.total ?? item.score ?? 0);
  if (earned >= total) return "status-correct";
  if (earned <= 0) return "status-wrong";
  return "status-partial";
}

function getRunStat(result) {
  if (!result?.transcript?.length) return "";
  let totalCompletionTokens = 0;
  let totalPromptTokens = 0;
  let totalDuration = 0;
  const totals = result.stats || result.metaTotals || null;
  if (totals) {
    totalCompletionTokens = Number(totals.completionTokens || 0);
    totalPromptTokens = Number(totals.promptTokens || 0);
  }
  result.transcript.forEach((round) => {
    if (round.role === "assistant") {
      const usage = round.response?.usage || round.meta?.usage;
      if (usage) {
        if (!totals) {
          totalCompletionTokens += usage.completion_tokens || 0;
          totalPromptTokens += usage.prompt_tokens || 0;
        }
      }
    }
    if (round._duration) {
      totalDuration += round._duration;
    }
  });
  if (!totalCompletionTokens) return "";
  const stats = [];
  stats.push(`tokens: ${totalCompletionTokens}`);
  if (totalDuration > 0) {
    const secs = (totalDuration / 1000).toFixed(1);
    stats.push(`耗时:${secs} s`);
    const ts = (totalCompletionTokens / (totalDuration / 1000)).toFixed(1);
    stats.push(`速度:${ts} t/s`);
  }
  return stats.join("<br>");
}

function aggregateAssistantUsage(transcript = []) {
  return transcript.reduce((acc, entry) => {
    if (entry.role !== "assistant") return acc;
    const usage = entry.response?.usage || entry.meta?.usage;
    if (!usage) return acc;
    acc.prompt_tokens += Number(usage.prompt_tokens || 0);
    acc.completion_tokens += Number(usage.completion_tokens || 0);
    acc.total_tokens += Number(usage.total_tokens || 0);
    return acc;
  }, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
}

function mergeUsageIntoUsageCarrier(target, usage) {
  if (!target || !usage) return target;
  return {
    ...target,
    usage: {
      ...(target.usage || {}),
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
    },
  };
}

function renderStatusExtra(item, expectedText, noteText) {
  const injectedHtml = item.result?.score?.statusHtml || "";
  return `${injectedHtml}<div>预设：${expectedText}</div><div>备注：\n${noteText}</div>`;
}

async function runFolderTests(folderName) {
  state.excludedTestingFolders.delete(folderName);
  const items = state.testingItems.filter((item) => item.folderName === folderName);
  if (!items.length) return;
  state.isBatchRunning = true;
  state.stopAllRequested = false;
  state.testingItems.forEach((item) => {
    item.stopRequested = false;
  });
  updateStopButton();
  try {
    for (const item of items) {
      if (state.stopAllRequested) break;
      await runSingleTest(item.path, null);
    }
  } finally {
    state.isBatchRunning = false;
    state.stopAllRequested = false;
    updateStopButton();
  }
}

function normalizePage(page) {
  return ["editor", "testing", "compare", "chat", "notes", "settings"].includes(page) ? page : "editor";
}

function getActivePage() {
  return els.tabs.find((tab) => tab.classList.contains("active"))?.dataset.page || normalizePage(localStorage.getItem(LAST_PAGE_KEY));
}

function getPageScrollKey(page) {
  return `${PAGE_SCROLL_KEY_PREFIX}${page}`;
}

function savePageScroll(page) {
  localStorage.setItem(getPageScrollKey(page), String(Math.max(0, Math.round(window.scrollY))));
}

function restorePageScroll(page, immediate = false) {
  const raw = localStorage.getItem(getPageScrollKey(page));
  const top = Number(raw || 0);
  const apply = () => window.scrollTo({ top: Number.isFinite(top) ? top : 0, behavior: "auto" });
  if (immediate) {
    apply();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(apply));
}

async function ensureTestingCardReady(path) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const card = els.testingList.querySelector(`[data-path="${cssEscape(path)}"]`);
    if (card) {
      ensureTestingCardExpanded(path, card);
      return card;
    }
  }
  return null;
}

async function focusTestingCard(path) {
  const card = await ensureTestingCardReady(path);
  if (!card) return null;
  scrollToTestingCard(path, { behavior: "auto" });
  return card;
}

function ensureTestingCardExpanded(path, card = null) {
  const targetCard = card || els.testingList.querySelector(`[data-path="${cssEscape(path)}"]`);
  if (!targetCard) return null;
  const folderBody = targetCard.closest(".testing-folder-body");
  if (folderBody?.classList.contains("hidden")) {
    folderBody.classList.remove("hidden");
    const folderHeader = folderBody.previousElementSibling;
    if (folderHeader?.classList.contains("testing-folder-header")) {
      folderHeader.classList.remove("collapsed");
      const toggle = folderHeader.querySelector(".testing-folder-toggle");
      if (toggle) toggle.textContent = "▾";
    }
  }
  targetCard.open = true;
  const item = state.testingItems.find((entry) => entry.path === path);
  if (item) item.open = true;
  return targetCard;
}

async function handleCheckerActionClick(event) {
  const btn = event.target.closest("[data-checker-action]");
  if (!btn) return;
  event.preventDefault();
  const action = btn.dataset.checkerAction || "";
  let payload = btn.dataset.checkerPayload || "";
  try {
    payload = payload ? JSON.parse(payload) : payload;
  } catch {
    payload = btn.dataset.checkerPayload || "";
  }
  if (action === "alert") {
    alert(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
    return;
  }
  if (action === "copy-text") {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    await navigator.clipboard.writeText(text);
    return;
  }
  if (action === "open-html") {
    const html = typeof payload === "string" ? payload : String(payload?.html || "");
    if (typeof openHtmlModal === "function") openHtmlModal(html);
    return;
  }
  if (action === "open-html-base64") {
    const encoded = typeof payload === "string" ? payload : String(payload?.html || "");
    const html = decodeURIComponent(atob(encoded));
    if (typeof openHtmlModal === "function") openHtmlModal(html);
    return;
  }
  if (action === "set-follow-up") {
    const card = btn.closest(".test-card");
    const path = card?.dataset.path;
    const item = state.testingItems.find((entry) => entry.path === path);
    if (!item) return;
    item.followUpText = typeof payload === "string" ? payload : String(payload?.text || "");
    await refreshTestingView();
    const refreshedCard = await ensureTestingCardReady(path);
    const input = refreshedCard?.querySelector(".followUpInput");
    if (input) {
      input.value = item.followUpText;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
  }
}

function getActivePreset() {
  return state.settings.presets.find((item) => item.id === state.settings.activePresetId);
}

function getTestingPreset() {
  const preset = state.settings.presets.find((item) => item.id === (state.testingPresetId || els.testingPresetSelect.value));
  if (!preset) return null;
  let extra = {};
  try {
    extra = preset.extraConfig ? JSON.parse(preset.extraConfig) : {};
  } catch {
    extra = {};
  }
  return { ...preset, extraConfigParsed: extra };
}

function getCurrentSetName() {
  return (state.selectedQuestionPath || "").split("/")[0] || "";
}







function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatNow() {
  return new Date().toISOString().replaceAll(":", "-");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function cloneSimpleJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function formatScore(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(1) : "0.0";
}

function getFolderDisplayName(name) {
  return String(name || "").replace(/^\d+_+/, "") || String(name || "");
}

function isMeasuredItem(item) {
  if (item.manualScore !== undefined && item.manualScore !== null) return true;
  if (!item.result || !item.result.score) return false;
  return Number.isFinite(Number(item.result.score.earned));
}

function getItemEarnedScore(item) {
  if (item.manualScore !== undefined && item.manualScore !== null) return Number(item.manualScore || 0);
  return Number(item.result?.score?.earned || 0);
}

function computeScoreStats(items) {
  let total = 0;
  let earned = 0;
  let measuredTotal = 0;
  let measuredEarned = 0;
  let unmeasuredTotal = 0;
  for (const item of items || []) {
    const itemTotal = Number(item.score || 0);
    const itemEarned = getItemEarnedScore(item);
    const measured = isMeasuredItem(item);
    total += itemTotal;
    earned += itemEarned;
    if (measured) {
      measuredTotal += itemTotal;
      measuredEarned += itemEarned;
    } else {
      unmeasuredTotal += itemTotal;
    }
  }
  return { total, earned, measuredTotal, measuredEarned, unmeasuredTotal };
}

function renderScoreStatsPanel() {
  if (!els.scoreStatsContent) return;
  const overall = computeScoreStats(getIncludedTestingItems());
  const groups = {};
  state.testingItems.forEach((item) => {
    const folder = item.folderName || "未分组";
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(item);
  });
  const rows = [];
  rows.push(`<div class="score-stats-item score-stats-overall"><strong>总计</strong><span>已测:${formatScore(overall.measuredEarned)}/${formatScore(overall.measuredTotal)}</span><span>未测:${formatScore(overall.unmeasuredTotal)}</span></div>`);
  Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).forEach((folderName) => {
    const excluded = state.excludedTestingFolders.has(folderName);
    const stat = computeScoreStats(excluded ? [] : groups[folderName]);
    rows.push(`<div class="score-stats-item${excluded ? " score-stats-excluded" : ""}"><strong>${escapeHtml(folderName)}</strong><span>${excluded ? "已排除" : `已测:${formatScore(stat.measuredEarned)}/${formatScore(stat.measuredTotal)}`}</span><span>未测:${formatScore(stat.unmeasuredTotal)}</span></div>`);
  });
  els.scoreStatsContent.innerHTML = rows.join("");
}

function getIncludedTestingItems() {
  return state.testingItems.filter((item) => !state.excludedTestingFolders.has(item.folderName || "未分组"));
}

function showToast(message) {
  if (!els.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 180);
  }, 1800);
}

async function loadCheckerTemplates() {
  state.checkerTemplates = await api("/api/checker-templates");
  renderCheckerTemplateControls();
}

function renderCheckerTemplateControls() {
  if (els.checkerTemplateSelect) {
    els.checkerTemplateSelect.innerHTML = "";
    state.checkerTemplates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      els.checkerTemplateSelect.appendChild(option);
    });
  }
  if (!els.checkerTemplateList) return;
  els.checkerTemplateList.innerHTML = "";
  state.checkerTemplates.forEach((template) => addCheckerTemplateEditor(template));
}

function insertCheckerTemplate() {
  const template = state.checkerTemplates.find((item) => item.id === els.checkerTemplateSelect?.value);
  if (!template || !els.checker) return;
  els.checker.value = template.code || "";
  els.checker.dispatchEvent(new Event("input", { bubbles: true }));
}

function addCheckerTemplateEditor(template = null) {
  if (!els.checkerTemplateList) return;
  const data = template || { id: `template-${Date.now()}`, name: "新模板", code: "function checkAnswer(answer, correctAnswer) {\n  return false;\n}" };
  const card = document.createElement("div");
  card.className = "checker-template-card";
  card.innerHTML = `<input class="checker-template-name" value="${escapeHtml(data.name)}" placeholder="模板名称" /><textarea class="checker-template-code" rows="6"></textarea><div class="toolbar"><button type="button" class="remove-checker-template-btn">删除</button></div>`;
  card.dataset.id = data.id;
  card.querySelector(".checker-template-code").value = data.code || "";
  card.querySelector(".remove-checker-template-btn").addEventListener("click", () => card.remove());
  els.checkerTemplateList.appendChild(card);
}

async function saveCheckerTemplates() {
  const templates = [...els.checkerTemplateList.querySelectorAll(".checker-template-card")].map((card, index) => ({
    id: card.dataset.id || `template-${index + 1}`,
    name: card.querySelector(".checker-template-name").value || `模板 ${index + 1}`,
    code: card.querySelector(".checker-template-code").value || "",
  }));
  await api("/api/checker-templates", { method: "POST", body: JSON.stringify({ templates }) });
  state.checkerTemplates = templates;
  renderCheckerTemplateControls();
  showToast("检测模板已保存");
}

async function loadNotes() {
  state.notes = await api("/api/notes");
}

async function loadChats() {
  const data = await api("/api/chats");
  state.chatFolders = Array.isArray(data.folders) ? data.folders : [];
  state.chats = Array.isArray(data.chats) ? data.chats : (Array.isArray(data) ? data : []);
  renderChats();
}

function renderChats() {
  if (!els.chatList) return;
  els.chatList.innerHTML = "";
  const groups = Object.fromEntries((state.chatFolders.length ? state.chatFolders : ["默认分组"]).map((folder) => [folder, []]));
  state.chats.forEach((chat) => {
    const folder = chat.folder || "默认分组";
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(chat);
  });
  Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).forEach((folder) => {
    const title = document.createElement("div");
    title.className = "chat-folder-title";
    title.textContent = folder;
    title.dataset.folder = folder;
    title.addEventListener("dblclick", () => renameChatFolder(folder));
    title.addEventListener("dragover", (event) => {
      event.preventDefault();
      title.classList.add("drag-over");
    });
    title.addEventListener("dragleave", () => title.classList.remove("drag-over"));
    title.addEventListener("drop", async (event) => {
      event.preventDefault();
      title.classList.remove("drag-over");
      const id = event.dataTransfer.getData("text/chat-id");
      const fromFolder = event.dataTransfer.getData("text/chat-folder");
      if (id) await moveChatToFolder(id, fromFolder, folder);
    });
    els.chatList.appendChild(title);
    groups[folder].forEach((chat) => {
      const item = document.createElement("div");
      item.className = `chat-list-item${state.currentChatId === chat.id ? " active" : ""}`;
      item.draggable = true;
      item.dataset.id = chat.id;
      item.dataset.folder = folder;
      item.innerHTML = `<div class="chat-list-title">${escapeHtml(chat.title || "未命名对话")}</div><div class="chat-list-meta">${chat.messageCount || 0} 条</div><span class="chat-list-delete" title="删除对话（Shift+点击不提示）">&#x2716;</span>`;
      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("chat-list-delete")) return;
        openChat(chat.id, folder);
      });
      item.addEventListener("dblclick", (event) => {
        if (event.target.classList.contains("chat-list-delete")) return;
        event.stopPropagation();
        renameChat(chat.id);
      });
      item.querySelector(".chat-list-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        if (!e.shiftKey && !confirm(`确定要删除对话"${chat.title || "未命名对话"}"吗？`)) return;
        deleteChatById(chat.id, folder);
      });
      item.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/chat-id", chat.id);
        event.dataTransfer.setData("text/chat-folder", folder);
      });
      els.chatList.appendChild(item);
    });
  });
}

async function openChat(id, folder = "") {
  state.currentChat = await api(`/api/chat?id=${encodeURIComponent(id)}&folder=${encodeURIComponent(folder)}`);
  state.currentChatId = state.currentChat.id;
  renderChats();
  renderChatEditor();
}

async function createNewChat() {
  const folder = state.currentChat?.folder || state.chatFolders[0] || "默认分组";
  const chat = { title: "新对话", folder, messages: [] };
  const result = await api("/api/chat", { method: "POST", body: JSON.stringify(chat) });
  await loadChats();
  await openChat(result.id);
}

async function createChatFolder() {
  const name = prompt("新分组名称", "新分组");
  if (!name) return;
  await api("/api/chat-folder", { method: "POST", body: JSON.stringify({ folder: name }) });
  await loadChats();
}

async function renameChatFolder(folder) {
  const next = prompt("重命名分组", folder);
  if (!next || next === folder) return;
  await api("/api/chat-folder-rename", { method: "POST", body: JSON.stringify({ from: folder, to: next }) });
  if (state.currentChat?.folder === folder) state.currentChat.folder = next;
  await loadChats();
}

async function moveChatToFolder(id, fromFolder, toFolder) {
  if (fromFolder === toFolder) return;
  await api("/api/chat-move", { method: "POST", body: JSON.stringify({ id, fromFolder, toFolder }) });
  if (state.currentChatId === id && state.currentChat) state.currentChat.folder = toFolder;
  await loadChats();
}

async function renameChat(id) {
  const chat = state.chats.find((item) => item.id === id);
  const next = prompt("重命名对话", chat?.title || "未命名对话");
  if (!next) return;
  const full = state.currentChatId === id ? state.currentChat : await api(`/api/chat?id=${encodeURIComponent(id)}&folder=${encodeURIComponent(chat?.folder || "")}`);
  full.title = next;
  await api("/api/chat", { method: "POST", body: JSON.stringify(full) });
  if (state.currentChatId === id) state.currentChat = full;
  await loadChats();
  renderChatEditor();
}

async function deleteChatById(id, folder = "") {
  await api("/api/chat-delete", { method: "POST", body: JSON.stringify({ id, folder }) });
  if (state.currentChatId === id) {
    state.currentChat = null;
    state.currentChatId = "";
    els.chatEmpty?.classList.remove("hidden");
    els.chatEditor?.classList.add("hidden");
  }
  await loadChats();
}

function renderChatEditor() {
  if (!state.currentChat) {
    els.chatEmpty?.classList.remove("hidden");
    els.chatEditor?.classList.add("hidden");
    return;
  }
  els.chatEmpty?.classList.add("hidden");
  els.chatEditor?.classList.remove("hidden");
  els.chatTitle.value = state.currentChat.title || "";
  if (els.chatPresetSelect && state.chatPresetId) els.chatPresetSelect.value = state.chatPresetId;
  renderChatMessages();
}

function renderChatMessages() {
  if (!els.chatMessages || !state.currentChat) return;
  els.chatMessages.innerHTML = "";
  const systemWrap = document.createElement("div");
  systemWrap.className = "chat-system-container";
  const presets = state.settings.systemPromptPresets || [];
  const currentPresetId = state.currentChat.systemPromptPresetId || state.settings.defaultSystemPrompt || presets[0]?.id;
  const currentPreset = presets.find(p => p.id === currentPresetId);
  const systemContent = state.currentChat.systemPrompt || currentPreset?.content || "";
  
  if (presets.length > 0) {
    const selectWrap = document.createElement("div");
    selectWrap.className = "chat-system-selector";
    const select = document.createElement("select");
    select.innerHTML = presets.map(p => `<option value="${p.id}" ${p.id === currentPresetId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
    const label = document.createElement("span");
    label.textContent = "系统提示：";
    selectWrap.appendChild(label);
    selectWrap.appendChild(select);
    select.addEventListener("change", () => {
      const selectedPreset = presets.find(p => p.id === select.value);
      if (selectedPreset) {
        state.currentChat.systemPromptPresetId = selectedPreset.id;
        state.currentChat.systemPrompt = selectedPreset.content;
        saveCurrentChat();
        renderChatMessages();
      }
    });
    systemWrap.appendChild(selectWrap);
  }
  
  const systemBubble = renderMessageBubble("system", systemContent || "未设置系统提示");
  systemBubble.title = "双击编辑系统提示";
  systemBubble.addEventListener("dblclick", () => startSystemPromptEdit());
  systemWrap.appendChild(systemBubble);
  els.chatMessages.appendChild(systemWrap);
  (state.currentChat.messages || []).forEach((message, index) => {
    const wrap = document.createElement("div");
    wrap.className = `chat-message chat-${message.role}`;
    const content = getChatMessageContent(message);
    const images = getChatMessageImages(message);
    if (images.length) {
      const imageWrap = document.createElement("div");
      imageWrap.className = "chat-image-row";
      images.forEach((imagePath) => {
      const img = document.createElement("img");
        img.src = getChatImageUrl(imagePath);
      img.alt = "";
      img.className = "chat-image";
        imageWrap.appendChild(img);
      });
      wrap.appendChild(imageWrap);
    }
    const bubble = renderMessageBubble(message.role === "assistant" ? "assistant" : "user", content || (message.error ? `回答失败：${message.error}` : ""));
    bubble.dataset.chatIndex = String(index);
    bubble.title = "双击编辑";
    bubble.addEventListener("dblclick", () => startInlineChatEdit(index));
    wrap.appendChild(bubble);
    const controls = document.createElement("div");
    controls.className = "message-controls";
    const variants = message.variants || [message.content || ""];
    controls.innerHTML = `${message.role === "assistant" ? `<button type="button" data-chat-action="prev">&lt;</button><span>${(message.activeVariant || 0) + 1} / ${variants.length}</span><button type="button" data-chat-action="next">&gt;</button><button type="button" data-chat-action="refresh">↻</button><button type="button" data-chat-action="continue">续写</button>` : ""}<button type="button" data-chat-action="branch">分支</button><button type="button" data-chat-action="copy">复制</button><button type="button" data-chat-action="delete">删除</button>`;
    controls.addEventListener("click", (event) => handleChatMessageAction(event, index));
    wrap.appendChild(controls);
    els.chatMessages.appendChild(wrap);
  });
}

function createMessageContent(content) {
  const div = document.createElement("div");
  div.className = "message-content";
  div.textContent = content;
  return div;
}

async function startSystemPromptEdit() {
  if (!state.currentChat) return;
  const systemWrap = document.querySelector(".chat-system-container");
  if (!systemWrap) return;
  const presets = state.settings.systemPromptPresets || [];
  const currentPresetId = state.currentChat.systemPromptPresetId || state.settings.defaultSystemPrompt || presets[0]?.id;
  const currentPreset = presets.find(p => p.id === currentPresetId);
  const currentContent = state.currentChat.systemPrompt || currentPreset?.content || "";
  systemWrap.innerHTML = `<div class="chat-system-edit">
    <textarea rows="4" class="chat-system-edit-input">${escapeHtml(currentContent)}</textarea>
    <div class="chat-system-edit-actions">
      <button type="button" data-edit-save>保存</button>
      <button type="button" data-edit-cancel>取消</button>
    </div>
  </div>`;
  const textarea = systemWrap.querySelector(".chat-system-edit-input");
  textarea.focus();
  systemWrap.querySelector("[data-edit-save]").addEventListener("click", async () => {
    state.currentChat.systemPrompt = textarea.value;
    await saveCurrentChat();
    renderChatMessages();
  });
  systemWrap.querySelector("[data-edit-cancel]").addEventListener("click", () => {
    renderChatMessages();
  });
}

function getChatMessageContent(message) {
  if (message.role !== "assistant") return message.content || "";
  const variants = message.variants || [message.content || ""];
  return variants[message.activeVariant || 0] || "";
}

function getChatMessageImages(message) {
  if (Array.isArray(message.images)) return message.images;
  return message.image ? [message.image] : [];
}

function getChatImageUrl(imagePath) {
  const value = String(imagePath || "");
  if (value.startsWith("data:") || value.startsWith("/")) return value;
  if (value.startsWith("image/")) return `/chat-image/${encodeURIComponent(value.replace(/^image\//, ""))}`;
  return value;
}

async function handleChatMessageAction(event, index) {
  const action = event.target?.dataset?.chatAction;
  if (!action || !state.currentChat) return;
  const message = state.currentChat.messages[index];
  if (!message) return;
  if (action === "refresh") {
    await refreshChatAnswer(index);
  } else if (action === "continue") {
    await continueChatAnswer(index);
  } else if (action === "branch") {
    await branchCurrentChat(index);
  } else if (action === "copy") {
    await navigator.clipboard.writeText(getChatMessageContent(message));
  } else if (action === "delete") {
    state.currentChat.messages.splice(index, 1);
    await saveCurrentChat();
    renderChatMessages();
  } else if (action === "prev" || action === "next") {
    const variants = message.variants || [message.content || ""];
    const delta = action === "next" ? 1 : -1;
    message.activeVariant = (variants.length + (message.activeVariant || 0) + delta) % variants.length;
    await saveCurrentChat();
    renderChatMessages();
  }
}

function startInlineChatEdit(index) {
  const message = state.currentChat?.messages?.[index];
  const bubble = els.chatMessages?.querySelector(`.message-bubble[data-chat-index="${index}"]`);
  if (!message || !bubble || bubble.classList.contains("editing")) return;
  bubble.classList.add("editing");
  const textarea = document.createElement("textarea");
  textarea.className = "chat-inline-editor";
  textarea.value = getChatMessageContent(message);
  const actions = document.createElement("div");
  actions.className = "toolbar chat-inline-actions";
  actions.innerHTML = `<button type="button" data-edit-save>保存</button><button type="button" data-edit-cancel>取消</button>`;
  bubble.innerHTML = "";
  bubble.append(textarea, actions);
  textarea.focus();
  actions.querySelector("[data-edit-save]").addEventListener("click", async () => {
    if (message.role === "assistant") {
      message.variants = message.variants || [message.content || ""];
      message.variants[message.activeVariant || 0] = textarea.value;
      message.content = message.variants[message.activeVariant || 0];
      message.error = "";
    } else {
      message.content = textarea.value;
    }
    await saveCurrentChat();
    renderChatMessages();
  });
  actions.querySelector("[data-edit-cancel]").addEventListener("click", renderChatMessages);
}

async function sendChatMessage() {
  if (!state.currentChat) await createNewChat();
  const inserted = await insertChatMessage();
  if (!inserted) return;
  await appendChatAnswer();
}

async function insertChatMessage() {
  if (!state.currentChat) await createNewChat();
  const text = els.chatInput.value.trim();
  const files = [...(els.chatImageInput.files || [])];
  if (!text && !files.length) return false;
  const images = [];
  for (const file of files) {
    const base64 = await fileToBase64(file);
    const uploaded = await api("/api/chat-image", { method: "POST", body: JSON.stringify({ fileName: file.name, base64 }) });
    images.push(uploaded.path);
  }
const content = text;
  const reasoning = els.chatThinkSelect?.value || state.chatThinkReasoning || "medium";
  const message = { role: state.chatComposeRole, content, images, reasoning };
  if (state.chatComposeRole === "assistant") {
    message.variants = [content];
    message.activeVariant = 0;
  }
  state.currentChat.messages.push(message);
  els.chatInput.value = "";
  els.chatImageInput.value = "";
  await saveCurrentChat();
  renderChatMessages();
  return true;
}

function toggleChatComposeRole() {
  state.chatComposeRole = state.chatComposeRole === "user" ? "assistant" : "user";
  els.chatRoleToggleBtn.textContent = state.chatComposeRole === "user" ? "用户" : "AI";
  els.chatRoleToggleBtn.classList.toggle("active", state.chatComposeRole === "assistant");
}

function toggleChatThink() {
  const current = els.chatThinkSelect?.value || "on";
  if (current === "off") {
    els.chatThinkSelect.value = state.chatThinkReasoning || "medium";
    els.chatThinkToggleBtn.classList.add("active");
  } else {
    state.chatThinkReasoning = current;
    els.chatThinkSelect.value = "off";
    els.chatThinkToggleBtn.classList.remove("active");
  }
}

function buildChatQuestion(messages) {
  const conversation = [];
  const presets = state.settings.systemPromptPresets || [];
  const currentPresetId = state.currentChat?.systemPromptPresetId || state.settings.defaultSystemPrompt || presets[0]?.id;
  const currentPreset = presets.find(p => p.id === currentPresetId);
  const systemPrompt = state.currentChat?.systemPrompt || currentPreset?.content || "";
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const reasoning = lastUserMessage?.reasoning || "off";
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const rest = messages.slice(i + 1);
    const nextUserOffset = rest.findIndex((item) => item.role === "user");
    const candidateRange = nextUserOffset >= 0 ? rest.slice(0, nextUserOffset) : rest;
    const next = candidateRange.find((item) => item.role === "assistant");
    const hasAssistant = next?.role === "assistant";
    conversation.push({
      user: { parts: [{ type: "text", text: message.content || "" }, ...getChatMessageImages(message).map((image) => ({ type: "image_url", image_url: { url: getChatImageUrl(image) } }))] },
      assistant: [{ mode: hasAssistant ? "seed" : "generate", content: hasAssistant ? getChatMessageContent(next) : "" }],
    });
  }
  return { score: 0, systemPrompt, expectedAnswer: "", checker: "function checkAnswer(){ return false; }", conversation, reasoning };
}

async function appendChatAnswer() {
  const preset = getChatPreset();
  if (!preset) return alert("请先在设置页选择可用模型预设");
  const question = buildChatQuestion(state.currentChat.messages);
  try {
    const result = await api("/api/run-test", { method: "POST", body: JSON.stringify({ preset, question, preserveMetadata: true, reasoning: question.reasoning }) });
    state.currentChat.messages.push({ role: "assistant", content: result.answer || "", variants: [result.answer || ""], activeVariant: 0 });
  } catch (error) {
    state.currentChat.messages.push({ role: "assistant", content: "", variants: [""], activeVariant: 0, error: error.message || "回答失败" });
  }
  await saveCurrentChat();
  renderChatMessages();
}

async function refreshChatAnswer(index) {
  const message = state.currentChat.messages[index];
  const before = state.currentChat.messages.slice(0, index).filter((item) => item.role !== "assistant" || getChatMessageContent(item));
  const preset = getChatPreset();
  try {
    const result = await api("/api/run-test", { method: "POST", body: JSON.stringify({ preset, question: buildChatQuestion(before), preserveMetadata: true }) });
  message.variants = message.variants || [message.content || ""];
  message.variants.push(result.answer || "");
  message.activeVariant = message.variants.length - 1;
    message.error = "";
  } catch (error) {
    message.error = error.message || "回答失败";
  }
  await saveCurrentChat();
  renderChatMessages();
}

async function continueChatAnswer(index) {
  const message = state.currentChat.messages[index];
  if (!message || message.role !== "assistant") return;
  const preset = getChatPreset();
  if (!preset) return alert("请先在设置页选择可用模型预设");
  const before = state.currentChat.messages.slice(0, index + 1);
  const mode = state.settings.chatContinueMode || "completions";
  let result;
  try {
    if (mode === "completions") {
      const current = getChatMessageContent(message);
      const lastAssistant = before.filter(m => m.role === "assistant").pop();
      const lastContent = lastAssistant ? getChatMessageContent(lastAssistant) : "";
      const promptSuffix = lastContent ? `\n\n[上文最后部分]\n${lastContent}\n\n[请续写上文，从上面的中断处继续输出，只输出续写内容，不要重复上文]` : "";
      const systemMessages = before.filter(m => m.role === "system");
      const systemPrompt = systemMessages.map(m => m.content).join("\n\n") || "你是一个有帮助的AI助手。";
      const nonSystemBefore = before.filter(m => m.role !== "system");
      const contextContent = nonSystemBefore.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${getChatMessageContent(m)}`).join("\n\n");
      const fullPrompt = `${systemPrompt}\n\n${contextContent}${promptSuffix}`;
      const extraConfig = preset.extraConfigParsed || {};
      const requestBody = {
        model: preset.model || "local-model",
        prompt: fullPrompt,
        max_tokens: extraConfig.max_tokens || 2048,
        temperature: extraConfig.temperature ?? 0.7,
      };
      if (extraConfig.stop) requestBody.stop = extraConfig.stop;
      result = await api("/api/run-test", { method: "POST", body: JSON.stringify({ preset, question: { messages: [{ role: "user", content: fullPrompt }] }, useCompletions: true, preserveMetadata: true }) });
    } else {
      const promptText = mode === "direct"
        ? "Continue the previous assistant message from exactly where it ended. Output only the continuation."
        : (state.settings.continuePrompt || "请续写上一条回答，只输出续写部分，不要重复前文。");
      const question = buildChatQuestion([...before, { role: "user", content: promptText, images: [] }]);
      result = await api("/api/run-test", { method: "POST", body: JSON.stringify({ preset, question, preserveMetadata: true }) });
    }
    const addition = result.answer || "";
    const current = getChatMessageContent(message);
    const merged = `${current}${current && addition ? "\n" : ""}${addition}`;
    message.variants = message.variants || [message.content || ""];
    message.variants[message.activeVariant || 0] = merged;
    message.content = merged;
    message.error = "";
  } catch (error) {
    message.error = error.message || "续写失败";
  }
  await saveCurrentChat();
  renderChatMessages();
}

async function branchCurrentChat(index = null) {
  if (!state.currentChat) return;
  const payload = { ...cloneSimpleJson(state.currentChat), id: undefined, title: `${state.currentChat.title || "对话"} 分支`, createdAt: new Date().toISOString() };
  if (Number.isInteger(index)) payload.messages = payload.messages.slice(0, index + 1);
  const result = await api("/api/chat", { method: "POST", body: JSON.stringify(payload) });
  await loadChats();
  await openChat(result.id);
}

async function saveCurrentChat(options = {}) {
  if (!state.currentChat) return;
  state.currentChat.title = els.chatTitle?.value || state.currentChat.title || "新对话";
  await api("/api/chat", { method: "POST", body: JSON.stringify(state.currentChat) });
  await loadChats();
  if (options.showToast) showToast("聊天已保存");
}

function getChatPreset() {
  const id = state.chatPresetId || els.chatPresetSelect?.value || state.testingPresetId || els.testingPresetSelect?.value;
  const preset = state.settings.presets.find((item) => item.id === id);
  if (!preset) return null;
  let extra = {};
  try {
    extra = preset.extraConfig ? JSON.parse(preset.extraConfig) : {};
  } catch {
    extra = {};
  }
  return { ...preset, extraConfigParsed: extra };
}

async function exportCurrentChatToQuestion() {
  if (!state.currentChat) return;
  const target = getSelectedFolderTarget();
  if (!target.setName || !target.folderName) return alert("请先在题库编辑器中选择一个目标文件夹");
  const fileName = `${(state.currentChat.title || "聊天导出").replace(/[\\/:*?"<>|]/g, "_")}.json`;
  const conversation = [];
  const messages = state.currentChat.messages || [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    const nextAssistant = messages.slice(i + 1).find((item) => item.role === "assistant");
    conversation.push({
      user: { parts: [{ type: "text", text: msg.content || "" }] },
      assistant: [{ mode: "seed", content: nextAssistant ? getChatMessageContent(nextAssistant) : "" }],
    });
  }
  await api("/api/create-question", { method: "POST", body: JSON.stringify({ setName: target.setName, folderName: target.folderName, fileName, content: { title: state.currentChat.title, score: 1, conversation } }) });
  await loadTree();
  showToast("已导出为问题");
}

function renderNotes() {
  if (!els.notesList) return;
  els.notesList.innerHTML = "";
  document.getElementById("sortByNameBtn")?.classList.toggle("active", state.noteSortBy === "name");
  document.getElementById("sortByTimeBtn")?.classList.toggle("active", state.noteSortBy === "time");
  const sortedNotes = [...state.notes].sort((a, b) => {
    if (state.noteSortBy === "time") {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    }
    return String(a.title || a.id).localeCompare(String(b.title || b.id), "zh-Hans-CN");
  });
  sortedNotes.forEach((note) => {
    const item = document.createElement("div");
    item.className = `notes-item${state.currentNoteId === note.id ? " active" : ""}`;
    item.dataset.id = note.id;
    const date = note.updatedAt ? new Date(note.updatedAt).toLocaleString("zh-CN") : "";
    item.innerHTML = `<div class="notes-item-title">${escapeHtml(note.title || "无标题")}</div><div class="notes-item-date">${date}</div>`;
    item.addEventListener("click", () => openNote(note.id));
    els.notesList.appendChild(item);
  });
}

function setNoteSortBy(sortBy) {
  state.noteSortBy = sortBy;
  localStorage.setItem(LAST_NOTE_SORT_KEY, sortBy);
  renderNotes();
}

async function createNewNote() {
  const newNote = { title: "", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), format: "md" };
  const result = await api("/api/note", { method: "POST", body: JSON.stringify(newNote) });
  await loadNotes();
  openNote(result.id);
}

async function openNote(id) {
  if (!id) return;
  try {
    const note = await api(`/api/note?id=${encodeURIComponent(id)}`);
    state.currentNoteId = id;
    state.currentNote = note;
    renderNoteEditor();
    renderNotes();
  } catch (e) {
    console.error("Failed to open note:", e);
  }
}

function renderNoteEditor() {
  if (!state.currentNote) {
    els.notesEmpty?.classList.remove("hidden");
    els.notesEditor?.classList.add("hidden");
    return;
  }
  els.notesEmpty?.classList.add("hidden");
  els.notesEditor?.classList.remove("hidden");
  els.noteTitle.value = state.currentNote.title || "";
  els.noteContent.value = state.currentNote.content || "";
  renderNotePreview();
}

function renderNotePreview() {
  if (!els.notePreview) return;
  const content = els.noteContent.value;
  if (state.noteViewMode === "markdown") {
    els.noteContent.classList.add("hidden");
    els.notePreview.classList.remove("hidden");
    els.notePreview.innerHTML = renderMarkdown(content);
  } else {
    els.noteContent.classList.remove("hidden");
    els.notePreview.classList.add("hidden");
  }
}

function setNoteViewMode(mode) {
  state.noteViewMode = mode;
  document.getElementById("viewMarkdownBtn").classList.toggle("active", mode === "markdown");
  document.getElementById("viewRawBtn").classList.toggle("active", mode === "raw");
  renderNotePreview();
}

async function saveNote(options = {}) {
  if (!state.currentNoteId || !state.currentNote) return;
  const showToastOnSuccess = Boolean(options.showToast);
  const payload = {
    id: state.currentNoteId,
    title: els.noteTitle.value,
    content: els.noteContent.value,
    createdAt: state.currentNote.createdAt,
    format: state.currentNote.format === "json" ? "json" : "md",
  };
  await api("/api/note", { method: "POST", body: JSON.stringify(payload) });
  await loadNotes();
  state.currentNote = { ...state.currentNote, ...payload, updatedAt: new Date().toISOString() };
  if (showToastOnSuccess) {
    showToast("笔记已保存");
  }
}

async function deleteNote() {
  if (!state.currentNoteId || !confirm("确定要删除这篇笔记吗？")) return;
  await api("/api/note-delete", { method: "POST", body: JSON.stringify({ id: state.currentNoteId }) });
  state.currentNoteId = "";
  state.currentNote = null;
  await loadNotes();
  renderNoteEditor();
  renderNotes();
}
