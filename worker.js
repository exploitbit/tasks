const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";
const CLOUDINARY_CLOUD_NAME = "dneusgyzc"; 

// Helper: Securely encode URLs for Cloudinary layers
const cleanUrl = (url) => btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

async function tgApi(method, body) {
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
            const s = await tgApi("setWebhook", { url: `${url.protocol}//${url.host}/webhook` });
            return new Response(await s.text());
        }

        if (url.pathname === "/webhook" && request.method === "POST") {
            const update = await request.json();
            const msg = update.message;
            if (!msg) return new Response("OK");

            const chatId = msg.chat.id;
            const userId = msg.from.id;

            // 1. COMMAND: /start
            if (msg.text && msg.text.startsWith("/start")) {
                await tgApi("sendMessage", {
                    chat_id: chatId,
                    text: "🎨 <b>Welcome to Childrens Provience</b>\n\nTo generate your Elite Data Card, please <b>Send or Forward</b> any image/file you want as your background.",
                    parse_mode: "HTML"
                });
                return new Response("OK");
            }

            // 2. HANDLE ANY FILE (Photo or Document)
            const photo = msg.photo ? msg.photo[msg.photo.length - 1] : (msg.document && msg.document.mime_type.includes('image') ? msg.document : null);
            
            if (photo) {
                const status = await tgApi("sendMessage", { chat_id: chatId, text: "⚙️ <b>Processing your Data Card...</b>", parse_mode: "HTML" });
                const statusJson = await status.json();

                try {
                    // Get File Path from Telegram
                    const file = await (await tgApi("getFile", { file_id: photo.file_id })).json();
                    const bgUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.result.file_path}`;

                    // Get User Profile Pic
                    const pfpData = await (await tgApi("getUserProfilePhotos", { user_id: userId, limit: 1 })).json();
                    let pfpUrl = "https://res.cloudinary.com/demo/image/upload/d_avatar.png/v1/avatar.png";
                    if (pfpData.result?.total_count > 0) {
                        const pfpFile = await (await tgApi("getFile", { file_id: pfpData.result.photos[0][0].file_id })).json();
                        pfpUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${pfpFile.result.file_path}`;
                    }

                    // Card Details
                    const name = (msg.from.first_name || "AGENT").toUpperCase();
                    const username = msg.from.username ? `@${msg.from.username}` : "CLASSIFIED";
                    const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

                    // --- THE CLOUDINARY ENGINE ---
                    const b64Pfp = cleanUrl(pfpUrl);
                    
                    const layers = [
                        `w_1280,h_720,c_fill,q_auto,f_auto,e_brightness:-30`, // Optimize BG
                        `l_text:Arial_45_bold_letter_spacing_6:CHILDRENS%20PROVIENCE/co_white,g_north,y_60/fl_layer_apply`, // Title
                        `l_fetch:${b64Pfp}/w_240,h_240,c_fill,r_max,bo_10px_solid_white/g_west,x_120,y_30/fl_layer_apply`, // Circle PFP
                        `l_text:Arial_55_bold:${encodeURIComponent(name)}/co_white,g_west,x_420,y_20/fl_layer_apply`, // Name
                        `l_text:Arial_35:${encodeURIComponent(username)}/co_rgb:38bdf8,g_west,x_420,y_90/fl_layer_apply`, // Username
                        `l_text:Courier_30_bold:UID:%20${userId}/co_rgb:94a3b8,g_south_west,x_120,y_80/fl_layer_apply`, // ID
                        `l_text:Courier_60_bold:${encodeURIComponent(code)}/co_white,g_south_east,x_100,y_80/fl_layer_apply` // Card Code
                    ];

                    const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${layers.join('/')}/${bgUrl}`;

                    // Send the final result
                    await tgApi("sendPhoto", {
                        chat_id: chatId,
                        photo: finalUrl,
                        caption: `✅ <b>Card Successfully Encrypted</b>\n\nUser: ${name}\nStatus: Active Member`,
                        parse_mode: "HTML"
                    });

                    // Remove "Processing" message
                    await tgApi("deleteMessage", { chat_id: chatId, message_id: statusJson.result.message_id });

                } catch (err) {
                    await tgApi("sendMessage", { chat_id: chatId, text: "❌ <b>Generation Failed.</b> Please try a different image." });
                }
            }
            return new Response("OK");
        }
        return new Response("Active");
    }
};
