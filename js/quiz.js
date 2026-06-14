// 动态出题模块 — 混入 App (Object.assign)
// 进入章节时按 用户画像/学习轨迹 调 generate-quiz 生成题目；按画像版本缓存，避免每次都重生成。
const QuizModule = {

    // 默认开启；用户可通过 localStorage 关闭回退到静态题
    _dynamicQuizOn() {
        return localStorage.getItem('nanofab_dynamic_quiz') !== '0';
    },

    _quizCacheKey(chapterId) {
        const uid = this._uid ? this._uid() : 'anon';
        return `nanofab_quiz_${uid}_${chapterId}`;
    },

    // 画像/轨迹"版本"：水平、弱项、该章错题数变化时即失效缓存 → 触发重生成
    _quizProfileVersion(chapterId) {
        const u = this.state.user || {};
        const bp = u.behaviorProfile || {};
        const wrong = (this.state.behaviorData.quizResults || [])
            .filter(r => r.chapter === chapterId && !r.correct).length;
        const parts = [
            u.level || '', (bp.weakTopics || []).slice().sort().join(','),
            (u.interestArea || []).slice().sort().join(','), `w${wrong}`
        ];
        return parts.join('|');
    },

    // 给出题模型的紧凑用户上下文（画像 + 该章错题）
    _buildQuizUserContext(chapterId) {
        const u = this.state.user || {};
        const levelMap = { zero: '毫无基础', beginner: '初学者', intermediate: '中级', advanced: '高级' };
        const lines = [`学习水平：${levelMap[u.level] || u.level || '初学者'}`];
        const bp = u.behaviorProfile || {};
        if (bp.weakTopics?.length) lines.push(`薄弱环节：${bp.weakTopics.join('、')}`);
        if (u.interestArea?.length) lines.push(`兴趣领域：${u.interestArea.join('、')}`);
        const wrong = (this.state.behaviorData.quizResults || [])
            .filter(r => r.chapter === chapterId && !r.correct)
            .slice(-5).map(r => r.question).filter(Boolean);
        if (wrong.length) lines.push(`本章曾答错的题(可针对性加强)：${wrong.join('；')}`);
        return lines.join('\n');
    },

    // 从本地知识索引拼接该章小节作为出题接地材料；索引缺失时回退到当前章节 DOM 正文
    async _buildQuizMaterial(chapterId) {
        const idx = await (this._loadKnowledgeIndex ? this._loadKnowledgeIndex() : null);
        if (idx?.items?.length) {
            const mat = idx.items
                .filter(it => it.chapterId === chapterId)
                .map(it => `## ${it.heading}\n${it.content}`)
                .join('\n\n').slice(0, 7000);
            if (mat) return mat;
        }
        // 回退：正在阅读该章时直接取正文
        if (this.state.currentChapter?.id === chapterId) {
            const el = document.querySelector('.chapter-content');
            if (el) return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 7000);
        }
        return '';
    },

    async loadDynamicQuiz(chapterId) {
        if (!this._dynamicQuizOn() || !this.supabase) return;
        const container = document.getElementById('quiz-content');
        if (!container) return;

        const ver = this._quizProfileVersion(chapterId);
        try {
            const cached = JSON.parse(localStorage.getItem(this._quizCacheKey(chapterId)) || 'null');
            if (cached && cached.ver === ver && Array.isArray(cached.questions) && cached.questions.length) {
                this._renderDynamicQuiz(container, cached.questions, chapterId);
                return;
            }
        } catch (e) { /* 缓存损坏忽略 */ }

        await this._fetchAndRenderQuiz(container, chapterId, ver);
    },

    async regenerateQuiz(chapterId) {
        const container = document.getElementById('quiz-content');
        if (!container) return;
        localStorage.removeItem(this._quizCacheKey(chapterId));
        await this._fetchAndRenderQuiz(container, chapterId, this._quizProfileVersion(chapterId), true);
    },

    async _fetchAndRenderQuiz(container, chapterId, ver, force = false) {
        this._setQuizStatus(container, '🤖 AI 正在根据你的情况生成题目…');
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (!session?.access_token) { this._clearQuizStatus(container); return; }

            const provider = localStorage.getItem('ai_provider') || 'zhipu';
            const model = provider === 'zhipu' ? 'glm-4-flash' : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat';

            // 出题接地材料：从本地知识索引取该章小节（不再依赖 pgvector）
            const material = await this._buildQuizMaterial(chapterId);
            if (!material) { this._clearQuizStatus(container); if (force) this.showToast('本章内容未就绪，无法生成题目', 'warning'); return; }

            const resp = await fetch(SUPABASE_URL + '/functions/v1/generate-quiz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    chapterId,
                    count: 5,
                    userContext: this._buildQuizUserContext(chapterId),
                    material,
                    provider, model,
                }),
            });
            const data = await resp.json();
            if (!resp.ok || !Array.isArray(data.questions) || !data.questions.length) {
                // 失败：保留静态题，仅在强制重生成时提示
                this._clearQuizStatus(container);
                if (force) this.showToast(data.error || 'AI 出题失败，请稍后重试', 'warning');
                return;
            }
            localStorage.setItem(this._quizCacheKey(chapterId),
                JSON.stringify({ ver, questions: data.questions, ts: Date.now() }));
            this._renderDynamicQuiz(container, data.questions, chapterId);
        } catch (e) {
            console.warn('dynamic quiz failed:', e.message);
            this._clearQuizStatus(container);
            if (force) this.showToast('AI 出题失败，请稍后重试', 'warning');
        }
    },

    _setQuizStatus(container, text) {
        let bar = container.querySelector('.quiz-dynamic-status');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'quiz-dynamic-status';
            bar.style.cssText = 'padding:10px 12px;margin-bottom:12px;border-radius:8px;background:var(--color-bg-secondary,#f1f5f9);font-size:0.875rem;color:var(--color-text-secondary,#475569);';
            container.insertBefore(bar, container.firstChild);
        }
        bar.textContent = text;
    },

    _clearQuizStatus(container) {
        const bar = container.querySelector('.quiz-dynamic-status');
        if (bar) bar.remove();
    },

    _renderDynamicQuiz(container, questions, chapterId) {
        // 移除旧题（静态或上一次生成的）与遗留的提交按钮
        container.querySelectorAll('.quiz-question').forEach(el => el.remove());
        container.querySelectorAll('.quiz-check-btn').forEach(el => el.remove());

        const esc = (t) => this.escapeHtml(t || '');
        const letters = ['a', 'b', 'c', 'd'];
        const frag = document.createDocumentFragment();

        questions.forEach((q, i) => {
            const n = i + 1;
            const opts = q.options || {};
            const optHtml = letters.map(k => `
                <label class="quiz-option">
                    <input type="radio" name="dq${n}" value="${k}">
                    <span>${k.toUpperCase()}. ${esc(opts[k])}</span>
                </label>`).join('');
            const correctLetter = String(q.correct || '').toLowerCase();
            const div = document.createElement('div');
            div.className = 'quiz-question';
            div.dataset.question = `ai-${n}`;
            div.innerHTML = `
                <div class="question-header">
                    <span class="question-number">Q${n}</span>
                    <span class="question-type">单选题 · AI 生成</span>
                </div>
                <p class="question-text">${esc(q.question)}</p>
                <div class="quiz-options">${optHtml}</div>
                <div class="quiz-feedback hidden" data-correct="${correctLetter}">
                    <div class="feedback-correct">✓ 正确！${esc(q.explanation)}</div>
                    <div class="feedback-incorrect">✗ 不正确，正确答案是 ${correctLetter.toUpperCase()}。${esc(q.explanation)}</div>
                </div>`;
            frag.appendChild(div);
        });

        const summary = container.querySelector('.quiz-summary');
        if (summary) container.insertBefore(frag, summary);
        else container.appendChild(frag);

        // 状态栏 → 改为可换一批的提示条
        let bar = container.querySelector('.quiz-dynamic-status');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'quiz-dynamic-status';
            bar.style.cssText = 'padding:10px 12px;margin-bottom:12px;border-radius:8px;background:var(--color-bg-secondary,#f1f5f9);font-size:0.875rem;color:var(--color-text-secondary,#475569);display:flex;align-items:center;justify-content:space-between;gap:8px;';
            container.insertBefore(bar, container.firstChild);
        }
        bar.innerHTML = `<span>🤖 本组题目由 AI 按你的画像与学习轨迹生成（共 ${questions.length} 题）</span>`;
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'flex:none;padding:4px 12px;font-size:0.8125rem;';
        btn.textContent = '换一批';
        btn.addEventListener('click', () => this.regenerateQuiz(chapterId));
        bar.appendChild(btn);

        // 重置该章统计并绑定评分；渲染公式
        this.bindQuizQuestions(container);
        if (typeof renderMathInElement !== 'undefined') {
            try {
                renderMathInElement(container, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            } catch (e) { /* 公式渲染失败不影响题目 */ }
        }
    }

};
