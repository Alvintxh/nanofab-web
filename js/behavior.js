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
            const systemMsgs = messages.filter(m => m.role === 'system');
            const queryType = systemMsgs.some(m => /解释|解释|explain/i.test(m.content)) ? 'explanation' : 'chat';
            const userMsg = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
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
    }
};
