import { Telegraf } from 'telegraf';

// --- CONFIGURATION ---
const CONFIG = {
    BOT_TOKEN: "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk",
    CLOUD_NAME: "dneusgyzc",
    API_KEY: "554734628665841",
    API_SECRET: "ZmDXv6UketNHdwE-prYTesesZ7I"
};

/**
 * SHA-1 Signer for Cloudinary REST API
 */
async function generateSignature(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    const signatureString = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join("&") + secret;

    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export default {
    async fetch(request) {
        const bot = new Telegraf(CONFIG.BOT_TOKEN);

        bot.start((ctx) => ctx.reply("🔱 CHILDREN'S PROVIENCE ID SYSTEM\n\nSend a photo to generate your Data Card (Text Only Mode)."));

        bot.on(['photo', 'document'], async (ctx) => {
            let status;
            try {
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                if (!fileId) return;

                status = await ctx.reply("⚙️ Stage 1/2: Saving Background...");

                // 1. Get Telegram File Link
                const file = await ctx.telegram.getFile(fileId);
                const tgUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${file.file_path}`;

                // 2. Upload to Cloudinary (Permanent)
                const timestamp = Math.round(new Date().getTime() / 1000);
                const publicId = `id_text_${ctx.from.id}_${timestamp}`;
                const signature = await generateSignature({ public_id: publicId, timestamp: timestamp }, CONFIG.API_SECRET);

                const formData = new FormData();
                formData.append("file", tgUrl);
                formData.append("api_key", CONFIG.API_KEY);
                formData.append("timestamp", timestamp);
                formData.append("public_id", publicId);
                formData.append("signature", signature);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUD_NAME}/image/upload`, {
                    method: "POST", body: formData
                });

                const uploadData = await uploadRes.json();
                if (!uploadData.public_id) throw new Error("Cloudinary Storage Failed");

                // 3. Stage 2: Drawing Text Layers
                await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, "🎨 Stage 2/2: Drawing Data...");

                const userId = ctx.from.id;
                const name = (ctx.from.first_name || "AGENT").toUpperCase();
                const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                /**
                 * Transformation Logic:
                 * - Brightness -40 for readability
                 * - Org Name at the Top
                 * - User ID on the Left
                 * - 12-Digit Code at the Bottom Right
                 */
                const layers = [
                    `w_1280,h_720,c_fill,e_brightness:-40`,
                    `l_text:Arial_45_bold:CHILDRENS%20PROVIENCE,g_north,y_60,co_white`,
                    `l_text:Arial_40_bold:UID:%20${userId},g_west,x_120,y_0,co_rgb:38bdf8`,
                    `l_text:Arial_50_bold:NAME:%20${encodeURIComponent(name)},g_west,x_120,y_70,co_white`,
                    `l_text:Courier_60_bold:${encodeURIComponent(code)},g_south_east,x_100,y_80,co_white`
                ];

                const finalUrl = `https://res.cloudinary.com/${CONFIG.CLOUD_NAME}/image/upload/${layers.join('/')}/${uploadData.public_id}.jpg`;

                // 4. Final Delivery
                await ctx.replyWithPhoto(finalUrl, { 
                    caption: `✅ <b>Card Generated</b>\nUser: ${ctx.from.first_name}\nStatus: Active`, 
                    parse_mode: 'HTML' 
                });

                await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                const errMsg = `❌ <b>System Error</b>\n<code>${err.message}</code>`;
                if (status) await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, errMsg, { parse_mode: 'HTML' });
                else await ctx.replyWithHTML(errMsg);
            }
        });

        // --- HANDLER ---
        const url = new URL(request.url);
        if (url.pathname === "/webhook" && request.method === "POST") {
            const body = await request.json();
            await bot.handleUpdate(body);
            return new Response("OK");
        }
        
        if (url.pathname === "/setup") {
            const webhookUrl = `${url.protocol}//${url.host}/webhook`;
            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            return new Response("Webhook Synced");
        }
        return new Response("ID Engine Active");
    }
};
