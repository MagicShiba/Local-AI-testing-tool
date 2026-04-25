const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATASET_ROOT = path.join(ROOT, "TestingDataset");
const APP_DATA_DIR = path.join(ROOT, "app-data");
const SETTINGS_FILE = path.join(APP_DATA_DIR, "settings.json");
const API_SETTINGS_FILE = path.join(APP_DATA_DIR, "api-settings.local.json");
const RESULTS_DIR = path.join(APP_DATA_DIR, "results");
const MAX_BODY = 50 * 1024 * 1024;
const DEBUG_TEST_FLOW = false;

ensureDirSync(DATASET_ROOT);
ensureDirSync(APP_DATA_DIR);
ensureDirSync(RESULTS_DIR);
const NOTES_DIR = path.join(APP_DATA_DIR, "note");
ensureDirSync(NOTES_DIR);
const NOTE_IMAGE_DIR = path.join(APP_DATA_DIR, "note", "image");
ensureDirSync(NOTE_IMAGE_DIR);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const DATA_URL_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

const defaultQuestion = (filename = "问题1.json") => ({
  version: 1,
  title: "",
  score: 1,
  note: "",
  systemPrompt: "You are a helpful AI assistant.\n使用中文回答用户问题。",
  conversation: [
    {
      user: {
        parts: [
          {
            type: "text",
            text: "",
          },
        ],
      },
      assistant: [{ mode: "generate", content: "" }],
    },
  ],
  checker: `function checkAnswer(answer, correctAnswer) {\n    return answer === correctAnswer;\n}`,
  expectedAnswer: "",
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    filename,
  },
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    if (url.pathname.startsWith("/dataset-file/")) {
      await serveDatasetFile(res, url);
      return;
    }

    if (url.pathname.startsWith("/note-image/")) {
      await serveNoteImage(res, url);
      return;
    }

    await serveStatic(res, url);
  } catch (error) {
    respondJson(res, 500, {
      error: error.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

server.listen(15397, () => {
  console.log("本地AI测试工具已启动: http://127.0.0.1:15397");
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/tree") {
    return respondJson(res, 200, await readDatasetTree());
  }

  if (req.method === "POST" && url.pathname === "/api/create-set") {
    const body = await readJsonBody(req);
    const setName = sanitizeSegment(body.name);
    if (!setName) return respondJson(res, 400, { error: "测试集名称不能为空" });
    await ensureDir(path.join(DATASET_ROOT, setName, "assets"));
    return respondJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/create-folder") {
    const body = await readJsonBody(req);
    const setName = sanitizeSegment(body.setName);
    const folderName = sanitizeSegment(body.folderName);
    if (!setName || !folderName) return respondJson(res, 400, { error: "测试集和文件夹名称不能为空" });
    await ensureDir(path.join(DATASET_ROOT, setName, folderName));
    return respondJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/create-question") {
    const body = await readJsonBody(req);
    const setName = sanitizeSegment(body.setName);
    const folderName = sanitizeSegment(body.folderName);
    const fileName = sanitizeQuestionFileName(body.fileName || "问题1.json");
    if (!setName || !folderName) return respondJson(res, 400, { error: "测试集和文件夹不能为空" });
    const target = path.join(DATASET_ROOT, setName, folderName, fileName);
    if (await exists(target)) return respondJson(res, 400, { error: "题目文件已存在" });
    await fsp.writeFile(target, JSON.stringify(defaultQuestion(fileName), null, 2), "utf8");
    return respondJson(res, 200, { ok: true, path: path.join(setName, folderName, fileName).replaceAll("\\", "/") });
  }

  if (req.method === "GET" && url.pathname === "/api/question") {
    const rel = url.searchParams.get("path");
    const fullPath = resolveDatasetPath(rel);
    return respondJson(res, 200, { path: rel, content: JSON.parse(await fsp.readFile(fullPath, "utf8")) });
  }

  if (req.method === "POST" && url.pathname === "/api/question") {
    const body = await readJsonBody(req);
    const fullPath = resolveDatasetPath(body.path);
    const content = body.content || {};
    content.version = 1;
    content.metadata = content.metadata || {};
    content.metadata.updatedAt = new Date().toISOString();
    content.metadata.filename = path.basename(fullPath);
    await fsp.writeFile(fullPath, JSON.stringify(content, null, 2), "utf8");
    return respondJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/move-question") {
    const body = await readJsonBody(req);
    const fromPath = resolveDatasetPath(body.fromPath);
    const setName = sanitizeSegment(body.toSetName);
    const folderName = sanitizeSegment(body.toFolderName);
    if (!setName || !folderName) return respondJson(res, 400, { error: "目标测试集和文件夹不能为空" });
    const destDir = path.join(DATASET_ROOT, setName, folderName);
    await ensureDir(destDir);
    await fsp.rename(fromPath, path.join(destDir, path.basename(fromPath)));
    return respondJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/assets") {
    const setName = sanitizeSegment(url.searchParams.get("setName"));
    if (!setName) return respondJson(res, 400, { error: "测试集不能为空" });
    const assetsDir = path.join(DATASET_ROOT, setName, "assets");
    await ensureDir(assetsDir);
    const files = await fsp.readdir(assetsDir, { withFileTypes: true });
    return respondJson(
      res,
      200,
      files.filter((entry) => entry.isFile()).map((entry) => ({
        name: entry.name,
        url: `/dataset-file/${encodeURIComponent(path.join(setName, "assets", entry.name).replaceAll("\\", "/"))}`,
      }))
    );
  }

  if (req.method === "POST" && url.pathname === "/api/upload-asset") {
    const body = await readJsonBody(req);
    const setName = sanitizeSegment(body.setName);
    const fileName = sanitizeAssetFileName(body.fileName);
    const base64 = body.base64 || "";
    if (!setName || !fileName || !base64) return respondJson(res, 400, { error: "缺少上传参数" });
    const assetsDir = path.join(DATASET_ROOT, setName, "assets");
    await ensureDir(assetsDir);
    const pureBase64 = base64.includes(",") ? base64.split(",").pop() : base64;
    await fsp.writeFile(path.join(assetsDir, fileName), Buffer.from(pureBase64, "base64"));
    return respondJson(res, 200, { ok: true, name: fileName });
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    return respondJson(res, 200, await readSettingsConfig());
  }

  if (req.method === "POST" && url.pathname === "/api/settings") {
    const body = await readJsonBody(req);
    await fsp.writeFile(API_SETTINGS_FILE, JSON.stringify(body, null, 2), "utf8");
    return respondJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/results") {
    const files = await fsp.readdir(RESULTS_DIR, { withFileTypes: true });
    const list = [];
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const data = await readJsonFile(path.join(RESULTS_DIR, entry.name), null);
      if (data) {
        const fallbackId = entry.name.replace(/\.json$/i, "");
        list.push({ id: data.id || fallbackId, name: data.name || fallbackId, createdAt: data.createdAt, model: data.model, dataset: data.dataset });
      }
    }
    list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return respondJson(res, 200, list);
  }

  if (req.method === "GET" && url.pathname === "/api/result") {
    const id = sanitizeSimpleName(url.searchParams.get("id"));
    if (!id) return respondJson(res, 400, { error: "结果ID不能为空" });
    let data = await readJsonFile(path.join(RESULTS_DIR, `${id}.json`), null);
    if (!data) {
      const files = await fsp.readdir(RESULTS_DIR, { withFileTypes: true });
      for (const entry of files) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const candidate = await readJsonFile(path.join(RESULTS_DIR, entry.name), null);
        if (candidate?.id === id) {
          data = candidate;
          break;
        }
      }
    }
    if (!data) return respondJson(res, 404, { error: "结果不存在" });
    return respondJson(res, 200, data);
  }

  if (req.method === "POST" && url.pathname === "/api/save-result") {
    const body = await readJsonBody(req);
    const id = body.id ? sanitizeSimpleName(body.id) : createId();
    const payload = { ...body, id, createdAt: body.createdAt || new Date().toISOString() };
    await fsp.writeFile(path.join(RESULTS_DIR, `${id}.json`), JSON.stringify(payload, null, 2), "utf8");
    return respondJson(res, 200, { ok: true, id });
  }

  if (req.method === "GET" && url.pathname === "/api/notes") {
    const list = await readAllNotes();
    list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return respondJson(res, 200, list);
  }

  if (req.method === "GET" && url.pathname === "/api/note") {
    const id = url.searchParams.get("id");
    if (!id) return respondJson(res, 400, { error: "笔记ID不能为空" });
    const data = await readNoteById(id);
    if (!data) return respondJson(res, 404, { error: "笔记文件不存在" });
    return respondJson(res, 200, data);
  }

  if (req.method === "POST" && url.pathname === "/api/note") {
    const body = await readJsonBody(req);
    const id = body.id || createId();
    const format = body.format === "json" ? "json" : "md";
    const payload = {
      id,
      title: body.title || "",
      content: body.content || "",
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      format,
    };
    await writeNoteFile(payload);
    return respondJson(res, 200, { ok: true, id });
  }

  if (req.method === "POST" && url.pathname === "/api/note-delete") {
    const body = await readJsonBody(req);
    const id = body.id;
    if (!id) return respondJson(res, 400, { error: "笔记ID不能为空" });
    await deleteNoteFiles(id);
    return respondJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/run-test") {
    const body = await readJsonBody(req);
    const preset = body.preset || {};
    const question = body.question || {};
    const followUpText = body.followUpText || "";
    const step = body.step;
    const preserveMetadata = body.preserveMetadata !== false;
    const existingTranscript = body.existingTranscript || [];
    const abortController = new AbortController();
    const abortRun = () => abortController.abort();
    req.once("aborted", abortRun);
    req.once("close", abortRun);
    let execution;
    try {
      execution = await executeQuestion(
        preset,
        question,
        followUpText,
        step,
        preserveMetadata,
        existingTranscript,
        abortController.signal
      );
    } finally {
      req.off("aborted", abortRun);
      req.off("close", abortRun);
    }
    return respondJson(res, 200, execution);
  }

  respondJson(res, 404, { error: "接口不存在" });
}

async function serveStatic(res, url) {
  const target = url.pathname === "/" ? "/index.html" : url.pathname;
  const fullPath = path.resolve(PUBLIC_DIR, `.${target}`);
  if (!fullPath.startsWith(PUBLIC_DIR)) return respondText(res, 403, "Forbidden");
  const stat = await fsp.stat(fullPath).catch(() => null);
  if (!stat || !stat.isFile()) return respondText(res, 404, "Not Found");
  res.writeHead(200, { "Content-Type": MIME[path.extname(fullPath).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(fullPath).pipe(res);
}

async function serveDatasetFile(res, url) {
  const fullPath = resolveDatasetPath(decodeURIComponent(url.pathname.replace("/dataset-file/", "")));
  const stat = await fsp.stat(fullPath).catch(() => null);
  if (!stat || !stat.isFile()) return respondText(res, 404, "Not Found");
  res.writeHead(200, { "Content-Type": MIME[path.extname(fullPath).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(fullPath).pipe(res);
}

async function serveNoteImage(res, url) {
  const relPath = decodeURIComponent(url.pathname.replace("/note-image/", ""));
  const fullPath = path.resolve(NOTE_IMAGE_DIR, relPath.replaceAll("..", ""));
  if (!fullPath.startsWith(NOTE_IMAGE_DIR)) return respondText(res, 403, "Forbidden");
  const stat = await fsp.stat(fullPath).catch(() => null);
  if (!stat || !stat.isFile()) return respondText(res, 404, "Not Found");
  res.writeHead(200, { "Content-Type": MIME[path.extname(fullPath).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(fullPath).pipe(res);
}

async function executeQuestion(preset, question, followUpText, step = null, preserveMetadata = true, existingTranscript = [], abortSignal = null) {
  const messages = [];
  const transcript = [];
  const requests = [];
  let lastAnswer = "";

  if (question.systemPrompt) {
    messages.push({ role: "system", content: question.systemPrompt });
    transcript.push({ role: "system", content: question.systemPrompt });
  }

  const conversationRounds = question.conversation || [];
  const stepArg = step !== null ? step : (followUpText ? conversationRounds.length + 1 : conversationRounds.length);
  const maxStep = stepArg;

  const existingUserEntries = existingTranscript.filter(e => e.role === "user" && !e.isFollowUp);
  const existingAssistantEntries = existingTranscript.filter(e => e.role === "assistant");
  const existingUserCount = Math.min(existingUserEntries.length, conversationRounds.length);
  const existingAssistantCount = existingAssistantEntries.length;
  if (DEBUG_TEST_FLOW) {
    console.log("[executeQuestion:start]", {
      step,
      stepArg,
      rounds: conversationRounds.length,
      existingTranscriptLength: existingTranscript.length,
      existingUserCount,
      existingAssistantCount,
      hasFollowUpText: Boolean(followUpText),
    });
  }

  for (let i = 0; i < existingUserCount; i++) {
    const userEntry = existingUserEntries[i];
    if (userEntry && userEntry.content) {
      const userContent = await normalizeTranscriptUserContent(userEntry.content);
      const msgContent = userContent.length === 1 && userContent[0].type === "text" ? userContent[0].text : userContent;
      messages.push({ role: "user", content: msgContent });
      transcript.push({ role: "user", content: userEntry.content });
      
      const assistantEntry = existingAssistantEntries[i];
      if (assistantEntry) {
        messages.push({ role: "assistant", content: assistantEntry.content || "" });
        transcript.push({
          role: "assistant",
          mode: assistantEntry.mode || "seed",
          content: assistantEntry.content || "",
          meta: assistantEntry.meta,
          request: assistantEntry.request,
          response: assistantEntry.response,
          reasoning: assistantEntry.reasoning,
          _duration: Number(assistantEntry._duration || 0),
        });
        lastAnswer = assistantEntry.content || "";
      }
    }
  }

  for (let roundIdx = 0; roundIdx < conversationRounds.length; roundIdx++) {
    if (step !== null && roundIdx >= stepArg) break;
    if (roundIdx < existingUserCount) continue;

    const round = conversationRounds[roundIdx];
    if (DEBUG_TEST_FLOW) {
      console.log("[executeQuestion:round]", { roundIdx, stepArg });
    }
    const userContent = await toUserContent(round.user?.parts || []);
    const userMessage = { role: "user", content: userContent };
    messages.push(userMessage);
    transcript.push({
      role: "user",
      content: cloneJson(round.user?.parts || []),
    });

    const assistantItems = Array.isArray(round.assistant) && round.assistant.length
      ? round.assistant
      : [{ mode: "generate", content: "" }];

    for (const assistantItem of assistantItems) {
      const hasManualContent = String(assistantItem?.content || "").trim().length > 0;
      if (hasManualContent) {
        messages.push({ role: "assistant", content: assistantItem.content });
        transcript.push({
          role: "assistant",
          mode: assistantItem.mode || "seed",
          content: assistantItem.content,
        });
        lastAnswer = assistantItem.content;
        continue;
      }

      const requestMessages = cloneJson(messages);
      const reqStartTime = Date.now();
      const response = await callOpenAI(preset, requestMessages, abortSignal);
      const reqDuration = Date.now() - reqStartTime;
      const answer = extractAnswerText(response);
      const reasoning = extractReasoningText(response);
      messages.push({ role: "assistant", content: answer });
      const cleanedRequestMessages = cleanRequestMessagesForTranscript(requestMessages, conversationRounds);
      transcript.push({
        role: "assistant",
        mode: "generate",
        content: answer,
        reasoning,
        request: {
          model: preset.model,
          baseUrl: preset.baseUrl,
          messages: cleanedRequestMessages,
        },
        response,
        _duration: reqDuration,
      });
      requests.push({
        model: preset.model,
        baseUrl: preset.baseUrl,
        messages: cleanedRequestMessages,
        response,
        answer,
        reasoning,
      });
      lastAnswer = answer;
    }
  }

  const shouldRunFollowUp = followUpText && step !== null && step > conversationRounds.length;
  const existingFollowUpUser = existingTranscript.find(e => e.isFollowUp && e.role === "user");
  
  if (shouldRunFollowUp && !existingFollowUpUser) {
    const followUpMessage = { role: "user", content: followUpText };
    messages.push(followUpMessage);
    transcript.push({
      role: "user",
      content: [{ type: "text", text: followUpText }],
      isFollowUp: true,
    });

    const requestMessages = cloneJson(messages);
    const reqStartTime = Date.now();
    const response = await callOpenAI(preset, requestMessages, abortSignal);
    const reqDuration = Date.now() - reqStartTime;
    const answer = extractAnswerText(response);
    const reasoning = extractReasoningText(response);
    messages.push({ role: "assistant", content: answer });
    const cleanedRequestMessages = cleanRequestMessagesForTranscript(requestMessages, conversationRounds);
    transcript.push({
      role: "assistant",
      mode: "generate",
      content: answer,
      reasoning,
      isFollowUp: true,
      request: {
        model: preset.model,
        baseUrl: preset.baseUrl,
        messages: cleanedRequestMessages,
      },
      response,
      _duration: reqDuration,
    });
    requests.push({
      model: preset.model,
      baseUrl: preset.baseUrl,
      messages: cleanedRequestMessages,
      response,
      answer,
      reasoning,
      isFollowUp: true,
    });
    lastAnswer = answer;
  }

  return {
    answer: lastAnswer,
    score: evaluateAnswer(question, lastAnswer),
    transcript: preserveMetadata ? transcript : cleanTranscriptForSave(transcript, conversationRounds),
  };
}

async function normalizeTranscriptUserContent(content) {
  const parts = Array.isArray(content) ? content : [{ type: "text", text: String(content || "") }];
  const result = [];
  for (const part of parts) {
    if (part.type === "image" && part.assetPath) {
      result.push({ type: "image_url", image_url: { url: await datasetAssetToDataUrl(part.assetPath) } });
      continue;
    }
    if (part.type === "image_url" && part.image_url?.url) {
      const rawUrl = String(part.image_url.url || "");
      if (rawUrl.startsWith("data:") || rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        result.push({ type: "image_url", image_url: { url: rawUrl } });
        continue;
      }
      if (rawUrl.startsWith("/dataset-file/")) {
        const rel = decodeURIComponent(rawUrl.replace("/dataset-file/", ""));
        result.push({ type: "image_url", image_url: { url: await datasetAssetToDataUrl(rel) } });
        continue;
      }
      result.push({ type: "image_url", image_url: { url: await datasetAssetToDataUrl(rawUrl) } });
      continue;
    }
    result.push({ type: "text", text: part.text || "" });
  }
  return result;
}

function cleanMessageForSave(msg, conversationRounds) {
  if (msg.role !== "user") return msg;
  const content = msg.content;
  if (!Array.isArray(content)) return msg;
  return { ...msg, content: content.map((item) => {
    if (item.type !== "image_url" || !item.image_url?.url) return item;
    const url = item.image_url.url;
    if (url.startsWith("data:")) {
      const roundIndex = 0;
      const round = conversationRounds[roundIndex];
      const parts = round?.user?.parts || [];
      const imagePart = parts.find((p) => p.type === "image" && p.assetPath);
      if (imagePart?.assetPath) {
        return { type: "image_url", image_url: { url: imagePart.assetPath } };
      }
    }
    return item;
  }) };
}

function cleanTranscriptForSave(transcript, conversationRounds) {
  const result = [];
  const assistantEntries = transcript.filter((e) => e.role === "assistant");
  const lastAssistantIndex = assistantEntries.length - 1;
  const aggregatedUsage = assistantEntries.reduce((acc, entry) => {
    const usage = entry.response?.usage || entry.meta?.usage;
    if (!usage) return acc;
    acc.prompt_tokens += Number(usage.prompt_tokens || 0);
    acc.completion_tokens += Number(usage.completion_tokens || 0);
    acc.total_tokens += Number(usage.total_tokens || 0);
    return acc;
  }, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });

  for (const entry of transcript) {
    if (entry.role === "system") {
      result.push({ role: "system", content: entry.content });
    } else if (entry.role === "user") {
      const userEntry = { role: "user" };
      if (Array.isArray(entry.content)) {
        userEntry.content = entry.content.map((item) => {
          if (item.type !== "image_url" || !item.image_url?.url) return item;
          const roundIndex = result.filter((e) => e.role === "user").length;
          const round = conversationRounds[roundIndex];
          const parts = round?.user?.parts || [];
          const imagePart = parts.find((p) => p.type === "image" && p.assetPath);
          if (imagePart?.assetPath) {
            return { type: "image_url", image_url: { url: imagePart.assetPath } };
          }
          return item;
        });
      } else {
        userEntry.content = entry.content;
      }
      result.push(userEntry);
    } else {
      const currentAssistantIndex = assistantEntries.indexOf(entry);
      const isLastAssistant = currentAssistantIndex === lastAssistantIndex;
      const cleaned = {
        role: "assistant",
        mode: entry.mode,
        content: entry.content,
        reasoning: entry.reasoning,
        _duration: entry._duration,
      };
      if (isLastAssistant && entry.response) {
        cleaned.meta = buildAssistantMeta(entry.response, aggregatedUsage);
      }
      if (isLastAssistant && entry.request) {
        cleaned.request = cleanRequestMessagesForSave(entry.request, conversationRounds);
      }
      if (isLastAssistant && entry.response) {
        cleaned.response = mergeUsageIntoResponse(entry.response, aggregatedUsage);
      }
      if (isLastAssistant) {
        cleaned.answer = entry.content;
      }
      result.push(cleaned);
    }
  }
  return result;
}

function buildAssistantMeta(response, usageOverride = null) {
  const choice = response?.choices?.[0] || {};
  const meta = {
    id: response?.id || "",
    object: response?.object || "",
    created: response?.created || null,
    model: response?.model || "",
    finish_reason: choice?.finish_reason || "",
    usage: usageOverride ? {
      ...(response?.usage || {}),
      prompt_tokens: usageOverride.prompt_tokens,
      completion_tokens: usageOverride.completion_tokens,
      total_tokens: usageOverride.total_tokens,
    } : (response?.usage || null),
  };
  const hasReasoningContent = choice?.message?.reasoning_content != null;
  if (hasReasoningContent) {
    meta.reasoning_content = choice.message.reasoning_content;
  }
  return meta;
}

function mergeUsageIntoResponse(response, usageOverride) {
  if (!usageOverride || !response) return response;
  return {
    ...response,
    usage: {
      ...(response.usage || {}),
      prompt_tokens: usageOverride.prompt_tokens,
      completion_tokens: usageOverride.completion_tokens,
      total_tokens: usageOverride.total_tokens,
    },
  };
}

function cleanRequestMessagesForSave(request, conversationRounds) {
  if (!request?.messages) return request;
  const imageAssetMap = {};
  request.messages.forEach((msg, msgIdx) => {
    if (msg.role !== "user") return;
    const content = msg.content;
    if (!Array.isArray(content)) return;
    content.forEach((item) => {
      if (item.type !== "image_url" || !item.image_url?.url) return;
      if (item.image_url.url.startsWith("data:")) {
        const roundIndex = request.messages.slice(0, msgIdx).filter((m) => m.role === "user").length;
        const round = conversationRounds[roundIndex];
        const parts = round?.user?.parts || [];
        const imagePart = parts.find((p) => p.type === "image" && p.assetPath);
        if (imagePart?.assetPath) {
          imageAssetMap[`${msgIdx}-${item.image_url.url}`] = imagePart.assetPath;
        }
      }
    });
  });
  return {
    ...request,
    messages: request.messages.map((msg, msgIdx) => {
      if (msg.role !== "user") return msg;
      const content = msg.content;
      if (!Array.isArray(content)) return msg;
      return {
        ...msg,
        content: content.map((item, itemIdx) => {
          if (item.type !== "image_url" || !item.image_url?.url) return item;
          const url = item.image_url.url;
          if (url.startsWith("data:")) {
            const assetPath = imageAssetMap[`${msgIdx}-${url}`];
            if (assetPath) {
              return { type: "image_url", image_url: { url: assetPath } };
            }
          }
          return item;
        }),
      };
    }),
  };
}

function cleanRequestMessagesForTranscript(requestMessages, conversationRounds) {
  if (!requestMessages) return requestMessages;
  const imageAssetMap = {};
  requestMessages.forEach((msg, msgIdx) => {
    if (msg.role !== "user") return;
    const content = msg.content;
    if (!Array.isArray(content)) return;
    content.forEach((item) => {
      if (item.type !== "image_url" || !item.image_url?.url) return;
      if (item.image_url.url.startsWith("data:")) {
        const roundIndex = requestMessages.slice(0, msgIdx).filter((m) => m.role === "user").length;
        if (roundIndex < conversationRounds.length) {
          const round = conversationRounds[roundIndex];
          const parts = round?.user?.parts || [];
          const imagePart = parts.find((p) => p.type === "image" && p.assetPath);
          if (imagePart?.assetPath) {
            imageAssetMap[`${msgIdx}-${item.image_url.url}`] = imagePart.assetPath;
          }
        }
      }
    });
  });
  return requestMessages.map((msg, msgIdx) => {
    if (msg.role !== "user") return msg;
    const content = msg.content;
    if (!Array.isArray(content)) return msg;
    return {
      ...msg,
      content: content.map((item) => {
        if (item.type !== "image_url" || !item.image_url?.url) return item;
        const url = item.image_url.url;
        if (url.startsWith("data:")) {
          const assetPath = imageAssetMap[`${msgIdx}-${url}`];
          if (assetPath) {
            return { type: "image_url", image_url: { url: assetPath } };
          }
        }
        return item;
      }),
    };
  });
}

async function toUserContent(parts) {
  const userParts = [];
  for (const part of parts) {
    if (part.type === "image" && part.assetPath) {
      userParts.push({ type: "image_url", image_url: { url: await datasetAssetToDataUrl(part.assetPath) } });
    } else {
      userParts.push({ type: "text", text: part.text || "" });
    }
  }
  return userParts.length === 1 && userParts[0].type === "text" ? userParts[0].text : userParts;
}

async function callOpenAI(preset, messages, signal = null) {
  if (!preset.baseUrl || !preset.model || !preset.apiKey) {
    throw new Error("请先在设置页填写可用的 baseUrl、model 和 apiKey");
  }
  const endpoint = `${String(preset.baseUrl).replace(/\/+$/, "")}/chat/completions`;
  const extraBody = preset.extraConfigParsed && typeof preset.extraConfigParsed === "object" ? preset.extraConfigParsed : {};
  const resp = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${preset.apiKey}`,
    },
    body: JSON.stringify({ model: preset.model, messages, ...extraBody }),
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!resp.ok) throw new Error(`模型调用失败(${resp.status}): ${JSON.stringify(data)}`);
  return data;
}

function extractAnswerText(response) {
  const message = response?.choices?.[0]?.message;
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((item) => (typeof item === "string" ? item : item?.text || "")).join("\n");
  }
  return "";
}

function extractReasoningText(response) {
  const message = response?.choices?.[0]?.message;
  const reasoning = message?.reasoning_content;
  if (!reasoning) return "";
  if (typeof reasoning === "string") return reasoning;
  if (Array.isArray(reasoning)) {
    return reasoning.map((item) => (typeof item === "string" ? item : item?.text || "")).join("\n");
  }
  return "";
}

function evaluateAnswer(question, answer) {
  const maxScore = Number(question.score || 0);
  let passed = false;
  let error = "";
  let earned = 0;
  let statusHtml = "";
  const expected = String(question.expectedAnswer || "").trim();
  const hasExpectedAnswer = expected.length > 0;
  const cleanedAnswer = String(answer || "").trim();
  try {
    const fn = new Function(`return (${question.checker || defaultQuestion().checker});`)();
    const checkerResult = fn(cleanedAnswer, expected, {
      question,
      answer: cleanedAnswer,
      expectedAnswer: expected,
      maxScore,
    });
    const normalized = normalizeCheckerResult(checkerResult, maxScore, hasExpectedAnswer);
    passed = normalized.passed;
    earned = normalized.earned;
    statusHtml = normalized.statusHtml;
  } catch (err) {
    error = err.message || String(err);
  }
  return { passed, error, earned, total: maxScore, hasExpectedAnswer, statusHtml };
}

function normalizeCheckerResult(checkerResult, maxScore, hasExpectedAnswer) {
  let earned = 0;
  let passed = false;
  let statusHtml = "";

  if (typeof checkerResult === "boolean") {
    passed = checkerResult;
    earned = checkerResult ? maxScore : 0;
    return { passed, earned, statusHtml };
  }

  if (typeof checkerResult === "number" && Number.isFinite(checkerResult)) {
    earned = normalizePercentScore(checkerResult, maxScore);
    passed = earned >= maxScore;
    return { passed, earned, statusHtml };
  }

  if (checkerResult && typeof checkerResult === "object") {
    if ("statusHtml" in checkerResult) {
      statusHtml = String(checkerResult.statusHtml || "");
    } else if ("html" in checkerResult) {
      statusHtml = String(checkerResult.html || "");
    }

    if ("earned" in checkerResult && Number.isFinite(Number(checkerResult.earned))) {
      earned = clampScore(Number(checkerResult.earned), maxScore);
    } else if ("percent" in checkerResult && Number.isFinite(Number(checkerResult.percent))) {
      earned = normalizePercentScore(Number(checkerResult.percent), maxScore);
    } else if ("ratio" in checkerResult && Number.isFinite(Number(checkerResult.ratio))) {
      earned = normalizePercentScore(Number(checkerResult.ratio), maxScore);
    } else if ("scoreRatio" in checkerResult && Number.isFinite(Number(checkerResult.scoreRatio))) {
      earned = normalizePercentScore(Number(checkerResult.scoreRatio), maxScore);
    } else if ("passed" in checkerResult) {
      earned = checkerResult.passed ? maxScore : 0;
    } else if ("ok" in checkerResult) {
      earned = checkerResult.ok ? maxScore : 0;
    } else if (hasExpectedAnswer) {
      earned = 0;
    }

    if ("passed" in checkerResult) {
      passed = Boolean(checkerResult.passed);
    } else if ("ok" in checkerResult) {
      passed = Boolean(checkerResult.ok);
    } else {
      passed = earned >= maxScore;
    }
    return { passed, earned, statusHtml };
  }

  if (hasExpectedAnswer) {
    passed = Boolean(checkerResult);
    earned = passed ? maxScore : 0;
  }
  return { passed, earned, statusHtml };
}

function normalizePercentScore(value, maxScore) {
  return clampScore(maxScore * Number(value || 0), maxScore);
}

function clampScore(value, maxScore) {
  return Math.max(0, Math.min(maxScore, Number(value || 0)));
}

async function readDatasetTree() {
  const sets = [];
  const entries = await fsp.readdir(DATASET_ROOT, { withFileTypes: true });
  for (const setEntry of entries) {
    if (!setEntry.isDirectory()) continue;
    const setName = setEntry.name;
    const setDir = path.join(DATASET_ROOT, setName);
    const folders = [];
    const folderEntries = await fsp.readdir(setDir, { withFileTypes: true });
    for (const folderEntry of folderEntries) {
      if (!folderEntry.isDirectory() || folderEntry.name === "assets") continue;
      const folderDir = path.join(setDir, folderEntry.name);
      const questionEntries = await fsp.readdir(folderDir, { withFileTypes: true });
      const questions = [];
      for (const item of questionEntries) {
        if (!item.isFile() || !item.name.endsWith(".json")) continue;
        const relPath = path.join(setName, folderEntry.name, item.name).replaceAll("\\", "/");
        const question = await readJsonFile(path.join(folderDir, item.name), {});
        questions.push({ type: "question", name: item.name, path: relPath, title: question.title || "", score: Number(question.score || 0) });
      }
      questions.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
      folders.push({ type: "folder", name: folderEntry.name, path: path.join(setName, folderEntry.name).replaceAll("\\", "/"), questions });
    }
    folders.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    sets.push({ type: "set", name: setName, path: setName, folders });
  }
  sets.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  return { sets };
}

async function readSettingsConfig() {
  const localSettings = await readJsonFile(API_SETTINGS_FILE, null);
  if (localSettings && Array.isArray(localSettings.presets)) {
    return localSettings;
  }
  return await readJsonFile(SETTINGS_FILE, { presets: [], activePresetId: "" });
}

async function readAllNotes() {
  const files = await fsp.readdir(NOTES_DIR, { withFileTypes: true });
  const candidates = new Map();
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== ".md" && ext !== ".json") continue;
    const id = path.basename(entry.name, ext);
    const priority = ext === ".md" ? 2 : 1;
    const current = candidates.get(id);
    if (!current || priority > current.priority) {
      candidates.set(id, { id, ext, filePath: path.join(NOTES_DIR, entry.name), priority });
    }
  }
  const list = [];
  for (const candidate of candidates.values()) {
    const note = await readNoteFromFile(candidate.filePath, candidate.ext, candidate.id);
    list.push(note || { id: candidate.id, title: candidate.id, content: "", createdAt: "", updatedAt: "", format: candidate.ext === ".md" ? "md" : "json" });
  }
  return list;
}

async function readNoteById(id) {
  const mdPath = path.join(NOTES_DIR, `${id}.md`);
  const jsonPath = path.join(NOTES_DIR, `${id}.json`);
  if (await exists(mdPath)) {
    return await readNoteFromFile(mdPath, ".md", id);
  }
  if (await exists(jsonPath)) {
    return await readNoteFromFile(jsonPath, ".json", id);
  }
  return null;
}

async function readNoteFromFile(filePath, ext, id) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    if (ext === ".json") {
      const data = JSON.parse(raw);
      return {
        id,
        title: data.title || "",
        content: data.content || "",
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
        format: "json",
      };
    }
    const parsed = parseMarkdownNote(raw);
    return {
      id,
      title: parsed.title || id,
      content: parsed.content || "",
      createdAt: parsed.createdAt || "",
      updatedAt: parsed.updatedAt || "",
      format: "md",
    };
  } catch {
    return null;
  }
}

async function writeNoteFile(note) {
  const id = sanitizeSegment(note.id || createId());
  const mdPath = path.join(NOTES_DIR, `${id}.md`);
  const jsonPath = path.join(NOTES_DIR, `${id}.json`);
  if (note.format === "json") {
    const payload = {
      id,
      title: note.title || "",
      content: note.content || "",
      createdAt: note.createdAt || "",
      updatedAt: note.updatedAt || "",
    };
    await fsp.writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
    return;
  }
  const markdown = serializeMarkdownNote(note);
  await fsp.writeFile(mdPath, markdown, "utf8");
}

async function deleteNoteFiles(id) {
  const mdPath = path.join(NOTES_DIR, `${id}.md`);
  const jsonPath = path.join(NOTES_DIR, `${id}.json`);
  if (await exists(mdPath)) await fsp.unlink(mdPath);
  if (await exists(jsonPath)) await fsp.unlink(jsonPath);
}

function parseMarkdownNote(raw) {
  const source = String(raw || "");
  if (!/^---\r?\n/.test(source)) {
    return {
      title: deriveMarkdownTitle(source),
      content: source,
      createdAt: "",
      updatedAt: "",
    };
  }
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return {
      title: deriveMarkdownTitle(source),
      content: source,
      createdAt: "",
      updatedAt: "",
    };
  }
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    meta[key] = parseFrontMatterValue(rawValue);
  }
  const content = match[2] || "";
  return {
    title: meta.title || deriveMarkdownTitle(content),
    content,
    createdAt: meta.createdAt || "",
    updatedAt: meta.updatedAt || "",
  };
}

function serializeMarkdownNote(note) {
  const lines = [
    "---",
    `title: ${JSON.stringify(String(note.title || ""))}`,
    `createdAt: ${JSON.stringify(String(note.createdAt || ""))}`,
    `updatedAt: ${JSON.stringify(String(note.updatedAt || ""))}`,
    "---",
    "",
  ];
  const content = String(note.content || "");
  return `${lines.join("\n")}${content}`;
}

function parseFrontMatterValue(value) {
  if (!value) return "";
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^['"]|['"]$/g, "");
  }
}

function deriveMarkdownTitle(content) {
  const firstHeading = String(content || "").match(/^\s*#\s+(.+)$/m);
  if (firstHeading) return firstHeading[1].trim();
  const firstLine = String(content || "").split(/\r?\n/).find((line) => line.trim());
  return firstLine ? firstLine.trim().slice(0, 80) : "";
}

function absoluteDatasetAssetUrl(assetPath) {
  return `http://127.0.0.1:15397/dataset-file/${encodeURIComponent(String(assetPath).replaceAll("\\", "/"))}`;
}

async function datasetAssetToDataUrl(assetPath) {
  const fullPath = resolveDatasetPath(assetPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mime = DATA_URL_MIME[ext] || "application/octet-stream";
  const buffer = await fsp.readFile(fullPath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function resolveDatasetPath(relPath) {
  const fullPath = path.resolve(DATASET_ROOT, String(relPath || "").replaceAll("/", path.sep));
  if (!fullPath.startsWith(DATASET_ROOT)) throw new Error("非法路径");
  return fullPath;
}

function sanitizeSegment(input) {
  return String(input || "").trim().replace(/[\\/:*?"<>|]/g, "_");
}

function sanitizeQuestionFileName(input) {
  const base = sanitizeSegment(input).replace(/\.json$/i, "");
  return `${base || "问题1"}.json`;
}

function sanitizeAssetFileName(input) {
  return sanitizeSegment(input);
}

function sanitizeSimpleName(input) {
  return String(input || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("请求体过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function respondJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function respondText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
