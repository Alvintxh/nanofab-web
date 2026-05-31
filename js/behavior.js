const BehaviorModule = {
    async syncQuizAnswer(questionEl, selectedValue, correctAnswer, isCorrect) {
        if (!this.supabase || !this.state.currentChapter) return;

        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (!session?.user) return;

            const questionText = questionEl.querySelector('.question-text')?.textContent?.trim() || '';

            const selectedSpan = questionEl.querySelector(`input[value="${selectedValue}"]`)?.closest('.quiz-option')?.querySelector('span');
            const selectedText = selectedSpan ? selectedSpan.textContent.replace(/^[A-D][.、]\s*/, '').trim() : selectedValue;

            const correctSpan = questionEl.querySelector(`input[value="${correctAnswer}"]`)?.closest('.quiz-option')?.querySelector('span');
            const correctText = correctSpan ? correctSpan.textContent.replace(/^[A-D][.、]\s*/, '').trim() : correctAnswer;

            const { error } = await this.supabase
                .from('quiz_answers')
                .upsert({
                    user_id: session.user.id,
                    chapter_id: this.state.currentChapter.id,
                    question_id: questionEl.dataset.question,
                    question_text: questionText,
                    is_correct: isCorrect,
                    selected_answer: selectedText,
                    correct_answer: correctText
                });

            if (error) {
                console.error('Failed to sync quiz answer to Supabase:', error);
            } else {
                this._logBehaviorEvent('quiz_answer', this.state.currentChapter.id, {
                    question_id: questionEl.dataset.question,
                    is_correct: isCorrect
                });
            }
        } catch (error) {
            console.error('Failed to sync quiz answer to Supabase:', error);
        }
    },

    loadBehaviorData() {
        const stored = localStorage.getItem(`nanofab_behavior_${this._uid()}`);
        if (stored) {
            this.state.behaviorData = JSON.parse(stored);
        }
    },

    async saveBehaviorData(immediate = false) {
        if (immediate) {
            return this._flushBehaviorData();
        }

        if (!this._behaviorDirty) {
            this._behaviorDirty = true;
        }
        clearTimeout(this._behaviorSaveTimer);
        this._behaviorSaveTimer = setTimeout(() => this._flushBehaviorData(), 5000);
    },

    async _flushBehaviorData() {
        if (this._behaviorSaveTimer) {
            clearTimeout(this._behaviorSaveTimer);
            this._behaviorSaveTimer = null;
        }
        if (!this._behaviorDirty) return;
        this._behaviorDirty = false;

        localStorage.setItem(`nanofab_behavior_${this._uid()}`, JSON.stringify(this.state.behaviorData));

        if (this.supabase) {
            try {
                let userId = null;
                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.user) {
                    userId = session.user.id;
                }
                if (!userId) {
                    const pendingUserId = localStorage.getItem('pending_user_id');
                    if (pendingUserId) userId = pendingUserId;
                }

                if (userId) {
                    const { error: summaryError } = await this.supabase
                        .from('user_behavior_summary')
                        .upsert({
                            user_id: userId,
                            total_study_time: this.calculateTotalStudyTime(),
                            total_interactions: this.state.behaviorData.interactions?.length || 0,
                            quiz_correct_count: this.state.behaviorData.quizResults?.filter(r => r.correct).length || 0,
                            quiz_total_count: this.state.behaviorData.quizResults?.length || 0,
                            avg_scroll_depth: this.calculateAvgScrollDepth(),
                            weak_topics: this.state.user?.behaviorProfile?.weakTopics || [],
                            strong_topics: this.state.user?.behaviorProfile?.strongTopics || [],
                            preferred_content_types: this.state.user?.behaviorProfile?.preferredContentTypes || [],
                            updated_at: new Date().toISOString()
                        });

                    if (summaryError) {
                        console.error('Failed to sync behavior summary to Supabase:', summaryError);
                    }
                }
            } catch (error) {
                console.error('Failed to sync behavior to Supabase:', error);
            }
        }
    },

    calculateTotalStudyTime() {
        const timeSpent = this.state.behaviorData.timeSpent || {};
        return Object.values(timeSpent).reduce((sum, time) => sum + time, 0);
    },

    calculateAvgScrollDepth() {
        const scrollDepth = this.state.behaviorData.scrollDepth || {};
        const depths = Object.values(scrollDepth);
        if (depths.length === 0) return 0;
        return depths.reduce((sum, d) => sum + d, 0) / depths.length;
    },

    async _logBehaviorEvent(eventType, chapterId, eventData = {}) {
        if (!this.supabase) return;
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (!session?.user) return;
            await this.supabase.from('user_behavior_events').insert({
                user_id: session.user.id,
                event_type: eventType,
                chapter_id: chapterId || null,
                event_data: eventData
            });
        } catch (e) { /* fire-and-forget */ }
    },

    async _logAIQuery(provider, model, messages, response) {
        if (!this.supabase || !response) return;
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (!session?.user) return;
            // 多模态 content 可能是数组（[{type:'text',...},{type:'image_url',...}]），转成纯文本摘要再入库
            const asText = (c) => {
                if (typeof c === 'string') return c;
                if (Array.isArray(c)) return c.map(p => p?.type === 'text' ? p.text : (p?.type === 'image_url' ? '[图片]' : '')).join(' ');
                return '';
            };
            const systemMsgs = messages.filter(m => m.role === 'system');
            const queryType = systemMsgs.some(m => /解释|explain/i.test(asText(m.content))) ? 'explanation' : 'chat';
            const userMsg = messages.filter(m => m.role === 'user').map(m => asText(m.content)).join('\n');
            await this.supabase.from('ai_queries').insert({
                user_id: session.user.id,
                query_type: queryType,
                chapter_id: this.state.currentChapter?.id || null,
                user_message: userMsg.substring(0, 2000),
                ai_response: response.substring(0, 5000),
                response_tokens: response.length
            });
        } catch (e) { /* fire-and-forget */ }
    },

    async _syncNoteToSupabase(noteEntry) {
        if (!this.supabase) return;
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (!session?.user) return;
            await this.supabase.from('user_notes').upsert({
                id: noteEntry.id,
                user_id: session.user.id,
                context: noteEntry.context,
                content: noteEntry.content,
                chapter_id: noteEntry.chapter,
                chapter_title: noteEntry.chapterTitle,
                created_at: noteEntry.timestamp
            });
        } catch (e) { /* fire-and-forget */ }
    },

    async _deleteNoteFromSupabase(noteId) {
        if (!this.supabase) return;
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            if (!session?.user) return;
            const { error, count } = await this.supabase
                .from('user_notes')
                .delete({ count: 'exact' })
                .eq('id', noteId)
                .eq('user_id', session.user.id);
            if (error) {
                console.error('删除云端笔记失败:', error.message);
                this.showToast('云端删除失败，刷新后可能重现', 'warning');
            } else if (count === 0) {
                // 删除成功返回但 0 行：通常是数据库缺少 DELETE 的 RLS 策略
                console.warn('云端未删除任何笔记行（user_notes 可能缺少 DELETE 权限策略）');
                this.showToast('云端未能删除该笔记（数据库缺少删除权限）', 'warning');
            }
        } catch (e) {
            console.error('删除云端笔记异常:', e);
        }
    },

    initBehaviorTracking() {
        let scrollTimer;
        let maxScrollDepth = 0;
        let sectionStartTime = Date.now();
        let currentSection = null;

        document.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                const scrollPercent = Math.round(
                    (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
                );
                if (scrollPercent > maxScrollDepth) {
                    maxScrollDepth = scrollPercent;
                    const chapterId = this.state.currentChapter?.id || 'home';
                    this.state.behaviorData.scrollDepth[chapterId] = maxScrollDepth;
                    this.saveBehaviorData();
                }
            }, 500);
        });

        document.addEventListener('click', (e) => {
            const target = e.target.closest('a, button, .nav-chapter');
            if (target) {
                this.state.behaviorData.interactions.push({
                    type: 'click',
                    element: target.tagName.toLowerCase(),
                    text: target.textContent?.substring(0, 50) || '',
                    timestamp: new Date().toISOString(),
                    chapter: this.state.currentChapter?.id || 'home'
                });
                this.saveBehaviorData();
            }
        });

        let chapterStartTime = Date.now();
        window.addEventListener('hashchange', () => {
            const chapterId = this.state.currentChapter?.id;
            if (chapterId) {
                const timeSpent = Math.round((Date.now() - chapterStartTime) / 1000);
                this.state.behaviorData.timeSpent[chapterId] =
                    (this.state.behaviorData.timeSpent[chapterId] || 0) + timeSpent;
                this.saveBehaviorData(true);
                this.updateBehaviorProfile();
                this._logBehaviorEvent('page_view', chapterId, {
                    time_spent: timeSpent,
                    scroll_depth: this.state.behaviorData.scrollDepth?.[chapterId] || 0
                });
            }
            chapterStartTime = Date.now();
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (currentSection && currentSection !== entry.target.id) {
                        const timeSpent = Math.round((Date.now() - sectionStartTime) / 1000);
                        const chapterId = this.state.currentChapter?.id || 'home';
                        if (!this.state.behaviorData.sectionTime) {
                            this.state.behaviorData.sectionTime = {};
                        }
                        if (!this.state.behaviorData.sectionTime[chapterId]) {
                            this.state.behaviorData.sectionTime[chapterId] = {};
                        }
                        this.state.behaviorData.sectionTime[chapterId][currentSection] = 
                            (this.state.behaviorData.sectionTime[chapterId][currentSection] || 0) + timeSpent;
                        this.saveBehaviorData();
                    }
                    currentSection = entry.target.id;
                    sectionStartTime = Date.now();
                }
            });
        }, { threshold: 0.5 });

        document.querySelectorAll('h2, h3').forEach(heading => {
            if (!heading.id) {
                heading.id = 'section-' + Math.random().toString(36).substring(2, 11);
            }
            observer.observe(heading);
        });
    },

    updateBehaviorProfile() {
        const user = this.state.user;
        if (!user || !user.behaviorProfile) return;
        
        const bp = user.behaviorProfile;
        const behaviorData = this.state.behaviorData;
        
        const quizResults = behaviorData.quizResults || [];
        if (quizResults.length > 0) {
            const correctCount = quizResults.filter(r => r.correct).length;
            bp.quizAccuracy = correctCount / quizResults.length;
            
            const weakTopics = new Set();
            quizResults.filter(r => !r.correct).forEach(r => {
                if (r.chapter) weakTopics.add(r.chapter);
            });
            bp.weakTopics = [...weakTopics];
        }
        
        const timeSpent = behaviorData.timeSpent || {};
        const chapterTimes = Object.entries(timeSpent);
        if (chapterTimes.length > 0) {
            const avgTime = chapterTimes.reduce((sum, [, time]) => sum + time, 0) / chapterTimes.length;
            bp.avgSessionTime = avgTime;
            
            const difficultChapters = chapterTimes
                .filter(([, time]) => time > avgTime * 1.5)
                .map(([chapter]) => chapter);
            bp.weakTopics = [...new Set([...bp.weakTopics, ...difficultChapters])];
        }
        
        const scrollDepth = behaviorData.scrollDepth || {};
        const deepScrollChapters = Object.entries(scrollDepth)
            .filter(([, depth]) => depth > 80)
            .map(([chapter]) => chapter);
        bp.strongTopics = deepScrollChapters;
        
        bp.lastUpdated = new Date().toISOString();
        this.saveUser(user);
    },

    updateStudyStats() {
        const behaviorData = this.state.behaviorData;
        const now = new Date();
        const today = now.toDateString();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());

        const timeSpent = behaviorData.timeSpent || {};
        let totalSeconds = 0;
        Object.values(timeSpent).forEach(t => {
            totalSeconds += (typeof t === 'number' ? t : 0);
        });

        let todaySeconds = 0;
        let weekSeconds = 0;
        const interactions = behaviorData.interactions || [];
        const todayInteractions = interactions.filter(i => {
            try { return new Date(i.timestamp).toDateString() === today; } catch { return false; }
        });
        const weekInteractions = interactions.filter(i => {
            try { return new Date(i.timestamp) >= weekStart; } catch { return false; }
        });
        todaySeconds = todayInteractions.length * 45;
        weekSeconds = weekInteractions.length * 45;

        // Daily streak
        const activeDays = new Set();
        interactions.forEach(i => {
            try { activeDays.add(new Date(i.timestamp).toDateString()); } catch {}
        });
        let streak = 0;
        const checkDate = new Date(now);
        for (let i = 0; i < 365; i++) {
            if (activeDays.has(checkDate.toDateString())) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else { break; }
        }

        // Quiz accuracy
        const quizResults = behaviorData.quizResults || [];
        const quizAccuracy = quizResults.length > 0
            ? Math.round((quizResults.filter(q => q.correct).length / quizResults.length) * 100)
            : 0;

        const setEl = (id, inner) => { const el = document.getElementById(id); if (el) el.innerHTML = inner; };
        setEl('stat-today', `${Math.round(todaySeconds / 60)}<span style="font-size:0.75rem"> 分钟</span>`);
        setEl('stat-week', `${Math.round(weekSeconds / 60)}<span style="font-size:0.75rem"> 分钟</span>`);

        const totalMinutes = Math.round(totalSeconds / 60);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const totalDisplay = hours > 0 ? `${hours}<span style="font-size:0.75rem">h </span>${mins}<span style="font-size:0.75rem">m</span>` : `${mins}<span style="font-size:0.75rem"> 分钟</span>`;
        setEl('stat-total', totalDisplay);
        setEl('stat-streak', `${streak}<span style="font-size:0.75rem"> 天</span>`);
        setEl('stat-accuracy', `${quizAccuracy}<span style="font-size:0.75rem">%</span>`);
    },

    updateWrongAnswerBook() {
        const container = document.getElementById('wrong-answer-content');
        if (!container) return;

        const quizResults = this.state.behaviorData.quizResults || [];
        const wrongAnswers = quizResults.filter(r => !r.correct);

        if (wrongAnswers.length === 0) {
            container.innerHTML = '<p style="font-size:0.9375rem;color:var(--color-success);text-align:center;padding:20px 0;">✅ 恭喜！目前没有错题。</p>';
            return;
        }

        const allChapters = this.getAllChapters();
        const quizAccuracy = Math.round((quizResults.filter(q => q.correct).length / quizResults.length) * 100);

        let html = `<p style="font-size:0.8125rem;color:var(--color-text-tertiary);margin-bottom:16px;">共 <strong style="color:var(--color-accent);">${wrongAnswers.length}</strong> 道错题 · 整体正确率 <strong style="color:var(--color-success);">${quizAccuracy}%</strong></p>`;
        html += '<div class="wrong-answer-list">';
        wrongAnswers.forEach(item => {
            const chapter = allChapters.find(c => c.id === item.chapter);
            const chapterName = chapter ? chapter.title : item.chapter;
            const date = new Date(item.timestamp);
            const dateStr = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            const userAnswer = item.userAnswer || (Array.isArray(item.selected) ? item.selected.join('、') : item.selected) || '未作答';
            html += `
                <div class="wrong-answer-item">
                    <div class="wa-header">
                        <span class="wa-chapter">${item.chapter || ''}</span>
                        <span class="wa-date">${dateStr}</span>
                    </div>
                    <div class="wa-question">${item.question || '测试题'}</div>
                    <div class="wa-detail">你的答案：<span style="color:var(--color-accent);font-weight:500;">${userAnswer}</span></div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    // ===== 学习报告导出（一键预览 + 浏览器原生 Save as PDF） =====
    openReportModal() {
        const modal = document.getElementById('report-modal');
        const content = document.getElementById('report-content');
        if (!modal || !content) return;
        content.innerHTML = this._buildReportHTML();
        // 切回主页面，否则当前章节 currentChapter 状态可能影响其他元素显示；只是预览，无需路由
        this.closeProfileModal && this.closeProfileModal();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeReportModal() {
        const modal = document.getElementById('report-modal');
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
    },

    printReport() {
        // 让 @media print 单独排版，无需切换 DOM；浏览器原生对话框支持保存 PDF
        document.body.classList.add('printing-report');
        const cleanup = () => {
            document.body.classList.remove('printing-report');
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        // 兜底：1.5s 后若未触发 afterprint（部分浏览器异常），主动清理
        setTimeout(cleanup, 1500);
        window.print();
    },

    _buildReportHTML() {
        const esc = (s) => this.escapeHtml ? this.escapeHtml(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const user = this.state.user || {};
        const parts = this.state.chapters || [];
        const allChapters = this.getAllChapters();
        const completed = this.state.completedChapters || new Set();
        const bd = this.state.behaviorData || {};
        const notes = bd.notes || [];
        const quizResults = bd.quizResults || [];
        const timeSpent = bd.timeSpent || {};

        const levelMap = { zero: '毫无基础', beginner: '初学者', intermediate: '中级', advanced: '高级' };
        const bgMap = { student: '在校学生', researcher: '科研人员', engineer: '工程师', other: '其他' };
        const motivMap = { course: '课程学习', research: '科研需要', career: '职业发展', interest: '个人兴趣' };

        // ----- 综览数据 -----
        const totalSeconds = Object.values(timeSpent).reduce((s, t) => s + (typeof t === 'number' ? t : 0), 0);
        const totalMinutes = Math.round(totalSeconds / 60);
        const timeDisplay = totalMinutes >= 60
            ? `${Math.floor(totalMinutes / 60)} 小时 ${totalMinutes % 60} 分钟`
            : `${totalMinutes} 分钟`;
        const correctCount = quizResults.filter(q => q.correct).length;
        const accuracy = quizResults.length > 0 ? Math.round(correctCount / quizResults.length * 100) : null;
        // 连续学习天数：与 updateStudyStats 同口径
        const activeDays = new Set();
        (bd.interactions || []).forEach(i => { try { activeDays.add(new Date(i.timestamp).toDateString()); } catch {} });
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            if (activeDays.has(today.toDateString())) { streak++; today.setDate(today.getDate() - 1); } else break;
        }

        const now = new Date();
        const genDate = now.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        // ----- 头部 -----
        const headerHTML = `
            <header class="report-header">
                <div class="report-header-top">
                    <div class="report-brand">
                        <div class="report-brand-mark">
                            <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                                <rect x="8" y="8" width="48" height="48" rx="4" fill="none" stroke="currentColor" stroke-width="3"/>
                                <circle cx="24" cy="24" r="5" fill="currentColor"/>
                                <circle cx="40" cy="24" r="5" fill="currentColor" opacity="0.55"/>
                                <circle cx="24" cy="40" r="5" fill="currentColor" opacity="0.55"/>
                                <circle cx="40" cy="40" r="5" fill="currentColor"/>
                            </svg>
                        </div>
                        <div>
                            <div class="report-brand-name">NanoFab Learning Platform</div>
                            <div class="report-brand-sub">基于《纳米制造技术：原理、工艺与实践》</div>
                        </div>
                    </div>
                    <div class="report-meta">
                        <div class="report-meta-label">生成于</div>
                        <div class="report-meta-value">${esc(genDate)}</div>
                    </div>
                </div>
                <h1 class="report-title">学习报告</h1>
                <div class="report-subject">
                    <div class="report-subject-row"><span class="report-subject-k">学生</span><span class="report-subject-v">${esc(user.name || '未填写')}</span></div>
                    ${user.email ? `<div class="report-subject-row"><span class="report-subject-k">邮箱</span><span class="report-subject-v">${esc(user.email)}</span></div>` : ''}
                    <div class="report-subject-row"><span class="report-subject-k">当前水平</span><span class="report-subject-v">${esc(levelMap[user.level] || user.level || '—')}</span></div>
                    ${user.background ? `<div class="report-subject-row"><span class="report-subject-k">背景</span><span class="report-subject-v">${esc(bgMap[user.background] || user.background)}</span></div>` : ''}
                    ${(user.motivation && user.motivation.length) ? `<div class="report-subject-row"><span class="report-subject-k">学习动机</span><span class="report-subject-v">${esc(user.motivation.map(m => motivMap[m] || m).join('、'))}</span></div>` : ''}
                </div>
            </header>`;

        // ----- 综览卡片 -----
        const overviewHTML = `
            <section class="report-section">
                <h2 class="report-section-title">学习概览</h2>
                <div class="report-overview">
                    <div class="report-overview-cell">
                        <div class="report-overview-num">${completed.size}<span class="report-overview-unit">/ ${allChapters.length}</span></div>
                        <div class="report-overview-label">章节完成</div>
                    </div>
                    <div class="report-overview-cell">
                        <div class="report-overview-num">${timeDisplay}</div>
                        <div class="report-overview-label">累计学习时长</div>
                    </div>
                    <div class="report-overview-cell">
                        <div class="report-overview-num">${accuracy !== null ? accuracy + '%' : '—'}</div>
                        <div class="report-overview-label">答题正确率<span class="report-overview-sub">${quizResults.length ? `（${correctCount}/${quizResults.length} 题）` : ''}</span></div>
                    </div>
                    <div class="report-overview-cell">
                        <div class="report-overview-num">${streak}<span class="report-overview-unit"> 天</span></div>
                        <div class="report-overview-label">连续学习</div>
                    </div>
                </div>
            </section>`;

        // ----- 章节进度 -----
        const progressHTML = parts.length ? `
            <section class="report-section">
                <h2 class="report-section-title">章节进度</h2>
                ${parts.map(part => `
                    <div class="report-part">
                        <h3 class="report-part-title">${esc(part.title)}</h3>
                        <ul class="report-chapter-list">
                            ${(part.chapters || []).map(ch => {
                                const done = completed.has(ch.id);
                                const mins = Math.round((timeSpent[ch.id] || 0) / 60);
                                return `<li class="report-chapter-item ${done ? 'done' : ''}">
                                    <span class="report-chapter-mark" aria-hidden="true">${done ? '✓' : '○'}</span>
                                    <span class="report-chapter-title">${esc(ch.title)}</span>
                                    <span class="report-chapter-meta">${done ? '已完成' : '未完成'}${mins > 0 ? ` · 学习 ${mins} 分钟` : ''}</span>
                                </li>`;
                            }).join('')}
                        </ul>
                    </div>
                `).join('')}
            </section>` : '';

        // ----- AI 学习目标路径 -----
        let goalHTML = '';
        if (typeof this._loadGoalPath === 'function') {
            const saved = this._loadGoalPath();
            if (saved && saved.data && Array.isArray(saved.data.steps) && saved.data.steps.length) {
                const stepsHTML = saved.data.steps.map((st, i) => `
                    <li class="report-goal-step">
                        <div class="report-goal-no">${i + 1}</div>
                        <div class="report-goal-body">
                            <div class="report-goal-head"><strong>[${esc(st.token || '')}]</strong> ${esc(st.heading || '相关小节')}</div>
                            ${st.why ? `<div class="report-goal-line"><span class="k">为何需要：</span>${esc(st.why)}</div>` : ''}
                            ${st.focus ? `<div class="report-goal-line"><span class="k">重点掌握：</span>${esc(st.focus)}</div>` : ''}
                        </div>
                    </li>
                `).join('');
                goalHTML = `
                    <section class="report-section">
                        <h2 class="report-section-title">AI 学习路径</h2>
                        <div class="report-goal-meta">
                            <div><span class="k">目标：</span>${esc(saved.goal || saved.data.goal || '')}</div>
                            ${saved.data.scope ? `<div><span class="k">覆盖范围：</span>${esc(saved.data.scope)}</div>` : ''}
                        </div>
                        <ol class="report-goal-list">${stepsHTML}</ol>
                    </section>`;
            }
        }

        // ----- 笔记 -----
        let notesHTML = '';
        if (notes.length) {
            const byCh = {};
            notes.forEach(n => {
                const k = n.chapterTitle || n.chapter || '未分组';
                (byCh[k] = byCh[k] || []).push(n);
            });
            const groups = Object.keys(byCh).map(title => `
                <div class="report-notes-group">
                    <h3 class="report-notes-chapter">${esc(title)}</h3>
                    ${byCh[title].map(n => {
                        const d = n.timestamp ? new Date(n.timestamp).toLocaleDateString('zh-CN') : '';
                        const isAi = n.content && (n.content.includes('\n') || n.content.startsWith('#') || n.content.startsWith('**'));
                        const noteText = isAi ? (n.content.replace(/\s+/g, ' ').slice(0, 600) + (n.content.length > 600 ? '…' : '')) : (n.content || '');
                        return `<div class="report-note">
                            ${n.context ? `<div class="report-note-context">原文："${esc(n.context.slice(0, 220))}${n.context.length > 220 ? '…' : ''}"</div>` : ''}
                            <div class="report-note-body">${isAi ? '🤖 ' : '📝 '}${esc(noteText)}</div>
                            ${d ? `<div class="report-note-date">${esc(d)}</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>
            `).join('');
            notesHTML = `
                <section class="report-section">
                    <h2 class="report-section-title">学习笔记 <span class="report-section-count">共 ${notes.length} 条</span></h2>
                    ${groups}
                </section>`;
        }

        // ----- 答题记录 -----
        let quizHTML = '';
        if (quizResults.length) {
            const wrong = quizResults.filter(q => !q.correct);
            const recent = quizResults.slice(-30).reverse();
            const ua = (item) => item.userAnswer || (Array.isArray(item.selected) ? item.selected.join('、') : item.selected) || '未作答';
            const ca = (item) => item.correctAnswer || item.answer || '';
            quizHTML = `
                <section class="report-section">
                    <h2 class="report-section-title">答题记录 <span class="report-section-count">共 ${quizResults.length} 题 · 正确 ${correctCount} · 错误 ${wrong.length}</span></h2>
                    ${wrong.length ? `<div class="report-quiz-sub">错题（按时间倒序）</div>
                    <ul class="report-quiz-list">
                        ${wrong.slice(0, 30).reverse().map(item => {
                            const chapter = allChapters.find(c => c.id === item.chapter);
                            const chName = chapter ? chapter.title : (item.chapter || '');
                            const d = item.timestamp ? new Date(item.timestamp).toLocaleDateString('zh-CN') : '';
                            return `<li class="report-quiz-item wrong">
                                <div class="report-quiz-meta">${esc(chName)}${d ? ' · ' + esc(d) : ''}</div>
                                <div class="report-quiz-q">${esc(item.question || '测试题')}</div>
                                <div class="report-quiz-a"><span class="k">你的答案：</span><span class="v wrong">${esc(ua(item))}</span></div>
                                ${ca(item) ? `<div class="report-quiz-a"><span class="k">正确答案：</span><span class="v right">${esc(ca(item))}</span></div>` : ''}
                            </li>`;
                        }).join('')}
                    </ul>` : '<p class="report-empty">暂无错题，继续保持！</p>'}
                </section>`;
        }

        // ----- 画像 -----
        const bp = user.behaviorProfile || {};
        const titleOf = (id) => { const c = allChapters.find(x => x.id === id); return c ? c.title : id; };
        const profileHTML = (bp.strongTopics?.length || bp.weakTopics?.length || user.interestArea?.length || user.currentProject) ? `
            <section class="report-section">
                <h2 class="report-section-title">学习画像</h2>
                <dl class="report-profile">
                    ${bp.strongTopics?.length ? `<div class="report-profile-row"><dt>擅长主题</dt><dd>${bp.strongTopics.map(t => esc(titleOf(t))).join('、')}</dd></div>` : ''}
                    ${bp.weakTopics?.length ? `<div class="report-profile-row"><dt>需加强主题</dt><dd>${bp.weakTopics.map(t => esc(titleOf(t))).join('、')}</dd></div>` : ''}
                    ${user.interestArea?.length ? `<div class="report-profile-row"><dt>兴趣领域</dt><dd>${esc(user.interestArea.join('、'))}</dd></div>` : ''}
                    ${user.currentProject ? `<div class="report-profile-row"><dt>当前在研</dt><dd>${esc(user.currentProject)}</dd></div>` : ''}
                </dl>
            </section>` : '';

        // ----- 页脚 -----
        const footerHTML = `
            <footer class="report-footer">
                <span>本报告由 NanoFab Learning Platform 自动生成</span>
                <span>·</span>
                <span>仅基于您在本平台的学习行为聚合，不含原始事件流水</span>
            </footer>`;

        return headerHTML + overviewHTML + progressHTML + goalHTML + notesHTML + quizHTML + profileHTML + footerHTML;
    }
};
