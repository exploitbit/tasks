const { Telegraf } = require('telegraf');
const { createCanvas, loadImage } = require('canvas');
const axios = require('axios'); // Required to prove it's installed

// --- CONFIGURATION ---
const BOT_TOKEN = '8716545255:AAEevulA_Q8sz-cjEXs_9-mN8leuoGI-RSk'; 
const ADMIN_ID = '8781152810'; // Your Telegram User ID for the startup notification

const bot = new Telegraf(BOT_TOKEN);

// --- HELPER: Draw EMV Smart Chip ---
function drawSmartChip(ctx, x, y) {
    const gradient = ctx.createLinearGradient(x, y, x + 90, y + 70);
    gradient.addColorStop(0, '#fde047');
    gradient.addColorStop(0.5, '#fbbf24');
    gradient.addColorStop(1, '#b45309');

    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    
    ctx.beginPath();
    ctx.roundRect(x, y, 90, 70, 10);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    ctx.moveTo(x + 25, y); ctx.lineTo(x + 25, y + 70);
    ctx.moveTo(x + 65, y); ctx.lineTo(x + 65, y + 70);
    ctx.moveTo(x, y + 20); ctx.lineTo(x + 25, y + 20);
    ctx.moveTo(x + 65, y + 20); ctx.lineTo(x + 90, y + 20);
    ctx.moveTo(x, y + 50); ctx.lineTo(x + 25, y + 50);
    ctx.moveTo(x + 65, y + 50); ctx.lineTo(x + 90, y + 50);
    ctx.ellipse(x + 45, y + 35, 15, 25, 0, 0, Math.PI * 2);
    ctx.stroke();
}

// --- HELPER: Draw Fake Barcode ---
function drawBarcode(ctx, x, y, width, height) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    let currentX = x;
    while (currentX < x + width) {
        let barWidth = Math.random() * 6 + 1;
        if (currentX + barWidth > x + width) break;
        ctx.fillRect(currentX, y, barWidth, height);
        currentX += barWidth + (Math.random() * 5 + 2);
    }
}

// --- BOT COMMAND: /start ---
bot.command('start', async (ctx) => {
    const statusMsg = await ctx.reply("⚙️ Generating your official Data Card...");

    try {
        const userId = ctx.from.id;
        const name = (ctx.from.first_name + " " + (ctx.from.last_name || "")).trim().toUpperCase();
        const username = ctx.from.username ? `@${ctx.from.username}` : "CLASSIFIED";
        
        let randomCode = "";
        for(let i=0; i<12; i++) randomCode += Math.floor(Math.random() * 10);
        const formattedCode = randomCode.match(/.{1,4}/g).join('  ');

        // 1. Initialize Canvas (1280x720)
        const canvas = createCanvas(1280, 720);
        const ctxCanvas = canvas.getContext('2d');

        // 2. Draw Custom Premium Gradient Background
        const bgGradient = ctxCanvas.createLinearGradient(0, 0, 1280, 720);
        bgGradient.addColorStop(0, '#0f172a');   // Very dark slate/navy
        bgGradient.addColorStop(0.5, '#1e3a8a'); // Deep royal blue
        bgGradient.addColorStop(1, '#0284c7');   // Vivid light blue
        
        ctxCanvas.fillStyle = bgGradient;
        ctxCanvas.fillRect(0, 0, 1280, 720);

        // Add a subtle glowing overlay effect in the center to make it look 3D
        const glow = ctxCanvas.createRadialGradient(640, 360, 100, 640, 360, 800);
        glow.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
        glow.addColorStop(1, 'transparent');
        ctxCanvas.fillStyle = glow;
        ctxCanvas.fillRect(0, 0, 1280, 720);

        // 3. Draw Header (Center Top)
        ctxCanvas.textAlign = 'center';
        ctxCanvas.fillStyle = '#ffffff';
        ctxCanvas.font = 'bold 36px sans-serif';
        ctxCanvas.shadowColor = 'rgba(0, 195, 255, 0.8)';
        ctxCanvas.shadowBlur = 15;
        ctxCanvas.fillText('✈️ TELEGRAM', 640, 80);
        
        ctxCanvas.font = 'bold 24px sans-serif';
        ctxCanvas.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctxCanvas.shadowBlur = 5;
        ctxCanvas.fillStyle = '#38bdf8'; 
        ctxCanvas.fillText('CHILDRENS PROVIENCE', 640, 120);

        ctxCanvas.shadowBlur = 0; // Reset shadow

        // 4. Fetch Profile Pic
        let profilePic;
        const photos = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
        if (photos.total_count > 0) {
            const fileId = photos.photos[0][2].file_id;
            const fileUrl = await ctx.telegram.getFileLink(fileId);
            profilePic = await loadImage(fileUrl.href);
        } else {
            profilePic = await loadImage('https://via.placeholder.com/300/38bdf8/ffffff?text=USER');
        }

        // 5. Draw Profile Pic (Left Side)
        const picX = 120, picY = 240, picRadius = 120;

        ctxCanvas.beginPath();
        ctxCanvas.arc(picX + picRadius, picY + picRadius, picRadius + 8, 0, Math.PI * 2);
        ctxCanvas.lineWidth = 6;
        ctxCanvas.strokeStyle = '#38bdf8';
        ctxCanvas.shadowColor = '#38bdf8';
        ctxCanvas.shadowBlur = 20;
        ctxCanvas.stroke();

        ctxCanvas.save();
        ctxCanvas.beginPath();
        ctxCanvas.arc(picX + picRadius, picY + picRadius, picRadius, 0, Math.PI * 2);
        ctxCanvas.closePath();
        ctxCanvas.clip();
        ctxCanvas.drawImage(profilePic, picX, picY, picRadius * 2, picRadius * 2);
        ctxCanvas.restore();

        // 6. Draw Details
        ctxCanvas.textAlign = 'center';
        ctxCanvas.fillStyle = '#94a3b8';
        ctxCanvas.font = 'bold 22px monospace';
        ctxCanvas.fillText(`ID: ${userId}`, picX + picRadius, picY + (picRadius * 2) + 40);

        ctxCanvas.textAlign = 'left';
        ctxCanvas.fillStyle = '#64748b';
        ctxCanvas.font = '20px sans-serif';
        ctxCanvas.fillText('CARDHOLDER NAME', picX + (picRadius * 2) + 50, picY + 60);
        
        ctxCanvas.fillStyle = '#ffffff';
        ctxCanvas.font = 'bold 50px sans-serif';
        ctxCanvas.shadowColor = 'rgba(0,0,0,0.6)';
        ctxCanvas.shadowOffsetY = 4;
        ctxCanvas.shadowBlur = 6;
        const displayName = name.length > 20 ? name.substring(0, 18) + "..." : name;
        ctxCanvas.fillText(displayName, picX + (picRadius * 2) + 50, picY + 120);

        ctxCanvas.fillStyle = '#38bdf8';
        ctxCanvas.font = '32px sans-serif';
        ctxCanvas.shadowBlur = 0; 
        ctxCanvas.fillText(username, picX + (picRadius * 2) + 50, picY + 170);

        drawSmartChip(ctxCanvas, picX + (picRadius * 2) + 50, picY + 220);
        drawBarcode(ctxCanvas, 1050, 40, 180, 50);

        // 7. Embossed 12-Digit Code
        ctxCanvas.textAlign = 'right';
        ctxCanvas.font = 'bold 65px monospace';
        
        ctxCanvas.fillStyle = 'rgba(0,0,0,0.7)';
        ctxCanvas.fillText(formattedCode, 1220 + 3, 650 + 3);
        ctxCanvas.fillStyle = 'rgba(255,255,255,0.3)';
        ctxCanvas.fillText(formattedCode, 1220 - 2, 650 - 2);
        ctxCanvas.fillStyle = '#f8fafc';
        ctxCanvas.fillText(formattedCode, 1220, 650);

        // 8. Convert and Send
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });

        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        await ctx.replyWithPhoto(
            { source: buffer }, 
            { caption: `🪪 <b>Data Card Generated</b>\n\nWelcome to the network, ${username}.`, parse_mode: 'HTML' }
        );

    } catch (error) {
        console.error(error);
        await ctx.reply("❌ An error occurred while rendering your card.");
    }
});

// --- BOOTSTRAP & NOTIFICATIONS ---
bot.launch().then(() => {
    // 1. Log to the terminal/server logs
    console.log("==========================================");
    console.log("✅ SYSTEM ONLINE");
    console.log("📦 Installed & Verified: [telegraf, canvas, axios]");
    console.log("==========================================");

    // 2. Send a Telegram message to the Admin
    const startupMessage = `
🟢 <b>System Online & Deployed!</b>

All requested packages have been installed and verified:
✅ <code>telegraf</code>
✅ <code>canvas</code>
✅ <code>axios</code>

The dynamic image generation engine is ready. Send /start to test!
    `;
    
    bot.telegram.sendMessage(ADMIN_ID, startupMessage, { parse_mode: 'HTML' })
        .catch(err => console.error("Could not send startup message to Admin:", err));
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
