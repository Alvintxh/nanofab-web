const AIModule = {
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
        this._explanationConv = null; // Reset conversation for new selected text
        this.openAISidebar();
        this.switchAISidebarTab('explanation');

        const emptyState = document.querySelector('#ai-explanation-panel .ai-panel-empty');
        const resultState = document.querySelector('#ai-explanation-panel .ai-explanation-result');
        const selectedTextContent = document.querySelector('#ai-explanation-panel .selected-text-content');
        const explanationBody = document.querySelector('#ai-explanation-panel .ai-explanation-body');

        if (emptyState) emptyState.classList.add('hidden');
        if (resultState) resultState.classList.remove('hidden');
        if (selectedTextContent) selectedTextContent.textContent = text;

        const chapter = this.state.currentChapter;
        const chapterContext = chapter ? `
	当前章节：${chapter.title}
	章节描述：${chapter.description}
	` : '';

        if (explanationBody) {
            explanationBody.innerHTML = `
                <div class="explanation-question-area">
                    <input type="text" class="explanation-question-input" placeholder="提出具体问题（可选），例如：这个工艺的物理原理是什么？">
                    <button class="btn btn-sm btn-primary explanation-question-send">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        发送
                    </button>
                </div>
            `;

            const sendBtn = explanationBody.querySelector('.explanation-question-send');
            const input = explanationBody.querySelector('.explanation-question-input');

            const doSend = () => {
                const question = input.value.trim();
                explanationBody.innerHTML = `
                    <div class="ai-loading">
                        <div class="ai-spinner"></div>
                        <p>正在根据您的背景生成个性化解释...</p>
                    </div>
                `;
                this._renderExplanation(text, question, chapter, chapterContext);
            };

            sendBtn.addEventListener('click', doSend);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doSend();
            });
            setTimeout(() => input.focus(), 100);
        }
    },

    async _renderExplanation(selectedText, question, chapter, chapterContext) {
        const explanationBody = document.querySelector('#ai-explanation-panel .ai-explanation-body');
        if (!explanationBody) return;

        // Initialize conversation history on first call
        const isFirstQuestion = !this._explanationConv;
        if (isFirstQuestion) {
            this._explanationConv = { selectedText, chapter, chapterContext, qaList: [] };
        }

        // Build context with full conversation history
        let fullContext = chapterContext;
        const conv = this._explanationConv;
        let convPrompt = `用户选中了以下文本："${selectedText}"\n\n`;
        conv.qaList.forEach((qa, i) => {
            convPrompt += `---\n第${i + 1}轮：\n用户问：${qa.question}\nAI答：${qa.answer}\n`;
        });
        if (question) {
            convPrompt += `---\n用户的最新问题：${question}\n\n请结合选中的文本和之前的对话历史，回答用户的最新问题。`;
            fullContext = convPrompt + (chapterContext ? '\n\n' + chapterContext : '');
        } else if (conv.qaList.length > 0) {
            // Follow-up with empty question (shouldn't normally happen)
            fullContext = convPrompt + (chapterContext ? '\n\n' + chapterContext : '');
        }

        const explanation = await this.generateExplanation(selectedText, fullContext, question);
        if (!explanationBody) return;

        // Store in conversation history
        const displayQuestion = question || '解释选中文本';
        this._explanationConv.qaList.push({ question: displayQuestion, answer: explanation });

        if (isFirstQuestion) {
            // Initial render: show selected text hint + Q&A list + follow-up input
            explanationBody.innerHTML = `
                <div class="explanation-conversation">
                    ${this._buildExplanationQAList()}
                    <div class="explanation-followup">
                        <input type="text" class="explanation-question-input followup-input"
                            placeholder="继续追问，例如：能举个实际应用的例子吗？">
                        <button class="btn btn-sm btn-primary explanation-question-send followup-send">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                            追问
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Follow-up: refresh the Q&A list and reset follow-up input
            const conv = explanationBody.querySelector('.explanation-conversation');
            if (conv) {
                conv.innerHTML = `
                    ${this._buildExplanationQAList()}
                    <div class="explanation-followup">
                        <input type="text" class="explanation-question-input followup-input"
                            placeholder="继续追问，例如：能举个实际应用的例子吗？">
                        <button class="btn btn-sm btn-primary explanation-question-send followup-send">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                            追问
                        </button>
                    </div>
                `;
            }
            // Scroll to latest answer
            const lastQA = explanationBody.querySelector('.explanation-qa-item:last-child');
            if (lastQA) lastQA.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Bind follow-up input
        const followupInput = explanationBody.querySelector('.followup-input');
        const followupSend = explanationBody.querySelector('.followup-send');
        const bindFollowup = () => {
            const q = followupInput.value.trim();
            if (!q) return;
            followupInput.disabled = true;
            followupSend.disabled = true;
            followupSend.textContent = '...';
            // Show typing indicator
            const followup = explanationBody.querySelector('.explanation-followup');
            if (followup) followup.insertAdjacentHTML('beforebegin',
                '<div class="ai-loading" style="padding:12px 0"><div class="ai-spinner"></div><p>正在生成回答...</p></div>');
            this._renderExplanation(selectedText, q, chapter, chapterContext);
        };
        followupSend.addEventListener('click', bindFollowup);
        followupInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') bindFollowup();
        });
        setTimeout(() => followupInput.focus(), 100);

        // Bind save-all button — saves entire conversation as a single note
        const saveAllBtn = explanationBody.querySelector('.save-explanation-all');
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', () => {
                const conv = this._explanationConv;
                if (!conv || conv.qaList.length === 0) return;
                const selectedText = conv.selectedText;
                const markdown = conv.qaList.map((qa, i) =>
                    `## Q${i + 1}: ${qa.question}\n\n${qa.answer}`
                ).join('\n\n---\n\n');
                this._saveExplanationAsNote(selectedText, markdown, conv.chapter);
                saveAllBtn.textContent = '已保存 ✓';
                saveAllBtn.classList.add('saved');
                saveAllBtn.disabled = true;
                setTimeout(() => {
                    saveAllBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        保存全部对话为笔记
                    `;
                    saveAllBtn.classList.remove('saved');
                    saveAllBtn.disabled = false;
                }, 2000);
            });
        }
    },

    _buildExplanationQAList() {
        const qaList = this._explanationConv?.qaList || [];
        if (qaList.length === 0) return '';
        let html = qaList.map((qa, i) => {
            const formattedAnswer = this.formatAIResponse(qa.answer);
            return `
                <div class="explanation-qa-item">
                    <div class="explanation-qa-question">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        ${this.escapeHtml(qa.question)}
                    </div>
                    <div class="explanation-qa-answer">${formattedAnswer}</div>
                </div>
            `;
        }).join('');
        // Single save-all button below Q&A list
        html += `
            <div class="explanation-actions explanation-save-all">
                <button class="btn btn-sm btn-outline save-explanation-all" title="将所有问答保存为一条笔记">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    保存全部对话为笔记
                </button>
            </div>`;
        return html;
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
            parts.push('你会在每次对话中收到用户的个人学习数据（笔记、答题记录、学习进度、学习时长分布、行为画像、最近操作等）。');
            parts.push('请在每次回答中自然地引用这些数据，使回答真正个性化。例如：');
            parts.push('- 回答概念问题时，提及用户笔记中相关的记录或用户做错的题目');
            parts.push('- 用户问"怎么办"时，结合学习进度和薄弱环节给出具体建议');
            parts.push('- 用户问"下一步学什么"时，根据已完成的章节和弱项推荐下一步');
            parts.push('- 如果用户某一章节停留时间很长，主动解释该章节的难点');
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
                content: `以下是用户在本学习平台上的个人数据。请在所有回答中结合这些数据，使回答个性化、有针对性。例如：引用用户的笔记内容、提及用户的学习进度、针对错题给出建议、根据学习时长分布推荐学习策略。如果用户要求列出具体内容（如笔记、错题），请逐一列出不要省略。\n\n${dataContext}`
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
    }
};
