import { Telegraf } from 'telegraf';
import { v2 as cloudinary } from 'cloudinary';

const CONFIG = {
    BOT_TOKEN: "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk",
    CLOUD_NAME: "dneusgyzc",
    API_KEY: "554734628665841",
    API_SECRET: "ZmDXv6UketNHdwE-prYTesesZ7I"
};

// Configure Cloudinary once
cloudinary.config({
    cloud_name: CONFIG.CLOUD_NAME,
    api_key: CONFIG.API_KEY,
    api_secret: CONFIG.API_SECRET,
    secure: true
});

export default {
    async fetch(request) {
        const bot = new Telegraf(CONFIG.BOT_TOKEN);

        // Helper: Base64 for Cloudinary layers
        const b64 = (str) => {
            return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        };

        bot.start((ctx) => ctx.reply("🔱 Welcome. Send an image to permanently save it and generate your ID."));

        bot.on(['photo', 'document'], async (ctx) => {
            let status;
            try {
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                if (!fileId) return;

                status = await ctx.reply("☁️ Saving to Cloud Library (Official SDK)...");

                // 1. Get the file URL from Telegram
                const fileLink = await ctx.telegram.getFileLink(fileId);
                
                // 2. Upload directly to Cloudinary using the SDK
                // This "Saves" it and gives us a clean Public ID
                const uploadResult = await cloudinary.uploader.upload(fileLink.href, {
                    folder: "telegram_ids",
                    public_id: `user_${ctx.from.id}_${Date.now()}`
                });

                // 3. Get Profile Pic
                const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
                let pfpUrl = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                if (pfpData.total_count > 0) {
                    const pfpLink = await ctx.telegram.getFileLink(pfpData.photos[0][0].file_id);
                    pfpUrl = pfpLink.href;
                }

                // 4. Build ID Card Design
                const name = (ctx.from.first_name || "MEMBER").toUpperCase();
                const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                const layers = [
                    { width: 1280, height: 720, crop: "fill", effect: "brightness:-40" },
                    { overlay: { font_family: "Arial", font_size: 45, font_weight: "bold", text: "CHILDRENS PROVIENCE", letter_spacing: 6 }, color: "white", gravity: "north", y: 60 },
                    { overlay: { url: pfpUrl }, width: 240, height: 240, crop: "fill", radius: "max", border: "10px_solid_white", gravity: "west", x: 120, y: 30 },
                    { overlay: { font_family: "Arial", font_size: 55, font_weight: "bold", text: name }, color: "white", gravity: "west", x: 420, y: 20 },
                    { overlay: { font_family: "Courier", font_size: 60, font_weight: "bold", text: code }, color: "white", gravity: "south_east", x: 100, y: 80 }
                ];

                // Generate the final clean URL using the SDK
                const finalUrl = cloudinary.url(uploadResult.public_id, {
                    transformation: layers,
                    secure: true
                });

                // 5. Send to Telegram
                await ctx.replyWithPhoto(finalUrl, { 
                    caption: "✅ <b>ID CARD GENERATED</b>\nSaved to Cloudinary Media Library.",
                    parse_mode: "HTML"
                });

                if (status) await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                console.error(err);
                await ctx.reply(`❌ <b>SDK Error:</b>\n<code>${err.message}</code>`, { parse_mode: 'HTML' });
            }
        });

        // HANDLER
        const url = new URL(request.url);
        if (url.pathname === "/webhook" && request.method === "POST") {
            const body = await request.json();
            await bot.handleUpdate(body);
            return new Response("OK");
        }
        
        if (url.pathname === "/setup") {
            const webhookUrl = `${url.protocol}//${url.host}/webhook`;
            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            return new Response("Webhook set!");
        }

        return new Response("Cloudinary SDK Bot: Online");
    }
};
