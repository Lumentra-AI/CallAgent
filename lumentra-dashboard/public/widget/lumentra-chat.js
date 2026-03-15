/**
 * Lumentra Chat Widget
 * Embeddable chat widget for customer websites
 *
 * Usage:
 * <script src="https://app.lumentra.ai/widget/lumentra-chat.js"></script>
 * <script>
 *   new LumentraChat({ tenantId: 'YOUR_TENANT_ID' });
 * </script>
 */

(function () {
  "use strict";

  const WIDGET_VERSION = "1.0.0";
  const DEFAULT_API_URL = "https://api.lumentraai.com";

  class LumentraChat {
    constructor(config) {
      if (!config || !config.tenantId) {
        console.error("[LumentraChat] tenantId is required");
        return;
      }

      this.tenantId = config.tenantId;
      this.apiUrl = config.apiUrl || DEFAULT_API_URL;
      this.position = config.position || "bottom-right";
      this.sessionId = this.loadOrCreateSession();
      this.isOpen = false;
      this.isLoading = false;
      this.config = null;
      this.visitorInfo = {};

      this.init();
    }

    async init() {
      try {
        // Fetch widget configuration
        const response = await fetch(
          `${this.apiUrl}/api/chat/config/${this.tenantId}`,
        );

        // If 404, widget is disabled for this tenant - silently exit
        if (response.status === 404) {
          console.log("[LumentraChat] Widget not enabled for this tenant");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load chat configuration");
        }
        this.config = await response.json();

        // Server config overrides constructor defaults
        if (this.config.position) {
          this.position = this.config.position;
        }

        // Inject styles
        this.injectStyles();

        // Create widget DOM
        this.createWidget();

        // Restore previous messages or show greeting
        const restored = await this.restoreHistory();
        if (!restored) {
          this.addMessage("assistant", this.config.greeting);
        }

        console.log(`[LumentraChat] Widget initialized v${WIDGET_VERSION}`);
      } catch (err) {
        console.error("[LumentraChat] Initialization failed:", err);
      }
    }

    loadOrCreateSession() {
      const storageKey = "lumentra_sid_" + this.tenantId;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.expires > Date.now()) {
            return parsed.id;
          }
        }
      } catch (e) {
        // localStorage unavailable or corrupt
      }
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "chat_" +
            Date.now().toString(36) +
            Math.random().toString(36).substr(2, 9);
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ id, expires: Date.now() + 24 * 60 * 60 * 1000 }),
        );
      } catch (e) {
        // localStorage full or unavailable
      }
      return id;
    }

    injectStyles() {
      if (document.getElementById("lumentra-chat-styles")) return;

      const style = document.createElement("style");
      style.id = "lumentra-chat-styles";
      style.textContent = `
        .lumentra-chat-button {
          position: fixed;
          ${this.position.includes("right") ? "right: 20px" : "left: 20px"};
          ${this.position.includes("bottom") ? "bottom: 20px" : "top: 20px"};
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${this.config?.theme_color || "#6366f1"};
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
          z-index: 999998;
        }
        .lumentra-chat-button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
        .lumentra-chat-button svg {
          width: 28px;
          height: 28px;
        }
        .lumentra-chat-container {
          position: fixed;
          ${this.position.includes("right") ? "right: 20px" : "left: 20px"};
          ${this.position.includes("bottom") ? "bottom: 90px" : "top: 90px"};
          width: 380px;
          max-width: calc(100vw - 40px);
          height: 520px;
          max-height: calc(100vh - 120px);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          transition: opacity 0.2s, transform 0.2s;
        }
        .lumentra-chat-container.hidden {
          opacity: 0;
          transform: translateY(20px);
          pointer-events: none;
        }
        .lumentra-chat-header {
          padding: 16px;
          background: ${this.config?.theme_color || "#6366f1"};
          border-bottom: 1px solid rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lumentra-chat-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .lumentra-chat-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${this.config?.theme_color || "#6366f1"};
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 16px;
        }
        .lumentra-chat-name {
          color: #ffffff;
          font-weight: 600;
          font-size: 15px;
        }
        .lumentra-chat-status {
          color: rgba(255,255,255,0.8);
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .lumentra-chat-status::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
        }
        .lumentra-chat-close {
          background: none;
          border: none;
          color: rgba(255,255,255,0.8);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 20px;
          transition: background 0.2s;
        }
        .lumentra-chat-close:hover {
          background: rgba(255,255,255,0.15);
          color: #ffffff;
        }
        .lumentra-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .lumentra-message {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          animation: lumentra-fade-in 0.2s ease;
        }
        @keyframes lumentra-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lumentra-message.user {
          align-self: flex-end;
          background: ${this.config?.theme_color || "#6366f1"};
          color: white;
          border-bottom-right-radius: 4px;
        }
        .lumentra-message.assistant {
          align-self: flex-start;
          background: #f4f4f5;
          color: #18181b;
          border-bottom-left-radius: 4px;
          border-left: 2px solid ${this.config?.theme_color || "#6366f1"};
        }
        .lumentra-message.assistant a {
          color: ${this.config?.theme_color || "#6366f1"};
        }
        .lumentra-message.assistant strong {
          font-weight: 600;
        }
        .lumentra-message.assistant ul {
          margin: 4px 0;
          padding-left: 16px;
        }
        .lumentra-message.assistant code {
          background: #e4e4e7;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 13px;
        }
        /* No typing indicator -- SSE streaming text IS the feedback */
        .lumentra-chat-input-container {
          padding: 12px 16px;
          background: #ffffff;
          border-top: 1px solid #e4e4e7;
          display: flex;
          gap: 8px;
        }
        .lumentra-chat-input {
          flex: 1;
          padding: 10px 14px;
          background: #f4f4f5;
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          color: #18181b;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .lumentra-chat-input:focus {
          border-color: ${this.config?.theme_color || "#6366f1"};
        }
        .lumentra-chat-input::placeholder {
          color: #71717a;
        }
        .lumentra-chat-send {
          padding: 10px 16px;
          background: ${this.config?.theme_color || "#6366f1"};
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .lumentra-chat-send:hover {
          opacity: 0.9;
        }
        .lumentra-chat-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .lumentra-chat-footer {
          padding: 8px;
          text-align: center;
          font-size: 11px;
          color: #52525b;
        }
        .lumentra-chat-footer a {
          color: #71717a;
          text-decoration: none;
        }
        .lumentra-chat-footer a:hover {
          color: #a1a1aa;
        }
        @media (max-width: 480px) {
          .lumentra-chat-container {
            width: calc(100vw - 20px);
            height: calc(100vh - 100px);
            right: 10px;
            left: 10px;
            bottom: 80px;
            border-radius: 12px;
          }
          .lumentra-chat-button {
            right: 10px;
            bottom: 10px;
            width: 56px;
            height: 56px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    createWidget() {
      // Create floating button
      const button = document.createElement("button");
      button.className = "lumentra-chat-button";
      button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      button.onclick = () => this.toggle();
      button.setAttribute("aria-label", "Open chat");

      // Create chat container
      const container = document.createElement("div");
      container.className = "lumentra-chat-container hidden";
      container.setAttribute("role", "dialog");
      container.setAttribute(
        "aria-label",
        `Chat with ${this.config?.agent_name || "Assistant"}`,
      );
      container.innerHTML = `
        <div class="lumentra-chat-header">
          <div class="lumentra-chat-header-info">
            <div class="lumentra-chat-avatar">${(this.config?.agent_name || "A").charAt(0).toUpperCase()}</div>
            <div>
              <div class="lumentra-chat-name">${this.config?.agent_name || "Assistant"}</div>
              <div class="lumentra-chat-status">Online</div>
            </div>
          </div>
          <button class="lumentra-chat-close" aria-label="Close chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="lumentra-chat-messages" id="lumentra-messages" aria-live="polite"></div>
        <div class="lumentra-chat-input-container">
          <input
            type="text"
            class="lumentra-chat-input"
            id="lumentra-input"
            placeholder="Type a message..."
            autocomplete="off"
          />
          <button class="lumentra-chat-send" id="lumentra-send">Send</button>
        </div>
        <div class="lumentra-chat-footer">
          Powered by <a href="https://lumentra.ai" target="_blank" rel="noopener">Lumentra</a>
        </div>
      `;

      document.body.appendChild(button);
      document.body.appendChild(container);

      // Store references
      this.button = button;
      this.container = container;
      this.messagesContainer = container.querySelector("#lumentra-messages");
      this.input = container.querySelector("#lumentra-input");
      this.sendButton = container.querySelector("#lumentra-send");

      // Event listeners
      container.querySelector(".lumentra-chat-close").onclick = () =>
        this.toggle();
      this.sendButton.onclick = () => this.sendMessage();
      this.input.onkeypress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      };
    }

    toggle() {
      this.isOpen = !this.isOpen;
      this.container.classList.toggle("hidden", !this.isOpen);

      if (this.isOpen) {
        this.input.focus();
      }
    }

    // Lightweight markdown: bold, italic, code, bullets, links. XSS-safe.
    renderMarkdown(text) {
      // Escape HTML first
      let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      // Bold
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      // Italic
      html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
      // Inline code
      html = html.replace(/`(.+?)`/g, "<code>$1</code>");
      // Links
      html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>',
      );
      // Bullet lists (lines starting with - or *)
      html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
      if (html.includes("<li>")) {
        html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
      }
      // Line breaks
      html = html.replace(/\n/g, "<br>");
      return html;
    }

    addMessage(role, content, useMarkdown) {
      if (!content || !content.trim()) return;
      const div = document.createElement("div");
      div.className = `lumentra-message ${role}`;
      if (role === "assistant" && useMarkdown !== false) {
        div.innerHTML = this.renderMarkdown(content);
      } else {
        div.textContent = content;
      }
      this.messagesContainer.appendChild(div);
      this.scrollToBottom();
      return div;
    }

    // Create an empty AI message bubble for streaming
    createStreamBubble() {
      const div = document.createElement("div");
      div.className = "lumentra-message assistant";
      div.textContent = "";
      this.messagesContainer.appendChild(div);
      this.scrollToBottom();
      return div;
    }

    scrollToBottom() {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async restoreHistory() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(
          `${this.apiUrl}/api/chat/history/${encodeURIComponent(this.sessionId)}?tenant_id=${encodeURIComponent(this.tenantId)}`,
          { signal: controller.signal },
        );
        clearTimeout(timeout);
        if (!res.ok) return false;
        const data = await res.json();
        if (!data.messages || data.messages.length === 0) return false;
        for (const msg of data.messages) {
          if (msg.role === "user" || msg.role === "assistant") {
            this.addMessage(msg.role, msg.content);
          }
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    async sendMessage() {
      const message = this.input.value.trim();
      if (!message || this.isLoading) return;

      this.input.value = "";
      this.addMessage("user", message, false);

      this.isLoading = true;
      this.sendButton.disabled = true;
      this.input.disabled = true;

      // Create empty bubble for streaming
      const bubble = this.createStreamBubble();
      let fullText = "";

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);

        const response = await fetch(`${this.apiUrl}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            tenant_id: this.tenantId,
            session_id: this.sessionId,
            message: message,
            visitor_info:
              Object.keys(this.visitorInfo).length > 0
                ? this.visitorInfo
                : undefined,
            source_url: window.location.href,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        clearTimeout(timeout);

        if (!response.ok) {
          let errData;
          try {
            errData = await response.json();
          } catch {
            errData = {};
          }
          bubble.textContent =
            errData.error || "Sorry, something went wrong. Please try again.";
          return;
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                if (eventType === "token" && data.text) {
                  fullText += data.text;
                  bubble.textContent = fullText;
                  this.scrollToBottom();
                } else if (eventType === "tool_start") {
                  bubble.textContent = fullText || "Looking that up for you...";
                } else if (eventType === "tool_result") {
                  if (
                    data.tool === "collect_contact_info" &&
                    data.result?.info
                  ) {
                    this.visitorInfo = {
                      ...this.visitorInfo,
                      ...data.result.info,
                    };
                  }
                } else if (eventType === "done") {
                  fullText = data.full_response || fullText;
                  // Apply markdown on final text
                  bubble.innerHTML = this.renderMarkdown(fullText);
                  this.scrollToBottom();
                } else if (eventType === "error") {
                  bubble.textContent =
                    data.message ||
                    "Sorry, something went wrong. Please try again.";
                }
              } catch {
                // Skip malformed JSON
              }
              eventType = "";
            }
          }
        }

        // Fallback: if no done event received, render what we have
        if (fullText && !bubble.innerHTML.includes("<")) {
          bubble.innerHTML = this.renderMarkdown(fullText);
        }
      } catch (err) {
        const msg =
          err.name === "AbortError"
            ? "The request took too long. Please try again."
            : "Sorry, I'm having trouble connecting. Please try again.";
        bubble.textContent = fullText || msg;
        console.error("[LumentraChat] Stream error:", err);
      } finally {
        this.isLoading = false;
        this.sendButton.disabled = false;
        this.input.disabled = false;
        this.input.focus();
      }
    }

    // Public API methods
    open() {
      if (!this.isOpen) this.toggle();
    }

    close() {
      if (this.isOpen) this.toggle();
    }

    setVisitorInfo(info) {
      this.visitorInfo = { ...this.visitorInfo, ...info };
    }
  }

  // Expose globally
  window.LumentraChat = LumentraChat;
})();
