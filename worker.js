const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";
const CLOUDINARY_CLOUD_NAME = "dneusgyzc"; 

const btoaUrl = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        if (url.pathname === "/setup") {
            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${baseUrl}/webhook`);
            return new Response(await res.text());
        }

        if (url.pathname === "/webhook" && request.method === "POST") {
            const update = await request.json();
            const msg = update.message;
            if (!msg) return new Response("OK");

            const chatId = msg.chat.id;
            const userId = msg.from.id;

            // 1. Handle /start - Ask for Image
            if (msg.text && msg.text.startsWith("/start")) {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: "📸 <b>Step 1: Upload a Background</b>\n\nPlease send me the image you want to use as your card background!",
                        parse_mode: "HTML"
                    })
                });
                return new Response("OK");
            }

            // 2. Handle Image Upload
            if (msg.photo) {
                const fileId = msg.photo[msg.photo.length - 1].file_id;
                const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
                const fileData = await fileRes.json();
                const tgImgUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: "⚙️ <b>Processing your Data Card...</b>", parse_mode: "HTML" })
                });

                // Get User Profile Pic
                const pfpRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`);
                const pfpData = await pfpRes.json();
                let pfpUrl = "https://res.cloudinary.com/demo/image/upload/d_avatar.png/v1/avatar.png";
                if (pfpData.result.total_count > 0) {
                    const pfpFile = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${pfpData.result.photos[0][0].file_id}`)).json();
                    pfpUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${pfpFile.result.file_path}`;
                }

                // Data for Card
                const name = (msg.from.first_name || "User").toUpperCase();
                const username = msg.from.username ? `@${msg.from.username}` : "CLASSIFIED";
                let code = "";
                for(let i=0; i<12; i++) code += Math.floor(Math.random() * 10);
                const formattedCode = code.match(/.{1,4}/g).join('  ');

                // Cloudinary URL Logic
                const b64Bg = btoaUrl(tgImgUrl);
                const b64Pfp = btoaUrl(pfpUrl);

                const transformations = [
                    `w_1280,h_720,c_fill,e_brightness:-20`, // Dim background for readability
                    `l_text:Arial_40_bold_letter_spacing_5:CHILDRENS%20PROVIENCE/co_white,g_north,y_60/fl_layer_apply`,
                    `l_fetch:${b64Pfp}/w_240,h_240,c_fill,r_max,bo_8px_solid_white/g_west,x_120,y_20/fl_layer_apply`,
                    `l_text:Arial_55_bold:${encodeURIComponent(name)}/co_white,g_west,x_420,y_10/fl_layer_apply`,
                    `l_text:Arial_32:${encodeURIComponent(username)}/co_rgb:38bdf8,g_west,x_420,y_80/fl_layer_apply`,
                    `l_text:Courier_28_bold:USER%20ID:%20${userId}/co_rgb:cbd5e1,g_south_west,x_120,y_80/fl_layer_apply`,
                    `l_text:Courier_60_bold:${encodeURIComponent(formattedCode)}/co_white,g_south_east,x_100,y_80/fl_layer_apply`
                ];

                const finalImageUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transformations.join('/')}/${tgImgUrl}`;

                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        photo: finalImageUrl,
                        caption: `✅ <b>Card Generated Successfully!</b>`,
                        parse_mode: "HTML"
                    })
                });
            }
            return new Response("OK");
        }
        return new Response("Bot Active");
    }
};
