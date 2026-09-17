"use client";
import Link from "next/link";
import { AviatorGame } from "@/components/AviatorGame";
import { ChickenRoadGame } from "@/components/ChickenRoadGame";
import { ChickenDashGame } from "@/components/ChickenDashGame";
import { PlinkoGame } from "@/components/PlinkoGame";
import { CardTable } from "@/components/CardTable";
import { LimboGame } from "@/components/LimboGame";
import { MinesGame } from "@/components/MinesGame";
import { Slot777Game } from "@/components/Slot777Game";
import { useI18n } from "@/lib/i18n/client";

const HOWTO: Record<string, string> = {
  "aviator-x": "Aviator X — 3 bet panels, tez multiplier growth, 10,000x tak. Round shuru hone se pehle bet lagayein, plane ke urne se pehle Cash Out karein. Auto Bet / Auto Cash Out available.",
  limbo: "Target multiplier set karein (1.01x – 1,000,000x) aur Bet dabayein. Agar result aapke target se barabar ya zyada aaye to aap target × bet jeet-te hain. Win chance = 99 ÷ target. RTP 99%.",
  mines: "Bet aur mines (1–24) select karein. 5×5 grid par tiles kholen — gem milne par multiplier barhta hai, mine par sab khatam. Kabhi bhi Cashout karein. RTP 97%.",
  "lucky-777": "Bet select karke SPIN dabayein. Center payline par teen same symbols = jeet (paytable dekhein). 7 7 7 = 777× jackpot! Any cherry bhi paisa deta hai.",
  aviator: "Round shuru hone se pehle bet lagayein. Plane udta hai aur multiplier barhta hai — plane ke crash hone se pehle CASH OUT dabayein. Jitna zyada multiplier, utni zyada jeet.",
  "chicken-road-2": "Bet aur difficulty select karke PLAY dabayein. Har GO par chicken agli lane cross karti hai aur multiplier barhta hai. Kisi bhi lane par gaari aa sakti hai — us se pehle CASH OUT karein.",
  "chicken-dash": "Bet aur level (Easy 28 · Normal 24 · Hard 20 tiles) select karke START dabayein. Har GO par multiplier barhta hai — kabhi bhi CASH OUT karein. Dash boost 2–3 safe tiles sprint karta hai, Bonus Bag utha kar cash out karein to extra bonus.",
  plinko: "Bet, Risk (Low/Medium/High) aur Rows (8–16) select karke Bet dabayein. Ball pegs se takrati hui kisi multiplier bucket mein girti hai — wohi multiplier milta hai. High risk 16 rows par 1000x tak.",
  "dragon-tiger": "Har round 20 second betting. Chip select karke Dragon, Tie ya Tiger par tap karein. Bara card jeet-ta hai (A lowest, K highest). Dragon/Tiger 1:1, Tie 8:1 (tie par D/T ka aadha refund).",
  "andar-bahar": "Har round 20 second betting. Andar ya Bahar par tap karein. Joker khulta hai, phir cards Andar → Bahar dealt hote hain; jis side pehla same-rank card aaye wo jeet-ta hai. Andar 0.9:1, Bahar 1:1.",
};

const HOWTO_UR: Record<string, string> = {
  "aviator-x": "ایوی ایٹر X — 3 بیٹ پینلز، تیز ملٹی پلائر، 10,000x تک۔ راؤنڈ شروع ہونے سے پہلے بیٹ لگائیں، جہاز اُڑنے سے پہلے کیش آؤٹ کریں۔",
  limbo: "ٹارگٹ ملٹی پلائر سیٹ کریں (1.01x – 1,000,000x) اور Bet دبائیں۔ اگر نتیجہ آپ کے ٹارگٹ کے برابر یا زیادہ آئے تو آپ ٹارگٹ × بیٹ جیتتے ہیں۔ RTP 99%۔",
  mines: "بیٹ اور مائنز (1–24) منتخب کریں۔ 5×5 گرڈ پر ٹائلز کھولیں — جیم ملنے پر ملٹی پلائر بڑھتا ہے، مائن پر سب ختم۔ کبھی بھی کیش آؤٹ کریں۔ RTP 97%۔",
  "lucky-777": "بیٹ منتخب کر کے SPIN دبائیں۔ درمیانی پے لائن پر تین ایک جیسے سمبلز = جیت۔ 7 7 7 = 777× جیک پاٹ!",
  aviator: "راؤنڈ شروع ہونے سے پہلے بیٹ لگائیں۔ جہاز اُڑتا ہے اور ملٹی پلائر بڑھتا ہے — جہاز کے کریش ہونے سے پہلے کیش آؤٹ دبائیں۔ جتنا زیادہ ملٹی پلائر، اتنی زیادہ جیت۔",
  "chicken-road-2": "بیٹ اور ڈفیکلٹی منتخب کر کے PLAY دبائیں۔ ہر GO پر مرغی اگلی لین پار کرتی ہے اور ملٹی پلائر بڑھتا ہے۔ کسی بھی لین پر گاڑی آ سکتی ہے — اس سے پہلے کیش آؤٹ کریں۔",
  "chicken-dash": "بیٹ اور لیول (Easy 28 · Normal 24 · Hard 20 ٹائلز) منتخب کر کے START دبائیں۔ ہر GO پر ملٹی پلائر بڑھتا ہے — کبھی بھی کیش آؤٹ کریں۔ ڈیش بوسٹ 2–3 محفوظ ٹائلز اسپرنٹ کرتا ہے، بونس بیگ اٹھا کر کیش آؤٹ کریں تو اضافی بونس۔",
  plinko: "بیٹ، رسک (Low/Medium/High) اور رَوز (8–16) منتخب کر کے Bet دبائیں۔ گیند پیگز سے ٹکراتی ہوئی کسی ملٹی پلائر بکٹ میں گرتی ہے — وہی ملٹی پلائر ملتا ہے۔ High risk 16 rows پر 1000x تک۔",
  "dragon-tiger": "ہر راؤنڈ 20 سیکنڈ بیٹنگ۔ چپ منتخب کر کے Dragon، Tie یا Tiger پر ٹیپ کریں۔ بڑا کارڈ جیتتا ہے (A سب سے چھوٹا، K سب سے بڑا)۔ Dragon/Tiger 1:1، Tie 8:1 (ٹائی پر D/T کا آدھا ریفنڈ)۔",
  "andar-bahar": "ہر راؤنڈ 20 سیکنڈ بیٹنگ۔ اندر یا باہر پر ٹیپ کریں۔ جوکر کھلتا ہے، پھر کارڈز اندر ← باہر ڈیل ہوتے ہیں؛ جس طرف پہلا same-rank کارڈ آئے وہ جیتتا ہے۔ اندر 0.9:1، باہر 1:1۔",
};

export const GAME_SLUGS = Object.keys(HOWTO);

export function GameView({ slug, backHref }: { slug: string; backHref: string }) {
  const { t, locale } = useI18n();
  let body: React.ReactNode;
  let title = "";
  if (slug === "aviator") { body = <AviatorGame table="aviator" />; }
  else if (slug === "aviator-x") { body = <AviatorGame table="aviator-x" />; }
  else if (slug === "limbo") { body = <LimboGame />; }
  else if (slug === "mines") { body = <MinesGame />; }
  else if (slug === "lucky-777") { body = <Slot777Game />; }
  else if (slug === "chicken-road-2") { title = "Chicken Road 2"; body = <ChickenRoadGame />; }
  else if (slug === "chicken-dash") { body = <ChickenDashGame />; }
  else if (slug === "plinko") { body = <PlinkoGame />; }
  else if (slug === "dragon-tiger" || slug === "andar-bahar") { body = <CardTable table={slug} />; }
  else return null;

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">{title}</h1>
          <Link href={backHref} className="text-sm text-slate-400 hover:text-white">{t("allGames")}</Link>
        </div>
      )}
      <div className="game-surface">{body}</div>
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        <b className="text-white">{t("howToPlay")}</b> {locale === "ur" ? (HOWTO_UR[slug] ?? HOWTO[slug]) : HOWTO[slug]}
      </div>
    </div>
  );
}
