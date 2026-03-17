import { Telegraf } from 'telegraf';

// --- CONFIGURATION ---
const CONFIG = {
    BOT_TOKEN: "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk",
    CLOUD_NAME: "dneusgyzc",
    API_KEY: "554734628665841",
    API_SECRET: "ZmDXv6UketNHdwE-prYTesesZ7I"
};

/**
 * Manually generates a Cloudinary SHA-1 Signature
 * This replaces the broken SDK functionality.
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

        // Helper: Cloudinary-safe Base64 for layers
        const b64 = (str) => {
            const bytes = new TextEncoder().encode(str);
            const binString = String.fromCodePoint(...bytes);
            return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        };

        bot.start((ctx) => ctx.reply("🔱 System Online. Send an image to PERMANENTLY save it and generate your ID."));

        bot.on(['photo', 'document'], async (ctx) => {
            let status;
            try {
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                if (!fileId) return;

                status = await ctx.reply("⚙️ Stage 1/2: Saving to Cloud Library...");

                // 1. Get Telegram File
                const file = await ctx.telegram.getFile(fileId);
                const tgUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${file.file_path}`;

                // 2. Upload to Cloudinary via REST API (Permanent Save)
                const timestamp = Math.round(new Date().getTime() / 1000);
                const publicId = `id_bg_${ctx.from.id}_${timestamp}`;
                
                const params = {
                    public_id: publicId,
                    timestamp: timestamp
                };

                const signature = await generateSignature(params, CONFIG.API_SECRET);

                const formData = new FormData();
                formData.append("file", tgUrl);
                formData.append("api_key", CONFIG.API_KEY);
                formData.append("timestamp", timestamp);
                formData.append("public_id", publicId);
                formData.append("signature", signature);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUD_NAME}/image/upload`, {
                    method: "POST",
                    body: formData
                });

                const uploadData = await uploadRes.json();
                if (!uploadData.public_id) throw new Error(uploadData.error?.message || "Cloudinary Upload Failed");

                // 3. Update Status
                await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, "🎨 Stage 2/2: Drawing Graphics...");

                // 4. Get Profile Pic
                const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
                let pfpUrl = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                if (pfpData.total_count > 0) {
                    const pfpFile = await ctx.telegram.getFile(pfpData.photos[0][0].file_id);
                    pfpUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${pfpFile.file_path}`;
                }

                // 5. Build ID Design
                const name = (ctx.from.first_name || "AGENT").toUpperCase();
                const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                const layers = [
                    `w_1280,h_720,c_fill,e_brightness:-40`,
                    `l_text:Arial_45_bold_letter_spacing_6:CHILDRENS%20PROVIENCE/co_white,g_north,y_60/fl_layer_apply`,
                    `l_fetch:${b64(pfpUrl)}/w_240,h_240,c_fill,r_max,bo_10px_solid_white/g_west,x_120,y_30/fl_layer_apply`,
                    `l_text:Arial_55_bold:${encodeURIComponent(name)}/co_white,g_west,x_420,y_20/fl_layer_apply`,
                    `l_text:Courier_60_bold:${encodeURIComponent(code)}/co_white,g_south_east,x_100,y_80/fl_layer_apply`
                ];

                const finalUrl = `https://res.cloudinary.com/${CONFIG.CLOUD_NAME}/image/upload/${layers.join('/')}/${uploadData.public_id}.jpg`;

                // 6. Send Result
                await ctx.replyWithPhoto(finalUrl, { 
                    caption: `✅ <b>Card Generated Successfully</b>\n\nBackground stored in Cloudinary folder.`,
                    parse_mode: 'HTML'
                });

                await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                console.error(err);
                const errorDisplay = `❌ <b>System Error</b>\n<code>${err.message}</code>`;
                if (status) {
                    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, errorDisplay, { parse_mode: 'HTML' });
                } else {
                    await ctx.replyWithHTML(errorDisplay);
                }
            }
        });

        // --- HANDLER ---
        const url = new URL(request.url);
        if (url.pathname === "/webhook" && request.method === "POST") {
            const update = await request.json();
            await bot.handleUpdate(update);
            return new Response("OK");
        }
        
        if (url.pathname === "/setup") {
            const webhookUrl = `${url.protocol}//${url.host}/webhook`;
            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            return new Response("Webhook set!");
        }

        return new Response("Children's Provience: Status Active");
    }
};
