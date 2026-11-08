# Graph Report - interview-kit  (2026-11-08)

## Corpus Check
- 49 files · ~32,701 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .xml 2, .css 2)

## Summary
- 439 nodes · 1134 edges · 29 communities (19 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- ResumePage.tsx
- llm.rs
- pdf.ts
- settings.ts
- tauri.conf.json
- compilerOptions
- dependencies
- local_models.rs
- InterviewPage.tsx
- devDependencies
- overlay.ts
- package.json
- vite.config.ts
- compilerOptions
- default.json
- scripts
- shims.d.ts
- main.rs
- Markdown.tsx
- allowBuilds
- lucide-react
- interview-kit
- transcribe.rs

## God Nodes (most connected - your core abstractions)
1. `errMsg()` - 44 edges
2. `ResumePage()` - 29 edges
3. `MeetingsPage()` - 28 edges
4. `SettingsPage()` - 26 edges
5. `tr()` - 25 edges
6. `InterviewPage()` - 25 edges
7. `useSettings` - 25 edges
8. `cn()` - 23 edges
9. `OverlayPage()` - 18 edges
10. `readFileBytes()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `Spinner()`  [EXTRACTED]
  src/App.tsx → src/components/ui.tsx
- `App()` --calls--> `initSettings()`  [EXTRACTED]
  src/App.tsx → src/lib/settings.ts
- `App()` --calls--> `useSettings`  [EXTRACTED]
  src/App.tsx → src/lib/settings.ts
- `App()` --calls--> `InterviewContextPage()`  [EXTRACTED]
  src/App.tsx → src/pages/InterviewContextPage.tsx
- `App()` --calls--> `MeetingsPage()`  [EXTRACTED]
  src/App.tsx → src/pages/MeetingsPage.tsx

## Import Cycles
- None detected.

## Communities (29 total, 10 thin omitted)

### Community 0 - "ResumePage.tsx"
Cohesion: 0.09
Nodes (61): Badge(), Card(), ErrorBanner(), Field(), Spinner(), completeChat(), ATS_ANALYSIS_PROMPT, ATS_ANALYSIS_SYSTEM (+53 more)

### Community 1 - "llm.rs"
Cohesion: 0.13
Nodes (22): AppState, ChatMessage, extract_delta(), llm_cancel(), llm_chat(), LlmEvent, Delta, Done (+14 more)

### Community 2 - "pdf.ts"
Cohesion: 0.23
Nodes (11): BOLD_FONTS, buildResumePdf(), firstReadable(), loadFonts(), NORMAL_FONTS, ACCENT, FontPair, INK (+3 more)

### Community 3 - "settings.ts"
Cohesion: 0.12
Nodes (25): StreamHandle, DEFAULT_SYSTEM_PROMPT, PROVIDER_ORDER, PROVIDERS, activeProviderConfig(), bindPersist(), deepMerge(), getStore() (+17 more)

### Community 4 - "tauri.conf.json"
Cohesion: 0.11
Nodes (18): app, macOSPrivateApi, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl (+10 more)

### Community 5 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, jspdf@^4.2.1, mammoth@^1.13.0, react@^19.1.0, react-dom@^19.1.0, @tauri-apps/api@^2, @tauri-apps/plugin-dialog@~2.8.4, @tauri-apps/plugin-global-shortcut@~2.4.1 (+9 more)

### Community 7 - "local_models.rs"
Cohesion: 0.09
Nodes (19): AgentEvent, Error, Exit, Stderr, Stdout, run_agent(), activate_local_model(), catalog_ids_are_known_and_filenames_unique() (+11 more)

### Community 8 - "InterviewPage.tsx"
Cohesion: 0.09
Nodes (41): @tauri-apps/api, Markdown(), SpeechCapture(), start(), stop(), AudioEvent, SystemSpeechCapture(), wav() (+33 more)

### Community 9 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, tailwindcss@^4.3.4, @tauri-apps/cli@^2, @types/react@^19.1.8, @types/react-dom@^19.1.6, typescript@~6.0.3, tailwindcss, @tauri-apps/cli (+3 more)

### Community 10 - "overlay.ts"
Cohesion: 0.11
Nodes (38): react, App(), NAV, Sidebar(), Tab, tr(), translations, act() (+30 more)

### Community 11 - "package.json"
Cohesion: 0.17
Nodes (11): docx@^9.15.2, pdfjs-dist@^6.5.438, @tauri-apps/plugin-store@~2.5.0, license, name, private, type, version (+3 more)

### Community 12 - "vite.config.ts"
Cohesion: 0.25
Nodes (6): @tailwindcss/vite@^4.3.4, vite@^8.0.16, @vitejs/plugin-react@^6.0.2, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 13 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 14 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 15 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, tauri

### Community 17 - "shims.d.ts"
Cohesion: 0.50
Nodes (3): mammoth, MammothMessage, MammothResult

### Community 19 - "Markdown.tsx"
Cohesion: 0.22
Nodes (7): mermaid@^12.3.0, react-markdown@^10.1.0, remark-gfm@^4.0.1, mermaid, react-markdown, remark-gfm, Diagram()

### Community 28 - "transcribe.rs"
Cohesion: 0.15
Nodes (9): capture_screen(), CaptureState, clear_pending_capture(), get_pending_capture(), deepgram_uses_raw_audio_and_extracts_transcript(), request_deepgram(), sends_audio_and_reads_transcription(), transcribe_audio() (+1 more)

## Knowledge Gaps
- **11 isolated node(s):** `Delta`, `Done`, `Error`, `Anthropic`, `Gemini` (+6 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 136 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `errMsg()` connect `ResumePage.tsx` to `InterviewPage.tsx`, `settings.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `Delta`, `Done`, `Error` to the rest of the system?**
  _11 weakly-connected nodes found - possible missing edges._
- **Should `ResumePage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09184149184149185 - nodes in this community are weakly interconnected._
- **Why does `react` connect `overlay.ts` to `ResumePage.tsx`, `settings.ts`, `dependencies`, `InterviewPage.tsx`, `package.json`, `Markdown.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `llm.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Why does `@tauri-apps/api` connect `InterviewPage.tsx` to `ResumePage.tsx`, `settings.ts`, `dependencies`, `overlay.ts`, `package.json`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `settings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12473118279569892 - nodes in this community are weakly interconnected._