function renderMessageBubble(role, content, reasoning = "") {
  const div = document.createElement("div");
  div.className = `message-bubble message-${role}`;
  if (role === "assistant") {
    div.innerHTML = renderAssistantAnswer(content || "", reasoning);
    queueMathTypeset(div);
    return div;
  }
  div.innerHTML = renderMarkdown(content || "");
  queueMathTypeset(div);
  return div;
}

function renderAssistantAnswer(answer, reasoning = "") {
  const thinkMatch = answer.match(/<think>([\s\S]*?)<\/think>/i);
  let visible = answer;
  if (thinkMatch) {
    visible = answer.replace(thinkMatch[0], "").trim();
  }
  return renderMarkdown(visible);
}

//渲染调整，ai你不写注释就算了，别删好吧
function renderMarkdown(source) {
  if (!source) return "";
  const md = typeof marked !== 'undefined' ? marked : window.marked;
  const hl = typeof hljs !== 'undefined' ? hljs : window.hljs;
  //const renderer = new md.Renderer();
  //renderer.paragraph = (data) => {
  //  return "<br>" + "<p>" + marked.parseInline(data.raw) + "</p>";
  //};

  const html = md.parse(source, {
    gfm: true,        // 使用 GitHub Flavored Markdown (GFM)
    breaks: true,     // 转换换行符为 <br> 标签
    pedantic: false,  // 不遵守原始的 Markdown 标准
    sanitize: false,  // 不对输出进行清理/转义（默认情况下会转义 HTML）
    smartLists: true, // 使用智能列表识别（例如正确的缩进）
    smartypants: false, // 不使用智能引号处理
    //renderer: renderer
  });

  return enhanceCodeBlocks(html, hl);
}

function queueMathTypeset(element) {
  if (!window.MathJax?.typesetPromise) return;
  requestAnimationFrame(() => window.MathJax.typesetPromise([element]).catch(() => {}));
}

function enhanceCodeBlocks(html, hljsLib) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const hljs = hljsLib || window.hljs;
  const totalLinesMap = {};

  tempDiv.querySelectorAll("pre code").forEach((codeBlock, idx) => {
    const pre = codeBlock.parentElement;
    if (!pre || pre.parentElement.classList.contains("code-block-wrapper")) return;

    const langMatch = codeBlock.className.match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : "";
    const code = codeBlock.textContent;
    const lines = code.split("\n");
    const lineCount = lines.length;
    const needsCollapse = lineCount > 10;
    totalLinesMap["block_" + idx] = lineCount;

    let highlightedCode = code;
    try {
      if (lang && hljs.getLanguage(lang)) {
        highlightedCode = hljs.highlight(code, { language: lang }).value;
      } else {
        highlightedCode = hljs.highlightAuto(code).value;
      }
    } catch (e) {
      highlightedCode = escapeHtml(code);
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-block-header";

    if (lang) {
      const langSpan = document.createElement("span");
      langSpan.className = "code-lang";
      langSpan.textContent = lang;
      header.appendChild(langSpan);
    }

    const actions = document.createElement("div");
    actions.className = "code-block-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "code-action-btn copy-btn";
    copyBtn.textContent = "复制";
    copyBtn.setAttribute("data-copy", code);
    actions.appendChild(copyBtn);

    if (lang === "html" || lang === "xml") {
      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "code-action-btn preview-btn";
      previewBtn.textContent = "浏览";
      previewBtn.setAttribute("data-preview", code);
      actions.appendChild(previewBtn);
    }

    header.appendChild(actions);

    const codeContent = document.createElement("code");
    codeContent.className = codeBlock.className;
    codeContent.innerHTML = highlightedCode;

    const preElement = document.createElement("pre");
    preElement.appendChild(codeContent);

    if (needsCollapse) {
      const collapseWrapper = document.createElement("div");
      collapseWrapper.className = "code-collapse-wrapper";

      const visibleLinesArr = highlightedCode.split("\n").slice(0, 10);
      const hiddenLinesArr = highlightedCode.split("\n").slice(10);

      const visibleCode = document.createElement("code");
      visibleCode.className = codeBlock.className;
      visibleCode.innerHTML = visibleLinesArr.join("\n") + "\n";

      const visiblePre = document.createElement("pre");
      visiblePre.appendChild(visibleCode);

      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "code-expand-btn";
      expandBtn.setAttribute("data-lines", lineCount);
      expandBtn.textContent = `展开全部 (${lineCount} 行)`;

      collapseWrapper.appendChild(visiblePre);
      if (hiddenLinesArr.length > 0) {
        const hiddenPre = document.createElement("pre");
        hiddenPre.className = "code-hidden-block";
        hiddenPre.style.display = "none";
        const hiddenCode = document.createElement("code");
        hiddenCode.className = codeBlock.className;
        hiddenCode.innerHTML = hiddenLinesArr.join("\n");
        hiddenPre.appendChild(hiddenCode);
        collapseWrapper.appendChild(hiddenPre);
      }
      collapseWrapper.appendChild(expandBtn);

      pre.replaceWith(wrapper);
      wrapper.appendChild(header);
      wrapper.appendChild(collapseWrapper);
    } else {
      pre.replaceWith(wrapper);
      wrapper.appendChild(header);
      wrapper.appendChild(preElement);
    }
  });

  Array.from(tempDiv.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === "") {
      tempDiv.removeChild(node);
    }
  });

  return tempDiv.innerHTML;
}

function escapeHtml(text) {
  return String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function handleDocumentClick(e) {
  const btn = e.target.closest(".code-action-btn");
  if (btn) {
    if (btn.classList.contains("copy-btn")) {
      const code = btn.getAttribute("data-copy");
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "已复制";
        setTimeout(() => btn.textContent = "复制", 2000);
      }).catch(() => { btn.textContent = "复制失败"; });
    } else if (btn.classList.contains("preview-btn")) {
      const code = btn.getAttribute("data-preview");
      openHtmlModal(code);
    }
    return;
  }

  const expandBtn = e.target.closest(".code-expand-btn");
  if (!expandBtn) return;

  const lineCount = expandBtn.getAttribute("data-lines");
  const wrapper = expandBtn.parentElement;
  const hidden = wrapper?.querySelector(".code-hidden-block");
  if (!wrapper || !hidden) return;

  if (wrapper.classList.contains("expanded")) {
    wrapper.classList.remove("expanded");
    hidden.style.display = "none";
    expandBtn.textContent = `展开全部 (${lineCount} 行)`;
  } else {
    wrapper.classList.add("expanded");
    hidden.style.display = "block";
    expandBtn.textContent = "收起";
  }
}

function openHtmlModal(code) {
  const modalOverlay = document.getElementById("modal-overlay");
  const modalBody = document.getElementById("modal-body");
  if (!modalOverlay || !modalBody) {
    const w = window.open("", "_blank");
    w.document.write(code);
    w.document.close();
    return;
  }
  modalBody.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.className = "modal-webview";
  iframe.srcdoc = code;
  modalBody.appendChild(iframe);
  modalOverlay.style.display = "flex";
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) modalOverlay.style.display = "none";
  };
}
