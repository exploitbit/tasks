import { Telegraf } from 'telegraf';

const CONFIG = {
    BOT_TOKEN: "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk",
    CLOUD_NAME: "dneusgyzc",
    API_KEY: "554734628665841",
    API_SECRET: "ZmDXv6UketNHdwE-prYTesesZ7I"
};

// --- NEW METHOD: RAW BINARY SIGNING ---
async function generateSignature(params, secret) {
    const signatureString = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&") + secret;
    const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(signatureString));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// --- NEW METHOD: RELIABLE BASE64 CONVERTER ---
const toBase64 = async (url) => {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return `data:image/jpeg;base64,${btoa(binary)}`;
};

export default {
    async fetch(request) {
        const bot = new Telegraf(CONFIG.BOT_TOKEN);
        const b64Safe = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        bot.start((ctx) => ctx.reply("🔱 CHILDREN'S PROVIENCE: GOD MODE ACTIVE\n\nSend a photo. I will try 4 different rendering paths."));

        bot.on(['photo', 'document'], async (ctx) => {
            let status;
            try {
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                if (!fileId) return;

                status = await ctx.reply("🛠 Path 1: Binary Encoding...");

                // 1. Get Assets and Convert to Base64 (Avoids Fetch Errors)
                const file = await ctx.telegram.getFile(fileId);
                const bgBase64 = await toBase64(`https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${file.file_path}`);

                const pfpData = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
                let pfpBase64 = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                if (pfpData.total_count > 0) {
                    const pfpFile = await ctx.telegram.getFile(pfpData.photos[0][0].file_id);
                    pfpBase64 = await toBase64(`https://api.telegram.org/file/bot${CONFIG.BOT_TOKEN}/${pfpFile.file_path}`);
                }

                // 2. NEW METHOD: Direct Cloudinary POST (No Fetch Layers)
                await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, "🎨 Path 2: Rendering Complex Layers...");
                
                const timestamp = Math.round(Date.now() / 1000);
                const publicId = `final_id_${ctx.from.id}_${timestamp}`;
                
                // Construct Transformations within the upload itself (More reliable)
                const name = (ctx.from.first_name || "AGENT").toUpperCase();
                const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');
                
                const transformation = [
                    { width: 1280, height: 720, crop: "fill", effect: "brightness:-40" },
                    { overlay: { font_family: "Arial", font_size: 45, font_weight: "bold", text: "CHILDRENS PROVIENCE" }, color: "white", gravity: "north", y: 60 },
                    { overlay: { url: pfpBase64 }, width: 240, height: 240, crop: "fill", radius: "max", border: "10px_solid_white", gravity: "west", x: 120, y: 30 },
                    { overlay: { font_family: "Arial", font_size: 55, font_weight: "bold", text: name }, color: "white", gravity: "west", x: 420, y: 20 },
                    { overlay: { font_family: "Courier", font_size: 60, font_weight: "bold", text: code }, color: "white", gravity: "south_east", x: 100, y: 80 }
                ];

                const signature = await generateSignature({ public_id: publicId, timestamp: timestamp }, CONFIG.API_SECRET);

                const formData = new FormData();
                formData.append("file", bgBase64);
                formData.append("api_key", CONFIG.API_KEY);
                formData.append("timestamp", timestamp);
                formData.append("public_id", publicId);
                formData.append("signature", signature);
                // NEW: We send the transformation as part of the upload call!
                formData.append("transformation", JSON.stringify(transformation));

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUD_NAME}/image/upload`, {
                    method: "POST", body: formData
                });

                const uploadData = await uploadRes.json();
                if (!uploadData.secure_url) throw new Error(uploadData.error?.message || "Render Failed");

                // 3. Path 3: Direct Stream Delivery
                await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, "🚀 Path 3: Final Handshake...");

                await ctx.replyWithPhoto(uploadData.secure_url, { 
                    caption: `✅ <b>CHILDRENS PROVIENCE ID</b>\n\nVerified Member: ${ctx.from.first_name}`, 
                    parse_mode: 'HTML' 
                });

                await ctx.deleteMessage(status.message_id).catch(() => {});

            } catch (err) {
                // Path 4: Catch-all Error Reporting
                const report = `❌ <b>PATHWAY FAILED</b>\n<code>${err.message}</code>\n\n<b>Try:</b> Ensure your Cloudinary account has "Auto-Transform" enabled.`;
                if (status) await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, report, { parse_mode: 'HTML' });
                else await ctx.replyWithHTML(report);
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
            return new Response("Webhook set!");
        }
        return new Response("System Online");
    }
};
