/**
 * A small offline starter database of common (mostly Israeli) foods, so the app is useful
 * before any network lookup. Values are typical label/USDA figures and are approximate.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import type { BaseUnit, Serving } from '@/domain/types';
import type { Nutrients } from '@/domain/nutrients';

/** Bump when the seed list changes so existing installs pick up new rows. */
const SEED_VERSION = 1;

type Row = [
  key: string,
  en: string,
  he: string,
  servingEn: string,
  servingHe: string,
  /** Weight/volume of the serving; null means the food is only counted in servings. */
  size: number | null,
  unit: 'g' | 'ml',
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber?: number,
];

// Per one serving as described.
const ROWS: Row[] = [
  ['pita', 'Pita bread', 'פיתה', '1 pita', 'פיתה אחת', 80, 'g', 220, 7, 45, 1, 1.8],
  ['bread_whole', 'Whole wheat bread', 'לחם מלא', '1 slice', 'פרוסה', 30, 'g', 75, 3.5, 13, 1, 2],
  ['bread_white', 'White bread', 'לחם לבן', '1 slice', 'פרוסה', 30, 'g', 80, 2.5, 15, 1, 0.8],
  ['roll', 'Bread roll', 'לחמנייה', '1 roll', 'לחמנייה', 60, 'g', 165, 5.5, 31, 2, 1.4],
  ['rice_cake', 'Rice cakes', 'פריכיות אורז', '2 cakes', '2 פריכיות', 18, 'g', 70, 1.4, 15, 0.6, 0.6],
  ['hummus', 'Hummus spread', 'חומוס (ממרח)', '2 tbsp', '2 כפות', 40, 'g', 105, 3, 5, 8.5, 2.4],
  ['tahini', 'Raw tahini', 'טחינה גולמית', '1 tbsp', 'כף', 15, 'g', 90, 2.6, 3, 8, 1.4],
  ['tahini_salad', 'Tahini salad', 'סלט טחינה', '2 tbsp', '2 כפות', 40, 'g', 95, 2.5, 3, 8.5, 1.2],
  ['falafel', 'Falafel', 'פלאפל', '1 ball', 'כדור', 17, 'g', 57, 2.3, 5.4, 3, 0.8],
  ['shakshuka', 'Shakshuka', 'שקשוקה', '1 portion (2 eggs)', 'מנה (2 ביצים)', 300, 'g', 280, 15, 14, 18, 3],
  ['egg', 'Egg', 'ביצה', '1 large egg', 'ביצה גדולה', 50, 'g', 72, 6.3, 0.4, 4.8],
  ['omelet', 'Omelette', 'חביתה', '2 eggs, fried', '2 ביצים בשמן', 110, 'g', 210, 13, 1, 17],
  ['cottage', 'Cottage cheese 5%', "קוטג' 5%", '½ cup', 'חצי גביע', 125, 'g', 122, 13.8, 1.9, 6.3],
  ['white_cheese', 'White cheese 5%', 'גבינה לבנה 5%', '2 tbsp', '2 כפות', 50, 'g', 48, 4.5, 1.8, 2.5],
  ['labane', 'Labaneh 5%', 'לבנה 5%', '2 tbsp', '2 כפות', 50, 'g', 60, 3, 2, 4.5],
  ['yellow_cheese', 'Yellow cheese 28%', 'גבינה צהובה 28%', '1 slice', 'פרוסה', 20, 'g', 70, 5, 0.2, 5.6],
  ['bulgarian', 'Bulgarian cheese 5%', 'גבינה בולגרית 5%', '1 portion', 'מנה', 50, 'g', 68, 7, 1.5, 3.8],
  ['yogurt', 'Yogurt 3%', 'יוגורט 3%', '1 cup', 'גביע', 200, 'g', 120, 7, 9, 6],
  ['protein_yogurt', 'Protein yogurt', 'יוגורט חלבון', '1 cup', 'גביע', 200, 'g', 145, 20, 11, 1.5],
  ['milk', 'Milk 3%', 'חלב 3%', '1 glass', 'כוס', 240, 'ml', 145, 7.7, 11, 7.2],
  ['latte', 'Latte (café hafuch)', 'קפה הפוך', '1 medium cup', 'כוס בינונית', 250, 'ml', 130, 7, 10, 7],
  ['espresso', 'Espresso', 'אספרסו', '1 shot', 'שוט', 30, 'ml', 2, 0.1, 0, 0],
  ['bamba', 'Bamba peanut snack', 'במבה', '1 small bag', 'שקית קטנה', 25, 'g', 136, 4.3, 10, 8.6, 0.8],
  ['bisli', 'Bisli grill', 'ביסלי גריל', '1 small bag', 'שקית קטנה', 25, 'g', 125, 2.5, 16, 5.5, 0.6],
  ['schnitzel', 'Chicken schnitzel', 'שניצל עוף', '1 portion', 'מנה', 150, 'g', 380, 30, 18, 21, 1],
  ['chicken_breast', 'Chicken breast, grilled', 'חזה עוף צלוי', '100 g', "100 ג'", 100, 'g', 165, 31, 0, 3.6],
  ['chicken_thigh', 'Chicken thigh (pargit), grilled', 'פרגית צלויה', '100 g', "100 ג'", 100, 'g', 210, 26, 0, 11],
  ['entrecote', 'Entrecôte steak', 'סטייק אנטריקוט', '1 steak', 'סטייק', 200, 'g', 580, 46, 0, 44],
  ['kebab', 'Kebab', 'קבב', '1 piece', 'יחידה', 70, 'g', 190, 12, 2, 15],
  ['salmon', 'Salmon, baked', 'סלמון אפוי', '100 g', "100 ג'", 100, 'g', 206, 22, 0, 12],
  ['tuna_water', 'Tuna in water, drained', 'טונה במים', '1 can drained', 'קופסה מסוננת', 100, 'g', 110, 25, 0, 1],
  ['tuna_oil', 'Tuna in oil, drained', 'טונה בשמן', '1 can drained', 'קופסה מסוננת', 100, 'g', 190, 26, 0, 9],
  ['tofu', 'Tofu, firm', 'טופו', '100 g', "100 ג'", 100, 'g', 145, 15, 3, 9, 2],
  ['rice', 'White rice, cooked', 'אורז לבן מבושל', '1 cup', 'כוס', 160, 'g', 205, 4.3, 45, 0.4, 0.6],
  ['pasta', 'Pasta, cooked', 'פסטה מבושלת', '1 cup', 'כוס', 140, 'g', 220, 8, 43, 1.3, 2.5],
  ['ptitim', 'Ptitim (Israeli couscous), cooked', 'פתיתים מבושלים', '1 cup', 'כוס', 150, 'g', 220, 7, 45, 1, 1.5],
  ['couscous', 'Couscous, cooked', 'קוסקוס מבושל', '1 cup', 'כוס', 160, 'g', 176, 6, 36, 0.3, 2.2],
  ['majadra', 'Majadra', "מג'דרה", '1 cup', 'כוס', 200, 'g', 320, 11, 50, 9, 6],
  ['lentils', 'Lentils, cooked', 'עדשים מבושלות', '1 cup', 'כוס', 200, 'g', 230, 18, 40, 0.8, 15.6],
  ['chickpeas', 'Chickpeas, cooked', 'גרגרי חומוס מבושלים', '1 cup', 'כוס', 165, 'g', 270, 14.5, 45, 4.2, 12.5],
  ['potato', 'Potato, baked', 'תפוח אדמה אפוי', '1 medium', 'בינוני', 170, 'g', 160, 4.3, 37, 0.2, 3.8],
  ['sweet_potato', 'Sweet potato, baked', 'בטטה אפויה', '1 medium', 'בינונית', 150, 'g', 135, 3, 31, 0.2, 5],
  ['fries', 'French fries', "צ'יפס", '1 medium portion', 'מנה בינונית', 117, 'g', 365, 4, 48, 17, 4.4],
  ['israeli_salad', 'Israeli salad (with 1 tsp oil)', 'סלט ירקות קצוץ', '1 bowl', 'קערה', 200, 'g', 70, 1.5, 6, 4.5, 2],
  ['tomato', 'Tomato', 'עגבנייה', '1 medium', 'בינונית', 120, 'g', 22, 1.1, 4.8, 0.2, 1.5],
  ['cucumber', 'Cucumber', 'מלפפון', '1 medium', 'יחידה', 130, 'g', 20, 0.8, 4, 0.2, 0.7],
  ['avocado', 'Avocado', 'אבוקדו', '½ fruit', 'חצי', 75, 'g', 120, 1.5, 6, 11, 5],
  ['apple', 'Apple', 'תפוח', '1 medium', 'בינוני', 182, 'g', 95, 0.5, 25, 0.3, 4.4],
  ['banana', 'Banana', 'בננה', '1 medium', 'בינונית', 118, 'g', 105, 1.3, 27, 0.4, 3.1],
  ['orange', 'Orange', 'תפוז', '1 medium', 'בינוני', 131, 'g', 62, 1.2, 15.4, 0.2, 3.1],
  ['date', 'Medjool date', "תמר מג'הול", '1 date', 'תמר', 24, 'g', 66, 0.4, 18, 0, 1.6],
  ['grapes', 'Grapes', 'ענבים', '1 cup', 'כוס', 151, 'g', 104, 1.1, 27, 0.2, 1.4],
  ['watermelon', 'Watermelon', 'אבטיח', '1 wedge', 'פלח', 280, 'g', 85, 1.7, 21, 0.4, 1.1],
  ['almonds', 'Almonds', 'שקדים', '1 handful', 'חופן', 28, 'g', 164, 6, 6, 14, 3.5],
  ['walnuts', 'Walnuts', 'אגוזי מלך', '1 handful', 'חופן', 28, 'g', 185, 4.3, 3.9, 18.5, 1.9],
  ['oats', 'Rolled oats (dry)', 'שיבולת שועל', '40 g', "40 ג'", 40, 'g', 150, 5, 27, 2.7, 4],
  ['granola', 'Granola', 'גרנולה', '50 g', "50 ג'", 50, 'g', 230, 5, 32, 9, 3],
  ['cornflakes', 'Cornflakes', 'קורנפלקס', '1 cup', 'כוס', 30, 'g', 110, 2, 25, 0.2, 0.9],
  ['olive_oil', 'Olive oil', 'שמן זית', '1 tbsp', 'כף', 14, 'g', 120, 0, 0, 14],
  ['peanut_butter', 'Peanut butter', 'חמאת בוטנים', '1 tbsp', 'כף', 16, 'g', 95, 3.5, 3.5, 8, 1],
  ['choc_spread', 'Chocolate spread', 'ממרח שוקולד', '1 tbsp', 'כף', 20, 'g', 108, 1, 11.5, 6.2, 0.6],
  ['honey', 'Honey', 'דבש', '1 tsp', 'כפית', 7, 'g', 21, 0, 6, 0],
  ['sugar', 'Sugar', 'סוכר', '1 tsp', 'כפית', 4, 'g', 16, 0, 4, 0],
  ['cola', 'Cola', 'קולה', '1 can', 'פחית', 330, 'ml', 139, 0, 35, 0],
  ['cola_zero', 'Cola Zero', 'קולה זירו', '1 can', 'פחית', 330, 'ml', 1, 0, 0, 0],
  ['orange_juice', 'Orange juice', 'מיץ תפוזים', '1 glass', 'כוס', 240, 'ml', 112, 1.7, 26, 0.5, 0.5],
  ['beer', 'Beer', 'בירה', '1 bottle', 'בקבוק', 330, 'ml', 145, 1.6, 12, 0],
  ['red_wine', 'Red wine', 'יין אדום', '1 glass', 'כוס', 150, 'ml', 125, 0.1, 3.8, 0],
  ['burekas', 'Cheese burekas', 'בורקס גבינה', '1 piece', 'יחידה', 100, 'g', 300, 7, 25, 19, 1],
  ['sabich', 'Sabich in pita', 'סביח בפיתה', '1 portion', 'מנה', 350, 'g', 600, 20, 65, 30, 8],
  ['shawarma', 'Shawarma in laffa', 'שווארמה בלאפה', '1 portion', 'מנה', 450, 'g', 850, 45, 80, 40, 6],
  ['pizza', 'Pizza', 'פיצה', '1 slice', 'משולש', 107, 'g', 285, 12, 36, 10, 2.5],
  ['burger', 'Hamburger in a bun', 'המבורגר בלחמנייה', '1 burger (200 g meat)', 'המבורגר (200 ג׳ בשר)', 300, 'g', 650, 38, 40, 36, 2],
  ['lentil_soup', 'Lentil soup', 'מרק עדשים', '1 bowl', 'קערה', 300, 'g', 230, 13, 35, 4, 8],
  ['jachnun', 'Jachnun', "ג'חנון", '1 piece', 'יחידה', 150, 'g', 520, 9, 55, 29, 2],
  ['rugelach', 'Chocolate rugelach', 'רוגלך שוקולד', '1 piece', 'יחידה', 30, 'g', 130, 2, 16, 6.5, 0.6],
  ['milk_chocolate', 'Milk chocolate', 'שוקולד חלב', '4 squares', '4 קוביות', 20, 'g', 107, 1.5, 11.6, 6.2, 0.5],
  ['ice_cream', 'Ice cream', 'גלידה', '1 scoop', 'כדור', 66, 'g', 140, 2.5, 16, 7.5, 0.5],
  ['protein_bar', 'Protein bar', 'חטיף חלבון', '1 bar', 'חטיף', 60, 'g', 200, 20, 20, 7, 5],
  ['whey', 'Whey protein powder', 'אבקת חלבון', '1 scoop', 'סקופ', 30, 'g', 120, 24, 3, 1.5],
];

function toFood(r: Row) {
  const [key, en, he, servingEn, servingHe, size, unit, kcal, protein, carbs, fat, fiber] = r;
  const perServing: Nutrients = { kcal, protein, carbs, fat, ...(fiber != null ? { fiber } : {}) };
  if (size == null) {
    return {
      key,
      en,
      he,
      baseUnit: 'serving' as BaseUnit,
      nutrients: perServing,
      servings: [{ label: servingEn, labelHe: servingHe, amount: 1 }] as Serving[],
    };
  }
  const factor = 100 / size;
  const nutrients: Nutrients = {};
  for (const [k, v] of Object.entries(perServing)) nutrients[k as keyof Nutrients] = Math.round(v * factor * 100) / 100;
  const unitLabel = unit === 'ml' ? { en: 'ml', he: 'מ"ל' } : { en: 'g', he: "ג'" };
  const servings: Serving[] = [{ label: servingEn, labelHe: servingHe, amount: size }];
  if (size !== 100) servings.push({ label: `100 ${unitLabel.en}`, labelHe: `100 ${unitLabel.he}`, amount: 100 });
  servings.push({ label: unitLabel.en, labelHe: unitLabel.he, amount: 1 });
  return { key, en, he, baseUnit: unit as BaseUnit, nutrients, servings };
}

/** Insert or refresh the starter foods. Runs at most once per SEED_VERSION. */
export async function seedFoods(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'seedVersion'");
  if (row && Number(row.value) >= SEED_VERSION) return;

  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const r of ROWS) {
      const f = toFood(r);
      await tx.runAsync(
        `INSERT INTO foods (source, source_id, name, name_he, base_unit, nutrients, servings, created_at, updated_at)
         VALUES ('seed', ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source, source_id) DO UPDATE SET
           name = excluded.name, name_he = excluded.name_he, base_unit = excluded.base_unit,
           nutrients = excluded.nutrients, servings = excluded.servings, updated_at = excluded.updated_at`,
        f.key,
        f.en,
        f.he,
        f.baseUnit,
        JSON.stringify(f.nutrients),
        JSON.stringify(f.servings),
        now,
        now,
      );
    }
    await tx.runAsync(
      "INSERT INTO settings (key, value) VALUES ('seedVersion', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      String(SEED_VERSION),
    );
  });
}
