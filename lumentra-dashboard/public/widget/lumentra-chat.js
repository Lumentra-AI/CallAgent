/**
 * Lumentra Chat Widget v2.0.0
 * Embeddable SSE-streaming chat widget for customer websites
 *
 * Usage:
 * <script src="https://app.lumentraai.com/widget/lumentra-chat.js"></script>
 * <script>
 *   window.LumentraChat = new LumentraChat({ tenantId: 'YOUR_TENANT_ID' });
 *   // Methods: .open(), .close(), .toggle(), .setVisitorInfo({ name, email, phone })
 * </script>
 */

(function () {
  "use strict";

  var WIDGET_VERSION = "2.0.0";
  var DEFAULT_API_URL = "https://api.lumentraai.com";
  var SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  var MOBILE_BREAKPOINT = 480;
  var STREAM_TIMEOUT_MS = 60000;
  var HISTORY_TIMEOUT_MS = 10000;

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    if (!str) return "";
    var map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return str.replace(/[&<>"']/g, function (c) {
      return map[c];
    });
  }

  /**
   * Lightweight markdown renderer. MUST be called on already-escaped HTML
   * to prevent XSS. Transforms: **bold**, *italic*, `code`, - bullets,
   * [text](url) links, and newlines.
   */
  function renderMarkdown(escaped) {
    if (!escaped) return "";
    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Italic (not inside strong)
    escaped = escaped.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    // Links
    escaped = escaped.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    // Bullet lists: lines starting with "- "
    escaped = escaped.replace(/(^|\n)- (.+)/g, function (_m, prefix, text) {
      return prefix + "<li>" + text + "</li>";
    });
    // Wrap consecutive <li> in <ul>
    escaped = escaped.replace(/((?:<li>.*?<\/li>\n?)+)/g, "<ul>$1</ul>");
    // Line breaks
    escaped = escaped.replace(/\n/g, "<br>");
    return escaped;
  }

  function generateSessionId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return (
      "chat_" +
      Date.now().toString(36) +
      Math.random().toString(36).substr(2, 9)
    );
  }

  /** Return white or dark text color for readable contrast on the given hex bg */
  function contrastText(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
      ? "#1a1a1a"
      : "#ffffff";
  }

  function toolStatusLabel(name) {
    var labels = {
      check_availability: "Checking availability...",
      create_booking: "Creating your booking...",
      get_business_hours: "Looking up hours...",
      search_knowledge_base: "Searching...",
      collect_contact_info: "Saving your info...",
      create_order: "Processing order...",
      get_menu: "Fetching the menu...",
      transfer_to_human: "Connecting to a team member...",
    };
    return labels[name] || "Working on it...";
  }

  // ---------------------------------------------------------------------------
  // CSS (all prefixed with lumentra- to avoid host page conflicts)
  // Uses CSS custom properties for theming.
  // ---------------------------------------------------------------------------

  function buildStylesheet(pos, brand, brandText) {
    var R = pos.indexOf("right") !== -1;
    var B = pos.indexOf("bottom") !== -1;
    var font =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';

    return [
      /* Custom properties */
      ":root{",
      "  --lumentra-brand:" + brand + ";",
      "  --lumentra-brand-text:" + brandText + ";",
      "}",

      /* ---- Launcher ---- */
      ".lumentra-chat-launcher{",
      "  position:fixed;",
      R ? "  right:20px;" : "  left:20px;",
      B ? "  bottom:20px;" : "  top:20px;",
      "  width:60px;height:60px;border-radius:50%;",
      "  background:var(--lumentra-brand);color:var(--lumentra-brand-text);",
      "  border:none;cursor:pointer;padding:0;outline:none;",
      "  box-shadow:0 4px 16px rgba(0,0,0,0.15);",
      "  display:flex;align-items:center;justify-content:center;",
      "  transition:transform .2s ease,box-shadow .2s ease;",
      "  z-index:999998;",
      "}",
      ".lumentra-chat-launcher:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(0,0,0,0.2);}",
      ".lumentra-chat-launcher:focus-visible{outline:2px solid var(--lumentra-brand);outline-offset:3px;}",
      ".lumentra-chat-launcher svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}",

      /* Badge */
      ".lumentra-chat-badge{",
      "  position:absolute;top:-2px;right:-2px;",
      "  min-width:18px;height:18px;border-radius:9px;",
      "  background:#ef4444;color:#fff;",
      "  font-size:11px;font-weight:600;line-height:18px;text-align:center;",
      "  padding:0 4px;display:none;",
      "  font-family:" + font + ";",
      "}",

      /* ---- Container ---- */
      ".lumentra-chat-container{",
      "  position:fixed;",
      R ? "  right:20px;" : "  left:20px;",
      B ? "  bottom:92px;" : "  top:92px;",
      "  width:400px;height:600px;max-height:calc(100vh - 120px);",
      "  background:#fff;border-radius:16px;",
      "  box-shadow:0 4px 24px rgba(0,0,0,0.12);",
      "  display:flex;flex-direction:column;overflow:hidden;",
      "  z-index:999999;font-family:" + font + ";",
      "  font-size:14px;line-height:1.5;",
      "  transition:opacity .25s ease,transform .25s ease;",
      "  opacity:1;transform:translateY(0);",
      "}",
      ".lumentra-chat-container.lumentra-hidden{",
      "  opacity:0;transform:translateY(16px);pointer-events:none;visibility:hidden;",
      "}",

      /* ---- Header ---- */
      ".lumentra-chat-header{",
      "  background:var(--lumentra-brand);color:var(--lumentra-brand-text);",
      "  padding:14px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0;",
      "}",
      ".lumentra-chat-logo{",
      "  width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0;",
      "  background:rgba(255,255,255,0.15);",
      "}",
      ".lumentra-chat-header-text{flex:1;min-width:0;}",
      ".lumentra-chat-header-name{",
      "  font-weight:600;font-size:15px;display:block;",
      "  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
      "}",
      ".lumentra-chat-header-status{",
      "  font-size:12px;opacity:.85;display:flex;align-items:center;gap:5px;",
      "}",
      ".lumentra-chat-header-status::before{",
      "  content:'';width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;",
      "}",
      ".lumentra-chat-close{",
      "  background:none;border:none;color:inherit;cursor:pointer;",
      "  padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;",
      "  transition:background .15s;flex-shrink:0;opacity:.8;outline:none;",
      "}",
      ".lumentra-chat-close:hover,.lumentra-chat-close:focus-visible{background:rgba(255,255,255,0.2);opacity:1;}",

      /* ---- Messages area ---- */
      ".lumentra-chat-messages{",
      "  flex:1;overflow-y:auto;padding:16px;background:#f4f4f5;",
      "  display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;",
      "}",

      /* ---- Message bubbles ---- */
      ".lumentra-msg{",
      "  max-width:82%;padding:10px 14px;border-radius:14px;",
      "  font-size:14px;line-height:1.55;",
      "  word-wrap:break-word;overflow-wrap:break-word;",
      "  animation:lumentra-msg-in .2s ease;",
      "}",
      "@keyframes lumentra-msg-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}",

      ".lumentra-msg-user{",
      "  align-self:flex-end;background:var(--lumentra-brand);color:var(--lumentra-brand-text);",
      "  border-bottom-right-radius:4px;",
      "}",
      ".lumentra-msg-assistant{",
      "  align-self:flex-start;background:#fff;color:#1a1a1a;",
      "  border-bottom-left-radius:4px;border-left:2px solid var(--lumentra-brand);",
      "  box-shadow:0 1px 3px rgba(0,0,0,0.06);",
      "}",
      ".lumentra-msg-assistant a{color:var(--lumentra-brand);text-decoration:underline;}",
      ".lumentra-msg-assistant code{",
      "  background:#f0f0f0;padding:1px 5px;border-radius:4px;font-size:13px;",
      '  font-family:"SF Mono","Fira Code","Fira Mono",Menlo,Consolas,monospace;',
      "}",
      ".lumentra-msg-assistant ul{margin:4px 0;padding-left:18px;}",
      ".lumentra-msg-assistant li{margin-bottom:2px;}",

      /* Tool status line (inside AI bubble during streaming) */
      ".lumentra-tool-status{font-size:12px;color:#71717a;font-style:italic;padding:4px 0 2px;}",

      /* ---- Tool result card ---- */
      ".lumentra-tool-card{",
      "  background:#fff;border:1px solid #e4e4e7;border-radius:10px;",
      "  padding:12px 14px;margin:6px 0 2px;max-width:82%;align-self:flex-start;",
      "  font-size:13px;line-height:1.5;color:#1a1a1a;",
      "  box-shadow:0 1px 3px rgba(0,0,0,0.05);",
      "  animation:lumentra-msg-in .2s ease;",
      "}",
      ".lumentra-tool-card-header{",
      "  display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px;",
      "  margin-bottom:6px;color:var(--lumentra-brand);",
      "}",
      ".lumentra-tool-card-header svg{width:16px;height:16px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}",
      ".lumentra-tool-card-row{display:flex;gap:6px;padding:2px 0;}",
      ".lumentra-tool-card-label{color:#71717a;font-size:12px;min-width:60px;}",
      ".lumentra-tool-card-value{font-size:13px;color:#1a1a1a;}",

      /* Info saved pill */
      ".lumentra-info-pill{",
      "  display:inline-flex;align-items:center;gap:4px;",
      "  background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;",
      "  border-radius:20px;padding:3px 10px;font-size:11px;font-weight:500;",
      "  margin-top:4px;align-self:flex-start;",
      "  animation:lumentra-msg-in .2s ease;",
      "}",

      /* Error message */
      ".lumentra-msg-error{",
      "  align-self:center;background:#fef2f2;color:#991b1b;",
      "  border:1px solid #fecaca;border-radius:10px;",
      "  padding:8px 14px;font-size:13px;text-align:center;max-width:90%;",
      "  animation:lumentra-msg-in .2s ease;",
      "}",

      /* ---- Input area ---- */
      ".lumentra-chat-input-area{",
      "  padding:12px 14px;background:#fff;border-top:1px solid #e4e4e7;",
      "  display:flex;gap:8px;align-items:center;flex-shrink:0;",
      "}",
      ".lumentra-chat-input-area input{",
      "  flex:1;padding:10px 14px;border:1px solid #d4d4d8;border-radius:10px;",
      "  font-size:14px;font-family:inherit;color:#1a1a1a;background:#fff;outline:none;",
      "  transition:border-color .15s;",
      "}",
      ".lumentra-chat-input-area input:focus{border-color:var(--lumentra-brand);}",
      ".lumentra-chat-input-area input::placeholder{color:#a1a1aa;}",
      ".lumentra-chat-input-area input:disabled{background:#fafafa;color:#a1a1aa;}",

      ".lumentra-chat-send{",
      "  width:40px;height:40px;border-radius:10px;",
      "  background:var(--lumentra-brand);color:var(--lumentra-brand-text);",
      "  border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;",
      "  flex-shrink:0;transition:opacity .15s;padding:0;outline:none;",
      "}",
      ".lumentra-chat-send:hover{opacity:.88;}",
      ".lumentra-chat-send:focus-visible{outline:2px solid var(--lumentra-brand);outline-offset:2px;}",
      ".lumentra-chat-send:disabled{opacity:.4;cursor:not-allowed;}",
      ".lumentra-chat-send svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}",

      /* ---- Footer ---- */
      ".lumentra-chat-footer{",
      "  padding:6px 14px 8px;text-align:center;font-size:11px;color:#a1a1aa;",
      "  background:#fff;flex-shrink:0;",
      "}",
      ".lumentra-chat-footer a{color:#71717a;text-decoration:none;transition:color .15s;}",
      ".lumentra-chat-footer a:hover{color:#52525b;}",

      /* ---- Mobile full-screen ---- */
      "@media(max-width:" + MOBILE_BREAKPOINT + "px){",
      "  .lumentra-chat-container{",
      "    width:100vw;height:100vh;height:100dvh;",
      "    max-height:100vh;max-height:100dvh;",
      "    top:0;left:0;right:0;bottom:0;border-radius:0;box-shadow:none;",
      "  }",
      "  .lumentra-chat-launcher{right:16px;bottom:16px;width:56px;height:56px;}",
      "}",
    ].join("\n");
  }

  // ---------------------------------------------------------------------------
  // Tool result cards
  // ---------------------------------------------------------------------------

  var TOOL_ICONS = {
    create_booking:
      '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    check_availability:
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    collect_contact_info:
      '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    create_order:
      '<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    _default:
      '<svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  };

  var TOOL_TITLES = {
    create_booking: "Booking Confirmed",
    check_availability: "Available Times",
    collect_contact_info: "Contact Info Saved",
    create_order: "Order Placed",
    get_business_hours: "Business Hours",
    get_menu: "Menu",
  };

  function renderToolCard(toolName, result) {
    if (!result) return "";

    var icon = TOOL_ICONS[toolName] || TOOL_ICONS._default;
    var title = TOOL_TITLES[toolName] || "Result";
    var h =
      '<div class="lumentra-tool-card">' +
      '<div class="lumentra-tool-card-header">' +
      icon +
      "<span>" +
      escapeHtml(title) +
      "</span></div>";

    if (typeof result === "string") {
      h += "<div>" + escapeHtml(result) + "</div>";
    } else if (result && typeof result === "object") {
      // Availability slots
      if (result.slots && Array.isArray(result.slots)) {
        var max = Math.min(result.slots.length, 5);
        for (var i = 0; i < max; i++) {
          var s = result.slots[i];
          h +=
            '<div class="lumentra-tool-card-row"><span class="lumentra-tool-card-value">' +
            escapeHtml(String(s.time || s.start || s)) +
            "</span></div>";
        }
        if (result.slots.length > 5) {
          h +=
            '<div class="lumentra-tool-card-row"><span class="lumentra-tool-card-label">+ ' +
            (result.slots.length - 5) +
            " more</span></div>";
        }
      }
      // Booking confirmation
      else if (result.booking_id || result.confirmation) {
        var bf = [
          ["Date", result.date],
          ["Time", result.time],
          ["Service", result.service],
          ["Ref", result.booking_id || result.confirmation],
        ];
        for (var j = 0; j < bf.length; j++) {
          if (bf[j][1]) {
            h +=
              '<div class="lumentra-tool-card-row"><span class="lumentra-tool-card-label">' +
              bf[j][0] +
              '</span><span class="lumentra-tool-card-value">' +
              escapeHtml(String(bf[j][1])) +
              "</span></div>";
          }
        }
      }
      // Order
      else if (result.order_id) {
        var of_ = [
          ["Order", result.order_id],
          ["Total", result.total],
          ["Status", result.status],
        ];
        for (var k = 0; k < of_.length; k++) {
          if (of_[k][1]) {
            h +=
              '<div class="lumentra-tool-card-row"><span class="lumentra-tool-card-label">' +
              of_[k][0] +
              '</span><span class="lumentra-tool-card-value">' +
              escapeHtml(String(of_[k][1])) +
              "</span></div>";
          }
        }
      }
      // Generic key-value fallback
      else {
        var keys = Object.keys(result);
        for (var m = 0; m < keys.length && m < 6; m++) {
          var v = result[keys[m]];
          if (v !== null && v !== undefined && typeof v !== "object") {
            h +=
              '<div class="lumentra-tool-card-row"><span class="lumentra-tool-card-label">' +
              escapeHtml(keys[m]) +
              '</span><span class="lumentra-tool-card-value">' +
              escapeHtml(String(v)) +
              "</span></div>";
          }
        }
      }
    }

    return h + "</div>";
  }

  // ---------------------------------------------------------------------------
  // LumentraChat constructor
  // ---------------------------------------------------------------------------

  function LumentraChat(config) {
    if (!config || !config.tenantId) {
      console.error("[LumentraChat] tenantId is required");
      return;
    }

    this.tenantId = config.tenantId;
    this.apiUrl = config.apiUrl || DEFAULT_API_URL;
    this.position = config.position || "bottom-right";
    this.sessionId = null;
    this.isOpen = false;
    this.isStreaming = false;
    this.messages = [];
    this.unreadCount = 0;
    this.config = null;
    this.visitorInfo = this._loadVisitorInfo();

    // DOM refs (populated in _createWidget)
    this._launcher = null;
    this._container = null;
    this._messagesEl = null;
    this._inputEl = null;
    this._sendBtn = null;
    this._badgeEl = null;

    // Active stream abort controller
    this._abort = null;

    // Bind public API
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.toggle = this.toggle.bind(this);

    this._init();
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._init = async function () {
    try {
      var res = await fetch(
        this.apiUrl + "/api/chat/config/" + encodeURIComponent(this.tenantId),
      );

      if (res.status === 404) {
        console.log("[LumentraChat] Widget not enabled for this tenant");
        return;
      }
      if (!res.ok)
        throw new Error("Config fetch failed (HTTP " + res.status + ")");

      this.config = await res.json();
      if (this.config.position) this.position = this.config.position;

      this.sessionId = this._loadOrCreateSession();
      this._injectStyles();
      this._createWidget();

      var restored = await this._restoreHistory();
      if (!restored && this.config.greeting) {
        this._addAssistantMessage(this.config.greeting, true);
      }

      console.log("[LumentraChat] Initialized v" + WIDGET_VERSION);
    } catch (err) {
      console.error("[LumentraChat] Init failed:", err);
    }
  };

  // ---------------------------------------------------------------------------
  // Session persistence
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._loadOrCreateSession = function () {
    var key = "lumentra_sid_" + this.tenantId;
    try {
      var raw = localStorage.getItem(key);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj.expires > Date.now()) return obj.id;
      }
    } catch (e) {
      /* ignore */
    }

    var id = generateSessionId();
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ id: id, expires: Date.now() + SESSION_TTL_MS }),
      );
    } catch (e) {
      /* ignore */
    }
    return id;
  };

  LumentraChat.prototype._loadVisitorInfo = function () {
    try {
      var raw = localStorage.getItem("lumentra_visitor_" + this.tenantId);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* ignore */
    }
    return {};
  };

  LumentraChat.prototype._saveVisitorInfo = function () {
    try {
      localStorage.setItem(
        "lumentra_visitor_" + this.tenantId,
        JSON.stringify(this.visitorInfo),
      );
    } catch (e) {
      /* ignore */
    }
  };

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._injectStyles = function () {
    if (document.getElementById("lumentra-chat-styles")) return;
    var brand = (this.config && this.config.theme_color) || "#6366f1";
    var brandText = contrastText(brand);
    var el = document.createElement("style");
    el.id = "lumentra-chat-styles";
    el.textContent = buildStylesheet(this.position, brand, brandText);
    document.head.appendChild(el);
  };

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._createWidget = function () {
    var self = this;
    var cfg = this.config || {};

    // -- Launcher --
    this._launcher = document.createElement("button");
    this._launcher.className = "lumentra-chat-launcher";
    this._launcher.setAttribute(
      "aria-label",
      "Open chat with " + (cfg.agent_name || "Assistant"),
    );
    this._launcher.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
      '<span class="lumentra-chat-badge" aria-hidden="true">1</span>';
    this._launcher.addEventListener("click", function () {
      self.toggle();
    });
    this._badgeEl = this._launcher.querySelector(".lumentra-chat-badge");

    // -- Container --
    this._container = document.createElement("div");
    this._container.className = "lumentra-chat-container lumentra-hidden";
    this._container.setAttribute("role", "dialog");
    this._container.setAttribute(
      "aria-label",
      "Chat with " + (cfg.agent_name || "Assistant"),
    );

    // Header
    var hdr = '<div class="lumentra-chat-header">';
    if (cfg.logo_url) {
      hdr +=
        '<img class="lumentra-chat-logo" src="' +
        escapeHtml(cfg.logo_url) +
        '" alt="' +
        escapeHtml(cfg.business_name || "") +
        ' logo" onerror="this.style.display=\'none\'" />';
    }
    hdr +=
      '<div class="lumentra-chat-header-text">' +
      '<span class="lumentra-chat-header-name">' +
      escapeHtml(cfg.agent_name || "Assistant") +
      "</span>" +
      '<span class="lumentra-chat-header-status">Online</span>' +
      "</div>" +
      '<button class="lumentra-chat-close" aria-label="Close chat">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' +
      "</svg></button></div>";

    // Messages
    var msgs =
      '<div class="lumentra-chat-messages" aria-live="polite" aria-relevant="additions"></div>';

    // Input area
    var input =
      '<div class="lumentra-chat-input-area">' +
      '<input type="text" placeholder="Type a message..." autocomplete="off" aria-label="Type a message" />' +
      '<button class="lumentra-chat-send" aria-label="Send message">' +
      '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line>' +
      '<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
      "</button></div>";

    // Footer
    var footer =
      '<div class="lumentra-chat-footer">' +
      'Powered by <a href="https://lumentraai.com" target="_blank" rel="noopener noreferrer">Lumentra</a>' +
      "</div>";

    this._container.innerHTML = hdr + msgs + input + footer;

    // Append to page
    document.body.appendChild(this._launcher);
    document.body.appendChild(this._container);

    // Store refs
    this._messagesEl = this._container.querySelector(".lumentra-chat-messages");
    this._inputEl = this._container.querySelector(
      ".lumentra-chat-input-area input",
    );
    this._sendBtn = this._container.querySelector(".lumentra-chat-send");

    // Events
    this._container
      .querySelector(".lumentra-chat-close")
      .addEventListener("click", function () {
        self.close();
      });
    this._sendBtn.addEventListener("click", function () {
      self._send();
    });
    this._inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        self._send();
      }
    });
    this._container.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        self.close();
        self._launcher.focus();
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Open / Close / Toggle
  // ---------------------------------------------------------------------------

  LumentraChat.prototype.open = function () {
    if (this.isOpen || !this._container) return;
    this.isOpen = true;
    this._container.classList.remove("lumentra-hidden");
    this.unreadCount = 0;
    this._updateBadge();
    this._inputEl.focus();
    this._scroll();
  };

  LumentraChat.prototype.close = function () {
    if (!this.isOpen || !this._container) return;
    this.isOpen = false;
    this._container.classList.add("lumentra-hidden");
  };

  LumentraChat.prototype.toggle = function () {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  };

  // ---------------------------------------------------------------------------
  // Public: setVisitorInfo
  // ---------------------------------------------------------------------------

  LumentraChat.prototype.setVisitorInfo = function (info) {
    if (!info || typeof info !== "object") return;
    var allowed = ["name", "email", "phone"];
    for (var i = 0; i < allowed.length; i++) {
      if (info[allowed[i]] !== undefined) {
        this.visitorInfo[allowed[i]] = info[allowed[i]];
      }
    }
    this._saveVisitorInfo();
  };

  // ---------------------------------------------------------------------------
  // Badge
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._updateBadge = function () {
    if (!this._badgeEl) return;
    if (this.unreadCount > 0 && !this.isOpen) {
      this._badgeEl.textContent =
        this.unreadCount > 9 ? "9+" : String(this.unreadCount);
      this._badgeEl.style.display = "block";
    } else {
      this._badgeEl.style.display = "none";
    }
  };

  // ---------------------------------------------------------------------------
  // Scroll helper
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._scroll = function () {
    var el = this._messagesEl;
    if (!el) return;
    requestAnimationFrame(function () {
      el.scrollTop = el.scrollHeight;
    });
  };

  // ---------------------------------------------------------------------------
  // Message helpers
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._addUserMessage = function (text) {
    var div = document.createElement("div");
    div.className = "lumentra-msg lumentra-msg-user";
    div.textContent = text;
    div.setAttribute("title", new Date().toLocaleTimeString());
    this._messagesEl.appendChild(div);
    this.messages.push({ role: "user", content: text });
    this._scroll();
  };

  /** Returns the element for streaming updates */
  LumentraChat.prototype._addAssistantMessage = function (text, markdown) {
    var div = document.createElement("div");
    div.className = "lumentra-msg lumentra-msg-assistant";
    div.setAttribute("title", new Date().toLocaleTimeString());
    if (markdown && text) {
      div.innerHTML = renderMarkdown(escapeHtml(text));
    } else {
      div.textContent = text || "";
    }
    this._messagesEl.appendChild(div);
    this.messages.push({ role: "assistant", content: text || "" });
    this._scroll();

    if (!this.isOpen) {
      this.unreadCount++;
      this._updateBadge();
    }
    return div;
  };

  LumentraChat.prototype._addError = function (text) {
    var div = document.createElement("div");
    div.className = "lumentra-msg-error";
    div.textContent = text;
    this._messagesEl.appendChild(div);
    this._scroll();
  };

  LumentraChat.prototype._addToolCard = function (toolName, result) {
    var html = renderToolCard(toolName, result);
    if (!html) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    this._messagesEl.appendChild(tmp.firstChild);
    this._scroll();
  };

  LumentraChat.prototype._addInfoPill = function (text) {
    var pill = document.createElement("div");
    pill.className = "lumentra-info-pill";
    pill.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
      "<span>" +
      escapeHtml(text) +
      "</span>";
    this._messagesEl.appendChild(pill);
    this._scroll();
  };

  // ---------------------------------------------------------------------------
  // Input enable/disable
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._setInputEnabled = function (on) {
    if (this._inputEl) this._inputEl.disabled = !on;
    if (this._sendBtn) this._sendBtn.disabled = !on;
  };

  // ---------------------------------------------------------------------------
  // Restore history
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._restoreHistory = async function () {
    if (!this.sessionId) return false;
    try {
      var ctrl = new AbortController();
      var tid = setTimeout(function () {
        ctrl.abort();
      }, HISTORY_TIMEOUT_MS);
      var res = await fetch(
        this.apiUrl +
          "/api/chat/history/" +
          encodeURIComponent(this.sessionId) +
          "?tenant_id=" +
          encodeURIComponent(this.tenantId),
        { signal: ctrl.signal },
      );
      clearTimeout(tid);
      if (!res.ok) return false;
      var data = await res.json();
      if (!data.messages || !data.messages.length) return false;

      for (var i = 0; i < data.messages.length; i++) {
        var msg = data.messages[i];
        if (msg.role === "user") this._addUserMessage(msg.content);
        else if (msg.role === "assistant")
          this._addAssistantMessage(msg.content, true);
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // SSE streaming send
  // ---------------------------------------------------------------------------

  LumentraChat.prototype._send = async function () {
    var text = this._inputEl ? this._inputEl.value.trim() : "";
    if (!text || this.isStreaming) return;

    this._inputEl.value = "";
    this._addUserMessage(text);

    this.isStreaming = true;
    this._setInputEnabled(false);

    // Create an empty AI bubble for progressive text
    var aiEl = this._addAssistantMessage("", false);
    var fullText = "";
    var toolStatusEl = null;
    var hadToolResult = false;
    var self = this;

    try {
      // Abort any previous in-flight stream
      if (this._abort) this._abort.abort();
      this._abort = new AbortController();

      var timeoutId = setTimeout(function () {
        if (self._abort) self._abort.abort();
      }, STREAM_TIMEOUT_MS);

      var visitorPayload =
        Object.keys(this.visitorInfo).length > 0 ? this.visitorInfo : undefined;

      var response = await fetch(this.apiUrl + "/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: this._abort.signal,
        body: JSON.stringify({
          tenant_id: this.tenantId,
          session_id: this.sessionId,
          message: text,
          visitor_info: visitorPayload,
          source_url: window.location.href,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        var errBody;
        try {
          errBody = await response.json();
        } catch (e) {
          errBody = {};
        }
        throw new Error(
          errBody.error ||
            errBody.message ||
            "Server error (" + response.status + ")",
        );
      }

      // Read SSE stream via fetch + getReader
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });

        // Split on double newline (SSE event boundary)
        var events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (var i = 0; i < events.length; i++) {
          var block = events[i].trim();
          if (!block) continue;

          var eventType = "";
          var eventData = "";
          var lines = block.split("\n");

          for (var j = 0; j < lines.length; j++) {
            var ln = lines[j];
            if (ln.indexOf("event:") === 0) eventType = ln.substring(6).trim();
            else if (ln.indexOf("data:") === 0)
              eventData += ln.substring(5).trim();
          }

          if (!eventType || !eventData) continue;

          var parsed;
          try {
            parsed = JSON.parse(eventData);
          } catch (e) {
            continue;
          }

          // -- token: progressive text --
          if (eventType === "token") {
            if (toolStatusEl) {
              toolStatusEl.remove();
              toolStatusEl = null;
            }
            fullText += parsed.text || "";
            // During streaming: plain text for performance
            aiEl.textContent = fullText;
            self._scroll();
          }

          // -- tool_start: status line --
          else if (eventType === "tool_start") {
            var label = toolStatusLabel(parsed.tool);
            if (!toolStatusEl) {
              toolStatusEl = document.createElement("div");
              toolStatusEl.className = "lumentra-tool-status";
              aiEl.appendChild(toolStatusEl);
            }
            toolStatusEl.textContent = label;
            self._scroll();
          }

          // -- tool_result: structured card --
          else if (eventType === "tool_result") {
            hadToolResult = true;
            if (toolStatusEl) {
              toolStatusEl.remove();
              toolStatusEl = null;
            }

            if (parsed.tool === "collect_contact_info") {
              // Update local visitor info
              if (parsed.result && parsed.result.info) {
                var infoKeys = Object.keys(parsed.result.info);
                for (var ki = 0; ki < infoKeys.length; ki++) {
                  self.visitorInfo[infoKeys[ki]] =
                    parsed.result.info[infoKeys[ki]];
                }
                self._saveVisitorInfo();
              }
              self._addInfoPill("Info saved");
            } else {
              self._addToolCard(parsed.tool, parsed.result);
            }
          }

          // -- done: finalize with markdown --
          else if (eventType === "done") {
            var finalText = parsed.full_response || fullText;
            if (finalText) {
              aiEl.innerHTML = renderMarkdown(escapeHtml(finalText));
              // Update stored message content
              if (self.messages.length > 0) {
                self.messages[self.messages.length - 1].content = finalText;
              }
            } else if (!fullText && !hadToolResult) {
              // No text AND no tool result -- remove empty bubble
              aiEl.remove();
            }
            // If had tool result but no text, keep aiEl (may be empty but
            // tool cards / info pills were already rendered separately)
            self._scroll();
          }

          // -- error --
          else if (eventType === "error") {
            var errMsg = parsed.message || "Something went wrong.";
            if (!fullText) {
              aiEl.remove();
              self._addError(errMsg + " Please try again.");
            } else {
              // Finalize partial text
              aiEl.innerHTML = renderMarkdown(escapeHtml(fullText));
            }
          }
        }
      }

      // Fallback: stream ended without explicit "done" event
      if (fullText && aiEl.parentNode) {
        aiEl.innerHTML = renderMarkdown(escapeHtml(fullText));
        self._scroll();
      }
    } catch (err) {
      // Clean up the AI bubble
      if (!fullText && aiEl && aiEl.parentNode) {
        aiEl.remove();
      } else if (fullText && aiEl && aiEl.parentNode) {
        aiEl.innerHTML = renderMarkdown(escapeHtml(fullText));
      }

      if (err.name === "AbortError") {
        self._addError("The request took too long. Please try again.");
      } else {
        self._addError(
          "Connection error. Please check your internet and try again.",
        );
        console.error("[LumentraChat] Stream error:", err);
      }
    } finally {
      this.isStreaming = false;
      this._setInputEnabled(true);
      this._abort = null;
      if (this._inputEl) this._inputEl.focus();
      if (toolStatusEl && toolStatusEl.parentNode) toolStatusEl.remove();
    }
  };

  // ---------------------------------------------------------------------------
  // Expose globally
  // ---------------------------------------------------------------------------

  window.LumentraChat = LumentraChat;
})();
