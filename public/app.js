const state = {
  tree: { sets: [] },
  selectedQuestionPath: "",
  currentQuestion: null,
  settings: { presets: [], activePresetId: "" },
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
};

const DEBUG_TEST_FLOW = false;
const LAST_PAGE_KEY = "lastActivePage";
const LAST_TESTING_SET_KEY = "lastTestingSet";
const LAST_NOTE_SORT_KEY = "lastNoteSortBy";
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
  presetCards: document.getElementById("presetCards"),
  testingSetSelect: document.getElementById("testingSetSelect"),
  testingPresetSelect: document.getElementById("testingPresetSelect"),
  testingList: document.getElementById("testingList"),
  scoreSummary: document.getElementById("scoreSummary"),
  scoreStatsBtn: document.getElementById("scoreStatsBtn"),
  closeScoreStatsBtn: document.getElementById("closeScoreStatsBtn"),
  scoreStatsPopover: document.getElementById("scoreStatsPopover"),
  scoreStatsContent: document.getElementById("scoreStatsContent"),
  savedResultSelect: document.getElementById("savedResultSelect"),
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
  await Promise.all([loadTree(), loadSettings(), loadResults(), loadNotes()]);
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
    localStorage.setItem(LAST_TESTING_SET_KEY, state.testingSet);
    const currentPage = localStorage.getItem(LAST_PAGE_KEY);
    if (currentPage === "editor") {
      renderEditorTree();
    } else if (currentPage === "testing") {
      state.testingSelectedPath = "";
      renderTestingList();
    }
  });
  els.saveQuestionBtn.addEventListener("click", () => saveQuestion({ showToast: true }));
  els.quickRunQuestionBtn.addEventListener("click", quickRunCurrentQuestion);
  document.getElementById("newPresetBtn").addEventListener("click", createPreset);
  document.getElementById("deletePresetBtn").addEventListener("click", deletePreset);
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
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
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("click", handleCheckerActionClick);
  els.testingPresetSelect.addEventListener("change", () => {
    state.testingPresetId = els.testingPresetSelect.value;
  });
  els.savedResultSelect.addEventListener("change", loadSelectedResult);
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
  }
  restorePageScroll(page, immediateScrollRestore);
}

function updateEditorSetSelectVisibility(page) {
  const editorSetSelectEl = document.querySelector(".editor-set-select");
  if (!editorSetSelectEl) return;
  if (page === "editor" || page === "testing") {
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
      qEl.innerHTML = `<div>${escapeHtml(question.title || question.name)}</div><div class="muted">${escapeHtml(question.name)} · ${question.score}分</div>`;
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

async function createQuestion() {
  const fileName = (els.newQuestionName.value.trim() || "问题1.json");
  const target = getSelectedFolderTarget();
  if (!target.setName || !target.folderName) return;
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
  state.hasUnsavedChanges = false;
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
  wrap.innerHTML = `<div class="inline-grid"><div class="field"><label>助手回答模式</label><select class="assistant-mode"><option value="generate">留空时由模型生成</option><option value="seed">视作已有助手回答</option><option value="continue">作为助手续写上下文</option></select></div><div></div><div class="field buttons"><button type="button" class="removeAssistantBtn">删除</button></div></div><div class="field"><label>助手回答内容</label><textarea class="assistant-content" rows="1"></textarea></div>`;
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
    state.settings = { activePresetId: "default", presets: [{ id: "default", name: "默认预设", model: "", baseUrl: "https://api.openai.com/v1", apiKey: "", extraConfig: "{}" }] };
  }
  renderSettings();
}

function renderSettings() {
  els.presetCards.innerHTML = "";
  els.testingPresetSelect.innerHTML = "";
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
  });
  state.testingPresetId = els.testingPresetSelect.value || state.settings.presets[0]?.id || "";
  renderPresetFields();
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
  state.settings.presets.push({ id, name, model: name, baseUrl: "https://api.openai.com/v1", apiKey: "", extraConfig: "{}" });
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
  await api("/api/settings", { method: "POST", body: JSON.stringify(state.settings) });
  renderSettings();
}

async function syncTestingSelectors() {
  const savedSet = localStorage.getItem(LAST_TESTING_SET_KEY);
  state.testingSet = state.testingSet || savedSet || state.tree.sets[0]?.name || "";
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
  if (!state.testingPresetId) state.testingPresetId = state.settings.activePresetId || state.settings.presets[0]?.id || "";
  await renderTestingList();
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
  const questionData = item.question || (await api(`/api/question?path=${encodeURIComponent(item.path)}`)).content;
  const details = document.createElement("details");
  const isSelected = item.path === state.testingSelectedPath;
  details.className = `test-card ${getTestStatusClass(item)}${isSelected ? " selected" : ""}`;
  details.dataset.path = item.path;
  details.open = Boolean(item.open);
  details.addEventListener("toggle", () => {
    item.open = details.open;
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
  const expectedText = questionData?.expectedAnswer?.trim() ? escapeHtml(questionData.expectedAnswer) : "未设置";
  const noteText = questionData?.note?.trim() ? escapeHtml(questionData.note) : "无";
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
  renderQuestionConversation(item, conversation);
  return details;
}

async function renderQuestionConversation(item, targetEl) {
  if (!item.question) {
    item.question = (await api(`/api/question?path=${encodeURIComponent(item.path)}`)).content;
  }
  const transcript = item.result?.transcript;
  targetEl.innerHTML = "";

  const hasSystemInTranscript = transcript?.some(e => e.role === "system");
  if (item.question.systemPrompt && !hasSystemInTranscript) {
    targetEl.appendChild(renderMessageBubble("system", item.question.systemPrompt));
  }

  const draftTranscript = buildDraftTranscript(item.question);
  const mergedTranscript = mergeTranscriptWithDraft(transcript, draftTranscript);
  
  mergedTranscript.forEach((entry, index) => targetEl.appendChild(renderTranscriptEntry(entry, index, mergedTranscript, state.isLoadingResult, item.question)));

  const followWrap = document.createElement("details");
  followWrap.className = "drawer";
  followWrap.open = false;
  followWrap.innerHTML = `<summary style="cursor:pointer;list-style:none;cursor:pointer;">追问 ▾</summary><div class="field"><textarea class="followUpInput" rows="3" placeholder="会以当前上下文继续提问"></textarea></div><div class="toolbar"><button type="button" class="sendFollowUpBtn">发送追问</button></div>`;
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
            imgFull.style.display = "block";
            imgFull.style.maxWidth = "100%";
            imgFull.style.maxHeight = "calc(100vh - 100px)";
            const toggleBtn = document.createElement("button");
            toggleBtn.textContent = "1:1";
            toggleBtn.style.marginBottom = "8px";
            toggleBtn.style.padding = "4px 8px";
            toggleBtn.style.fontSize = "12px";
            toggleBtn.style.cursor = "pointer";
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
            modalBody.appendChild(toggleBtn);
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
    const folderStats = computeScoreStats(itemsByFolder[folderName]);
    folderHeader.innerHTML = `<div class="testing-folder-main"><span class="testing-folder-toggle">▾</span><strong>${escapeHtml(folderName)}</strong><span class="testing-folder-count">(${itemsByFolder[folderName].length}题)</span></div><div class="testing-folder-score">得分:${formatScore(folderStats.earned)} / ${formatScore(folderStats.total)}</div><div class="testing-folder-actions"><button type="button" class="run-folder-btn">测试本组</button></div>`;
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
  const summary = computeScoreStats(state.testingItems);
  els.scoreSummary.textContent = `总分：${formatScore(summary.earned)} / ${formatScore(summary.total)}`;
  renderScoreStatsPanel();
}

function toggleAllTests(expanded) {
  [...els.testingList.querySelectorAll(".testing-folder-header")].forEach((header) => {
    header.classList.toggle("collapsed", !expanded);
    const toggle = header.querySelector(".testing-folder-toggle");
    toggle.textContent = expanded ? "▾" : "▸";
    const folderName = header.querySelector("strong")?.textContent;
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
  els.savedResultSelect.innerHTML = `<option value="">选择一个结果</option>`;
  results.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name || item.id;
    els.savedResultSelect.appendChild(option);
  });
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
    folderEl.innerHTML = `<div class="tree-folder-header"><span class="tree-folder-toggle">▾</span><strong>${escapeHtml(folder.name)}</strong></div>`;
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
  const summaryHeight = card.querySelector("summary")?.offsetHeight || 0;
  const y = card.getBoundingClientRect().top + window.scrollY - topbarHeight - folderHeaderHeight;
  window.scrollTo({ top: Math.max(0, y), behavior: options.behavior || "smooth" });
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
    stats.push(`耗时: ${secs} s`);
    const ts = (totalCompletionTokens / (totalDuration / 1000)).toFixed(1);
    stats.push(`速度: ${ts} t/s`);
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
  return ["editor", "testing", "notes", "settings"].includes(page) ? page : "editor";
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
  const overall = computeScoreStats(state.testingItems);
  const groups = {};
  state.testingItems.forEach((item) => {
    const folder = item.folderName || "未分组";
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(item);
  });
  const rows = [];
  rows.push(`<div class="score-stats-item score-stats-overall"><strong>总计</strong><span>已测:${formatScore(overall.measuredEarned)}/${formatScore(overall.measuredTotal)}</span><span>未测:${formatScore(overall.unmeasuredTotal)}</span></div>`);
  Object.keys(groups).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).forEach((folderName) => {
    const stat = computeScoreStats(groups[folderName]);
    rows.push(`<div class="score-stats-item"><strong>${escapeHtml(folderName)}</strong><span>已测:${formatScore(stat.measuredEarned)}/${formatScore(stat.measuredTotal)}</span><span>未测:${formatScore(stat.unmeasuredTotal)}</span></div>`);
  });
  els.scoreStatsContent.innerHTML = rows.join("");
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

async function loadNotes() {
  state.notes = await api("/api/notes");
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
  const newNote = { title: "", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
  };
  await api("/api/note", { method: "POST", body: JSON.stringify(payload) });
  await loadNotes();
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
