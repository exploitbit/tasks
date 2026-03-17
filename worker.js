const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";
const CLOUD_NAME = "dneusgyzc";
const API_KEY = "554734628665841";
const API_SECRET = "ZmDXv6UketNHdwE-prYTesesZ7I";

// Helper for Cloudinary Layer Encoding
const clean = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

async function tg(method, body) {
    return await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

export default {
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/setup") {
            await tg("setWebhook", { url: `${url.protocol}//${url.host}/webhook` });
            return new Response("Webhook Linked!");
        }

        if (url.pathname === "/webhook" && request.method === "POST") {
            const update = await request.json();
            const msg = update.message;
            if (!msg) return new Response("OK");

            const chatId = msg.chat.id;
            const userId = msg.from.id;

            // 1. COMMAND: /start
            if (msg.text?.startsWith("/start")) {
                await tg("sendMessage", {
                    chat_id: chatId,
                    text: "📤 <b>Upload your Background</b>\n\nPlease send me any image. I will save it to the cloud and generate your Elite Card.",
                    parse_mode: "HTML"
                });
                return new Response("OK");
            }

            // 2. HANDLE IMAGE UPLOAD
            const photo = msg.photo ? msg.photo[msg.photo.length - 1] : (msg.document?.mime_type?.includes('image') ? msg.document : null);
            
            if (photo) {
                const status = await (await tg("sendMessage", { chat_id: chatId, text: "☁️ <b>Uploading to Cloudinary...</b>", parse_mode: "HTML" })).json();

                try {
                    // Get File from Telegram
                    const file = await (await tg("getFile", { file_id: photo.file_id })).json();
                    const tgFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.result.file_path}`;

                    // --- UPLOAD TO CLOUDINARY (Saves the file permanently) ---
                    const timestamp = Math.round(new Date().getTime() / 1000);
                    const signatureData = `timestamp=${timestamp}${API_SECRET}`;
                    const signature = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(signatureData))))
                                      .map(b => b.toString(16).padStart(2, "0")).join("");

                    const formData = new FormData();
                    formData.append("file", tgFileUrl);
                    formData.append("api_key", API_KEY);
                    formData.append("timestamp", timestamp);
                    formData.append("signature", signature);
                    formData.append("public_id", `user_bg_${userId}`); // Saves as a specific ID for the user

                    const uploadRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.result.file_path}`);
                    const uploadData = await (await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                        method: "POST",
                        body: formData
                    })).json();

                    const savedPublicId = uploadData.public_id; // This is now saved in your Media Library!

                    // --- GENERATE CARD ON THE SAVED IMAGE ---
                    const pfpData = await (await tg("getUserProfilePhotos", { user_id: userId, limit: 1 })).json();
                    let pfpUrl = "https://res.cloudinary.com/demo/image/upload/d_avatar.png/v1/avatar.png";
                    if (pfpData.result?.total_count > 0) {
                        const pfpFile = await (await tg("getFile", { file_id: pfpData.result.photos[0][0].file_id })).json();
                        pfpUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${pfpFile.result.file_path}`;
                    }

                    const name = (msg.from.first_name || "MEMBER").toUpperCase();
                    const username = msg.from.username ? `@${msg.from.username}` : "SECRET";
                    const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                    const layers = [
                        `w_1280,h_720,c_fill,e_brightness:-40`,
                        `l_text:Arial_45_bold_letter_spacing_6:CHILDRENS%20PROVIENCE/co_white,g_north,y_60/fl_layer_apply`,
                        `l_fetch:${clean(pfpUrl)}/w_240,h_240,c_fill,r_max,bo_10px_solid_white/g_west,x_120,y_30/fl_layer_apply`,
                        `l_text:Arial_55_bold:${encodeURIComponent(name)}/co_white,g_west,x_420,y_20/fl_layer_apply`,
                        `l_text:Arial_35:${encodeURIComponent(username)}/co_rgb:38bdf8,g_west,x_420,y_90/fl_layer_apply`,
                        `l_text:Courier_30_bold:UID:%20${userId}/co_rgb:94a3b8,g_south_west,x_120,y_80/fl_layer_apply`,
                        `l_text:Courier_60_bold:${encodeURIComponent(code)}/co_white,g_south_east,x_100,y_80/fl_layer_apply`
                    ];

                    const finalUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${layers.join('/')}/${savedPublicId}.jpg`;

                    await tg("sendPhoto", {
                        chat_id: chatId,
                        photo: finalUrl,
                        caption: `✨ <b>Elite Card Generated!</b>\nYour background has been saved to the cloud library.`
                    });

                    await tg("deleteMessage", { chat_id: chatId, message_id: status.result.message_id });

                } catch (err) {
                    await tg("sendMessage", { chat_id: chatId, text: "❌ <b>Upload Error:</b> Please try again with a smaller image." });
                }
            }
            return new Response("OK");
        }
        return new Response("Bot Running");
    }
};
