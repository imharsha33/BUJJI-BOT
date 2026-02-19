// BUJJI Chatbot App — Kalki 2898 AD Theme
(function () {
    'use strict';

    // Configure marked
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function (code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        }
    });

    // DOM Elements
    const messagesContainer = document.getElementById('messagesContainer');
    const messagesList = document.getElementById('messagesList');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const charCount = document.getElementById('charCount');
    const typingIndicator = document.getElementById('typingIndicator');
    const msgCounter = document.getElementById('msgCounter');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const toast = document.getElementById('toast');
    const bujjiCarFlyby = document.getElementById('bujjiCarFlyby');

    // State
    let messageCount = 0;
    let isLoading = false;
    let sidebarOpen = window.innerWidth > 768;
    let currentAbortController = null;
    let lastUserMessage = '';

    // Sidebar overlay for mobile
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // ============ BUJJI CAR FLYBY ANIMATION ============
    function triggerCarFlyby() {
        if (!bujjiCarFlyby) return;
        bujjiCarFlyby.classList.remove('zooming');
        void bujjiCarFlyby.offsetWidth; // force reflow
        bujjiCarFlyby.classList.add('zooming');
        setTimeout(() => {
            bujjiCarFlyby.classList.remove('zooming');
        }, 1500);
    }

    // ============ TEXTAREA AUTO-RESIZE ============
    messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 160) + 'px';
        const len = this.value.length;
        charCount.textContent = `${len}/4000`;
        charCount.style.color = len > 3500 ? '#ef4444' : len > 3000 ? '#f59e0b' : '';
        sendBtn.disabled = !this.value.trim() || isLoading;
    });

    // ============ KEYBOARD SHORTCUT ============
    messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendMessage();
        }
    });

    // ============ SEND MESSAGE ============
    sendBtn.addEventListener('click', sendMessage);

    function sendMessage(messageOverride) {
        const text = messageOverride || messageInput.value.trim();
        if (!text || isLoading) return;

        lastUserMessage = text;

        // Hide welcome screen
        if (welcomeScreen.style.display !== 'none') {
            welcomeScreen.style.opacity = '0';
            welcomeScreen.style.transform = 'scale(0.95)';
            welcomeScreen.style.transition = 'all 0.3s ease';
            setTimeout(() => { welcomeScreen.style.display = 'none'; }, 300);
        }

        if (!messageOverride) {
            addMessage('user', text);
            messageInput.value = '';
            messageInput.style.height = 'auto';
            charCount.textContent = '0/4000';
        }

        sendBtn.disabled = true;
        isLoading = true;

        showThinking();
        typingIndicator.style.display = 'flex';

        currentAbortController = new AbortController();
        streamFromAPI('/api/chat', { message: text }, currentAbortController.signal);
    }

    function streamFromAPI(url, body, signal) {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: signal
        })
            .then(response => {
                if (!response.ok) throw new Error('Network error');

                hideThinking();
                const { bubble, wrapper } = addStreamMessage();
                let fullText = '';

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let modelUsed = '';

                function readStream() {
                    return reader.read().then(({ done, value }) => {
                        if (done) {
                            finishStream(bubble, wrapper, fullText, modelUsed);
                            return;
                        }
                        const text = decoder.decode(value, { stream: true });
                        const lines = text.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.chunk) {
                                        fullText += data.chunk;
                                        bubble.innerHTML = parseMarkdown(fullText);
                                        scrollToBottom();
                                    }
                                    if (data.done) {
                                        messageCount = data.message_count || messageCount + 1;
                                        modelUsed = data.model || '';
                                        updateCounter();
                                    }
                                    if (data.error) {
                                        bubble.innerHTML = parseMarkdown(`⚠️ **Error:** ${data.error}`);
                                        bubble.classList.add('error-bubble');
                                    }
                                } catch (e) { /* skip */ }
                            }
                        }
                        return readStream();
                    });
                }
                return readStream();
            })
            .catch(err => {
                hideThinking();
                typingIndicator.style.display = 'none';
                isLoading = false;
                currentAbortController = null;
                sendBtn.disabled = !messageInput.value.trim();
                if (err.name === 'AbortError') {
                    showToast('Generation stopped');
                } else {
                    addMessage('assistant', '⚠️ **Connection error.** Please check your server.', true);
                }
            });
    }

    function finishStream(bubble, wrapper, fullText, modelUsed) {
        typingIndicator.style.display = 'none';
        isLoading = false;
        currentAbortController = null;
        sendBtn.disabled = !messageInput.value.trim();

        // 🚗 BUJJI Car zooms fast across screen when answer arrives!
        triggerCarFlyby();

        // Final render with full markdown + syntax highlighting
        bubble.innerHTML = parseMarkdown(fullText);
        setTimeout(() => {
            addCopyButtons(bubble);
            bubble.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
        }, 50);

        addMessageActions(wrapper, fullText, modelUsed);
        scrollToBottom();
        messageInput.focus();
    }

    // ============ MESSAGE ACTIONS ============
    function addMessageActions(wrapper, fullText, modelUsed) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(fullText).then(() => {
                copyBtn.innerHTML = '✓ Copied!';
                copyBtn.style.color = '#22c55e';
                setTimeout(() => {
                    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
                    copyBtn.style.color = '';
                }, 2000);
            });
        });

        const regenBtn = document.createElement('button');
        regenBtn.className = 'action-btn';
        regenBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> Regenerate`;
        regenBtn.addEventListener('click', () => {
            if (isLoading) return;
            wrapper.remove();
            regenerateResponse();
        });

        if (modelUsed) {
            const modelLabel = document.createElement('span');
            modelLabel.className = 'model-label';
            modelLabel.textContent = modelUsed;
            actionsDiv.appendChild(modelLabel);
        }

        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(regenBtn);

        const body = wrapper.querySelector('.message-body');
        if (body) body.appendChild(actionsDiv);
    }

    function regenerateResponse() {
        if (isLoading) return;
        isLoading = true;
        sendBtn.disabled = true;
        showThinking();
        typingIndicator.style.display = 'flex';
        currentAbortController = new AbortController();
        streamFromAPI('/api/regenerate', {}, currentAbortController.signal);
    }

    function stopGeneration() {
        if (currentAbortController) {
            currentAbortController.abort();
        }
    }

    // ============ ADD STREAMING MESSAGE ============
    function addStreamMessage() {
        const wrapper = document.createElement('div');
        wrapper.className = 'message assistant';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="1.5"/><path d="M10 16 L16 10 L22 16 L16 22 Z" fill="currentColor" opacity="0.8"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>`;

        const body = document.createElement('div');
        body.className = 'message-body';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = '<span class="stream-cursor">▊</span>';

        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        body.appendChild(bubble);
        body.appendChild(time);
        wrapper.appendChild(avatar);
        wrapper.appendChild(body);
        messagesList.appendChild(wrapper);
        scrollToBottom();
        return { bubble, wrapper };
    }

    // ============ ADD MESSAGE ============
    function addMessage(role, content, isError = false) {
        const wrapper = document.createElement('div');
        wrapper.className = `message ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';

        if (role === 'user') {
            avatar.textContent = 'YOU';
        } else {
            avatar.innerHTML = `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="1.5"/><path d="M10 16 L16 10 L22 16 L16 22 Z" fill="currentColor" opacity="0.8"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>`;
        }

        const body = document.createElement('div');
        body.className = 'message-body';

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isError ? 'error-bubble' : ''}`;

        if (role === 'assistant') {
            bubble.innerHTML = parseMarkdown(content);
            setTimeout(() => addCopyButtons(bubble), 50);
            setTimeout(() => {
                bubble.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
            }, 60);
        } else {
            bubble.textContent = content;
        }

        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        body.appendChild(bubble);
        body.appendChild(time);
        wrapper.appendChild(avatar);
        wrapper.appendChild(body);
        messagesList.appendChild(wrapper);
        scrollToBottom();
    }

    function parseMarkdown(text) {
        try {
            return marked.parse(text);
        } catch (e) {
            return text.replace(/\n/g, '<br>');
        }
    }

    function addCopyButtons(container) {
        container.querySelectorAll('pre').forEach(pre => {
            if (pre.querySelector('.code-copy-btn')) return;
            const code = pre.querySelector('code');
            if (code) {
                const classes = code.className.split(' ');
                const langClass = classes.find(c => c.startsWith('language-'));
                if (langClass) {
                    const lang = langClass.replace('language-', '');
                    const langLabel = document.createElement('span');
                    langLabel.className = 'code-lang-label';
                    langLabel.textContent = lang;
                    pre.appendChild(langLabel);
                }
            }
            const btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
            btn.addEventListener('click', () => {
                const codeEl = pre.querySelector('code');
                navigator.clipboard.writeText(codeEl ? codeEl.innerText : pre.innerText).then(() => {
                    btn.innerHTML = '✓ Copied!';
                    btn.style.color = '#22c55e';
                    setTimeout(() => {
                        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
                        btn.style.color = '';
                    }, 2000);
                });
            });
            pre.style.position = 'relative';
            pre.appendChild(btn);
        });
    }

    // ============ THINKING BUBBLE ============
    let thinkingEl;

    function showThinking() {
        thinkingEl = document.createElement('div');
        thinkingEl.className = 'thinking-bubble';
        thinkingEl.innerHTML = `
            <div class="message-avatar" style="width:36px;height:36px;border-radius:50%;background:var(--bg-card);border:1px solid var(--border-glow);display:flex;align-items:center;justify-content:center;color:var(--accent-primary);flex-shrink:0;margin-top:4px;">
                <svg viewBox="0 0 32 32" fill="none" width="18" height="18"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="1.5"/><path d="M10 16 L16 10 L22 16 L16 22 Z" fill="currentColor" opacity="0.8"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>
            </div>
            <div class="thinking-dots">
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
            </div>
        `;
        messagesList.appendChild(thinkingEl);
        scrollToBottom();
    }

    function hideThinking() {
        if (thinkingEl) {
            thinkingEl.style.opacity = '0';
            thinkingEl.style.transition = 'opacity 0.2s';
            setTimeout(() => { if (thinkingEl) thinkingEl.remove(); }, 200);
            thinkingEl = null;
        }
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    }

    function updateCounter() {
        msgCounter.textContent = `${messageCount} message${messageCount !== 1 ? 's' : ''}`;
    }

    // ============ CLEAR ============
    clearBtn.addEventListener('click', clearConversation);
    newChatBtn.addEventListener('click', clearConversation);

    function clearConversation() {
        if (isLoading) stopGeneration();
        fetch('/api/clear', { method: 'POST' }).catch(() => { });
        messagesList.innerHTML = '';
        messageCount = 0;
        updateCounter();
        welcomeScreen.style.display = 'flex';
        welcomeScreen.style.opacity = '0';
        welcomeScreen.style.transform = 'scale(0.95)';
        welcomeScreen.style.transition = 'all 0.4s ease';
        setTimeout(() => {
            welcomeScreen.style.opacity = '1';
            welcomeScreen.style.transform = 'scale(1)';
        }, 50);
        showToast('Conversation cleared');
    }

    // ============ SUGGESTIONS ============
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', function () {
            const prompt = this.dataset.prompt;
            messageInput.value = prompt;
            messageInput.dispatchEvent(new Event('input'));
            messageInput.focus();
            sendMessage();
        });
    });

    // ============ SIDEBAR TOGGLE ============
    sidebarToggle.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', closeSidebar);

    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
        if (sidebarOpen) {
            sidebar.classList.add('open');
            if (window.innerWidth <= 768) overlay.classList.add('active');
        } else {
            closeSidebar();
        }
    }

    function closeSidebar() {
        sidebarOpen = false;
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            overlay.classList.remove('active');
            sidebar.classList.remove('open');
        }
    });

    // ============ KEYBOARD SHORTCUTS ============
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isLoading) stopGeneration();
        if (e.ctrlKey && e.shiftKey && e.key === 'Backspace') clearConversation();
    });

    // ============ TOAST ============
    let toastTimeout;
    function showToast(message) {
        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.classList.add('show');
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    messageInput.focus();
})();
