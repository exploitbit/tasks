import { Telegraf, Markup } from 'telegraf';

// --- CONFIGURATION ---
const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";

/**
 * Helper: Encodes assets to Base64 to ensure the SVG is self-contained.
 */
async function fetchAsBase64(url) {
    try {
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return `data:image/jpeg;base64,${btoa(binary)}`;
    } catch (e) { return null; }
}

export default {
    async fetch(request) {
        const bot = new Telegraf(BOT_TOKEN);
        const url = new URL(request.url);
        const rootUrl = `${url.protocol}//${url.host}`;

        // --- 1. THE MINI APP HTML VIEW ---
        // Accessing maker.pages.dev/app?name=...&userid=...&pfp=...
        if (url.pathname === "/app") {
            const name = url.searchParams.get("name") || "AGENT";
            const userid = url.searchParams.get("userid") || "000000";
            const pfp = url.searchParams.get("pfp") || "";
            const bg = url.searchParams.get("bg") || "";

            const cardApiUrl = `${rootUrl}/render?name=${name}&userid=${userid}&pfp=${encodeURIComponent(pfp)}&bg=${encodeURIComponent(bg)}`;

            return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <script src="https://telegram.org/js/telegram-web-app.js"></script>
                <style>
                    body { background: #0f172a; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    img { width: 90%; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #334155; }
                    .btn { margin-top: 20px; padding: 12px 25px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; }
                </style>
            </head>
            <body>
                <img src="${cardApiUrl}" alt="Data Card">
                <a href="${cardApiUrl}" download="DataCard.svg" class="btn">DOWNLOAD HIGH-RES</a>
                <script>
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();
                </script>
            </body>
            </html>`, { headers: { "Content-Type": "text/html" } });
        }

        // --- 2. THE IMAGE RENDERING ENGINE ---
        if (url.pathname === "/render") {
            const name = url.searchParams.get("name") || "AGENT";
            const userid = url.searchParams.get("userid") || "000000";
            const pfpUrl = url.searchParams.get("pfp");
            const bgUrl = url.searchParams.get("bg");

            const bgBase64 = await fetchAsBase64(bgUrl);
            const pfpBase64 = await fetchAsBase64(pfpUrl);
            const code = Array.from({length: 12}, () => Math.floor(Math.random() * 10)).join('').match(/.{1,4}/g).join('  ');

            const svg = `
            <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
                <image href="${bgBase64}" width="1280" height="720" preserveAspectRatio="xMidYMid slice" filter="brightness(0.5)" />
                <text x="640" y="80" font-family="Arial" font-size="40" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="5">CHILDRENS PROVIENCE</text>
                <circle cx="220" cy="360" r="125" fill="#38bdf8" />
                <clipPath id="cp"><circle cx="220" cy="360" r="120" /></clipPath>
                <image href="${pfpBase64}" x="100" y="240" width="240" height="240" clip-path="url(#cp)" preserveAspectRatio="xMidYMid slice" />
                <text x="420" y="340" font-family="Arial" font-size="65" font-weight="bold" fill="white">${name.toUpperCase()}</text>
                <text x="420" y="410" font-family="Courier" font-size="35" fill="#38bdf8">UID: ${userid}</text>
                <text x="1180" y="650" font-family="Courier" font-size="55" font-weight="bold" fill="white" text-anchor="end">${code}</text>
            </svg>`;

            return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
        }

        // --- 3. BOT LOGIC ---
        bot.on(['photo', 'document'], async (ctx) => {
            try {
                const userId = ctx.from.id;
                const name = ctx.from.first_name || "Agent";
                const photo = ctx.message.photo;
                const fileId = photo ? photo[photo.length - 1].file_id : ctx.message.document?.file_id;
                
                const bgFile = await ctx.telegram.getFile(fileId);
                const bgUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${bgFile.file_path}`;

                const pfpData = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
                let pfpUrl = "https://res.cloudinary.com/demo/image/upload/v1/avatar.png";
                if (pfpData.total_count > 0) {
                    const pfpFile = await ctx.telegram.getFile(pfpData.photos[0][0].file_id);
                    pfpUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${pfpFile.file_path}`;
                }

                const miniAppUrl = `${rootUrl}/app?name=${encodeURIComponent(name)}&userid=${userId}&pfp=${encodeURIComponent(pfpUrl)}&bg=${encodeURIComponent(bgUrl)}`;
                const directImgUrl = `${rootUrl}/render?name=${encodeURIComponent(name)}&userid=${userId}&pfp=${encodeURIComponent(pfpUrl)}&bg=${encodeURIComponent(bgUrl)}`;

                // Send Image + Mini App Button
                await ctx.replyWithPhoto({ url: directImgUrl }, {
                    caption: `✅ <b>Data Card Generated</b>\nYou can also view and download it in the Mini App below.`,
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp("📂 Open Mini App", miniAppUrl)]
                    ])
                });

            } catch (err) { ctx.reply(`Error: ${err.message}`); }
        });

        // Webhook handler
        if (url.pathname === "/webhook" && request.method === "POST") {
            await bot.handleUpdate(await request.json());
            return new Response("OK");
        }
        if (url.pathname === "/setup") {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${rootUrl}/webhook`);
            return new Response("Setup Success!");
        }
        return new Response("System Running");
    }
};
