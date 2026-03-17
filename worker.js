const BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk";
const ADMIN_ID = "8781152810"; // Your Telegram User ID

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Tasks</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
        body { font-family: -apple-system, sans-serif; background: var(--tg-theme-bg-color, #f3f4f6); color: var(--tg-theme-text-color, #111827); padding: 16px; margin: 0; user-select: none; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
        .input-group { display: flex; gap: 8px; margin-bottom: 20px; }
        input { flex: 1; padding: 12px; border: 1px solid var(--tg-theme-hint-color, #ccc); border-radius: 12px; font-size: 16px; outline: none; background: var(--tg-theme-secondary-bg-color, #fff); color: var(--tg-theme-text-color, #000); }
        input:focus { border-color: var(--tg-theme-button-color, #2563eb); }
        button { padding: 12px 20px; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; background: var(--tg-theme-button-color, #2563eb); color: var(--tg-theme-button-text-color, #fff); cursor: pointer; }
        .task-list { list-style: none; padding: 0; margin: 0; }
        .task-item { background: var(--tg-theme-secondary-bg-color, #fff); padding: 16px; border-radius: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .task-text { flex: 1; font-size: 16px; cursor: pointer; }
        .task-text.done { text-decoration: line-through; opacity: 0.5; }
        .delete { color: #ef4444; background: none; border: none; font-size: 20px; cursor: pointer; padding: 0 0 0 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header" id="greeting">Loading Tasks...</div>
        <div class="input-group">
            <input type="text" id="taskInput" placeholder="Add a new task...">
            <button onclick="addTask()">Add</button>
        </div>
        <ul class="task-list" id="taskList"></ul>
    </div>

    <script>
        const tg = window.Telegram.WebApp;
        tg.ready(); tg.expand();

        const userId = tg.initDataUnsafe?.user?.id || "guest";
        document.getElementById('greeting').innerText = (tg.initDataUnsafe?.user?.first_name || "Guest") + "'s Tasks";
        let tasks = [];

        async function fetchTasks() {
            const res = await fetch('/api/tasks?user_id=' + userId);
            tasks = await res.json();
            renderTasks();
        }

        async function saveTasks() {
            await fetch('/api/tasks', { method: 'POST', body: JSON.stringify({ user_id: userId, tasks }) });
        }

        function addTask() {
            const input = document.getElementById('taskInput');
            if (!input.value.trim()) return;
            tasks.push({ title: input.value.trim(), done: false });
            input.value = '';
            renderTasks(); saveTasks();
            if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        }

        function toggleTask(index) {
            tasks[index].done = !tasks[index].done;
            renderTasks(); saveTasks();
            if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
        }

        function removeTask(index) {
            tasks.splice(index, 1);
            renderTasks(); saveTasks();
            if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('rigid');
        }

        function renderTasks() {
            const list = document.getElementById('taskList');
            list.innerHTML = tasks.map((t, i) => \`
                <li class="task-item">
                    <div class="task-text \${t.done ? 'done' : ''}" onclick="toggleTask(\${i})">
                        \${t.done ? '✅ ' : '⏳ '}\${t.title}
                    </div>
                    <button class="delete" onclick="removeTask(\${i})">✕</button>
                </li>
            \`).join('');
        }
        fetchTasks();
    </script>
</body>
</html>
`;

// Helper function to send Telegram messages
async function sendTelegramMessage(chatId, text, webAppUrl) {
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🌐 Open Task Manager", web_app: { url: webAppUrl } }]]
        }
    };
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const baseUrl = `${url.protocol}//${url.host}`;
        const jsonHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

        // ==========================================
        // 1. SETUP WEBHOOK & NOTIFY ADMIN
        // ==========================================
        if (path === "/setup") {
            const webhookUrl = `${baseUrl}/webhook`;
            const tgApi = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`;
            const res = await fetch(tgApi);
            const tgResponse = await res.text();

            // Send deployment notification to the Admin
            const adminPayload = {
                chat_id: ADMIN_ID,
                text: `🚀 <b>Deployment Successful!</b>\n\nYour Cloudflare Worker is live and the webhook is securely connected to:\n<code>${baseUrl}</code>\n\nSend /start to test it!`,
                parse_mode: "HTML"
            };
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(adminPayload)
            });

            return new Response(tgResponse, { headers: jsonHeaders });
        }

        // ==========================================
        // 2. TELEGRAM BOT COMMAND HANDLER
        // ==========================================
        if (path === "/webhook" && method === "POST") {
            try {
                const update = await request.json();
                
                if (update.message && update.message.text) {
                    const chatId = update.message.chat.id;
                    const userId = update.message.from.id;
                    const firstName = update.message.from.first_name || "User";
                    const text = update.message.text;

                    // Command: /start
                    if (text.startsWith("/start")) {
                        const welcomeMsg = `👋 Welcome, <b>${firstName}</b>!\n\nI am your personal Task Manager. Click the button below to launch the Mini App.`;
                        await sendTelegramMessage(chatId, welcomeMsg, baseUrl);
                    } 
                    
                    // Command: /help
                    else if (text.startsWith("/help")) {
                        const helpMsg = `🛠 <b>How to use this bot:</b>\n\n1️⃣ Use the <b>Menu Button</b> or /start to open the Web App.\n2️⃣ Add tasks, mark them as done, or delete them inside the app.\n3️⃣ Use /stats to see your current progress without opening the app.\n\nEverything syncs instantly to the cloud!`;
                        await sendTelegramMessage(chatId, helpMsg, baseUrl);
                    } 
                    
                    // Command: /stats
                    else if (text.startsWith("/stats")) {
                        // Fetch the user's personal task list directly from Cloudflare KV
                        const userTasksStr = await env.TASKS_KV.get(`tasks_${userId}`) || "[]";
                        const userTasks = JSON.parse(userTasksStr);
                        
                        const total = userTasks.length;
                        const completed = userTasks.filter(t => t.done).length;
                        const pending = total - completed;
                        
                        let statsMsg = `📊 <b>Your Task Summary:</b>\n\n`;
                        statsMsg += `📝 <b>Total Tasks:</b> ${total}\n`;
                        statsMsg += `✅ <b>Completed:</b> ${completed}\n`;
                        statsMsg += `⏳ <b>Pending:</b> ${pending}\n`;
                        
                        if (total > 0) {
                            const percent = Math.round((completed / total) * 100);
                            statsMsg += `\n🎯 <b>Progress:</b> ${percent}%`;
                        } else {
                            statsMsg += `\n<i>You have no tasks yet. Open the app to add some!</i>`;
                        }

                        await sendTelegramMessage(chatId, statsMsg, baseUrl);
                    }
                }
            } catch (e) { console.error("Webhook processing error:", e); }
            return new Response("OK", { status: 200 });
        }

        // ==========================================
        // 3. GET TASKS API
        // ==========================================
        if (path === "/api/tasks" && method === "GET") {
            const userId = url.searchParams.get("user_id") || "guest";
            const data = await env.TASKS_KV.get(`tasks_${userId}`) || "[]";
            return new Response(data, { headers: jsonHeaders });
        }

        // ==========================================
        // 4. SAVE TASKS API
        // ==========================================
        if (path === "/api/tasks" && method === "POST") {
            const data = await request.json();
            await env.TASKS_KV.put(`tasks_${data.user_id}`, JSON.stringify(data.tasks));
            return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
        }

        // ==========================================
        // 5. SERVE FRONTEND MINI APP
        // ==========================================
        if (path === "/" || path === "/index.html") {
            return new Response(HTML_CONTENT, { headers: { "Content-Type": "text/html" } });
        }

        return new Response("Not Found", { status: 404 });
    }
};
