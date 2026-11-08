# Участие в разработке

Спасибо за интерес к InterviewKit! Проект открыт для pull request'ов и issue.

## Требования

- Rust (stable, MSVC toolchain на Windows)
- Node.js 20+ и pnpm
- Windows: Visual Studio Build Tools («Desktop development with C++») + WebView2 Runtime
- macOS: Xcode Command Line Tools

## Локальный запуск

```bash
pnpm install
pnpm tauri dev
```

> ⚠️ **Не размещайте проект в OneDrive / сетевой папке.** WebView2 не умеет создавать папку данных на синхронизируемом пути и падает с `os error 5` / `0x800700AA`. Держите build-артефакты вне облака (см. раздел «Устранение неполадок» в README) или клонируйте проект в обычную локальную папку.

## Структура

- `src/lib/` — провайдеры, промпты, store настроек, SSE-клиент, DOCX/PDF.
- `src/pages/` — три экрана: собеседование, резюме, настройки.
- `src-tauri/src/llm.rs` — HTTP-вызовы провайдеров и стриминг (OpenAI / Anthropic / Gemini).
- `src-tauri/src/agents.rs` — запуск CLI-агентов (Claude Code, Codex).
- `src-tauri/src/files.rs` — чтение/запись файлов для импорта/экспорта.

## Как добавить провайдера

1. Добавьте запись в `PROVIDERS` (`src/lib/providers.ts`) — `wire`, `baseUrl`, модели, `requiresKey`.
2. Если протокол не OpenAI-совместимый — добавьте ветку в `run_llm` (`src-tauri/src/llm.rs`).
3. Проверьте стриминг через кнопку «Проверить подключение» в настройках.

## Правила PR

- Один PR — одна логическая правка.
- Держите `pnpm build` (tsc) и `cargo build` зелёными.
- Не коммитьте ключи, `node_modules`, `dist`, `src-tauri/target`, `src-tauri/.cargo/config.toml`.
- Новые строки UI — на русском; код, имена и комментарии — на английском.
- Для новых зависимостей объясните, зачем они нужны.

## Стиль коммитов

`type: короткое описание` — например `feat: экспорт резюме в PDF`, `fix: стриминг Gemini`, `docs: README`.

## Безопасность

Нашли уязвимость (например, утечку ключей)? Не открывайте публичный issue — напишите мейнтейнерам напрямую.
