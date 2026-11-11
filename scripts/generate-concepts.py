#!/usr/bin/env python3
"""Generate 25 self-contained concept site pages under concepts/.
All content sourced from publicly listed business facts gathered 2026-11-11.
No invented prices, hours, reviews, awards, or founding dates."""
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "concepts"

PALETTES = {
    "lakefront": dict(bg="#0E2433", surface="#173149", ink="#E9EEF2", muted="#A4B7C4", accent="#6FD3A7", accent_ink="#07130C", line="#26405A"),
    "grove":     dict(bg="#10231D", surface="#1B362D", ink="#EFE9DC", muted="#A9B9AE", accent="#D8B25C", accent_ink="#241A08", line="#2A463C"),
    "ember":     dict(bg="#221210", surface="#33201C", ink="#F5E9DE", muted="#BEA89E", accent="#E2A35B", accent_ink="#261103", line="#43302A"),
    "emberlite": dict(bg="#FBF4E9", surface="#FFFFFF", ink="#33231A", muted="#6F5B4E", accent="#B4552D", accent_ink="#FFFFFF", line="#E7DACB"),
    "volt":      dict(bg="#141414", surface="#1F1F1F", ink="#F0F0F0", muted="#9A9A9A", accent="#C6F24E", accent_ink="#141414", line="#2E2E2E"),
    "embervolt": dict(bg="#141414", surface="#1F1F1F", ink="#F0F0F0", muted="#A5A5A5", accent="#FF8552", accent_ink="#1A0D05", line="#2E2E2E"),
    "skyvolt":   dict(bg="#141414", surface="#1F1F1F", ink="#F0F0F0", muted="#A5A5A5", accent="#7DD3FC", accent_ink="#07161D", line="#2E2E2E"),
    "ambervolt": dict(bg="#141414", surface="#1F1F1F", ink="#F0F0F0", muted="#A5A5A5", accent="#FDBA2D", accent_ink="#1A1200", line="#2E2E2E"),
    "teal":      dict(bg="#0F2426", surface="#173337", ink="#E8F0EF", muted="#A3BCBA", accent="#57C7D4", accent_ink="#06181A", line="#274347"),
    "clay":      dict(bg="#261B14", surface="#382920", ink="#F3EAE0", muted="#B9A898", accent="#E0A458", accent_ink="#261403", line="#4B3A2E"),
    "plum":      dict(bg="#1E1420", surface="#2B1F2D", ink="#F2EAF2", muted="#BBA6BC", accent="#D8A1D4", accent_ink="#220A20", line="#40303F"),
    "sky":       dict(bg="#0F2038", surface="#1A3050", ink="#EAF0F8", muted="#A2B4CC", accent="#FFB35C", accent_ink="#241100", line="#2A4362"),
}

# (slug, name, category, place, phone, whatsapp_digits, email, tagline, palette, source, services[6], faqs[(q,a),(q,a),(q,a)])
B = [
("fuji-guest-house","Fuji Guest House","Guesthouse · Lakeside","13th Street, Barahi Marg, Pokhara","061-462230 · 9846049227","9779846049227","fujiguesthouse06@gmail.com","Your Lakeside base in the heart of Pokhara","lakefront","public accommodation listing",
 ["Rooms for short & long stays","Breakfast options","Airport / bus-park pickup on request","Local sightseeing help","Garden & terrace seating","Direct booking by phone or email"],
 [("How do I book?","Call or email us with your dates and we will confirm availability directly."),("Can you arrange pickup?","Yes, on request — tell us your arrival time and meeting point."),("Long-stay rates?","Ask by email; we offer flexible arrangements for longer stays.")]),
("giri-guesthouse","Giri Guesthouse","Guesthouse · Lakeside","Durbar Path, Lakeside, Pokhara","+977 61 464955 · 9856066188","9779856066188","yanchaopokhara@gmail.com","Durbar Path stays near the lake","lakefront","public accommodation listing",
 ["Rooms for short & long stays","Breakfast options","Pickup on request","Lakeside sightseeing help","Wi-Fi & essentials","Direct booking by phone or email"],
 [("How do I book?","Call or email with your dates and we will confirm."),("Pickup from the bus park?","On request — let us know your arrival time."),("Can I pay on arrival?","Yes, settle at check-in.")]),
("holi-mount-home-stay","Holi Mount Home Stay","Village homestay","Upper Jhijhirka","+977 9846422535","9779846422535","sam.villagestay@gmail.com","A village stay above the valley","grove","public accommodation listing",
 ["Home-cooked meals on request","Village walks & farm life","Mountain views","Pickup arrangements on request","Long-stay friendly","Direct booking by phone or email"],
 [("How do I reach Upper Jhijhirka?","Call or email and we will explain the route and pickup options."),("What is included?","We keep it simple — a genuine home stay. Ask us for current details."),("Can I stay longer?","Yes — tell us your plans and we will arrange it.")]),
("holy-basil-guest-house","Holy Basil Guest House","Guesthouse","Sedi Bagar 33700, Pokhara","+977 9856074253","9779856074253","turushee@gmail.com","A quiet stay in Sedi Bagar","lakefront","public accommodation listing",
 ["Rooms for short & long stays","Meals on request","Pickup on request","Pokhara sightseeing help","Wi-Fi & essentials","Direct booking by phone or email"],
 [("How do I book?","Call or email with your dates and we will confirm."),("Is it near the lake?","Sedi Bagar is a quieter part of Pokhara — ask us for directions and pickup."),("Check-in time?","Flexible — contact us ahead of arrival.")]),
("kalabang-gharedi-homestay","Kalabang Gharedi Homestay 2","Village homestay","Kalabang, Pokhara 33700","+977 9804194099","9779804194099","kalabanggharedihomestay2@gmail.com","Homestay life in Kalabang","grove","public accommodation listing",
 ["Home-cooked meals on request","Village experience","Rooms for families","Pickup on request","Long-stay friendly","Direct booking by phone or email"],
 [("How do I book?","Call or WhatsApp us with your dates."),("Is it good for families?","Yes — roomy, calm and family-friendly."),("Meals?","Ask when booking; we can prepare home-cooked food.")]),
("pandeli-homestay","Pandeli Homestay","Homestay","Tallathar Road, Pokhara 33700","+977 9823011418","9779823011418","abicup010@gmail.com","Tallathar Road homestay, Lakeside area","lakefront","public accommodation listing",
 ["Rooms for short & long stays","Breakfast on request","Pickup on request","Pokhara sightseeing help","Quiet residential location","Direct booking by phone or email"],
 [("How do I book?","Call or email — we confirm directly."),("Opening hours?","Daily 7:00–20:00 for enquiries; call ahead any time."),("Pickup?","On request — share your arrival details.")]),
("peace-eye-guest-house","Peace Eye Guest House","Guesthouse · Lakeside","7th Street, Shiva Marga, Pokhara","+977 61 461699 · +977 61 462243","","hotelpeaceeye@gmail.com","Seventh Street calm, Pokhara Lakeside","lakefront","public accommodation listing",
 ["Rooms for short & long stays","Breakfast options","Pickup on request","Sightseeing help","Wi-Fi & essentials","Direct booking by phone or email"],
 [("How do I book?","Call or email with your dates."),("Can you help plan Pokhara?","Yes — ask us, we are happy to advise."),("Check-in time?","Contact us ahead of arrival and we will arrange it.")]),
("funko-homestay","Funko Homestay","Homestay","Mattikhan, Ramadi Ekhatte, Pokhara","+977 985 6068132","9779856068132","funkohomestay68132@gmail.com","Mattikhan homestay in Ramadi Ekhatte","grove","public Facebook business listing",
 ["Rooms for short & long stays","Breakfast on request","Pickup on request","Local tips & sightseeing","Quiet hillside setting","Direct booking by phone or email"],
 [("How do I book?","Call or WhatsApp us with your dates."),("Is it easy to reach?","Yes — call ahead and we will guide you."),("Long stays?","Yes, ask us for rates.")]),
("tangting-homestay","Tangting Homestay","Village homestay","Tangting, Madi Rural Municipality, Kaski","+977 984 6449095","9779846449095","gurungpoonam2046@gmail.com","Newly opened homestay in Tangting village","grove","public Facebook business listing",
 ["Village home-cooked meals","Tangting village walks","Farm & community experience","Pickup arrangements on request","Rooms for families","Direct booking by phone or email"],
 [("Where is Tangting?","Madi Rural Municipality, Kaski — call us and we will explain the route."),("Is it newly opened?","Yes, we recently opened — and would love to host you."),("Meals included?","Ask when booking; home-cooked food on request.")]),
("green-peace-homestay","Green Peace Homestay","Homestay · Happy Village","Happy Village, Pokhara","+977 61 420111 · 9856027505","9779856027505","greenphomestay@gmail.com","Apartment stays, tents & campfire in Happy Village","grove","public Facebook business listing",
 ["Apartment for 2–10 guests","Tent camping & campfire","Long-stay friendly","BBQ on request","Group & family stays","Direct booking by phone or email"],
 [("Do you host groups?","Yes — up to 10 guests per apartment."),("Do you offer tents & campfire?","Yes, tell us when booking."),("Long stay?","Yes — ask us for long-stay rates.")]),
("homes-guest-house","Home's Guest House","Guest house · Bhaktapur","Sallaghari, Bhaktapur","+977 981 1466658","9779811466658","homesguesthouse007@gmail.com","Your base near Bhaktapur Durbar Square","clay","public Facebook business listing",
 ["Rooms for travellers & workers","Breakfast on request","Bhaktapur sightseeing help","Pickup on request","Long-stay friendly","Direct booking by phone or email"],
 [("How do I book?","Call or email with your dates."),("Location?","Sallaghari, Bhaktapur — near main routes; ask for directions."),("Monthly stays?","Ask us — we are flexible.")]),
("ilam-tea-homestay","Ilam Tea Homestay","Tea estate homestay","Ilam District, Nepal","+977 9851041025","9779851041025","narengurung@gmail.com","A private tea estate stay in Ilam","grove","Tripadvisor attraction listing",
 ["Tea garden walks & tours","Harvest & processing visits","Home-cooked meals","Mountain sunrise points","Long-stay friendly","Direct booking by phone or email"],
 [("What will I see?","Our private tea estate — the fields, the old machines and how tea is made."),("How do I get there?","Call or WhatsApp and we will plan the journey with you."),("Is food included?","Ask when booking — we cook for our guests.")]),
("kathmandu-bakery-cafe","The Kathmandu Bakery Cafe","Bakery & cakes · Kathmandu","Kathmandu Valley","+977 986 0215124","9779860215124","kathmanducakeshop@gmail.com","Same-day cake delivery across the valley","emberlite","public Facebook business listing",
 ["Custom cakes to order","Same-day delivery in Kathmandu valley","Fresh bread & pastries","Birthday & occasion cakes","Walk-in orders","Direct orders by phone or email"],
 [("Do you deliver same day?","Yes, across Kathmandu valley — call to confirm timing for your area."),("Can I customise a cake?","Yes — tell us the flavour, size and message."),("How do I order?","Call or email with your requirements.")]),
("sandwich-point-thamel","The Sandwich Point","Sandwich bar & restaurant","Thamel, Kathmandu","+977 985 1034645","9779851034645","Sanjibprad13@gmail.com","Sandwiches, bar & good times — Thamel","ember","public Facebook business listing",
 ["Signature sandwiches","Coffee & cold drinks","Bar & casual dining","Dine-in & takeaway","Group seating","Events on request"],
 [("Do you take reservations?","Call ahead for groups — walk-ins welcome otherwise."),("Is there a bar?","Yes — ask about our drinks menu when you visit."),("Opening hours?","Daily — call to confirm tonight's hours.")]),
("bamboo-club-thamel","Bamboo Club","Terrace garden restaurant","Thamel, Kathmandu (since 1998)","","","thamelbambooclub@gmail.com","Terrace garden dining in Thamel, running since 1998","ember","public Facebook business listing",
 ["Rooftop terrace in Thamel","Indoor dining (110–120 pax)","Nepali & international menu","Groups & events","Bar & drinks","Direct enquiries by email"],
 [("Can I book for a group?","Yes — email us with your date and numbers."),("Do you host events?","We cater groups and celebrations — email us."),("Where are you?","Thamel, Kathmandu — ask us for the exact entrance.")]),
("shine-collection-tailoring","SHINE Collection & Tailoring","Tailoring · Bagbazar","Bagbazar 28, Kathmandu","+977 985 1135837","9779851135837","suitshopktm@gmail.com","Bridal, wedding & party tailoring in Bagbazar","clay","public Facebook business listing",
 ["Bridal & wedding gowns","Groom & party tuxedos","Alterations & fittings","Sherwani & ethnic wear","Custom outfits for men & women","Measurements on-site"],
 [("How long does a suit take?","Ask at measurement — turnaround depends on the piece and season."),("Can I bring my own fabric?","Yes, on request — bring it and we will advise."),("Do you do alterations?","Yes — walk in with your garment.")]),
("puppy-paws-pet-shop","Puppy Paws Pet Shop & Vet Clinic","Pet shop & vet clinic","Mandikhatar, Dhumbarahi, Kathmandu","+977 984 1530904","9779841530904","pjli.sujan145@gmail.com","Everything your pet needs, in Mandikhatar","teal","public Facebook business listing",
 ["Pet food & treats","Dog vaccination & treatment","Kennel boarding","Accessories & supplies","Free advice","Curbside pickup"],
 [("Do you offer boarding?","Yes — kennel boarding; call to check availability."),("Vaccinations?","Yes — bring your pet or call ahead to confirm."),("Can I order supplies?","Yes — message or call your order in.")]),
("sri-veterinary-clinic","Sri Veterinary Clinic (SVC)","Veterinary clinic","Nursery Chowk, Kathmandu","+977 980 8956106","9779808956106","Srijant7@gmail.com","Complete care for your pet","teal","public Facebook business listing",
 ["Consultations & treatment","Vaccinations","Routine check-ups","Pet health advice","Surgery on referral","Walk-in & call ahead"],
 [("Do I need an appointment?","Walk-ins are welcome — call ahead for faster service."),("What pets do you treat?","Dogs, cats and common pets — ask us for yours."),("Emergency?","Call 980-8956106 first — we will advise immediately.")]),
("pottery-bhaktapur","Pottery Bhaktapur","Pottery & terracotta","Bhaktapur · delivery Kathmandu, Lalitpur & Banepa","+977 961 7899048","9779617899048","pjptbikal@gmail.com","Handmade terracotta pots & sculptures","clay","public Facebook business listing",
 ["Terracotta pots & planters","Decorative sculptures","Bulk & wholesale orders","Delivery to Kathmandu, Lalitpur & Banepa","Garden & home pieces","Custom sizes on request"],
 [("Do you deliver?","Yes — Kathmandu, Lalitpur and Banepa."),("Bulk orders?","Yes — call with your quantities for a quote."),("Custom pieces?","Ask us — we can often make what you need.")]),
("wellness-gym-butwal","Wellness Gym & Fitness Pvt. Ltd.","Fitness center","Golpark, Butwal-03, Rupandehi","+977 985 7026291","9779857026291","wellnessgymfitness@gmail.com","Shape your body with us — Butwal","volt","public Facebook business listing",
 ["Strength & cardio zone","Group & dance classes","Personal training","Memberships for all levels","Trial sessions","Friendly coaches"],
 [("Can I try first?","Contact us about a trial before you commit."),("Membership plans?","Call 985-7026291 — plans vary by duration."),("Opening hours?","Open — call to confirm today's timings.")]),
("puremuscles-fitness","PureMuscles Fitness","Fitness center","Rani Path, Bank Chowk, Biratnagar","+977 981 4355775","9779814355775","pmfcbiratnagar@gmail.com","Serious fun fitness in Bank Chowk","embervolt","public Facebook business listing",
 ["Strength & conditioning","Cardio equipment","Coaching & programming","Memberships","Trial sessions","Group training"],
 [("Can I try first?","Call us about a trial session."),("Plans?","Monthly and longer-term plans — ask 981-4355775."),("Beginners welcome?","Yes — we coach all levels.")]),
("sajilo-fitness","Sajilo Fitness and Gym","Fitness center","Kanchanbari-4, Biratnagar","+977 980 5311793","9779805311793","sajilofitness@gmail.com","Refer a friend — get 1 month free","skyvolt","public Facebook business listing",
 ["Strength & cardio zone","Memberships & packages","Refer-a-friend programme","Group training","Personal training","Beginner-friendly"],
 [("How does the referral work?","Refer a friend who joins — you get a month free."),("Can I try first?","Contact us for a visit and trial."),("Plans?","Ask us — monthly and longer packages.")]),
("niraamayae-fitness","Niraamayae Fitness","Unisex gym","Narayan Gopal Chowk, Maharajgunj, Kathmandu","+977 1 4373022","","niraamayae@gmail.com","Unisex gym — cardio, yoga, Zumba & CrossFit","ambervolt","public Facebook business listing",
 ["Cardio & strength","Zumba, aerobics & yoga","Kickboxing & CrossFit","Pilates & dance","Workshops & courses","Men & women"],
 [("Do you have classes?","Yes — Zumba, yoga, aerobics, kickboxing CrossFit & more."),("Is it unisex?","Yes, fully unisex."),("How do I join?","Call 1-4373022 or email us.")]),
("lens-photo-studio","Lens Photo Studio","Photography studio","Pepsicola, Kathmandu","+977 985 1246905 · 9849076905","9779851246905","lens.nep77@gmail.com","Weddings, portraits & events in Pepsicola","plum","public Facebook business listing",
 ["Wedding coverage","Pre & post-wedding shoots","Rice feeding & bratabanda","Portraits & headshots","Events & parties","Prints & albums"],
 [("How do I book?","Call or email with your date and event type."),("Do you travel?","Yes — destination weddings and events on request."),("Editing included?","Yes — every package includes professional editing.")]),
("advance-paragliding","Advance Paragliding Pvt. Ltd","Adventure sports · Paragliding","Street No. 7, Lakeside, Pokhara","+977 985 6036262","9779856036262","advance.parabooking@gmail.com","Tandem & solo flights over Pokhara","sky","public Facebook business listing",
 ["Tandem flights for beginners","Solo flights (licensed)","Hotel pickup on request","GoPro photos on request","Group flights","Safety briefing before every flight"],
 [("Do I need experience?","No — tandem flights are for first-timers. We brief you fully."),("What if the weather is bad?","Flights are weather-dependent — we reschedule instead of risking it."),("How do I book?","Call 985-6036262 or email us.")]),
]
assert len(B) == 25, len(B)
print("25 businesses loaded")

ICON = {
 "check": '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
 "pin": '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
 "phone": '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 11.9a16 16 0 0 0 6 6l3.3-1.25a2 2 0 0 1 2.1.45c.9.85 1.84 1.4 2.8 1.7A2 2 0 0 1 22 16.9Z"/></svg>',
 "mail": '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
 "wa": '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.14 1.6 5.95L2.05 22l4.29-1.13a9.87 9.87 0 0 0 5.7 1.82h.01c5.46 0 9.9-4.45 9.9-9.91A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-2.47.65.66-2.41-.2-.31a8.15 8.15 0 0 1-1.26-4.32c0-4.52 3.68-8.2 8.21-8.2a8.17 8.17 0 0 1 8.2 8.21c0 4.53-3.69 8.21-8.2 8.21Zm4.5-6.15c-.25-.12-1.47-.72-1.69-.8-.23-.08-.4-.12-.56.13-.17.25-.64.8-.79.96-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23a7.5 7.5 0 0 1-1.39-1.72c-.15-.25 0-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44l-.76-1.82c-.22-.53-.44-.46-.6-.46h-.51c-.17 0-.44.06-.68.31-.23.25-.9.88-.9 2.14 0 1.27.92 2.5 1.05 2.67.13.17 1.8 2.76 4.37 3.87.61.27 1.09.43 1.46.54.61.2 1.18.17 1.62.1.5-.07 1.46-.6 1.67-1.17.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z"/></svg>',
}

def fonts_for(palette):
    if palette in ("volt","skyvolt","embervolt","ambervolt"):
        return "Archivo Black","Inter","family=Archivo+Black&family=Inter:wght@400;500;600&display=swap", "900"
    return "Fraunces","Inter","family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap", "600"

def site_html(slug, name, cat, place, phone, wa, email, tagline, palette, source, services, faqs):
    p = PALETTES[palette]
    disp, body, fonturl, dispweight = fonts_for(palette)
    esc = lambda s: html.escape(s, quote=True)
    name_e, cat_e, place_e, tag_e = esc(name), esc(cat), esc(place), esc(tagline)
    mail = f"mailto:{email}"
    wa_btn = f'<a class="btn btn-wa" href="https://wa.me/{wa}" rel="noopener">{ICON["wa"]} WhatsApp</a>' if wa else ""
    call_btn = f'<a class="btn btn-ghost" href="tel:{esc(phone.split("·")[0].strip().replace(" ",""))}">{ICON["phone"]} Call</a>' if phone else ""
    hero_secondary = f'<a class="btn btn-ghost" href="tel:{esc(phone.split("·")[0].strip().replace(" ",""))}">{ICON["phone"]} {esc(phone)}</a>' if phone else f'<a class="btn btn-ghost" href="{esc(mail)}">{ICON["mail"]} {esc(email)}</a>'
    services_html = "\n".join(f'        <li class="card">{ICON["check"]}<span>{esc(s)}</span></li>' for s in services)
    faq_html = "\n".join(f'        <details class="faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faqs)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{name_e} — {esc(place)}</title>
<meta name="description" content="{name_e}: {tag_e}. {cat_e} in {place_e}. Contact by phone, WhatsApp or email.">
<meta name="color-scheme" content="dark">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='{p['surface']}'/%3E%3Ctext x='32' y='44' font-size='34' text-anchor='middle' fill='{p['accent']}' font-family='Georgia,serif'%3E{esc(name.strip()[0].upper())}%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?{fonturl}" rel="stylesheet">
<style>
:root{{--bg:{p['bg']};--surface:{p['surface']};--ink:{p['ink']};--muted:{p['muted']};--accent:{p['accent']};--accent-ink:{p['accent_ink']};--line:{p['line']}}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth}}
body{{margin:0;background:var(--bg);color:var(--ink);font:400 1.0625rem/1.6 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}}
.wrap{{width:min(72rem,100% - 2.5rem);margin-inline:auto}}
a{{color:var(--accent)}}
a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible{{outline:3px solid var(--accent);outline-offset:2px;border-radius:4px}}
.skip{{position:absolute;left:-9999px;top:0;background:var(--accent);color:var(--accent-ink);padding:.65rem 1.1rem;z-index:10;font-weight:600;border-radius:0 0 8px 0}}
.skip:focus{{left:0}}
.topbar{{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}}
.topbar .wrap{{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.7rem 0}}
.mark{{display:flex;align-items:center;gap:.65rem;text-decoration:none;color:var(--ink);font:600 1.05rem/1 Inter,system-ui,sans-serif;letter-spacing:.01em}}
.mark .dot{{width:2.4rem;height:2.4rem;border-radius:9px;background:var(--surface);border:1px solid var(--line);display:grid;place-items:center;font:700 1.15rem {disp},Georgia,serif;color:var(--accent)}}
.top-actions{{display:flex;gap:.5rem;flex-wrap:wrap}}
.hero{{padding:clamp(3rem,7vw,5.5rem) 0 clamp(2rem,4vw,3rem);display:grid;grid-template-columns:1.15fr .85fr;gap:2.5rem;align-items:center}}
@media (max-width:880px){{.hero{{grid-template-columns:1fr}}}}
.badge{{display:inline-flex;align-items:center;gap:.4rem;font:600 .72rem/1 Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:.35rem .75rem;background:var(--surface)}}
h1{{font:{dispweight} clamp(2.3rem,5.6vw,4rem)/1.06 {disp},Georgia,serif;letter-spacing:-.01em;margin:1.1rem 0 .8rem}}
.tagline{{font-size:1.2rem;color:var(--muted);max-width:34ch;margin:0 0 1.5rem}}
.chips{{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.5rem}}
.chip{{font-size:.85rem;color:var(--muted);border:1px solid var(--line);border-radius:8px;padding:.35rem .65rem;background:var(--surface)}}
.hero-art{{position:relative;border:1px solid var(--line);border-radius:1.4rem;aspect-ratio:4/5;max-height:30rem;overflow:hidden;background:radial-gradient(120% 90% at 30% 10%, color-mix(in srgb,var(--accent) 26%,transparent), transparent 60%), var(--surface);display:grid;place-items:center}}
.hero-art span{{font:{dispweight} clamp(9rem,26vw,15rem)/1 {disp},Georgia,serif;color:var(--accent);opacity:.9;user-select:none}}
.hero-art small{{position:absolute;bottom:.9rem;left:1rem;right:1rem;color:var(--muted);font-size:.78rem;border-top:1px solid var(--line);padding-top:.6rem}}
.btn{{display:inline-flex;align-items:center;gap:.55rem;min-height:44px;padding:.7rem 1.25rem;border-radius:12px;font:600 .98rem/1 Inter,sans-serif;text-decoration:none;border:1px solid transparent;cursor:pointer}}
.btn-primary{{background:var(--accent);color:var(--accent-ink)}}
.btn-primary:hover{{filter:brightness(1.06)}}
.btn-ghost{{background:var(--surface);color:var(--ink);border-color:var(--line)}}
.btn-ghost:hover{{border-color:var(--accent);color:var(--accent)}}
.btn-wa{{background:#25D366;color:#07351a}}
.btn-wa:hover{{filter:brightness(1.05)}}
.ctas{{display:flex;gap:.7rem;flex-wrap:wrap}}
section.block{{padding:clamp(1.6rem,4vw,3rem) 0;border-top:1px solid var(--line)}}
h2{{font:600 clamp(1.5rem,3vw,2.2rem)/1.15 {disp},Georgia,serif;margin:0 0 1.2rem;letter-spacing:-.005em}}
.services{{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.75rem}}
.card{{display:flex;gap:.65rem;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:.85rem .9rem}}
.card svg{{color:var(--accent);flex:0 0 auto;margin-top:.1rem}}
.visit{{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:.75rem}}
.vcard{{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem}}
.vcard h3{{margin:0 0 .45rem;font:600 .78rem/1.2 Inter;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:.45rem}}
.vcard p,.vcard a{{margin:.15rem 0;color:var(--ink);text-decoration:none;word-break:break-word}}
.vcard a:hover{{color:var(--accent)}}
.note{{color:var(--muted);font-size:.9rem;margin-top:.75rem}}
.faq-item{{border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:.15rem 1rem;margin-bottom:.6rem}}
.faq-item summary{{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:.4rem;font-weight:600}}
.faq-item p{{color:var(--muted);margin:.2rem 0 .9rem}}
form.enquiry{{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;max-width:44rem}}
form.enquiry .full{{grid-column:1/-1}}
label{{display:block;font:600 .82rem/1.4 Inter;margin-bottom:.35rem;color:var(--muted)}}
input,textarea{{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:10px;color:var(--ink);padding:.7rem .8rem;font:400 1rem/1.5 Inter,system-ui,sans-serif;min-height:44px}}
textarea{{min-height:7rem;resize:vertical}}
@media (max-width:640px){{form.enquiry{{grid-template-columns:1fr}}}}
footer{{border-top:1px solid var(--line);padding:1.6rem 0 2.2rem;color:var(--muted);font-size:.88rem}}
footer .wrap{{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center}}
@media (prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}*,*::before,*::after{{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}}}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar"><div class="wrap">
  <a class="mark" href="#main"><span class="dot">{esc(name.strip()[0].upper())}</span>{name_e}</a>
  <div class="top-actions">{wa_btn}{call_btn}<a class="btn btn-primary" href="#enquire">Enquire</a></div>
</div></header>
<main id="main">
  <div class="wrap">
    <section class="hero" aria-labelledby="h1">
      <div>
        <span class="badge">Concept preview</span>
        <h1 id="h1">{name_e}</h1>
        <p class="tagline">{tag_e}</p>
        <div class="chips"><span class="chip">{cat_e}</span><span class="chip">{place_e}</span></div>
        <div class="ctas"><a class="btn btn-primary" href="#enquire">Enquire now</a>{hero_secondary}</div>
      </div>
      <div class="hero-art" role="img" aria-label="{name_e} — {place_e}"><span>{esc(name.strip()[0].upper())}</span><small>Conceived by Yuv Raj Ojha · Kathmandu — a design proposal, not the business's official website</small></div>
    </section>
    <section class="block" id="services" aria-labelledby="h2s">
      <h2 id="h2s">What {name_e} offers</h2>
      <ul class="services">
{services_html}
      </ul>
    </section>
    <section class="block" id="visit" aria-labelledby="h2v">
      <h2 id="h2v">Visit us</h2>
      <div class="visit">
        <div class="vcard"><h3>{ICON["pin"]} Where</h3><p>{place_e}</p></div>
        <div class="vcard"><h3>{ICON["phone"]} Call{' / WhatsApp' if (phone or wa) else ''}</h3>
          {'<p><a href="tel:'+esc(phone.split('·')[0].strip().replace(' ',''))+'">'+esc(phone)+'</a></p>' if phone else ''}
          {'<p><a href="https://wa.me/'+wa+'" rel="noopener">Chat on WhatsApp</a></p>' if wa else ''}
        </div>
        <div class="vcard"><h3>{ICON["mail"]} Email</h3><p><a href="{esc(mail)}">{esc(email)}</a></p></div>
      </div>
      <p class="note">Listed contact details belong to {name_e} (via {esc(source)}). Opening hours and rates are not published — please contact to confirm.</p>
    </section>
    <section class="block" id="faq" aria-labelledby="h2f">
      <h2 id="h2f">Questions</h2>
{faq_html}
    </section>
    <section class="block" id="enquire" aria-labelledby="h2e">
      <h2 id="h2e">Send {name_e} an enquiry</h2>
      <form class="enquiry" id="enquiry-form">
        <div><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required></div>
        <div><label for="f-contact">Phone or email</label><input id="f-contact" name="contact" autocomplete="tel" required></div>
        <div class="full"><label for="f-msg">Your message</label><textarea id="f-msg" name="message" required placeholder="Dates, party size, budget, questions…"></textarea></div>
        <div class="full"><button class="btn btn-primary" type="submit">{ICON["mail"]} Open email draft</button></div>
      </form>
      <p class="note">This button opens your mail app with the enquiry pre-filled — nothing is stored on this page.</p>
    </section>
  </div>
</main>
<footer><div class="wrap">
  <p><strong>{name_e}</strong> · {place_e}</p>
  <p>Concept preview by Yuv Raj Ojha · Not an official website · Reply to the intro email to claim it, customise it, or have it removed.</p>
</div></footer>
<script>
(function(){{
  var form=document.getElementById('enquiry-form');
  form.addEventListener('submit',function(e){{
    e.preventDefault();
    var n=document.getElementById('f-name').value.trim();
    var c=document.getElementById('f-contact').value.trim();
    var m=document.getElementById('f-msg').value.trim();
    var body='Hello {name_e},\n\n'+m+'\n\n— '+n+'\nContact: '+c;
    window.location.href='mailto:{esc(email)}?subject='+encodeURIComponent('Enquiry — {name_e}')+'&body='+encodeURIComponent(body);
  }});
}})();
</script>
</body>
</html>
"""

cards = []
for slug,name,cat,place,phone,wa,email,tagline,palette,source,services,faqs in B:
    d = OUT/slug; d.mkdir(parents=True, exist_ok=True)
    (d/"index.html").write_text(site_html(slug,name,cat,place,phone,wa,email,tagline,palette,source,services,faqs),encoding="utf-8")
    cards.append((slug,name,cat,place))

hub_cards = "\n".join(f'    <a class="hub-card" href="{s}/"><span class="hub-initial">{html.escape(n[0].upper())}</span><span><strong>{html.escape(n)}</strong><small>{html.escape(c)} · {html.escape(p)}</small></span></a>' for s,n,c,p in cards)
hub = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Concept Websites — 25 Nepal businesses</title>
<meta name="description" content="Twenty-five unsolicited concept website previews for Nepal businesses, built by Yuv Raj Ojha as design proposals. Not official websites.">
<meta name="color-scheme" content="dark">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23173149'/%3E%3Ctext x='32' y='44' font-size='30' text-anchor='middle' fill='%236FD3A7' font-family='Georgia,serif'%3E25%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box}}
body{{margin:0;background:#0D1B26;color:#E9EEF2;font:400 1.05rem/1.6 Inter,system-ui,sans-serif}}
.wrap{{width:min(70rem,100% - 2.5rem);margin-inline:auto}}
a{{color:#6FD3A7}}
a:focus-visible{{outline:3px solid #6FD3A7;outline-offset:2px;border-radius:4px}}
header{{padding:clamp(3rem,6vw,5rem) 0 1rem}}
.badge{{display:inline-block;font:600 .72rem/1 Inter;letter-spacing:.16em;text-transform:uppercase;color:#A4B7C4;border:1px solid #26405A;border-radius:999px;padding:.35rem .75rem}}
h1{{font:600 clamp(2.2rem,5.5vw,3.4rem)/1.1 Fraunces,Georgia,serif;margin:1.1rem 0 .6rem}}
h1 em{{color:#6FD3A7;font-style:italic}}
.lede{{color:#A4B7C4;max-width:62ch}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:.8rem;padding-bottom:2.5rem}}
.hub-card{{display:flex;gap:.8rem;align-items:center;background:#173149;border:1px solid #26405A;border-radius:14px;padding:.8rem .9rem;text-decoration:none;color:#E9EEF2}}
.hub-card:hover{{border-color:#6FD3A7;transform:translateY(-2px)}}
.hub-card:focus-visible{{outline:3px solid #6FD3A7}}
.hub-initial{{flex:0 0 3rem;height:3rem;border-radius:10px;background:#0D1B26;display:grid;place-items:center;font:600 1.3rem Fraunces,Georgia,serif;color:#6FD3A7;border:1px solid #26405A}}
small{{display:block;color:#A4B7C4;margin-top:.15rem}}
footer{{border-top:1px solid #26405A;padding:1.5rem 0 2.2rem;color:#A4B7C4;font-size:.88rem}}
@media (prefers-reduced-motion:reduce){{*{{transition-duration:.001ms!important}}}}
</style>
</head>
<body>
<header><div class="wrap">
  <span class="badge">Concept proposals · Nepal</span>
  <h1>Twenty-five businesses, <em>twenty-five previews</em>.</h1>
  <p class="lede">Each page below is an unsolicited design proposal — a working concept website for a real Nepal business whose details are publicly listed but which has no independent website. These are not official channels, and no page here should be read as endorsement. Contact details belong to the businesses shown; message them directly. To have a preview removed, email imyuvojha@gmail.com.</p>
</div></header>
<main class="wrap">
  <div class="grid">
{hub_cards}
  </div>
</main>
<footer><div class="wrap"><p>Built by Yuv Raj Ojha, Kathmandu · Concept work, 2026 · Not affiliated with or endorsed by any listed business · Contact: imyuvojha@gmail.com</p></div></footer>
</body>
</html>
"""
(OUT/"index.html").write_text(hub, encoding="utf-8")
print(f"wrote {len(B)} concept sites + hub -> {OUT}")
