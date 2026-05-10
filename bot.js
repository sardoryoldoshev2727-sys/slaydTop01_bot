const { Telegraf, Markup, session } = require('telegraf');
const PptxGenJS = require("pptxgenjs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// ==================== KONFIGURATSIYA ====================
const token = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : '';
const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const adminId = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : 0;
const adminUsername = process.env.ADMIN_USERNAME || '';

if (!token) {
    console.error("❌ XATO: TELEGRAM_BOT_TOKEN topilmadi!");
    process.exit(1);
}

// ==================== GLOBAL O'ZGARUVCHILAR ====================
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
const DATA_DIR = path.join(__dirname, 'data');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const ASSETS_DIR = path.join(__dirname, 'assets');

// Papkalarni yaratish
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Ma'lumotlar fayllari
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// ==================== NARXLAR ====================
const PRICES = {
    slides: { 1: 2000, 2: 3000, 4: 5000, 8: 8000, 12: 10000 },
    slidesCount: {
        2000: { min: 5, max: 6 },
        3000: { min: 5, max: 8 },
        5000: { min: 5, max: 12 },
        8000: { min: 9, max: 25 },
        10000: { min: 9, max: 25 }
    },
    crossword: { 10: 1000, 15: 2000, 20: 3000 },
    test: { 1: 100, 10: 1000 },
    insho: { perWord: 10 },
    essey: { perWord: 10 },
    referat: { perPage: 500 },
    mustaqil: { perPage: 500 },
    tezis: { perWord: 10 },
    glossary: { perItem: 200 }
};

// ==================== YORDAMCHI FUNKSIYALAR ====================
function loadJson(filePath, defaultValue = {}) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error(`Fayl yuklash xatosi: ${filePath}`, e.message);
    }
    return defaultValue;
}

function saveJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getUser(userId) {
    const users = loadJson(USERS_FILE);
    if (!users[userId]) {
        users[userId] = {
            id: userId,
            name: '',
            surname: '',
            university: '',
            group: '',
            balance: 0,
            freeSlidesUsed: 0,
            totalSlides: 0,
            registered: false,
            step: 'WAITING_NAME',
            lastOrder: null,
            settings: { font: 'Arial' },
            invitedFriends: [],
            isAdmin: userId === adminId
        };
        saveJson(USERS_FILE, users);
    }
    return users[userId];
}

function updateUser(userId, updates) {
    const users = loadJson(USERS_FILE);
    if (users[userId]) {
        users[userId] = { ...users[userId], ...updates };
        saveJson(USERS_FILE, users);
    }
    return users[userId];
}

function addPayment(userId, amount, type, status = 'pending', screenshotFileId = null) {
    const payments = loadJson(PAYMENTS_FILE, []);
    const payment = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        userId,
        amount,
        type,
        status,
        screenshotFileId,
        createdAt: new Date().toISOString(),
        approvedAt: null
    };
    payments.push(payment);
    saveJson(PAYMENTS_FILE, payments);
    return payment;
}

function getPendingPayments() {
    const payments = loadJson(PAYMENTS_FILE, []);
    return payments.filter(p => p.status === 'pending');
}

function approvePayment(paymentId) {
    const payments = loadJson(PAYMENTS_FILE, []);
    const p = payments.find(p => p.id === paymentId);
    if (p) {
        p.status = 'approved';
        p.approvedAt = new Date().toISOString();
        saveJson(PAYMENTS_FILE, payments);
        const user = getUser(p.userId);
        updateUser(p.userId, { balance: user.balance + p.amount });
        return p;
    }
    return null;
}

function addOrder(userId, type, details, fileName) {
    const orders = loadJson(ORDERS_FILE, []);
    orders.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        userId,
        type,
        details,
        fileName,
        rating: null,
        createdAt: new Date().toISOString()
    });
    saveJson(ORDERS_FILE, orders);
}

function getTemplates() {
    return loadJson(TEMPLATES_FILE, []);
}

function getTemplateById(id) {
    const templates = getTemplates();
    return templates.find(t => t.id === id);
}

// ==================== EMOJI YORDAMCHI ====================
const E = {
    smile: '😊',
    wink: '😉',
    laugh: '😂',
    star: '⭐',
    fire: '🔥',
    rocket: '🚀',
    chart: '📊',
    book: '📚',
    pencil: '✏️',
    money: '💰',
    card: '💳',
    phone: '📱',
    check: '✅',
    wrong: '❌',
    clock: '⏳',
    gift: '🎁',
    crown: '👑',
    brain: '🧠',
    magic: '✨',
    heart: '❤️',
    clap: '👏',
    trophy: '🏆',
    light: '💡',
    back: '◀️',
    lock: '🔒',
    unlock: '🔓',
    warning: '⚠️',
    info: 'ℹ️',
    robot: '🤖',
    download: '⬇️',
    upload: '⬆️',
    search: '🔍',
    settings: '⚙️',
    admin: '👨‍💻',
    pen: '🖊️',
    doc: '📄',
    quiz: '❓',
    grid: '🔲',
    essay: '📝',
    university: '🏛️',
    group: '👥',
    pic: '🖼️'
};

// ==================== KLAVIATURALAR ====================
const Keyboards = {
    mainMenu: (isAdmin = false) => {
        const buttons = [
            [`${E.magic} Slayd Yaratish`, `${E.money} Hisobim`],
            [`${E.pic} Shablonlar`, `${E.gift} Do'stlarni Taklif Qilish`],
            [`${E.quiz} Test`, `${E.grid} Krassvord`],
            [`${E.essay} Insho/Esse`, `${E.doc} Referat/Mustaqil`],
            [`${E.pen} Tezis`, `${E.book} Glossariy`],
            [`${E.settings} Sozlamalar`, `${E.admin} Adminga Murojaat`]
        ];
        if (isAdmin) {
            buttons.push([`${E.admin} Admin Panel`]);
        }
        return Markup.keyboard(buttons).resize();
    },

    cancel: () => Markup.keyboard([[`${E.wrong} Bekor Qilish`]]).resize(),

    backToMenu: () => Markup.keyboard([[`${E.back} Asosiy Menyu`]]).resize(),

    slideCount: () => Markup.keyboard([
        ['5', '6', '7', '8'],
        ['9', '10', '11', '12'],
        [`${E.wrong} Bekor Qilish`]
    ]).resize(),

    templateMenu: () => Markup.keyboard([
        [`${E.pic} Shablonlarni Ko'rish`],
        [`${E.magic} Shablonsiz (Oddiy) Yaratish`],
        [`${E.wrong} Bekor Qilish`]
    ]).resize(),

    rating: () => Markup.inlineKeyboard([
        [
            Markup.button.callback(`${E.star}`, 'rate_1'),
            Markup.button.callback(`${E.star}${E.star}`, 'rate_2'),
            Markup.button.callback(`${E.star}${E.star}${E.star}`, 'rate_3'),
            Markup.button.callback(`${E.star}${E.star}${E.star}${E.star}`, 'rate_4'),
            Markup.button.callback(`${E.star}${E.star}${E.star}${E.star}${E.star}`, 'rate_5')
        ]
    ]),

    paymentMethods: () => Markup.keyboard([
        [`${E.card} Click orqali to'lov`],
        [`${E.card} Payme orqali to'lov`],
        [`${E.phone} Admin bilan bog'lanish`],
        [`${E.wrong} Bekor Qilish`]
    ]).resize(),

    confirmPayment: () => Markup.keyboard([
        [`${E.upload} Chekni Yuborish`],
        [`${E.wrong} Bekor Qilish`]
    ]).resize(),

    difficulty: () => Markup.keyboard([
        ['🟢 Oson', "🟡 O'rta", '🔴 Murakkab'],
        [`${E.wrong} Bekor Qilish`]
    ]).resize(),

    crosswordCount: () => Markup.keyboard([
        ["10 ta savol - 1,000 so'm", "15 ta savol - 2,000 so'm"],
        ["20 ta savol - 3,000 so'm"],
        [`${E.wrong} Bekor Qilish`]
    ]).resize(),

    testCount: () => Markup.keyboard([
        ["1 ta test - 100 so'm", "5 ta test - 500 so'm"],
        ["10 ta test - 1,000 so'm"],
        [`${E.wrong} Bekor Qilish`]
    ]).resize(),

    yesNo: () => Markup.keyboard([
        [`${E.check} Ha`, `${E.wrong} Yo'q`]
    ]).resize()
};


// ==================== AI KONTENT YARATISH ====================
async function getAIContent(topic, slideCount = 5, type = 'slides') {
    if (!genAI) {
        console.error("❌ Gemini AI kalit so'z topilmadi!");
        return null;
    }
    try {
        console.log("🤖 AI so'rov yuborilmoqda:", topic, type);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let prompt = '';

        if (type === 'slides') {
            prompt = `Siz professional PowerPoint tayyorlovchisiz. "${topic}" mavzusida ${slideCount} ta slayd uchun professional reja va batafsil matn tayyorlang.

QOIDALAR:
- Har bir slaydni "SLIDE:" bilan boshlang
- Sarlavha va matnni "|" bilan ajrating
- Professional, ilmiy uslubda yozing
- Har bir slayd 2-3 ta gapdan iborat bo'lsin
- O'zbek tilida yozing

FORMAT:
SLIDE: Sarlavha 1 | Batafsil matn...
SLIDE: Sarlavha 2 | Batafsil matn...

Jami ${slideCount} ta slayd bo'lishi SHART.`;
        } else if (type === 'crossword') {
            const count = slideCount;
            prompt = `"${topic}" mavzusida ${count} ta savoldan iborat krassvord yaratish uchun ma'lumot tayyorlang.

QOIDALAR:
- Har bir savolni "SAVOL:" bilan boshlang
- Savol va javobni "|" bilan ajrating
- Javoblar katta harflar bilan, bo'shliqsiz yozilsin
- O'zbek tilida

FORMAT:
SAVOL: 1 | Savol matni | JAVOB
SAVOL: 2 | Savol matni | JAVOB`;
        } else if (type === 'test') {
            const count = slideCount;
            prompt = `"${topic}" mavzusida ${count} ta test savoli va 4 ta variantdan iborat test yaratish uchun ma'lumot tayyorlang.

QOIDALAR:
- Har bir testni "TEST:" bilan boshlang
- To'g'ri javobni ko'rsating
- O'zbek tilida

FORMAT:
TEST: 1 | Savol matni | A) variant 1 | B) variant 2 | C) variant 3 | D) variant 4 | To'g'ri: A`;
        } else if (type === 'insho' || type === 'essey') {
            const wordCount = slideCount;
            prompt = `"${topic}" mavzusida ${wordCount} so'zdan iborat ${type === 'insho' ? 'insho' : 'esse'} yozing.

QOIDALAR:
- Professional, ilmiy uslubda
- Kirish, asosiy qism va xulosa bo'lishi kerak
- O'zbek tilida
- Aniq ${wordCount} so'z bo'lishi kerak (ko'paytirmang, kamaytirmang)`;
        } else if (type === 'referat' || type === 'mustaqil') {
            const pageCount = slideCount;
            prompt = `"${topic}" mavzusida ${pageCount} betdan iborat ${type === 'referat' ? 'referat' : 'mustaqil ish'} uchun kontent tayyorlang.

QOIDALAR:
- Har bir sahifani "BET:" bilan boshlang
- Professional, ilmiy uslubda
- O'zbek tilida
- Muqova, reja, kirish, asosiy qism, xulosa, foydalanilgan adabiyotlar bo'lishi kerak

FORMAT:
BET: 1 | Muqova | ...
BET: 2 | Reja | ...`;
        } else if (type === 'tezis') {
            const wordCount = slideCount;
            prompt = `"${topic}" mavzusida ${wordCount} so'zdan iborat tezis yozing.

QOIDALAR:
- Qisqa, mazmunli
- Ilmiy uslubda
- O'zbek tilida`;
        } else if (type === 'glossary') {
            const count = slideCount;
            prompt = `"${topic}" mavzusida ${count} ta glossariy so'zlari ro'yxatini tuzing.

QOIDALAR:
- Har bir so'zni "SOZ:" bilan boshlang
- So'z, qaysi tildan olinganligi, ta'rifi
- O'zbek tilida

FORMAT:
SOZ: 1 | So'z | Til | Ta'rif`;
        }

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log("✅ AI javobi olindi. Uzunlik:", text.length);
        return text;
    } catch (err) {
        console.error("❌ AI Generation Error:", err.message);
        return null;
    }
}

// ==================== PPTX FAYL YARATISH ====================
async function createSlayd(topic, aiContent, userId, templateId = null, slideCount = 5) {
    const pptx = new PptxGenJS();
    const user = getUser(userId);
    const fontFace = user.settings?.font || 'Arial';

    // SHABLON QO'LLASH (YANGILANGAN TIZIM)
    if (templateId) {
        // templateId masalan "1" yoki "01" kelsa, uni "template_01.pptx" ga aylantiramiz
        const tId = templateId.toString().padStart(2, '0');
        const templatePath = path.join(__dirname, 'templates', `template_${tId}.pptx`);
        
        if (fs.existsSync(templatePath)) {
            try {
                pptx.layout = { name: "LAYOUT_FROM_TEMPLATE" };
                console.log(`✅ Shablon topildi: template_${tId}.pptx`);
            } catch (e) {
                console.log("⚠️ Shablonni o'qishda xatolik, oddiy dizayn ishlatiladi");
            }
        } else {
            console.log(`❌ Shablon topilmadi: ${templatePath}`);
        }
    }

    // Slaydlarni ajratib olish
    let slidesData = aiContent.split(/SLIDE:|Slide:|S:/i).filter(s => s.trim().length > 5);

    // Agar slaydlar ajratilmagan bo'lsa, butun matnni bir slaydga joylash
    if (slidesData.length === 0) {
        slidesData = [aiContent];
    }

    // Muqova slaydi
    const coverSlide = pptx.addSlide();
    coverSlide.background = { color: '1a237e' };
    coverSlide.addText(topic, {
        x: 0.5, y: 1.5, w: '90%',
        fontSize: 32,
        bold: true,
        color: 'FFFFFF',
        fontFace: fontFace,
        align: 'center'
    });
    coverSlide.addText(`Tayyorlandi: SlaydTop AI\n${user.name || 'Foydalanuvchi'}`, {
        x: 0.5, y: 3, w: '90%',
        fontSize: 14,
        color: 'BDBDBD',
        fontFace: fontFace,
        align: 'center'
    });

    // Har bir slaydni yaratish
    let actualCount = 0;
    slidesData.forEach((s, idx) => {
        if (actualCount >= slideCount && slideCount > 0) return;

        const slide = pptx.addSlide();
        slide.background = { color: 'F5F5F5' };

        let parts = s.split('|').map(p => p.trim());
        let title = parts[0] || `${topic} - ${idx + 1}`;
        let content = parts[1] || s;

        // Agar sarlavha raqam bilan boshlansa, tozalash
        title = title.replace(/^\d+[:.\-]?\s*/, '').trim();

        slide.addText(title, {
            x: 0.5, y: 0.5, w: '90%',
            fontSize: 24,
            bold: true,
            color: '1a237e',
            fontFace: fontFace
        });

        slide.addText(content, {
            x: 0.5, y: 1.5, w: '90%',
            fontSize: 16,
            color: '333333',
            fontFace: fontFace
        });

        actualCount++;
    });

    const name = `Slayd_${userId}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: name });
    return name;
}
async function createCrosswordPPTX(topic, aiContent, userId, questionCount) {
    const pptx = new PptxGenJS();
    const user = getUser(userId);

    // Savollarni ajratib olish
    const questions = aiContent.split(/SAVOL:/i).filter(s => s.trim().length > 3);

    // 1-bet: Savollar
    const slide1 = pptx.addSlide();
    slide1.background = { color: 'E8F5E9' };
    slide1.addText(`Krassvord: ${topic}`, { x: 0.5, y: 0.3, w: '90%', fontSize: 24, bold: true, color: '2E7D32' });
    slide1.addText(`${questionCount} ta savol`, { x: 0.5, y: 0.8, w: '90%', fontSize: 14, color: '666666' });

    let qText = '';
    questions.forEach((q, i) => {
        const parts = q.split('|').map(p => p.trim());
        if (parts.length >= 2) {
            qText += `${i + 1}. ${parts[1] || parts[0]}\n`;
        }
    });
    slide1.addText(qText, { x: 0.5, y: 1.2, w: '90%', fontSize: 14, color: '333333' });

    // 2-bet: Katakchalar (raqamlar bilan)
    const slide2 = pptx.addSlide();
    slide2.background = { color: 'FFF3E0' };
    slide2.addText('Katakchalar (raqamlar bilan)', { x: 0.5, y: 0.5, w: '90%', fontSize: 20, bold: true, color: 'E65100' });
    slide2.addText('Savollar raqamlari katakchalarga yoziladi', { x: 0.5, y: 1.5, w: '90%', fontSize: 14, color: '666666' });

    // 3-bet: Javoblar kaliti
    const slide3 = pptx.addSlide();
    slide3.background = { color: 'E3F2FD' };
    slide3.addText('Javoblar Kaliti', { x: 0.5, y: 0.5, w: '90%', fontSize: 20, bold: true, color: '1565C0' });

    let aText = '';
    questions.forEach((q, i) => {
        const parts = q.split('|').map(p => p.trim());
        if (parts.length >= 3) {
            aText += `${i + 1}. ${parts[2] || parts[parts.length - 1]}\n`;
        }
    });
    slide3.addText(aText, { x: 0.5, y: 1.2, w: '90%', fontSize: 14, color: '333333' });

    const name = `Krassvord_${userId}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: name });
    return name;
}

async function createTestPPTX(topic, aiContent, userId, testCount, difficulty) {
    const pptx = new PptxGenJS();
    const user = getUser(userId);

    const tests = aiContent.split(/TEST:/i).filter(s => s.trim().length > 3);

    // Savollar slaydi
    const slide1 = pptx.addSlide();
    slide1.background = { color: 'F3E5F5' };
    slide1.addText(`Test: ${topic}`, { x: 0.5, y: 0.3, w: '90%', fontSize: 24, bold: true, color: '6A1B9A' });
    slide1.addText(`${testCount} ta savol | Daraja: ${difficulty}`, { x: 0.5, y: 0.8, w: '90%', fontSize: 14, color: '666666' });

    let testText = '';
    tests.forEach((t, i) => {
        const parts = t.split('|').map(p => p.trim());
        if (parts.length >= 2) {
            testText += `${i + 1}. ${parts[1] || parts[0]}\n`;
            for (let j = 2; j < parts.length - 1; j++) {
                testText += `   ${parts[j]}\n`;
            }
            testText += `\n`;
        }
    });
    slide1.addText(testText, { x: 0.5, y: 1.2, w: '90%', fontSize: 13, color: '333333' });

    // Javoblar kaliti
    const slide2 = pptx.addSlide();
    slide2.background = { color: 'E8F5E9' };
    slide2.addText('Javoblar Kaliti', { x: 0.5, y: 0.5, w: '90%', fontSize: 20, bold: true, color: '2E7D32' });

    let keyText = '';
    tests.forEach((t, i) => {
        const parts = t.split('|').map(p => p.trim());
        const lastPart = parts[parts.length - 1] || '';
        const match = lastPart.match(/[A-D]/);
        keyText += `${i + 1}. ${match ? match[0] : '?'}  `;
        if ((i + 1) % 5 === 0) keyText += '\n';
    });
    slide2.addText(keyText, { x: 0.5, y: 1.5, w: '90%', fontSize: 16, color: '333333' });

    const name = `Test_${userId}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: name });
    return name;
}

async function createEssayPPTX(topic, aiContent, userId, type, wordCount) {
    const pptx = new PptxGenJS();
    const user = getUser(userId);

    const slide = pptx.addSlide();
    slide.background = { color: 'ECEFF1' };
    slide.addText(`${type === 'insho' ? 'Insho' : 'Esse'}: ${topic}`, { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: '37474F' });
    slide.addText(`${wordCount} so'z | ${user.university || ''} | ${user.group || ''}`, { x: 0.5, y: 0.8, w: '90%', fontSize: 12, color: '666666' });
    slide.addText(aiContent, { x: 0.5, y: 1.3, w: '90%', fontSize: 14, color: '333333' });

    const name = `${type === 'insho' ? 'Insho' : 'Esse'}_${userId}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: name });
    return name;
}

async function createReferatPPTX(topic, aiContent, userId, type, pageCount) {
    const pptx = new PptxGenJS();
    const user = getUser(userId);

    const pages = aiContent.split(/BET:/i).filter(s => s.trim().length > 3);

    // Muqova
    const cover = pptx.addSlide();
    cover.background = { color: '263238' };
    cover.addText(type === 'referat' ? 'REFERAT' : 'MUSTAQIL ISH', { x: 0.5, y: 1.2, w: '90%', fontSize: 36, bold: true, color: 'FFFFFF', align: 'center' });
    cover.addText(`Mavzu: ${topic}`, { x: 0.5, y: 2.2, w: '90%', fontSize: 20, color: 'B0BEC5', align: 'center' });
    cover.addText(`Bajardi: ${user.name || ''} ${user.surname || ''}\nGuruh: ${user.group || ''}\n${user.university || ''}`, { x: 0.5, y: 3.2, w: '90%', fontSize: 14, color: '90A4AE', align: 'center' });

    // Har bir sahifa
    pages.forEach(p => {
        const parts = p.split('|').map(x => x.trim());
        const slide = pptx.addSlide();
        slide.background = { color: 'FAFAFA' };
        slide.addText(parts[1] || 'Sarlavha', { x: 0.5, y: 0.5, w: '90%', fontSize: 20, bold: true, color: '263238' });
        slide.addText(parts[2] || p, { x: 0.5, y: 1.3, w: '90%', fontSize: 14, color: '333333' });
    });

    const name = `${type === 'referat' ? 'Referat' : 'MustaqilIsh'}_${userId}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: name });
    return name;
}

async function createGlossaryPPTX(topic, aiContent, userId, count) {
    const pptx = new PptxGenJS();
    const user = getUser(userId);

    const items = aiContent.split(/SOZ:/i).filter(s => s.trim().length > 3);

    const slide = pptx.addSlide();
    slide.background = { color: 'FFF8E1' };
    slide.addText(`Glossariy: ${topic}`, { x: 0.5, y: 0.3, w: '90%', fontSize: 24, bold: true, color: 'F57F17' });
    slide.addText(`${count} ta so'z`, { x: 0.5, y: 0.8, w: '90%', fontSize: 14, color: '666666' });

    let text = '';
    items.forEach((item, i) => {
        const parts = item.split('|').map(p => p.trim());
        if (parts.length >= 3) {
            text += `${i + 1}. ${parts[1] || ''} (${parts[2] || ''}) - ${parts[3] || ''}\n\n`;
        }
    });
    slide.addText(text, { x: 0.5, y: 1.3, w: '90%', fontSize: 14, color: '333333' });

    const name = `Glossary_${userId}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: name });
    return name;
}


// ==================== BOT YARATISH VA HANDLERLAR ====================
const bot = new Telegraf(token);
bot.use(session());

// Session middleware
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// ==================== REGISTRATSIYA HANDLERLARI ====================
async function handleRegistration(ctx) {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const text = ctx.message?.text || '';

    if (user.registered) return true;

    if (user.step === 'WAITING_NAME') {
        if (!text || text.length < 2) {
            return ctx.reply(`${E.warning} Iltimos, to'g'ri ism kiriting:`);
        }
        updateUser(userId, { name: text, step: 'WAITING_SURNAME' });
        return ctx.reply(`${E.smile} Juda yaxshi! Endi familyangizni kiriting:`);
    }

    if (user.step === 'WAITING_SURNAME') {
        if (!text || text.length < 2) {
            return ctx.reply(`${E.warning} Iltimos, to'g'ri familya kiriting:`);
        }
        updateUser(userId, { surname: text, step: 'WAITING_UNIVERSITY' });
        return ctx.reply(`${E.university} Ajoyib! O'qiyotgan universitet / maktabingiz nomini kiriting:`);
    }

    if (user.step === 'WAITING_UNIVERSITY') {
        if (!text || text.length < 2) {
            return ctx.reply(`${E.warning} Iltimos, to'g'ri universitet nomini kiriting:`);
        }
        updateUser(userId, { university: text, step: 'WAITING_GROUP' });
        return ctx.reply(`${E.group} Zo'r! Guruh / sinfingizni kiriting (masalan: 321-guruh):`);
    }

    if (user.step === 'WAITING_GROUP') {
        if (!text || text.length < 2) {
            return ctx.reply(`${E.warning} Iltimos, to'g'ri guruh kiriting:`);
        }
        updateUser(userId, { group: text, registered: true, step: 'MAIN_MENU', freeSlidesUsed: 0 });
        await ctx.reply(
            `${E.trophy} Tabriklaymiz, ${user.name}! Ro'yxatdan o'tdingiz!\n\n` +
            `${E.gift} Sizga 2 ta BEPUL slayd sovg'a!\n` +
            `${E.rocket} Keling, birga ajoyib ishlar yaratalim!`,
            Keyboards.mainMenu(userId === adminId)
        );
        return false;
    }

    return true;
}

// ==================== START KOMANDASI ====================
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);

    if (!user.registered) {
        updateUser(userId, { step: 'WAITING_NAME' });
        return ctx.reply(
            `${E.magic} SlaydTop AI botiga xush kelibsiz! ${E.heart}\n\n` +
            `Men sizga professional slaydlar, testlar, krassvordlar va boshqa foydali materiallar yaratib beraman!\n\n` +
            `${E.smile} Avval ro'yxatdan o'taylik. Ismingizni kiriting:`
        );
    }

    return ctx.reply(
        `${E.magic} Qaytib kelganingizdan xursandmiz, ${user.name}! ${E.wink}\n` +
        `Nima yaratamiz bugun?`,
        Keyboards.mainMenu(userId === adminId)
    );
});

// ==================== ASOSIY MENYU HANDLERLARI ====================
bot.hears(`${E.magic} Slayd Yaratish`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    updateUser(userId, { step: 'SLAYD_TOPIC' });
    ctx.reply(
        `${E.pencil} Ajoyib! Mavzuni kiriting, sizni kutib qolaman ${E.laugh}\n\n` +
        `Masalan: "O'zbekistonning diqqatga sazovor joylari" ${E.rocket}`,
        Keyboards.cancel()
    );
});

bot.hears(`${E.money} Hisobim`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    const freeLeft = Math.max(0, 2 - (user.freeSlidesUsed || 0));

    ctx.reply(
        `${E.money} Sizning hisobingiz\n\n` +
        `👤 Ism: ${user.name} ${user.surname}\n` +
        `🏛️ Universitet: ${user.university}\n` +
        `👥 Guruh: ${user.group}\n` +
        `${E.money} Balans: ${user.balance.toLocaleString()} so'm\n` +
        `${E.gift} Bepul slaydlar: ${freeLeft} ta qoldi\n` +
        `${E.chart} Jami yaratilgan slaydlar: ${user.totalSlides || 0}\n\n` +
        `Pul yuklash uchun "Do'stlarni Taklif Qilish" yoki to'lov qiling!`,
        Keyboards.mainMenu(userId === adminId)
    );
});

bot.hears(`${E.gift} Do'stlarni Taklif Qilish`, async (ctx) => {
    const userId = ctx.from.id;
    // user allaqachon yuqorida olingan

    const inviteLink = `https://t.me/${ctx.botInfo?.username || 'SlaydTopBot'}?start=ref_${userId}`;
    ctx.reply(
        `${E.gift} Do'stlaringizni taklif qiling va BEPUL slayd oling!\n\n` +
        `Har bir ro'yxatdan o'tgan do'stingiz uchun +1 slayd!\n\n` +
        `Sizning havolangiz:\n${inviteLink}\n\n` +
        `${E.rocket} Do'stlaringizga ulashing!`,
        Keyboards.mainMenu(userId === adminId)
    );
});

bot.hears(`${E.settings} Sozlamalar`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    ctx.reply(
        `${E.settings} Sozlamalar\n\n` +
        `Shrift: ${user.settings?.font || 'Arial'}\n` +
        `Ism: ${user.name}\n` +
        `Familya: ${user.surname}\n` +
        `Universitet: ${user.university}\n` +
        `Guruh: ${user.group}`,
        Keyboards.mainMenu(userId === adminId)
    );
});

bot.hears(`${E.admin} Adminga Murojaat`, async (ctx) => {
    const userId = ctx.from.id;
    updateUser(userId, { step: 'CONTACT_ADMIN' });
    ctx.reply(
        `${E.admin} Adminga xabar yuborish. Iltimos, xabaringizni yozing:`
    );
});

// ==================== SLAYD YARATISH JARAYONI ====================
bot.hears(`${E.pic} Shablonlar`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    const templates = getTemplates();
    if (templates.length === 0) {
        return ctx.reply(
            `${E.warning} Hozircha shablonlar mavjud emas.\n` +
            `Oddiy slayd yaratishni tanlang!`,
            Keyboards.mainMenu(userId === adminId)
        );
    }

    // Template preview list
    let msg = `${E.pic} Mavjud shablonlar:\n\n`;
    templates.forEach((t, i) => {
        const price = t.price || 0;
        msg += `${i + 1}. ${t.name} - ${price > 0 ? price.toLocaleString() + ' so\'m' : 'Bepul'}\n`;
    });
    msg += `\nShablon ID raqamini yuboring (1-${templates.length})`;

    updateUser(userId, { step: 'SELECTING_TEMPLATE' });
    ctx.reply(msg, Keyboards.cancel());
});

// ==================== KRASSVORD HANDLER ====================
bot.hears(`${E.grid} Krassvord`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    updateUser(userId, { step: 'CROSSWORD_TOPIC' });
    ctx.reply(
        `${E.grid} Krassvord mavzusini kiriting:\n` +
        `Masalan: "O'zbekiston tarixi"`,
        Keyboards.cancel()
    );
});

// ==================== TEST HANDLER ====================
bot.hears(`${E.quiz} Test`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    updateUser(userId, { step: 'TEST_TOPIC' });
    ctx.reply(
        `${E.quiz} Test mavzusini kiriting:\n` +
        `Masalan: "Biologiya - O'simliklar dunyosi"`,
        Keyboards.cancel()
    );
});

// ==================== INSHO/ESSE HANDLER ====================
bot.hears(`${E.essay} Insho/Esse`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    updateUser(userId, { step: 'ESSAY_TYPE' });
    ctx.reply(
        `${E.essay} Qaysi turini tanlaysiz?\n\n` +
        `1 ta so'z = 10 so'm\n` +
        `Masalan: 700 so'z = 7,000 so'm`,
        Markup.keyboard([
            [`${E.pen} Insho Yaratish`, `${E.pen} Esse Yaratish`],
            [`${E.wrong} Bekor Qilish`]
        ]).resize()
    );
});

// ==================== REFERAT/MUSTAQIL HANDLER ====================
bot.hears(`${E.doc} Referat/Mustaqil`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    updateUser(userId, { step: 'REFERRAL_TYPE' });
    ctx.reply(
        `${E.doc} Qaysi turini tanlaysiz?\n\n` +
        `1 ta bet = 500 so'm\n` +
        `Masalan: 10 bet = 5,000 so'm`,
        Markup.keyboard([
            [`${E.doc} Referat Yaratish`, `${E.doc} Mustaqil Ish Yaratish`],
            [`${E.wrong} Bekor Qilish`]
        ]).resize()
    );
});

// ==================== TEZIS HANDLER ====================
bot.hears(`${E.pen} Tezis`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    updateUser(userId, { step: 'TEZIS_TOPIC' });
    ctx.reply(
        `${E.pen} Tezis mavzusini kiriting:\n` +
        `1 ta so'z = 10 so'm`,
        Keyboards.cancel()
    );
});

// ==================== GLOSSARIY HANDLER ====================
bot.hears(`${E.book} Glossariy`, async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    if (!user.registered) return handleRegistration(ctx);

    updateUser(userId, { step: 'GLOSSARY_TOPIC' });
    ctx.reply(
        `${E.book} Glossariy mavzusini kiriting:\n` +
        `1 ta so'z = 200 so'm\n` +
        `Masalan: 10 ta = 2,000 so'm`,
        Keyboards.cancel()
    );
});


// ==================== ASOSIY MATN HANDLER (BARCHA STEPLAR UCHUN) ====================
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    let user = getUser(userId);
    const text = ctx.message.text;

    // Ro'yxatdan o'tish
    if (!user.registered) {
        return handleRegistration(ctx);
    }

    // Admin javob
    if (user.step === 'CONTACT_ADMIN' && text !== `${E.wrong} Bekor Qilish`) {
        if (adminId) {
            await bot.telegram.sendMessage(adminId,
                `${E.admin} Yangi murojaat!\n\n` +
                `Kim: ${user.name} ${user.surname} (@${ctx.from.username || 'yo\'q'})\n` +
                `ID: ${userId}\n\n` +
                `Xabar: ${text}`
            );
        }
        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(
            `${E.check} Xabaringiz adminga yuborildi! Tez orada javob beramiz ${E.smile}`,
            Keyboards.mainMenu(userId === adminId)
        );
    }

    // Slayd mavzusi
    if (user.step === 'SLAYD_TOPIC') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        if (text.length < 3) {
            return ctx.reply(`${E.warning} Mavzu juda qisqa. Iltimos, batafsilroq yozing:`);
        }

        ctx.session.topic = text;
        updateUser(userId, { step: 'SLAYD_COUNT' });
        return ctx.reply(
            `${E.smile} Ajoyib mavzu! ${text} ${E.fire}\n\n` +
            `Nechta slayd bo'lishini tanlang?`,
            Keyboards.slideCount()
        );
    }

    // Slayd soni tanlash
    if (user.step === 'SLAYD_COUNT') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }

        const count = parseInt(text);
        if (isNaN(count) || count < 5 || count > 25) {
            return ctx.reply(`${E.warning} Iltimos, 5 dan 25 gacha son kiriting:`);
        }

        // Narxni hisoblash
        let price = 0;
        let packageType = '';

        if (user.freeSlidesUsed < 2) {
            // Bepul
            packageType = 'free';
        } else {
            // Pul paketlarini hisoblash
            if (count <= 6) price = 2000;
            else if (count <= 8) price = 3000;
            else if (count <= 12) price = 5000;
            else if (count <= 25) price = 8000;

            if (user.balance < price) {
                ctx.session.neededAmount = price;
                ctx.session.pendingSlides = { topic: ctx.session.topic, count };
                updateUser(userId, { step: 'NEED_PAYMENT' });
                return ctx.reply(
                    `${E.money} Hisobingizda yetarli mablag' yo'q!\n\n` +
                    `Kerak: ${price.toLocaleString()} so'm\n` +
                    `Balans: ${user.balance.toLocaleString()} so'm\n\n` +
                    `To'lov qilasizmi?`,
                    Keyboards.paymentMethods()
                );
            }
        }

        ctx.session.slideCount = count;
        ctx.session.slidePrice = price;
        updateUser(userId, { step: 'SLAYD_TEMPLATE' });
        return ctx.reply(
            `${E.pic} Shablon tanlaysizmi yoki shablonsiz yaratamiz?\n\n` +
            `${E.magic} Shablonlar bilan yanada chiroyli bo'ladi!`,
            Keyboards.templateMenu()
        );
    }

    // Shablon tanlash
    if (user.step === 'SELECTING_TEMPLATE' || user.step === 'SLAYD_TEMPLATE') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        if (text === `${E.magic} Shablonsiz (Oddiy) Yaratish`) {
            ctx.session.templateId = null;
            return generateAndSendSlides(ctx, userId);
        }
        if (text === `${E.pic} Shablonlarni Ko'rish`) {
            const templates = getTemplates();
            if (templates.length === 0) {
                return ctx.reply(`${E.warning} Shablonlar mavjud emas. Shablonsiz yaratamiz!`, Keyboards.templateMenu());
            }
            // Preview images if available
            templates.forEach((t, idx) => {
                if (t.previewImage && fs.existsSync(t.previewImage)) {
                    ctx.replyWithPhoto({ source: t.previewImage }, {
                        caption: `${idx + 1}. ${t.name}\nNarxi: ${(t.price || 0).toLocaleString()} so\'m`
                    });
                }
            });
            return ctx.reply(`Shablon raqamini kiriting:`);
        }

        // Shablon ID sini tekshirish
        const templates = getTemplates();
        const templateIdx = parseInt(text) - 1;
        if (templateIdx >= 0 && templateIdx < templates.length) {
            ctx.session.templateId = templates[templateIdx].id;
            return generateAndSendSlides(ctx, userId);
        }
    }

    // To'lov jarayoni
    if (user.step === 'NEED_PAYMENT') {
        if (text === `${E.card} Click orqali to'lov`) {
            updateUser(userId, { step: 'WAITING_CLICK_CHECK' });
            return ctx.reply(
                `${E.card} Click orqali to'lov\n\n` +
                `Telefon: +998XX XXX XX XX\n` +
                `Eslatma: ${userId} ID bilan to'lov qiling\n\n` +
                `To'lov chekini skrinshot qilib yuboring!`,
                Keyboards.confirmPayment()
            );
        }
        if (text === `${E.card} Payme orqali to'lov`) {
            updateUser(userId, { step: 'WAITING_PAYME_CHECK' });
            return ctx.reply(
                `${E.card} Payme orqali to'lov\n\n` +
                `Telefon: +998XX XXX XX XX\n` +
                `Eslatma: ${userId} ID bilan to'lov qiling\n\n` +
                `To'lov chekini skrinshot qilib yuboring!`,
                Keyboards.confirmPayment()
            );
        }
        if (text === `${E.phone} Admin bilan bog'lanish`) {
            return ctx.reply(
                `${E.admin} Admin bilan bog'lanish:\n` +
                `Telegram: @${adminUsername || 'admin'}`,
                Keyboards.mainMenu(userId === adminId)
            );
        }
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
    }

    // Krassvord mavzusi
    if (user.step === 'CROSSWORD_TOPIC') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        if (text.length < 3) {
            return ctx.reply(`${E.warning} Mavzu juda qisqa:`);
        }
        ctx.session.crosswordTopic = text;
        updateUser(userId, { step: 'CROSSWORD_COUNT' });
        return ctx.reply(`${E.grid} Nechta savol bo'lishini tanlang:`, Keyboards.crosswordCount());
    }

    // Krassvord soni
    if (user.step === 'CROSSWORD_COUNT') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }

        let count = 10, price = 1000;
        if (text.includes('15')) { count = 15; price = 2000; }
        else if (text.includes('20')) { count = 20; price = 3000; }

        if (user.balance < price) {
            ctx.session.neededAmount = price;
            updateUser(userId, { step: 'NEED_PAYMENT' });
            return ctx.reply(
                `${E.money} Hisobingizda ${price.toLocaleString()} so'm yo'q!\n` +
                `Balans: ${user.balance.toLocaleString()} so'm`,
                Keyboards.paymentMethods()
            );
        }

        updateUser(userId, { balance: user.balance - price });
        ctx.reply(`${E.clock} ${count} ta savoldan iborat krassvord yaratilmoqda... ${E.magic}`);

        const aiContent = await getAIContent(ctx.session.crosswordTopic, count, 'crossword');
        if (!aiContent) {
            return ctx.reply(`${E.wrong} AI xatolik. Qayta urinib ko'ring.`, Keyboards.mainMenu(userId === adminId));
        }

        const fileName = await createCrosswordPPTX(ctx.session.crosswordTopic, aiContent, userId, count);
        await ctx.replyWithDocument({ source: fileName }, {
            caption: `${E.check} Krassvord tayyor! ${E.trophy}\nNarxi: ${price.toLocaleString()} so'm`
        });
        addOrder(userId, 'crossword', { topic: ctx.session.crosswordTopic, count, price }, fileName);
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(`${E.clap} Marhamat! Baho berasizmi?`, Keyboards.rating());
    }

    // Test mavzusi
    if (user.step === 'TEST_TOPIC') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        ctx.session.testTopic = text;
        updateUser(userId, { step: 'TEST_COUNT' });
        return ctx.reply(`${E.quiz} Nechta test bo'lishini tanlang:`, Keyboards.testCount());
    }

    // Test soni
    if (user.step === 'TEST_COUNT') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }

        let count = 1, price = 100;
        if (text.includes('5')) { count = 5; price = 500; }
        else if (text.includes('10')) { count = 10; price = 1000; }

        ctx.session.testCount = count;
        ctx.session.testPrice = price;
        updateUser(userId, { step: 'TEST_DIFFICULTY' });
        return ctx.reply(`${E.brain} Qiyinchilik darajasini tanlang:`, Keyboards.difficulty());
    }

    // Test qiyinchiligi
    if (user.step === 'TEST_DIFFICULTY') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }

        let difficulty = "O'rta";
        if (text.includes('Oson')) difficulty = 'Oson';
        else if (text.includes('Murakkab')) difficulty = 'Murakkab';

        const price = ctx.session.testPrice || 100;
        if (user.balance < price) {
            ctx.session.neededAmount = price;
            updateUser(userId, { step: 'NEED_PAYMENT' });
            return ctx.reply(
                `${E.money} Hisobingizda ${price.toLocaleString()} so'm yo'q!`,
                Keyboards.paymentMethods()
            );
        }

        updateUser(userId, { balance: user.balance - price });
        ctx.reply(`${E.clock} ${ctx.session.testCount} ta test yaratilmoqda (${difficulty})... ${E.magic}`);

        const aiContent = await getAIContent(ctx.session.testTopic, ctx.session.testCount, 'test');
        if (!aiContent) {
            return ctx.reply(`${E.wrong} AI xatolik.`, Keyboards.mainMenu(userId === adminId));
        }

        const fileName = await createTestPPTX(ctx.session.testTopic, aiContent, userId, ctx.session.testCount, difficulty);
        await ctx.replyWithDocument({ source: fileName }, {
            caption: `${E.check} Test tayyor! ${E.trophy}\n${ctx.session.testCount} ta | ${difficulty}\nNarxi: ${price.toLocaleString()} so'm`
        });
        addOrder(userId, 'test', { topic: ctx.session.testTopic, count: ctx.session.testCount, difficulty, price }, fileName);
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(`${E.clap} Marhamat!`, Keyboards.mainMenu(userId === adminId));
    }

    // Insho/Esse tanlash
    if (user.step === 'ESSAY_TYPE') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        if (text.includes('Insho')) ctx.session.essayType = 'insho';
        else if (text.includes('Esse')) ctx.session.essayType = 'essey';

        updateUser(userId, { step: 'ESSAY_TOPIC' });
        return ctx.reply(`${E.pencil} Mavzuni kiriting:`);
    }

    // Insho/Esse mavzusi va so'z soni
    if (user.step === 'ESSAY_TOPIC') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        ctx.session.essayTopic = text;
        updateUser(userId, { step: 'ESSAY_WORDS' });
        return ctx.reply(`${E.info} Nechta so'z bo'lishini kiriting (masalan: 700):`);
    }

    if (user.step === 'ESSAY_WORDS') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        const words = parseInt(text);
        if (isNaN(words) || words < 100) {
            return ctx.reply(`${E.warning} Kamida 100 so'z kiriting:`);
        }

        const price = words * PRICES.insho.perWord;
        if (user.balance < price) {
            ctx.session.neededAmount = price;
            updateUser(userId, { step: 'NEED_PAYMENT' });
            return ctx.reply(
                `${E.money} ${price.toLocaleString()} so'm kerak!\nBalans: ${user.balance.toLocaleString()} so'm`,
                Keyboards.paymentMethods()
            );
        }

        updateUser(userId, { balance: user.balance - price });
        ctx.reply(`${E.clock} ${words} so'zli ${ctx.session.essayType} yaratilmoqda... ${E.magic}`);

        const aiContent = await getAIContent(ctx.session.essayTopic, words, ctx.session.essayType);
        if (!aiContent) {
            return ctx.reply(`${E.wrong} AI xatolik.`, Keyboards.mainMenu(userId === adminId));
        }

        const fileName = await createEssayPPTX(ctx.session.essayTopic, aiContent, userId, ctx.session.essayType, words);
        await ctx.replyWithDocument({ source: fileName }, {
            caption: `${E.check} ${ctx.session.essayType === 'insho' ? 'Insho' : 'Esse'} tayyor! ${E.trophy}\n${words} so'z | ${price.toLocaleString()} so'm`
        });
        addOrder(userId, ctx.session.essayType, { topic: ctx.session.essayTopic, words, price }, fileName);
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(`${E.clap} Marhamat! Baho berasizmi?`, Keyboards.rating());
    }

    // Referat/Mustaqil tanlash
    if (user.step === 'REFERRAL_TYPE') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        if (text.includes('Referat')) ctx.session.referralType = 'referat';
        else if (text.includes('Mustaqil')) ctx.session.referralType = 'mustaqil';

        updateUser(userId, { step: 'REFERRAL_TOPIC' });
        return ctx.reply(`${E.pencil} Mavzuni kiriting:`);
    }

    // Referat/Mustaqil mavzusi va bet soni
    if (user.step === 'REFERRAL_TOPIC') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        ctx.session.referralTopic = text;
        updateUser(userId, { step: 'REFERRAL_PAGES' });
        return ctx.reply(`${E.info} Nechta bet bo'lishini kiriting:`);
    }

    if (user.step === 'REFERRAL_PAGES') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        const pages = parseInt(text);
        if (isNaN(pages) || pages < 1) {
            return ctx.reply(`${E.warning} Kamida 1 bet kiriting:`);
        }

        const price = pages * PRICES.referat.perPage;
        if (user.balance < price) {
            ctx.session.neededAmount = price;
            updateUser(userId, { step: 'NEED_PAYMENT' });
            return ctx.reply(
                `${E.money} ${price.toLocaleString()} so'm kerak!`,
                Keyboards.paymentMethods()
            );
        }

        updateUser(userId, { balance: user.balance - price });
        ctx.reply(`${E.clock} ${pages} betli ${ctx.session.referralType === 'referat' ? 'referat' : 'mustaqil ish'} yaratilmoqda... ${E.magic}`);

        const aiContent = await getAIContent(ctx.session.referralTopic, pages, ctx.session.referralType);
        if (!aiContent) {
            return ctx.reply(`${E.wrong} AI xatolik.`, Keyboards.mainMenu(userId === adminId));
        }

        const fileName = await createReferatPPTX(ctx.session.referralTopic, aiContent, userId, ctx.session.referralType, pages);
        await ctx.replyWithDocument({ source: fileName }, {
            caption: `${E.check} ${ctx.session.referralType === 'referat' ? 'Referat' : 'Mustaqil ish'} tayyor! ${E.trophy}\n${pages} bet | ${price.toLocaleString()} so'm`
        });
        addOrder(userId, ctx.session.referralType, { topic: ctx.session.referralTopic, pages, price }, fileName);
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(`${E.clap} Marhamat! Baho berasizmi?`, Keyboards.rating());
    }

    // Tezis mavzusi va so'z soni
    if (user.step === 'TEZIS_TOPIC') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        ctx.session.tezisTopic = text;
        updateUser(userId, { step: 'TEZIS_WORDS' });
        return ctx.reply(`${E.info} Nechta so'z bo'lishini kiriting:`);
    }

    if (user.step === 'TEZIS_WORDS') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        const words = parseInt(text);
        if (isNaN(words) || words < 50) {
            return ctx.reply(`${E.warning} Kamida 50 so'z kiriting:`);
        }

        const price = words * PRICES.tezis.perWord;
        if (user.balance < price) {
            ctx.session.neededAmount = price;
            updateUser(userId, { step: 'NEED_PAYMENT' });
            return ctx.reply(
                `${E.money} ${price.toLocaleString()} so'm kerak!`,
                Keyboards.paymentMethods()
            );
        }

        updateUser(userId, { balance: user.balance - price });
        ctx.reply(`${E.clock} Tezis yaratilmoqda... ${E.magic}`);

        const aiContent = await getAIContent(ctx.session.tezisTopic, words, 'tezis');
        if (!aiContent) {
            return ctx.reply(`${E.wrong} AI xatolik.`, Keyboards.mainMenu(userId === adminId));
        }

        const pptx = new PptxGenJS();
        const slide = pptx.addSlide();
        slide.background = { color: 'E8EAF6' };
        slide.addText(`Tezis: ${ctx.session.tezisTopic}`, { x: 0.5, y: 0.5, w: '90%', fontSize: 22, bold: true, color: '283593' });
        slide.addText(aiContent, { x: 0.5, y: 1.3, w: '90%', fontSize: 14, color: '333333' });

        const fileName = `Tezis_${userId}_${Date.now()}.pptx`;
        await pptx.writeFile({ fileName });

        await ctx.replyWithDocument({ source: fileName }, {
            caption: `${E.check} Tezis tayyor! ${E.trophy}\n${words} so'z | ${price.toLocaleString()} so'm`
        });
        addOrder(userId, 'tezis', { topic: ctx.session.tezisTopic, words, price }, fileName);
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(`${E.clap} Marhamat!`, Keyboards.mainMenu(userId === adminId));
    }

    // Glossariy mavzusi va soni
    if (user.step === 'GLOSSARY_TOPIC') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        ctx.session.glossaryTopic = text;
        updateUser(userId, { step: 'GLOSSARY_COUNT' });
        return ctx.reply(`${E.info} Nechta so'z bo'lishini kiriting:`);
    }

    if (user.step === 'GLOSSARY_COUNT') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Asosiy menyu`, Keyboards.mainMenu(userId === adminId));
        }
        const count = parseInt(text);
        if (isNaN(count) || count < 1) {
            return ctx.reply(`${E.warning} Kamida 1 ta so'z kiriting:`);
        }

        const price = count * PRICES.glossary.perItem;
        if (user.balance < price) {
            ctx.session.neededAmount = price;
            updateUser(userId, { step: 'NEED_PAYMENT' });
            return ctx.reply(
                `${E.money} ${price.toLocaleString()} so'm kerak!`,
                Keyboards.paymentMethods()
            );
        }

        updateUser(userId, { balance: user.balance - price });
        ctx.reply(`${E.clock} ${count} ta so'zdan iborat glossariy yaratilmoqda... ${E.magic}`);

        const aiContent = await getAIContent(ctx.session.glossaryTopic, count, 'glossary');
        if (!aiContent) {
            return ctx.reply(`${E.wrong} AI xatolik.`, Keyboards.mainMenu(userId === adminId));
        }

        const fileName = await createGlossaryPPTX(ctx.session.glossaryTopic, aiContent, userId, count);
        await ctx.replyWithDocument({ source: fileName }, {
            caption: `${E.check} Glossariy tayyor! ${E.trophy}\n${count} ta so'z | ${price.toLocaleString()} so'm`
        });
        addOrder(userId, 'glossary', { topic: ctx.session.glossaryTopic, count, price }, fileName);
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(`${E.clap} Marhamat!`, Keyboards.mainMenu(userId === adminId));
    }

    // Admin broadcast
    if (userId === adminId && user.step === 'BROADCASTING') {
        if (text === `${E.wrong} Bekor Qilish`) {
            updateUser(userId, { step: 'MAIN_MENU' });
            return ctx.reply(`${E.back} Bekor qilindi.`, Keyboards.mainMenu(true));
        }
        const allUsers = Object.keys(loadJson(USERS_FILE));
        let sent = 0, failed = 0;
        await ctx.reply(`${E.clock} Xabar ${allUsers.length} ta foydalanuvchiga yuborilmoqda...`);
        for (const uid of allUsers) {
            try {
                await bot.telegram.sendMessage(uid, text);
                sent++;
            } catch (e) {
                failed++;
            }
        }
        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(
            `${E.check} Yuborildi: ${sent}\n${E.wrong} Xato: ${failed}`,
            Keyboards.mainMenu(true)
        );
    }

    // Agar hech qaysi step mos kelmasa
    if (!user.step || user.step === 'MAIN_MENU') {
        return ctx.reply(
            `${E.smile} Kechirasiz, tushunmadim. Asosiy menyudan tanlang!`,
            Keyboards.mainMenu(userId === adminId)
        );
    }
});


// ==================== SLAYD GENERATSIYA YORDAMCHI ====================
async function generateAndSendSlides(ctx, userId) {
    const user = getUser(userId);
    const topic = ctx.session.topic;
    const count = ctx.session.slideCount || 5;
    const templateId = ctx.session.templateId || null;
    const price = ctx.session.slidePrice || 0;

    // Balansni kamaytirish (agar bepul bo'lmasa)
    if (user.freeSlidesUsed < 2 && price === 0) {
        updateUser(userId, { freeSlidesUsed: (user.freeSlidesUsed || 0) + 1 });
    } else {
        updateUser(userId, { balance: user.balance - price });
    }

    await ctx.reply(
        `${E.robot} AI ma'lumot yig'moqda va slayd yaratmoqda... ${E.clock}\n` +
        `${E.laugh} Sizdan ziyoda beraman, biroz kuting! ${E.fire}`,
        { reply_markup: { remove_keyboard: true } }
    );

    const aiContent = await getAIContent(topic, count, 'slides');

    if (!aiContent) {
        // Balansni qaytarish
        if (price > 0) updateUser(userId, { balance: user.balance + price });
        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(
            `${E.wrong} Gemini AI bilan ulanib bo'lmadi.\n` +
            `Iltimos, so'ngiroq qayta urinib ko'ring.`,
            Keyboards.mainMenu(userId === adminId)
        );
    }

    await ctx.reply(`${E.magic} Slayd dizayni qilinmoqda... ${E.rocket}`);

    try {
        const fileName = await createSlayd(topic, aiContent, userId, templateId, count);

        await ctx.replyWithDocument({ source: fileName }, {
            caption: `${E.check} Slayd tayyor! ${E.trophy}\n` +
                     `${E.rocket} Siz kirib ko'ring, men professional va umuman muammo bo'lmaydigan mukammal slayd yaratdim! ${E.laugh}\n` +
                     `Korib keyin baholab yuboring!`
        });

        addOrder(userId, 'slides', { topic, count, price, templateId }, fileName);
        updateUser(userId, { totalSlides: (user.totalSlides || 0) + 1, step: 'MAIN_MENU' });

        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        // Baholash
        return ctx.reply(`${E.clap} 1 tadan 5 tagacha yulduzcha baholang:`, Keyboards.rating());
    } catch (err) {
        console.error("Slayd yaratish xatosi:", err);
        if (price > 0) updateUser(userId, { balance: user.balance + price });
        updateUser(userId, { step: 'MAIN_MENU' });
        return ctx.reply(
            `${E.wrong} Slayd yaratishda xatolik: ${err.message}`,
            Keyboards.mainMenu(userId === adminId)
        );
    }
}

// ==================== RASM HANDLER (TO'LOV CHEKLARI) ====================
bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    const user = getUser(userId);
    const photo = ctx.message.photo[ctx.message.photo.length - 1];

    if (user.step === 'WAITING_CLICK_CHECK' || user.step === 'WAITING_PAYME_CHECK') {
        const paymentType = user.step === 'WAITING_CLICK_CHECK' ? 'click' : 'payme';
        const amount = ctx.session.neededAmount || 0;

        const payment = addPayment(userId, amount, paymentType, 'pending', photo.file_id);

        // Adminga yuborish
        if (adminId) {
            await bot.telegram.sendPhoto(adminId, photo.file_id, {
                caption: `${E.money} Yangi to'lov!\n\n` +
                         `Kim: ${user.name} ${user.surname}\n` +
                         `ID: ${userId}\n` +
                         `Turi: ${paymentType.toUpperCase()}\n` +
                         `Summa: ${amount.toLocaleString()} so'm\n` +
                         `Payment ID: ${payment.id}\n\n` +
                         `Tasdiqlash: /approve_${payment.id}`
            });
        }

        updateUser(userId, { step: 'PAYMENT_PENDING' });
        return ctx.reply(
            `${E.check} Chek qabul qilindi! ${E.clock}\n` +
            `Admin tasdiqlashini kuting. Tasdiqlangach xabar beramiz!`,
            Keyboards.mainMenu(userId === adminId)
        );
    }
});

// ==================== BAHOLASH CALLBACK ====================
bot.action(/rate_(\d+)/, async (ctx) => {
    const rating = parseInt(ctx.match[1]);
    const userId = ctx.from.id;

    await ctx.answerCbQuery(`${E.star} ${rating} ta yulduz! Rahmat!`);
    await ctx.editMessageReplyMarkup();

    let msg = `${E.clap} `;
    if (rating === 5) msg += "Ajoyib! Katta rahmat! ${E.heart}";
    else if (rating === 4) msg += "Juda yaxshi! Rahmat! ${E.smile}";
    else if (rating === 3) msg += "Rahmat! Yana yaxshilashga harakat qilamiz! ${E.wink}";
    else msg += "Fikringiz uchun rahmat! Takliflaringizni kutamiz! ${E.light}";

    await ctx.reply(msg, Keyboards.mainMenu(userId === adminId));
});

// ==================== ADMIN KOMANDALARI ====================
bot.hears(`${E.admin} Admin Panel`, async (ctx) => {
    const userId = ctx.from.id;
    if (userId !== adminId) {
        return ctx.reply(`${E.lock} Sizga ruxsat yo'q!`);
    }

    const users = loadJson(USERS_FILE);
    const payments = loadJson(PAYMENTS_FILE, []);
    const pendingCount = payments.filter(p => p.status === 'pending').length;

    ctx.reply(
        `${E.admin} Admin Panel\n\n` +
        `Jami foydalanuvchilar: ${Object.keys(users).length}\n` +
        `Kutilayotgan to'lovlar: ${pendingCount}\n\n` +
        `Komandalar:\n` +
        `/pending - Kutilayotgan to'lovlar\n` +
        `/approve_ID - To'lovni tasdiqlash\n` +
        `/users - Foydalanuvchilar ro'yxati\n` +
        `/addtemplate - Shablon qo'shish\n` +
        `/balance ID summa - Balans to'ldirish\n` +
        `/broadcast - Xabar yuborish`
    );
});

bot.command('pending', async (ctx) => {
    if (ctx.from.id !== adminId) return;

    const payments = getPendingPayments();
    if (payments.length === 0) {
        return ctx.reply(`${E.check} Kutilayotgan to'lovlar yo'q.`);
    }

    let msg = `${E.money} Kutilayotgan to'lovlar:\n\n`;
    payments.forEach(p => {
        const u = getUser(p.userId);
        msg += `ID: ${p.id}\n` +
               `Kim: ${u?.name || 'Noma\'lum'} ${u?.surname || ''}\n` +
               `Summa: ${p.amount.toLocaleString()} so'm\n` +
               `Turi: ${p.type.toUpperCase()}\n` +
               `Tasdiqlash: /approve_${p.id}\n\n`;
    });
    ctx.reply(msg);
});

bot.command(/approve_(.+)/, async (ctx) => {
    if (ctx.from.id !== adminId) return;

    const paymentId = ctx.match[1];
    const payment = approvePayment(paymentId);

    if (payment) {
        await bot.telegram.sendMessage(payment.userId,
            `${E.check} To'lovingiz tasdiqlandi! ${E.trophy}\n` +
            `Balansingizga ${payment.amount.toLocaleString()} so'm qo'shildi!\n` +
            `${E.money} Endi xohlagan xizmatdan foydalanishingiz mumkin!`,
            Keyboards.mainMenu(false)
        );
        return ctx.reply(`${E.check} To'lov tasdiqlandi! Foydalanuvchiga xabar yuborildi.`);
    }

    return ctx.reply(`${E.wrong} To'lov topilmadi!`);
});

bot.command('users', async (ctx) => {
    if (ctx.from.id !== adminId) return;

    const users = loadJson(USERS_FILE);
    const userList = Object.values(users).slice(0, 20);

    let msg = `${E.admin} Foydalanuvchilar (20 ta):\n\n`;
    userList.forEach((u, i) => {
        msg += `${i + 1}. ${u.name} ${u.surname} - Balans: ${u.balance.toLocaleString()} so'm\n`;
    });
    ctx.reply(msg);
});

bot.command(/balance (\d+) (\d+)/, async (ctx) => {
    if (ctx.from.id !== adminId) return;

    const targetId = parseInt(ctx.match[1]);
    const amount = parseInt(ctx.match[2]);

    const targetUser = getUser(targetId);
    if (!targetUser) {
        return ctx.reply(`${E.wrong} Foydalanuvchi topilmadi!`);
    }

    updateUser(targetId, { balance: targetUser.balance + amount });

    await bot.telegram.sendMessage(targetId,
        `${E.gift} Admin balansingizga ${amount.toLocaleString()} so'm qo'shdi! ${E.money}\n` +
        `Yangi balans: ${(targetUser.balance + amount).toLocaleString()} so'm`
    );

    return ctx.reply(`${E.check} Balans yangilandi!`);
});

bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== adminId) return;
    updateUser(adminId, { step: 'BROADCASTING' });
    return ctx.reply(`${E.admin} Yuboriladigan xabarni kiriting:`, Keyboards.cancel());
});

// ==================== BOTNI ISHGA TUSHIRISH ====================
bot.launch()
    .then(() => console.log("✅ Bot muvaffaqiyatli ishga tushdi!"))
    .catch((err) => console.error("❌ Bot ishga tushirishda xato:", err));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Railway uchun Health Check Server
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200);
    res.write('Bot is running! SlaydTop AI');
    res.end();
}).listen(process.env.PORT || 3000);

console.log("Health check server ishlamoqda...");
