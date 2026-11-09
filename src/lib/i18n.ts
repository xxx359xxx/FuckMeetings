import { useSettings } from "./settings";

const translations: Record<string, { en: string; es: string }> = {
  "Сквозные клики": { en: "Click-through", es: "Clics a través" },
  "Вернуть значок на панель задач": { en: "Show taskbar icon", es: "Mostrar icono en la barra" },
  "Скрыть значок на панели задач": { en: "Hide taskbar icon", es: "Ocultar icono de la barra" },
  "Защита от захвата включена": { en: "Capture protection enabled", es: "Protección de captura activada" },
  "Видно при захвате": { en: "May be visible in capture", es: "Puede verse en la captura" },
  "Цель резюме": { en: "Resume goal", es: "Objetivo del currículum" },
  "Под вакансию": { en: "Tailor to a job", es: "Adaptar a una oferta" },
  "Улучшить резюме": { en: "Improve resume", es: "Mejorar currículum" },
  "Язык резюме": { en: "Resume language", es: "Idioma del currículum" },
  "Как в исходном резюме": { en: "Same as original", es: "Igual que el original" },
  "Дополнительные настройки": { en: "Advanced settings", es: "Ajustes adicionales" },
  "Подробность": { en: "Detail", es: "Nivel de detalle" },
  "Кратко": { en: "Concise", es: "Conciso" },
  "Подробно": { en: "Detailed", es: "Detallado" },
  "Не добавлять вымышленные факты. Проверьте результат перед отправкой.": { en: "Do not add invented facts. Review the result before sending.", es: "No añadir datos inventados. Revisa el resultado antes de enviarlo." },

  "Все модели": { en: "All models", es: "Todos los modelos" },
  "Показать все модели": { en: "Show all models", es: "Mostrar todos los modelos" },
  "ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО": {
    "en": "YOUR WORKSPACE",
    "es": "TU ESPACIO DE TRABAJO"
  },
  "Собеседование": {
    "en": "Interview",
    "es": "Entrevista"
  },
  "Резюме и инструкции": {
    "en": "Resume and instructions",
    "es": "Currículum e instrucciones"
  },
  "Резюме / ATS": {
    "en": "Resume / ATS",
    "es": "Currículum / ATS"
  },
  "Адаптация под вакансию": {
    "en": "Tailor to a job",
    "es": "Adaptar a una oferta"
  },
  "Встречи": {
    "en": "Meetings",
    "es": "Reuniones"
  },
  "Запись и итоги": {
    "en": "Recording and summary",
    "es": "Grabación y resumen"
  },
  "Горячие клавиши": {
    "en": "Keyboard shortcuts",
    "es": "Atajos de teclado"
  },
  "Управление помощником": {
    "en": "Assistant controls",
    "es": "Controles del asistente"
  },
  "Настройки": {
    "en": "Settings",
    "es": "Ajustes"
  },
  "Ключи, модели, агенты": {
    "en": "Keys, models, agents",
    "es": "Claves, modelos, agentes"
  },
  "Показать оверлей": {
    "en": "Show overlay",
    "es": "Mostrar ventana flotante"
  },
  "Светлая тема": {
    "en": "Light theme",
    "es": "Tema claro"
  },
  "Тёмная тема": {
    "en": "Dark theme",
    "es": "Tema oscuro"
  },
  "Включить светлую тему": {
    "en": "Switch to light theme",
    "es": "Activar tema claro"
  },
  "Включить тёмную тему": {
    "en": "Switch to dark theme",
    "es": "Activar tema oscuro"
  },
  "модель не выбрана": {
    "en": "no model selected",
    "es": "ningún modelo seleccionado"
  },
  "хоткей занят · нажмите кнопку": {
    "en": "shortcut unavailable · click the button",
    "es": "atajo ocupado · pulsa el botón"
  },
  "Подготовка к собеседованию": {
    "en": "Interview preparation",
    "es": "Preparación para la entrevista"
  },
  "Добавьте свой опыт и пожелания, чтобы помощник учитывал их в ответах.": {
    "en": "Add your experience and preferences for the assistant to use in its answers.",
    "es": "Añade tu experiencia y preferencias para que el asistente las tenga en cuenta."
  },
  "Ваше резюме": {
    "en": "Your resume",
    "es": "Tu currículum"
  },
  "PDF, DOCX или текстовый файл. Текст можно проверить и исправить.": {
    "en": "PDF, DOCX or text file. You can review and edit the extracted text.",
    "es": "Archivo PDF, DOCX o de texto. Puedes revisar y corregir el texto."
  },
  "Файл:": {
    "en": "File:",
    "es": "Archivo:"
  },
  "Текст резюме": {
    "en": "Resume text",
    "es": "Texto del currículum"
  },
  "Загрузите файл или вставьте текст резюме сюда…": {
    "en": "Upload a file or paste your resume here…",
    "es": "Sube un archivo o pega tu currículum aquí…"
  },
  "Очистить резюме": {
    "en": "Clear resume",
    "es": "Borrar currículum"
  },
  "Как отвечать": {
    "en": "Response preferences",
    "es": "Cómo responder"
  },
  "Опишите стиль, роль или формат ответа. Например: «Отвечай кратко, как системный аналитик, и приводи примеры из моего опыта».": {
    "en": "Describe the style, role or response format you prefer.",
    "es": "Describe el estilo, el rol o el formato de respuesta que prefieres."
  },
  "Пожелания к помощнику": {
    "en": "Instructions for the assistant",
    "es": "Indicaciones para el asistente"
  },
  "Например: сначала краткий ответ, затем пример…": {
    "en": "For example: give a brief answer first, then an example…",
    "es": "Por ejemplo: primero una respuesta breve y luego un ejemplo…"
  },
  "Использовать в скрытом помощнике": {
    "en": "Use in the floating assistant",
    "es": "Usar en el asistente flotante"
  },
  "При каждом запросе текст резюме и пожелания передаются выбранной модели. Данные хранятся в настройках на этом компьютере; при использовании облачной модели они отправляются её провайдеру.": {
    "en": "Your resume and instructions are sent with each request. They are stored on this computer; cloud models send them to the selected provider.",
    "es": "Tu currículum e indicaciones se envían con cada solicitud. Se guardan en este equipo; con modelos en la nube se envían al proveedor elegido."
  },
  "Сохранить": {
    "en": "Save",
    "es": "Guardar"
  },
  "Изменения также сохраняются автоматически.": {
    "en": "Changes are also saved automatically.",
    "es": "Los cambios también se guardan automáticamente."
  },
  "Загрузить резюме": {
    "en": "Upload resume",
    "es": "Subir currículum"
  },
  "Читаю…": {
    "en": "Reading…",
    "es": "Leyendo…"
  },
  "Запись, расшифровка и итоги встречи": {
    "en": "Record, transcribe and summarize meetings",
    "es": "Graba, transcribe y resume reuniones"
  },
  "Этап встречи": {
    "en": "Meeting stage",
    "es": "Etapa de la reunión"
  },
  "Запись": {
    "en": "Recording",
    "es": "Grabación"
  },
  "Текст": {
    "en": "Transcript",
    "es": "Texto"
  },
  "Итоги": {
    "en": "Summary",
    "es": "Resumen"
  },
  "Остановить запись": {
    "en": "Stop recording",
    "es": "Detener grabación"
  },
  "Начать запись": {
    "en": "Start recording",
    "es": "Iniciar grabación"
  },
  "Запускаю…": {
    "en": "Starting…",
    "es": "Iniciando…"
  },
  "Запись идёт": {
    "en": "Recording",
    "es": "Grabando"
  },
  "Запись завершена": {
    "en": "Recording stopped",
    "es": "Grabación finalizada"
  },
  "Готово к записи": {
    "en": "Ready to record",
    "es": "Listo para grabar"
  },
  "Перетащите панель за точки. Значок открывает встречу, красная кнопка останавливает запись.": {
    "en": "Drag the panel by the dots. The icon opens the meeting; the red button stops recording.",
    "es": "Arrastra el panel por los puntos. El icono abre la reunión; el botón rojo detiene la grabación."
  },
  "Скрыть приложение": {
    "en": "Hide application",
    "es": "Ocultar aplicación"
  },
  "Источник звука": {
    "en": "Audio source",
    "es": "Fuente de audio"
  },
  "Мой микрофон + звук компьютера": {
    "en": "My microphone + system audio",
    "es": "Mi micrófono + audio del equipo"
  },
  "Только микрофон": {
    "en": "Microphone only",
    "es": "Solo micrófono"
  },
  "Системный звук записывается с устройства вывода по умолчанию. Сообщите участникам о записи.": {
    "en": "System audio is captured from the default output device. Inform participants about the recording.",
    "es": "El audio del sistema se graba desde el dispositivo de salida predeterminado. Informa a los participantes de la grabación."
  },
  "Загрузить аудиофайл": {
    "en": "Upload audio file",
    "es": "Subir archivo de audio"
  },
  "Вставить текст встречи": {
    "en": "Paste meeting transcript",
    "es": "Pegar transcripción de la reunión"
  },
  "Прослушать или сохранить запись": {
    "en": "Listen to or save recording",
    "es": "Escuchar o guardar la grabación"
  },
  "Мой микрофон": {
    "en": "My microphone",
    "es": "Mi micrófono"
  },
  "Звук компьютера": {
    "en": "System audio",
    "es": "Audio del equipo"
  },
  "Сохранить микрофон": {
    "en": "Save microphone audio",
    "es": "Guardar audio del micrófono"
  },
  "Сохранить системный звук": {
    "en": "Save system audio",
    "es": "Guardar audio del sistema"
  },
  "Сохранить аудио": {
    "en": "Save audio",
    "es": "Guardar audio"
  },
  "Сохраните запись до закрытия приложения.": {
    "en": "Save the recording before closing the application.",
    "es": "Guarda la grabación antes de cerrar la aplicación."
  },
  "Расшифровка": {
    "en": "Transcript",
    "es": "Transcripción"
  },
  "можно исправить": {
    "en": "editable",
    "es": "se puede editar"
  },
  "Собеседники / системный звук": {
    "en": "Participants / system audio",
    "es": "Participantes / audio del sistema"
  },
  "Текст встречи": {
    "en": "Meeting transcript",
    "es": "Texto de la reunión"
  },
  "Дорожки разделены по источнику, порядок реплик и имена собеседников не определяются автоматически.": {
    "en": "Tracks are separated by source; speaker names and the order of remarks are not detected automatically.",
    "es": "Las pistas se separan por fuente; los nombres y el orden de intervención no se detectan automáticamente."
  },
  "Сохранить текст": {
    "en": "Save transcript",
    "es": "Guardar transcripción"
  },
  "Настройки распознавания": {
    "en": "Transcription settings",
    "es": "Ajustes de transcripción"
  },
  "Итоги встречи": {
    "en": "Meeting summary",
    "es": "Resumen de la reunión"
  },
  "После расшифровки получите краткое содержание, решения, задачи и открытые вопросы.": {
    "en": "After transcription, get a summary, decisions, action items and open questions.",
    "es": "Después de transcribir, obtén un resumen, decisiones, tareas y preguntas pendientes."
  },
  "Сохранить итоги": {
    "en": "Save summary",
    "es": "Guardar resumen"
  },
  "Получить итоги": {
    "en": "Generate summary",
    "es": "Generar resumen"
  },
  "Обновить итоги": {
    "en": "Regenerate summary",
    "es": "Actualizar resumen"
  },
  "Распознать запись": {
    "en": "Transcribe recording",
    "es": "Transcribir grabación"
  },
  "Распознать заново": {
    "en": "Transcribe again",
    "es": "Volver a transcribir"
  },
  "Открыть встречу, не останавливая запись": {
    "en": "Open meeting without stopping recording",
    "es": "Abrir la reunión sin detener la grabación"
  },
  "Зажмите и перетащите панель": {
    "en": "Hold and drag the panel",
    "es": "Mantén pulsado y arrastra el panel"
  },
  "Остановить запись и открыть встречу": {
    "en": "Stop recording and open meeting",
    "es": "Detener la grabación y abrir la reunión"
  },
  "Ключи хранятся локально на этом устройстве": {
    "en": "Keys are stored locally on this device",
    "es": "Las claves se guardan localmente en este dispositivo"
  },
  "Провайдер и модель": {
    "en": "Provider and model",
    "es": "Proveedor y modelo"
  },
  "API-ключ": {
    "en": "API key",
    "es": "Clave API"
  },
  "Модель": {
    "en": "Model",
    "es": "Modelo"
  },
  "можно ввести вручную": {
    "en": "you can enter it manually",
    "es": "se puede introducir manualmente"
  },
  "Адрес API": {
    "en": "API address",
    "es": "Dirección de API"
  },
  "Проверить подключение": {
    "en": "Test connection",
    "es": "Probar conexión"
  },
  "Проверка отправит короткий запрос и может расходовать лимит API.": {
    "en": "The test sends a short request and may use API quota.",
    "es": "La prueba envía una solicitud breve y puede consumir cuota de API."
  },
  "Транскрибатор": {
    "en": "Speech recognition",
    "es": "Transcripción de audio"
  },
  "Способ распознавания": {
    "en": "Transcription method",
    "es": "Método de transcripción"
  },
  "API или локальный сервер (OpenAI-совместимый)": {
    "en": "API or local server (OpenAI-compatible)",
    "es": "API o servidor local (compatible con OpenAI)"
  },
  "Локальный whisper.cpp": {
    "en": "Local whisper.cpp",
    "es": "whisper.cpp local"
  },
  "Язык речи": {
    "en": "Spoken language",
    "es": "Idioma hablado"
  },
  "Выберите язык для распознавания": {
    "en": "Choose the language to transcribe",
    "es": "Elige el idioma que se va a transcribir"
  },
  "Автоопределение": {
    "en": "Auto-detect",
    "es": "Detección automática"
  },
  "Русский": {
    "en": "Russian",
    "es": "Ruso"
  },
  "Скачанные модели": {
    "en": "Downloaded models",
    "es": "Modelos descargados"
  },
  "Моделей пока нет. Загрузите одну из списка выше.": {
    "en": "No models downloaded yet. Download one above.",
    "es": "Aún no hay modelos descargados. Descarga uno arriba."
  },
  "Выбрать": {
    "en": "Select",
    "es": "Seleccionar"
  },
  "Удалить": {
    "en": "Delete",
    "es": "Eliminar"
  },
  "Сохранить настройки": {
    "en": "Save settings",
    "es": "Guardar ajustes"
  },
  "Интерфейс": {
    "en": "Appearance",
    "es": "Interfaz"
  },
  "Тема оформления": {
    "en": "Theme",
    "es": "Tema"
  },
  "Светлая": {
    "en": "Light",
    "es": "Claro"
  },
  "Тёмная": {
    "en": "Dark",
    "es": "Oscuro"
  },
  "Дополнительно: базовая инструкция помощника": {
    "en": "Advanced: base assistant instructions",
    "es": "Avanzado: instrucciones básicas del asistente"
  },
  "Базовая инструкция помощника": {
    "en": "Base assistant instructions",
    "es": "Instrucciones básicas del asistente"
  },
  "Восстановить стандартную инструкцию": {
    "en": "Restore default instructions",
    "es": "Restaurar instrucciones predeterminadas"
  },
  "Приватность и данные": {
    "en": "Privacy and data",
    "es": "Privacidad y datos"
  },
  "локально": {
    "en": "locally",
    "es": "localmente"
  },
  "локальное хранение": {
    "en": "stored locally",
    "es": "almacenamiento local"
  },
  "без своего сервера": {
    "en": "no proprietary server",
    "es": "sin servidor propio"
  },
  "Скрытый помощник": {
    "en": "Floating assistant",
    "es": "Asistente flotante"
  },
  "Распознанная речь": {
    "en": "Recognized speech",
    "es": "Voz reconocida"
  },
  "Прозрачность окна": {
    "en": "Window opacity",
    "es": "Opacidad de la ventana"
  },
  "Непрозрачность окна": {
    "en": "Window opacity",
    "es": "Opacidad de la ventana"
  },
  "Скрыть (Esc или хоткей)": {
    "en": "Hide (Esc or shortcut)",
    "es": "Ocultar (Esc o atajo)"
  },
  "Думаю…": {
    "en": "Thinking…",
    "es": "Pensando…"
  },
  "Убрать": {
    "en": "Remove",
    "es": "Quitar"
  },
  "Прикрепить скриншот": {
    "en": "Attach screenshot",
    "es": "Adjuntar captura"
  },
  "+ Файл": {
    "en": "+ File",
    "es": "+ Archivo"
  },
  "Вопрос или Ctrl+V скриншот…": {
    "en": "Question or Ctrl+V screenshot…",
    "es": "Pregunta o captura con Ctrl+V…"
  },
  "Стоп": {
    "en": "Stop",
    "es": "Detener"
  },
  "→ Ответ": {
    "en": "→ Answer",
    "es": "→ Responder"
  },
  "новый чат": {
    "en": "new chat",
    "es": "nuevo chat"
  },
  "Нажмите «Изменить», затем одновременно нажмите нужные клавиши. Escape отменяет запись.": {
    "en": "Click Edit, then press the desired keys together. Escape cancels.",
    "es": "Pulsa Editar y después las teclas a la vez. Escape cancela."
  },
  "Отмена": {
    "en": "Cancel",
    "es": "Cancelar"
  },
  "Изменить": {
    "en": "Edit",
    "es": "Editar"
  },
  "По умолчанию": {
    "en": "Reset",
    "es": "Restablecer"
  },
  "Во время записи сочетания управление горячими клавишами временно приостанавливается. Если клавиша занята другой программой, прежнее сочетание сохраняется.": {
    "en": "Shortcuts are paused while recording a combination. If another app uses it, the previous shortcut remains.",
    "es": "Los atajos se pausan al registrar una combinación. Si otra aplicación la usa, se conserva el atajo anterior."
  },
  "Скачать PDF": {
    "en": "Download PDF",
    "es": "Descargar PDF"
  },
  "Скачать DOCX": {
    "en": "Download DOCX",
    "es": "Descargar DOCX"
  },
  "Скачать .md": {
    "en": "Download .md",
    "es": "Descargar .md"
  },
  "Резюме": {
    "en": "Resume",
    "es": "Currículum"
  },
  "Загрузить PDF / DOCX": {
    "en": "Upload PDF / DOCX",
    "es": "Subir PDF / DOCX"
  },
  "Вакансия": {
    "en": "Job description",
    "es": "Oferta de empleo"
  },
  "текст описания": {
    "en": "job description text",
    "es": "texto de la oferta"
  },
  "Вставьте текст вакансии…": {
    "en": "Paste the job description…",
    "es": "Pega la descripción de la oferta…"
  },
  "Проверка резюме на ATS": {
    "en": "ATS resume check",
    "es": "Revisión ATS del currículum"
  },
  "оценка совпадения": {
    "en": "match score",
    "es": "puntuación de coincidencia"
  },
  "ключевые слова": {
    "en": "keywords",
    "es": "palabras clave"
  },
  "экспорт DOCX": {
    "en": "DOCX export",
    "es": "exportar DOCX"
  },
  "из 100": {
    "en": "out of 100",
    "es": "de 100"
  },
  "Совпадение с вакансией": {
    "en": "Job match",
    "es": "Coincidencia con la oferta"
  },
  "Есть в резюме": {
    "en": "Present in resume",
    "es": "En el currículum"
  },
  "Не хватает": {
    "en": "Missing",
    "es": "Falta"
  },
  "ATS-фильтры": {
    "en": "ATS filters",
    "es": "Filtros ATS"
  },
  "Рекомендации": {
    "en": "Recommendations",
    "es": "Recomendaciones"
  },
  "Готовое резюме": {
    "en": "Tailored resume",
    "es": "Currículum adaptado"
  },
  "Сохранено:": {
    "en": "Saved:",
    "es": "Guardado:"
  },
  "Горячая клавиша недоступна:": {
    "en": "Shortcut unavailable:",
    "es": "Atajo no disponible:"
  },
  "для локального сервера укажите его адрес /v1": {
    "en": "for a local server enter its /v1 address",
    "es": "para un servidor local indica su dirección /v1"
  },
  "Deepgram получит аудиозапись для распознавания. Адрес сервиса настроен автоматически.": {
    "en": "Deepgram receives audio for transcription. The service address is configured automatically.",
    "es": "Deepgram recibe el audio para transcribirlo. La dirección se configura automáticamente."
  },
  "Модель Deepgram": {
    "en": "Deepgram model",
    "es": "Modelo Deepgram"
  },
  "nova-3 поддерживает русский": {
    "en": "nova-3 supports Russian",
    "es": "nova-3 admite ruso"
  },
  "API-ключ Deepgram": {
    "en": "Deepgram API key",
    "es": "Clave API de Deepgram"
  },
  "Локальная модель работает на компьютере. Для английского доступны специализированные модели; Large v3 Turbo подходит для разных языков.": {
    "en": "The local model runs on your computer. English-specific models are available; Large v3 Turbo supports multiple languages.",
    "es": "El modelo local se ejecuta en tu equipo. Hay modelos específicos para inglés; Large v3 Turbo admite varios idiomas."
  },
  "Быстрая · около 75 МБ · ниже точность": {
    "en": "Fast · about 75 MB · lower accuracy",
    "es": "Rápido · unos 75 MB · menor precisión"
  },
  "Сбалансированная · около 141 МБ": {
    "en": "Balanced · about 141 MB",
    "es": "Equilibrado · unos 141 MB"
  },
  "Более точная · около 465 МБ · медленнее": {
    "en": "More accurate · about 465 MB · slower",
    "es": "Más preciso · unos 465 MB · más lento"
  },
  "Small Q5 · около 181 МиБ · компактная": {
    "en": "Small Q5 · about 181 MiB · compact",
    "es": "Small Q5 · unos 181 MiB · compacto"
  },
  "Medium Q5 · около 514 МиБ": {
    "en": "Medium Q5 · about 514 MiB",
    "es": "Medium Q5 · unos 514 MiB"
  },
  "Large v3 Turbo Q5 · около 547 МиБ · многоязычная": {
    "en": "Large v3 Turbo Q5 · about 547 MiB · multilingual",
    "es": "Large v3 Turbo Q5 · unos 547 MiB · multilingüe"
  },
  "Текущая модель поддерживает только английский. Выберите английский язык или многоязычную модель.": {
    "en": "The current model supports English only. Choose English or a multilingual model.",
    "es": "El modelo actual solo admite inglés. Elige inglés o un modelo multilingüe."
  },
  "Можно также указать установленные файлы вручную:": {
    "en": "You can also select existing files manually:",
    "es": "También puedes seleccionar archivos existentes manualmente:"
  },
  "Программа whisper-cli": {
    "en": "whisper-cli program",
    "es": "Programa whisper-cli"
  },
  "Файл модели": {
    "en": "Model file",
    "es": "Archivo del modelo"
  },
  "Изменения также сохраняются автоматически. Эта настройка общая для интервью и встреч.": {
    "en": "Changes are saved automatically. This setting applies to interviews and meetings.",
    "es": "Los cambios se guardan automáticamente. Este ajuste se aplica a entrevistas y reuniones."
  },
  "CLI-агенты": {
    "en": "CLI agents",
    "es": "Agentes CLI"
  },
  "Для автономного решения задач нужны установленные CLI (Claude Code или Codex). Используйте плейсхолдер": {
    "en": "CLI agents require Claude Code or Codex installed. Use the placeholder",
    "es": "Los agentes requieren Claude Code o Codex instalado. Utiliza el marcador"
  },
  "— он будет заменён на текст вопроса.": {
    "en": "— it will be replaced with the question text.",
    "es": "— se sustituirá por el texto de la pregunta."
  },
  "Отправляется вместе с каждым вопросом скрытому помощнику. Пожелания и резюме на странице «Собеседование» добавляются отдельно; избегайте противоречий.": {
    "en": "Sent with each question to the floating assistant. Your resume and preferences on the Interview page are added separately; avoid conflicting instructions.",
    "es": "Se envía con cada pregunta al asistente flotante. El currículum y las preferencias de Entrevista se añaden por separado; evita instrucciones contradictorias."
  },
  "• API-ключи и настройки хранятся": {
    "en": "• API keys and settings are stored",
    "es": "• Las claves API y los ajustes se guardan"
  },
  "в каталоге данных приложения. Никакого собственного сервера нет — запросы идут напрямую выбранному провайдеру.": {
    "en": "in the application data directory. Requests go directly to the provider you select.",
    "es": "en la carpeta de datos de la aplicación. Las solicitudes van directamente al proveedor elegido."
  },
  "• Резюме и вакансии не покидают устройство, кроме как при отправке в выбранную вами модель.": {
    "en": "• Resumes and job descriptions leave the device only when sent to the selected model.",
    "es": "• Los currículums y ofertas salen del equipo solo al enviarlos al modelo seleccionado."
  },
  "FuckMeetings · оверлей": {
    "en": "FuckMeetings · overlay",
    "es": "FuckMeetings · ventana flotante"
  },
  "Скрыть или вернуть значок на панели задач": {
    "en": "Hide or restore the taskbar icon",
    "es": "Ocultar o mostrar el icono de la barra de tareas"
  },
  "Защита окна от захвата поддерживается не всеми программами": {
    "en": "Capture protection is not supported by every application",
    "es": "La protección frente a capturas no funciona en todas las aplicaciones"
  },
  "Вставьте скриншот вопроса (": {
    "en": "Paste a screenshot of the question (",
    "es": "Pega una captura de la pregunta ("
  },
  ") или введите текст — ответ появится здесь, поверх остальных окон.": {
    "en": ") or enter text; the answer appears here above other windows.",
    "es": ") o escribe el texto; la respuesta aparecerá aquí sobre otras ventanas."
  },
  "Окно закреплено поверх других и не попадает в трансляцию, если вы делитесь только окном браузера.": {
    "en": "The window stays on top and is not included when sharing only the browser window.",
    "es": "La ventana permanece encima y no se incluye al compartir solo la ventana del navegador."
  },
  "Дожидаюсь распознавания и отправляю вопрос…": {
    "en": "Waiting for transcription and sending the question…",
    "es": "Esperando la transcripción y enviando la pregunta…"
  },
  "Анализ фильтров ATS и адаптация резюме под вакансию": {
    "en": "ATS analysis and resume tailoring",
    "es": "Análisis ATS y adaptación del currículum"
  },
  "Для": {
    "en": "For",
    "es": "Para"
  },
  "не задан API-ключ.": {
    "en": "an API key is not configured.",
    "es": "no hay una clave API configurada."
  },
  "Настроить": {
    "en": "Configure",
    "es": "Configurar"
  },
  "…или вставьте текст резюме сюда": {
    "en": "…or paste your resume here",
    "es": "…o pega tu currículum aquí"
  },
  "Загрузите резюме и вставьте текст вакансии. Приложение найдёт ATS-фильтры (навыки, опыт, образование, ключевые слова) и поможет адаптировать резюме для автоматического отбора. Оценка ориентировочная: правила конкретной ATS могут отличаться.": {
    "en": "Upload a resume and paste a job description to analyze ATS criteria and tailor your resume. The score is an estimate; individual ATS rules vary.",
    "es": "Sube un currículum y pega una oferta para analizar criterios ATS y adaptarlo. La puntuación es orientativa; cada ATS puede aplicar reglas distintas."
  },
  "Ответ модели (идёт обработка или JSON не разобран)": {
    "en": "Model response (processing or JSON parsing failed)",
    "es": "Respuesta del modelo (procesando o error al interpretar JSON)"
  },
  "Показать или скрыть помощника": {
    "en": "Show or hide assistant",
    "es": "Mostrar u ocultar asistente"
  },
  "Включить или выключить сквозные клики": {
    "en": "Toggle click-through",
    "es": "Activar o desactivar clics a través"
  },
  "Отправить распознанный вопрос": {
    "en": "Send recognized question",
    "es": "Enviar pregunta reconocida"
  },
  "Отправить снимок всего экрана": {
    "en": "Send full screen screenshot",
    "es": "Enviar captura de pantalla completa"
  },
  "Отправить выбранную область": {
    "en": "Send selected area",
    "es": "Enviar área seleccionada"
  },
  "Переместить окно вверх": {
    "en": "Move window up",
    "es": "Mover ventana arriba"
  },
  "Переместить окно вниз": {
    "en": "Move window down",
    "es": "Mover ventana abajo"
  },
  "Переместить окно влево": {
    "en": "Move window left",
    "es": "Mover ventana a la izquierda"
  },
  "Переместить окно вправо": {
    "en": "Move window right",
    "es": "Mover ventana a la derecha"
  },
  "Снимки экрана": {
    "en": "Screenshots",
    "es": "Capturas de pantalla"
  },
  "Перемещение окна": {
    "en": "Move window",
    "es": "Mover ventana"
  },
  "Нажмите сочетание…": {
    "en": "Press shortcut…",
    "es": "Pulsa una combinación…"
  },
  "Клики проходят": {
    "en": "Click-through on",
    "es": "Clics a través activados"
  },
  "Клики активны": {
    "en": "Clicks enabled",
    "es": "Clics activados"
  },
  "Значок: скрыт": {
    "en": "Icon: hidden",
    "es": "Icono: oculto"
  },
  "Значок: виден": {
    "en": "Icon: visible",
    "es": "Icono: visible"
  },
  "Защита: вкл": {
    "en": "Protection: on",
    "es": "Protección: activada"
  },
  "Защита: выкл": {
    "en": "Protection: off",
    "es": "Protección: desactivada"
  },
  "Здесь появится речь собеседника после распознавания.": {
    "en": "Recognized speech will appear here.",
    "es": "La voz reconocida aparecerá aquí."
  },
  "скриншоты: если поддерживает модель": {
    "en": "screenshots: if supported by the model",
    "es": "capturas: si el modelo las admite"
  },
  "только текст": {
    "en": "text only",
    "es": "solo texto"
  },
  "Микрофон и системный звук записываются.": {
    "en": "Microphone and system audio are being recorded.",
    "es": "Se graban el micrófono y el audio del sistema."
  },
  "Запись включена, ожидаю системный звук.": {
    "en": "Recording is active; waiting for system audio.",
    "es": "Grabación activa; esperando audio del sistema."
  },
  "Микрофон записывается.": {
    "en": "Microphone is recording.",
    "es": "Se está grabando el micrófono."
  },
  "Распознаю запись…": {
    "en": "Transcribing recording…",
    "es": "Transcribiendo grabación…"
  },
  "Распознаю твой микрофон…": {
    "en": "Transcribing your microphone…",
    "es": "Transcribiendo tu micrófono…"
  },
  "Распознаю собеседников…": {
    "en": "Transcribing participants…",
    "es": "Transcribiendo a los participantes…"
  },
  "Готовлю итоги…": {
    "en": "Preparing summary…",
    "es": "Preparando resumen…"
  },
  "Выберите резюме": {
    "en": "Choose a resume",
    "es": "Elige un currículum"
  },
  "Резюме загружено. Проверьте извлечённый текст ниже.": {
    "en": "Resume uploaded. Review the extracted text below.",
    "es": "Currículum subido. Revisa el texto extraído abajo."
  },
  "Настройки сохранены.": {
    "en": "Settings saved.",
    "es": "Ajustes guardados."
  },
  "Резюме удалено из настроек.": {
    "en": "Resume removed from settings.",
    "es": "Currículum eliminado de los ajustes."
  },
  "Устанавливаю…": {
    "en": "Installing…",
    "es": "Instalando…"
  },
  "Скачать и применить": {
    "en": "Download and apply",
    "es": "Descargar y aplicar"
  },
  " · выбрана": {
    "en": " · selected",
    "es": " · seleccionado"
  },
  " · файл неполный, скачайте заново": {
    "en": " · incomplete file; download again",
    "es": " · archivo incompleto; vuelve a descargarlo"
  },
  " · только для английского": {
    "en": " · English only",
    "es": " · solo inglés"
  },
  "Движок": {
    "en": "Engine",
    "es": "Motor"
  },
  "Проверяю…": {
    "en": "Checking…",
    "es": "Comprobando…"
  },
  "Сохранить и проверить ключ": {
    "en": "Save and check key",
    "es": "Guardar y comprobar clave"
  },
  "Обычно изменять не нужно": {
    "en": "Usually no change needed",
    "es": "Normalmente no hace falta cambiarla"
  },
  "обязателен; хранится в настройках без отдельного шифрования": {
    "en": "required; stored in settings without separate encryption",
    "es": "obligatoria; se guarda sin cifrado adicional en los ajustes"
  },
  "если сервер требует": {
    "en": "if required by the server",
    "es": "si el servidor la requiere"
  },
  "Открыть кабинет OpenAI": {
    "en": "Open OpenAI dashboard",
    "es": "Abrir panel de OpenAI"
  },
  "Открыть консоль Claude": {
    "en": "Open Claude console",
    "es": "Abrir consola de Claude"
  },
  "Открыть Google AI Studio": {
    "en": "Open Google AI Studio",
    "es": "Abrir Google AI Studio"
  },
  "Открыть OpenRouter": {
    "en": "Open OpenRouter",
    "es": "Abrir OpenRouter"
  },
  "Открыть DeepSeek": {
    "en": "Open DeepSeek",
    "es": "Abrir DeepSeek"
  },
  "Открыть Groq Console": {
    "en": "Open Groq Console",
    "es": "Abrir consola de Groq"
  },
  "Скачать Ollama": {
    "en": "Download Ollama",
    "es": "Descargar Ollama"
  },
  "Скрыть": {
    "en": "Hide",
    "es": "Ocultar"
  },
  "Показать": {
    "en": "Show",
    "es": "Mostrar"
  },
  "Изображения": {
    "en": "Images",
    "es": "Imágenes"
  },
  "Выделите область мышью · Esc — отмена": {
    "en": "Select an area with the mouse · Esc cancels",
    "es": "Selecciona un área con el ratón · Esc cancela"
  },
  "Окно приложения недоступно": {
    "en": "Application window unavailable",
    "es": "La ventana de la aplicación no está disponible"
  },
  "Установите Codex CLI и войдите в свой аккаунт ChatGPT. Затем проверьте соединение; модель можно оставить пустой.": {
    "en": "Install Codex CLI and sign in to ChatGPT. Then test the connection; the model can be left blank.",
    "es": "Instala Codex CLI e inicia sesión en ChatGPT. Después prueba la conexión; puedes dejar el modelo vacío."
  },
  "Создайте API-ключ в кабинете OpenAI, вставьте его ниже и выберите модель. Доступ к API и его оплата могут отличаться от подписки ChatGPT.": {
    "en": "Create an API key in the OpenAI dashboard, paste it below and choose a model. API access and billing may differ from ChatGPT.",
    "es": "Crea una clave API en OpenAI, pégala abajo y elige un modelo. El acceso y la facturación de la API pueden diferir de ChatGPT."
  },
  "Создайте API-ключ Claude в консоли Anthropic, вставьте его ниже и выберите модель. Доступ и оплата API настраиваются в консоли.": {
    "en": "Create a Claude API key in the Anthropic console, paste it below and select a model. API access and billing are configured there.",
    "es": "Crea una clave API de Claude en Anthropic, pégala abajo y elige un modelo. El acceso y la facturación se configuran allí."
  },
  "Создайте ключ Gemini API в Google AI Studio, вставьте его ниже и выберите модель. Доступ и лимиты зависят от проекта.": {
    "en": "Create a Gemini API key in Google AI Studio, paste it below and choose a model. Access and limits depend on the project.",
    "es": "Crea una clave de Gemini API en Google AI Studio, pégala abajo y elige un modelo. El acceso y los límites dependen del proyecto."
  },
  "Создайте ключ OpenRouter, вставьте его и укажите модель в формате provider/model. Проверьте баланс и доступ модели.": {
    "en": "Create an OpenRouter key and enter a model as provider/model. Check your balance and model access.",
    "es": "Crea una clave de OpenRouter e indica el modelo como provider/model. Comprueba el saldo y el acceso."
  },
  "Создайте ключ в DeepSeek Platform, вставьте его и выберите доступную модель. Проверьте баланс API.": {
    "en": "Create a key in DeepSeek Platform, paste it and choose an available model. Check your API balance.",
    "es": "Crea una clave en DeepSeek Platform, pégala y elige un modelo disponible. Comprueba el saldo de la API."
  },
  "Создайте ключ в Groq Console, вставьте его и выберите модель, доступную вашему аккаунту.": {
    "en": "Create a Groq Console key, paste it and choose a model available to your account.",
    "es": "Crea una clave en Groq Console, pégala y elige un modelo disponible para tu cuenta."
  },
  "Установите и запустите Ollama, скачайте в ней модель и укажите её имя ниже. Ключ для стандартной локальной установки не нужен.": {
    "en": "Install and run Ollama, download a model and enter its name below. A standard local installation needs no key.",
    "es": "Instala y ejecuta Ollama, descarga un modelo e indica su nombre abajo. La instalación local estándar no necesita clave."
  },
  "Укажите базовый адрес сервера, совместимого с OpenAI Chat Completions, и точное имя модели. Если сервис требует ключ, вставьте его ниже.": {
    "en": "Enter the base URL of an OpenAI Chat Completions-compatible server and the exact model name. Add a key if required.",
    "es": "Indica la URL base de un servidor compatible con OpenAI Chat Completions y el nombre exacto del modelo. Añade una clave si es necesaria."
  },
  "Tiny · быстрая": {
    "en": "Tiny · fast",
    "es": "Tiny · rápido"
  },
  "Base · сбалансированная": {
    "en": "Base · balanced",
    "es": "Base · equilibrado"
  },
  "Small · точнее": {
    "en": "Small · more accurate",
    "es": "Small · más preciso"
  },
  "Tiny · английский": {
    "en": "Tiny · English",
    "es": "Tiny · inglés"
  },
  "Base · английский": {
    "en": "Base · English",
    "es": "Base · inglés"
  },
  "Small · английский": {
    "en": "Small · English",
    "es": "Small · inglés"
  },
  "Small Q5 · компактная": {
    "en": "Small Q5 · compact",
    "es": "Small Q5 · compacto"
  },
  "Small Q5 · английский": {
    "en": "Small Q5 · English",
    "es": "Small Q5 · inglés"
  },
  "Medium Q5 · английский": {
    "en": "Medium Q5 · English",
    "es": "Medium Q5 · inglés"
  },
  "Large v3 Turbo Q5 · многоязычная": {
    "en": "Large v3 Turbo Q5 · multilingual",
    "es": "Large v3 Turbo Q5 · multilingüe"
  },
  "Модель проверена и выбрана.": {
    "en": "Model verified and selected.",
    "es": "Modelo verificado y seleccionado."
  },
  "Модель удалена. Остальные модели и движок сохранены.": {
    "en": "Model deleted. Other models and the engine remain installed.",
    "es": "Modelo eliminado. Los demás modelos y el motor siguen instalados."
  },
  "Модель скачана и применена. Локальное распознавание готово к использованию.": {
    "en": "Model downloaded and applied. Local transcription is ready.",
    "es": "Modelo descargado y aplicado. La transcripción local está lista."
  },
  "Настройки сохранены и будут использоваться во встречах и интервью.": {
    "en": "Settings saved for meetings and interviews.",
    "es": "Ajustes guardados para reuniones y entrevistas."
  },
  "Ключ сохранён; Deepgram подтвердил авторизацию. Доступность модели и баланс проверяются при распознавании.": {
    "en": "Key saved; Deepgram confirmed authorization. Model access and balance are checked during transcription.",
    "es": "Clave guardada; Deepgram confirmó la autorización. El acceso al modelo y el saldo se comprueban al transcribir."
  },
  "Эта модель поддерживает только английский. Выберите английский язык или многоязычную модель.": {
    "en": "This model supports English only. Choose English or a multilingual model.",
    "es": "Este modelo solo admite inglés. Elige inglés o un modelo multilingüe."
  },
  "Сервис вернул пустой ответ.": {
    "en": "The service returned an empty response.",
    "es": "El servicio devolvió una respuesta vacía."
  },
  "Базовый адрес без /chat/completions, например https://example.com/v1": {
    "en": "Base URL without /chat/completions, for example https://example.com/v1",
    "es": "URL base sin /chat/completions, por ejemplo https://example.com/v1"
  },
  "Не удалось извлечь текст. Если PDF состоит из изображений, вставьте текст вручную.": {
    "en": "Could not extract text. If the PDF contains images, paste the text manually.",
    "es": "No se pudo extraer el texto. Si el PDF contiene imágenes, pega el texto manualmente."
  },
  "Сочетание сохранено и применено.": {
    "en": "Shortcut saved and applied.",
    "es": "Atajo guardado y aplicado."
  },
  "Изменение отменено.": {
    "en": "Change canceled.",
    "es": "Cambio cancelado."
  },
  "Используйте Ctrl, Alt или Win вместе с другой клавишей.": {
    "en": "Use Ctrl, Alt or Win with another key.",
    "es": "Usa Ctrl, Alt o Win junto con otra tecla."
  },
  "Сочетание занято другим приложением. Выберите другое.": {
    "en": "This shortcut is used by another app. Choose another.",
    "es": "Otra aplicación usa este atajo. Elige otro."
  },
  "Не удалось назначить сочетание.": {
    "en": "Could not assign shortcut.",
    "es": "No se pudo asignar el atajo."
  },
  "Анализирую…": {
    "en": "Analyzing…",
    "es": "Analizando…"
  },
  "Адаптирую…": {
    "en": "Tailoring…",
    "es": "Adaptando…"
  },
  "Адаптировать резюме": {
    "en": "Tailor resume",
    "es": "Adaptar currículum"
  },
  "Модель оценивает резюме под ATS-фильтры вакансии…": {
    "en": "The model is checking the resume against the job's ATS criteria…",
    "es": "El modelo analiza el currículum según los criterios ATS de la oferta…"
  },
  "Модель переписывает резюме под вакансию…": {
    "en": "The model is tailoring the resume to the job…",
    "es": "El modelo adapta el currículum a la oferta…"
  },
  "Сначала загрузите или вставьте резюме.": {
    "en": "Upload or paste a resume first.",
    "es": "Primero sube o pega un currículum."
  },
  "Вставьте текст вакансии.": {
    "en": "Paste the job description.",
    "es": "Pega la descripción de la oferta."
  },
  "Не удалось извлечь текст из файла. Вставьте резюме вручную.": {
    "en": "Could not extract text from the file. Paste your resume manually.",
    "es": "No se pudo extraer el texto del archivo. Pega el currículum manualmente."
  },
  "Распознавание речи": {
    "en": "Speech recognition",
    "es": "Reconocimiento de voz"
  },
  "Начать": {
    "en": "Start",
    "es": "Iniciar"
  },
  "Остановить": {
    "en": "Stop",
    "es": "Detener"
  },
  "Слушаю системный звук": {
    "en": "Listening to system audio",
    "es": "Escuchando el audio del sistema"
  },
  "Системный звук": {
    "en": "System audio",
    "es": "Audio del sistema"
  },
  "Копировать": {
    "en": "Copy",
    "es": "Copiar"
  },
  "Скопировано": {
    "en": "Copied",
    "es": "Copiado"
  },
  "Свой сервер (OpenAI-совместимый)": {
    "en": "Custom server (OpenAI-compatible)",
    "es": "Servidor propio (compatible con OpenAI)"
  },
  "Ollama (локально)": {
    "en": "Ollama (local)",
    "es": "Ollama (local)"
  },
  "OpenAI-совместимый": {
    "en": "OpenAI-compatible",
    "es": "Compatible con OpenAI"
  },
  "Анализ ATS": {
    "en": "ATS analysis",
    "es": "Análisis ATS"
  },
  "Сохранить как Markdown": {
    "en": "Save as Markdown",
    "es": "Guardar como Markdown"
  },
  "Сохранить резюме": {
    "en": "Save resume",
    "es": "Guardar currículum"
  },
  "Сохранить резюме как PDF": {
    "en": "Save resume as PDF",
    "es": "Guardar currículum como PDF"
  },
  "Снимок прикреплён. Дождитесь ответа и отправьте его кнопкой.": {
    "en": "Screenshot attached. Wait for the answer, then send it using the button.",
    "es": "Captura adjuntada. Espera la respuesta y envíala con el botón."
  },
  "Выделите область мышью или нажмите Esc для отмены.": {
    "en": "Select an area with the mouse or press Esc to cancel.",
    "es": "Selecciona un área con el ratón o pulsa Esc para cancelar."
  },
  "Не удалось подготовить изображение.": {
    "en": "Could not prepare the image.",
    "es": "No se pudo preparar la imagen."
  },
  "Микрофон не записал звук. Проверьте доступ к микрофону в Windows.": {
    "en": "The microphone recorded no sound. Check microphone access in Windows.",
    "es": "El micrófono no grabó sonido. Comprueba el acceso al micrófono en Windows."
  },
  "Запись была прервана из-за ошибки устройства; проверьте обе дорожки.": {
    "en": "Recording was interrupted by a device error; check both tracks.",
    "es": "La grabación se interrumpió por un error del dispositivo; comprueba ambas pistas."
  },
  "Ошибка записи аудио.": {
    "en": "Audio recording error.",
    "es": "Error al grabar el audio."
  },
  "Одна из дорожек записи пуста. Проверьте источники звука.": {
    "en": "One audio track is empty. Check the audio sources.",
    "es": "Una de las pistas está vacía. Comprueba las fuentes de audio."
  },
  "Аудиозапись уже используется. Остановите прослушивание в скрытом помощнике и попробуйте снова.": {
    "en": "Audio capture is already in use. Stop listening in the floating assistant and try again.",
    "es": "La captura de audio ya está en uso. Detén la escucha en el asistente flotante y vuelve a intentarlo."
  },
  "Нет модели": {
    "en": "No model",
    "es": "Sin modelo"
  },
  "Скопировать": {
    "en": "Copy",
    "es": "Copiar"
  },
  "Адаптация": {
    "en": "Tailoring",
    "es": "Adaptación"
  },
  "Загрузить модели": { "en": "Load models", "es": "Cargar modelos" },
  "Модели загружены": { "en": "Models loaded", "es": "Modelos cargados" },
  "Выбрать загруженную модель": { "en": "Select a loaded model", "es": "Seleccionar un modelo cargado" },
  "Выберите модель из списка": { "en": "Select a model from the list", "es": "Selecciona un modelo de la lista" },
  "Не удалось загрузить модели": { "en": "Could not load models", "es": "No se pudieron cargar los modelos" },
  "Список не гарантирует доступ к модели; проверьте подключение после выбора.": { "en": "The list does not guarantee model access; test the connection after selecting one.", "es": "La lista no garantiza el acceso al modelo; comprueba la conexión tras seleccionarlo." },
  "Провайдер не вернул модели. Можно указать название вручную.": { "en": "The provider returned no models. You can enter a model manually.", "es": "El proveedor no devolvió modelos. Puedes introducir uno manualmente." },
  "МиБ": {
    "en": "MiB",
    "es": "MiB"
  },
  "• Ключи сохраняются в локальном JSON без шифрования. Не храните чужие ключи и не демонстрируйте экран настроек при трансляции.": {
    "en": "• Keys are saved in a local JSON file without encryption. Do not share keys or display settings during screen sharing.",
    "es": "• Las claves se guardan en un archivo JSON local sin cifrar. No compartas claves ni muestres ajustes al compartir pantalla."
  }
};

export function tr(text: string): string {
  const language = useSettings.getState().settings.uiLanguage;
  return language === "en" || language === "es" ? translations[text]?.[language] ?? text : text;
}
