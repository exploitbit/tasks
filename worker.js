const { Telegraf } = require('telegraf');

// --- CONFIGURATION ---
const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";
const CLOUD_NAME = "dneusgyzc";

const bot = new Telegraf(BOT_TOKEN);

// Helper: Base64 for Cloudinary layers
const b64 = (str) => Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

bot.command('start', (ctx) => {
    ctx.replyWithHTML("🛠 <b>Diagnostic Mode Active</b>\n\nPlease send an image. If it fails, I will send the <b>Full Error</b> here.");
});

bot.on(['photo', 'document'], async (ctx) => {
    let status;
    try {
        const fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message.document?.file_id;
        
        if (!fileId) {
            return ctx.reply("❌ No valid file ID found in that message.");
        }

        status = await ctx.reply("⚙️ <b>Processing...</b>", { parse_mode: 'HTML' });

        // 1. Get Telegram File Link
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const bgUrl = fileLink.href;

        // 2. Get Profile Pic
        const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
        let pfpUrl = "https://res.cloudinary.com/demo/image/upload/d_avatar.png/v1/avatar.png";
        if (pfpData.total_count > 0) {
            const pfpLink = await ctx.telegram.getFileLink(pfpData.photos[0][0].file_id);
            pfpUrl = pfpLink.href;
        }

        // 3. Details
        const name = (ctx.from.first_name || "MEMBER").toUpperCase();
        const username = ctx.from.username ? `@${ctx.from.username}` : "CLASSIFIED";
        const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

        // 4. Build Cloudinary URL
        const encodedPfp = b64(pfpUrl);
        
        // Using "encodeURIComponent" for the final URL to prevent 404s on weird usernames
        const layers = [
            `w_1280,h_720,c_fill,e_brightness:-30`,
            `l_text:Arial_45_bold_letter_spacing_6:CHILDRENS%20PROVIENCE/co_white,g_north,y_60/fl_layer_apply`,
            `l_fetch:${encodedPfp}/w_240,h_240,c_fill,r_max,bo_10px_solid_white/g_west,x_120,y_30/fl_layer_apply`,
            `l_text:Arial_55_bold:${encodeURIComponent(name)}/co_white,g_west,x_420,y_20/fl_layer_apply`,
            `l_text:Arial_35:${encodeURIComponent(username)}/co_rgb:38bdf8,g_west,x_420,y_90/fl_layer_apply`,
            `l_text:Courier_30_bold:UID:%20${ctx.from.id}/co_rgb:94a3b8,g_south_west,x_120,y_80/fl_layer_apply`,
            `l_text:Courier_60_bold:${encodeURIComponent(code)}/co_white,g_south_east,x_100,y_80/fl_layer_apply`
        ];

        const finalUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${layers.join('/')}/${bgUrl}`;

        // 5. Send Photo
        await ctx.replyWithPhoto(finalUrl, {
            caption: `✅ <b>Success!</b>\nUser: ${name}`,
            parse_mode: 'HTML'
        });

        if (status) await ctx.deleteMessage(status.message_id);

    } catch (err) {
        // --- THIS PART SENDS THE ACTUAL ERROR TO YOUR BOT ---
        console.error("CRASH REPORT:", err);
        
        const errorMessage = `
❌ <b>CRASH DETECTED</b>

<b>Error Name:</b> <code>${err.name}</code>
<b>Error Message:</b> <code>${err.message}</code>

<b>Possible Reason:</b>
${err.message.includes('403') ? 'Cloudinary is blocking the Telegram URL.' : ''}
${err.message.includes('404') ? 'Background image not found or URL malformed.' : ''}
${err.message.includes('414') ? 'The generated URL is too long for the server.' : 'Unknown internal error.'}
        `;

        await ctx.replyWithHTML(errorMessage);
        if (status) await ctx.deleteMessage(status.message_id).catch(() => {});
    }
});

bot.launch().catch(err => console.error("Bot launch failed:", err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
