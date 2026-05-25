
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


    bindEvents() {
        window.addEventListener('hashchange', () => this.handleRoute());

        // Welcome page CTA
        const welcomeCta = document.getElementById('welcome-cta');
        if (welcomeCta) {
            welcomeCta.addEventListener('click', () => this.showAuthSection());
        }
        const welcomeLoginLink = document.getElementById('welcome-login-link');
        if (welcomeLoginLink) {
            welcomeLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAuthSection();
            });
        }

        // Back to welcome from auth page
        const authBackWelcome = document.getElementById('auth-back-welcome');
        if (authBackWelcome) {
            authBackWelcome.addEventListener('click', (e) => {
                e.preventDefault();
                this.showWelcomePage();
            });
        }

        // Back to welcome from app header
        const headerBackWelcome = document.getElementById('header-back-welcome');
        if (headerBackWelcome) {
            headerBackWelcome.addEventListener('click', (e) => {
                e.preventDefault();
                this.showWelcomePage();
            });
        }

        // Feature card click → scroll to detail section
        document.querySelectorAll('.welcome-feature-card[data-feature]').forEach(card => {
            card.addEventListener('click', () => {
                const detailId = 'detail-' + card.dataset.feature;
                const detailEl = document.getElementById(detailId);
                if (detailEl) {
                    detailEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });

        // Welcome 顶部锚点导航：平滑滚动 + 高亮当前区
        document.querySelectorAll('.welcome-nav [data-scroll]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.getElementById(el.dataset.scroll);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        // Scroll-reveal observer
        this._initScrollReveal();
        this._initWelcomeNavSpy();

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

        const tocToggle = document.getElementById('toc-toggle');
        if (tocToggle) {
            tocToggle.addEventListener('click', () => {
                if (window.innerWidth > 1024) {
                    const app = document.getElementById('app');
                    const collapsed = app?.classList.toggle('toc-collapsed');
                    document.getElementById('ai-sidebar')?.classList.toggle('ai-wide', !!collapsed);
                } else {
                    this.toggleSidebar();
                }
            });
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
                        // Sanitize HTML tags inside math delimiters caused by Markdown conversion
                        contentEl.innerHTML = this._sanitizeMathHTML(contentEl.innerHTML);
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
                <span class="nav-part-index">${partIndex + 1}</span>
                <span class="nav-part-title">${part.title}</span>
                <span class="nav-part-count">${part.chapters.length}</span>
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

    renderQuickNav() {
        const quickNav = document.getElementById('quick-nav');
        if (!quickNav) return;

        const partColors = ['var(--color-primary)', 'var(--color-accent)', '#0d9488', '#7c3aed'];

        quickNav.innerHTML = '';

        this.state.chapters.forEach((part, partIndex) => {
            const label = document.createElement('div');
            label.className = 'quick-part-label';
            label.textContent = part.title;
            label.style.color = partColors[partIndex];
            quickNav.appendChild(label);

            part.chapters.forEach((chapter) => {
                const link = document.createElement('a');
                link.className = 'quick-chapter-link';
                link.href = `#chapter/${chapter.id}`;
                link.style.setProperty('--part-color', partColors[partIndex]);
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
                // 自动展开当前章节所在的部分
                const part = el.closest('.nav-part');
                if (part && !part.classList.contains('expanded')) {
                    part.classList.add('expanded');
                }
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


    // ===== 思维导图 =====
    renderMindMap() {
        const container = document.getElementById('quick-mindmap');
        if (!container || this.state.chapters.length === 0) return;

        const colors = ['#004EA1', '#9D0A12', '#0d9488', '#7c3aed'];
        const colorsLight = ['#e8f1fb', '#fdf0f1', '#e6faf7', '#f2eeff'];
        const gradPairs = [
            ['#004EA1', '#0070d6'],
            ['#9D0A12', '#c41020'],
            ['#0d9488', '#14b8a6'],
            ['#7c3aed', '#9b6dff']
        ];

        const w = 960, h = 520;
        const numParts = this.state.chapters.length;
        const totalWidth = 780;
        const partSpacing = totalWidth / (numParts + 1);
        const marginLeft = (w - totalWidth) / 2 + partSpacing;

        let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

        // ====== Defs ======
        svg += `<defs>`;

        gradPairs.forEach(([c1, c2], i) => {
            svg += `<linearGradient id="mm-grad-${i}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${c1}" stop-opacity="0.14"/>
                <stop offset="100%" stop-color="${c2}" stop-opacity="0.06"/>
            </linearGradient>`;
            svg += `<linearGradient id="mm-grad-bar-${i}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="${c1}"/>
                <stop offset="100%" stop-color="${c2}"/>
            </linearGradient>`;
        });

        svg += `<filter id="mm-glow-root">
            <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#004EA1" flood-opacity="0.25"/>
        </filter>
        <filter id="mm-shadow-card">
            <feDropShadow dx="0" dy="1.5" stdDeviation="3" flood-opacity="0.06"/>
        </filter>
        <filter id="mm-shadow-part">
            <feDropShadow dx="0" dy="2" stdDeviation="5" flood-opacity="0.07"/>
        </filter>

        <pattern id="mm-grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="16" cy="16" r="0.5" fill="#cbd5e1" opacity="0.35"/>
        </pattern>`;

        svg += `</defs>`;

        // ====== Background ======
        svg += `<rect width="${w}" height="${h}" rx="16" fill="#fafbfc"/>`;
        svg += `<rect width="${w}" height="${h}" rx="16" fill="url(#mm-grid)"/>`;

        // ====== Title ======
        svg += `<text x="${w/2}" y="26" text-anchor="middle" fill="#1e293b" font-size="14.5" font-weight="700" font-family="'Noto Serif SC', 'STSong', serif" letter-spacing="1.5">纳米制造技术 · 课程知识结构</text>`;
        svg += `<line x1="${w/2 - 65}" y1="36" x2="${w/2 + 65}" y2="36" stroke="#e2e8f0" stroke-width="1"/>`;

        // ====== Root node ======
        const rootX = w / 2, rootY = 54;
        const rootW = 170, rootH = 44;
        svg += `<ellipse cx="${rootX}" cy="${rootY + rootH/2 + 3}" rx="${rootW/2 - 6}" ry="6" fill="#004EA1" opacity="0.10"/>`;
        svg += `<rect x="${rootX - rootW/2}" y="${rootY - rootH/2}" width="${rootW}" height="${rootH}" rx="22" fill="url(#mm-grad-bar-0)" filter="url(#mm-glow-root)"/>`;
        svg += `<rect x="${rootX - rootW/2 + 4}" y="${rootY - rootH/2 + 3}" width="${rootW - 8}" height="${rootH/2 - 4}" rx="19" fill="white" opacity="0.10"/>`;
        svg += `<circle cx="${rootX - rootW/2 + 30}" cy="${rootY}" r="13" fill="white" opacity="0.15"/>`;
        svg += `<text x="${rootX - rootW/2 + 30}" y="${rootY + 5}" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="'SF Mono', 'Menlo', monospace">N</text>`;
        svg += `<text x="${rootX - rootW/2 + 52}" y="${rootY + 5}" fill="white" font-size="14" font-weight="700" font-family="'Noto Sans SC', sans-serif" letter-spacing="3">纳米制造技术</text>`;

        // ====== Branch structure ======
        const trunkY1 = rootY + rootH/2;
        const branchMidY = trunkY1 + 54;
        const partY = branchMidY + 20;

        const partCenters = [];
        for (let i = 0; i < numParts; i++) {
            partCenters.push(marginLeft + i * partSpacing);
        }

        // Main vertical trunk
        svg += `<line x1="${rootX}" y1="${trunkY1}" x2="${rootX}" y2="${branchMidY - 8}" stroke="#94a3b8" stroke-width="2" opacity="0.30"/>`;
        // Horizontal distribution bar
        svg += `<line x1="${partCenters[0]}" y1="${branchMidY}" x2="${partCenters[numParts - 1]}" y2="${branchMidY}" stroke="#94a3b8" stroke-width="1.5" opacity="0.18"/>`;

        // Curved branches from root to each part
        const cpOffset = 0.3;
        partCenters.forEach((pcx, i) => {
            const dx = pcx - rootX;
            const cp1x = rootX + dx * cpOffset;
            const cp2x = rootX + dx * (1 - cpOffset);
            const cy = branchMidY;
            svg += `<path d="M${rootX},${trunkY1} C${cp1x},${cy} ${cp2x},${cy} ${pcx},${partY - 24}"
                stroke="${colors[i]}" stroke-width="1.6" fill="none" opacity="0.22" stroke-dasharray="5,4"/>`;
            svg += `<line x1="${pcx}" y1="${partY - 24}" x2="${pcx}" y2="${partY - 10}" stroke="${colors[i]}" stroke-width="1.6" opacity="0.40"/>`;
        });

        // ====== Part cards ======
        const partW = 196, partH = 46;

        this.state.chapters.forEach((part, partIndex) => {
            const pcx = partCenters[partIndex];
            const color = colors[partIndex];
            const lightColor = colorsLight[partIndex];
            const px = pcx - partW/2, py = partY - partH/2;

            // Card background
            svg += `<rect x="${px}" y="${py}" width="${partW}" height="${partH}" rx="12" fill="white" stroke="${color}" stroke-width="1.4" filter="url(#mm-shadow-part)" opacity="0.97"/>`;
            // Gradient accent bar at top
            svg += `<rect x="${px + 10}" y="${py + 1}" width="${partW - 20}" height="3.5" rx="1.75" fill="url(#mm-grad-bar-${partIndex})" opacity="0.65"/>`;
            // Number badge circle
            svg += `<circle cx="${px + 26}" cy="${py + partH/2}" r="11.5" fill="${lightColor}" stroke="${color}" stroke-width="1.2" opacity="0.9"/>`;
            svg += `<text x="${px + 26}" y="${py + partH/2 + 4.5}" text-anchor="middle" fill="${color}" font-size="11" font-weight="700" font-family="'SF Mono', 'Menlo', monospace">${partIndex + 1}</text>`;
            // Title
            svg += `<text x="${px + 46}" y="${py + partH/2 + 4.5}" fill="${color}" font-size="13.5" font-weight="700" font-family="'Noto Sans SC', sans-serif">${part.title}</text>`;
            // Chapter count pill
            const countW = part.chapters.length * 7 + 16;
            svg += `<rect x="${px + partW - countW - 12}" y="${py + partH/2 - 7.5}" width="${countW}" height="15" rx="7.5" fill="${color}" opacity="0.10"/>`;
            svg += `<text x="${px + partW - countW/2 - 12}" y="${py + partH/2 + 3.5}" text-anchor="middle" fill="${color}" font-size="9.5" font-weight="600" font-family="'SF Mono', monospace" opacity="0.8">${part.chapters.length}章</text>`;

            // ====== Chapter nodes ======
            const chStartY = partY + partH/2 + 22;
            const chW = 188, chH = 38;
            const chGap = 48;

            part.chapters.forEach((ch, chIndex) => {
                const chY = chStartY + chIndex * chGap + chH/2;
                const crx = pcx - chW/2, cry = chY - chH/2;

                // Vertical stem
                const stemTop = chIndex === 0 ? py + partH/2 : chStartY + (chIndex - 1) * chGap + chH/2;
                svg += `<line x1="${pcx}" y1="${stemTop}" x2="${pcx}" y2="${chY - chH/2}" stroke="${color}" stroke-width="1" opacity="0.16"/>`;
                // Small dot at connection point
                svg += `<circle cx="${pcx}" cy="${chY - chH/2}" r="2" fill="${color}" opacity="0.25"/>`;

                // Chapter card
                svg += `<rect x="${crx}" y="${cry}" width="${chW}" height="${chH}" rx="9" fill="white" stroke="${color}" stroke-width="1" opacity="0.88" filter="url(#mm-shadow-card)"/>`;
                // Left accent bar
                svg += `<rect x="${crx + 1}" y="${cry + 7}" width="3.5" height="${chH - 14}" rx="1.75" fill="${color}" opacity="0.22"/>`;
                // Chapter ID
                svg += `<text x="${crx + 16}" y="${chY + 4.5}" fill="${color}" font-size="10.5" font-weight="700" font-family="'SF Mono', 'Menlo', monospace" opacity="0.85">${ch.id}</text>`;
                // Chapter title
                const titleSize = ch.title.length > 9 ? 10 : 11;
                svg += `<text x="${crx + 58}" y="${chY + 4.5}" fill="#334155" font-size="${titleSize}" font-weight="500" font-family="'Noto Sans SC', sans-serif">${ch.title}</text>`;
                // Completion dot
                const dotX = crx + chW - 20;
                svg += `<circle cx="${dotX}" cy="${chY}" r="5" fill="${color}" opacity="0.10"/>`;
                svg += `<circle cx="${dotX}" cy="${chY}" r="2.5" fill="${color}" opacity="0.45"/>`;
            });
        });

        // ====== Bottom decoration ======
        svg += `<line x1="${w * 0.25}" y1="${h - 12}" x2="${w * 0.75}" y2="${h - 12}" stroke="#e2e8f0" stroke-width="0.5"/>`;

        svg += '</svg>';
        container.innerHTML = svg;
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
            setTimeout(() => ann.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
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

            const noteContent = note.content || '';
            const isAiNote = /(\*\*|##|###|`|^\- |^\d+\. )/m.test(noteContent);
            const renderedContent = isAiNote ? this.formatAIResponse(noteContent) : `<p>${this.escapeHtml(noteContent)}</p>`;
            const label = isAiNote ? '🤖 AI 笔记' : '📝 笔记';
            const contextHtml = isAiNote ? '' : `<div class="note-annotation-context">原文："${this.escapeHtml(searchText.substring(0, 100))}"</div>`;

            const parentP = mark.closest('p, li, h2, h3, h4, blockquote, td') || mark.parentElement;
            const ann = document.createElement('div');
            ann.className = 'note-annotation';
            ann.dataset.noteId = note.id;
            ann.innerHTML = `
                <div class="note-annotation-header">
                    <span class="note-annotation-label">${label}</span>
                    <span class="note-annotation-delete" data-note-id="${note.id}">✕ 删除</span>
                </div>
                ${contextHtml}
                <div class="note-annotation-content">${renderedContent}</div>
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

    _sanitizeMathHTML(html) {
        // Strip HTML tags inside $$...$$ display math blocks
        html = html.replace(/\$\$([^$]+?)\$\$/g, (match, inner) => {
            return '$$' + inner.replace(/<[^>]+>/g, '') + '$$';
        });
        // Strip/replace HTML tags inside $...$ inline math blocks
        // Avoid matching $$ by using a two-step approach
        html = html.replace(/(^|[^$])\$([^$]+?)\$([^$]|$)/g, (match, before, inner, after) => {
            const cleaned = inner
                .replace(/<em>/g, '_')
                .replace(/<\/em>/g, '_')
                .replace(/<sub>/g, '_')
                .replace(/<\/sub>/g, '')
                .replace(/<sup>/g, '^')
                .replace(/<\/sup>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/<[^>]+>/g, '');
            return before + '$' + cleaned + '$' + after;
        });
        return html;
    },

    _initScrollReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('[data-reveal]').forEach(el => {
            observer.observe(el);
        });
    },

    _initWelcomeNavSpy() {
        const links = document.querySelectorAll('.welcome-nav-link[data-scroll]');
        if (!links.length || this._navSpyInited) return;
        this._navSpyInited = true;

        const linkFor = (id) => document.querySelector(`.welcome-nav-link[data-scroll="${id}"]`);
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    links.forEach(l => l.classList.remove('active'));
                    const active = linkFor(entry.target.id);
                    if (active) active.classList.add('active');
                }
            });
        }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

        ['w-features', 'w-compare', 'w-details', 'w-cta'].forEach(id => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
    },

};


// Auth methods mixed in from js/auth.js
Object.assign(App, BehaviorModule);
Object.assign(App, AIModule);
Object.assign(App, AuthModule);

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
