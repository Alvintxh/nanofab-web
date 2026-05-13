// Auth module — mixed into App via Object.assign(App, AuthModule) in app.js
const AuthModule = {

    initSupabase() {
        if (typeof supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
            this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized successfully');
        } else {
            console.warn('Supabase not initialized - missing library or config');
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
            if (hashParams.get('type') === 'signup' || hashParams.get('access_token')) {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.user) {
                    await this.loadUserFromSupabase(session.user);
                    this.showApp();
                    localStorage.removeItem('pending_name');
                    localStorage.removeItem('pending_email');
                    localStorage.removeItem('pending_user_id');
                    sessionStorage.removeItem('pending_password');
                    window.location.hash = '#home';
                    return true;
                }
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

        if (this._registering) return;
        this._registering = true;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        this._setButtonLoading(submitBtn, true);

        try {
            const formData = new FormData(e.target);
            const email = formData.get('email');
            const password = formData.get('password');
            const name = formData.get('name');

            if (!this.supabase) {
                this.showToast('系统未初始化，请刷新页面后重试', 'error');
                return;
            }

            const { data, error } = await this.supabase.auth.signUp({
                email, password,
                options: {
                    data: { name },
                    emailRedirectTo: window.location.origin + window.location.pathname
                }
            });

            if (error) {
                if (error.message.includes('already registered') || error.message.includes('already exists')) {
                    this.showToast('该邮箱已注册，请直接登录', 'info');
                    this.showAuthForm('login-form');
                    return;
                }
                if (error.message.includes('rate limit') || error.error_code === 'over_email_send_rate_limit') {
                    this.showToast('操作过于频繁，请等待约1分钟后再试', 'warning');
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
        } finally {
            this._setButtonLoading(submitBtn, false);
            this._registering = false;
        }
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
            this._setButtonLoading(submitBtn, false);
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
                // 从 behavior summary 回填 behaviorProfile（确保 AI 拿到真实行为画像）
                if (!this.state.user.behaviorProfile) {
                    this.state.user.behaviorProfile = {
                        weakTopics: [],
                        strongTopics: [],
                        preferredContentTypes: [],
                        avgSessionTime: 0,
                        quizAccuracy: 0,
                        lastUpdated: new Date().toISOString()
                    };
                }
                const bp = this.state.user.behaviorProfile;
                bp.weakTopics = behaviorSummary.weak_topics || [];
                bp.strongTopics = behaviorSummary.strong_topics || [];
                bp.preferredContentTypes = behaviorSummary.preferred_content_types || [];
                bp.quizAccuracy = behaviorSummary.quiz_total_count > 0
                    ? behaviorSummary.quiz_correct_count / behaviorSummary.quiz_total_count
                    : 0;
                bp.avgSessionTime = behaviorSummary.total_study_time || 0;
                bp.lastUpdated = behaviorSummary.updated_at || new Date().toISOString();
                localStorage.setItem('nanofab_user', JSON.stringify(this.state.user));

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

        const aiToggle = document.getElementById('ai-sidebar-toggle');
        if (aiToggle) aiToggle.classList.remove('hidden');

        this.updateUserGreeting();
        this.updateProgress();
    },

    showOnboarding() {
        const onboarding = document.getElementById('onboarding-screen');
        const app = document.getElementById('app');

        if (onboarding) onboarding.classList.add('active');
        if (app) app.style.display = 'none';

        const aiToggle = document.getElementById('ai-sidebar-toggle');
        if (aiToggle) aiToggle.classList.add('hidden');

        // Show welcome page on first visit, login directly on return visits
        const welcomeSeen = localStorage.getItem('nanofab_welcome_seen');
        const welcomeSection = document.getElementById('welcome-section');
        const authSection = document.getElementById('onboarding-auth');

        if (!welcomeSeen && welcomeSection && authSection) {
            welcomeSection.classList.remove('hidden');
            authSection.classList.add('hidden');
        } else {
            if (welcomeSection) welcomeSection.classList.add('hidden');
            if (authSection) authSection.classList.remove('hidden');
            this.showAuthForm('login-form');
        }
    },

    showAuthSection() {
        const welcomeSection = document.getElementById('welcome-section');
        const authSection = document.getElementById('onboarding-auth');
        if (welcomeSection) welcomeSection.classList.add('hidden');
        if (authSection) authSection.classList.remove('hidden');
        localStorage.setItem('nanofab_welcome_seen', '1');
        this.showAuthForm('login-form');
    },

    _featureDetails: {
        explanation: {
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c-1.3 0-2.5.4-3.5 1.1L4.2 6.8C3.4 7.3 3 8.1 3 9v6c0 .9.4 1.7 1.2 2.2l4.3 2.7c1 .6 2.2.6 3.5.6s2.5-.2 3.5-.6l4.3-2.7c.8-.5 1.2-1.3 1.2-2.2V9c0-.9-.4-1.7-1.2-2.2l-4.3-2.7C14.5 3.4 13.3 3 12 3z"/><circle cx="12" cy="12" r="3"/></svg>',
            iconBg: 'var(--color-primary-light)',
            iconColor: 'var(--color-primary)',
            title: 'AI 智能解释',
            subtitle: '选中文本，AI 根据你的知识水平提供个性化解释',
            body: '<h4>如何使用</h4><p>在章节阅读中<strong>选中任意文本</strong> → 点击浮出的"AI 解释"按钮 → 输入你的问题（可选）→ AI 根据你的知识水平个性化回答。</p><h4>特色</h4><ul><li>支持<strong>多轮追问</strong>，保持对话上下文不丢失</li><li>解释深度<strong>自动匹配用户水平</strong>：零基础用类比，高级深入工程细节</li><li>根据学习动机调整侧重点（考试、科研、职业、兴趣）</li></ul><h4>数据来源</h4><p>AI 参考你的学习水平、专业背景、先修知识、当前章节内容，确保解释贴合你的需求。</p>'
        },
        assistant: {
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="12" y1="7" x2="12" y2="13"/></svg>',
            iconBg: 'var(--color-accent-light)',
            iconColor: 'var(--color-accent)',
            title: 'AI 学习助手',
            subtitle: '侧边栏聊天机器人，结合学习数据提供精准回答',
            body: '<h4>如何使用</h4><p>点击右上角 AI 图标打开侧边栏 → 直接输入任何学习相关问题 → AI 结合你的学习数据个性化回答。</p><h4>特色</h4><ul><li>每次对话<strong>自动注入完整学习数据</strong>（笔记、错题、进度、时长）</li><li>回答针对<strong>个人薄弱环节</strong>给出具体建议</li><li>支持对笔记、错题等数据的<strong>查询和操作</strong></li><li>回复使用 Markdown 格式（标题、列表、粗体等）</li></ul><h4>数据来源</h4><p>笔记、答题记录、学习进度、学习时长分布、行为画像、最近操作记录。</p>'
        },
        path: {
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
            iconBg: 'var(--color-primary-light)',
            iconColor: 'var(--color-primary)',
            title: 'AI 学习路线',
            subtitle: '基于画像和进度自动生成个性化学习路径',
            body: '<h4>如何使用</h4><p>首页仪表盘自动展示推荐路线 → 点击刷新可重新生成。</p><h4>特色</h4><ul><li>基于<strong>已完成章节和薄弱环节</strong>推荐下一步学习方向</li><li>考虑<strong>学习节奏和感兴趣领域</strong>制定时间计划</li><li>兼顾<strong>擅长领域巩固和短板补齐</strong></li></ul><h4>数据来源</h4><p>学习进度、薄弱环节、擅长领域、学习节奏偏好、感兴趣领域。</p>'
        },
        notes: {
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
            iconBg: 'var(--color-accent-light)',
            iconColor: 'var(--color-accent)',
            title: 'AI 智能笔记',
            subtitle: 'AI 解释一键保存，原文自动高亮标注',
            body: '<h4>如何使用</h4><p><strong>AI 笔记</strong>：AI 解释结果 → 点击"保存全部对话为笔记" → 原文自动高亮 → 点击高亮查看笔记。</p><p><strong>手动笔记</strong>：选中文本 → 点击浮动工具栏的笔图标 → 输入笔记内容 → 保存。</p><h4>特色</h4><ul><li>一键保存<strong>完整对话上下文</strong>为单条笔记</li><li>原文<strong>高亮标注</strong>，点击即可查看内联注解</li><li>笔记自动同步到 Supabase 数据库</li></ul><h4>数据来源</h4><p>笔记保存在浏览器本地存储和 Supabase 数据库，登录后自动同步。</p>'
        },
        quiz: {
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>',
            iconBg: 'var(--color-primary-light)',
            iconColor: 'var(--color-primary)',
            title: '交互式测验',
            subtitle: '每章 10 题，即时反馈，错题自动收录',
            body: '<h4>如何使用</h4><p>每章底部"测验"标签 → 10 道题（单选/多选/判断）→ 提交后即时显示对错和正确答案。</p><h4>特色</h4><ul><li>三种题型：<strong>单选、多选、判断</strong></li><li>答错自动<strong>收录到错题本</strong>，可在首页复习</li><li>测验结果同步到 Supabase，AI 用于<strong>分析薄弱环节</strong></li><li>即时反馈，每道题显示正确答案</li></ul><h4>数据来源</h4><p>测验结果存储在浏览器本地和 Supabase quiz_answers 表。</p>'
        },
        tracking: {
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
            iconBg: 'var(--color-accent-light)',
            iconColor: 'var(--color-accent)',
            title: '学习数据追踪',
            subtitle: '全方位学习行为追踪，AI 据此定制策略',
            body: '<h4>如何使用</h4><p>自动后台追踪，无需手动操作。首页"学习统计"卡片查看数据。</p><h4>追踪内容</h4><ul><li><strong>学习时长</strong>：今日/本周/总计，每章停留时间</li><li><strong>测验表现</strong>：正确率、薄弱环节、擅长领域</li><li><strong>连续学习</strong>：连续学习天数统计</li><li><strong>周目标</strong>：进度环显示每周学习时间达成情况</li><li><strong>行为分析</strong>：互动类型、频率、偏好内容类型</li></ul><h4>数据用途</h4><p>这些数据反馈给 AI 系统，用于个性化推荐、解释深度调整和学习策略建议。</p>'
        }
    },

    openFeatureDetail(featureId) {
        const detail = this._featureDetails[featureId];
        if (!detail) return;

        const modal = document.getElementById('feature-modal');
        if (!modal) return;

        modal.querySelector('.feature-modal-icon').innerHTML = detail.icon;
        modal.querySelector('.feature-modal-icon').style.background = detail.iconBg;
        modal.querySelector('.feature-modal-icon').style.color = detail.iconColor;
        modal.querySelector('.feature-modal-title').textContent = detail.title;
        modal.querySelector('.feature-modal-subtitle').textContent = detail.subtitle;
        modal.querySelector('.feature-modal-body').innerHTML = detail.body;
        modal.classList.remove('hidden');
    },

    closeFeatureDetail() {
        const modal = document.getElementById('feature-modal');
        if (modal) modal.classList.add('hidden');
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

    openNotesModal() {
        const modal = document.getElementById('notes-modal');
        const notesList = document.getElementById('notes-list');
        if (!modal || !notesList) return;

        const notes = this.state.behaviorData.notes || [];
        if (notes.length === 0) {
            notesList.innerHTML = '<p style="font-size:0.875rem;color:var(--color-text-tertiary);text-align:center;">暂无笔记，选中文本后点击"📝 记笔记"并写入内容即可创建笔记。</p>';
        } else {
            notesList.innerHTML = notes.map((note, i) => {
                const isAiNote = note.content && (note.content.startsWith('#') || note.content.startsWith('**') || note.content.includes('\n'));
                const renderedContent = isAiNote ? this.formatAIResponse(note.content) : `<p>${this.escapeHtml(note.content || note.text || '')}</p>`;
                const label = isAiNote ? '🤖 AI 笔记' : '📝 笔记';
                return `
                <div class="note-item">
                    <div class="note-context" style="font-size:0.8rem;color:var(--color-text-tertiary);margin-bottom:6px;font-style:italic;">
                        <span style="font-weight:600;margin-right:4px;">${label}</span>
                        原文："${this.escapeHtml((note.context || note.text || '').substring(0, 150))}"
                    </div>
                    <div class="note-text" style="color:var(--color-text-primary);line-height:1.6;">${renderedContent}</div>
                    <div class="note-meta" style="font-size:0.75rem;color:var(--color-text-tertiary);margin-top:8px;display:flex;align-items:center;justify-content:space-between;">
                        <span>${note.chapterTitle || note.chapter || '未知章节'} · ${new Date(note.timestamp).toLocaleDateString('zh-CN')}</span>
                        <span class="note-delete" data-note-id="${note.id || i}" style="color:var(--color-accent);cursor:pointer;font-size:0.75rem;">删除</span>
                    </div>
                </div>
            `}).join('');

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
