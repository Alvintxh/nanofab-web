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
