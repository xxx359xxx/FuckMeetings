#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then
  printf '%s\n' 'Для этих ресурсов нужен Mac с Apple Silicon.' >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_TMP="$(mktemp -d "${TMPDIR:-/tmp}/fuckmeetings-whisper.XXXXXXXX")"
trap 'rm -rf "$TASK_TMP"' EXIT
curl -fL --retry 3 'https://github.com/ggml-org/whisper.cpp/archive/refs/tags/b5454.tar.gz' -o "$TASK_TMP/whisper.tar.gz"
printf '%s  %s\n' '9aa617f410d9c7f0dae952eb2b77eafdcfb310c2d622cca1f83633fd89a213bc' "$TASK_TMP/whisper.tar.gz" | shasum -a 256 -c -
mkdir -p "$TASK_TMP/source" "$ROOT/src-tauri/resources/whisper"
tar -xzf "$TASK_TMP/whisper.tar.gz" -C "$TASK_TMP/source" --strip-components=1
cmake -S "$TASK_TMP/source" -B "$TASK_TMP/build" -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0 -DBUILD_SHARED_LIBS=OFF -DGGML_METAL=OFF -DGGML_NATIVE=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF
cmake --build "$TASK_TMP/build" --target whisper-cli --parallel 4
cp "$TASK_TMP/build/bin/whisper-cli" "$ROOT/src-tauri/resources/whisper/whisper-cli"
cp "$TASK_TMP/source/LICENSE" "$ROOT/src-tauri/resources/whisper/LICENSE"
xcrun swiftc -swift-version 5 -parse-as-library -emit-library -O -target arm64-apple-macos13.0 "$ROOT/src-tauri/native/system_audio_bridge.swift" -o "$ROOT/src-tauri/resources/whisper/libsystem-audio.dylib"
