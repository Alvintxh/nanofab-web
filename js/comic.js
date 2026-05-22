// ===== 章节漫画生成模块 (CogView-4) =====
// 流程: 章节正文 → LLM 生成分镜脚本 → 逐格文生图 → HTML 叠加中文气泡

const ComicModule = {
    // 固定画风前缀，保证每格风格 / 角色一致（对白不画进图，后期 HTML 叠加）
    _COMIC_STYLE: 'flat modern infographic comic illustration, clean vector style, ' +
        'soft blue (#004EA1) and teal palette, a friendly female scientist guide with ' +
        'short dark hair wearing a white lab coat as the recurring main character, ' +
        'consistent character design across panels, simple uncluttered background, ' +
        'NO text, NO letters, NO speech bubbles, NO words in the image',

    _COMIC_PANELS: 6,

    async generateChapterComic() {
        const chapter = this.state.currentChapter;
        if (!chapter) {
            this.showToast('请先打开一个章节', 'warning');
            return;
        }

        const cacheKey = `nanofab_comic_${chapter.id}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const panels = JSON.parse(cached);
                this._renderComic(chapter, panels);
                return;
            } catch (e) { /* 缓存损坏则重新生成 */ }
        }

        this._openComicModal();
        this._setComicStatus('正在分析章节内容，生成分镜脚本…');

        try {
            // 1. 取章节正文（纯文本，截断以控制 token）
            const contentEl = document.querySelector('.chapter-content');
            const rawText = (contentEl?.innerText || chapter.description || '').slice(0, 4000);

            // 2. LLM 生成分镜脚本
            const panels = await this._buildComicScript(chapter.title, rawText);
            if (!panels?.length) throw new Error('分镜脚本生成失败');

            // 3. 逐格生成图像（串行，避免并发限流）
            for (let i = 0; i < panels.length; i++) {
                this._setComicStatus(`正在绘制第 ${i + 1} / ${panels.length} 格…`);
                try {
                    panels[i].image = await this._generateComicImage(panels[i].scene);
                } catch (e) {
                    console.warn('Panel image failed:', e.message);
                    panels[i].image = null; // 出图失败用占位
                }
            }

            localStorage.setItem(cacheKey, JSON.stringify(panels));
            this._renderComic(chapter, panels);
        } catch (err) {
            console.error('Comic generation failed:', err);
            this._setComicStatus(`生成失败：${err.message}`, true);
        }
    },

    async _buildComicScript(title, text) {
        const provider = localStorage.getItem('ai_provider') || 'zhipu';
        const model = provider === 'zhipu' ? 'glm-4-flash'
            : provider === 'gemini' ? 'gemini-2.0-flash' : 'deepseek-chat';

        const sys = `你是一位科普漫画编剧。把纳米制造技术的章节内容改编成 ${this._COMIC_PANELS} 格竖排科普漫画的分镜脚本。
要求：
1. 用"女科学家讲解员"和"提问的学生"对话，把核心概念、原理、流程讲清楚，由浅入深。
2. 公式和复杂示意图不要试图画出来，用通俗类比表达。
3. 每格输出：scene（英文画面描述，给文生图模型，描述场景/动作/构图，不含任何文字）、speaker（讲解员/学生/旁白）、dialogue（中文对白，每句不超过30字）。
4. 严格只输出 JSON，格式：{"panels":[{"scene":"...","speaker":"...","dialogue":"..."}]}，不要任何额外说明或 markdown 代码块标记。`;

        const raw = await this.callAIProvider(provider, model, [
            { role: 'system', content: sys },
            { role: 'user', content: `章节标题：${title}\n\n章节内容：\n${text}` }
        ], 2000, 0.7);

        // 容错解析：去掉可能的 ```json 包裹
        const jsonStr = raw.replace(/```json\s*|\s*```/g, '').trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match ? match[0] : jsonStr);
        return (parsed.panels || []).slice(0, this._COMIC_PANELS);
    },

    async _generateComicImage(scene) {
        const edgeUrl = SUPABASE_URL + '/functions/v1/ai-proxy';
        const headers = { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY };
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

        const resp = await fetch(edgeUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                task: 'image',
                model: 'cogview-4',
                prompt: `${this._COMIC_STYLE}. Scene: ${scene}`,
                size: '1024x1024'
            })
        });
        const data = await resp.json();
        if (!resp.ok || !data.url) throw new Error(data.error || '图像生成失败');
        return data.url;
    },

    // ===== UI =====
    _openComicModal() {
        let modal = document.getElementById('comic-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'comic-modal';
            modal.className = 'comic-modal';
            modal.innerHTML = `
                <div class="comic-modal-backdrop"></div>
                <div class="comic-modal-content">
                    <div class="comic-modal-header">
                        <h2 id="comic-modal-title">章节漫画</h2>
                        <div class="comic-modal-actions">
                            <button id="comic-regenerate" class="btn btn-sm btn-secondary" title="重新生成">↻ 重新生成</button>
                            <button id="comic-close" class="comic-modal-close" title="关闭">✕</button>
                        </div>
                    </div>
                    <div id="comic-body" class="comic-body"></div>
                </div>`;
            document.body.appendChild(modal);

            modal.querySelector('.comic-modal-backdrop').addEventListener('click', () => this._closeComicModal());
            modal.querySelector('#comic-close').addEventListener('click', () => this._closeComicModal());
            modal.querySelector('#comic-regenerate').addEventListener('click', () => {
                const ch = this.state.currentChapter;
                if (ch) {
                    localStorage.removeItem(`nanofab_comic_${ch.id}`);
                    this.generateChapterComic();
                }
            });
        }
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    _closeComicModal() {
        const modal = document.getElementById('comic-modal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';
    },

    _setComicStatus(msg, isError = false) {
        const body = document.getElementById('comic-body');
        if (body) {
            body.innerHTML = `<div class="comic-status${isError ? ' comic-status-error' : ''}">
                ${isError ? '' : '<div class="comic-spinner"></div>'}
                <p>${msg}</p>
            </div>`;
        }
    },

    _renderComic(chapter, panels) {
        this._openComicModal();
        const titleEl = document.getElementById('comic-modal-title');
        if (titleEl) titleEl.textContent = `《${chapter.title}》漫画版`;

        const body = document.getElementById('comic-body');
        const speakerClass = (s) => s === '学生' ? 'left' : s === '旁白' ? 'narration' : 'right';

        body.innerHTML = panels.map((p, i) => `
            <div class="comic-panel">
                <div class="comic-panel-img">
                    ${p.image
                        ? `<img src="${p.image}" alt="第${i + 1}格" loading="lazy">`
                        : `<div class="comic-img-placeholder">🖼️ 第 ${i + 1} 格出图失败</div>`}
                    <span class="comic-panel-num">${i + 1}</span>
                </div>
                ${p.dialogue ? `<div class="comic-bubble comic-bubble-${speakerClass(p.speaker)}">
                    <span class="comic-speaker">${p.speaker || ''}</span>
                    <p>${p.dialogue}</p>
                </div>` : ''}
            </div>
        `).join('') + `<p class="comic-footnote">由 AI 根据章节内容生成，仅供概念理解辅助，细节以正文为准。</p>`;
    }
};
