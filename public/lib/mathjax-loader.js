(function () {
  function renderMathInElement(element) {
    if (!window.katex) return;
    const walker = document.createTreeWalker(element || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_SKIP;
        if (parent.closest("code, pre, script, style, textarea, .katex, .math")) return NodeFilter.FILTER_REJECT;
        return /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/.test(node.textContent)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const text = node.textContent;
      const frag = document.createDocumentFragment();
      const re = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
      let last = 0;
      for (const match of text.matchAll(re)) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        const raw = match[0];
        const display = raw.startsWith("$$") || raw.startsWith("\\[");
        const formula = raw.replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\\\(|\\\)$|^\$|\$$/g, "");
        try {
          const el = document.createElement(display ? "div" : "span");
          el.className = display ? "math math-display" : "math math-inline";
          katex.render(formula, el, { displayMode: display, throwOnError: false });
          frag.appendChild(el);
        } catch (e) {
          const span = document.createElement("span");
          span.className = "math math-error";
          span.textContent = raw;
          frag.appendChild(span);
        }
        last = match.index + raw.length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(frag);
    });
  }

  window.MathJax = window.MathJax || {};
  window.MathJax.typesetPromise = function (elements) {
    (elements && elements.length ? elements : [document.body]).forEach(renderMathInElement);
    return Promise.resolve();
  };

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/lib/katex.min.css";
  document.head.appendChild(link);

  const script = document.createElement("script");
  script.src = "/lib/katex.min.js";
  script.async = true;
  document.head.appendChild(script);
})();