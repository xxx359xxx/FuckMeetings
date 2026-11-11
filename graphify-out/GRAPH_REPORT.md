# Graph Report - FuckMeetings-release-1.0.6  (2026-11-11)

## Corpus Check
- 66 files · ~40,972 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 5, .xml 2, .css 2)

## Summary
- 706 nodes · 1588 edges · 43 communities (35 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d57aaba0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ResumePage.tsx
- llm.rs
- types.ts
- OverlayPage.tsx
- tauri.conf.json
- compilerOptions
- dependencies
- local_models.rs
- MeetingsPage.tsx
- devDependencies
- overlay.ts
- package.json
- with
- compilerOptions
- default.json
- scripts
- shims.d.ts
- main.rs
- mermaid
- allowBuilds
- SettingsPage.tsx
- AudioOutput
- with
- macos_audio.rs
- migration.rs
- transcribe.rs
- Участие в разработке
- App.tsx
- errMsg
- agents.rs
- codex_connect.rs
- InterviewPage
- models.rs
- UpdateBanner.tsx
- screen_capture.rs
- updater.json
- MeetingControl
- AGENTS.md
- build-macos-resources.sh
- fuckmeetings

## God Nodes (most connected - your core abstractions)
1. `errMsg()` - 48 edges
2. `ResumePage()` - 31 edges
3. `SettingsPage()` - 30 edges
4. `MeetingsPage()` - 29 edges
5. `InterviewPage()` - 27 edges
6. `tr()` - 26 edges
7. `useSettings` - 25 edges
8. `cn()` - 23 edges
9. `react` - 19 edges
10. `OverlayPage()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `terminate_running_agents()`  [EXTRACTED]
  src-tauri/src/lib.rs → src-tauri/src/agents.rs
- `run_claude()` --calls--> `find_claude()`  [EXTRACTED]
  src-tauri/src/llm.rs → src-tauri/src/claude_connect.rs
- `run_codex()` --calls--> `find_codex()`  [EXTRACTED]
  src-tauri/src/llm.rs → src-tauri/src/codex_connect.rs
- `codex_models()` --calls--> `find_codex()`  [EXTRACTED]
  src-tauri/src/models.rs → src-tauri/src/codex_connect.rs
- `App()` --calls--> `UpdateBanner()`  [EXTRACTED]
  src/App.tsx → src/components/UpdateBanner.tsx

## Import Cycles
- None detected.

## Communities (43 total, 8 thin omitted)

### Community 0 - "ResumePage.tsx"
Cohesion: 0.15
Nodes (22): completeChat(), ATS_ANALYSIS_PROMPT, ATS_ANALYSIS_SYSTEM, TAILOR_PROMPT, TAILOR_SYSTEM, writeFileBytes(), extractJson(), saveText() (+14 more)

### Community 1 - "llm.rs"
Cohesion: 0.13
Nodes (28): AppState, ChatMessage, claude_input(), claude_stream_input_keeps_conversation_and_images_in_order(), claude_stream_input_rejects_invalid_image(), claude_text_delta(), extract_delta(), llm_cancel() (+20 more)

### Community 2 - "types.ts"
Cohesion: 0.10
Nodes (26): BOLD_FONTS, buildResumePdf(), firstReadable(), loadFonts(), NORMAL_FONTS, ACCENT, FontPair, INK (+18 more)

### Community 3 - "OverlayPage.tsx"
Cohesion: 0.14
Nodes (20): CopyButton(), StreamHandle, DEFAULT_SYSTEM_PROMPT, PROVIDER_ORDER, PROVIDERS, activeProviderConfig(), bindPersist(), deepMerge() (+12 more)

### Community 4 - "tauri.conf.json"
Cohesion: 0.08
Nodes (24): app, macOSPrivateApi, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl (+16 more)

### Community 5 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, lucide-react@^1.69.0, mammoth@^1.13.0, pdfjs-dist@^6.5.438, react@^19.1.0, remark-gfm@^4.0.1, @tauri-apps/api@^2, @tauri-apps/plugin-dialog@~2.8.4 (+9 more)

### Community 7 - "local_models.rs"
Cohesion: 0.22
Nodes (14): activate_local_model(), bundled_engine(), catalog_ids_are_known_and_filenames_unique(), delete_local_model(), download(), install_local_model(), InstalledModel, InstallProgress (+6 more)

### Community 8 - "MeetingsPage.tsx"
Cohesion: 0.15
Nodes (22): Markdown(), SpeechCapture(), start(), stop(), base64ToBytes(), readFileBytes(), toWhisperWav(), transcribeRecording() (+14 more)

### Community 9 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, tailwindcss@^4.3.4, @tailwindcss/vite@^4.3.4, @tauri-apps/cli@^2, @types/react@^19.1.8, @types/react-dom@^19.1.6, typescript@~6.0.3, vite@^8.0.16 (+9 more)

### Community 10 - "overlay.ts"
Cohesion: 0.16
Nodes (27): act(), applyShortcuts(), captureAndSend(), chain, clearRegistered(), DEFAULT_SHORTCUTS, desired, finishShortcutCapture() (+19 more)

### Community 11 - "package.json"
Cohesion: 0.14
Nodes (13): docx@^9.15.2, jspdf@^4.2.1, react-dom@^19.1.0, react-markdown@^10.1.0, license, name, private, type (+5 more)

### Community 12 - "with"
Cohesion: 0.05
Nodes (39): GITHUB_TOKEN, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD, bundles, config, label, os, jobs (+31 more)

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

### Community 19 - "mermaid"
Cohesion: 0.67
Nodes (3): mermaid@^12.3.0, mermaid, Diagram()

### Community 21 - "SettingsPage.tsx"
Cohesion: 0.20
Nodes (19): lucide-react, @tauri-apps/plugin-dialog, Badge(), BADGE_TONES, BadgeTone, Button(), BUTTON_VARIANTS, ButtonVariant (+11 more)

### Community 22 - "AudioOutput"
Cohesion: 0.11
Nodes (14): AVFoundation, CoreGraphics, CoreMedia, Foundation, ScreenCaptureKit, AudioOutput, copyError(), fmAudioStart() (+6 more)

### Community 23 - "with"
Cohesion: 0.06
Nodes (33): name, runs-on, steps, strategy, artifact, bundle, label, os (+25 more)

### Community 25 - "macos_audio.rs"
Cohesion: 0.11
Nodes (19): error_text(), library(), LIBRARY, MacAudioEvent, Failure, Pcm, MacAudioState, on_error() (+11 more)

### Community 27 - "migration.rs"
Cohesion: 0.12
Nodes (20): run(), updater_configured(), completed_migration_does_not_restore_deleted_files(), copies_without_replacing_and_rewrites_managed_paths(), copy_file(), copy_settings(), copy_symlink(), copy_tree() (+12 more)

### Community 28 - "transcribe.rs"
Cohesion: 0.19
Nodes (5): deepgram_uses_raw_audio_and_extracts_transcript(), request_deepgram(), sends_audio_and_reads_transcription(), transcribe_audio(), transcribe_deepgram()

### Community 29 - "Участие в разработке"
Cohesion: 0.08
Nodes (22): Безопасность, Как добавить провайдера, Локальный запуск, Правила PR, Стиль коммитов, Структура, Требования, Участие в разработке (+14 more)

### Community 30 - "App.tsx"
Cohesion: 0.19
Nodes (17): react, @tauri-apps/api, App(), NAV, Sidebar(), Tab, AudioEvent, onMac (+9 more)

### Community 31 - "errMsg"
Cohesion: 0.25
Nodes (18): saveSettings(), errMsg(), loadResume(), save(), englishOnly(), samePath(), SettingsPage(), checkClaude() (+10 more)

### Community 32 - "agents.rs"
Cohesion: 0.19
Nodes (10): AgentEvent, Error, Exit, Stderr, Stdout, AgentProcessGuard, run_agent(), RUNNING_AGENTS (+2 more)

### Community 33 - "codex_connect.rs"
Cohesion: 0.15
Nodes (7): connect_claude(), find_claude(), connect_codex(), ConnectEvent, Browser, Status, find_codex()

### Community 34 - "InterviewPage"
Cohesion: 0.18
Nodes (12): runAgent(), streamChat(), fileToDataUrl(), InterviewPage(), addFiles(), agent(), ask(), lastUserText() (+4 more)

### Community 35 - "models.rs"
Cohesion: 0.32
Nodes (8): codex_models(), default_base(), endpoint(), endpoints_stay_on_configured_origin(), gemini_pages_use_tokens_and_strip_model_prefix(), list_provider_models(), model(), ProviderModel

### Community 36 - "UpdateBanner.tsx"
Cohesion: 0.20
Nodes (9): @tauri-apps/plugin-process@~2.4.0, @tauri-apps/plugin-updater@~2.14.1, zustand@^5.0.16, @tauri-apps/plugin-process, @tauri-apps/plugin-updater, zustand, UpdateBanner(), UpdateGate (+1 more)

### Community 37 - "screen_capture.rs"
Cohesion: 0.36
Nodes (5): capture_screen(), CaptureState, clear_pending_capture(), get_pending_capture(), open_selection()

### Community 38 - "updater.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 39 - "MeetingControl"
Cohesion: 1.00
Nodes (3): MeetingControl(), openMeeting(), stop()

## Knowledge Gaps
- **21 isolated node(s):** `fuckmeetings`, `Foundation`, `ScreenCaptureKit`, `AVFoundation`, `CoreMedia` (+16 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 250 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `errMsg()` connect `errMsg` to `ResumePage.tsx`, `InterviewPage`, `OverlayPage.tsx`, `MeetingsPage.tsx`, `SettingsPage.tsx`, `App.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `fuckmeetings`, `Foundation`, `ScreenCaptureKit` to the rest of the system?**
  _21 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ResumePage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14855072463768115 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `ResumePage.tsx`, `OverlayPage.tsx`, `UpdateBanner.tsx`, `dependencies`, `MeetingsPage.tsx`, `overlay.ts`, `package.json`, `SettingsPage.tsx`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `llm.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.13205128205128205 - nodes in this community are weakly interconnected._
- **Why does `@tauri-apps/api` connect `App.tsx` to `types.ts`, `OverlayPage.tsx`, `UpdateBanner.tsx`, `dependencies`, `MeetingsPage.tsx`, `overlay.ts`, `package.json`, `SettingsPage.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0989247311827957 - nodes in this community are weakly interconnected._