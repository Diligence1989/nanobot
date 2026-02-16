/**
 * Markdown + HTML rendering using marked.js and DOMPurify.
 * Both are loaded via CDN as global scripts.
 *
 * After rendering, HTML code blocks get a "Preview" button
 * that renders the code in a sandboxed iframe.
 */

// Globals from CDN
declare var marked: { parse: (src: string) => string };
declare var DOMPurify: { sanitize: (html: string, config?: Record<string, unknown>) => string };

/**
 * Render markdown content to safe HTML.
 */
export function renderMarkdown(text: string): string {
    if (!text) {
        return "";
    }

    var rawHtml = marked.parse(text);

    var cleanHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ["iframe", "video", "audio", "source", "details", "summary"],
        ADD_ATTR: [
            "allow", "allowfullscreen", "frameborder", "scrolling",
            "src", "srcdoc", "width", "height", "controls", "autoplay",
            "loop", "muted", "poster", "preload", "sandbox", "type",
            "target", "rel", "open",
        ],
        ALLOW_DATA_ATTR: false,
    });

    return cleanHtml;
}

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
 * After a message body element is rendered, scan its code blocks
 * and attach preview buttons for HTML content.
 */
export function attachHtmlPreviews(bodyEl: HTMLElement): void {
    var codeBlocks = bodyEl.querySelectorAll("pre code");
    for (var i = 0; i < codeBlocks.length; i++) {
        var codeEl = codeBlocks[i] as HTMLElement;
        var rawCode = codeEl.textContent || "";

        if (!looksLikeHtmlPage(rawCode)) {
            continue;
        }

        var preEl = codeEl.parentElement;
        if (!preEl) {
            continue;
        }

        // Wrap the pre in a container
        var wrapper = document.createElement("div");
        wrapper.className = "html-preview-wrapper";
        preEl.parentNode!.insertBefore(wrapper, preEl);
        wrapper.appendChild(preEl);

        // Toolbar with Preview / Copy buttons
        var toolbar = document.createElement("div");
        toolbar.className = "code-toolbar";

        var previewBtn = document.createElement("button");
        previewBtn.className = "code-toolbar-btn preview-btn";
        previewBtn.textContent = "▶ Preview";

        var copyCodeBtn = document.createElement("button");
        copyCodeBtn.className = "code-toolbar-btn";
        copyCodeBtn.textContent = "Copy";

        toolbar.appendChild(previewBtn);
        toolbar.appendChild(copyCodeBtn);
        wrapper.insertBefore(toolbar, preEl);

        // Preview iframe container (hidden initially)
        var previewContainer = document.createElement("div");
        previewContainer.className = "html-preview-container";
        previewContainer.style.display = "none";
        wrapper.appendChild(previewContainer);

        // Wire up buttons with closures
        (function (code: string, container: HTMLElement, btn: HTMLButtonElement, copyBtn: HTMLButtonElement) {
            var showing = false;
            var blobUrl: string | null = null;

            btn.addEventListener("click", function () {
                if (!showing) {
                    container.innerHTML = "";

                    // Use Blob URL instead of srcdoc for Chrome compatibility
                    var blob = new Blob([code], { type: "text/html; charset=utf-8" });
                    blobUrl = URL.createObjectURL(blob);

                    var iframe = document.createElement("iframe");
                    iframe.className = "html-preview-iframe";
                    iframe.src = blobUrl;
                    container.appendChild(iframe);
                    container.style.display = "block";
                    btn.textContent = "✕ Close Preview";
                    btn.classList.add("active");
                    showing = true;

                    // Auto-resize iframe after content loads
                    iframe.addEventListener("load", function () {
                        try {
                            var doc = iframe.contentDocument;
                            if (doc && doc.body) {
                                var h = doc.body.scrollHeight + 20;
                                if (h < 100) h = 200;
                                if (h > 600) h = 600;
                                iframe.style.height = h + "px";
                            }
                        } catch (e) {
                            iframe.style.height = "400px";
                        }
                    });
                } else {
                    container.innerHTML = "";
                    container.style.display = "none";
                    if (blobUrl) {
                        URL.revokeObjectURL(blobUrl);
                        blobUrl = null;
                    }
                    btn.textContent = "▶ Preview";
                    btn.classList.remove("active");
                    showing = false;
                }
            });

            copyBtn.addEventListener("click", function () {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(code).catch(function () {});
                }
                copyBtn.textContent = "Copied!";
                setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500);
            });
        })(rawCode, previewContainer, previewBtn as HTMLButtonElement, copyCodeBtn as HTMLButtonElement);
    }
}
