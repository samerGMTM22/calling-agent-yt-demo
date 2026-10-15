# الخطوة 4: شغّله، واتصل به، ودعه يتصل بك

## 4.1 أكمل ملف `.env`

يجب أن يكون لديك الآن على الأقل:

```
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_API_KEY_SID=SK...
TWILIO_API_KEY_SECRET=...
TWILIO_PHONE_NUMBER=+1...
OWNER_PHONE_NUMBER=+971...
```

ثم خصّص هوية الوكيل:

```
AGENT_NAME=Sam
OWNER_NAME=Samer
AGENT_LANGUAGE=auto      # auto | ar | en
```

(`AGENT_NAME` اسم الوكيل، و`OWNER_NAME` اسمك أنت بصفتك المالك، و`AGENT_LANGUAGE` لغة الوكيل: `auto` تلقائي، أو `ar` عربي، أو `en` إنجليزي.)

سيفتتح الوكيل كل مكالمة دائماً بعبارة مثل: *«مرحباً، معك سام، وكيل الذكاء الاصطناعي الخاص بسامر…»* (بالإنجليزية: *"Hi, this is Sam, Samer's AI agent…"*)

مُستحسن: رمز PIN على لوحة المفاتيح للمكالمات الواردة **إلى** الوكيل. اختر من 4 إلى 10 أرقام لا يعرفها غيرك (ليس تاريخ ميلادك، وليس `1234`) واكتبها بعد `=`:

```
INBOUND_PIN=
```

تريد تغيير الصوت أو اللهجة أو الشخصية؟ راجع [الخطوة 8: خصّص الشخصية](08-customize-persona.md).

## 4.2 افحص كل شيء

```bash
npm run doctor
```

يجب أن يكون كل سطر ✅ (الأسطر التي عليها ⚠️ مجرد نصائح). وكل ❌ يخبرك بالضبط بما يجب إصلاحه.

## 4.3 شغّل الخادم

```bash
npm run up
```

هذا الأمر يشغّل ngrok (إن لم يكن يعمل أصلاً) ويشغّل الخادم. أبقِ نافذة الطرفية هذه مفتوحة. سترى شيئاً مثل:

```
Agent           Sam, Samer's AI agent | persona: persona.md
Public URL      https://my-agent.ngrok-free.app
Inbound webhook https://my-agent.ngrok-free.app/twilio/voice
```

(`Agent` اسم الوكيل وملف الشخصية المستخدم، و`Public URL` هو العنوان العام، و`Inbound webhook` هو رابط استقبال المكالمات الواردة.)

> 🎥 تسجّل شاشتك؟ عنوان ngrok العشوائي مثل `1a2b-203-0-113-10.ngrok-free.app` يحتوي على عنوان IP الخاص بك. أخفِ نافذة الطرفية هذه، أو استخدم نطاقاً ثابتاً مجانياً (`NGROK_DOMAIN`، [الخطوة 3.4](03-ngrok.md)).

## 4.4 دع الوكيل يتصل بك (مكالمة صادرة)

في **نافذة طرفية ثانية**:

```bash
npm run call -- --purpose "Say hi and check that the phone agent works"
```

دون `--to`، يتصل الوكيل بالرقم `OWNER_PHONE_NUMBER`. وللاتصال برقم آخر، يجب أن يكون الرقم موجوداً في `ALLOWED_DESTINATIONS` (راجع دليل الأمان)، ثم:

```bash
npm run call -- --to +15551234567 --purpose "Confirm Thursday's meeting at 3pm" --context "Samer is free Thursday after 2pm"
```

- `--purpose`: سبب اتصال الوكيل (يقوله بعد أن يعرّف بنفسه)
- `--context`: معلومات خلفية يجب أن يعرفها الوكيل لكن لا يقرأها بصوت عالٍ
- `--language ar` أو `--language en`: اللغة التي يفتتح بها المكالمة

يمكنك كتابة الغرض والسياق بالعربية أيضاً، مثلاً `--purpose "سلّم عليّ وتأكد أن وكيل الهاتف يعمل" --language ar`.

## 4.5 اتصل أنت بالوكيل (مكالمة واردة)

وجّه رقم Twilio الخاص بك إلى الخادم (مرة واحدة، أو بعد كل إعادة تشغيل لـ ngrok إن لم تكن تستخدم نطاقاً ثابتاً):

```bash
npm run twilio:connect            # shows the current setting, changes nothing
npm run twilio:connect -- --apply # points the number at this server (saves a backup)
```

(الأمر الأول يعرض الإعداد الحالي فقط دون أن يغيّر شيئاً، والثاني يوجّه الرقم إلى هذا الخادم ويحفظ نسخة احتياطية من الإعداد القديم.)

الآن اتصل برقم Twilio الخاص بك **من هاتفك الشخصي**. المكالمات من أي رقم غير موجود في `ALLOWED_CALLERS` تُرفض قبل الرد عليها. إن ضبطت `INBOUND_PIN` فستسمع «Please enter your PIN» (أدخل رمزك): اكتبه على لوحة المفاتيح (3 محاولات).

لإعادة الإعداد السابق: `npm run twilio:connect -- --restore`.

> يمكنك أيضاً فعل ذلك يدوياً: Twilio Console ← Phone Numbers ← Manage ← Active numbers (الأرقام النشطة) ← انقر على رقمك ← **Voice Configuration** (إعدادات الصوت) ← «A call comes in» (عند ورود مكالمة) ← **Webhook** ← الصق `https://YOUR-URL/twilio/voice` ← **HTTP POST** ← **Save configuration** (حفظ الإعدادات).

## 4.6 كن أنت العقل (أنت أو وكيلك الذكي)

نموذج الصوت يتولى المحادثة. وحين يحتاج إلى معلومة أو قرار أو أي شيء لا ينبغي له أن يخمّنه، فإنه **يُحيل السؤال** إلى العقل. ومع الإعداد `BRAIN_MODE=agent` يكون العقل هو من يراقب:

```bash
npm run watch
```

كل حدث يظهر في سطر JSON واحد. حين ترى `"type":"brain.question"`، أجب خلال `BRAIN_TIMEOUT_SECONDS` (الافتراضي 30 ثانية):

```bash
npm run answer -- q_abc123 "Yes, Thursday at 3pm works. Samer will bring the slides."
```

(إن كانت المكالمة بالعربية فاكتب جوابك بالعربية.)

أضف `--hangup` لإنهاء المكالمة بعد نطق الجواب. وإن لم يجب أحد في الوقت المحدد، يجيب `BRAIN_FALLBACK` (العقل الاحتياطي، وهو افتراضياً نموذج من OpenAI) بدلاً منك، فلا يبقى المتصل معلّقاً أبداً.

أدوات تحكم مباشرة أخرى:

```bash
npm run say -- call_abc123 "Tell them Samer just joined and says hi"   # agent says this now
npm run note -- call_abc123 "The caller is Samer's accountant"         # silent context
npm run hangup -- call_abc123
npm run calls                       # list calls
npm run transcript -- call_abc123   # full transcript + brain Q&A
npm run status                      # engine, brain, URLs, allowlists
```

(`say`: ينطق الوكيل الجملة فوراً. `note`: سياق صامت لا يُقرأ بصوت عالٍ. `hangup`: ينهي المكالمة. `calls`: قائمة المكالمات. `transcript`: النص الكامل للمكالمة مع أسئلة العقل وأجوبته. `status`: المحرّك والعقل والروابط وقوائم السماح.)

تُحفظ نصوص المكالمات في `./calls/` (وهذا المجلد يتجاهله git).

**إنهاء المكالمة:** قل «مع السلامة» أو «يمكنك إنهاء المكالمة». سيودّعك الصوت ويسأل العقل، والعقل هو من ينهي المكالمة (أجب مع `--hangup` إن كنت أنت العقل). ويمكنك دائماً أن تغلق الخط من هاتفك.

> أوامر `npm run` تتواصل مع الخادم برمز سري يكتبه في `data/control-token` عند كل تشغيل. شغّلها من مجلد المشروع. إن ظهر لك الخطأ `401` فالخادم أُعيد تشغيله أو أنك في مجلد آخر.

## 4.7 اختر محرّك الصوت والعقل

| الإعداد | الخيارات | ملاحظات |
|---|---|---|
| `VOICE_ENGINE` | `live` (الافتراضي)، `realtime` | `live` = GPT-Live، ثنائي الاتجاه بالكامل والأكثر طبيعية. `realtime` = gpt-realtime-2.1، يعمل بنظام تبادل الأدوار (كلٌّ في دوره). |
| `OPENAI_VOICE` | `marin` (الافتراضي)، `cedar`، … | توصي OpenAI بـ `marin`/`cedar` للحصول على أفضل جودة. |
| `BRAIN_MODE` | `agent`، `openai`، `anthropic`، `none` | من يجيب عن الأسئلة المُحالة. |
| `BRAIN_FALLBACK` | `openai`، `anthropic`، `none` | يُستخدم حين لا يجيب الوكيل في الوقت المحدد. |

➡️ التالي: [الخطوة 5: الأمان والامتثال](05-security-and-compliance.md) (نرجو أن تقرأها قبل أن تشارك رقمك مع أي أحد)

---
🎥 هل أعجبك المشروع؟ [اشترك في قناة ذكاء (Thaka2.ai) على يوتيوب](https://www.youtube.com/@Thakaa-AI) لمزيد من مشاريع الوكلاء بالعربية. الموقع: [thaka2.ai](https://www.thaka2.ai)
