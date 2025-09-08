import WebTorrent from 'webtorrent';
import { dir as tmpDir, DirectoryResult } from 'tmp-promise';

export type DownloadResult = {
    downloadDir: DirectoryResult;
    torrentName: string;
    filesCount: number;
};

export class TorrentService {
    async downloadFromBuffer(
        torrentBuf: Buffer,
        opts: {
            timeoutMs: number;
            onProgress?: (percent: number) => void;
        }
    ): Promise<DownloadResult> {
        const downloadDir = await tmpDir({ unsafeCleanup: true, prefix: 'torrent-dl-' });

        const client = new WebTorrent();
        let finished = false;

        const timeout = setTimeout(() => {
            if (!finished) client.destroy();
        }, opts.timeoutMs);

        const torrent = client.add(torrentBuf, { path: downloadDir.path });

        let lastPct = -1;
        if (opts.onProgress) {
            torrent.on('download', () => {
                const pct = Math.floor(torrent.progress * 100);
                if (pct >= lastPct + 10) {
                    lastPct = pct;
                    opts.onProgress!(pct);
                }
            });
        }

        await new Promise<void>((resolve, reject) => {
            torrent.on('done', () => {
                finished = true;
                clearTimeout(timeout);
                resolve();
            });
            torrent.on('error', (e) => {
                clearTimeout(timeout);
                console.log(e)
                reject(e);
            });
        });

        await new Promise<void>((resolve) => client.destroy(() => resolve()));

        return {
            downloadDir,
            torrentName: torrent.name,
            filesCount: torrent.files.length,
        };
    }
}
