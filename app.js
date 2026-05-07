
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
        this.loadUser();
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

    loadBehaviorData() {
        const stored = localStorage.getItem('nanofab_behavior');
        if (stored) {
            this.state.behaviorData = JSON.parse(stored);
        }
    },

    async saveBehaviorData() {
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
                this.saveBehaviorData();
                this.updateBehaviorProfile();
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

        const resetProfile = document.getElementById('reset-profile');
        if (resetProfile) {
            resetProfile.addEventListener('click', () => this.resetProfile());
        }

        const markComplete = document.getElementById('mark-complete');
        if (markComplete) {
            markComplete.addEventListener('click', () => this.markChapterComplete());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeProfileModal();
                this.closeSidebar();
            }
        });
    },

    switchAuthTab(tab) {
        console.log('Switching auth tab to:', tab);
        
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        const targetTab = document.querySelector(`.auth-tab[data-tab="${tab}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
            console.log('Activated tab:', tab);
        } else {
            console.error('Tab not found:', tab);
        }
        
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        
        if (tab === 'login' && loginForm) {
            loginForm.classList.remove('hidden');
            console.log('Shown login form');
        } else if (tab === 'register' && registerForm) {
            registerForm.classList.remove('hidden');
            console.log('Shown register form');
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        if (this.supabase) {
            try {
                const { data, error } = await this.supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                await this.loadUserFromSupabase(data.user);
                this.showApp();
            } catch (error) {
                this.showToast('登录失败：' + error.message, 'error');
            }
        } else {
                this.showToast('Supabase 未初始化', 'error');
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const name = formData.get('name');

        if (this.supabase) {
            try {
                const { data, error } = await this.supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { name },
                        emailRedirectTo: null
                    }
                });

                if (error) {
                    if (error.message.includes('rate limit') || error.message.includes('security') || error.error_code === 'over_email_send_rate_limit') {
                        console.warn('Rate limit hit:', error);
                        if (error.error_code === 'over_email_send_rate_limit') {
                            this.showToast('注册成功！但验证邮件发送失败（邮件发送频率限制）。请直接登录，或稍后重试。', 'warning');
                            this.switchAuthTab('login');
                            return;
                        }
                        this.showToast('发送过于频繁，请稍后再试（约1分钟后）', 'warning');
                        return;
                    }
                    if (error.message.includes('already registered') || error.message.includes('already exists')) {
                        this.showToast('该邮箱已注册，请直接登录', 'info');
                        this.switchAuthTab('login');
                        return;
                    }
                    throw error;
                }

                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    this.showToast('该邮箱已注册，请直接登录', 'info');
                    this.switchAuthTab('login');
                    return;
                }

                localStorage.setItem('pending_name', name);
                localStorage.setItem('pending_email', email);
                sessionStorage.setItem('pending_password', password);

                if (data.user) {
                    localStorage.setItem('pending_user_id', data.user.id);
                    console.log('Registration successful, user ID:', data.user.id);
                    console.log('Email confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No');
                    console.log('Session present:', data.session ? 'Yes' : 'No');
                    
                    if (!data.session) {
                        console.warn('No session after signup - email confirmation may be enabled');
                        console.warn('Profile will be saved with pending_user_id, but user needs to verify email before login');
                    }
                }

                document.getElementById('register-form').classList.add('hidden');
                document.querySelector('.auth-tabs').classList.add('hidden');
                document.getElementById('profile-form').classList.remove('hidden');

                document.getElementById('user-name').value = name;

                this.showToast('注册成功！请完善您的个人资料。', 'success');
            } catch (error) {
                console.error('Registration error:', error);
                this.showToast('注册失败：' + error.message, 'error');
            }
        } else {
                this.showToast('Supabase 未初始化', 'error');
        }
    },

    async handleVerify(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const code = formData.get('code');
        const email = localStorage.getItem('pending_email');
        const password = sessionStorage.getItem('pending_password');
        const name = localStorage.getItem('pending_name');

        if (this.supabase) {
            try {
                const { data, error } = await this.supabase.auth.verifyOtp({
                    email,
                    token: code,
                    type: 'signup'
                });

                if (error) throw error;

                localStorage.removeItem('pending_email');
                sessionStorage.removeItem('pending_password');
                
                document.getElementById('verify-form').classList.add('hidden');
                document.querySelector('.auth-tabs').classList.add('hidden');
                document.getElementById('profile-form').classList.remove('hidden');
                
                document.getElementById('user-name').value = name;
                
                this.showToast('验证成功！请完善您的个人资料。', 'success');
            } catch (error) {
                this.showToast('验证失败：' + error.message, 'error');
            }
        } else {
                this.showToast('Supabase 未初始化', 'error');
        }
    },

    async resendVerificationCode() {
        const email = localStorage.getItem('pending_email');
        
        if (!email || !this.supabase) {
            this.showToast('无法重新发送验证码', 'error');
            return;
        }

        try {
            const { error } = await this.supabase.auth.resend({
                type: 'signup',
                email: email
            });

            if (error) {
                if (error.message.includes('rate limit') || error.message.includes('security')) {
                    this.showToast('发送过于频繁，请稍后再试（约1分钟后）', 'warning');
                    return;
                }
                throw error;
            }

            this.showToast('验证码已重新发送！请检查您的邮箱（包括垃圾邮件文件夹）。', 'success');
        } catch (error) {
            console.error('Resend error:', error);
            this.showToast('发送失败：' + error.message, 'error');
        }
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
                .single();

            if (behaviorSummary) {
                this.state.behaviorData = {
                    pageViews: [],
                    scrollDepth: {},
                    timeSpent: {},
                    sectionTime: {},
                    interactions: [],
                    quizResults: [],
                    aiQueries: []
                };
                localStorage.setItem('nanofab_behavior', JSON.stringify(this.state.behaviorData));
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

        this.switchAuthTab('login');
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
        this.saveBehaviorData();

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
                })
                .catch(error => {
                    console.error('Failed to load chapter content:', error);
                    contentEl.innerHTML = '<div class="content-error">内容加载失败，请稍后重试</div>';
                });
        }

        this.updateChapterNav(chapterId);
        this.updateActiveNavItem(chapterId);
        this.showView('view-chapter');
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
            parts.push(`用户学习水平：${user.level || '初学者'}`);
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
                    none: '无特定基础'
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
            }
        }
        
        if (context === 'explanation') {
            parts.push('请根据用户的完整画像提供个性化解释。');
            parts.push('- 初学者：多用类比，避免复杂公式，强调直观理解');
            parts.push('- 中级：引入技术参数，解释物理机制，联系实际工艺');
            parts.push('- 高级：深入工程细节，讨论优化策略，引用最新进展');
            parts.push('- 根据学习动机调整侧重点（课程→考试要点，科研→前沿进展，职业→实操技能，兴趣→背景故事）');
            parts.push('- 根据先修知识决定数学深度');
            parts.push('- 根据感兴趣领域举例时优先使用相关应用');
            parts.push('- 根据学习节奏调整内容密度（集中→精简核心，轻松→详细展开）');
            parts.push('- 结合用户当前正在阅读的章节上下文进行解释，不要孤立解释概念');
            parts.push('- 如果用户在某个章节停留时间较长或多次提问，说明该部分较难，请更详细地解释');
            parts.push('- 如果用户有进行中的项目，尝试将解释与其实际项目联系起来');
            parts.push('- 如果用户有未来计划，可以指出该概念如何支持其未来项目');
        } else if (context === 'chat') {
            parts.push('请作为个性化学习助手，根据用户画像回答问题。');
            parts.push('- 如果用户问基础概念，根据水平调整深度');
            parts.push('- 如果用户问应用场景，优先提及感兴趣的领域');
            parts.push('- 如果用户表现出困惑，建议适合的学习方式');
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
                if (r.chapterId) weakTopics.add(r.chapterId);
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

    async generateExplanation(text, chapterContext = '') {
        const user = this.state.user;
        const level = user?.level || 'beginner';
        const background = user?.background || 'student';
        const provider = localStorage.getItem('ai_provider') || 'zhipu';

        const userContent = chapterContext 
            ? `请解释以下纳米制造技术概念："${text}"\n\n${chapterContext}`
            : `请解释以下纳米制造技术概念："${text}"`;

        if (provider === 'zhipu') {
            const zhipuKey = '2adcbf8469f84447b2c93b520938ea41.y9SmeVdvWZdekX94';
            try {
                const systemPrompt = this.buildSystemPrompt(user, 'explanation');
                const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${zhipuKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'glm-4-flash',
                        messages: [
                            {
                                role: 'system',
                                content: systemPrompt
                            },
                            {
                                role: 'user',
                                content: userContent
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 1500
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.choices[0].message.content;
                }
            } catch (error) {
                console.error('Zhipu API error:', error);
            }
        } else if (provider === 'gemini') {
            const geminiKey = localStorage.getItem('gemini_api_key');
            if (geminiKey) {
                try {
                    const systemPrompt = this.buildSystemPrompt(user, 'explanation');
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    role: 'user',
                                    parts: [
                                        { text: systemPrompt + '\n\n请解释以下纳米制造技术概念："' + text + '"' }
                                    ]
                                }
                            ],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 1500
                            }
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return data.candidates[0].content.parts[0].text;
                    }
                } catch (error) {
                    console.error('Gemini API error:', error);
                }
            }
        } else {
            const apiKey = localStorage.getItem('deepseek_api_key');
            if (apiKey) {
                try {
                    const systemPrompt = this.buildSystemPrompt(user, 'explanation');
                    
                    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'deepseek-chat',
                            messages: [
                                {
                                    role: 'system',
                                    content: systemPrompt
                                },
                                {
                                    role: 'user',
                                    content: `请解释以下纳米制造技术概念："${text}"`
                                }
                            ],
                            temperature: 0.7,
                            max_tokens: 1500
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return data.choices[0].message.content;
                    }
                } catch (error) {
                    console.error('DeepSeek API error:', error);
                }
            }
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

                chaptersContainer.appendChild(chapterLink);
            });

            partEl.appendChild(header);
            partEl.appendChild(chaptersContainer);
            nav.appendChild(partEl);
        });
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
                    this.saveBehaviorData();
                    this.updateBehaviorProfile();

                    this.checkQuizCompletion();
                });
            });
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

        messageDiv.innerHTML = `
            <div class="ai-message-avatar">${avatarSvg}</div>
            <div class="ai-message-content"><p>${this.escapeHtml(text)}</p></div>
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

        if (provider === 'zhipu') {
            const zhipuKey = '2adcbf8469f84447b2c93b520938ea41.y9SmeVdvWZdekX94';
            try {
                const systemPrompt = this.buildSystemPrompt(user, 'chat');
                const messages = [
                    {
                        role: 'system',
                        content: systemPrompt
                    }
                ];

                if (chapter) {
                    messages.push({
                        role: 'system',
                        content: `用户当前正在学习章节：${chapter.title}。章节描述：${chapter.description}`
                    });
                }

                messages.push({
                    role: 'user',
                    content: userMessage
                });

                const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${zhipuKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'glm-4-flash',
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: 2000
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.choices[0].message.content;
                }
            } catch (error) {
                console.error('Zhipu API error:', error);
            }
        } else if (provider === 'gemini') {
            const geminiKey = localStorage.getItem('gemini_api_key');
            if (geminiKey) {
                try {
                    const systemPrompt = this.buildSystemPrompt(user, 'chat');
                    let promptText = systemPrompt;
                    
                    if (chapter) {
                        promptText += `\n用户当前正在学习章节：${chapter.title}。章节描述：${chapter.description}`;
                    }
                    
                    promptText += `\n\n用户问题：${userMessage}`;

                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    role: 'user',
                                    parts: [
                                        { text: promptText }
                                    ]
                                }
                            ],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 2000
                            }
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return data.candidates[0].content.parts[0].text;
                    }
                } catch (error) {
                    console.error('Gemini API error:', error);
                }
            }
        } else {
            const apiKey = localStorage.getItem('deepseek_api_key');
            if (apiKey) {
                try {
                    const systemPrompt = this.buildSystemPrompt(user, 'chat');
                    const messages = [
                        {
                            role: 'system',
                            content: systemPrompt
                        }
                    ];

                    if (chapter) {
                        messages.push({
                            role: 'system',
                            content: `用户当前正在学习章节：${chapter.title}。章节描述：${chapter.description}`
                        });
                    }

                    messages.push({
                        role: 'user',
                        content: userMessage
                    });

                    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'deepseek-chat',
                            messages: messages,
                            temperature: 0.7,
                            max_tokens: 2000
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return data.choices[0].message.content;
                    }
                } catch (error) {
                    console.error('DeepSeek API error:', error);
                }
            }
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
                const id = 'mermaid-' + Date.now() + '-' + index;
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
            .replace(/`(.+?)`/g, '<code>$1</code>');

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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
