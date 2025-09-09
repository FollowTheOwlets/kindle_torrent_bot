/**
 * Статус файла для отрисовки прогресса.
 */
export type FileStatus = {
    relPath: string;
    state: 'queued' | 'downloading' | 'done' | 'error';
    /** Прогресс 0..100 (округлённый) */
    pct?: number;
};

const ICON = {
    queued: '🟡',
    downloading: '⬇️',
    done: '✅',
    error: '❌',
};

/** Лоадбар из эмодзи: 🟩 / ⬜️ */
function bar(pct: number, width = 10): string {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    const filled = Math.round((p / 100) * width);
    return '【' + '🟩'.repeat(filled) + '⬜️'.repeat(width - filled) + `】${String(p).padStart(3)}%`;
}

/** Обрезает имя, добавляет многоточие. */
function truncate(s: string, maxLen: number): string {
    if (s.length <= maxLen) return s;
    return s.slice(0, Math.max(0, maxLen - 1)) + '…';
}

/**
 * Сформировать текст статусного сообщения с таблицей и лоадбарами.
 */
export function renderEmojiTable(
    title: string,
    items: FileStatus[],
    opts?: { maxLines?: number; maxNameLen?: number; barWidth?: number }
): string {
    const maxLines = opts?.maxLines ?? 25;
    const maxNameLen = opts?.maxNameLen ?? 60;
    const barWidth = opts?.barWidth ?? 10;

    const total = items.length;
    const done = items.filter(i => i.state === 'done').length;
    const downloading = items.filter(i => i.state === 'downloading').length;

    const header = `${title}\n${ICON.done} ${done}/${total} • ${ICON.downloading} ${downloading} • ${ICON.queued} ${total - done - downloading}\n`;

    const lines: string[] = [];
    for (let i = 0; i < Math.min(items.length, maxLines); i++) {
        const it = items[i];
        const name = truncate(it.relPath, maxNameLen);
        const br = it.pct != null ? ` ${bar(it.pct, barWidth)}` : '';
        lines.push(`${ICON[it.state]}  ${name}${br}`);
    }
    if (items.length > maxLines) {
        lines.push(`… и ещё ${items.length - maxLines} файл(ов)`);
    }

    // Страховка по длине
    const HARD = 3900;
    let text = header + lines.join('\n');
    if (text.length > HARD) {
        const tighter: string[] = [];
        for (let i = 0; i < Math.min(items.length, maxLines); i++) {
            const it = items[i];
            const name = truncate(it.relPath, 40);
            const br = it.pct != null ? ` ${bar(it.pct, 8)}` : '';
            tighter.push(`${ICON[it.state]}  ${name}${br}`);
        }
        text = header + tighter.join('\n');
        if (items.length > maxLines) text += `\n… и ещё ${items.length - maxLines} файл(ов)`;
    }
    return text;
}
