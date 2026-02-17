/**
 * Markdown + HTML rendering using marked.js and DOMPurify.
 * Both are loaded as local scripts.
 *
 * HTML code blocks (```html with full page content) get a
 * "Preview" button that renders the code in an iframe via
 * a server-side preview endpoint (avoids Chrome sandbox issues).
 */

// Globals from local scripts
declare var marked: { parse: (src: string) => string };
declare var DOMPurify: { sanitize: (html: string, config?: Record<string, unknown>) => string };

/**
 * Check if a string looks like a full HTML page.
 */
function looksLikeHtmlPage(code: string): boolean {
    var trimmed = code.trim().toLowerCase();
    return trimmed.indexOf("<!doctype") === 0
        || trimmed.indexOf("<html") === 0
        || (trimmed.indexOf("<head") !== -1 && trimmed.indexOf("<body") !== -1);
}

/**
 * Extract HTML code blocks from markdown text before rendering.
 */
function extractHtmlBlocks(text: string): { text: string; blocks: Record<string, string> } {
    var blocks: Record<string, string> = {};
    var counter = 0;

    var result = text.replace(/```(?:html|HTML)?\s*\n([\s\S]*?)```/g, function (match: string, code: string) {
        if (looksLikeHtmlPage(code)) {
            var id = "___HTML_PREVIEW_" + counter + "___";
            counter++;
            blocks[id] = code;
            return '\n<div data-html-preview="' + id + '"></div>\n';
        }
        return match;
    });

    return { text: result, blocks: blocks };
}

/**
 * Render markdown and return both HTML and the extracted blocks.
 */
export function renderMarkdownWithBlocks(text: string): { html: string; blocks: Record<string, string> } {
    if (!text) {
        return { html: "", blocks: {} };
    }

    var extracted = extractHtmlBlocks(text);
    var rawHtml = marked.parse(extracted.text);

    var cleanHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ["iframe", "video", "audio", "source", "details", "summary", "div"],
        ADD_ATTR: [
            "allow", "allowfullscreen", "frameborder", "scrolling",
            "src", "srcdoc", "width", "height", "controls", "autoplay",
            "loop", "muted", "poster", "preload", "sandbox", "type",
            "target", "rel", "open", "data-html-preview",
        ],
        ALLOW_DATA_ATTR: true,
    });

    return { html: cleanHtml, blocks: extracted.blocks };
}

/**
 * Upload HTML to server and get a preview URL back.
 * This avoids all Chrome iframe sandbox/blob issues.
 */
function getPreviewUrl(htmlCode: string, callback: (url: string | null) => void): void {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/preview", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    callback("/api/preview/" + data.id);
                } catch (e) {
                    callback(null);
                }
            } else {
                callback(null);
            }
        }
    };
    xhr.send(JSON.stringify({ html: htmlCode }));
}

/**
 * Create an iframe preview widget with toolbar.
 */
function createPreviewWidget(htmlCode: string): HTMLElement {
    var wrapper = document.createElement("div");
    wrapper.className = "html-preview-wrapper";

    // Toolbar
    var toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";

    var previewBtn = document.createElement("button");
    previewBtn.className = "code-toolbar-btn preview-btn";
    previewBtn.textContent = "▶ Preview";

    var copyCodeBtn = document.createElement("button");
    copyCodeBtn.className = "code-toolbar-btn";
    copyCodeBtn.textContent = "Copy Code";

    var toggleCodeBtn = document.createElement("button");
    toggleCodeBtn.className = "code-toolbar-btn";
    toggleCodeBtn.textContent = "Show Code";

    toolbar.appendChild(previewBtn);
    toolbar.appendChild(copyCodeBtn);
    toolbar.appendChild(toggleCodeBtn);
    wrapper.appendChild(toolbar);

    // Code block (hidden by default)
    var pre = document.createElement("pre");
    pre.style.display = "none";
    var codeEl = document.createElement("code");
    codeEl.textContent = htmlCode;
    pre.appendChild(codeEl);
    wrapper.appendChild(pre);

    // Preview container
    var previewContainer = document.createElement("div");
    previewContainer.className = "html-preview-container";
    previewContainer.style.display = "none";
    wrapper.appendChild(previewContainer);

    // Wire up buttons
    (function (code: string, container: HTMLElement, prevBtn: HTMLButtonElement, cpBtn: HTMLButtonElement, togBtn: HTMLButtonElement, preBlock: HTMLElement) {
        var previewing = false;
        var codeVisible = false;

        prevBtn.addEventListener("click", function () {
            if (!previewing) {
                prevBtn.textContent = "Loading...";
                prevBtn.disabled = true;

                getPreviewUrl(code, function (url) {
                    if (!url) {
                        prevBtn.textContent = "▶ Preview";
                        prevBtn.disabled = false;
                        return;
                    }

                    container.innerHTML = "";
                    var iframe = document.createElement("iframe");
                    iframe.className = "html-preview-iframe";
                    iframe.src = url;
                    container.appendChild(iframe);
                    container.style.display = "block";
                    prevBtn.textContent = "✕ Close";
                    prevBtn.disabled = false;
                    prevBtn.classList.add("active");
                    previewing = true;

                    iframe.addEventListener("load", function () {
                        // Wait for scripts (like Chart.js) to execute
                        setTimeout(function () {
                            try {
                                var doc = iframe.contentDocument || iframe.contentWindow!.document;
                                if (doc && doc.body) {
                                    var h = doc.body.scrollHeight + 20;
                                    if (h < 100) h = 200;
                                    if (h > 600) h = 600;
                                    iframe.style.height = h + "px";
                                }
                            } catch (e) {
                                iframe.style.height = "400px";
                            }
                        }, 800);
                    });
                });
            } else {
                container.innerHTML = "";
                container.style.display = "none";
                prevBtn.textContent = "▶ Preview";
                prevBtn.classList.remove("active");
                previewing = false;
            }
        });

        cpBtn.addEventListener("click", function () {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(code).catch(function () {});
            }
            cpBtn.textContent = "Copied!";
            setTimeout(function () { cpBtn.textContent = "Copy Code"; }, 1500);
        });

        togBtn.addEventListener("click", function () {
            codeVisible = !codeVisible;
            preBlock.style.display = codeVisible ? "block" : "none";
            togBtn.textContent = codeVisible ? "Hide Code" : "Show Code";
        });
    })(htmlCode, previewContainer, previewBtn as HTMLButtonElement, copyCodeBtn as HTMLButtonElement, toggleCodeBtn as HTMLButtonElement, pre);

    return wrapper;
}

/**
 * After a message body element is rendered, find placeholder divs
 * and replace them with preview widgets. Also scan for any remaining
 * code blocks that look like full HTML pages.
 */
export function attachHtmlPreviews(bodyEl: HTMLElement, blocks: Record<string, string>): void {
    // Handle extracted placeholders
    var placeholders = bodyEl.querySelectorAll("[data-html-preview]");
    for (var i = 0; i < placeholders.length; i++) {
        var placeholder = placeholders[i] as HTMLElement;
        var id = placeholder.getAttribute("data-html-preview") || "";
        var code = blocks[id];
        if (!code) {
            continue;
        }
        var widget = createPreviewWidget(code);
        placeholder.parentNode!.replaceChild(widget, placeholder);
    }

    // Fallback: scan code blocks for HTML pages not caught by regex
    var codeBlocks = bodyEl.querySelectorAll("pre code");
    for (var j = 0; j < codeBlocks.length; j++) {
        var codeBlock = codeBlocks[j] as HTMLElement;
        var rawCode = codeBlock.textContent || "";
        if (!looksLikeHtmlPage(rawCode)) {
            continue;
        }
        var parentPre = codeBlock.parentElement;
        if (!parentPre) {
            continue;
        }
        // Skip if already wrapped
        if (parentPre.parentElement && parentPre.parentElement.classList.contains("html-preview-wrapper")) {
            continue;
        }

        var fallbackWidget = createPreviewWidget(rawCode);
        parentPre.parentNode!.replaceChild(fallbackWidget, parentPre);
    }
}
