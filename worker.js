import { Telegraf } from 'telegraf';

export default {
    async fetch(request, env) {
        const BOT_TOKEN = env.BOT_TOKEN;
        const CLOUD_NAME = env.CLOUDINARY_CLOUD_NAME;
        const bot = new Telegraf(BOT_TOKEN);

        // Helper: Safe Base64 for Cloudflare
        const b64 = (str) => {
            const bytes = new TextEncoder().encode(str);
            const binString = String.fromCodePoint(...bytes);
            return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        };

        // --- BOT COMMANDS ---
        bot.start((ctx) => ctx.reply("🔱 CHILDREN'S PROVIENCE\n\nSend a photo to generate your ID."));

        bot.on(['photo', 'document'], async (ctx) => {
            try {
                const photo = ctx.message.photo;
                const doc = ctx.message.document;
                const fileId = photo ? photo[photo.length - 1].file_id : (doc?.mime_type?.startsWith('image/') ? doc.file_id : null);

                if (!fileId) return ctx.reply("❌ Please send a valid image.");

                const status = await ctx.reply("⚙️ Stage: Authenticating...");

                // Get Links
                const fileLink = await ctx.telegram.getFileLink(fileId);
                const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
                let pfpUrl = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                if (pfpData.total_count > 0) {
                    const pfpLink = await ctx.telegram.getFileLink(pfpData.photos[0][0].file_id);
                    pfpUrl = pfpLink.href;
                }

                // Data Card Details
                const name = (ctx.from.first_name || "AGENT").toUpperCase();
                const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                // Cloudinary URL Construction
                const layers = [
                    `w_1280,h_720,c_fill,e_brightness:-35`,
                    `l_text:Arial_42_bold_letter_spacing_5:CHILDRENS%20PROVIENCE/co_white,g_north,y_65/fl_layer_apply`,
                    `l_fetch:${b64(pfpUrl)}/w_240,h_240,c_fill,r_max,bo_10px_solid_white/g_west,x_130,y_30/fl_layer_apply`,
                    `l_text:Arial_58_bold:${encodeURIComponent(name)}/co_white,g_west,x_440,y_25/fl_layer_apply`,
                    `l_text:Courier_62_bold:${encodeURIComponent(code)}/co_white,g_south_east,x_105,y_85/fl_layer_apply`
                ];

                const finalUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${layers.join('/')}/${fileLink.href}`;

                await ctx.replyWithPhoto(finalUrl, { caption: "✅ ID Generated Successfully." });
                await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                await ctx.reply(`❌ Error: ${err.message}`);
            }
        });

        // --- FETCH HANDLER ---
        const url = new URL(request.url);
        if (url.pathname === "/webhook" && request.method === "POST") {
            const update = await request.json();
            await bot.handleUpdate(update);
            return new Response("OK");
        }
        
        if (url.pathname === "/setup") {
            const webhookUrl = `${url.protocol}//${url.host}/webhook`;
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            return new Response("Webhook set!");
        }

        return new Response("Bot is running.");
    }
};
