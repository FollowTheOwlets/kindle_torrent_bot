import { createBot } from './bot.js';

async function main() {
    const bot = createBot();

    await bot.launch();
    console.log('Bot started.');

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
