// ===== 章节漫画生成模块 (CogView-4) =====
// 流程: 章节正文 → LLM 生成分镜脚本 → 逐格文生图 → HTML 叠加中文气泡

const ComicModule = {
    // 画风后缀：放在具体场景之后，避免淹没画面主体（CogView 对靠前的描述权重更高）
    _COMIC_STYLE: '整体风格：可爱的日系科普漫画卡通风，明亮活泼的色彩，圆润造型，干净的粗描边线条；' +
        '固定角色为一只圆滚滚、友善的蓝白色机器人猫咪向导（大眼睛、表情生动）和一个好奇的学生男孩，' +
        '让这两个角色出现在场景里与知识点互动。画面中不要出现任何文字、字母或数字。',

    _COMIC_PANELS: 12,

    async generateChapterComic() {
        const chapter = this.state.currentChapter;
        if (!chapter) {
            this.showToast('请先打开一个章节', 'warning');
            return;
        }

        const cacheKey = `nanofab_comic_v3_${chapter.id}`;
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
            const rawText = (contentEl?.innerText || chapter.description || '').slice(0, 9000);

            // 2. LLM 生成分镜脚本
            const panels = await this._buildComicScript(chapter.title, rawText);
            if (!panels?.length) throw new Error('分镜脚本生成失败');

            // 3. 逐格生成图像（串行，避免并发限流）
            this._imageModel = 'cogview-4'; // 每次生成从最优模型开始，余额不足自动降级
            let consecutiveFails = 0;
            for (let i = 0; i < panels.length; i++) {
                this._setComicStatus(`正在绘制第 ${i + 1} / ${panels.length} 格…`);
                try {
                    panels[i].image = await this._drawPanel(panels[i].scene);
                    consecutiveFails = 0;
                } catch (e) {
                    // 重试一次（应对偶发限流 / 超时）
                    console.warn(`第 ${i + 1} 格出图失败，重试一次：`, e.message);
                    try {
                        await new Promise(r => setTimeout(r, 1500));
                        panels[i].image = await this._drawPanel(panels[i].scene);
                        consecutiveFails = 0;
                    } catch (e2) {
                        panels[i].image = null;
                        panels[i].imageError = e2.message; // 真实错误，渲染时显示
                        consecutiveFails++;
                        // 连续两格失败视为系统性问题，提前中止以免烧光出图额度
                        if (consecutiveFails >= 2) {
                            for (let j = i + 1; j < panels.length; j++) {
                                panels[j].image = null;
                                panels[j].imageError = '已跳过（前面连续出图失败）';
                            }
                            break;
                        }
                    }
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
        // 漫画功能基于智谱（出图用 CogView）。脚本优先用最强模型，不可用则自动降级，
        // 保证即使账号未开通 glm-4-plus / 余额不足也能正常生成。
        const provider = 'zhipu';
        const modelChain = ['glm-4-plus', 'glm-4-air', 'glm-4-flash'];

        const sys = `你是顶尖的科普漫画编剧，擅长把复杂的纳米制造技术讲解得准确、生动、循序渐进。

任务：把下面的章节内容改编成 ${this._COMIC_PANELS} 格科普漫画分镜脚本。

要求：
1. 先在心里梳理本章的核心知识点（基本原理、关键工艺、重要概念、典型应用），按"由浅入深、循序渐进"的教学逻辑铺满 ${this._COMIC_PANELS} 格，确保覆盖本章主要知识点，不要泛泛而谈或重复。
2. 角色设定：主讲是一只可爱友善的蓝白色机器人猫咪向导（称"讲解员"），搭档是一个好奇爱提问的学生男孩（称"学生"）。讲解员主讲知识点，学生适时提问推进节奏。
3. 每格的 dialogue 要讲清楚一个**具体**的知识点：它是什么、为什么、怎么做，必要时用类比帮助理解。每格 1~3 句、可到 60 字，要有真实信息量，杜绝空话套话。
4. 公式和复杂示意图不要试图画出来，用通俗语言和类比表达其含义。
5. 每格的 scene 是给文生图模型的**中文画面描述**，必须紧扣该格正在讲的知识点：先描述这只蓝白机器人猫向导和/或学生男孩在做什么、什么表情，再描述能直观体现该知识点的画面元素（相关设备、材料、晶圆、原子/分子结构、工艺流程步骤、对比示意等），让角色与之互动。画面里不要出现任何文字。
6. 严格只输出 JSON：{"panels":[{"scene":"中文画面描述","speaker":"讲解员/学生/旁白","dialogue":"中文对白"}]}，不要任何额外说明或代码块标记。`;

        const userMsg = `章节标题：${title}\n\n章节内容：\n${text}`;
        let raw = '', lastErr = null;
        for (const model of modelChain) {
            try {
                raw = await this.callAIProvider(provider, model, [
                    { role: 'system', content: sys },
                    { role: 'user', content: userMsg }
                ], 4096, 0.8);
                if (raw) {
                    console.info(`漫画脚本由 ${model} 生成`);
                    break;
                }
            } catch (e) {
                lastErr = e;
                console.warn(`脚本模型 ${model} 不可用，尝试降级：`, e.message);
            }
        }
        if (!raw) throw lastErr || new Error('脚本生成失败');

        // 容错解析：去掉可能的 ```json 包裹
        const jsonStr = raw.replace(/```json\s*|\s*```/g, '').trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match ? match[0] : jsonStr);
        return (parsed.panels || []).slice(0, this._COMIC_PANELS);
    },

    // 出图模型降级链：cogview-4(付费) → cogview-3-flash(免费)。
    // 记住当前可用模型，避免每格都重复试已失败的付费模型。
    async _drawPanel(scene) {
        const chain = this._imageModel === 'cogview-3-flash'
            ? ['cogview-3-flash']
            : ['cogview-4', 'cogview-3-flash'];
        let lastErr;
        for (const model of chain) {
            try {
                const url = await this._generateComicImage(scene, model);
                if (this._imageModel !== model) {
                    console.warn(`出图模型切换为 ${model}`);
                    this._imageModel = model;
                }
                return url;
            } catch (e) {
                lastErr = e;
                // 仅在付费/授权类错误时降级；其他错误（限流等）直接抛出由上层重试
                if (!/1113|余额|资源包|1211|1261|模型|权限|授权/.test(e.message)) throw e;
                console.warn(`${model} 不可用（${e.message}），尝试降级`);
            }
        }
        throw lastErr;
    },

    async _generateComicImage(scene, model = 'cogview-4') {
        const edgeUrl = SUPABASE_URL + '/functions/v1/ai-proxy';
        const headers = { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY };
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

        // cogview-3-flash prompt 上限约 224 tokens，需精简场景与画风
        const prompt = model === 'cogview-3-flash'
            ? `${scene.slice(0, 100)}。可爱日系卡通科普漫画，圆润蓝白机器人猫向导与学生男孩，明亮干净，不要文字`
            : `${scene}。${this._COMIC_STYLE}`;

        const resp = await fetch(edgeUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ task: 'image', model, prompt, size: '1024x1024' })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.url) {
            throw new Error(data.error || `HTTP ${resp.status}`);
        }
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
                    localStorage.removeItem(`nanofab_comic_v3_${ch.id}`);
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
        const sideClass = (s) => s === '学生' ? 'left' : s === '旁白' ? 'narration' : 'right';

        const frames = panels.map((p, i) => `
            <div class="comic-frame">
                <div class="comic-frame-img">
                    ${p.image
                        ? `<img src="${p.image}" alt="第${i + 1}格" loading="lazy">`
                        : `<div class="comic-img-placeholder">🖼️ 第 ${i + 1} 格出图失败${p.imageError ? `<br><span class="comic-img-err">${p.imageError}</span>` : ''}</div>`}
                    <span class="comic-panel-num">${i + 1}</span>
                </div>
                ${p.dialogue ? `<div class="comic-bubble comic-bubble-${sideClass(p.speaker)}">
                    <span class="comic-speaker">${p.speaker || ''}</span>
                    <p>${p.dialogue}</p>
                </div>` : ''}
            </div>
        `).join('');

        body.innerHTML = `
            <div class="comic-page">
                <div class="comic-banner">
                    <span class="comic-banner-tag">科普漫画</span>
                    <h3>${chapter.title}</h3>
                    <span class="comic-banner-sub">和机器人猫向导一起学纳米制造</span>
                </div>
                <div class="comic-strip">${frames}</div>
                <p class="comic-footnote">由 AI 根据章节内容生成，仅供概念理解辅助，细节以正文为准。</p>
            </div>`;
    }
};
