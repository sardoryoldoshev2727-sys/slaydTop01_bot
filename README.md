# SlaydTop AI Bot v3.0

Professional Telegram bot for creating educational content with AI power.

## Yangilanishlar v3.0

- **To'lov tizimi**: Click/Payme orqali to'lov cheklari (karta: 4067070008936564 - Yo'ldoshev Sardor)
- **Slayd yaratish**: 1-25 ta slayd, 6 ta rang mavzusi, shablon qo'llab-quvvatlash
- **Krassvord**: 10/15/20 ta savol, PPTX formatida savollar + javoblar kaliti
- **Test**: 1/5/10 ta test, 3 daraja (oson/o'rta/murakkab), 4 variantli
- **Insho/Esse**: So'z soni bo'yicha narx (1 so'z = 10 so'm)
- **Referat/Mustaqil ish**: Bet soni bo'yicha (1 bet = 500 so'm), muqova + reja + kirish + xulosa + adabiyotlar
- **Tezis**: Konferensiya formatida (1 so'z = 10 so'm)
- **Glossariy**: Terminlar lug'ati (1 ta = 200 so'm)
- **Shablon tizimi**: template_01.pptx dan template_50.pptx gacha avtomatik skanerlash
- **Admin panel**: Tasdiqlash, broadcast, statistika

## O'rnatish

### 1. Loyihani klonlash
```bash
git clone <repo-url>
cd slaydtop-ai-bot
```

### 2. Muhit o'zgaruvchilarini sozlash
```bash
cp .env.example .env
# .env faylni tahrirlash
```

**Majburiy o'zgaruvchilar:**
- `TELEGRAM_BOT_TOKEN` - @BotFather dan olingan token
- `GEMINI_API_KEY` - Google AI Studio dan olingan API kalit
- `ADMIN_ID` - Adminning Telegram raqamli ID si

### 3. BSM o'rnatish
```bash
npm install
```

### 4. Ishga tushirish
```bash
npm start
# yoki
npm run dev
```

## Shablonlarni sozlash

Shablon fayllarini `templates/` papkasiga joylashtiring:

```
templates/
  template_01.pptx
  template_02.pptx
  template_03.pptx
  ...
  template_50.pptx
```

Bot avtomatik ravishda barcha `.pptx` fayllarni skanerlaydi va ro'yxatga oladi.

## Deploy (Railway/Render)

1. GitHub ga push qiling
2. Railway/Render dan loyihani ulang
3. Environment Variables qo'shing
4. Deploy!

## Narxlari

| Xizmat | Narxi |
|--------|-------|
| Slayd (1-6 ta) | 2,000 so'm |
| Slayd (7-8 ta) | 3,000 so'm |
| Slayd (9-12 ta) | 5,000 so'm |
| Slayd (13-25 ta) | 8,000-10,000 so'm |
| Krassvord (10 ta) | 1,000 so'm |
| Krassvord (15 ta) | 2,000 so'm |
| Krassvord (20 ta) | 3,000 so'm |
| Test (1 ta) | 100 so'm |
| Test (5 ta) | 500 so'm |
| Test (10 ta) | 1,000 so'm |
| Insho/Esse | 10 so'm/so'z |
| Referat/Mustaqil ish | 500 so'm/bet |
| Tezis | 10 so'm/so'z |
| Glossariy | 200 so'm/so'z |

## Admin komandalar

| Komanda | Tavsif |
|---------|--------|
| `/pending` | Kutilayotgan to'lovlar |
| `/approve_ID` | To'lovni tasdiqlash |
| `/users` | Foydalanuvchilar ro'yxati |
| `/balance ID summa` | Balans to'ldirish |
| `/broadcast` | Barchaga xabar yuborish |
| `/stats` | Umumiy statistika |

## Papka tuzilishi

```
slaydtop-ai-bot/
  bot.js           # Asosiy bot kodi
  package.json
  .env.example
  .gitignore
  data/            # Avtomatik yaratiladi
    users.json
    payments.json
    orders.json
    templates.json
  templates/       # Shablon fayllar (qo'lda qo'shiladi)
    template_01.pptx
    ...
  assets/          # Rasmlar va boshqa fayllar
```

## Eslatmalar

- Barcha PPTX fayllar yuborilgandan keyin avtomatik o'chiriladi
- Foydalanuvchi ma'lumotlari JSON fayllarda saqlanadi
- 2 ta bepul slayd har bir yangi foydalanuvchiga beriladi
- Do'stlarni taklif qilish = +1 bepul slayd

## Bog'lanish

Muammolar yoki takliflar uchun: @Top_SardoryoldoshevUz
