import { Telegraf } from 'telegraf';

const CONFIG = {
    BOT_TOKEN: "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk",
    CLOUD_NAME: "dneusgyzc",
    API_KEY: "554734628665841",
    API_SECRET: "ZmDXv6UketNHdwE-prYTesesZ7I"
};

async function generateSignature(params, secret) {
    const signatureString = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&") + secret;
    const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(signatureString));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default {
    async fetch(request) {
        const bot = new Telegraf(CONFIG.BOT_TOKEN);

        bot.start((ctx) => ctx.reply("Ready. Send any image and I will put your name in the center."));

        bot.on(['photo', 'document'], async (ctx) => {
            try {
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                if (!fileId) return;

                const status = await ctx.reply("✍️ Writing name...");

                // 1. Get the image from Telegram
                const file = await ctx.telegram.getFile(fileId);
                const tgUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${file.file_path}`;

                // 2. Upload to Cloudinary
                const timestamp = Math.round(Date.now() / 1000);
                const publicId = `simple_${ctx.from.id}_${timestamp}`;
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
                
                // 3. Build the simplest possible URL
                // l_text:Font_Size_Style:Text / co_Color / g_center / fl_layer_apply
                const name = encodeURIComponent((ctx.from.first_name || "User").toUpperCase());
                const finalUrl = `https://res.cloudinary.com/${CONFIG.CLOUD_NAME}/image/upload/l_text:Arial_80_bold:${name},co_white,g_center/fl_layer_apply/${uploadData.public_id}.jpg`;

                // 4. Send back
                await ctx.replyWithPhoto(finalUrl, { caption: `✅ Done, ${ctx.from.first_name}!` });
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
        return new Response("Bot is live.");
    }
};
