# TrustGuard AI

Verify Before You Trust. Express + MongoDB + Gemini + Tesseract OCR, with a lightweight frontend in `public/`.

## Run
    npm install
    cp .env.example .env     # add GEMINI_API_KEY and MONGODB_URI if you have them
    npm start                # http://localhost:3000

Both keys are optional. Without them the app still works: rule engine for analysis, in-memory history.

## API
- GET    /api/health
- POST   /api/analyze   {text, type}  -> {risk_level, warning_signs[], explanation, explanation_hi, safe_actions[], source}
- POST   /api/chat      {message, lang: en|hi|hn, history}  -> {reply} (null means use built-in answers)
- POST   /api/ocr       multipart field "image" (png/jpg/webp, max 5 MB)  -> {text}
- GET    /api/history   (header X-Device-Id)
- DELETE /api/data      (header X-Device-Id) wipes this device's records

## Privacy design
No login. Anonymous device id only. Images stay in memory and are never written to disk.
Only a 90-character, number-masked snippet is stored, and Mongo expires records after 30 days.
The AI can raise the rule engine's risk level, never lower it.

## Deploy
Render/Railway: build `npm install`, start `npm start`, env vars from .env.example. Database: MongoDB Atlas.
The server also serves the frontend, so no separate Vercel deploy is needed.
