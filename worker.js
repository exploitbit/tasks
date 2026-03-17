import { Telegraf } from 'telegraf';

// --- CONFIGURATION ---
const CONFIG = {
    BOT_TOKEN: "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk",
    CLOUD_NAME: "dneusgyzc",
    API_KEY: "554734628665841",
    API_SECRET: "ZmDXv6UketNHdwE-prYTesesZ7I"
};

// Helper: URL-Safe Base64 Encoding
const safeB64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    const binString = String.fromCodePoint(...bytes);
    return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

// Helper: SHA-1 Signer for Cloudinary REST API
async function generateSignature(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    const signatureString = sortedKeys.map(k => `${k}=${params[k]}`).join("&") + secret;
    const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(signatureString));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default {
    async fetch(request) {
        const bot = new Telegraf(CONFIG.BOT_TOKEN);

        bot.start((ctx) => ctx.reply("🖼 Send an image. I will overlay your profile picture on top of it."));

        bot.on(['photo', 'document'], async (ctx) => {
            let status;
            try {
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                if (!fileId) return;

                status = await ctx.reply("⚙️ Processing ID Card...");

                // 1. Get Background from Telegram
                const bgFile = await ctx.telegram.getFile(fileId);
                const bgUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${bgFile.file_path}`;

                // 2. Upload Background to Cloudinary (Required for stable overlays)
                const timestamp = Math.round(Date.now() / 1000);
                const publicId = `bg_${ctx.from.id}_${timestamp}`;
                const signature = await generateSignature({ public_id: publicId, timestamp: timestamp }, CONFIG.API_SECRET);

                const formData = new FormData();
                formData.append("file", bgUrl);
                formData.append("api_key", CONFIG.API_KEY);
                formData.append("timestamp", timestamp);
                formData.append("public_id", publicId);
                formData.append("signature", signature);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUD_NAME}/image/upload`, {
                    method: "POST", body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadData.public_id) throw new Error("Background upload failed");

                // 3. Get Profile Picture
                const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
                let pfpUrl = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                if (pfpData.total_count > 0) {
                    const pfpFile = await ctx.telegram.getFile(pfpData.photos[0][0].file_id);
                    pfpUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${pfpFile.file_path}`;
                }

                // 4. Construct the Overlay URL
                // Logic: l_fetch:[EncodedURL] / [Dimensions] / fl_layer_apply, [Gravity/Position]
                const encodedPfp = safeB64(pfpUrl);
                const layers = [
                    `w_1280,h_720,c_fill,e_brightness:-20`, // Scale BG and dim slightly
                    `l_fetch:${encodedPfp}/w_300,h_300,c_fill,r_max,bo_10px_solid_white/fl_layer_apply,g_west,x_100` // Circular PFP on the left
                ];

                const finalUrl = `https://res.cloudinary.com/${CONFIG.CLOUD_NAME}/image/upload/${layers.join('/')}/${uploadData.public_id}.jpg`;

                // 5. Send back to Telegram
                await ctx.replyWithPhoto(finalUrl, { caption: "✅ Profile Picture Overlay Complete." });
                await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                await ctx.reply(`❌ Error: ${err.message}`);
            }
        });

        const url = new URL(request.url);
        if (url.pathname === "/webhook" && request.method === "POST") {
            await bot.handleUpdate(await request.json());
            return new Response("OK");
        }
        if (url.pathname === "/setup") {
            const webhookUrl = `${url.protocol}//${url.host}/webhook`;
            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            return new Response("Webhook set!");
        }
        return new Response("Bot is active.");
    }
};
