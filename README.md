SlaydTop AI Bot
Professional Telegram bot for creating educational content with AI power.
Features
AI-powered Slides (5-25 slides with templates)
Crosswords (10, 15, 20 questions)
Tests (with difficulty levels and answer keys)
Essays (Insho/Esse with word count)
Referat & Mustaqil Ish (with cover page, plan, bibliography)
Tezis (Thesis)
Glossary (with definitions and origins)
Payment system (Click/Payme + Admin approval)
Template system (45 customizable PPTX templates)
Admin Panel (Broadcast, user management, payments)
Pricing
Slides
Table
Slides	Price
2 free	0 so'm
1	2,000 so'm
2	3,000 so'm
4	5,000 so'm
8	8,000 so'm
12	10,000 so'm
Other Services
Crossword: 10=1,000 / 15=2,000 / 20=3,000 so'm
Test: 1=100 / 10=1,000 so'm
Essay: 10 so'm per word
Referat: 500 so'm per page
Glossary: 200 so'm per item
Setup
1. Environment Variables
Copy .env.example to .env and fill in:
plain
Copy
TELEGRAM_BOT_TOKEN=your_token_here
GEMINI_API_KEY=your_gemini_key_here
ADMIN_ID=your_telegram_id
ADMIN_USERNAME=your_username
2. Install Dependencies
bash
Copy
npm install
3. Run
bash
Copy
npm start
Deployment (Railway)
Push to GitHub
Connect Railway to repo
Add Environment Variables in Railway dashboard
Deploy!
The health check server runs on PORT (default 3000).
Admin Commands
Table
Command	Description
/pending	List pending payments
/approve_ID	Approve a payment
/users	List users
/balance ID AMOUNT	Add balance to user
/broadcast	Send message to all users
Templates
Place .pptx template files in /templates/ folder and register them via admin commands.
Template JSON format in data/templates.json:
JSON
Copy
[
  {
    "id": "template_1",
    "name": "Blue Professional",
    "filePath": "./templates/blue.pptx",
    "previewImage": "./assets/blue_preview.jpg",
    "price": 2000
  }
]
File Structure
plain
Copy
slaydtop-ai-bot/
├── bot.js              # Main bot code
├── package.json
├── .env.example
├── .gitignore
├── data/               # Persistent data (auto-created)
│   ├── users.json
│   ├── payments.json
│   ├── orders.json
│   └── templates.json
├── templates/          # PPTX templates (you add these)
└── assets/             # Preview images and other assets
Notes
User data persists in JSON files (auto-created)
All PPTX files are auto-deleted after sending
Gemini 1.5 Flash model is used for content generation
For high usage, consider implementing a queue system
