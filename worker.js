const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Digital ID Card</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            background: #0f172a;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: 'Poppins', sans-serif;
            padding: 16px;
            box-sizing: border-box;
            user-select: none;
        }
        .card {
            width: 100%;
            max-width: 640px;
            aspect-ratio: 16/9;
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            border-radius: 20px;
            padding: 25px;
            box-sizing: border-box;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.2);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
        }
        /* Glassmorphism shine effect */
        .card::before {
            content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
            pointer-events: none;
        }
        .header { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 2; }
        .logo { display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 700; }
        .logo i { font-size: 32px; color: #fff; }
        .title { font-size: 16px; font-weight: 700; letter-spacing: 2px; text-align: right; opacity: 0.9; max-width: 150px;}
        .content { display: flex; justify-content: space-between; align-items: flex-end; position: relative; z-index: 2; }
        .details { display: flex; flex-direction: column; gap: 4px; }
        .name { font-size: 24px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;}
        .username, .userid { font-size: 13px; color: #bfdbfe; font-weight: 500; }
        .code { font-size: 20px; font-family: 'Courier New', Courier, monospace; letter-spacing: 4px; margin-top: 15px; font-weight: bold; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 8px; width: fit-content;}
        .profile-container { width: 100px; height: 100px; border-radius: 16px; overflow: hidden; border: 3px solid rgba(255,255,255,0.7); box-shadow: 0 10px 20px rgba(0,0,0,0.3); background: #cbd5e1; flex-shrink: 0;}
        .profile-container img { width: 100%; height: 100%; object-fit: cover; }
    </style>
</head>
<body>
    <div class="card" id="idCard">
        <div class="header">
            <div class="logo"><i class="fab fa-telegram"></i> ID</div>
            <div class="title">CHILDRENS PROVIENCE</div>
        </div>
        <div class="content">
            <div class="details">
                <div class="name" id="name">Loading...</div>
                <div class="username" id="username">@username</div>
                <div class="userid" id="userid">ID: --------</div>
                <div class="code" id="code">0000 0000 0000</div>
            </div>
            <div class="profile-container">
                <img id="profile" src="https://via.placeholder.com/150" alt="Profile">
            </div>
        </div>
    </div>

    <script>
        const tg = window.Telegram.WebApp;
        tg.ready(); tg.expand();

        // 1. Get User Data straight from Telegram App
        const user = tg.initDataUnsafe?.user || {
            first_name: "Guest", last_name: "", username: "guest_user", id: "000000000"
        };

        // 2. Populate Card
        document.getElementById('name').innerText = (user.first_name + " " + (user.last_name || "")).trim();
        document.getElementById('username').innerText = user.username ? "@" + user.username : "No Username";
        document.getElementById('userid').innerText = "ID: " + user.id;

        // 3. Generate Random 12-Digit Code
        let randomCode = "";
        for(let i=0; i<12; i++) randomCode += Math.floor(Math.random() * 10);
        document.getElementById('code').innerText = randomCode.match(/.{1,4}/g).join(' ');

        // 4. Set Profile Picture
        if(user.photo_url) {
            document.getElementById('profile').src = user.photo_url;
        }
    </script>
</body>
</html>
`;

// Helper to send messages
async function sendTelegramMessage(chatId, text, webAppUrl) {
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🪪 View My Data Card", web_app: { url: webAppUrl } }]]
        }
    };
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const baseUrl = `${url.protocol}//${url.host}`;
        const jsonHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

        // 1. SETUP WEBHOOK
        if (path === "/setup") {
            const webhookUrl = `${baseUrl}/webhook`;
            const tgApi = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`;
            const res = await fetch(tgApi);
            return new Response(await res.text(), { headers: jsonHeaders });
        }

        // 2. TELEGRAM BOT HANDLER
        if (path === "/webhook" && method === "POST") {
            try {
                const update = await request.json();
                
                if (update.message && update.message.text) {
                    const chatId = update.message.chat.id;
                    const firstName = update.message.from.first_name || "User";
                    const text = update.message.text;

                    // When they press /start, send them the card button
                    if (text.startsWith("/start")) {
                        const welcomeMsg = `👋 Welcome, <b>${firstName}</b>!\n\nYour profile has been authenticated. Click the button below to view your official Data Card.`;
                        await sendTelegramMessage(chatId, welcomeMsg, baseUrl);
                    } 
                }
            } catch (e) { console.error("Webhook processing error:", e); }
            return new Response("OK", { status: 200 });
        }

        // 3. SERVE FRONTEND CARD (Mini App)
        if (path === "/" || path === "/index.html") {
            return new Response(HTML_CONTENT, { headers: { "Content-Type": "text/html" } });
        }

        return new Response("Not Found", { status: 404 });
    }
};
