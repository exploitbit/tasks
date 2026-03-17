/**
 * CHILDREN'S PROVIENCE - ELITE ID GENERATOR
 * Environment: Cloudflare Workers
 * Mode: Diagnostic & Detailed
 */

import { Telegraf } from 'telegraf';

// ---------------------------------------------------------
// 🛠 CONFIGURATION & UTILITIES
// ---------------------------------------------------------
const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";
const CLOUD_NAME = "dneusgyzc";

// Helper for Cloudinary Layer Encoding
const b64 = (str) => {
    try {
        const buffer = Buffer.from(str, 'utf-8');
        return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (e) {
        console.error("Encoding Error:", e);
        return "";
    }
};

// ---------------------------------------------------------
// 🧠 CORE BOT LOGIC
// ---------------------------------------------------------
const bot = new Telegraf(BOT_TOKEN);

// Handshake / Start Command
bot.start(async (ctx) => {
    console.log(`User ${ctx.from.id} started the bot.`);
    const welcomeText = `
🔱 <b>CHILDREN'S PROVIENCE SYSTEM</b> 🔱

Status: <code>Connected</code>
Engine: <code>Cloudflare-V8-2026</code>

I am ready to generate your high-resolution Data Card. 
<b>Please send me a photo to use as the background.</b>

<i>Diagnostic mode is active. All errors will be reported in real-time.</i>
    `;
    return ctx.replyWithHTML(welcomeText);
});

// Image / File Handler
bot.on(['photo', 'document'], async (ctx) => {
    let processMsg;
    
    try {
        console.log("Input detected. Analyzing file type...");
        
        // 1. Validate Input
        const photo = ctx.message.photo;
        const doc = ctx.message.document;
        let fileId;

        if (photo && photo.length > 0) {
            fileId = photo[photo.length - 1].file_id; // Grab largest version
            console.log("File Type: Photo");
        } else if (doc && doc.mime_type.startsWith('image/')) {
            fileId = doc.file_id;
            console.log("File Type: Document (Image)");
        } else {
            return ctx.reply("❌ Invalid File. Please send an actual image or photo.");
        }

        // 2. Initializing Stage
        processMsg = await ctx.reply("⚙️ <b>Stage 1/3:</b> Authenticating and fetching assets...", { parse_mode: 'HTML' });

        // 3. Fetch Asset URLs from Telegram
        console.log("Fetching Telegram file links...");
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const bgUrl = fileLink.href;

        const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
        let pfpUrl = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
        
        if (pfpData && pfpData.total_count > 0) {
            const pfpLink = await ctx.telegram.getFileLink(pfpData.photos[0][0].file_id);
            pfpUrl = pfpLink.href;
            console.log("User Profile Picture found.");
        } else {
            console.log("No User PFP found, using default avatar.");
        }

        // 4. Update Status
        await ctx.telegram.editMessageText(ctx.chat.id, processMsg.message_id, undefined, "🎨 <b>Stage 2/3:</b> Rendering Graphics Layers...", { parse_mode: 'HTML' });

        // 5. Build Cloudinary Transformation
        const firstName = (ctx.from.first_name || "AGENT").toUpperCase();
        const username = ctx.from.username ? `@${ctx.from.username}` : "SECRET_ACCESS";
        const userId = ctx.from.id;
        
        // Generate random 12-digit code
        const codeNum = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('');
        const formattedCode = codeNum.match(/.{1,4}/g).join('  ');

        const pfpEncoded = b64(pfpUrl);

        // Transformation Stack
        const transformations = [
            `w_1280,h_720,c_fill,e_brightness:-35`, // The canvas
            `l_text:Arial_42_bold_letter_spacing_6:CHILDRENS%20PROVIENCE/co_white,g_north,y_65/fl_layer_apply`,
            `l_fetch:${pfpEncoded}/w_245,h_245,c_fill,r_max,bo_12px_solid_white/g_west,x_130,y_30/fl_layer_apply`,
            `l_text:Arial_58_bold:${encodeURIComponent(firstName)}/co_white,g_west,x_440,y_25/fl_layer_apply`,
            `l_text:Arial_34:${encodeURIComponent(username)}/co_rgb:38bdf8,g_west,x_440,y_95/fl_layer_apply`,
            `l_text:Courier_26_bold:UID:%20${userId}/co_rgb:94a3b8,g_south_west,x_130,y_85/fl_layer_apply`,
            `l_text:Courier_62_bold:${encodeURIComponent(formattedCode)}/co_white,g_south_east,x_105,y_85/fl_layer_apply`
        ];

        const finalImageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformations.join('/')}/${bgUrl}`;

        // 6. Final Delivery
        console.log("Generation complete. Sending photo to Telegram...");
        await ctx.telegram.editMessageText(ctx.chat.id, processMsg.message_id, undefined, "🚀 <b>Stage 3/3:</b> Encrypting and Sending...", { parse_mode: 'HTML' });

        await ctx.replyWithPhoto(finalImageUrl, {
            caption: `✅ <b>ID GENERATION SUCCESSFUL</b>\n───────────────────\n<b>Name:</b> ${firstName}\n<b>Status:</b> Active\n<b>Rank:</b> Elite Member`,
            parse_mode: 'HTML'
        });

        // 7. Auto-cleanup
        setTimeout(() => {
            ctx.deleteMessage(processMsg.message_id).catch(() => {});
        }, 2000);

    } catch (err) {
        console.error("FATAL ERROR IN WORKER:", err);

        // SEND COMPLETE DEBUG ERROR TO THE BOX
        const errorBox = `
🚨 <b>SYSTEM CRITICAL ERROR</b> 🚨

<b>Type:</b> <code>${err.name}</code>
<b>Message:</b> <code>${err.message}</code>

<b>Debug Log:</b>
<pre>${err.stack ? err.stack.split('\\n').slice(0, 5).join('\\n') : 'No trace available'}</pre>

<b>Troubleshooting:</b>
1. Check Cloudinary Dashboard for 403 errors.
2. Ensure <code>nodejs_compat</code> is set in wrangler.toml.
3. Verify Bot Token is correct.
        `;

        if (processMsg) {
            await ctx.telegram.editMessageText(ctx.chat.id, processMsg.message_id, undefined, errorBox, { parse_mode: 'HTML' });
        } else {
            await ctx.replyWithHTML(errorBox);
        }
    }
});

// ---------------------------------------------------------
// 🔌 CLOUDFLARE FETCH HANDLER
// ---------------------------------------------------------
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // Manual Setup Webhook path
        if (url.pathname === "/setup") {
            const webhookUrl = `${url.protocol}//${url.host}/webhook`;
            const setup = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            const result = await setup.json();
            return new Response(JSON.stringify(result, null, 2), { headers: { "Content-Type": "application/json" } });
        }

        // Webhook Entry point
        if (url.pathname === "/webhook" && request.method === "POST") {
            try {
                const body = await request.json();
                await bot.handleUpdate(body);
                return new Response("OK");
            } catch (err) {
                console.error("Webhook parse error:", err);
                return new Response("Error Parsing Update", { status: 500 });
            }
        }

        return new Response("Children's Provience ID Engine: ONLINE. Use /setup to link.");
    }
};
