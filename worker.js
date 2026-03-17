const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";
const CLOUDINARY_CLOUD_NAME = "dneusgyzc"; 

// Helper: Base64 encode for Cloudinary l_fetch layers
const btoaUrl = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

async function sendPhoto(chatId, photoUrl, caption) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption: caption,
            parse_mode: "HTML"
        })
    });
}

async function getTelegramProfilePic(userId) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`);
        const data = await res.json();
        if (data.ok && data.result.total_count > 0) {
            const fileId = data.result.photos[0][2].file_id; // High res
            const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
            const fileData = await fileRes.json();
            if (fileData.ok) {
                return `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
            }
        }
    } catch (e) { console.error(e); }
    // Fallback if no PFP
    return "https://res.cloudinary.com/demo/image/upload/d_avatar.png/w_300,h_300,c_fill,r_max/v1/avatar.png";
}

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;
        const baseUrl = `${url.protocol}//${url.host}`;

        // 1. WEBHOOK SETUP
        if (path === "/setup") {
            const webhookUrl = `${baseUrl}/webhook`;
            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
            const data = await res.text();
            return new Response(data, { headers: { "Content-Type": "application/json" } });
        }

        // 2. BOT LOGIC
        if (path === "/webhook" && request.method === "POST") {
            try {
                const update = await request.json();
                if (update.message && update.message.text && update.message.text.startsWith("/start")) {
                    const chatId = update.message.chat.id;
                    const userId = update.message.from.id;
                    const firstName = (update.message.from.first_name || "User").toUpperCase();
                    const username = update.message.from.username ? `@${update.message.from.username}` : "PROVISIONAL";

                    // Generate 12-Digit Code
                    let code = "";
                    for(let i=0; i<12; i++) code += Math.floor(Math.random() * 10);
                    const formattedCode = code.match(/.{1,4}/g).join('  ');

                    // Get Profile Pic and Encode it for Cloudinary
                    const pfpUrl = await getTelegramProfilePic(userId);
                    const b64Pfp = btoaUrl(pfpUrl);

                    // --- CLOUDINARY TRANSFORMATION ---
                    // Base: Your multicolored gradient link
                    // Layer 1: Organization Name (Top Center)
                    // Layer 2: Circular Profile Picture (Left)
                    // Layer 3: Name & Username (Right of Pic)
                    // Layer 4: User ID (Bottom Left)
                    // Layer 5: Random Code (Bottom Right)
                    
                    const transformations = [
                        `w_1280,h_720,c_fill`, // Ensure 16:9 ratio
                        `l_text:Arial_40_bold_letter_spacing_5:CHILDRENS%20PROVIENCE/co_white,g_north,y_60/fl_layer_apply`,
                        `l_fetch:${b64Pfp}/w_240,h_240,c_fill,r_max,bo_8px_solid_white/g_west,x_120,y_20/fl_layer_apply`,
                        `l_text:Arial_55_bold:${encodeURIComponent(firstName)}/co_white,g_west,x_420,y_10/fl_layer_apply`,
                        `l_text:Arial_32:${encodeURIComponent(username)}/co_rgb:38bdf8,g_west,x_420,y_80/fl_layer_apply`,
                        `l_text:Courier_28_bold:USER%20ID:%20${userId}/co_rgb:cbd5e1,g_south_west,x_120,y_80/fl_layer_apply`,
                        `l_text:Courier_60_bold:${encodeURIComponent(formattedCode)}/co_white,g_south_east,x_100,y_80/fl_layer_apply`
                    ];

                    const finalImageUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformations.join('/')}/v1773745025/gradient_abstraction_multicolored_166710_1600x900_i9w59e.jpg`;

                    await sendPhoto(chatId, finalImageUrl, `🚀 <b>Access Granted</b>\n\nYour <b>Childrens Provience</b> Data Card is ready.`);
                }
            } catch (e) { console.error("Error:", e); }
            return new Response("OK");
        }

        return new Response("Bot is active. Use /setup to link Webhook.");
    }
};
