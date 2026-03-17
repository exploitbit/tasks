import { Telegraf } from 'telegraf';

// --- CONFIGURATION ---
const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";

/**
 * Helper: Downloads a URL and converts it to a Base64 Data URI.
 * This ensures the image is "embedded" in the ID card.
 */
async function fetchAsBase64(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return `data:image/jpeg;base64,${btoa(binary)}`;
    } catch (e) {
        return null;
    }
}

export default {
    async fetch(request) {
        const bot = new Telegraf(BOT_TOKEN);
        const url = new URL(request.url);

        // --- 1. BOT LOGIC ---
        bot.on(['photo', 'document'], async (ctx) => {
            let status;
            try {
                const userId = ctx.from.id;
                const name = (ctx.from.first_name || "AGENT").toUpperCase();
                
                status = await ctx.reply("⚙️ <b>Generating Secure ID...</b>", { parse_mode: 'HTML' });

                // Get Background from current message
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                const bgFile = await ctx.telegram.getFile(fileId);
                const bgBase64 = await fetchAsBase64(`https://api.telegram.org/file/bot${BOT_TOKEN}/${bgFile.file_path}`);

                // Get Profile Picture
                const pfpData = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
                let pfpBase64 = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                if (pfpData.total_count > 0) {
                    const pfpFile = await ctx.telegram.getFile(pfpData.photos[0][0].file_id);
                    pfpBase64 = await fetchAsBase64(`https://api.telegram.org/file/bot${BOT_TOKEN}/${pfpFile.file_path}`);
                }

                // Generate 12-digit code
                const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                // Construct SVG ID Card
                const svg = `
                <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
                    <image href="${bgBase64}" width="1280" height="720" preserveAspectRatio="xMidYMid slice" filter="brightness(0.6)" />
                    
                    <text x="640" y="80" font-family="Arial" font-size="40" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="5">CHILDRENS PROVIENCE</text>
                    
                    <circle cx="220" cy="360" r="125" fill="#38bdf8" />
                    <clipPath id="cp"><circle cx="220" cy="360" r="120" /></clipPath>
                    <image href="${pfpBase64}" x="100" y="240" width="240" height="240" clip-path="url(#cp)" preserveAspectRatio="xMidYMid slice" />

                    <text x="420" y="340" font-family="Arial" font-size="65" font-weight="bold" fill="white">${name}</text>
                    <text x="420" y="410" font-family="Courier" font-size="35" fill="#38bdf8">UID: ${userId}</text>
                    
                    <text x="1180" y="650" font-family="Courier" font-size="55" font-weight="bold" fill="white" text-anchor="end">${code}</text>
                </svg>`;

                // Send SVG as a photo (Telegram supports SVG via URL or File)
                const svgBase64 = `data:image/svg+xml;base64,${btoa(svg)}`;
                await ctx.replyWithPhoto({ url: svgBase64 }, { 
                    caption: `✅ <b>ID Card Generated</b>\nUser: ${name}`, 
                    parse_mode: 'HTML' 
                });

                await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                if (status) await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, `❌ Error: ${err.message}`);
                else await ctx.reply(`❌ Error: ${err.message}`);
            }
        });

        // --- 2. WORKER HANDLER ---
        if (url.pathname === "/webhook" && request.method === "POST") {
            await bot.handleUpdate(await request.json());
            return new Response("OK");
        }
        
        if (url.pathname === "/setup") {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${url.protocol}//${url.host}/webhook`);
            return new Response("Webhook Synced!");
        }

        return new Response("ID Engine Online.");
    }
};
