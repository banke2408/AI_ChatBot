/* ═══════════════════════════════════════════════
   PDA CHATBOT — INTERACTIVE CHAT + EFFECTS ENGINE
   ═══════════════════════════════════════════════ */

(() => {
  "use strict";

  /* ─── DOM Elements ─── */
  const widget    = document.getElementById("chat-widget");
  const toggle    = document.getElementById("chat-toggle");
  const closeBtn  = document.getElementById("chat-close");
  const resetBtn  = document.getElementById("chat-reset");
  const languageSelect = document.getElementById("language-select");
  const form      = document.getElementById("chat-form");
  const input     = document.getElementById("chat-input");
  const messages  = document.getElementById("chat-messages");
  const sendBtn   = document.getElementById("chat-send");
  const voiceBtn  = document.getElementById("voice-toggle");
  const chips     = document.querySelectorAll(".chip");
  const topicCards = document.querySelectorAll(".topic-card");
  const navbar    = document.getElementById("navbar");

  /* ─── State ─── */
  let chatOpen = false;
  let isLoading = false;
  let recognition = null;
  let isListening = false;
  const history = [];

  const responseLanguage = {
    en: "English",
    kn: "Kannada",
    hi: "Hindi",
  };

  /* ─── Theme Management ─── */
  const themeToggle = document.getElementById("theme-toggle");
  
  // Check for saved theme
  const savedTheme = localStorage.getItem("pda-theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("light-theme");
      const isLight = document.body.classList.contains("light-theme");
      localStorage.setItem("pda-theme", isLight ? "light" : "dark");
      
      // Update particles colors if needed
      initParticles();
    });
  }

  const savedLanguage = localStorage.getItem("pda-language") || "en";
  if (languageSelect) {
    languageSelect.value = responseLanguage[savedLanguage] ? savedLanguage : "en";
    languageSelect.addEventListener("change", () => localStorage.setItem("pda-language", languageSelect.value));
  }

  /* ═══════════════════════════════════════════════
     PARTICLE BACKGROUND SYSTEM
     ═══════════════════════════════════════════════ */
  const canvas = document.getElementById("particles-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let particles = [];
    let mouse = { x: 0, y: 0 };
    let animId;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.hue = Math.random() * 60 + 200; // blue-purple range
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Mouse interaction
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          this.x -= dx * 0.01;
          this.y -= dy * 0.01;
          this.opacity = Math.min(this.opacity + 0.02, 0.6);
        }

        // Wrap around
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
      }
      draw() {
        const isLight = document.body.classList.contains("light-theme");
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        if (isLight) {
          ctx.fillStyle = `hsla(${this.hue}, 80%, 40%, ${this.opacity * 1.5})`;
        } else {
          ctx.fillStyle = `hsla(${this.hue}, 70%, 70%, ${this.opacity})`;
        }
        ctx.fill();
      }
    }

    function initParticles() {
      resizeCanvas();
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 100);
      particles = Array.from({ length: count }, () => new Particle());
    }

    function connectParticles() {
      const isLight = document.body.classList.contains("light-theme");
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const opacity = (1 - dist / 120);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            
            if (isLight) {
              ctx.strokeStyle = `rgba(50, 100, 255, ${opacity * 0.4})`;
            } else {
              ctx.strokeStyle = `rgba(100, 150, 255, ${opacity * 0.2})`;
            }
            
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
    }

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      connectParticles();
      animId = requestAnimationFrame(animateParticles);
    }

    window.addEventListener("resize", () => {
      cancelAnimationFrame(animId);
      initParticles();
      animateParticles();
    });
    window.addEventListener("mousemove", e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    initParticles();
    animateParticles();
  }

  /* ═══════════════════════════════════════════════
     ANIMATED STATS COUNTER
     ═══════════════════════════════════════════════ */
  const statNumbers = document.querySelectorAll(".stat-number[data-target]");

  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || "";
    const duration = 2000;
    const start = performance.now();

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // ease out quart
      const current = Math.floor(target * eased);
      // Don't use toLocaleString for years (avoids "1,958")
      el.textContent = (target > 1900 ? current.toString() : current.toLocaleString()) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => statsObserver.observe(el));

  /* ═══════════════════════════════════════════════
     SCROLL EFFECTS
     ═══════════════════════════════════════════════ */
  window.addEventListener("scroll", () => {
    if (navbar) {
      navbar.classList.toggle("scrolled", window.scrollY > 60);
    }
  });

  // Reveal-on-scroll for cards
  const revealElements = document.querySelectorAll(".topic-card, .feature-card, .stat-card");
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.animation = `fadeUp 0.6s ${i * 0.08}s var(--ease-out) both`;
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  revealElements.forEach(el => revealObserver.observe(el));

  /* ═══════════════════════════════════════════════
     TOPIC CARD → CHAT INTERACTION
     ═══════════════════════════════════════════════ */
  topicCards.forEach(card => {
    card.addEventListener("click", () => {
      const question = card.dataset.question;
      if (question) askQuestion(question);
    });
  });

  /* ═══════════════════════════════════════════════
     CHAT WIDGET LOGIC
     ═══════════════════════════════════════════════ */

  function toggleChat() {
    chatOpen = !chatOpen;
    widget.classList.toggle("open", chatOpen);
    if (chatOpen) {
      input.focus();
      if (messages.childElementCount === 0) showWelcome();
    }
  }

  toggle.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);
  resetBtn.addEventListener("click", () => {
    history.length = 0;
    messages.replaceChildren();
    showWelcome();
    input.value = "";
    autoResizeInput();
    input.focus();
  });

  function askQuestion(question) {
    if (!question || isLoading) return;
    if (!chatOpen) toggleChat();
    window.setTimeout(() => sendMessage(question), 250);
  }

  window.addEventListener("pdacek:ask", (event) => askQuestion(event.detail?.question));

  /* ─── Welcome Message ─── */
  function showWelcome() {
    const welcomeHTML = `
      <strong>Namaste! 🙏 How can I help?</strong>

      Ask about <strong>admissions, courses, placements, exams, hostels</strong>, or campus life. I search the official PDACEK website and indexed PDFs, and link the official source whenever one is found.
    `;
    addBotMessage(welcomeHTML);
  }

  /* ─── Add Messages ─── */
  function addBotMessage(text, sources) {
    const div = document.createElement("div");
    div.className = "message bot";

    let sourceHTML = "";
    if (sources && sources.length > 0) {
      // Deduplicate sources by URL
      const seen = new Set();
      const unique = sources.filter(s => {
        if (seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
      }).slice(0, 4);

      const sourceItems = unique.map(s => {
        const sourceUrl = safeExternalUrl(s.url);
        if (!sourceUrl) return "";

        let icon, label;
        // Auto-detect external review sources by URL
        const isExternal = s.type === "external_review" ||
          /shiksha\.com|collegedunia\.com|careers360\.com|zollege\.in/i.test(s.url);
        if (isExternal) {
          icon = "⭐"; label = "Review Platform";
        } else if (s.type === "official_pdf") {
          icon = "📄"; label = "Official PDF";
        } else {
          icon = "🌐"; label = "Official PDACEK";
        }
        const title = s.title.length > 50 ? s.title.slice(0, 47) + "..." : s.title;
        const pages = Array.isArray(s.pages) && s.pages.length ? ` • Page${s.pages.length > 1 ? "s" : ""} ${s.pages.join(", ")}` : "";
        return `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="source-link ${isExternal ? 'source-external' : ''}">
          <span class="source-icon">${icon}</span>
          <span class="source-info">
            <span class="source-label">${label}</span>
            <span class="source-title">${escapeHtml(title)}${escapeHtml(pages)}</span>
          </span>
          <span class="source-arrow">↗</span>
        </a>`;
      }).join("");
      sourceHTML = `<div class="source-links"><div class="source-header">✓ ${sources.some((source) => source.type === "official_pdf" || source.type === "official") ? "Verified official sources" : "Sources"}</div>${sourceItems}</div>`;
    }

    div.innerHTML = `
      <div class="msg-avatar">🎓</div>
      <div class="msg-bubble">${renderMarkdown(text)}${sourceHTML}</div>
    `;
    messages.appendChild(div);
    scrollToBottom();
  }

  function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "message user";
    div.innerHTML = `
      <div class="msg-avatar">👤</div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    `;
    messages.appendChild(div);
    scrollToBottom();
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "message bot";
    div.id = "typing-msg";
    div.innerHTML = `
      <div class="msg-avatar">🎓</div>
      <div class="msg-bubble">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>
    `;
    messages.appendChild(div);
    scrollToBottom();
  }

  function removeTyping() {
    const el = document.getElementById("typing-msg");
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  /* ─── Markdown Renderer ─── */
  function renderMarkdown(text) {
    // Step 1: Strip any raw HTML tags the AI might output (e.g. <a href="...">, <b>, etc.)
    // This prevents attributes like target="_blank" from leaking as visible text.
    let cleaned = String(text)
      // Convert raw HTML <a> tags to markdown-style links first
      .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
      // Strip any remaining HTML tags the AI might generate
      .replace(/<\/?[^>]+>/g, '');

    // Escape the model response before adding only the small, known-safe set
    // of markdown tags below. This prevents an unexpected model response from
    // becoming executable HTML in the browser.
    const escaped = escapeHtml(cleaned);

    return escaped
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Markdown links [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawUrl) => {
        const url = safeExternalUrl(rawUrl.replace(/&amp;/g, "&"));
        return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
      })
      // Standalone URLs (only if not already inside an href)
      .replace(/(?<!="|'>)(https?:\/\/[^\s)<,]+)/g, (match, url, offset, str) => {
        // Check if this URL is already inside an <a> tag
        const before = str.substring(Math.max(0, offset - 10), offset);
        if (before.includes('href="') || before.includes("href='")) return match;
        const safeUrl = safeExternalUrl(url.replace(/&amp;/g, "&"));
        return safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${url}</a>` : match;
      })
      // Unordered lists  
      .replace(/^[\-\*]\s+(.+)/gm, '<li>$1</li>')
      .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
      // Numbered lists
      .replace(/^\d+\.\s+(.+)/gm, '<li>$1</li>')
      // Paragraphs
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.+)$/, '<p>$1</p>');
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(value.trim());
      return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : null;
    } catch {
      return null;
    }
  }

  function setupVoiceInput() {
    if (!voiceBtn) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      voiceBtn.disabled = true;
      voiceBtn.title = "Voice input is not supported in this browser";
      return;
    }

    recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isListening = true;
      voiceBtn.classList.add("recording");
      voiceBtn.setAttribute("aria-label", "Stop voice input");
      voiceBtn.setAttribute("aria-pressed", "true");
    };
    recognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove("recording");
      voiceBtn.setAttribute("aria-label", "Start voice input");
      voiceBtn.setAttribute("aria-pressed", "false");
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        addBotMessage("🎙️ Microphone permission was not granted. You can still type your question.");
      }
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join("");
      input.value = transcript;
      autoResizeInput();
      input.focus();
    };
    voiceBtn.addEventListener("click", () => {
      if (isListening) {
        recognition.stop();
        return;
      }
      const language = languageSelect?.value || "en";
      recognition.lang = { en: "en-IN", kn: "kn-IN", hi: "hi-IN" }[language];
      recognition.start();
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /* ─── Send Message ─── */
  async function sendMessage(text) {
    if (isLoading || !text.trim()) return;

    const userText = text.trim();
    const selectedLanguage = languageSelect?.value || "en";
    const requestText = selectedLanguage === "en"
      ? userText
      : `${userText}\n\nPlease answer in ${responseLanguage[selectedLanguage]} while keeping official names, links, and numbers unchanged.`;
    addUserMessage(userText);

    history.push({ role: "user", text: userText });

    isLoading = true;
    sendBtn.disabled = true;
    input.value = "";
    autoResizeInput();
    showTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: requestText,
          // The current user message is added separately by the server. Do
          // not send it in history as well, otherwise the model sees it twice.
          history: history.slice(0, -1).slice(-10),
        }),
      });

      const data = await res.json();
      removeTyping();

      if (res.ok && data.reply) {
        addBotMessage(data.reply, data.sources || []);
        history.push({ role: "model", text: data.reply });
      } else {
        addBotMessage("⚠️ " + (data.error || "Something went wrong. Please try again."));
      }
    } catch (err) {
      removeTyping();
      addBotMessage("⚠️ Could not connect to the server. Please check if the server is running.");
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  /* ─── Form Submit ─── */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  function autoResizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  input.addEventListener("input", autoResizeInput);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  /* ─── Suggestion Chips ─── */
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      const q = chip.dataset.q;
      if (q) sendMessage(q);
    });
  });

  setupVoiceInput();

  /* ─── Keyboard Shortcut ─── */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && chatOpen) toggleChat();
  });

})();
