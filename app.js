
const App = {
    state: {
        user: null,
        chapters: [],
        currentChapter: null,
        completedChapters: new Set(),
        sidebarOpen: false,
        currentView: 'home',
        behaviorData: {
            pageViews: [],
            scrollDepth: {},
            timeSpent: {},
            sectionTime: {},
            interactions: [],
            quizResults: [],
            aiQueries: []
        }
    },

    init() {
        this.initSupabase();
        this.bindEvents();
        this.checkRecoveryFlow().then(isRecovery => {
            if (!isRecovery) this.loadUser();
        });
        this.loadProgress();
        this.loadBehaviorData();
        this.initBehaviorTracking();
        this.initAIAssistant();
        this.loadChapters().then(() => {
            this.handleRoute();
        });
    },

    showToast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        }, 4000);
    },

    initSupabase() {
        if (typeof supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
            this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized successfully');
        } else {
            console.warn('Supabase not initialized - missing library or config');
        }
    },

    async loadChapters() {
        try {
            const response = await fetch('./content/chapters.json');
            const data = await response.json();
            this.state.chapters = data.parts;
            this.renderNavigation();
            this.renderQuickNav();
        } catch (error) {
            console.error('Failed to load chapters:', error);
        }
    },

    async loadUser() {
        const stored = localStorage.getItem('nanofab_user');
        if (stored) {
            try {
                this.state.user = JSON.parse(stored);
                this.showApp();
                return;
            } catch (error) {
                console.error('Failed to parse stored user:', error);
                localStorage.removeItem('nanofab_user');
            }
        }

        if (this.supabase) {
            try {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.user) {
                    await this.loadUserFromSupabase(session.user);
                    this.showApp();
                    return;
                }
            } catch (error) {
                console.error('Failed to check auth session:', error);
            }
        }
    },

    async saveUser(user) {
        this.state.user = user;
        localStorage.setItem('nanofab_user', JSON.stringify(user));

        if (this.supabase) {
            try {
                let userId = null;
                let authMethod = 'unknown';

                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.user) {
                    userId = session.user.id;
                    authMethod = 'session';
                    console.log('Found active session, userId:', userId);
                }

                if (!userId) {
                    const pendingUserId = localStorage.getItem('pending_user_id');
                    if (pendingUserId) {
                        userId = pendingUserId;
                        authMethod = 'pending';
                        console.log('Using pending userId:', userId);
                    }
                }

                if (userId) {
                    console.log('Attempting to save profile with auth method:', authMethod);
                    try {
                        const { error } = await this.supabase
                            .from('user_profiles')
                            .upsert({
                                id: userId,
                                profile_data: user,
                                updated_at: new Date().toISOString()
                            });

                        if (error) {
                            console.error('Failed to sync user to Supabase:', error);
                            console.error('Error details:', {
                                code: error.code,
                                message: error.message,
                                details: error.details,
                                hint: error.hint
                            });
                            if (error.message.includes('row-level security')) {
                                console.warn('RLS Error: Please execute supabase/fix_rls.sql in your Supabase Dashboard');
                            }
                        } else {
                            console.log('User profile synced to Supabase successfully');
                            localStorage.removeItem('pending_user_id');
                        }
                    } catch (insertError) {
                        console.error('Exception during profile insert:', insertError);
                    }
                } else {
                    console.warn('No user ID found, skipping Supabase sync. Auth state:', {
                        hasSession: !!(session && session.user),
                        hasPendingId: !!localStorage.getItem('pending_user_id')
                    });
                }
            } catch (error) {
                console.error('Failed to sync user to Supabase:', error);
            }
        } else {
            console.warn('Supabase client not initialized');
        }
    },

    loadProgress() {
        const stored = localStorage.getItem('nanofab_progress');
        if (stored) {
            this.state.completedChapters = new Set(JSON.parse(stored));
        }
    },

    async saveProgress() {
        localStorage.setItem(
            'nanofab_progress',
            JSON.stringify([...this.state.completedChapters])
        );

        if (this.supabase) {
            try {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.user) {
                    const { error } = await this.supabase
                        .from('user_progress')
                        .upsert({
                            id: session.user.id,
                            completed_chapters: [...this.state.completedChapters],
                            updated_at: new Date().toISOString()
                        });

                    if (error) {
                        console.error('Failed to sync progress to Supabase:', error);
                    }
                }
            } catch (error) {
                console.error('Failed to sync progress to Supabase:', error);
            }
        }
    },

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
        const stored = localStorage.getItem('nanofab_behavior');
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

        localStorage.setItem('nanofab_behavior', JSON.stringify(this.state.behaviorData));

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
            await this.supabase.from('user_notes').delete().eq('id', noteId);
        } catch (e) { /* fire-and-forget */ }
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

    bindEvents() {
        window.addEventListener('hashchange', () => this.handleRoute());

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));
        }

        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
        });

        document.querySelectorAll('.auth-switch').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchAuthTab(link.dataset.target);
            });
        });

        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => this.closeSidebar());
        }

        const userProfileBtn = document.getElementById('user-profile-btn');
        if (userProfileBtn) {
            userProfileBtn.addEventListener('click', () => this.openProfileModal());
        }

        const modalClose = document.querySelector('.modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.closeProfileModal());
        }

        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => this.closeProfileModal());
        }

        const viewNotesBtn = document.getElementById('view-notes-btn');
        if (viewNotesBtn) {
            viewNotesBtn.addEventListener('click', () => this.openNotesModal());
        }

        const notesModalClose = document.querySelector('#notes-modal .modal-close');
        if (notesModalClose) {
            notesModalClose.addEventListener('click', () => {
                document.getElementById('notes-modal').classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        const notesModalOverlay = document.querySelector('#notes-modal .modal-overlay');
        if (notesModalOverlay) {
            notesModalOverlay.addEventListener('click', () => {
                document.getElementById('notes-modal').classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        const resetProfile = document.getElementById('reset-profile');
        if (resetProfile) {
            resetProfile.addEventListener('click', () => this.resetProfile());
        }

        const markComplete = document.getElementById('mark-complete');
        if (markComplete) {
            markComplete.addEventListener('click', () => this.markChapterComplete());
        }

        const verifyForm = document.getElementById('verify-form');
        if (verifyForm) verifyForm.addEventListener('submit', (e) => this.handleVerify(e));

        const resendBtn = document.getElementById('resend-code-btn');
        if (resendBtn) resendBtn.addEventListener('click', () => this.resendVerificationCode());

        const forgotForm = document.getElementById('forgot-password-form');
        if (forgotForm) forgotForm.addEventListener('submit', (e) => this.handleForgotPassword(e));

        const resetForm = document.getElementById('reset-password-form');
        if (resetForm) resetForm.addEventListener('submit', (e) => this.handleResetPassword(e));

        this._bindAuthSwitchLinks();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeProfileModal();
                this.closeSidebar();
            }
        });
    },

    switchAuthTab(tab) {
        const formId = tab === 'login' ? 'login-form' : 'register-form';
        this.showAuthForm(formId);
    },

    showAuthForm(formId) {
        const allForms = ['login-form', 'register-form', 'verify-form', 'forgot-password-form', 'reset-password-form', 'profile-form'];
        const tabsEl = document.querySelector('.auth-tabs');

        allForms.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const tabForms = ['login-form', 'register-form'];
        if (tabForms.includes(formId)) {
            if (tabsEl) tabsEl.classList.remove('hidden');
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            const tabName = formId === 'login-form' ? 'login' : 'register';
            const targetTab = document.querySelector(`.auth-tab[data-tab="${tabName}"]`);
            if (targetTab) targetTab.classList.add('active');
        } else {
            if (tabsEl) tabsEl.classList.add('hidden');
        }

        const targetForm = document.getElementById(formId);
        if (targetForm) targetForm.classList.remove('hidden');

        if (formId === 'verify-form') {
            const pendingEmail = localStorage.getItem('pending_email');
            const emailDisplay = document.getElementById('verify-email-display');
            if (emailDisplay && pendingEmail) emailDisplay.textContent = pendingEmail;
        }

        if (formId === 'forgot-password-form') {
            const el = document.getElementById('forgot-email');
            if (el) el.value = '';
        }
    },

    _getAuthErrorMessage(error) {
        const msg = (error?.message || error?.toString() || '');
        if (/invalid login|invalid.*credentials/i.test(msg)) return '邮箱或密码错误';
        if (/email not confirmed/i.test(msg)) return '邮箱尚未验证，请先完成邮箱验证';
        if (/rate limit|security|over_email_send_rate_limit/i.test(msg)) return '操作过于频繁，请稍后再试';
        if (/already registered|already exists/i.test(msg)) return '该邮箱已注册';
        if (/token.*expired|expired/i.test(msg)) return '验证码已过期，请重新发送';
        if (/invalid.*token|token.*invalid/i.test(msg)) return '验证码无效，请检查后重新输入';
        if (/password.*should/i.test(msg)) return '密码长度至少为6位';
        if (/network|fetch/i.test(msg)) return '网络连接失败，请检查网络后重试';
        if (/user not found/i.test(msg)) return '该邮箱尚未注册';
        return msg;
    },

    _setButtonLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.classList.add('btn-loading');
            if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
        } else {
            btn.disabled = false;
            btn.classList.remove('btn-loading');
            if (btn.dataset.originalText) {
                btn.innerHTML = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }
        }
    },

    _bindAuthSwitchLinks() {
        document.querySelectorAll('.auth-switch').forEach(link => {
            const newLink = link.cloneNode(true);
            link.parentNode.replaceChild(newLink, link);
        });
        document.querySelectorAll('.auth-switch').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.dataset.target;
                const formMap = {
                    'login': 'login-form',
                    'register': 'register-form',
                    'forgot-password': 'forgot-password-form'
                };
                const formId = formMap[target] || target;
                this.showAuthForm(formId);
            });
        });
    },

    async checkRecoveryFlow() {
        if (!this.supabase) return false;
        try {
            const hash = window.location.hash.substring(1);
            const hashParams = new URLSearchParams(hash);
            if (hashParams.get('type') === 'recovery') {
                this.showAuthForm('reset-password-form');
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    },

    async handleLogin(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this._setButtonLoading(submitBtn, true);

        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        if (this.supabase) {
            try {
                const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                await this.loadUserFromSupabase(data.user);
                this.showApp();
            } catch (error) {
                this.showToast('登录失败：' + this._getAuthErrorMessage(error), 'error');
            }
        } else {
            this.showToast('系统未初始化，请刷新页面后重试', 'error');
        }
        this._setButtonLoading(submitBtn, false);
    },

    async handleRegister(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this._setButtonLoading(submitBtn, true);

        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const name = formData.get('name');

        if (this.supabase) {
            try {
                const { data, error } = await this.supabase.auth.signUp({
                    email, password,
                    options: { data: { name } }
                });

                if (error) {
                    if (error.message.includes('rate limit') || error.error_code === 'over_email_send_rate_limit') {
                        if (error.error_code === 'over_email_send_rate_limit') {
                            this.showToast('验证邮件发送失败（频率限制），请稍后重试或直接登录。', 'warning');
                            this.showAuthForm('login-form');
                            return;
                        }
                        this.showToast('发送过于频繁，请稍后再试（约1分钟后）', 'warning');
                        return;
                    }
                    if (error.message.includes('already registered') || error.message.includes('already exists')) {
                        this.showToast('该邮箱已注册，请直接登录', 'info');
                        this.showAuthForm('login-form');
                        return;
                    }
                    throw error;
                }

                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    this.showToast('该邮箱已注册，请直接登录', 'info');
                    this.showAuthForm('login-form');
                    return;
                }

                localStorage.setItem('pending_name', name);
                localStorage.setItem('pending_email', email);
                sessionStorage.setItem('pending_password', password);

                if (data.user) {
                    localStorage.setItem('pending_user_id', data.user.id);

                    if (data.session) {
                        this.showAuthForm('profile-form');
                        document.getElementById('user-name').value = name;
                        this.showToast('注册成功！请完善您的个人资料。', 'success');
                    } else {
                        this.showAuthForm('verify-form');
                        this.showToast('验证邮件已发送，请检查邮箱（包括垃圾邮件文件夹）。', 'info');
                    }
                }
            } catch (error) {
                this.showToast('注册失败：' + this._getAuthErrorMessage(error), 'error');
            }
        } else {
            this.showToast('系统未初始化，请刷新页面后重试', 'error');
        }
        this._setButtonLoading(submitBtn, false);
    },

    async handleVerify(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this._setButtonLoading(submitBtn, true);

        const code = document.getElementById('verify-code').value.trim();
        const email = localStorage.getItem('pending_email');

        if (!email) {
            this.showToast('验证信息已过期，请重新注册', 'error');
            this.showAuthForm('register-form');
            return;
        }

        if (code.length !== 6) {
            this.showToast('请输入6位验证码', 'warning');
            this._setButtonLoading(submitBtn, false);
            return;
        }

        if (this.supabase) {
            try {
                const { data, error } = await this.supabase.auth.verifyOtp({
                    email, token: code, type: 'signup'
                });
                if (error) throw error;

                this.showAuthForm('profile-form');
                const name = localStorage.getItem('pending_name');
                document.getElementById('user-name').value = name || '';
                this.showToast('验证成功！请完善您的个人资料。', 'success');
            } catch (error) {
                this.showToast('验证失败：' + this._getAuthErrorMessage(error), 'error');
            }
        }
        this._setButtonLoading(submitBtn, false);
    },

    async resendVerificationCode() {
        const email = localStorage.getItem('pending_email');
        if (!email || !this.supabase) {
            this.showToast('无法重新发送验证码', 'error');
            return;
        }

        const resendBtn = document.getElementById('resend-code-btn');
        if (this._resendCooldown) {
            this.showToast(`请等待 ${this._resendCooldown} 秒后再试`, 'warning');
            return;
        }

        if (resendBtn) resendBtn.disabled = true;

        try {
            const { error } = await this.supabase.auth.resend({ type: 'signup', email });
            if (error) {
                if (error.message.includes('rate limit') || error.message.includes('security')) {
                    this.showToast('发送过于频繁，请稍后再试（约1分钟后）', 'warning');
                    return;
                }
                throw error;
            }
            this.showToast('验证码已重新发送，请检查邮箱。', 'success');

            this._resendCooldown = 60;
            this._resendTimer = setInterval(() => {
                this._resendCooldown--;
                if (resendBtn) resendBtn.textContent = `重新发送 (${this._resendCooldown}s)`;
                if (this._resendCooldown <= 0) {
                    clearInterval(this._resendTimer);
                    this._resendCooldown = null;
                    if (resendBtn) {
                        resendBtn.disabled = false;
                        resendBtn.textContent = '重新发送验证码';
                    }
                }
            }, 1000);
        } catch (error) {
            this.showToast('发送失败：' + this._getAuthErrorMessage(error), 'error');
            if (resendBtn) resendBtn.disabled = false;
        }
    },

    async handleForgotPassword(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this._setButtonLoading(submitBtn, true);

        const email = document.getElementById('forgot-email').value.trim();

        if (this.supabase) {
            try {
                const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + window.location.pathname
                });
                if (error) throw error;

                const form = document.getElementById('forgot-password-form');
                form.innerHTML = `
                    <div class="auth-success-message">
                        <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <h2 class="card-title">邮件已发送</h2>
                        <p>我们已向 <strong>${email}</strong> 发送了密码重置链接，请检查您的邮箱（包括垃圾邮件文件夹）。</p>
                    </div>
                    <p class="auth-hint"><a href="#" class="auth-switch" data-target="login">返回登录</a></p>
                `;
                this._bindAuthSwitchLinks();
            } catch (error) {
                this.showToast('发送失败：' + this._getAuthErrorMessage(error), 'error');
            }
        }
        this._setButtonLoading(submitBtn, false);
    },

    async handleResetPassword(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');

        const password = document.getElementById('reset-password').value;
        const passwordConfirm = document.getElementById('reset-password-confirm').value;

        if (password !== passwordConfirm) {
            this.showToast('两次输入的密码不一致', 'warning');
            return;
        }
        if (password.length < 6) {
            this.showToast('密码长度至少为6位', 'warning');
            return;
        }

        this._setButtonLoading(submitBtn, true);

        if (this.supabase) {
            try {
                const { error } = await this.supabase.auth.updateUser({ password });
                if (error) throw error;

                this.showToast('密码重置成功！请登录。', 'success');
                window.history.replaceState(null, '', window.location.pathname);
                this.showAuthForm('login-form');
            } catch (error) {
                this.showToast('密码重置失败：' + this._getAuthErrorMessage(error), 'error');
            }
        }
        this._setButtonLoading(submitBtn, false);
    },

    async loadUserFromSupabase(authUser) {
        if (!this.supabase || !authUser) return;

        try {
            const { data: profile } = await this.supabase
                .from('user_profiles')
                .select('profile_data')
                .eq('id', authUser.id)
                .single();

            if (profile?.profile_data) {
                this.state.user = profile.profile_data;
                localStorage.setItem('nanofab_user', JSON.stringify(profile.profile_data));
            } else {
                const pendingName = localStorage.getItem('pending_name') || authUser.user_metadata?.name || '用户';
                this.state.user = {
                    name: pendingName,
                    email: authUser.email,
                    background: 'student',
                    level: 'beginner',
                    motivation: [],
                    prerequisite: [],
                    studyPace: 'moderate',
                    learningStyle: [],
                    interestArea: [],
                    weeklyHours: 8,
                    behaviorProfile: {
                        weakTopics: [],
                        strongTopics: [],
                        preferredContentTypes: [],
                        avgSessionTime: 0,
                        quizAccuracy: 0,
                        lastUpdated: new Date().toISOString()
                    }
                };
                localStorage.setItem('nanofab_user', JSON.stringify(this.state.user));
            }

            const { data: progress } = await this.supabase
                .from('user_progress')
                .select('completed_chapters')
                .eq('id', authUser.id)
                .single();

            if (progress?.completed_chapters) {
                this.state.completedChapters = new Set(progress.completed_chapters);
                localStorage.setItem('nanofab_progress', JSON.stringify(progress.completed_chapters));
            }

            const { data: behaviorSummary } = await this.supabase
                .from('user_behavior_summary')
                .select('*')
                .eq('user_id', authUser.id)
                .maybeSingle();

            if (behaviorSummary) {
                this.state.behaviorData = {
                    pageViews: [],
                    scrollDepth: {},
                    timeSpent: { _restored: behaviorSummary.total_study_time || 0 },
                    sectionTime: {},
                    interactions: [],
                    quizResults: [],
                    aiQueries: [],
                    _quizCorrect: behaviorSummary.quiz_correct_count || 0,
                    _quizTotal: behaviorSummary.quiz_total_count || 0,
                    _avgScrollDepth: behaviorSummary.avg_scroll_depth || 0
                };
                localStorage.setItem('nanofab_behavior', JSON.stringify(this.state.behaviorData));
            }

            // Load notes
            const { data: notes } = await this.supabase
                .from('user_notes')
                .select('*')
                .eq('user_id', authUser.id)
                .order('created_at', { ascending: false })
                .limit(500);

            if (notes?.length) {
                this.state.behaviorData.notes = notes.map(n => ({
                    id: n.id,
                    context: n.context,
                    content: n.content,
                    chapter: n.chapter_id,
                    chapterTitle: n.chapter_title,
                    timestamp: n.created_at
                }));
            }
        } catch (error) {
            console.error('Failed to load user data from Supabase:', error);
        }
    },

    async handleProfileSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        const getCheckedValues = (name) => {
            const values = [];
            e.target.querySelectorAll(`input[name="${name}"]:checked`).forEach((cb) => {
                values.push(cb.value);
            });
            return values;
        };

        const user = {
            name: formData.get('name'),
            background: formData.get('background'),
            level: formData.get('level'),
            motivation: getCheckedValues('motivation'),
            prerequisite: getCheckedValues('prerequisite'),
            studyPace: formData.get('studyPace'),
            learningStyle: getCheckedValues('learningStyle'),
            interestArea: getCheckedValues('interestArea'),
            weeklyHours: parseInt(formData.get('weeklyHours')) || 8,
            resume: formData.get('resume') || '',
            scores: formData.get('scores') || '',
            currentProject: formData.get('currentProject') || '',
            futureProject: formData.get('futureProject') || '',
            learningReason: formData.get('learningReason') || '',
            behaviorProfile: {
                weakTopics: [],
                strongTopics: [],
                preferredContentTypes: [],
                avgSessionTime: 0,
                quizAccuracy: 0,
                lastUpdated: new Date().toISOString()
            }
        };

        const pendingEmail = localStorage.getItem('pending_email');
        if (pendingEmail) {
            user.email = pendingEmail;
        }

        try {
            await this.saveUser(user);
            console.log('Profile saved successfully');
        } catch (saveError) {
            console.error('Error saving profile:', saveError);
        }

        localStorage.removeItem('pending_name');
        localStorage.removeItem('pending_email');
        sessionStorage.removeItem('pending_password');

        this.showApp();
    },

    showApp() {
        const onboarding = document.getElementById('onboarding-screen');
        const app = document.getElementById('app');

        if (onboarding) onboarding.classList.remove('active');
        if (app) app.style.display = 'grid';

        this.updateUserGreeting();
        this.updateProgress();
    },

    showOnboarding() {
        const onboarding = document.getElementById('onboarding-screen');
        const app = document.getElementById('app');

        if (onboarding) onboarding.classList.add('active');
        if (app) app.style.display = 'none';

        this.showAuthForm('login-form');
    },

    updateUserGreeting() {
        const greeting = document.getElementById('user-greeting');
        if (greeting && this.state.user) {
            greeting.textContent = this.state.user.name || '学习者';
        }

        const continueChapter = document.getElementById('continue-chapter');
        const continueBtn = document.getElementById('continue-btn');

        if (this.state.completedChapters.size > 0 && this.state.chapters.length > 0) {
            const allChapters = this.getAllChapters();
            const lastCompleted = [...this.state.completedChapters].pop();
            const lastIndex = allChapters.findIndex((ch) => ch.id === lastCompleted);
            const nextChapter = allChapters[lastIndex + 1] || allChapters[0];

            if (continueChapter) {
                continueChapter.textContent = `下一章：${nextChapter.title}`;
            }
            if (continueBtn) {
                continueBtn.href = `#chapter/${nextChapter.id}`;
                continueBtn.textContent = '继续学习';
            }
        } else if (continueBtn) {
            const firstChapter = this.getAllChapters()[0];
            if (firstChapter) {
                continueBtn.href = `#chapter/${firstChapter.id}`;
            }
        }
    },

    getAllChapters() {
        const chapters = [];
        this.state.chapters.forEach((part) => {
            part.chapters.forEach((ch) => {
                chapters.push({ ...ch, partId: part.id, partTitle: part.title });
            });
        });
        return chapters;
    },

    getChapterById(id) {
        return this.getAllChapters().find((ch) => ch.id === id);
    },

    handleRoute() {
        const hash = window.location.hash.slice(1) || 'home';
        const [route, param] = hash.split('/');

        this.state.currentView = route;

        switch (route) {
            case 'home':
                this.showView('view-home');
                this.updateUserGreeting();
                this.updateProgress();
                this.renderAILearningPath();
                this.renderMindMap();
                this.updateStudyStats();
                this.updateWrongAnswerBook();
                break;
            case 'chapter':
                if (param) {
                    this.showChapter(param);
                }
                break;
            default:
                this.showView('view-home');
        }

        this.closeSidebar();
    },

    showView(viewId) {
        document.querySelectorAll('.view').forEach((view) => {
            view.classList.add('hidden');
        });
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.remove('hidden');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showChapter(chapterId) {
        const chapter = this.getChapterById(chapterId);
        if (!chapter) return;

        this.state.currentChapter = chapter;
        this.state.behaviorData.pageViews.push({
            chapterId: chapterId,
            timestamp: new Date().toISOString()
        });
        this.saveBehaviorData(true);

        const titleEl = document.getElementById('chapter-title');
        const descEl = document.getElementById('chapter-description');
        const breadcrumbPart = document.getElementById('chapter-breadcrumb-part');
        const breadcrumbTitle = document.getElementById('chapter-breadcrumb-title');
        const contentEl = document.querySelector('.chapter-content');

        if (titleEl) titleEl.textContent = chapter.title;
        if (descEl) descEl.textContent = chapter.description;
        if (breadcrumbPart) breadcrumbPart.textContent = chapter.partTitle;
        if (breadcrumbTitle) breadcrumbTitle.textContent = chapter.title;

        if (contentEl) {
            contentEl.innerHTML = '<div class="content-loading">正在加载内容...</div>';
            fetch(`./content/chapters/${chapterId}.html`)
                .then(response => {
                    if (response.ok) {
                        return response.text();
                    }
                    throw new Error('Failed to load');
                })
                .then(html => {
                    contentEl.innerHTML = html;
                    
                    const isGitHubPages = window.location.hostname.includes('github.io');
                    if (isGitHubPages) {
                        const repoName = '/nanofab-web';
                        contentEl.querySelectorAll('img').forEach(img => {
                            const src = img.getAttribute('src');
                            if (src && (src.includes('/img/') || src.includes('../img/'))) {
                                const filename = src.split('/img/').pop();
                                const newSrc = repoName + '/img/' + filename;
                                console.log('Rewriting image path:', src, '->', newSrc);
                                img.src = newSrc;
                            }
                        });
                    }
                    
                    if (typeof renderMathInElement !== 'undefined') {
                        renderMathInElement(contentEl, {
                            delimiters: [
                                {left: '$$', right: '$$', display: true},
                                {left: '$', right: '$', display: false}
                            ],
                            throwOnError: false
                        });
                    }
                    this.renderMermaidDiagrams(contentEl);
                    this.initTextSelection(contentEl);
                    this.initLearningTools();
                    this.renderLearningObjectives(contentEl);
                    setTimeout(() => {
                        this.renderSubHeadings(contentEl);
                        this.initImageLightbox();
                        this.initHighlightNotes();
                    }, 500);

                    if (this._pendingQuizJump === chapterId) {
                        this._pendingQuizJump = null;
                        setTimeout(() => {
                            const quizTab = document.querySelector('.tool-tab[data-tab="quiz"]');
                            if (quizTab) quizTab.click();
                            const quizContent = document.getElementById('quiz-content');
                            if (quizContent) quizContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 300);
                    }
                })
                .catch(error => {
                    console.error('Failed to load chapter content:', error);
                    contentEl.innerHTML = '<div class="content-error">内容加载失败，请稍后重试</div>';
                });
        }

        this.updateChapterNav(chapterId);
        this.updateActiveNavItem(chapterId);
        this.showView('view-chapter');
        this.showChapterSummary(chapter);
    },

    showChapterSummary(chapter) {
        // Show a TL;DR summary box at the chapter header
        const descEl = document.getElementById('chapter-description');
        if (descEl && chapter.description) {
            descEl.innerHTML = `📖 <strong>本章速览：</strong>${chapter.description}`;
        }
    },

    initTextSelection(container) {
        const existingTooltip = document.querySelector('.ai-tooltip');
        if (existingTooltip) existingTooltip.remove();

        const tooltip = document.createElement('div');
        tooltip.className = 'ai-tooltip';
        tooltip.innerHTML = `
            <div class="ai-tooltip-content">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
                <span>AI解释</span>
            </div>
        `;
        document.body.appendChild(tooltip);

        let selectedText = '';
        let selectionTimeout = null;

        container.addEventListener('mouseup', () => {
            clearTimeout(selectionTimeout);
            selectionTimeout = setTimeout(() => {
                const selection = window.getSelection();
                selectedText = selection.toString().trim();

                if (selectedText.length > 0 && selectedText.length < 500) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
                    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10 + window.scrollY}px`;
                } else {
                    tooltip.style.display = 'none';
                }
            }, 10);
        });

        document.addEventListener('mousedown', (e) => {
            if (!tooltip.contains(e.target)) {
                tooltip.style.display = 'none';
            }
        });

        tooltip.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedText) {
                this.showAIExplanation(selectedText);
                tooltip.style.display = 'none';
                window.getSelection().removeAllRanges();
            }
        });
    },

    showAIExplanation(text) {
        this.openAISidebar();
        this.switchAISidebarTab('explanation');

        const emptyState = document.querySelector('#ai-explanation-panel .ai-panel-empty');
        const resultState = document.querySelector('#ai-explanation-panel .ai-explanation-result');
        const selectedTextContent = document.querySelector('#ai-explanation-panel .selected-text-content');
        const explanationBody = document.querySelector('#ai-explanation-panel .ai-explanation-body');

        if (emptyState) emptyState.classList.add('hidden');
        if (resultState) resultState.classList.remove('hidden');
        if (selectedTextContent) selectedTextContent.textContent = text;
        if (explanationBody) {
            explanationBody.innerHTML = `
                <div class="ai-loading">
                    <div class="ai-spinner"></div>
                    <p>正在根据您的背景生成个性化解释...</p>
                </div>
            `;
        }

        const chapter = this.state.currentChapter;
        const chapterContext = chapter ? `
当前章节：${chapter.title}
章节描述：${chapter.description}
` : '';

        this.generateExplanation(text, chapterContext).then(explanation => {
            if (explanationBody) {
                const formattedExplanation = this.formatAIResponse(explanation);
                explanationBody.innerHTML = `
                    <div class="explanation-result">
                        <div class="explanation-header">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                <path d="M2 17l10 5 10-5"/>
                                <path d="M2 12l10 5 10-5"/>
                            </svg>
                            <span>为您定制的解释</span>
                        </div>
                        <div class="explanation-body">${formattedExplanation}</div>
                    </div>
                `;
            }
        });
    },

    openAISidebar() {
        const sidebar = document.getElementById('ai-sidebar');
        const toggle = document.getElementById('ai-sidebar-toggle');
        if (sidebar) sidebar.classList.add('open');
        if (toggle) toggle.classList.add('hidden');
    },

    closeAISidebar() {
        const sidebar = document.getElementById('ai-sidebar');
        const toggle = document.getElementById('ai-sidebar-toggle');
        if (sidebar) sidebar.classList.remove('open');
        if (toggle) toggle.classList.remove('hidden');
    },

    switchAISidebarTab(tabId) {
        document.querySelectorAll('.ai-sidebar-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        document.querySelectorAll('#ai-sidebar .ai-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `ai-${tabId}-panel`);
        });
    },

    buildSystemPrompt(user, context) {
        const parts = [];

        parts.push('你是一位纳米制造技术专家，正在帮助用户学习《纳米制造技术：原理、工艺与实践》。请使用Markdown格式输出，包括标题、列表、粗体等，让内容结构清晰易读。');

        if (user) {
            const levelMap = { zero: '毫无基础', beginner: '初学者', intermediate: '中级', advanced: '高级' };
            parts.push(`用户学习水平：${levelMap[user.level] || user.level || '初学者'}`);
            parts.push(`专业背景：${user.background || '学生'}`);

            if (user.weeklyHours) {
                parts.push(`每周学习时间：${user.weeklyHours}小时`);
            }

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

            if (user.studyPace) {
                const paceMap = {
                    intensive: '集中学习（1-2周）',
                    moderate: '适中（1-2个月）',
                    relaxed: '轻松（3个月以上）'
                };
                parts.push(`学习节奏：${paceMap[user.studyPace]}`);
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
            parts.push('请根据用户的完整画像提供个性化解释。');
            parts.push('- 毫无基础：用最简单的生活类比，避免任何术语，解释为什么这个概念重要');
            parts.push('- 初学者：多用类比，避免复杂公式，强调直观理解');
            parts.push('- 中级：引入技术参数，解释物理机制，联系实际工艺');
            parts.push('- 高级：深入工程细节，讨论优化策略，引用最新进展');
            parts.push('- 根据学习动机调整侧重点（课程→考试要点，科研→前沿进展，职业→实操技能，兴趣→背景故事）');
            parts.push('- 根据先修知识决定数学深度');
            parts.push('- 根据感兴趣领域举例时优先使用相关应用');
            parts.push('- 根据学习节奏和每周学习时间调整内容密度');
            parts.push('- 结合用户当前正在阅读的章节上下文进行解释，不要孤立解释概念');
            parts.push('- 如果用户在某个章节停留时间较长或多次提问，说明该部分较难，请更详细地解释');
            parts.push('- 如果用户有进行中的项目，尝试将解释与其实际项目联系起来');
        } else if (context === 'chat') {
            parts.push('请作为个性化学习助手，根据用户画像回答问题。');
            parts.push('- 如果用户问基础概念，根据水平调整深度');
            parts.push('- 如果用户问应用场景，优先提及感兴趣的领域');
            parts.push('- 如果用户表现出困惑，建议适合的学习方式');
            parts.push('- 根据用户的学习行为数据（薄弱环节、停留时间等），主动提供针对性的学习建议');
        }

        parts.push('使用中文回答，保持专业但友好的语气。');

        return parts.join('\n');
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

    async generateExplanation(text, chapterContext = '') {
        const user = this.state.user;
        const level = user?.level || 'beginner';
        const provider = localStorage.getItem('ai_provider') || 'zhipu';

        const userContent = chapterContext
            ? `请解释以下纳米制造技术概念："${text}"\n\n${chapterContext}`
            : `请解释以下纳米制造技术概念："${text}"`;

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

    updateChapterNav(currentId) {
        const allChapters = this.getAllChapters();
        const currentIndex = allChapters.findIndex((ch) => ch.id === currentId);
        const prevChapter = allChapters[currentIndex - 1];
        const nextChapter = allChapters[currentIndex + 1];

        const prevBtn = document.getElementById('prev-chapter');
        const nextBtn = document.getElementById('next-chapter');
        const markBtn = document.getElementById('mark-complete');

        if (prevBtn) {
            if (prevChapter) {
                prevBtn.href = `#chapter/${prevChapter.id}`;
                prevBtn.classList.remove('hidden');
            } else {
                prevBtn.classList.add('hidden');
            }
        }

        if (nextBtn) {
            if (nextChapter) {
                nextBtn.href = `#chapter/${nextChapter.id}`;
                nextBtn.classList.remove('hidden');
            } else {
                nextBtn.classList.add('hidden');
            }
        }

        if (markBtn) {
            if (this.state.completedChapters.has(currentId)) {
                markBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    已完成
                `;
                markBtn.classList.add('btn-secondary');
                markBtn.classList.remove('btn-primary');
            } else {
                markBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    标记为已完成
                `;
                markBtn.classList.add('btn-primary');
                markBtn.classList.remove('btn-secondary');
            }
        }
    },

    markChapterComplete() {
        if (!this.state.currentChapter) return;

        const chapterId = this.state.currentChapter.id;

        if (this.state.completedChapters.has(chapterId)) {
            this.state.completedChapters.delete(chapterId);
        } else {
            this.state.completedChapters.add(chapterId);
        }

        this.saveProgress();
        this.updateChapterNav(chapterId);
        this.updateActiveNavItem(chapterId);
        this.updateProgress();
    },

    updateProgress() {
        const total = 12;
        const completed = this.state.completedChapters.size;
        const percent = Math.round((completed / total) * 100);

        const headerProgress = document.getElementById('header-progress');
        const progressPercent = document.getElementById('progress-percent');
        const dashboardProgress = document.getElementById('dashboard-progress');
        const completedCount = document.getElementById('completed-count');

        if (headerProgress) {
            headerProgress.setAttribute('stroke-dasharray', `${percent}, 100`);
        }
        if (progressPercent) {
            progressPercent.textContent = `${percent}%`;
        }
        if (dashboardProgress) {
            dashboardProgress.style.width = `${percent}%`;
        }
        if (completedCount) {
            completedCount.textContent = completed;
        }
    },

    renderNavigation() {
        const nav = document.getElementById('chapter-nav');
        if (!nav) return;

        nav.innerHTML = '';

        this.state.chapters.forEach((part, partIndex) => {
            const partEl = document.createElement('div');
            partEl.className = 'nav-part';
            partEl.dataset.partId = part.id;

            const isExpanded = partIndex === 0;
            if (isExpanded) {
                partEl.classList.add('expanded');
            }

            const header = document.createElement('button');
            header.className = 'nav-part-header';
            header.innerHTML = `
                <span>${part.title}</span>
                <span class="nav-part-toggle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </span>
            `;
            header.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                partEl.classList.toggle('expanded');
            });

            const chaptersContainer = document.createElement('div');
            chaptersContainer.className = 'nav-chapters';

            part.chapters.forEach((chapter) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'nav-chapter-row';

                const chapterLink = document.createElement('a');
                chapterLink.className = 'nav-chapter';
                chapterLink.href = `#chapter/${chapter.id}`;
                chapterLink.dataset.chapterId = chapter.id;
                chapterLink.innerHTML = `
                    <span class="chapter-id">${chapter.id}</span>
                    <span class="chapter-title">${chapter.title}</span>
                `;

                if (this.state.completedChapters.has(chapter.id)) {
                    chapterLink.classList.add('completed');
                }

                const quizLink = document.createElement('a');
                quizLink.className = 'nav-chapter-quiz';
                quizLink.href = `#chapter/${chapter.id}`;
                quizLink.textContent = `${chapter.id}-测试题`;
                quizLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._pendingQuizJump = chapter.id;
                    window.location.hash = `#chapter/${chapter.id}`;
                });

                wrapper.appendChild(chapterLink);
                wrapper.appendChild(quizLink);
                chaptersContainer.appendChild(wrapper);
            });

            partEl.appendChild(header);
            partEl.appendChild(chaptersContainer);
            nav.appendChild(partEl);
        });
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
        const pace = user.studyPace;

        if (style.includes('visual')) tips.push('多关注图表和流程图来加深理解');
        if (style.includes('theory')) tips.push('深入推导公式背后的物理机制');
        if (style.includes('practical')) tips.push('结合工艺实践案例理解理论');
        if (style.includes('case')) tips.push('通过实际应用案例验证所学知识');
        if (pace === 'intensive') tips.push('保持每天至少一个章节的学习节奏');
        if (bp.quizAccuracy > 0 && bp.quizAccuracy < 0.6) tips.push('建议先复习薄弱章节再继续新课');

        return {
            next: nextChapter ? nextChapter.title : '所有章节已完成',
            review: reviewChapters,
            mastered: masteredChapters,
            accuracy: bp.quizAccuracy ? Math.round(bp.quizAccuracy * 100) : 0,
            tips: tips.length > 0 ? tips : ['继续按照课程顺序学习，完成测试巩固理解']
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

    renderQuickNav() {
        const quickNav = document.getElementById('quick-nav');
        if (!quickNav) return;

        quickNav.innerHTML = '';

        this.state.chapters.forEach((part) => {
            part.chapters.forEach((chapter) => {
                const link = document.createElement('a');
                link.className = 'quick-chapter-link';
                link.href = `#chapter/${chapter.id}`;
                link.innerHTML = `
                    <span class="chapter-number">${chapter.id}</span>
                    <span class="chapter-title">${chapter.title}</span>
                `;
                quickNav.appendChild(link);
            });
        });
    },

    updateActiveNavItem(chapterId) {
        document.querySelectorAll('.nav-chapter').forEach((el) => {
            el.classList.remove('active');
            if (el.dataset.chapterId === chapterId) {
                el.classList.add('active');
            }
        });
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (sidebar) {
            sidebar.classList.toggle('open');
        }
        if (overlay) {
            overlay.classList.toggle('active');
        }

        this.state.sidebarOpen = !this.state.sidebarOpen;
    },

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (sidebar) {
            sidebar.classList.remove('open');
        }
        if (overlay) {
            overlay.classList.remove('active');
        }

        this.state.sidebarOpen = false;
    },

    openProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        
        if (!this.state.user) {
            this.showOnboarding();
            return;
        }

        const backgroundMap = {
            student: '在校学生',
            researcher: '科研人员',
            engineer: '工程师',
            other: '其他'
        };

        const levelMap = {
            zero: '毫无基础',
            beginner: '初学者',
            intermediate: '中级',
            advanced: '高级'
        };

        const motivationMap = {
            course: '课程学习',
            research: '科研需要',
            career: '职业发展',
            interest: '个人兴趣'
        };

        document.getElementById('profile-name').textContent = this.state.user.name;
        document.getElementById('profile-background').textContent =
            backgroundMap[this.state.user.background] || this.state.user.background;
        document.getElementById('profile-level').textContent =
            levelMap[this.state.user.level] || this.state.user.level;
        document.getElementById('profile-motivation').textContent =
            (this.state.user.motivation || [])
                .map((m) => motivationMap[m] || m)
                .join('、') || '未选择';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    },

    async resetProfile() {
        localStorage.removeItem('nanofab_user');
        localStorage.removeItem('nanofab_progress');
        localStorage.removeItem('nanofab_behavior');
        localStorage.removeItem('deepseek_api_key');
        localStorage.removeItem('gemini_api_key');
        localStorage.removeItem('ai_provider');
        localStorage.removeItem('pending_name');
        localStorage.removeItem('pending_email');
        sessionStorage.removeItem('pending_password');

        if (this.supabase) {
            try {
                await this.supabase.auth.signOut();
            } catch (error) {
                console.error('Failed to sign out:', error);
            }
        }

        this.state.user = null;
        this.state.completedChapters = new Set();
        this.state.behaviorData = {
            pageViews: [],
            scrollDepth: {},
            timeSpent: {},
            interactions: [],
            quizResults: []
        };
        this.closeProfileModal();
        location.reload();
    },

    initLearningTools() {
        document.querySelectorAll('.tool-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;

                document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                document.querySelectorAll('.tool-content').forEach(content => {
                    content.classList.add('hidden');
                });
                document.getElementById(`${tabId}-content`).classList.remove('hidden');
            });
        });

        document.querySelectorAll('.quiz-options').forEach(optionsContainer => {
            const questionEl = optionsContainer.closest('.quiz-question');
            const feedbackEl = questionEl.querySelector('.quiz-feedback');
            const correctAnswer = feedbackEl.dataset.correct;

            optionsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    const selectedValue = radio.value;
                    const isCorrect = selectedValue === correctAnswer;

                    optionsContainer.querySelectorAll('.quiz-option').forEach(opt => {
                        opt.classList.remove('correct', 'incorrect');
                    });

                    radio.closest('.quiz-option').classList.add(isCorrect ? 'correct' : 'incorrect');

                    feedbackEl.classList.remove('hidden', 'show-correct', 'show-incorrect');
                    feedbackEl.classList.add(isCorrect ? 'show-correct' : 'show-incorrect');

                    this.state.behaviorData.quizResults.push({
                        question: questionEl.dataset.question,
                        correct: isCorrect,
                        timestamp: new Date().toISOString(),
                        chapter: this.state.currentChapter?.id
                    });
                    this.saveBehaviorData(true);
                    this.updateBehaviorProfile();

                    this.syncQuizAnswer(questionEl, selectedValue, correctAnswer, isCorrect);

                    this.checkQuizCompletion();
                });
            });

            // Handle multi-select checkbox questions
            const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]');
            if (checkboxes.length > 0) {
                const checkBtn = document.createElement('button');
                checkBtn.className = 'btn btn-primary quiz-check-btn';
                checkBtn.textContent = '确认提交';
                optionsContainer.parentElement.appendChild(checkBtn);

                checkBtn.addEventListener('click', () => {
                    const selectedValues = [];
                    checkboxes.forEach(cb => {
                        if (cb.checked) selectedValues.push(cb.value);
                    });
                    if (selectedValues.length === 0) return;

                    const selected = selectedValues.sort().join('');
                    const isCorrect = selected === correctAnswer;

                    feedbackEl.classList.remove('hidden', 'show-correct', 'show-incorrect');
                    feedbackEl.classList.add(isCorrect ? 'show-correct' : 'show-incorrect');

                    this.state.behaviorData.quizResults.push({
                        question: questionEl.dataset.question,
                        correct: isCorrect,
                        timestamp: new Date().toISOString(),
                        chapter: this.state.currentChapter?.id
                    });
                    this.saveBehaviorData(true);
                    this.updateBehaviorProfile();

                    this.syncQuizAnswer(questionEl, selected, correctAnswer, isCorrect);

                    this.checkQuizCompletion();
                });
            }
        });

        document.querySelectorAll('.exercise-hint-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const hint = btn.nextElementSibling;
                if (hint.classList.contains('hidden')) {
                    hint.classList.remove('hidden');
                    btn.textContent = '隐藏提示';
                } else {
                    hint.classList.add('hidden');
                    btn.textContent = '查看提示';
                }
            });
        });
    },

    checkQuizCompletion() {
        const totalQuestions = document.querySelectorAll('.quiz-question').length;
        const answeredQuestions = document.querySelectorAll('.quiz-feedback:not(.hidden)').length;

        if (answeredQuestions === totalQuestions) {
            const correctCount = document.querySelectorAll('.quiz-feedback.show-correct').length;
            const summary = document.querySelector('.quiz-summary');
            if (summary) {
                summary.classList.remove('hidden');
                summary.querySelector('.score-number').textContent = correctCount;
            }
            this.updateWrongAnswerBook();
        }
    },

    initAIAssistant() {
        const sidebarToggle = document.getElementById('ai-sidebar-toggle');
        const sidebarClose = document.getElementById('ai-sidebar-close');
        const sidebar = document.getElementById('ai-sidebar');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                sidebarToggle.classList.toggle('hidden', sidebar.classList.contains('open'));
            });
        }

        if (sidebarClose && sidebar) {
            sidebarClose.addEventListener('click', () => {
                sidebar.classList.remove('open');
                if (sidebarToggle) sidebarToggle.classList.remove('hidden');
            });
        }

        document.querySelectorAll('.ai-sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this.switchAISidebarTab(tabId);
            });
        });

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

            this.addChatMessage(text, 'user');
            input.value = '';
            input.style.height = 'auto';

            this.showTypingIndicator();

            try {
                const response = await this.generateAIResponse(text);
                this.removeTypingIndicator();
                this.addChatMessage(response, 'assistant');
            } catch (error) {
                this.removeTypingIndicator();
                this.addChatMessage('抱歉，处理你的问题时出现了错误。请稍后重试。', 'assistant');
            }
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

    addChatMessage(text, role) {
        const messages = document.getElementById('ai-chat-messages');
        if (!messages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ai-message-${role}`;

        const avatarSvg = role === 'user'
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';

        const bodyContent = role === 'assistant'
            ? this.formatAIResponse(text)
            : `<p>${this.escapeHtml(text)}</p>`;

        messageDiv.innerHTML = `
            <div class="ai-message-avatar">${avatarSvg}</div>
            <div class="ai-message-content">${bodyContent}</div>
        `;

        messages.appendChild(messageDiv);
        messages.scrollTop = messages.scrollHeight;
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

        messages.push({ role: 'user', content: userMessage });

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

    renderMermaidDiagrams(container) {
        const codeBlocks = container.querySelectorAll('pre code');
        const diagramsToRender = [];

        codeBlocks.forEach(block => {
            const text = block.textContent.trim();
            if (text.startsWith('graph ') || text.startsWith('flowchart ') || text.startsWith('sequenceDiagram') || text.startsWith('classDiagram')) {
                const pre = block.parentElement;
                const wrapper = document.createElement('div');
                wrapper.className = 'mermaid-diagram-container';
                const mermaidDiv = document.createElement('div');
                mermaidDiv.className = 'mermaid';
                mermaidDiv.textContent = text;
                wrapper.appendChild(mermaidDiv);
                pre.parentNode.replaceChild(wrapper, pre);
                diagramsToRender.push(mermaidDiv);
            }
        });

        if (diagramsToRender.length > 0 && typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose'
            });

            diagramsToRender.forEach((element, index) => {
                const id = 'mermaid-' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 8);
                try {
                    mermaid.render(id, element.textContent).then(result => {
                        element.innerHTML = result.svg;
                    }).catch(err => {
                        console.error('Mermaid render error:', err);
                    });
                } catch (err) {
                    console.error('Mermaid render exception:', err);
                }
            });
        }
    },

    formatAIResponse(text) {
        if (!text) return '';

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

        return result.join('\n');
    },

    // ===== 思维导图 =====
    renderMindMap() {
        const container = document.getElementById('quick-mindmap');
        if (!container || this.state.chapters.length === 0) return;

        const colors = ['#004EA1', '#9D0A12', '#0d9488', '#7c3aed'];
        const colorsLight = ['#e6f0fa', '#fdf2f3', '#ecfdf5', '#f5f3ff'];
        const colorsDark = ['#003a7a', '#7a080e', '#0a6e63', '#5b21b6'];

        const w = 840, h = 600;
        const cx = w / 2, cy = h / 2;

        let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

        // Background gradient
        svg += `<defs>
            <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#f8fafc"/>
                <stop offset="100%" stop-color="#f1f5f9"/>
            </radialGradient>
            <filter id="shadow-sm">
                <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.1"/>
            </filter>
        </defs>`;

        svg += `<rect width="${w}" height="${h}" rx="12" fill="url(#bg-grad)"/>`;

        // Title
        svg += `<text x="${cx}" y="28" text-anchor="middle" fill="#0f172a" font-size="16" font-weight="700" font-family="Noto Sans SC, sans-serif">纳米制造技术 课程知识结构</text>`;

        // Center root node
        const rootW = 140, rootH = 48;
        svg += `<rect x="${cx - rootW/2}" y="${cy - rootH/2}" width="${rootW}" height="${rootH}" rx="24" fill="url(#bg-grad)" filter="url(#shadow-sm)"/>`;
        svg += `<rect x="${cx - rootW/2}" y="${cy - rootH/2}" width="${rootW}" height="${rootH}" rx="24" fill="#004EA1"/>`;
        svg += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="Noto Sans SC, sans-serif">纳米制造技术</text>`;

        // Layout: 2x2 grid for 4 parts
        const positions = [
            { px: cx - 240, py: cy - 140, tx: 0, ty: -1 },    // top-left
            { px: cx + 240, py: cy - 140, tx: 0, ty: -1 },    // top-right
            { px: cx - 240, py: cy + 140, tx: 0, ty: 1 },     // bottom-left
            { px: cx + 240, py: cy + 140, tx: 0, ty: 1 }      // bottom-right
        ];

        this.state.chapters.forEach((part, partIndex) => {
            const pos = positions[partIndex];
            const color = colors[partIndex];
            const lightColor = colorsLight[partIndex];
            const darkColor = colorsDark[partIndex];

            // Connector line from center to part
            const mx = pos.px, my = pos.py;
            const sx = cx + (mx - cx) * 0.22;
            const sy = cy + (my - cy) * 0.22;
            const ex = mx + (cx - mx) * 0.15;
            const ey = my + (cy - my) * 0.15;
            svg += `<path d="M${sx} ${sy} Q${(sx+ex)/2 + (my - cy)*0.08} ${(sy+ey)/2 - (mx - cx)*0.08} ${ex} ${ey}"
                         stroke="${color}" stroke-width="2.5" fill="none" opacity="0.5"/>`;

            // Part header
            const partW = 180, partH = 36;
            svg += `<rect x="${mx - partW/2}" y="${my - partH/2}" width="${partW}" height="${partH}" rx="8" fill="${lightColor}" stroke="${color}" stroke-width="2" filter="url(#shadow-sm)"/>`;
            const partLabel = part.title.replace(/^[^：:]*[：:]/, '').replace(/[与和&].*/, '');
            svg += `<text x="${mx}" y="${my + 4}" text-anchor="middle" fill="${darkColor}" font-size="13" font-weight="700" font-family="Noto Sans SC, sans-serif">${part.title}</text>`;

            // Chapter nodes
            const chStartY = my > cy ? my + 50 : my - 50;
            const chDir = my > cy ? 1 : -1;

            part.chapters.forEach((ch, chIndex) => {
                const chY = chStartY + chDir * chIndex * 52;
                const chW = 160, chH = 32;
                const chX = mx;

                // Connector from part to chapter
                svg += `<line x1="${mx}" y1="${my + chDir * partH/2}" x2="${mx}" y2="${chY - chDir * chH/2}"
                             stroke="${color}" stroke-width="1.2" opacity="0.35"/>`;

                // Chapter node
                svg += `<rect x="${chX - chW/2}" y="${chY - chH/2}" width="${chW}" height="${chH}" rx="6"
                             fill="white" stroke="${color}" stroke-width="1.2" opacity="0.9"/>`;
                svg += `<text x="${chX - chW/2 + 10}" y="${chY + 4}" fill="${darkColor}" font-size="9" font-family="'SF Mono', monospace" opacity="0.7">${ch.id}</text>`;
                svg += `<text x="${chX - chW/2 + 40}" y="${chY + 4}" fill="#1e293b" font-size="11" font-weight="500" font-family="Noto Sans SC, sans-serif">${ch.title}</text>`;

                // Subtle dot indicators on the outer side
                const dotX = chX + (chDir > 0 ? chW/2 + 10 : -chW/2 - 10);
                svg += `<circle cx="${dotX}" cy="${chY}" r="3" fill="${color}" opacity="0.6"/>`;
            });
        });

        // Legend at bottom
        const legendY = h - 16;
        const legendItems = this.state.chapters.map((p, i) => ({
            label: p.title,
            color: colors[i],
            chCount: p.chapters.length
        }));

        let legendX = cx - (legendItems.length * 180) / 2;
        legendItems.forEach(item => {
            svg += `<rect x="${legendX}" y="${legendY - 6}" width="10" height="10" rx="2" fill="${item.color}" opacity="0.8"/>`;
            svg += `<text x="${legendX + 14}" y="${legendY + 2}" fill="#475569" font-size="9" font-family="Noto Sans SC, sans-serif">${item.label}（${item.chCount}章）</text>`;
            legendX += 210;
        });

        svg += '</svg>';
        container.innerHTML = svg;
    },

    // ===== 学习统计 =====
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

        const user = this.state.user;
        const weeklyGoal = (user?.weeklyHours || 8) * 3600;
        const weeklyPercent = Math.min(100, Math.round((weekSeconds / weeklyGoal) * 100));

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

        const elBar = document.getElementById('stat-weekly-bar');
        if (elBar) elBar.style.width = `${weeklyPercent}%`;
        const elBarLabel = document.getElementById('stat-weekly-bar-label');
        if (elBarLabel) elBarLabel.textContent = `${weeklyPercent}%`;
    },

    // ===== 图片放大 =====
    initImageLightbox() {
        const lightbox = document.getElementById('image-lightbox');
        const lightboxImg = document.getElementById('image-lightbox-img');
        if (!lightbox || !lightboxImg) return;

        const closeBtn = lightbox.querySelector('.image-lightbox-close');

        const openLightbox = (src) => {
            lightboxImg.src = src;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        };

        const closeLightbox = () => {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
            lightboxImg.src = '';
        };

        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
        if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                closeLightbox();
            }
        });

        // Attach click handlers to chapter content images
        const contentEl = document.querySelector('.chapter-content');
        if (contentEl) {
            contentEl.querySelectorAll('img').forEach(img => {
                if (!img.dataset.lightboxReady) {
                    img.dataset.lightboxReady = '1';
                    img.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (img.closest('.mermaid-diagram-container')) return;
                        openLightbox(img.src);
                    });
                }
            });
        }
    },

    // ===== 侧边栏二级标题 =====
    renderSubHeadings(chapterContentEl) {
        if (!chapterContentEl) return;

        const headings = chapterContentEl.querySelectorAll('h2, h3');
        const chapterId = this.state.currentChapter?.id;
        if (!chapterId) return;

        // Find the matching nav-chapter-row
        const chapterRow = document.querySelector(`.nav-chapter[data-chapter-id="${chapterId}"]`)?.closest('.nav-chapter-row');
        if (!chapterRow) return;

        // Remove existing sub-headings
        const existing = chapterRow.querySelector('.nav-subheadings');
        if (existing) existing.remove();

        if (headings.length === 0) return;

        const subContainer = document.createElement('div');
        subContainer.className = 'nav-subheadings';

        headings.forEach((h, i) => {
            if (!h.id) {
                h.id = 'section-' + chapterId + '-' + i + '-' + Math.random().toString(36).slice(2, 6);
            }
            const link = document.createElement('a');
            link.className = 'nav-subheading';
            link.href = `#${h.id}`;
            link.textContent = (h.tagName === 'H3' ? '  ∘ ' : '') + h.textContent.trim().substring(0, 30);
            link.addEventListener('click', (e) => {
                e.preventDefault();
                h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            subContainer.appendChild(link);
        });

        chapterRow.appendChild(subContainer);
        chapterRow.classList.add('expanded-sub');
    },

    // ===== 学习目标 =====
    renderLearningObjectives(chapterContentEl) {
        if (!chapterContentEl) return;

        // Remove existing objectives
        const existing = chapterContentEl.querySelector('.learning-objectives');
        if (existing) existing.remove();

        const chapter = this.state.currentChapter;
        if (!chapter) return;

        // Generate objectives based on chapter metadata and user level
        const user = this.state.user;
        const level = user?.level || 'beginner';

        const objectives = {
            basic: [
                `理解${chapter.title}的基本概念和核心原理`,
                `掌握${chapter.title}的主要术语和关键参数`,
                `了解${chapter.title}的常见应用场景`
            ],
            advanced: [
                `深入分析${chapter.title}的技术细节和工艺限制`,
                `比较不同${chapter.title}方法的优劣势和适用场景`,
                `将${chapter.title}知识与实际工艺问题相结合`
            ]
        };

        if (level === 'zero' || level === 'beginner') {
            objectives.basic = objectives.basic;
        }
        if (level === 'advanced') {
            objectives.basic = objectives.basic.slice(0, 1);
            objectives.advanced = objectives.advanced;
        }

        const objHTML = `
            <div class="learning-objectives">
                <div class="learning-objectives-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    <h4>学习目标</h4>
                </div>
                <div class="learning-objectives-list">
                    ${objectives.basic.map(o => `
                        <div class="learning-objective-item">
                            <span class="obj-badge basic">基础</span>
                            <span>${o}</span>
                        </div>
                    `).join('')}
                    ${objectives.advanced.map(o => `
                        <div class="learning-objective-item">
                            <span class="obj-badge advanced">进阶</span>
                            <span>${o}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Insert at the top of chapter content (after the first heading)
        const firstHeading = chapterContentEl.querySelector('h1');
        if (firstHeading) {
            firstHeading.insertAdjacentHTML('afterend', objHTML);
        } else {
            chapterContentEl.insertAdjacentHTML('afterbegin', objHTML);
        }
    },

    // ===== 错题本 =====
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

    // ===== 高亮和笔记 =====
    initHighlightNotes() {
        const contentEl = document.querySelector('.chapter-content');
        if (!contentEl) return;

        // Remove existing elements
        const existingBtn = document.querySelector('.highlight-note-btn');
        if (existingBtn) existingBtn.remove();
        const existingPopup = document.querySelector('.note-input-popup');
        if (existingPopup) existingPopup.remove();

        // Floating toolbar
        const noteBtn = document.createElement('div');
        noteBtn.className = 'highlight-note-btn';
        noteBtn.innerHTML = `
            <div class="sub-options">
                <span class="sub-option" data-action="highlight">✨ 标记重点</span>
                <span class="sub-option" data-action="note">📝 记笔记</span>
            </div>
        `;
        document.body.appendChild(noteBtn);

        // Note input popup
        const notePopup = document.createElement('div');
        notePopup.className = 'note-input-popup';
        notePopup.innerHTML = `
            <div class="note-input-context"></div>
            <textarea placeholder="在此输入你的笔记内容..."></textarea>
            <div class="note-input-actions">
                <button class="btn btn-sm btn-cancel cancel-note-btn">取消</button>
                <button class="btn btn-sm btn-primary save-note-btn">保存笔记</button>
            </div>
        `;
        document.body.appendChild(notePopup);

        let selectedText = '';
        let selectedRange = null;

        contentEl.addEventListener('mouseup', (e) => {
            setTimeout(() => {
                const sel = window.getSelection();
                selectedText = sel.toString().trim();

                if (selectedText.length > 5 && selectedText.length < 500) {
                    selectedRange = sel.getRangeAt(0);
                    const rect = selectedRange.getBoundingClientRect();
                    noteBtn.style.display = 'block';
                    noteBtn.style.left = `${Math.max(10, rect.left + rect.width / 2 - noteBtn.offsetWidth / 2)}px`;
                    noteBtn.style.top = `${rect.bottom + 8 + window.scrollY}px`;
                } else {
                    noteBtn.style.display = 'none';
                }
            }, 10);
        });

        // Toolbar actions
        noteBtn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (!action || !selectedText || !selectedRange) return;

            if (action === 'highlight') {
                this.toggleHighlight(selectedRange, selectedText);
                noteBtn.style.display = 'none';
                window.getSelection().removeAllRanges();
            } else if (action === 'note') {
                const rect = selectedRange.getBoundingClientRect();
                notePopup.querySelector('.note-input-context').textContent =
                    `"${selectedText.substring(0, 120)}${selectedText.length > 120 ? '...' : ''}"`;
                notePopup.querySelector('textarea').value = '';
                notePopup.style.display = 'block';
                notePopup.style.left = `${Math.min(rect.right + 12, window.innerWidth - 300)}px`;
                notePopup.style.top = `${rect.top + window.scrollY}px`;
                notePopup._text = selectedText;
                notePopup._range = selectedRange;
                noteBtn.style.display = 'none';
                setTimeout(() => notePopup.querySelector('textarea').focus(), 50);
            }
        });

        // Save note
        notePopup.querySelector('.save-note-btn').addEventListener('click', () => {
            const noteContent = notePopup.querySelector('textarea').value.trim();
            const text = notePopup._text;
            const range = notePopup._range;
            if (!noteContent || !text) return;
            if (range) this.highlightAndAnnotate(range, text, noteContent);
            notePopup.style.display = 'none';
            window.getSelection().removeAllRanges();
        });

        // Cancel note
        notePopup.querySelector('.cancel-note-btn').addEventListener('click', () => {
            notePopup.style.display = 'none';
            window.getSelection().removeAllRanges();
        });

        // Click on existing highlights: toggle plain highlight, or jump to annotation
        contentEl.addEventListener('click', (e) => {
            const mark = e.target.closest('mark.user-highlight, span.user-highlight-mark');
            if (!mark) return;

            if (mark.classList.contains('has-note')) {
                const noteId = mark.dataset.noteId;
                if (noteId) {
                    const ann = document.querySelector(`.note-annotation[data-note-id="${noteId}"]`);
                    if (ann) {
                        ann.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        ann.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.3)';
                        setTimeout(() => ann.style.boxShadow = '', 2000);
                    }
                }
            } else {
                if (confirm('取消此标记？')) {
                    const t = mark.textContent;
                    mark.replaceWith(document.createTextNode(t));
                    this.removeHighlight(t);
                    this.showToast('已取消标记', 'info');
                }
            }
        });

        // Click outside dismisses toolbar, and popup if empty
        document.addEventListener('mousedown', (e) => {
            if (!noteBtn.contains(e.target) && !notePopup.contains(e.target)) {
                noteBtn.style.display = 'none';
                if (!notePopup.querySelector('textarea').value.trim()) {
                    notePopup.style.display = 'none';
                }
            }
        });

        this.restoreHighlights(contentEl);
    },

    toggleHighlight(range, text) {
        // If selection is inside an existing plain highlight, toggle it off
        const existing = range.startContainer.parentElement?.closest('mark.user-highlight:not(.has-note), span.user-highlight-mark:not(.has-note)');
        if (existing) {
            const t = existing.textContent;
            existing.replaceWith(document.createTextNode(t));
            this.removeHighlight(t);
            this.showToast('已取消标记', 'info');
            return;
        }

        try {
            const mark = document.createElement('mark');
            mark.className = 'user-highlight';
            mark.title = '点击取消标记';
            this.saveHighlight(text);
            range.surroundContents(mark);
            this.showToast('已标记重点 ✨', 'success');
        } catch (e) {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const r = sel.getRangeAt(0);
                const span = document.createElement('span');
                span.className = 'user-highlight-mark';
                this.saveHighlight(text);
                try {
                    r.surroundContents(span);
                    this.showToast('已标记重点 ✨', 'success');
                } catch {
                    this.showToast('无法标记此区域', 'warning');
                }
            }
        }
    },

    highlightAndAnnotate(range, text, noteContent) {
        const noteId = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const chapter = this.state.currentChapter;
        const noteEntry = {
            id: noteId,
            context: text.substring(0, 300),
            content: noteContent,
            chapter: chapter?.id,
            chapterTitle: chapter?.title,
            timestamp: new Date().toISOString()
        };

        if (!this.state.behaviorData.notes) this.state.behaviorData.notes = [];
        this.state.behaviorData.notes.push(noteEntry);
        this.saveHighlight(text, noteId);
        this.saveBehaviorData(true);
        this._syncNoteToSupabase(noteEntry);

        const annotationHTML = `
            <div class="note-annotation-header">
                <span class="note-annotation-label">📝 笔记</span>
                <span class="note-annotation-delete" data-note-id="${noteId}">✕ 删除</span>
            </div>
            <div class="note-annotation-context">原文："${this.escapeHtml(text.substring(0, 100))}${text.length > 100 ? '...' : ''}"</div>
            <div class="note-annotation-content">${this.escapeHtml(noteContent)}</div>
        `;

        const bindAnnotationDelete = (ann, hlEl) => {
            ann.querySelector('.note-annotation-delete').addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (confirm('删除此笔记？关联的高亮也将取消。')) {
                    this.state.behaviorData.notes = (this.state.behaviorData.notes || [])
                        .filter(n => n.id !== noteId);
                    this.saveBehaviorData(true);
                    this._deleteNoteFromSupabase(noteId);
                    ann.remove();
                    if (hlEl.parentNode) hlEl.replaceWith(document.createTextNode(hlEl.textContent));
                    this.showToast('笔记已删除', 'info');
                }
            });
        };

        const insertAnnotation = (hlEl) => {
            const parentP = hlEl.closest('p, li, h2, h3, h4, blockquote, td') || hlEl.parentElement;
            const ann = document.createElement('div');
            ann.className = 'note-annotation';
            ann.dataset.noteId = noteId;
            ann.innerHTML = annotationHTML;
            if (parentP.nextSibling) {
                parentP.parentNode.insertBefore(ann, parentP.nextSibling);
            } else {
                parentP.parentNode.appendChild(ann);
            }
            bindAnnotationDelete(ann, hlEl);
        };

        try {
            const mark = document.createElement('mark');
            mark.className = 'user-highlight has-note';
            mark.title = '点击查看笔记';
            mark.dataset.noteId = noteId;
            range.surroundContents(mark);
            insertAnnotation(mark);
            this.showToast('笔记已保存 📝', 'success');
        } catch (e) {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const r = sel.getRangeAt(0);
                const span = document.createElement('span');
                span.className = 'user-highlight-mark has-note';
                span.dataset.noteId = noteId;
                span.title = '点击查看笔记';
                try {
                    r.surroundContents(span);
                    insertAnnotation(span);
                    this.showToast('笔记已保存 📝', 'success');
                } catch {
                    this.showToast('无法在此区域添加笔记', 'warning');
                }
            }
        }
    },

    saveHighlight(text, noteId) {
        if (!this.state.behaviorData.highlights) this.state.behaviorData.highlights = [];
        this.state.behaviorData.highlights.push({
            text: text.substring(0, 200),
            noteId: noteId || null,
            chapter: this.state.currentChapter?.id,
            timestamp: new Date().toISOString()
        });
    },

    removeHighlight(text) {
        if (!this.state.behaviorData.highlights) return;
        this.state.behaviorData.highlights = this.state.behaviorData.highlights
            .filter(h => h.text.substring(0, 50) !== text.substring(0, 50));
        this.saveBehaviorData(true);
    },

    restoreHighlights(contentEl) {
        const notes = this.state.behaviorData.notes || [];
        const currentChapterId = this.state.currentChapter?.id;

        notes.forEach((note) => {
            if (note.chapter && note.chapter !== currentChapterId) return;
            if (contentEl.querySelector(`.note-annotation[data-note-id="${note.id}"]`)) return;

            const searchText = note.context || note.text || '';
            if (!searchText || searchText.length < 5) return;

            const mark = this._findAndHighlightText(contentEl, searchText, note.id);
            if (!mark) return;

            const parentP = mark.closest('p, li, h2, h3, h4, blockquote, td') || mark.parentElement;
            const ann = document.createElement('div');
            ann.className = 'note-annotation';
            ann.dataset.noteId = note.id;
            ann.innerHTML = `
                <div class="note-annotation-header">
                    <span class="note-annotation-label">📝 笔记</span>
                    <span class="note-annotation-delete" data-note-id="${note.id}">✕ 删除</span>
                </div>
                <div class="note-annotation-context">原文："${this.escapeHtml(searchText.substring(0, 100))}"</div>
                <div class="note-annotation-content">${this.escapeHtml(note.content || '')}</div>
            `;
            if (parentP.nextSibling) {
                parentP.parentNode.insertBefore(ann, parentP.nextSibling);
            } else {
                parentP.parentNode.appendChild(ann);
            }
            ann.querySelector('.note-annotation-delete').addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (confirm('删除此笔记？关联的高亮也将取消。')) {
                    this.state.behaviorData.notes = (this.state.behaviorData.notes || [])
                        .filter(n => n.id !== note.id);
                    this.saveBehaviorData(true);
                    this._deleteNoteFromSupabase(note.id);
                    ann.remove();
                    if (mark.parentNode) mark.replaceWith(document.createTextNode(mark.textContent));
                    this.showToast('笔记已删除', 'info');
                }
            });
        });

        this._restorePlainHighlights(contentEl);
    },

    _findAndHighlightText(container, searchText, noteId) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (node.parentElement?.closest('mark, .note-annotation, script, style'))
                    return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        let fullText = '';
        const nodeMap = [];
        for (const node of textNodes) {
            const start = fullText.length;
            fullText += node.textContent;
            nodeMap.push({ node, start, end: fullText.length });
        }

        const searchKey = searchText.substring(0, Math.min(searchText.length, 80));
        let idx = fullText.indexOf(searchKey);
        if (idx === -1) {
            const shortKey = searchText.substring(0, 30);
            idx = fullText.indexOf(shortKey);
            if (idx === -1) return null;
            return this._wrapTextRange(nodeMap, idx, idx + shortKey.length, noteId);
        }
        return this._wrapTextRange(nodeMap, idx, idx + searchKey.length, noteId);
    },

    _wrapTextRange(nodeMap, matchStart, matchEnd, noteId) {
        let startNode = null, startOffset = 0;
        let endNode = null, endOffset = 0;

        for (const { node, start, end } of nodeMap) {
            if (startNode === null && matchStart >= start && matchStart < end) {
                startNode = node;
                startOffset = matchStart - start;
            }
            if (matchEnd > start && matchEnd <= end) {
                endNode = node;
                endOffset = matchEnd - start;
                break;
            }
        }

        if (!startNode || !endNode) return null;

        try {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            const mark = document.createElement('mark');
            mark.className = 'user-highlight has-note';
            mark.title = '点击查看笔记';
            mark.dataset.noteId = noteId;
            range.surroundContents(mark);
            return mark;
        } catch (e) {
            try {
                const range = document.createRange();
                range.setStart(startNode, startOffset);
                range.setEnd(endNode, endOffset);
                const span = document.createElement('span');
                span.className = 'user-highlight-mark has-note';
                span.dataset.noteId = noteId;
                span.title = '点击查看笔记';
                range.surroundContents(span);
                return span;
            } catch (e2) {
                return null;
            }
        }
    },

    _restorePlainHighlights(contentEl) {
        const highlights = this.state.behaviorData.highlights || [];
        const currentChapterId = this.state.currentChapter?.id;

        highlights.forEach((hl) => {
            if (!hl.text || hl.noteId) return;
            if (hl.chapter && hl.chapter !== currentChapterId) return;

            const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (node.parentElement?.closest('mark, .note-annotation, script, style'))
                        return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });

            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);

            let fullText = '';
            const nodeMap = [];
            for (const node of textNodes) {
                const start = fullText.length;
                fullText += node.textContent;
                nodeMap.push({ node, start, end: fullText.length });
            }

            const searchKey = hl.text.substring(0, 50);
            const idx = fullText.indexOf(searchKey);
            if (idx === -1) return;

            const matchEnd = idx + searchKey.length;
            let startNode = null, startOffset = 0;
            let endNode = null, endOffset = 0;

            for (const { node, start, end } of nodeMap) {
                if (startNode === null && idx >= start && idx < end) {
                    startNode = node;
                    startOffset = idx - start;
                }
                if (matchEnd > start && matchEnd <= end) {
                    endNode = node;
                    endOffset = matchEnd - start;
                    break;
                }
            }

            if (!startNode || !endNode) return;

            try {
                const range = document.createRange();
                range.setStart(startNode, startOffset);
                range.setEnd(endNode, endOffset);
                const mark = document.createElement('mark');
                mark.className = 'user-highlight';
                mark.title = '点击取消标记';
                range.surroundContents(mark);
            } catch (e) {
                try {
                    const range = document.createRange();
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);
                    const span = document.createElement('span');
                    span.className = 'user-highlight-mark';
                    range.surroundContents(span);
                } catch (e2) { /* skip */ }
            }
        });
    },

    openNotesModal() {
        const modal = document.getElementById('notes-modal');
        const notesList = document.getElementById('notes-list');
        if (!modal || !notesList) return;

        const notes = this.state.behaviorData.notes || [];
        if (notes.length === 0) {
            notesList.innerHTML = '<p style="font-size:0.875rem;color:var(--color-text-tertiary);text-align:center;">暂无笔记，选中文本后点击"📝 记笔记"并写入内容即可创建笔记。</p>';
        } else {
            notesList.innerHTML = notes.map((note, i) => `
                <div class="note-item">
                    <div class="note-context" style="font-size:0.8rem;color:var(--color-text-tertiary);margin-bottom:6px;font-style:italic;">原文："${this.escapeHtml((note.context || note.text || '').substring(0, 150))}"</div>
                    <div class="note-text" style="color:var(--color-text-primary);line-height:1.6;">${this.escapeHtml(note.content || note.text || '')}</div>
                    <div class="note-meta" style="font-size:0.75rem;color:var(--color-text-tertiary);margin-top:8px;display:flex;align-items:center;justify-content:space-between;">
                        <span>${note.chapterTitle || note.chapter || '未知章节'} · ${new Date(note.timestamp).toLocaleDateString('zh-CN')}</span>
                        <span class="note-delete" data-note-id="${note.id || i}" style="color:var(--color-accent);cursor:pointer;font-size:0.75rem;">删除</span>
                    </div>
                </div>
            `).join('');

            notesList.querySelectorAll('.note-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const noteId = e.target.dataset.noteId;
                    this.state.behaviorData.notes = (this.state.behaviorData.notes || [])
                        .filter((n, i) => (n.id || String(i)) !== noteId);
                    this.saveBehaviorData(true);
                    if (noteId && noteId.startsWith('note-')) {
                        this._deleteNoteFromSupabase(noteId);
                    }
                    this.openNotesModal();
                });
            });
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
