import { Telegraf } from 'telegraf';

// --- CONFIGURATION ---
const CONFIG = {
    BOT_TOKEN: "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk",
    CLOUD_NAME: "dneusgyzc",
    API_KEY: "554734628665841",
    API_SECRET: "ZmDXv6UketNHdwE-prYTesesZ7I"
};

// Helper: Convert Image URL to Base64 (to bypass URL fetch blocks)
const toBase64 = async (url) => {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return `data:image/jpeg;base64,${btoa(binary)}`;
};

async function generateSignature(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    const signatureString = sortedKeys.map(k => `${k}=${params[k]}`).join("&") + secret;
    const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(signatureString));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default {
    async fetch(request) {
        const bot = new Telegraf(CONFIG.BOT_TOKEN);
        const safeB64 = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        bot.start((ctx) => ctx.reply("🔱 CHILDREN'S PROVIENCE ID SYSTEM\n\nSend a photo to generate your Full Data Card (including PFP)."));

        bot.on(['photo', 'document'], async (ctx) => {
            let status;
            try {
                const fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message.document?.file_id;
                if (!fileId) return;

                status = await ctx.reply("⚙️ Stage 1/2: Processing Assets...");

                // 1. Download & Upload Background
                const bgFile = await ctx.telegram.getFile(fileId);
                const bgData = await toBase64(`https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${bgFile.file_path}`);

                const timestamp = Math.round(Date.now() / 1000);
                const publicId = `full_id_${ctx.from.id}_${timestamp}`;
                const signature = await generateSignature({ public_id: publicId, timestamp: timestamp }, CONFIG.API_SECRET);

                const formData = new FormData();
                formData.append("file", bgData);
                formData.append("api_key", CONFIG.API_KEY);
                formData.append("timestamp", timestamp);
                formData.append("public_id", publicId);
                formData.append("signature", signature);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
                const uploadData = await uploadRes.json();

                // 2. Download & Encode Profile Picture
                await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, "🎨 Stage 2/2: Finalizing Graphics...");
                const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
                let pfpBase64 = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                
                if (pfpData.total_count > 0) {
                    const pfpFile = await ctx.telegram.getFile(pfpData.photos[0][0].file_id);
                    pfpBase64 = await toBase64(`https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${pfpFile.file_path}`);
                }

                // 3. Build Detailed Transformation
                const name = (ctx.from.first_name || "AGENT").toUpperCase();
                const userId = ctx.from.id;
                const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                const layers = [
                    `w_1280,h_720,c_fill,e_brightness:-40`,
                    `l_text:Arial_45_bold:CHILDRENS%20PROVIENCE,g_north,y_60,co_white`,
                    // Profile Pic Layer (Using Base64 encoding to prevent fetch block)
                    `l_fetch:${safeB64(pfpBase64)}/w_240,h_240,c_fill,r_max,bo_10px_solid_white,g_west,x_120,y_30`,
                    `l_text:Arial_55_bold:${encodeURIComponent(name)},g_west,x_420,y_20,co_white`,
                    `l_text:Arial_30:UID:%20${userId},g_west,x_420,y_90,co_rgb:38bdf8`,
                    `l_text:Courier_60_bold:${encodeURIComponent(code)},g_south_east,x_100,y_80,co_white`
                ];

                const finalUrl = `https://res.cloudinary.com/${CONFIG.CLOUD_NAME}/image/upload/${layers.join('/')}/${uploadData.public_id}.jpg`;

                await ctx.replyWithPhoto(finalUrl, { caption: `✅ <b>Full Data Card Ready</b>`, parse_mode: 'HTML' });
                await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                await ctx.reply(`❌ <b>System Error</b>\n<code>${err.message}</code>`, { parse_mode: 'HTML' });
            }
        });

        const url = new URL(request.url);
        if (url.pathname === "/webhook" && request.method === "POST") {
            await bot.handleUpdate(await request.json());
            return new Response("OK");
        }
        if (url.pathname === "/setup") {
            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/setWebhook?url=${url.protocol}//${url.host}/webhook`);
            return new Response("Setup Complete");
        }
        return new Response("Ready");
    }
};
