# Step 2: Twilio account, phone number and API key

Twilio gives your agent a real phone number and connects calls to your computer. You need:

| `.env` name | Looks like | Where it comes from |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | `AC` + 32 characters | Console home page |
| `TWILIO_API_KEY_SID` | `SK` + 32 characters | API key you create |
| `TWILIO_API_KEY_SECRET` | 32 characters | Shown once when you create the key |
| `TWILIO_PHONE_NUMBER` | `+15551234567` | The number you buy |

> ⏱ About 15–20 minutes. 💳 A card is needed to upgrade (recommended). Menus move occasionally: look for the same words nearby.

## 2.1 Create the account

1. Open **https://www.twilio.com/try-twilio**.
2. Sign up with your email (or Google), choose a strong password.
3. **Verify your email**: open Twilio's email and click the link.
4. **Verify your phone number**: Twilio sends an SMS code; type it in. This number becomes your first "verified caller ID", which matters on trial accounts.
5. Answer the short onboarding questions. Any answers work; for example: *Voice* → *With code* → *Node.js*.
6. You land on the **Twilio Console**, with some free trial credit.

## 2.2 Upgrade the account (recommended)

Trial accounts work for a first test, but:
- they can only call **verified** numbers,
- every call starts with a "This is a trial account…" message and asks you to press a key.

To remove these limits:
1. In the Console, click **Upgrade** (top bar), or go to **Admin → Account billing**.
2. Add your card and an initial balance (e.g. **$20**).

💡 **Cost guide:** a US number is about $1.15/month. Calls cost cents per minute (more for international mobiles). See https://www.twilio.com/en-us/voice/pricing.

## 2.3 Buy a phone number

1. In the left menu: **Phone Numbers → Manage → Buy a number**.
   (If you don't see it, click **Explore products → Phone Numbers** first.)
2. Pick a **country**. A **United States** number is the quickest (no paperwork). Many other countries require a regulatory bundle (ID/address documents).
3. Under **Capabilities**, tick **Voice**.
4. Click **Search**, pick a number, click **Buy** → **Buy +1 …**.
5. Copy the number in **E.164 format** (with `+` and country code, no spaces), e.g. `+15551234567`.

## 2.4 Find your Account SID

1. Go to the Console home page: https://console.twilio.com
2. Scroll to the **Account Info** box.
3. Copy **Account SID** (starts with `AC`).

## 2.5 Create an API key (instead of using your master Auth Token)

An API key can be revoked on its own without touching the rest of your account, which makes it safer.

1. Top right, click your **account name → API keys & tokens**.
   (Or: **Admin → Account management → API keys & tokens**.)
2. Click **Create API key**.
3. Fill in:
   - **Friendly name:** `calling-agent`
   - **Region:** United States (US1) (the default)
   - **Key type:** **Standard**
4. Click **Create**.
5. Copy **SID** (starts with `SK`) and **Secret**. ⚠️ **The secret is shown only once.** Tick "Got it!" and click **Done** only after you saved both.

## 2.6 Put the values in `.env`

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
```

No quotes, no commas, no spaces. (The app tolerates stray quotes, but clean is better.)

### Optional: Auth Token for webhook signatures

On the same **API keys & tokens** page, under **Live credentials**, you'll find the **Auth Token**. If you put it in `TWILIO_AUTH_TOKEN`, the server checks Twilio's cryptographic signature on every webhook. Without it, the server checks each call with Twilio's API instead, which is also safe, just a little slower. Treat the Auth Token like a master password.

## 2.7 Allow the countries you will call (Geo permissions)

Twilio blocks calls to most countries by default (anti-fraud).

1. Go to **Voice → Settings → Geo permissions**.
   (Or open https://console.twilio.com/us1/develop/voice/settings/geo-permissions.)
2. Tick **only** the countries you need (e.g. United Arab Emirates, Saudi Arabia, Egypt, Jordan…).
3. Click **Save**.

Keep everything else unticked. This is one of your best protections against toll fraud.

## 2.8 Trial accounts only: verify the numbers you'll call

**Phone Numbers → Manage → Verified Caller IDs → Add a new Caller ID** → enter the number → receive the code → confirm.

## 2.9 Add your own number to `.env`

```
OWNER_PHONE_NUMBER=+9715XXXXXXXX
```

This is **your personal mobile**. By default it is the **only** number allowed to call the agent, and the only number the agent is allowed to call. See [Security](05-security-and-compliance.md).

## 🔐 Keep these secret

`TWILIO_API_KEY_SECRET` and `TWILIO_AUTH_TOKEN` are passwords to your phone bill. Never share them, never commit them, never show them on screen. If one leaks: **API keys & tokens → delete the key** (or rotate the Auth Token) immediately.

➡️ Next: [Step 3: ngrok and Node.js](03-ngrok.md)

---
🎥 From **Thaka2.ai (ذكاء)**: AI explained for the Arabic-speaking world. [Subscribe on YouTube](https://www.youtube.com/@Thakaa-AI) · [thaka2.ai](https://www.thaka2.ai)
