import json
from js import Response, fetch

# --- HARDCODED CONFIGURATION ---
BOT_TOKEN = "8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk"

# --- MINI APP FRONTEND ---
HTML_CONTENT = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Tasks</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--tg-theme-bg-color, #f3f4f6);
            color: var(--tg-theme-text-color, #111827);
            padding: 16px; margin: 0;
            -webkit-user-select: none;
        }
        .container { max-width: 600px; margin: 0 auto; }
        .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; color: var(--tg-theme-text-color, #000); }
        .input-group { display: flex; gap: 8px; margin-bottom: 20px; }
        input {
            flex: 1; padding: 12px; border: 1px solid var(--tg-theme-hint-color, #ccc);
            border-radius: 12px; font-size: 16px;
            background: var(--tg-theme-secondary-bg-color, #fff);
            color: var(--tg-theme-text-color, #000);
            outline: none;
        }
        input:focus { border-color: var(--tg-theme-button-color, #2563eb); }
        button {
            padding: 12px 20px; border: none; border-radius: 12px; font-size: 16px; font-weight: 600;
            background-color: var(--tg-theme-button-color, #2563eb);
            color: var(--tg-theme-button-text-color, #ffffff);
            cursor: pointer; transition: opacity 0.2s;
        }
        button:active { opacity: 0.8; }
        .task-list { list-style: none; padding: 0; margin: 0; }
        .task-item {
            background: var(--tg-theme-secondary-bg-color, #ffffff);
            padding: 16px; border-radius: 12px; margin-bottom: 10px;
            display: flex; justify-content: space-between; align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .task-text { flex: 1; font-size: 16px; cursor: pointer; }
        .task-text.done { text-decoration: line-through; opacity: 0.5; }
        .actions { display: flex; gap: 15px; margin-left: 10px; }
        .btn-icon {
            background: none; border: none; font-size: 20px; cursor: pointer; padding: 0;
            color: var(--tg-theme-hint-color, #888);
        }
        .btn-icon.delete { color: #ef4444; }
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
        tg.ready();
        tg.expand();

        const userId = tg.initDataUnsafe?.user?.id || "guest";
        const userName = tg.initDataUnsafe?.user?.first_name || "Guest";
        document.getElementById('greeting').innerText = userName + "'s Tasks";
        
        let tasks = [];

        async function fetchTasks() {
            try {
                const res = await fetch(`/api/tasks?user_id=${userId}`);
                tasks = await res.json();
                renderTasks();
            } catch (err) { console.error("Error", err); }
        }

        async function saveTasks() {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, tasks: tasks })
            });
        }

        function addTask() {
            const input = document.getElementById('taskInput');
            const text = input.value.trim();
            if (!text) return;
            
            tasks.push({ title: text, done: false });
            input.value = '';
            renderTasks();
            saveTasks();
            if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        }

        function toggleTask(index) {
            tasks[index].done = !tasks[index].done;
            renderTasks();
            saveTasks();
            if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
        }

        function removeTask(index) {
            tasks.splice(index, 1);
            renderTasks();
            saveTasks();
            if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('rigid');
        }

        function renderTasks() {
            const list = document.getElementById('taskList');
            list.innerHTML = '';
            tasks.forEach((task, index) => {
                list.innerHTML += `
                    <li class="task-item">
                        <div class="task-text ${task.done ? 'done' : ''}" onclick="toggleTask(${index})">
                            ${task.done ? '✅ ' : '⏳ '}${task.title}
                        </div>
                        <div class="actions">
                            <button class="btn-icon delete" onclick="removeTask(${index})">✕</button>
                        </div>
                    </li>
                `;
            });
        }

        fetchTasks();
    </script>
</body>
</html>
"""

# --- TELEGRAM BOT LOGIC ---
async def send_telegram_message(chat_id, text, web_app_url):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {
            "inline_keyboard": [[{"text": "🌐 Open Task Manager", "web_app": {"url": web_app_url}}]]
        }
    }
    await fetch(url, method="POST", headers={"Content-Type": "application/json"}, body=json.dumps(payload))


# --- CLOUDFLARE ROUTER ---
async def on_fetch(request, env):
    url = str(request.url)
    method = request.method
    
    # Extract Base URL and Path safely
    base_url = "/".join(url.split("/")[:3])
    path = "/" + "/".join(url.split("/")[3:]).split("?")[0]
    if path == "/": path = ""

    json_headers = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
    html_headers = {"Content-Type": "text/html"}

    # 1. LINK BOT TO CLOUDFLARE
    if path == "/setup":
        webhook_url = f"{base_url}/webhook"
        tg_api = f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook?url={webhook_url}"
        res = await fetch(tg_api)
        text_data = await res.text()
        return Response.new(text_data, headers=json_headers)

    # 2. RESPOND TO /start
    if path == "/webhook" and method == "POST":
        req_text = await request.text()
        try:
            update = json.loads(req_text)
            if "message" in update and "text" in update["message"]:
                msg = update["message"]
                if msg["text"].startswith("/start"):
                    chat_id = msg["chat"]["id"]
                    first_name = msg["from"].get("first_name", "User")
                    text = f"👋 Welcome, <b>{first_name}</b>!\n\nClick the button below to manage your tasks."
                    await send_telegram_message(chat_id, text, base_url)
        except Exception:
            pass
        return Response.new("OK", status=200)

    # 3. SHOW MINI APP UI
    if path == "" or path == "/index.html":
        return Response.new(HTML_CONTENT, headers=html_headers)

    # 4. LOAD TASKS
    if path == "/api/tasks" and method == "GET":
        user_id = "default"
        if "?user_id=" in url:
            user_id = url.split("user_id=")[-1].split("&")[0]
        
        # Uses 'tasks_' prefix
        db_data = await env.TASKS_KV.get(f"tasks_{user_id}")
        if not db_data:
            db_data = "[]"
        return Response.new(db_data, headers=json_headers)

    # 5. SAVE TASKS
    if path == "/api/tasks" and method == "POST":
        req_text = await request.text()
        data = json.loads(req_text)
        user_id = str(data.get("user_id", "default"))
        tasks_json = json.dumps(data.get("tasks", []))
        
        # Saves to 'tasks_' prefix
        await env.TASKS_KV.put(f"tasks_{user_id}", tasks_json)
        return Response.new(json.dumps({"success": True}), headers=json_headers)

    return Response.new("Not Found", status=404)
