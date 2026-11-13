// ==UserScript==
// @name         Wikipedia LaTeX Copy & View
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Adds a blue square beside Wikipedia math formulas to toggle and copy the raw LaTeX source.
// @match        *://*.wikipedia.org/*
// @match        *://*.wikimedia.org/*
// @match        *://*.wikibooks.org/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        .wp-latex-btn {
            display: inline-block !important;
            width: 10px !important;
            height: 10px !important;
            background-color: #3366cc !important;
            border: 1px solid #1e428a !important;
            border-radius: 2px !important;
            margin: 0 3px 0 4px !important;
            vertical-align: middle !important;
            cursor: pointer !important;
            opacity: 0.75 !important;
            box-sizing: border-box !important;
            transition: opacity 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
        }
        .wp-latex-btn:hover {
            opacity: 1 !important;
            transform: scale(1.2);
        }
        .wp-latex-btn.copied {
            background-color: #14866d !important;
            border-color: #0d5c4b !important;
        }
        .wp-latex-box {
            display: none;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.85em;
            background-color: #f8f9fa;
            color: #202122;
            border: 1px solid #a2a9b1;
            border-radius: 3px;
            padding: 2px 6px;
            margin-left: 4px;
            vertical-align: middle;
            user-select: all;
            white-space: pre-wrap;
        }
        .wp-latex-box.visible {
            display: inline-block;
        }
        html.skin-theme-clientpref-night .wp-latex-box {
            background-color: #27292d;
            color: #eaecf0;
            border-color: #54595d;
        }
    `;
    (document.head || document.documentElement).appendChild(style);

    function cleanLatex(raw) {
        if (!raw) return '';
        let tex = raw.trim();
        const match = tex.match(/^\{\\displaystyle\s+([\s\S]*)\}$/);
        if (match) {
            tex = match[1].trim();
        }
        return tex;
    }

    function extractLatex(el) {
        // 1. Parsoid / modern MediaWiki data-mw JSON attribute (body.extsrc)
        const dataMw = el.getAttribute('data-mw');
        if (dataMw) {
            try {
                const parsed = JSON.parse(dataMw);
                if (parsed?.body?.extsrc) {
                    return cleanLatex(parsed.body.extsrc);
                }
            } catch (e) {}
        }

        // 2. MathML annotation (legacy MediaWiki SVG/MathML output)
        const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation && annotation.textContent) {
            return cleanLatex(annotation.textContent);
        }

        // 3. Fallback image alt attribute
        const img = el.querySelector('img[alt]');
        if (img && img.alt) {
            return cleanLatex(img.alt);
        }

        // 4. MathML alttext attribute
        const math = el.tagName.toLowerCase() === 'math' ? el : el.querySelector('math[alttext]');
        if (math && math.getAttribute('alttext')) {
            return cleanLatex(math.getAttribute('alttext'));
        }

        return null;
    }

    function processMathElements() {
        const candidates = document.querySelectorAll(
            '.mwe-math-element:not([data-latex-processed]), ' +
            'mjx-container:not([data-latex-processed]), ' +
            'math:not([data-latex-processed])'
        );

        candidates.forEach(el => {
            if (el.closest('[data-latex-processed]')) return;

            el.setAttribute('data-latex-processed', 'true');
            const latex = extractLatex(el);
            if (!latex) return;

            const btn = document.createElement('span');
            btn.className = 'wp-latex-btn';
            btn.title = 'Click to toggle LaTeX & copy to clipboard';

            const codeBox = document.createElement('code');
            codeBox.className = 'wp-latex-box';
            codeBox.textContent = latex;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isShowing = codeBox.classList.toggle('visible');

                if (isShowing && navigator.clipboard) {
                    navigator.clipboard.writeText(latex).then(() => {
                        btn.classList.add('copied');
                        setTimeout(() => btn.classList.remove('copied'), 800);
                    }).catch(() => {});
                }
            });

            el.insertAdjacentElement('afterend', codeBox);
            el.insertAdjacentElement('afterend', btn);
        });
    }

    processMathElements();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                processMathElements();
                break;
            }
        }
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
