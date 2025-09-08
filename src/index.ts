import {createBot} from './bot.js';
import express from "express";

async function main() {
    const bot = createBot();
    const app = express();

    app.listen(3000, () => console.log('express started on port 3000'));
    console.log('Bot started.');
    await bot.launch();

    process.once('SIGINT', () => {
        console.log('SIGINT received, stopping bot...');
        bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
        console.log('SIGTERM received, stopping bot...');
        bot.stop('SIGTERM');
    });
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
