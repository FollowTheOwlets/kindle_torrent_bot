import * as fs from 'node:fs';
import * as path from 'node:path';

export type FileEntry = { absPath: string; relPath: string; size: number };

export async function listFilesRecursive(rootDir: string): Promise<FileEntry[]> {
    const out: FileEntry[] = [];
    async function walk(dir: string) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            const abs = path.join(dir, e.name);
            const rel = path.relative(rootDir, abs);
            if (e.isDirectory()) {
                await walk(abs);
            } else if (e.isFile()) {
                const st = await fs.promises.stat(abs);
                out.push({ absPath: abs, relPath: rel, size: st.size });
            }
        }
    }
    await walk(rootDir);
    return out;
}

/** Базовая “оценка” объёма с учётом base64 (~+33%) */
const EMAIL_OVERHEAD = 1.33;

export function chunkBySize(files: FileEntry[], maxBytes: number): FileEntry[][] {
    // Проверим, что каждый файл поместится сам по себе
    for (const f of files) {
        if (Math.ceil(f.size * EMAIL_OVERHEAD) > maxBytes) {
            throw new Error(`Файл "${f.relPath}" слишком большой для письма (>${Math.floor(maxBytes/1024/1024)} MB).`);
        }
    }

    // Жадно группируем по лимиту
    const batches: FileEntry[][] = [];
    let current: FileEntry[] = [];
    let currentSize = 0;

    for (const f of files) {
        const eff = Math.ceil(f.size * EMAIL_OVERHEAD);
        if (currentSize + eff > maxBytes && current.length > 0) {
            batches.push(current);
            current = [];
            currentSize = 0;
        }
        current.push(f);
        currentSize += eff;
    }
    if (current.length) batches.push(current);

    return batches;
}
