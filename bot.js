const { Telegraf, Markup, session } = require('telegraf');
const PptxGenJS = require("pptxgenjs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

// 1. O'zgaruvchilarni trim() bilan tozalab olish (404 xatosini oldini oladi)
const token = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : '';
const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const adminId = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : 0;

if (!token) {
    console.error("❌ XATO: TELEGRAM_BOT_TOKEN topilmadi!");
    process.exit(1);
}

const bot = new Telegraf(token);
// Gemini AI ulanishi
const genAI = new GoogleGenerativeAI(geminiKey);

let users = {};
bot.use(session());

// Foydalanuvchini tekshirish yoki yaratish funksiyasi
function checkUser(ctx) {
    const userId = ctx.from.id;
    if (!users[userId]) {
        users[userId] = { balance: 5, font: 'Arial', step: '' };
    }
    return users[userId];
}

// --- ASOSIY MENYU ---
const mainMenu = (ctx) => {
    return ctx.reply("✨ SlaydTop AI botiga xush kelibsiz! ❤️\nSlayd mavzusini yozing, AI uni tayyorlab beradi.", 
        Markup.keyboard([
            ['💻 Slayd Yaratish (AI)', '💰 Hisobim'],
            ['⚙️ Sozlamalar', "👨‍💻 Adminga murojaat"]
        ]).resize()
    );
};

bot.start((ctx) => {
    checkUser(ctx);
    mainMenu(ctx);
});

bot.hears('💻 Slayd Yaratish (AI)', (ctx) => {
    const user = checkUser(ctx);
    ctx.reply("Slayd mavzusini yuboring (Masalan: 'O\'zbekistonning diqqatga sazovor joylari'): 📚");
    user.step = 'WAITING_TOPIC';
});

// --- AI ORQALI SLAYD MAZMUNINI YARATISH ---
async function getAIContent(topic) {
    try {
        console.log("🤖 AI sorov yuborilmoqda: ", topic);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Siz professional slayd yaratuvchisiz. '${topic}' mavzusida 5 ta slayd uchun reja va batafsil matn tayyorlang. 
        Muhim: Har bir slaydni 'S:' bilan boshlang va sarlavha bilan matnni '|' bilan ajrating.
        Format:
        S: Sarlavha 1 | Batafsil matn...
        S: Sarlavha 2 | Batafsil matn... `;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log("✅ AI javobi olindi.");
        return text;
    } catch (err) {
        console.error("❌ AI Generation Error Details:", err.message);
        return null;
    }
}

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const user = checkUser(ctx);

    if (user.step === 'WAITING_TOPIC') {
        const topic = ctx.message.text;
        if (topic.length < 3) return ctx.reply("❌ Mavzu juda qisqa.");

        ctx.reply("🤖 AI ma'lumot yig'moqda va slayd yaratmoqda, iltimos kuting... ⏳");
        
        try {
            const aiText = await getAIContent(topic);
            
            if (!aiText) {
                console.log("❌ AI javob bermadi. Kalitni tekshiring.");
                return ctx.reply("❌ Gemini AI bilan ulanib bo'lmadi. Railway-dagi GEMINI_API_KEY kalitingizni tekshiring.");
            }

            const fileName = await createSlayd(topic, aiText, userId);
            await ctx.replyWithDocument({ source: fileName });
            
            if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
        } catch (err) {
            ctx.reply("❌ Slayd yaratishda xatolik yuz berdi. Railway loglarini tekshiring.");
            console.error(err);
        }
        user.step = '';
    }
});

async function createSlayd(topic, aiContent, userId) {
    let pptx = new PptxGenJS();
    // AI matnini slaydlarga ajratish
    let slidesData = aiContent.split('S:').filter(s => s.trim().length > 5);

    if (slidesData.length === 0) {
        let slide = pptx.addSlide();
        slide.addText(topic, { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true });
        slide.addText(aiContent, { x: 0.5, y: 1.5, w: '90%', fontSize: 14 });
    } else {
        slidesData.forEach(s => {
            let slide = pptx.addSlide();
            let parts = s.split('|');
            slide.addText(parts[0]?.trim() || topic, { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636' });
            slide.addText(parts[1]?.trim() || "", { x: 0.5, y: 1.5, w: '90%', fontSize: 16, color: '666666' });
        });
    }

    const name = `Slayd_${userId}.pptx`;
    await pptx.writeFile({ fileName: name });
    return name;
}

bot.launch()
    .then(() => console.log("✅ Bot muvaffaqiyatli ishga tushdi!"))
    .catch((err) => console.error("❌ Botni ishga tushirishda xato:", err));

// Railway uchun Health Check
const http = require('http');
http.createServer((req, res) => { res.write('Bot is running!'); res.end(); }).listen(process.env.PORT || 3000);
