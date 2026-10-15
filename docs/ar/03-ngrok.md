# الخطوة 3: ثبّت Node.js وGit وngrok

حاسوبك هو الذي يشغّل خادم الوكيل. وتحتاج Twilio إلى عنوان **https** عام للوصول إليه؛ وأداة **ngrok** تُنشئ هذا العنوان وتمرّر الاتصال عبر نفق (tunnel) إلى حاسوبك.

## 3.1 Node.js (الإصدار 20 أو أحدث)

- **macOS:** نزّل مثبّت إصدار **LTS** (الدعم طويل الأمد) من https://nodejs.org، أو شغّل `brew install node`.
- **Windows:** نزّل ملف `.msi` لإصدار **LTS** من https://nodejs.org وتابع خطوات المثبّت.
- **Linux:** استخدم https://nodejs.org/en/download (أداة nvm هي الأسهل).

تحقق من نجاح التثبيت (افتح نافذة طرفية Terminal جديدة):

```bash
node -v
```

يجب أن ترى `v20` أو أعلى.

## 3.2 Git والمشروع

ثبّت Git من https://git-scm.com/downloads (في macOS: يُعرض عليك تثبيته تلقائياً أول مرة تكتب فيها `git`).

احصل على الكود. إن أردت نسختك الخاصة، فاعمل له **Fork** (نسخة خاصة بك) على GitHub أولاً، ثم:

```bash
git clone https://github.com/samerGMTM22/calling-agent-yt-demo.git
cd calling-agent-yt-demo
npm install
```

## 3.3 حساب ngrok ورمز authtoken

1. سجّل (مجاناً) في **https://dashboard.ngrok.com/signup**.
2. ثبّت ngrok:
   - macOS: `brew install ngrok`
   - Windows: `winget install ngrok.ngrok` (أو نزّله من https://ngrok.com/download)
   - Linux: راجع https://ngrok.com/download
3. في لوحة تحكم ngrok افتح **Getting Started → Your Authtoken** (البدء ← رمز المصادقة الخاص بك) وانسخ الرمز.
4. اربط ngrok بحسابك (مرة واحدة فقط):

```bash
ngrok config add-authtoken PASTE_YOUR_NGROK_TOKEN_HERE
```

(استبدل `PASTE_YOUR_NGROK_TOKEN_HERE` بالرمز الذي نسخته.)

رمز ngrok سرّي أيضاً. يُحفظ في ملف الإعدادات الخاص بـ ngrok نفسه، وليس داخل هذا المشروع.

## 3.4 اختياري: نطاق ثابت مجاني (مُستحسن)

افتراضياً، يعطيك ngrok عنواناً عشوائياً جديداً في كل مرة، ما يعني إعادة توجيه Twilio إليه بعد كل إعادة تشغيل. **النطاق الثابت** (static domain) المجاني يحل هذه المشكلة:

1. لوحة تحكم ngrok ← **Domains** (النطاقات) (أو **Universal Gateway → Domains**) ← **+ New Domain / Create domain** (نطاق جديد / إنشاء نطاق).
2. انسخه (مثلاً `my-agent.ngrok-free.app`) إلى `.env`:

```
NGROK_DOMAIN=my-agent.ngrok-free.app
```

الأمر `npm run up` يستخدمه تلقائياً.

➡️ التالي: [الخطوة 4: شغّله وأجرِ أول مكالمة](04-run-and-call.md)

---
🎥 **ذكاء (Thaka2.ai)**: [اشترك في قناتنا على يوتيوب](https://www.youtube.com/@Thakaa-AI) · [thaka2.ai](https://www.thaka2.ai)
