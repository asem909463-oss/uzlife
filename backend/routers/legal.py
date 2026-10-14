"""Privacy Policy & Terms of Service. Content reflects the data the app actually collects.
Served in-app (JSON) and as public web pages (for App Store Connect URLs)."""
import html
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from core.deps import get_config

router = APIRouter(prefix="/legal", tags=["legal"])

COMPANY = "Close 1 LLC"
DEFAULT_SUPPORT = "uzlifesupport@gmail.com"
EFFECTIVE = {"en": "October 14, 2026", "ru": "14 октября 2026 г.", "uz": "2026-yil 14-oktabr"}

PRIVACY = {
"en": """# Privacy Policy
Effective date: {date}

Uzlife ("the app") is operated by {company} ("we", "us"). This policy explains what data the app collects, why, and your choices.

## Data we collect
- **Account data** (only if you create an account): email address, password (stored securely by our authentication provider, never visible to us), display name, preferred language and city.
- **Content you create**: reminders, plans, saved places, news bookmarks, messages you send to Flash AI and its replies, and marketplace listings (title, description, price, category, city, the contact details you choose to publish, and an optional photo).
- **Usage data**: basic in-app events (for example "reminder created" or "place search") with a timestamp and, if you are signed in, your user ID. We use this only to operate and improve the app.
- **Search queries**: text you type into place search or Flash AI.

We do **not** collect your precise location, contacts, health data, advertising identifiers or payment information. We do not use device GPS — the city is chosen by you.

## How we use data
- To provide app features: sync your reminders, plans and saved items, publish listings, answer Flash AI requests and show places and news.
- To keep the service secure, prevent abuse and moderate marketplace content.
- To understand aggregate feature usage.

We do **not** sell your data, show ads, or track you across other companies' apps or websites.

## Service providers
Data is processed by providers that run parts of the app on our behalf:
- **Supabase** — account authentication and database hosting.
- **Google (Gemini AI)**, via Emergent's AI gateway — processes messages you send to Flash AI and news articles you ask to summarize or translate.
- **Google Maps Platform (Places API)** — receives your place search text and the selected city to return results.
- **Cloudinary** — stores photos you attach to marketplace listings.
- News articles are loaded from public RSS feeds of the publishers shown in the app; opening an article sends you to the publisher's website, which has its own privacy policy.

## Public content
Marketplace listings, including the contact details you enter, are visible to all app users. Do not publish information you do not want to be public.

## Guest mode
You can use the app without an account. In guest mode we do not store reminders, plans, bookmarks or chat history on our servers; Flash AI messages are processed only to generate a reply.

## Retention and deletion
We keep your data while your account exists. You can delete your account at any time in **Profile → Delete account**. This permanently deletes your account, profile, reminders, plans, saved places, bookmarks, Flash AI history, listings and usage events linked to you. You can also delete individual items in the app.

## Children
The app is not directed at children under 13, and we do not knowingly collect their data.

## Security
Data is transmitted over encrypted connections (HTTPS). Access to the database is restricted by row-level security so each user can only access their own private data.

## Your rights
You can access and update your data in the app, delete it, or contact us for a copy or any privacy request.

## Changes
We may update this policy. Significant changes will be announced in the app.

## Contact
{company} — {email}
""",
"ru": """# Политика конфиденциальности
Дата вступления в силу: {date}

Приложением Uzlife («приложение») управляет {company} («мы»). Здесь описано, какие данные собирает приложение, зачем и как вы можете ими управлять.

## Какие данные мы собираем
- **Данные аккаунта** (только если вы создаёте аккаунт): email, пароль (хранится в защищённом виде у провайдера аутентификации, мы его не видим), имя, выбранные язык и город.
- **Создаваемый вами контент**: напоминания, планы, сохранённые места, закладки новостей, сообщения Flash AI и ответы на них, объявления в Маркете (название, описание, цена, категория, город, контакт, который вы публикуете, и необязательное фото).
- **Данные об использовании**: базовые события в приложении (например, «создано напоминание» или «поиск места») с отметкой времени и, если вы вошли, вашим ID пользователя. Используются только для работы и улучшения приложения.
- **Поисковые запросы**: текст, который вы вводите в поиске мест или в Flash AI.

Мы **не** собираем точную геолокацию, контакты, данные о здоровье, рекламные идентификаторы и платёжные данные. GPS устройства не используется — город вы выбираете сами.

## Как мы используем данные
- Для работы функций: синхронизация напоминаний, планов и сохранённого, публикация объявлений, ответы Flash AI, показ мест и новостей.
- Для безопасности, предотвращения злоупотреблений и модерации Маркета.
- Для понимания общей статистики использования функций.

Мы **не** продаём данные, не показываем рекламу и не отслеживаем вас в чужих приложениях и на сайтах.

## Поставщики услуг
- **Supabase** — аутентификация и хранение базы данных.
- **Google (Gemini AI)** через AI-шлюз Emergent — обработка сообщений Flash AI и статей, которые вы просите пересказать или перевести.
- **Google Maps Platform (Places API)** — получает текст поиска мест и выбранный город.
- **Cloudinary** — хранение фото объявлений.
- Новости загружаются из публичных RSS-лент указанных изданий; при открытии статьи вы переходите на сайт издателя со своей политикой конфиденциальности.

## Публичный контент
Объявления в Маркете, включая указанный контакт, видны всем пользователям. Не публикуйте данные, которые не хотите делать публичными.

## Гостевой режим
Приложением можно пользоваться без аккаунта. В гостевом режиме мы не храним на сервере напоминания, планы, закладки и историю чата; сообщения Flash AI обрабатываются только для ответа.

## Хранение и удаление
Мы храним данные, пока существует аккаунт. Удалить аккаунт можно в любой момент: **Профиль → Удалить аккаунт**. Будут безвозвратно удалены аккаунт, профиль, напоминания, планы, места, закладки, история Flash AI, объявления и связанные события использования. Отдельные записи можно удалять в приложении.

## Дети
Приложение не предназначено для детей младше 13 лет, и мы сознательно не собираем их данные.

## Безопасность
Данные передаются по зашифрованным соединениям (HTTPS). Доступ к базе ограничен правилами row-level security: каждый пользователь видит только свои личные данные.

## Ваши права
Вы можете просматривать, изменять и удалять данные в приложении или написать нам, чтобы получить копию данных или задать вопрос.

## Изменения
Мы можем обновлять политику. О существенных изменениях сообщим в приложении.

## Контакты
{company} — {email}
""",
"uz": """# Maxfiylik siyosati
Kuchga kirish sanasi: {date}

Uzlife ilovasini {company} ("biz") boshqaradi. Ushbu siyosat ilova qanday ma'lumot to'plashi, nima uchun va siz qanday boshqarishingiz mumkinligini tushuntiradi.

## Qanday ma'lumot to'playmiz
- **Hisob ma'lumotlari** (faqat hisob yaratsangiz): email, parol (autentifikatsiya provayderida himoyalangan holda saqlanadi, biz uni ko'rmaymiz), ism, til va shahar.
- **Siz yaratgan kontent**: eslatmalar, rejalar, saqlangan joylar, yangilik xatcho'plari, Flash AI xabarlari va javoblari, Market e'lonlari (nomi, tavsif, narx, turkum, shahar, siz e'lon qilgan aloqa va ixtiyoriy rasm).
- **Foydalanish ma'lumotlari**: ilovadagi asosiy hodisalar (masalan, "eslatma yaratildi") vaqt belgisi bilan va, agar kirgan bo'lsangiz, foydalanuvchi ID'si.
- **Qidiruv so'rovlari**: joy qidiruvi yoki Flash AI'ga yozgan matningiz.

Biz aniq geolokatsiya, kontaktlar, sog'liq ma'lumotlari, reklama identifikatorlari va to'lov ma'lumotlarini **to'plamaymiz**. Qurilma GPS'i ishlatilmaydi.

## Ma'lumotlardan foydalanish
- Ilova funksiyalarini ta'minlash, xavfsizlik, suiiste'mollikning oldini olish va Market moderatsiyasi, umumiy statistika uchun.
Biz ma'lumotlarni **sotmaymiz**, reklama ko'rsatmaymiz va sizni boshqa ilova va saytlarda kuzatmaymiz.

## Xizmat ko'rsatuvchilar
- **Supabase** — autentifikatsiya va ma'lumotlar bazasi.
- **Google (Gemini AI)**, Emergent AI shlyuzi orqali — Flash AI xabarlari va maqolalarni qisqartirish/tarjima qilish.
- **Google Maps Platform (Places API)** — joy qidiruvi matni va tanlangan shahar.
- **Cloudinary** — e'lon rasmlarini saqlash.
- Yangiliklar nashrlarning ochiq RSS lentalaridan yuklanadi.

## Ochiq kontent
Market e'lonlari, jumladan aloqa ma'lumotlari, barcha foydalanuvchilarga ko'rinadi.

## Mehmon rejimi
Ilovadan hisobsiz foydalanish mumkin. Mehmon rejimida eslatmalar, rejalar, xatcho'plar va chat tarixi serverda saqlanmaydi.

## Saqlash va o'chirish
Hisobingizni istalgan vaqtda **Profil → Hisobni o'chirish** orqali o'chirishingiz mumkin. Hisob, profil, eslatmalar, rejalar, joylar, xatcho'plar, Flash AI tarixi, e'lonlar va bog'liq hodisalar butunlay o'chiriladi.

## Bolalar
Ilova 13 yoshgacha bo'lgan bolalar uchun mo'ljallanmagan.

## Xavfsizlik
Ma'lumotlar shifrlangan ulanishlar (HTTPS) orqali uzatiladi; ma'lumotlar bazasiga kirish row-level security bilan cheklangan.

## Aloqa
{company} — {email}
""",
}

TERMS = {
"en": """# Terms of Service
Effective date: {date}

These Terms govern your use of Uzlife, operated by {company}. By using the app you agree to these Terms and our Privacy Policy.

## Using the app
You may use most features as a guest. Some features (reminders, plans, saved places, bookmarks, marketplace listings) require an account. You are responsible for keeping your password secure and for activity on your account. You must be at least 13 years old.

## Zero tolerance for objectionable content
The marketplace contains content created by users. You agree **not** to post content that is illegal, fraudulent, hateful, harassing, sexually explicit, violent, infringes others' rights, or offers prohibited goods or services (including weapons, drugs, or counterfeit items). There is no tolerance for objectionable content or abusive users.
- Every listing can be **reported** and any user can be **blocked** directly in the app.
- We review reports and remove objectionable content and ban offending users, normally within 24 hours.
- Listings are automatically checked for prohibited words before publishing.

## Marketplace transactions
Uzlife only displays listings. We are not a party to any transaction between users, do not process payments, and do not guarantee the quality, safety or legality of listed items. Deal carefully and meet in safe public places.

## Flash AI
Flash AI responses are generated automatically and may be inaccurate or incomplete. Verify important information (addresses, opening hours, prices, news) before relying on it. Actions such as creating reminders or plans are only performed after you confirm them.

## Third-party content
Place information is provided by Google; news is provided by the publishers shown. Their content belongs to them, and links open their websites. Emergency phone numbers are provided for convenience; in an emergency always call the official service directly.

## Termination
You can delete your account at any time in Profile. We may suspend or remove accounts and content that violate these Terms.

## Disclaimer and liability
The app is provided "as is". To the extent permitted by law, {company} is not liable for indirect or consequential damages arising from use of the app.

## Changes
We may update these Terms; continued use after changes means you accept them.

## Contact
{company} — {email}
""",
"ru": """# Условия использования
Дата вступления в силу: {date}

Настоящие Условия регулируют использование приложения Uzlife, которым управляет {company}. Используя приложение, вы соглашаетесь с Условиями и Политикой конфиденциальности.

## Использование приложения
Большинство функций доступны гостям. Для напоминаний, планов, сохранённых мест, закладок и объявлений нужен аккаунт. Вы отвечаете за сохранность пароля и действия в аккаунте. Вам должно быть не менее 13 лет.

## Нулевая терпимость к недопустимому контенту
Маркет содержит контент пользователей. Запрещено публиковать незаконный, мошеннический, оскорбительный, разжигающий ненависть, откровенный, жестокий контент, нарушающий чужие права, а также предлагать запрещённые товары и услуги (оружие, наркотики, подделки). Недопустимый контент и оскорбительное поведение не терпятся.
- На любое объявление можно **пожаловаться**, любого пользователя можно **заблокировать** прямо в приложении.
- Мы рассматриваем жалобы, удаляем недопустимый контент и блокируем нарушителей, как правило, в течение 24 часов.
- Объявления автоматически проверяются на запрещённые слова перед публикацией.

## Сделки в Маркете
Uzlife только показывает объявления. Мы не участвуем в сделках, не принимаем платежи и не гарантируем качество, безопасность или законность товаров. Будьте осторожны и встречайтесь в безопасных общественных местах.

## Flash AI
Ответы Flash AI создаются автоматически и могут быть неточными. Проверяйте важную информацию (адреса, часы работы, цены, новости). Напоминания и планы создаются только после вашего подтверждения.

## Сторонний контент
Информация о местах предоставлена Google, новости — указанными изданиями; права на контент принадлежат им. Экстренные номера указаны для удобства — в экстренной ситуации звоните в официальные службы напрямую.

## Прекращение
Вы можете удалить аккаунт в Профиле в любой момент. Мы можем заблокировать аккаунты и удалить контент, нарушающие Условия.

## Ограничение ответственности
Приложение предоставляется «как есть». В пределах, допустимых законом, {company} не несёт ответственности за косвенный ущерб от использования приложения.

## Изменения
Мы можем обновлять Условия; продолжая пользоваться приложением, вы их принимаете.

## Контакты
{company} — {email}
""",
"uz": """# Foydalanish shartlari
Kuchga kirish sanasi: {date}

Ushbu Shartlar {company} tomonidan boshqariladigan Uzlife ilovasidan foydalanishni tartibga soladi. Ilovadan foydalanib, siz Shartlar va Maxfiylik siyosatiga rozilik bildirasiz.

## Ilovadan foydalanish
Ko'pgina funksiyalar mehmonlar uchun ochiq. Eslatmalar, rejalar, saqlangan joylar, xatcho'plar va e'lonlar uchun hisob kerak. Yoshingiz kamida 13 bo'lishi kerak.

## Nomaqbul kontentga nol toqat
Noqonuniy, firibgarlik, nafrat, haqorat, odobsiz, zo'ravonlik kontenti yoki taqiqlangan tovarlar (qurol, giyohvand moddalar, qalbaki mahsulotlar) joylash taqiqlanadi.
- Har qanday e'lon ustidan **shikoyat** qilish va foydalanuvchini **bloklash** mumkin.
- Shikoyatlarni ko'rib chiqamiz va nomaqbul kontentni odatda 24 soat ichida o'chiramiz.
- E'lonlar joylashdan oldin taqiqlangan so'zlarga avtomatik tekshiriladi.

## Market bitimlari
Uzlife faqat e'lonlarni ko'rsatadi, bitimlarda ishtirok etmaydi va to'lovlarni qabul qilmaydi.

## Flash AI
Flash AI javoblari avtomatik yaratiladi va noto'g'ri bo'lishi mumkin. Muhim ma'lumotlarni tekshiring. Eslatma va rejalar faqat tasdiqlaganingizdan keyin yaratiladi.

## Uchinchi tomon kontenti
Joylar haqidagi ma'lumot Google'dan, yangiliklar ko'rsatilgan nashrlardan olinadi. Favqulodda vaziyatda rasmiy xizmatlarga to'g'ridan-to'g'ri qo'ng'iroq qiling.

## Hisobni o'chirish
Hisobingizni Profilda istalgan vaqtda o'chirishingiz mumkin. Shartlarni buzgan hisoblar bloklanishi mumkin.

## Javobgarlik
Ilova "boricha" taqdim etiladi.

## Aloqa
{company} — {email}
""",
}

DOCS = {"privacy": PRIVACY, "terms": TERMS}


async def _render(doc: str, lang: str) -> str:
    if doc not in DOCS:
        raise HTTPException(status_code=404, detail="not_found")
    cfg = await get_config()
    lang = lang if lang in ("en", "ru", "uz") else "en"
    return DOCS[doc][lang].format(date=EFFECTIVE[lang], company=COMPANY, email=cfg.get("support_email") or DEFAULT_SUPPORT)


@router.get("/{doc}")
async def legal_json(doc: str, lang: str = "ru"):
    return {"doc": doc, "lang": lang, "markdown": await _render(doc, lang)}


def _md_to_html(md: str) -> str:
    out, in_list = [], False
    for line in md.splitlines():
        esc = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html.escape(line))
        if line.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{esc[2:]}</li>")
            continue
        if in_list:
            out.append("</ul>")
            in_list = False
        if line.startswith("# "):
            out.append(f"<h1>{esc[2:]}</h1>")
        elif line.startswith("## "):
            out.append(f"<h2>{esc[3:]}</h2>")
        elif line.strip():
            out.append(f"<p>{esc}</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


@router.get("/{doc}/page", response_class=HTMLResponse)
async def legal_page(doc: str, lang: str = "en"):
    body = _md_to_html(await _render(doc, lang))
    return f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Uzlife — {doc.title()}</title><style>body{{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;line-height:1.6;color:#1a1d24}}
h1{{font-size:28px}}h2{{font-size:19px;margin-top:28px}}nav a{{margin-right:12px;color:#B88E3E}}</style></head><body>
<nav><a href="?lang=en">English</a><a href="?lang=ru">Русский</a><a href="?lang=uz">O'zbekcha</a></nav>{body}</body></html>"""
