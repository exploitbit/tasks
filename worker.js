import { Telegraf } from 'telegraf';

// --- CONFIGURATION BLOCK ---
const CONFIG = {
    BOT_TOKEN: "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk",
    CLOUD_NAME: "dneusgyzc",
    API_KEY: "554734628665841",
    API_SECRET: "ZmDXv6UketNHdwE-prYTesesZ7I"
};

/**
 * SHA-1 Signer for Cloudinary (Bypasses Node.js SDK errors)
 */
async function generateSignature(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    const signatureString = sortedKeys.map(key => `${key}=${params[key]}`).join("&") + secret;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Converts a Response to a Base64 Data URI
 */
async function responseToBase64(response) {
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return `data:image/jpeg;base64,${btoa(binary)}`;
}

export default {
    async fetch(request) {
        const bot = new Telegraf(CONFIG.BOT_TOKEN);
        const safeB64 = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        bot.start((ctx) => ctx.reply("🔱 CHILDREN'S PROVIENCE ID SYSTEM\n\nStatus: Online\nAction: Send a photo to generate your Data Card."));

        bot.on(['photo', 'document'], async (ctx) => {
            let status;
            try {
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                if (!fileId) return;

                status = await ctx.reply("⚙️ Stage 1/3: Downloading & Encoding...");

                // 1. Download Background from Telegram & Convert to Base64
                const file = await ctx.telegram.getFile(fileId);
                const tgUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${file.file_path}`;
                const tgRes = await fetch(tgUrl);
                const bgBase64 = await responseToBase64(tgRes);

                // 2. Upload to Cloudinary using Base64 (No URL Fetching)
                await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, "☁️ Stage 2/3: Storing in Cloud Library...");
                
                const timestamp = Math.round(new Date().getTime() / 1000);
                const publicId = `id_${ctx.from.id}_${timestamp}`;
                const signature = await generateSignature({ public_id: publicId, timestamp: timestamp }, CONFIG.API_SECRET);

                const formData = new FormData();
                formData.append("file", bgBase64); // Sending the actual image data
                formData.append("api_key", CONFIG.API_KEY);
                formData.append("timestamp", timestamp);
                formData.append("public_id", publicId);
                formData.append("signature", signature);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUD_NAME}/image/upload`, {
                    method: "POST", body: formData
                });

                const uploadData = await uploadRes.json();
                if (!uploadData.public_id) throw new Error("Cloudinary rejected the upload.");

                // 3. Handle Profile Picture (Also proxying to avoid 403)
                await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, "🎨 Stage 3/3: Finalizing Graphics...");

                const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
                let pfpUrl = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                if (pfpData.total_count > 0) {
                    const pfpFile = await ctx.telegram.getFile(pfpData.photos[0][0].file_id);
                    pfpUrl = `https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${pfpFile.file_path}`;
                }

                const name = encodeURIComponent((ctx.from.first_name || "AGENT").toUpperCase());
                const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                // 4. Construct Transformation
                const layers = [
                    `w_1280,h_720,c_fill,e_brightness:-40`,
                    `l_text:Arial_45_bold:CHILDRENS%20PROVIENCE,g_north,y_60,co_white`,
                    `l_fetch:${safeB64(pfpUrl)}/w_240,h_240,c_fill,r_max,bo_10px_solid_white,g_west,x_120,y_30`,
                    `l_text:Arial_55_bold:${name},g_west,x_420,y_20,co_white`,
                    `l_text:Courier_60_bold:${encodeURIComponent(code)},g_south_east,x_100,y_80,co_white`
                ];

                const finalUrl = `https://res.cloudinary.com/${CONFIG.CLOUD_NAME}/image/upload/${layers.join('/')}/${uploadData.public_id}.jpg`;

                // 5. Proxy the final image back (Avoids Telegram 400 URL content error)
                const imageRes = await fetch(finalUrl);
                if (!imageRes.ok) throw new Error("Cloudinary generation failed.");
                const imageBlob = await imageRes.blob();

                await ctx.replyWithPhoto({ source: imageBlob }, { 
                    caption: `✅ <b>ID CARD GENERATED</b>\nUser: ${ctx.from.first_name}`, 
                    parse_mode: 'HTML' 
                });

                await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                const errMsg = `❌ <b>System Error</b>\n<code>${err.message}</code>`;
                if (status) await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, errMsg, { parse_mode: 'HTML' });
                else await ctx.replyWithHTML(errMsg);
            }
        });

        // --- WEBHOOK HANDLER ---
        const url = new URL(request.url);
        if (url.pathname === "/webhook" && request.method === "POST") {
            const body = await request.json();
            await bot.handleUpdate(body);
            return new Response("OK");
        }
        
        if (url.pathname === "/setup") {
            const webhookUrl = `${url.protocol}//${url.host}/webhook`;
            await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            return new Response("Webhook Successfully Linked!");
        }
        return new Response("Children's Provience ID Engine: ONLINE");
    }
};
