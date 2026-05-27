const AIModule = {
    initTextSelection(container) {
        const existingTooltip = document.querySelector('.ai-tooltip');
        if (existingTooltip) existingTooltip.remove();

        const tooltip = document.createElement('div');
        tooltip.className = 'ai-tooltip';
        tooltip.innerHTML = `
            <button class="ai-tooltip-explain" type="button">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
                <span>解释这段</span>
            </button>
            <div class="ai-tooltip-ask">
                <input class="ai-tooltip-input" type="text" placeholder="或对这段内容提问，回车发送…" maxlength="200">
                <button class="ai-tooltip-send" type="button" aria-label="发送提问">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <path d="M12 19V5M5 12l7-7 7 7"/>
                    </svg>
                </button>
            </div>
        `;
        document.body.appendChild(tooltip);

        const input = tooltip.querySelector('.ai-tooltip-input');
        let selectedText = '';
        let selectionTimeout = null;

        const hide = () => { tooltip.style.display = 'none'; input.value = ''; };
        const fire = (question) => {
            if (!selectedText) return;
            this.showAIExplanation(selectedText, question);
            hide();
            window.getSelection().removeAllRanges();
        };

        container.addEventListener('mouseup', () => {
            clearTimeout(selectionTimeout);
            selectionTimeout = setTimeout(() => {
                const selection = window.getSelection();
                const text = selection.toString().trim();
                // 在 tooltip 内部操作（如点输入框）不重置
                if (tooltip.style.display === 'block' && input === document.activeElement) return;

                if (text.length > 0 && text.length < 500) {
                    selectedText = text;
                    input.value = '';
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${Math.max(8, rect.left + rect.width / 2 - tooltip.offsetWidth / 2)}px`;
                    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10 + window.scrollY}px`;
                } else {
                    hide();
                }
            }, 10);
        });

        document.addEventListener('mousedown', (e) => {
            if (!tooltip.contains(e.target)) hide();
        });

        tooltip.querySelector('.ai-tooltip-explain').addEventListener('click', (e) => {
            e.stopPropagation();
            fire('');
        });
        tooltip.querySelector('.ai-tooltip-send').addEventListener('click', (e) => {
            e.stopPropagation();
            fire(input.value.trim());
        });
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); fire(input.value.trim()); }
            else if (e.key === 'Escape') hide();
        });
    },

    // ===== 统一对话入口：选中文本 → 注入对话（可带具体问题）=====
    showAIExplanation(text, question = '') {
        if (!text || !text.trim()) return;
        text = text.trim();
        question = (question || '').trim();
        this.openAISidebar();
        // 选中的原文直接嵌在可见消息里：用户能看到「喂给 AI 的到底是什么」
        const msg = question
            ? `关于这段内容：「${text}」\n\n我的问题：${question}`
            : `请解释这段内容：「${text}」`;
        this._sendChatMessage(msg, { context: text });
    },

    // ===== 会话管理（按用户隔离，持久化到 localStorage）=====
    _chatUid() { return this.state.user?.id || 'anon'; },
    _chatSessionsKey() { return `nanofab_chat_sessions_v1_${this._chatUid()}`; },
    _chatActiveKey() { return `nanofab_chat_active_v1_${this._chatUid()}`; },

    _loadSessions() {
        try { return JSON.parse(localStorage.getItem(this._chatSessionsKey())) || []; }
        catch (e) { return []; }
    },
    _saveSessions(list) {
        localStorage.setItem(this._chatSessionsKey(), JSON.stringify(list));
    },
    _getActiveSession() {
        const list = this._loadSessions();
        const activeId = localStorage.getItem(this._chatActiveKey());
        return list.find(s => s.id === activeId) || null;
    },
    _ensureActiveSession() {
        let s = this._getActiveSession();
        if (!s) s = this.createChatSession(false);
        return s;
    },
    createChatSession(render = true) {
        const list = this._loadSessions();
        const session = {
            id: 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            title: '新对话',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        list.unshift(session);
        this._saveSessions(list);
        localStorage.setItem(this._chatActiveKey(), session.id);
        if (render) {
            this.renderActiveSession();
            this.renderSessionsList();
            this._closeSessionsDrawer();
        }
        return session;
    },
    switchChatSession(id) {
        localStorage.setItem(this._chatActiveKey(), id);
        this.renderActiveSession();
        this.renderSessionsList();
        this._closeSessionsDrawer();
    },
    deleteChatSession(id) {
        const list = this._loadSessions().filter(s => s.id !== id);
        this._saveSessions(list);
        const activeId = localStorage.getItem(this._chatActiveKey());
        if (activeId === id) {
            if (list.length) localStorage.setItem(this._chatActiveKey(), list[0].id);
            else localStorage.removeItem(this._chatActiveKey());
        }
        this.renderActiveSession();
        this.renderSessionsList();
    },
    _updateActiveSession(mutator) {
        const list = this._loadSessions();
        const activeId = localStorage.getItem(this._chatActiveKey());
        const s = list.find(x => x.id === activeId);
        if (!s) return;
        mutator(s);
        s.updatedAt = new Date().toISOString();
        this._saveSessions(list);
    },
    _closeSessionsDrawer() {
        const drawer = document.getElementById('ai-sessions-drawer');
        if (drawer) drawer.classList.add('hidden');
    },

    _sessionGreeting() {
        return '你好！我是你的 AI 学习助手。直接提问，或在正文中选中一段文字——可以点「解释这段」，也可以直接对它提出你的具体问题。';
    },

    // 首页：进入侧边栏先展示落地页（新对话 + 最近会话），不直接进上次会话
    renderChatHome() {
        this._chatHome = true;
        const messages = document.getElementById('ai-chat-messages');
        const titleEl = document.getElementById('ai-session-title');
        const panel = document.getElementById('ai-chat-panel');
        if (panel) panel.classList.add('chat-home');
        if (titleEl) { titleEl.textContent = 'AI 学习助手'; titleEl.title = ''; }
        if (!messages) return;

        const sessions = this._loadSessions();
        const recent = sessions.slice(0, 6);
        const recentHtml = recent.length ? `
            <div class="chat-home-recent">
                <div class="chat-home-recent-title">继续最近的对话</div>
                ${recent.map(s => `
                    <button class="chat-home-session" data-session-id="${s.id}">
                        <span class="chat-home-session-title">${this.escapeHtml(s.title || '新对话')}</span>
                        <span class="chat-home-session-time">${this._fmtSessionTime(s.updatedAt)} · ${s.messages.length} 条</span>
                    </button>`).join('')}
            </div>` : '';

        messages.innerHTML = `
            <div class="chat-home">
                <div class="chat-home-hero">
                    <div class="chat-home-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    </div>
                    <h3>AI 学习助手</h3>
                    <p>解释概念、随时答疑。选中正文即可针对那段内容提问。</p>
                    <button class="chat-home-new btn btn-primary">＋ 开始新对话</button>
                </div>
                ${recentHtml}
            </div>`;

        messages.querySelector('.chat-home-new')?.addEventListener('click', () => this.createChatSession(true));
        messages.querySelectorAll('.chat-home-session').forEach(btn => {
            btn.addEventListener('click', () => this.switchChatSession(btn.dataset.sessionId));
        });
    },

    renderActiveSession() {
        this._chatHome = false;
        const messages = document.getElementById('ai-chat-messages');
        const titleEl = document.getElementById('ai-session-title');
        const panel = document.getElementById('ai-chat-panel');
        if (panel) panel.classList.remove('chat-home');
        if (!messages) return;
        const s = this._getActiveSession();
        messages.innerHTML = '';
        if (titleEl) {
            titleEl.textContent = s?.title || 'AI 学习助手';
            titleEl.title = s?.title || '';
        }
        if (!s || s.messages.length === 0) {
            this._appendMessageDOM(this._sessionGreeting(), 'assistant', { greeting: true });
            return;
        }
        s.messages.forEach((m, i) => {
            const prevUser = (m.role === 'assistant' && s.messages[i - 1]?.role === 'user')
                ? s.messages[i - 1].content : null;
            this._appendMessageDOM(m.content, m.role, { context: m.context, prevUser });
        });
    },

    renderSessionsList() {
        const list = document.getElementById('ai-sessions-list');
        if (!list) return;
        const sessions = this._loadSessions();
        const activeId = localStorage.getItem(this._chatActiveKey());
        if (!sessions.length) {
            list.innerHTML = '<p class="ai-sessions-empty">还没有历史会话</p>';
            return;
        }
        list.innerHTML = sessions.map(s => `
            <div class="ai-session-item ${s.id === activeId ? 'active' : ''}" data-session-id="${s.id}">
                <div class="ai-session-item-main">
                    <div class="ai-session-item-title">${this.escapeHtml(s.title || '新对话')}</div>
                    <div class="ai-session-item-time">${this._fmtSessionTime(s.updatedAt)} · ${s.messages.length} 条</div>
                </div>
                <button class="ai-session-del" data-session-id="${s.id}" title="删除会话">✕</button>
            </div>`).join('');
        list.querySelectorAll('.ai-session-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.ai-session-del')) return;
                this.switchChatSession(el.dataset.sessionId);
            });
        });
        list.querySelectorAll('.ai-session-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('删除此会话？此操作不可撤销。')) this.deleteChatSession(btn.dataset.sessionId);
            });
        });
    },

    _fmtSessionTime(iso) {
        const d = new Date(iso);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    },

    _appendMessageDOM(text, role, opts = {}) {
        const messages = document.getElementById('ai-chat-messages');
        if (!messages) return null;
        const userSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        const botSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
        const div = document.createElement('div');
        div.className = `ai-message ai-message-${role}`;
        const body = role === 'assistant' ? this.formatAIResponse(text) : `<p>${this.escapeHtml(text)}</p>`;
        // 仅当回答是针对"选中的正文段落"（带 context）时才提供保存为笔记
        const canSave = role === 'assistant' && !opts.greeting && !!opts.context;
        const actions = canSave
            ? `<div class="ai-msg-actions"><button class="ai-msg-save" title="保存这条回答为笔记">
                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                   存为笔记</button></div>`
            : '';
        div.innerHTML = `
            <div class="ai-message-avatar">${role === 'user' ? userSvg : botSvg}</div>
            <div class="ai-message-content">${body}${actions}</div>
        `;
        messages.appendChild(div);
        // 渲染回答中的 LaTeX 公式（与正文一致）
        if (role === 'assistant' && typeof renderMathInElement !== 'undefined') {
            try {
                renderMathInElement(div.querySelector('.ai-message-content'), {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            } catch (e) { /* 公式渲染失败不影响文本 */ }
        }
        messages.scrollTop = messages.scrollHeight;
        if (canSave) {
            const saveBtn = div.querySelector('.ai-msg-save');
            const ctx = opts.context;
            saveBtn.addEventListener('click', () => {
                this._saveExplanationAsNote(ctx, text, this.state.currentChapter);
                saveBtn.classList.add('saved');
                saveBtn.innerHTML = '已保存 ✓';
            });
        }
        return div;
    },

    async _sendChatMessage(text, opts = {}) {
        if (!text || !text.trim()) return;
        text = text.trim();

        // 在首页发消息 → 新开一个会话（不接续上次的会话）
        if (this._chatHome) {
            this.createChatSession(false);
            this.renderActiveSession();
        } else {
            this._ensureActiveSession();
        }

        this._appendMessageDOM(text, 'user', { context: opts.context });
        this._updateActiveSession(s => {
            s.messages.push({ role: 'user', content: text, context: opts.context });
            if (!s.title || s.title === '新对话') {
                s.title = (opts.context || text).slice(0, 24);
            }
        });
        const titleEl = document.getElementById('ai-session-title');
        const active = this._getActiveSession();
        if (titleEl && active) { titleEl.textContent = active.title; titleEl.title = active.title; }
        this.renderSessionsList();

        this.showTypingIndicator();
        try {
            const reply = await this.generateAIResponse(text);
            this.removeTypingIndicator();
            this._appendMessageDOM(reply, 'assistant', { context: opts.context });
            this._updateActiveSession(s => s.messages.push({ role: 'assistant', content: reply, context: opts.context }));
            this.renderSessionsList();
        } catch (error) {
            this.removeTypingIndicator();
            this._appendMessageDOM('抱歉，处理你的问题时出现了错误。请稍后重试。', 'assistant', { greeting: true });
        }
    },

    _saveExplanationAsNote(selectedText, explanation, chapter) {
        const noteId = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const noteEntry = {
            id: noteId,
            context: selectedText.substring(0, 300),
            content: explanation,
            chapter: chapter?.id,
            chapterTitle: chapter?.title,
            timestamp: new Date().toISOString()
        };

        if (!this.state.behaviorData.notes) this.state.behaviorData.notes = [];
        this.state.behaviorData.notes.push(noteEntry);
        this.saveBehaviorData(true);
        this._syncNoteToSupabase(noteEntry);

        // Close sidebar so user can see the annotation
        this.closeAISidebar();

        const renderedContent = this.formatAIResponse(explanation);

        const insertAnnotation = (ann, insertAfter) => {
            if (insertAfter.nextSibling) {
                insertAfter.parentNode.insertBefore(ann, insertAfter.nextSibling);
            } else {
                insertAfter.parentNode.appendChild(ann);
            }
            setTimeout(() => ann.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        };

        const bindDelete = (ann, markEl) => {
            ann.querySelector('.note-annotation-delete').addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (confirm('删除此笔记？关联的高亮也将取消。')) {
                    this.state.behaviorData.notes = (this.state.behaviorData.notes || [])
                        .filter(n => n.id !== noteId);
                    this.saveBehaviorData(true);
                    this._deleteNoteFromSupabase(noteId);
                    ann.remove();
                    if (markEl) {
                        if (markEl.parentNode) markEl.replaceWith(document.createTextNode(markEl.textContent));
                    }
                    this.showToast('笔记已删除', 'info');
                }
            });
        };

        const contentEl = document.querySelector('.chapter-content');
        if (contentEl) {
            const mark = this._findAndHighlightText(contentEl, selectedText, noteId);
            const insertAfter = mark
                ? (mark.closest('p, li, h2, h3, h4, blockquote, td') || mark.parentElement)
                : contentEl.lastElementChild || contentEl;

            const ann = document.createElement('div');
            ann.className = 'note-annotation';
            ann.dataset.noteId = noteId;
            ann.innerHTML = `
                <div class="note-annotation-header">
                    <span class="note-annotation-label">🤖 AI 笔记</span>
                    <span class="note-annotation-delete" data-note-id="${noteId}">✕ 删除</span>
                </div>
                <div class="note-annotation-content">${renderedContent}</div>
            `;
            insertAnnotation(ann, insertAfter);
            bindDelete(ann, mark);
        }

        this.showToast('AI 解释已保存为笔记', 'success');
    },

    openAISidebar() {
        const sidebar = document.getElementById('ai-sidebar');
        const toggle = document.getElementById('ai-sidebar-toggle');
        const app = document.getElementById('app');
        if (sidebar) sidebar.classList.add('open');
        if (toggle) toggle.classList.add('hidden');
        if (app) app.classList.add('ai-open');
    },

    closeAISidebar() {
        const sidebar = document.getElementById('ai-sidebar');
        const toggle = document.getElementById('ai-sidebar-toggle');
        const app = document.getElementById('app');
        if (sidebar) sidebar.classList.remove('open');
        if (toggle) toggle.classList.remove('hidden');
        if (app) app.classList.remove('ai-open');
    },

    buildSystemPrompt(user, context) {
        const parts = [];

        parts.push('你是一位纳米制造技术专家，正在帮助用户学习《纳米制造技术：原理、工艺与实践》。请使用Markdown格式输出，包括标题、列表、粗体等，让内容结构清晰易读。');
        parts.push('所有数学公式必须使用 LaTeX 语法：行内公式用 $...$ 包裹，独立成行的公式用 $$...$$ 包裹。绝对不要用方括号 [ ] 或圆括号 ( ) 来包裹公式。例如：行内写 $N_A$、$\\Delta\\lambda$，独立公式写 $$\\Delta\\lambda = \\frac{1.22\\lambda}{N_A}$$。');

        // 回答风格：保持用户学习心流，只给问题的直接答案
        parts.push('【回答风格——必须严格遵守】');
        parts.push('1. 用户唯一关心的是问题本身的答案。直接、高效地解释，不要寒暄、不要铺垫、不要总结性的客套话。');
        parts.push('2. 严禁夸奖用户、严禁评价问题（不要说"这是个好问题""很有意思""很激动人心"之类）、严禁告诉用户已经学了多少或进度如何。');
        parts.push('3. 你会收到用户的画像和学习数据，用它们在后台决定"解释什么、解释到多深、用什么例子"——但这是算法内部的事。绝对不要向用户复述或声明你结合了他的数据（不要出现"根据你的背景""结合你的笔记""考虑到你的进度"这类话），让个性化自然体现在答案里即可。');
        parts.push('4. 不要在回答末尾附加"下一步学习建议""推荐复习""延伸阅读"等指导性内容。除非用户明确询问下一步学什么，否则只回答当前问题。');

        if (user) {
            const levelMap = { zero: '毫无基础', beginner: '初学者', intermediate: '中级', advanced: '高级' };
            parts.push(`用户学习水平：${levelMap[user.level] || user.level || '初学者'}`);
            parts.push(`专业背景：${user.background || '学生'}`);

            if (user.motivation?.length > 0) {
                const motivationMap = {
                    course: '课程学习',
                    research: '科研需要',
                    career: '职业发展',
                    interest: '个人兴趣'
                };
                const motivations = user.motivation.map(m => motivationMap[m] || m).join('、');
                parts.push(`学习动机：${motivations}`);
            }

            if (user.prerequisite?.length > 0) {
                const prereqMap = {
                    physics: '大学物理',
                    chemistry: '化学/材料',
                    electronics: '电子工程',
                    semiconductor: '半导体器件',
                    none: '无特定基础',
                    zero: '毫无基础'
                };
                const prereqs = user.prerequisite.map(p => prereqMap[p] || p).join('、');
                parts.push(`先修知识：${prereqs}`);
            }

            if (user.learningStyle?.length > 0) {
                const styleMap = {
                    theory: '理论推导',
                    visual: '图表可视化',
                    practical: '工艺实践',
                    case: '案例分析'
                };
                const styles = user.learningStyle.map(s => styleMap[s] || s).join('、');
                parts.push(`偏好学习方式：${styles}`);
            }

            if (user.interestArea?.length > 0) {
                const areaMap = {
                    semiconductor: '半导体集成电路',
                    photonics: '光子学/光电子',
                    biotech: '纳米生物技术',
                    energy: '能源/电池',
                    mems: 'MEMS/NEMS',
                    quantum: '量子计算'
                };
                const areas = user.interestArea.map(a => areaMap[a] || a).join('、');
                parts.push(`感兴趣领域：${areas}`);
            }

            if (user.resume) {
                parts.push(`个人简介：${user.resume}`);
            }
            if (user.scores) {
                parts.push(`相关课程成绩：${user.scores}`);
            }
            if (user.currentProject) {
                parts.push(`当前项目：${user.currentProject}`);
            }
            if (user.futureProject) {
                parts.push(`未来计划：${user.futureProject}`);
            }
            if (user.learningReason) {
                parts.push(`学习原因：${user.learningReason}`);
            }

            if (user.behaviorProfile) {
                const bp = user.behaviorProfile;
                if (bp.weakTopics?.length > 0) {
                    parts.push(`薄弱环节：${bp.weakTopics.join('、')}`);
                }
                if (bp.strongTopics?.length > 0) {
                    parts.push(`擅长领域：${bp.strongTopics.join('、')}`);
                }
                if (bp.quizAccuracy > 0) {
                    parts.push(`Quiz正确率：${Math.round(bp.quizAccuracy * 100)}%`);
                }
                if (bp.avgSessionTime > 0) {
                    parts.push(`平均学习时长：${Math.round(bp.avgSessionTime / 60)}分钟`);
                }
            }
        }

        if (context === 'explanation') {
            parts.push('根据用户画像在后台决定解释的深度和方式（不要声明你这样做了）：');
            parts.push('- 毫无基础：用最简单的生活类比，避免任何术语，解释为什么这个概念重要');
            parts.push('- 初学者：多用类比，避免复杂公式，强调直观理解');
            parts.push('- 中级：引入技术参数，解释物理机制，联系实际工艺');
            parts.push('- 高级：深入工程细节，讨论优化策略，引用最新进展');
            parts.push('- 按学习动机调整侧重点、按先修知识决定数学深度、按感兴趣领域选取例子');
            parts.push('- 结合用户当前正在阅读的章节上下文进行解释，不要孤立解释概念');
            parts.push('- 直接给出对选中内容/问题的解释，不要附加学习建议或进度评价');
        } else if (context === 'chat') {
            parts.push('你会收到用户的个人学习数据（笔记、答题记录、学习进度、行为画像等），用它们在后台让回答更贴合用户，但不要复述这些数据或声明你结合了它们。');
            parts.push('- 直接回答用户的问题，保持简洁高效');
            parts.push('- 仅当用户明确询问"下一步学什么""我哪里薄弱"等时，才结合进度与弱项给出建议；普通概念问题不要附加学习建议');
            parts.push('- 如果用户要求列出具体内容（笔记、错题等），从数据中逐一提取，不要遗漏');
        }

        parts.push('使用中文回答，保持专业但友好的语气。');

        return parts.join('\n');
    },

    async callAIProvider(provider, model, messages, maxTokens = 1500, temperature = 0.7) {
        const edgeUrl = SUPABASE_URL + '/functions/v1/ai-proxy';

        // Try Supabase Edge Function first (server-side keys)
        if (this.supabase) {
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY
                };
                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }

                const resp = await fetch(edgeUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ provider, model, messages, temperature, max_tokens: maxTokens })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.content) {
                        this._logAIQuery(provider, model, messages, data.content);
                        return data.content;
                    }
                    console.warn(`Edge function returned error for ${provider}:`, data.error);
                }
            } catch (err) {
                console.warn(`Edge function unavailable for ${provider}:`, err.message);
            }
        }

        // Fallback: user's own API keys (DeepSeek / Gemini only)
        if (provider === 'deepseek') {
            const key = localStorage.getItem('deepseek_api_key');
            if (key) {
                const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: model || 'deepseek-chat', messages, temperature, max_tokens: maxTokens })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const content = data.choices[0].message.content;
                    this._logAIQuery(provider, model, messages, content);
                    return content;
                }
            }
        }

        if (provider === 'gemini') {
            const key = localStorage.getItem('gemini_api_key');
            if (key) {
                const systemMsg = messages.find(m => m.role === 'system');
                const userMsgs = messages.filter(m => m.role !== 'system');
                const promptText = (systemMsg ? systemMsg.content + '\n\n' : '') +
                    userMsgs.map(m => m.content).join('\n');

                const resp = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${key}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: promptText }] }],
                            generationConfig: { temperature, maxOutputTokens: maxTokens }
                        })
                    }
                );
                if (resp.ok) {
                    const data = await resp.json();
                    const content = data.candidates[0].content.parts[0].text;
                    this._logAIQuery(provider, model, messages, content);
                    return content;
                }
            }
        }

        if (provider === 'zhipu') {
            throw new Error('智谱 AI 需要通过 Edge Function 使用。请部署 supabase/functions/ai-proxy 并设置 ZHIPU_API_KEY 环境变量。');
        }

        throw new Error(`No API key configured for ${provider}`);
    },

    async generateExplanation(text, chapterContext = '', question = '') {
        const user = this.state.user;
        const level = user?.level || 'beginner';
        const provider = localStorage.getItem('ai_provider') || 'zhipu';

        let userContent;
        if (question) {
            userContent = `用户选中了以下文本："${text}"\n\n用户提出的问题：${question}`;
            if (chapterContext) userContent += `\n\n${chapterContext}`;
            userContent += `\n\n请针对用户的问题进行解释，结合选中的文本内容进行回答。`;
        } else if (chapterContext) {
            userContent = `请解释以下纳米制造技术概念："${text}"\n\n${chapterContext}`;
        } else {
            userContent = `请解释以下纳米制造技术概念："${text}"`;
        }

        const systemPrompt = this.buildSystemPrompt(user, 'explanation');
        const model = provider === 'zhipu' ? 'glm-4-flash' : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat';

        try {
            const response = await this.callAIProvider(provider, model, [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ], 1500);
            return response;
        } catch (error) {
            console.error('AI explanation error:', error);
        }

        this.showToast('AI 服务暂时不可用，正在使用本地解释', 'warning');
        await new Promise(resolve => setTimeout(resolve, 1500));

        const explanations = {
            beginner: `基于您的初学者背景，这里为您详细解释：<strong>"${text}"</strong><br><br>
                这个概念是纳米制造的基础知识。简单来说，它涉及到如何在极小的尺度上（比头发丝还要细数千倍）制造精密的结构。<br><br>
                对于初学者，建议重点关注：<br>
                1. 理解基本概念和术语<br>
                2. 了解这项技术为什么重要<br>
                3. 记住关键参数和数值<br><br>
                如果您觉得内容太抽象，建议结合后面的实际应用案例来理解。`,

            intermediate: `基于您的中级背景，这里为您深入解释：<strong>"${text}"</strong><br><br>
                您已经具备了一定的理论基础，所以我们可以从技术细节的角度来分析这个概念。<br><br>
                关键点在于理解其物理机制和工艺限制。建议您：<br>
                1. 关注技术参数之间的相互关系<br>
                2. 思考不同工艺条件的权衡<br>
                3. 联系您已有的知识框架<br><br>
                这个概念与后续章节的工艺实践密切相关。`,

            advanced: `基于您的高级背景，这里为您提供专业级分析：<strong>"${text}"</strong><br><br>
                从工程实践的角度，这个概念的核心在于优化工艺窗口和良率控制。<br><br>
                建议您关注：<br>
                1. 工艺参数的敏感性和容差分析<br>
                2. 与其他工艺步骤的集成问题<br>
                3. 实际生产中的挑战和解决方案<br><br>
                这部分内容与第十一章的工艺配方手册有直接关联。`
        };

        return explanations[level] || explanations.beginner;
    },

    renderAILearningPath() {
        const container = document.getElementById('ai-learning-path-content');
        const refreshBtn = document.getElementById('refresh-ai-path');
        if (!container) return;

        const user = this.state.user;
        if (!user) {
            container.innerHTML = '<p class="ai-path-loading">请先完成注册和个人资料设置。</p>';
            return;
        }

        if (this.state.completedChapters.size === 0) {
            container.innerHTML = '<p class="ai-path-loading">完成更多章节和测试后，AI 将为您生成个性化学习建议。</p>';
            if (refreshBtn) refreshBtn.style.display = 'none';
            return;
        }

        // Show client-side fallback first
        const fallback = this.buildLearningPath(user);
        this.renderPathResult(container, refreshBtn, fallback);

        // Then try AI for better recommendations (silently update)
        const savedPath = localStorage.getItem('nanofab_ai_path');
        if (savedPath) {
            try {
                const cached = JSON.parse(savedPath);
                if (cached.timestamp && (Date.now() - cached.timestamp < 3600000)) {
                    this.renderPathResult(container, refreshBtn, cached.data);
                    return;
                }
            } catch {}
        }

        this.fetchAILearningPath(user).then(aiPath => {
            if (aiPath) {
                localStorage.setItem('nanofab_ai_path', JSON.stringify({
                    data: aiPath,
                    timestamp: Date.now()
                }));
                this.renderPathResult(container, refreshBtn, aiPath);
            }
        });
    },

    buildLearningPath(user) {
        const bp = user.behaviorProfile || {};
        const completed = [...this.state.completedChapters];
        const all = this.getAllChapters();
        const remaining = all.filter(c => !this.state.completedChapters.has(c.id));

        const nextChapter = remaining[0];
        const reviewChapters = (bp.weakTopics || [])
            .map(id => all.find(c => c.id === id))
            .filter(Boolean)
            .map(c => c.title);
        const masteredChapters = (bp.strongTopics || [])
            .map(id => all.find(c => c.id === id))
            .filter(Boolean)
            .map(c => c.title);

        const tips = [];
        const style = user.learningStyle || [];

        if (style.includes('visual')) tips.push('多关注图表和流程图来加深理解');
        if (style.includes('theory')) tips.push('深入推导公式背后的物理机制');
        if (style.includes('practical')) tips.push('结合工艺实践案例理解理论');
        if (style.includes('case')) tips.push('通过实际应用案例验证所学知识');
        if (bp.quizAccuracy > 0 && bp.quizAccuracy < 0.6) tips.push('建议先复习薄弱章节再继续新课');

        return {
            next: nextChapter ? nextChapter.title : '所有章节已完成',
            review: reviewChapters,
            mastered: masteredChapters,
            accuracy: bp.quizAccuracy ? Math.round(bp.quizAccuracy * 100) : 0,
            tips: tips.length > 0 ? tips : ['继续按章节顺序学习，完成测试巩固理解']
        };
    },

    renderPathResult(container, refreshBtn, path) {
        const sections = [];
        if (path.next) {
            sections.push(`<div class="ai-path-section">
                <h4>📖 推荐下一步</h4><p>${path.next}</p></div>`);
        }
        if (path.review?.length > 0) {
            sections.push(`<div class="ai-path-section review">
                <h4>🔁 需要复习</h4><p>${path.review.join('、')}</p></div>`);
        }
        if (path.mastered?.length > 0) {
            sections.push(`<div class="ai-path-section mastered">
                <h4>✅ 已掌握</h4><p>${path.mastered.join('、')}</p></div>`);
        }
        if (path.accuracy > 0) {
            sections.push(`<p style="font-size:0.8125rem;color:var(--color-text-secondary);margin:0;">测试正确率：${path.accuracy}%</p>`);
        }
        if (path.tips?.length > 0) {
            sections.push(`<div class="ai-path-section">
                <h4>💡 学习建议</h4><p>${path.tips.join('；')}</p></div>`);
        }

        container.innerHTML = `<div class="ai-path-result">${sections.join('')}</div>`;
        if (refreshBtn) {
            refreshBtn.style.display = 'inline-flex';
            refreshBtn.onclick = () => {
                localStorage.removeItem('nanofab_ai_path');
                this.renderAILearningPath();
            };
        }
    },

    async fetchAILearningPath(user) {
        const completed = [...this.state.completedChapters];
        const all = this.getAllChapters();
        const remaining = all.filter(c => !this.state.completedChapters.has(c.id));
        const bp = user.behaviorProfile || {};

        const prompt = `你是纳米制造学习顾问。根据以下用户数据，以JSON格式返回个性化学习路线（直接返回JSON，不要其他文字）：

{"next":"推荐下一步学习的章节名称及简短理由（20字内）","review":"需要重点复习的章节（用顿号分隔，无则填无）","mastered":"已掌握的章节（用顿号分隔，无则填无）","tips":["学习策略建议1","建议2"]}

用户数据：水平${user.level}，已学${completed.join('、')}，待学${remaining.map(c=>c.title).join('、')}，弱项${(bp.weakTopics||[]).join('、')}，强项${(bp.strongTopics||[]).join('、')}，正确率${Math.round((bp.quizAccuracy||0)*100)}%，偏好${(user.learningStyle||[]).join('、')}，兴趣${(user.interestArea||[]).join('、')}`;

        try {
            const response = await this.callAI(prompt, 'chat');
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('AI learning path generation failed:', error);
        }
        return null;
    },

    async callAI(prompt, context) {
        const user = this.state.user;
        const provider = localStorage.getItem('ai_provider') || 'zhipu';
        const systemPrompt = this.buildSystemPrompt(user, context) + '\n请直接返回用户请求的内容，不要附加额外说明。';
        const model = provider === 'zhipu' ? 'glm-4-flash' : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat';

        return await this.callAIProvider(provider, model, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ], 500);
    },

    initAIAssistant() {
        const sidebarToggle = document.getElementById('ai-sidebar-toggle');
        const sidebarClose = document.getElementById('ai-sidebar-close');
        const sidebar = document.getElementById('ai-sidebar');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                if (sidebar.classList.contains('open')) this.closeAISidebar();
                else this.openAISidebar();
            });
        }

        if (sidebarClose && sidebar) {
            sidebarClose.addEventListener('click', () => this.closeAISidebar());
        }

        // 会话：历史抽屉 + 新建
        const sessionsToggle = document.getElementById('ai-sessions-toggle');
        const sessionsDrawer = document.getElementById('ai-sessions-drawer');
        if (sessionsToggle && sessionsDrawer) {
            sessionsToggle.addEventListener('click', () => {
                sessionsDrawer.classList.toggle('hidden');
                if (!sessionsDrawer.classList.contains('hidden')) this.renderSessionsList();
            });
        }
        document.getElementById('ai-new-session')?.addEventListener('click', () => this.createChatSession(true));
        document.getElementById('ai-new-session-2')?.addEventListener('click', () => this.createChatSession(true));

        // 返回 AI 首页（按钮 + 点标题）
        const goHome = () => { this._closeSessionsDrawer(); this.renderChatHome(); };
        document.getElementById('ai-home-btn')?.addEventListener('click', goHome);
        const titleEl = document.getElementById('ai-session-title');
        if (titleEl) {
            titleEl.style.cursor = 'pointer';
            titleEl.title = '返回 AI 首页';
            titleEl.addEventListener('click', goHome);
        }

        // 进入侧边栏默认展示首页（不直接进入上次会话）
        this.renderChatHome();

        const input = document.getElementById('ai-chat-input');
        const send = document.getElementById('ai-chat-send');
        const messages = document.getElementById('ai-chat-messages');

        const settingsToggle = document.getElementById('ai-settings-toggle');
        const settingsPanel = document.getElementById('ai-settings-panel');
        const deepseekKeyInput = document.getElementById('deepseek-api-key');
        const geminiKeyInput = document.getElementById('gemini-api-key');
        const saveApiKeyBtn = document.getElementById('save-api-key');
        const providerRadios = document.querySelectorAll('input[name="ai-provider"]');
        const zhipuSettings = document.getElementById('zhipu-settings');
        const deepseekSettings = document.getElementById('deepseek-settings');
        const geminiSettings = document.getElementById('gemini-settings');

        if (settingsToggle && settingsPanel) {
            settingsToggle.addEventListener('click', () => {
                settingsPanel.classList.toggle('hidden');
            });
        }

        const savedProvider = localStorage.getItem('ai_provider') || 'zhipu';
        const savedDeepseekKey = localStorage.getItem('deepseek_api_key');
        const savedGeminiKey = localStorage.getItem('gemini_api_key');
        
        providerRadios.forEach(radio => {
            if (radio.value === savedProvider) {
                radio.checked = true;
            }
        });
        
        if (savedProvider === 'zhipu') {
            if (zhipuSettings) zhipuSettings.classList.remove('hidden');
            if (deepseekSettings) deepseekSettings.classList.add('hidden');
            if (geminiSettings) geminiSettings.classList.add('hidden');
        } else if (savedProvider === 'gemini') {
            if (zhipuSettings) zhipuSettings.classList.add('hidden');
            if (deepseekSettings) deepseekSettings.classList.add('hidden');
            if (geminiSettings) geminiSettings.classList.remove('hidden');
        } else {
            if (zhipuSettings) zhipuSettings.classList.add('hidden');
            if (deepseekSettings) deepseekSettings.classList.remove('hidden');
            if (geminiSettings) geminiSettings.classList.add('hidden');
        }
        
        if (deepseekKeyInput && savedDeepseekKey) {
            deepseekKeyInput.value = savedDeepseekKey;
        }
        if (geminiKeyInput && savedGeminiKey) {
            geminiKeyInput.value = savedGeminiKey;
        }

        providerRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'zhipu') {
                    if (zhipuSettings) zhipuSettings.classList.remove('hidden');
                    if (deepseekSettings) deepseekSettings.classList.add('hidden');
                    if (geminiSettings) geminiSettings.classList.add('hidden');
                } else if (radio.value === 'deepseek') {
                    if (zhipuSettings) zhipuSettings.classList.add('hidden');
                    if (deepseekSettings) deepseekSettings.classList.remove('hidden');
                    if (geminiSettings) geminiSettings.classList.add('hidden');
                } else {
                    if (zhipuSettings) zhipuSettings.classList.add('hidden');
                    if (deepseekSettings) deepseekSettings.classList.add('hidden');
                    if (geminiSettings) geminiSettings.classList.remove('hidden');
                }
            });
        });

        if (saveApiKeyBtn) {
            saveApiKeyBtn.addEventListener('click', () => {
                const selectedProvider = document.querySelector('input[name="ai-provider"]:checked')?.value || 'zhipu';
                localStorage.setItem('ai_provider', selectedProvider);
                
                const deepseekKey = deepseekKeyInput?.value.trim();
                const geminiKey = geminiKeyInput?.value.trim();
                
                if (deepseekKey) {
                    localStorage.setItem('deepseek_api_key', deepseekKey);
                } else {
                    localStorage.removeItem('deepseek_api_key');
                }
                
                if (geminiKey) {
                    localStorage.setItem('gemini_api_key', geminiKey);
                } else {
                    localStorage.removeItem('gemini_api_key');
                }
                
                this.showToast('设置已保存', 'success');
                if (settingsPanel) settingsPanel.classList.add('hidden');
            });
        }

        const sendMessage = async () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            input.style.height = 'auto';
            this._sendChatMessage(text);
        };

        send.addEventListener('click', sendMessage);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });
    },

    showTypingIndicator() {
        const messages = document.getElementById('ai-chat-messages');
        if (!messages) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message ai-message-assistant ai-typing';
        typingDiv.innerHTML = `
            <div class="ai-message-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
            </div>
            <div class="ai-typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        messages.appendChild(typingDiv);
        messages.scrollTop = messages.scrollHeight;
    },

    removeTypingIndicator() {
        const typing = document.querySelector('.ai-typing');
        if (typing) typing.remove();
    },

    _buildDataContext() {
        const behaviorData = this.state.behaviorData || {};
        const sections = [];

        // ── Notes ──
        const notes = behaviorData.notes || [];
        if (notes.length > 0) {
            const allChapters = this.getAllChapters();
            const notesText = notes.map((n, i) => {
                const ch = allChapters.find(c => c.id === n.chapter);
                const chName = ch ? ch.title : (n.chapterTitle || '未知章节');
                const ctx = (n.context || '').substring(0, 80);
                const content = (n.content || '').substring(0, 200);
                return `${i + 1}. [${chName}] 原文："${ctx}"\n   笔记：${content}`;
            }).join('\n');
            sections.push(`【笔记】共 ${notes.length} 条：\n${notesText}`);
        }

        // ── Quiz results ──
        const quizResults = behaviorData.quizResults || [];
        if (quizResults.length > 0) {
            const correctCount = quizResults.filter(r => r.correct).length;
            const wrongAnswers = quizResults.filter(r => !r.correct);
            const accuracy = Math.round((correctCount / quizResults.length) * 100);
            let quizText = `【答题记录】共 ${quizResults.length} 题，正确 ${correctCount} 题，正确率 ${accuracy}%。`;
            if (wrongAnswers.length > 0) {
                const allChapters = this.getAllChapters();
                const wrongText = wrongAnswers.map((w, i) => {
                    const ch = allChapters.find(c => c.id === w.chapter);
                    const chName = ch ? ch.title : (w.chapter || '未知章节');
                    const question = w.question || '未知题目';
                    const userAnswer = w.userAnswer || w.selected || '未作答';
                    return `${i + 1}. [${chName}] ${question}\n   用户答案：${userAnswer}`;
                }).join('\n');
                quizText += `\n错题列表（${wrongAnswers.length} 道）：\n${wrongText}`;
            }
            sections.push(quizText);
        }

        // ── Study progress ──
        const completed = [...this.state.completedChapters];
        const all = this.getAllChapters();
        const total = all.length;
        const done = completed.length;
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        const remaining = all.filter(c => !this.state.completedChapters.has(c.id));
        let progressText = `【学习进度】已完成 ${done}/${total}（${percent}%）。`;
        if (completed.length > 0) {
            const completedNames = completed.map(id => {
                const ch = all.find(c => c.id === id);
                return ch ? ch.title : id;
            });
            progressText += `\n已完成章节：${completedNames.join('、')}`;
        }
        if (remaining.length > 0) {
            progressText += `\n待学习章节：${remaining.map(c => c.title).join('、')}`;
        }
        sections.push(progressText);

        // ── Time spent per chapter ──
        const timeSpent = behaviorData.timeSpent || {};
        const timeEntries = Object.entries(timeSpent).filter(([, t]) => typeof t === 'number' && t > 0);
        if (timeEntries.length > 0) {
            const totalSeconds = timeEntries.reduce((sum, [, t]) => sum + t, 0);
            const sorted = timeEntries.sort(([, a], [, b]) => b - a);
            const timeText = sorted.map(([chId, sec]) => {
                const ch = all.find(c => c.id === chId);
                const name = ch ? ch.title : chId;
                return `  ${name}：${Math.round(sec / 60)}分钟`;
            }).join('\n');
            sections.push(`【学习时长分布】总计 ${Math.round(totalSeconds / 60)} 分钟：\n${timeText}`);
        }

        // ── Behavior profile (from user object, supplementing systemPrompt) ──
        const bp = this.state.user?.behaviorProfile;
        if (bp) {
            const bpParts = [];
            if (bp.weakTopics?.length > 0) bpParts.push(`薄弱环节：${bp.weakTopics.join('、')}`);
            if (bp.strongTopics?.length > 0) bpParts.push(`擅长领域：${bp.strongTopics.join('、')}`);
            if (bp.preferredContentTypes?.length > 0) bpParts.push(`偏好内容类型：${bp.preferredContentTypes.join('、')}`);
            if (bpParts.length > 0) sections.push(`【行为画像】\n${bpParts.join('\n')}`);
        }

        // ── Latest interactions (recent context) ──
        const interactions = behaviorData.interactions || [];
        if (interactions.length > 0) {
            const recent = interactions.slice(-10).reverse();
            const recentText = recent.map(i => {
                const time = i.timestamp ? new Date(i.timestamp).toLocaleString('zh-CN') : '未知时间';
                return `  ${time} | ${i.type} | ${i.text || ''}`;
            }).join('\n');
            sections.push(`【最近操作】最近 ${recent.length} 条：\n${recentText}`);
        }

        return sections.join('\n\n');
    },

    // 从数据库读取该用户最近的 AI 问答记录（带 30s 缓存），用于回喂给 AI
    async _fetchRecentAIQueries(limit = 6) {
        if (!this.supabase) return '';
        const now = Date.now();
        if (this._aiHistoryCache && now - this._aiHistoryCache.ts < 30000) {
            return this._aiHistoryCache.text;
        }
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (!session?.user) return '';
            const { data, error } = await this.supabase
                .from('ai_queries')
                .select('query_type, user_message, ai_response, created_at')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error || !data?.length) {
                this._aiHistoryCache = { ts: now, text: '' };
                return '';
            }
            const text = data.reverse().map(q => {
                const t = q.created_at ? new Date(q.created_at).toLocaleDateString('zh-CN') : '';
                const ask = (q.user_message || '').replace(/\s+/g, ' ').slice(0, 80);
                const ans = (q.ai_response || '').replace(/\s+/g, ' ').slice(0, 100);
                return `- [${t}] 问：${ask} ｜ 答(摘要)：${ans}`;
            }).join('\n');
            this._aiHistoryCache = { ts: now, text };
            return text;
        } catch (e) {
            return '';
        }
    },

    async generateAIResponse(userMessage) {
        const lowerMsg = userMessage.toLowerCase();
        const chapter = this.state.currentChapter;
        const user = this.state.user;
        const provider = localStorage.getItem('ai_provider') || 'zhipu';

        const systemPrompt = this.buildSystemPrompt(user, 'chat');
        const messages = [{ role: 'system', content: systemPrompt }];

        if (chapter) {
            messages.push({
                role: 'system',
                content: `用户当前正在学习章节：${chapter.title}。章节描述：${chapter.description}`
            });
        }

        // Always inject full user data context for personalized responses
        const dataContext = this._buildDataContext();
        if (dataContext) {
            messages.push({
                role: 'system',
                content: `以下是用户在本学习平台上的个人数据，仅供你在后台理解用户、调整回答的深度与例子。不要在回答中复述、引用或声明你用了这些数据（除非用户明确要求列出他的笔记/错题等具体内容，此时逐一列出不要省略）。\n\n${dataContext}`
            });
        }

        // 注入用户跨会话的历史 AI 问答（从数据库读取），让 AI 了解用户长期关注点与盲区
        const aiHistory = await this._fetchRecentAIQueries();
        if (aiHistory) {
            messages.push({
                role: 'system',
                content: `【该用户以往向 AI 提过的问题与回答摘要】（用于理解用户的长期关注点和反复出现的知识盲区。请据此让回答更有针对性、避免重复啰嗦、可在已有基础上进一步深入）：\n${aiHistory}`
            });
        }

        // 注入当前会话的多轮上下文（_sendChatMessage 已将本条 user 消息写入会话）
        const session = this._getActiveSession();
        const history = (session?.messages || []).slice(-12);
        if (history.length) {
            history.forEach(m => messages.push({ role: m.role, content: m.content }));
        } else {
            messages.push({ role: 'user', content: userMessage });
        }

        const model = provider === 'zhipu' ? 'glm-4-flash' : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat';

        try {
            return await this.callAIProvider(provider, model, messages, 2000);
        } catch (error) {
            console.error('AI response error:', error);
        }

        this.showToast('AI 服务暂时不可用，使用离线回答', 'warning');

        if (lowerMsg.includes('你好') || lowerMsg.includes('hi') || lowerMsg.includes('hello')) {
            return '你好！我是你的AI学习助手。在学习纳米制造技术的过程中有任何问题，都可以随时问我！';
        }

        if (lowerMsg.includes('测试') || lowerMsg.includes('quiz') || lowerMsg.includes('题目')) {
            return '每个章节结束后都有小测试，包含10道题目。你可以通过点击"小测试"标签来查看和完成这些题目。';
        }

        if (lowerMsg.includes('进度') || lowerMsg.includes('完成')) {
            const completed = this.state.completedChapters.size;
            return `你目前已完成 ${completed} / 12 个章节。继续加油！`;
        }

        if (chapter) {
            if (lowerMsg.includes('本章') || lowerMsg.includes('这章') || lowerMsg.includes('章节')) {
                return `你当前正在学习「${chapter.title}」。这一章主要讲解${chapter.description}。有什么具体的问题吗？`;
            }

            if (lowerMsg.includes('不懂') || lowerMsg.includes('不明白') || lowerMsg.includes('解释')) {
                return `关于「${chapter.title}」的内容，我可以帮你解释。请告诉我具体是哪个概念或术语让你困惑？`;
            }
        }

        if (lowerMsg.includes('纳米制造') || lowerMsg.includes('nanofab')) {
            return '纳米制造是制造特征尺寸在100纳米以下的结构和器件的技术总称。它包括自上而下（如光刻、刻蚀）和自下而上（如自组装）两大类方法。你想了解哪方面的更多细节？';
        }

        if (lowerMsg.includes('光刻') || lowerMsg.includes('lithography')) {
            return '光刻是纳米制造的核心技术，通过将掩模图案转移到光刻胶上形成图形。主要类型包括光学光刻、电子束光刻、离子束光刻等。你想了解哪种光刻技术？';
        }

        if (lowerMsg.includes('刻蚀') || lowerMsg.includes('etch')) {
            return '刻蚀是将光刻胶图案转移到基底材料中的关键工艺。主要分为湿法刻蚀（化学溶液）和干法刻蚀（等离子体）。干法刻蚀中的RIE和ICP是最常用的技术。';
        }

        if (lowerMsg.includes('沉积') || lowerMsg.includes('deposition')) {
            return '薄膜沉积是在基底表面生长薄膜材料的技术。主要方法包括物理气相沉积（PVD，如溅射、蒸发）和化学气相沉积（CVD，如PECVD、LPCVD）。ALD可以实现原子层级的厚度控制。';
        }

        if (user && user.level === 'beginner') {
            return '我理解你的问题。作为初学者，建议你先掌握基本概念，然后再深入技术细节。你可以先阅读要点卡片，完成小测试来检验理解程度。有什么具体概念需要我详细解释吗？';
        }

        return '这是一个很好的问题！基于当前章节的内容，建议你可以：\n1. 回顾本章的要点卡片\n2. 尝试完成小测试检验理解\n3. 如果还有疑问，可以高亮具体文本获取AI解释\n\n你能告诉我更具体的问题吗？这样我可以给你更准确的回答。';
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatAIResponse(text) {
        if (!text) return '';

        // 1) 统一数学定界符：\[ \] → $$ , \( \) → $
        text = text
            .replace(/\\\[/g, '$$$$').replace(/\\\]/g, '$$$$')
            .replace(/\\\(/g, '$').replace(/\\\)/g, '$');

        // 2) 保护数学片段，避免被 Markdown 解析破坏（下划线、星号、反斜杠等）
        const mathChunks = [];
        const stash = (m) => { mathChunks.push(m); return `@@MATH${mathChunks.length - 1}@@`; };
        text = text
            .replace(/\$\$([\s\S]+?)\$\$/g, (m) => stash(m))
            .replace(/\$([^\$\n]+?)\$/g, (m) => stash(m));

        const restore = (html) => html.replace(/@@MATH(\d+)@@/g, (_, i) => mathChunks[+i] || '');

        // 3) 用 marked 渲染 Markdown（表格、代码块、引用、嵌套列表等）
        if (typeof marked !== 'undefined') {
            try {
                const parse = marked.parse || (marked.marked && marked.marked.parse) || marked;
                return restore(parse(text, { breaks: true, gfm: true }));
            } catch (e) { /* 解析失败则回退到下方简易渲染 */ }
        }

        let formatted = text
            .replace(/\*\*\*(.+?)\*\*\*/g, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
            .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
            .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');

        const lines = formatted.split('\n');
        let inList = false;
        let result = [];

        lines.forEach(line => {
            const trimmed = line.trim();

            if (trimmed.startsWith('<li>')) {
                if (!inList) {
                    result.push('<ul>');
                    inList = true;
                }
                result.push(trimmed);
            } else if (inList && trimmed === '') {
                result.push('</ul>');
                inList = false;
            } else if (trimmed !== '') {
                if (inList) {
                    result.push('</ul>');
                    inList = false;
                }
                if (!trimmed.startsWith('<h')) {
                    result.push(`<p>${trimmed}</p>`);
                } else {
                    result.push(trimmed);
                }
            }
        });

        if (inList) {
            result.push('</ul>');
        }

        return restore(result.join('\n'));
    }
};
