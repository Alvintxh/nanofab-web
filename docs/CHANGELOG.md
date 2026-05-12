# Changelog

## 2026-05-12 (PM) - UI enhancements & learning tools (teacher feedback)

### Layout & Design
- Expanded desktop layout: main content area 900px→1100px, onboarding form 560px→780px
- Unified font families across chapter content and UI components
- Wider radio/checkbox option buttons for better readability

### New Features
- Added mind map visualization on homepage showing course structure
- Added study statistics dashboard (today/week/total study time with weekly goal)
- Added image lightbox: click any image in chapter content to zoom
- Added sidebar sub-headings: h2/h3 from chapter content shown in navigation
- Added per-chapter learning objectives (basic + advanced levels)
- Added wrong answer book collecting incorrect quiz answers
- Added text highlighting and note-taking functionality
- Added "我的笔记" button in profile modal to view saved notes
- Chapters now show TL;DR summary box at top

### User Profile
- Added "毫无基础" option to knowledge level and prerequisites
- Added "每周预计学习时间" (weekly study hours) field to profile form
- Added purpose description explaining why information is collected

### AI Personalization
- Enhanced `buildSystemPrompt` with weekly study time and behavior data
- AI now tailors explanations for "毫无基础" users with simplest analogies
- System prompt now suggests study advice based on behavior patterns

## 2026-05-12 (AM) - Security hardening & bug fixes

### Security
- Moved Zhipu API key from client-side JS to Supabase Edge Function (`supabase/functions/ai-proxy/`)
- Tightened RLS policies: removed anonymous INSERT, now requires authentication for all tables
- Added unique constraint on `quiz_answers(user_id, chapter_id, question_id)` to prevent duplicates

### Bug Fixes
- Fixed AI chat messages losing Markdown formatting (assistant responses now render bold, lists, etc.)
- Fixed behavior data being discarded when loading user from Supabase
- Fixed `formatAIResponse` not converting Markdown list syntax (`- item`) to HTML `<li>`
- Fixed Mermaid diagram ID collision risk when multiple diagrams render in same millisecond
- Fixed inconsistent indentation in `handleLogin`, `handleRegister`, `handleVerify`

### Improvements
- Extracted unified `callAIProvider` method, eliminating ~150 lines of duplicated AI API call logic
- Throttled `saveBehaviorData` writes to localStorage/Supabase at 5-second intervals
  - Exceptions: navigation (hashchange) and quiz submissions save immediately

## 2026-05-04 - AI personalization & learning tools completed

- Implemented AI text selection feature with floating tooltip
- Created AI explanation modal with personalized content based on user level
- Added behavior tracking system (scroll depth, time spent, interactions, quiz results)
- Implemented learning tools section with tabbed interface
- Created key points cards with visual icons for chapter summaries
- Built interactive quiz system with 3 question types and instant feedback
- Added thinking exercises with expandable hints
- Integrated all learning tools into chapter content flow
- Added quiz completion summary with score display
- LocalStorage persistence for behavior data

## 2026-05-04 - Website foundation completed

- Created complete HTML/CSS/JS single-page application
- Implemented user onboarding with profile collection (name, background, motivation, level)
- Built responsive navigation sidebar with collapsible parts (4 parts, 12 chapters)
- Added progress tracking with circular ring indicator and dashboard progress bar
- Implemented chapter completion marking with visual indicators
- Converted all 12 chapters from Markdown to HTML format
- Added KaTeX support for mathematical formula rendering
- Created user profile modal with reset functionality
- Mobile-responsive design with hamburger menu and overlay
- LocalStorage persistence for user profile and chapter progress

## 2026-05-04 - Project initialized

- Scaffolded context engineering files (AGENTS.md, docs/TODO.md, docs/CHANGELOG.md, docs/ARCHITECTURE.md)
- Defined project scope: AI-driven personalized nanofabrication learning platform
- Based on NanoFab Knowledge Book v1 (4 parts, 12 chapters)
