(function () {
  window.MathJax = window.MathJax || {
    tex: {
      inlineMath: [["$", "$"], ["\\(", "\\)"]],
      displayMath: [["$$", "$$"], ["\\[", "\\]"]],
    },
  };

  function fallbackTypeset(root) {
    const scope = root || document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("code, pre, script, style, textarea, .math")) return NodeFilter.FILTER_REJECT;
        return /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/.test(node.textContent)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.textContent;
      const frag = document.createDocumentFragment();
      const re = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
      let last = 0;
      for (const match of text.matchAll(re)) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        const raw = match[0];
        const display = raw.startsWith("$$") || raw.startsWith("\\[");
        const el = document.createElement(display ? "div" : "span");
        el.className = display ? "math math-display" : "math math-inline";
        el.textContent = raw.replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\\\(|\\\)$|^\$|\$$/g, "");
        frag.appendChild(el);
        last = match.index + raw.length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(frag);
    });
  }

  if (!window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise = function (elements) {
      (elements && elements.length ? elements : [document.body]).forEach(fallbackTypeset);
      return Promise.resolve();
    };
  }

  const script = document.createElement("script");
  script.src = "/lib/mathjax/tex-chtml.js";
  script.async = true;
  script.onerror = function () {};
  document.head.appendChild(script);
})();
