import { prisma } from "./prisma";
import { formatKey, formatRange } from "./dates";
import { CHANCE_LABEL, CycleLike, PHASE_INFO, Prediction, SymptomLike, symptomsByPhase, topMoods } from "./predictor";

export const RETENTION_DAYS = 30;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export async function purgeOldLogs(userId: string) {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  await prisma.chatLog.deleteMany({
    where: { userId, createdAt: { lt: cutoff } },
  });
  return cutoff;
}

// ---------------------------------------------------------------------------
// Bloom's built-in brain. It needs no AI service: each message is matched
// against a library of topics, and the best match answers using the user's
// own cycle data. Add a topic to TOPICS to teach Bloom something new.
// ---------------------------------------------------------------------------

export type LocalTurn = { role: "USER" | "ASSISTANT"; message: string };

type Context = {
  text: string;
  /** Null until the user has logged a period. */
  p: Prediction | null;
  cycles: CycleLike[];
  symptoms: SymptomLike[];
};

type Topic = {
  id: string;
  /** Each pattern that matches adds one point; the topic with the most points answers. */
  match: RegExp[];
  /** Extra points for topics that should win ties (safety first). */
  boost?: number;
  /** True when the answer is built from the user's cycle dates. */
  needsData?: boolean;
  reply: (context: Context) => string;
  /** Used when the user asks a follow-up such as "tell me more" or "why?". */
  more?: (context: Context) => string;
};

const DOCTOR = "I can't diagnose anything, so if this is new, severe, or worrying you, please see a doctor or nurse.";

const NO_DATA =
  "I don't have any of your cycle dates yet. On the **Home** screen, tap **Add my period** and pick the day your last period started. Then I can give you real predictions. 🌸";

function days(count: number) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

/** Picks a different phrasing on different days so Bloom doesn't repeat herself word for word. */
function pick(options: string[], seed: string) {
  let total = new Date().getDate();
  for (const char of seed) total += char.charCodeAt(0);
  return options[total % options.length];
}

// Common spellings and local words are mapped to the word the topics look for.
const SPELLINGS: Array<[RegExp, string]> = [
  [/\b(menses|menstruation|mensuration|menstrual period|piriod|perid|peroid|periods|monthly flow|my flow|time of the month|aunt flo)\b/g, "period"],
  [/\b(preg|pregnat|pregnent|pregnate|prego)\b/g, "pregnant"],
  [/\b(ovulate|ovulating|ovulated|ovalation|ovulaton)\b/g, "ovulation"],
  [/\b(cramping|cramps|crampy|stomach ?ache|tummy ?ache|belly ?ache|period pains?|menstrual pains?)\b/g, "cramp"],
  [/\b(unprotected|without (a )?condom|raw sex|bareback)\b/g, "unprotected sex"],
  [/\b(u)\b/g, "you"],
  [/\b(pls|plz)\b/g, "please"],
  [/\b(dont|don t)\b/g, "don't"],
  [/\b(cant|can t)\b/g, "can't"],
  [/\b(im)\b/g, "i'm"],
];

function normalise(message: string) {
  let text = ` ${message.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'?\s-]/g, " ").replace(/\s+/g, " ").trim()} `;
  SPELLINGS.forEach(([pattern, word]) => {
    text = text.replace(pattern, word);
  });
  return text.trim();
}

function periodLine(p: Prediction) {
  if (p.stale) {
    return `The last period you added started ${formatKey(p.lastPeriodStart)}, which is a while ago. Tap **Add my period** on the Home screen to add your latest one and I'll refresh your dates.`;
  }
  if (p.daysLate > 0) {
    return `Your period was expected around **${formatKey(p.nextPeriodStart)}**, so it's about ${days(p.daysLate)} late.`;
  }
  if (p.daysUntilNextPeriod === 0) return "Your period is expected **today**.";
  const window =
    p.nextPeriodEarliest === p.nextPeriodLatest ? "" : ` (most likely between ${formatRange(p.nextPeriodEarliest, p.nextPeriodLatest)})`;
  return `Your next period should start around **${formatKey(p.nextPeriodStart)}**, in ${days(p.daysUntilNextPeriod)}${window}.`;
}

function confidenceLine(p: Prediction) {
  if (p.confidence === "high") return "Your cycles have been steady, so this estimate is fairly reliable.";
  if (p.confidence === "medium") return "I'll get more accurate as you add more periods.";
  return "This is an early estimate. It gets much better after you add two or three periods.";
}

function fertileLine(p: Prediction) {
  if (!p.upcomingFertile) return "I can work out your next fertile days once you add your next period.";
  return `Your fertile days are around **${formatRange(p.upcomingFertile.start, p.upcomingFertile.end)}**, and the egg is likely released around **${formatKey(p.upcomingFertile.ovulation)}**.`;
}

function whereAmI(p: Prediction) {
  const phase = PHASE_INFO[p.phase];
  return `You're on **day ${p.cycleDay}** of your cycle, in your **${phase.label.toLowerCase()}** ${phase.emoji}`;
}

const NOT_BIRTH_CONTROL =
  "No day is 100% safe. Ovulation can move with stress, illness, or travel, and sperm can live inside the body for up to 5 days, so counting days is not reliable birth control. If you don't want to get pregnant, use a condom or another contraceptive every time.";

const TOPICS: Topic[] = [
  // ----- Safety comes first -----
  {
    id: "self_harm",
    boost: 10,
    match: [/\b(kill myself|suicid\w*|self[- ]?harm|end my life|want to die|hurt myself|cut myself|no reason to live)\b/],
    reply: () =>
      "I'm really glad you told me, and I'm so sorry you're hurting this much. 💗 You deserve support from a real person right now. Please talk to someone you trust today, or contact a crisis line or your local emergency number. If you are in danger right now, call emergency services. You are not a burden, and this feeling can get better with help.",
  },
  {
    id: "abuse",
    boost: 10,
    match: [/\b(rap(e|ed)|forced me|forcing me|force me|abus\w+|molest\w*|assault\w*|touched me|beats? me|hits? me|won't stop when)\b/],
    reply: () =>
      "I'm so sorry. What happened is not your fault, no matter what anyone says. 💗 You deserve to be safe. Please tell an adult you trust, such as a parent, teacher, nurse, or a helpline in your country. If you are in danger right now, call the police or emergency services. If this happened in the last few days, a clinic can help with emergency contraception and protection from infections, and the sooner you go the better.",
  },
  {
    id: "pressure",
    boost: 5,
    match: [/\b(pressur\w+|not ready|he wants|she wants|they want|boyfriend wants|keeps asking|begging me|says if i love)\b/, /\b(sex|sleep with|do it|without (a )?condom)\b/],
    reply: () =>
      "You never owe anyone sex, and \"not yet\" or \"no\" is a full answer. 💗 Someone who cares about you will wait and won't make you feel guilty. If you do decide you're ready, it should be your choice, and a condom protects you from pregnancy and infections. If you feel scared to say no, please talk to an adult you trust.",
  },
  {
    id: "urgent_bleeding",
    boost: 8,
    match: [/\b(soak\w*|faint\w*|passed out|dizzy|bleeding (a lot|heavily|too much|nonstop|non-stop)|won't stop bleeding|hemorrhag\w*|unbearable|worst pain|can't (walk|stand|move)|emergency)\b/],
    reply: () =>
      "That sounds like it needs real medical attention. Soaking a pad or tampon every hour, feeling faint or dizzy, or pain you can't bear are signs to **see a doctor or go to a clinic today**. Please don't wait it out alone, and ask someone to go with you. 💗",
  },

  // ----- Her own predictions -----
  {
    id: "pregnancy_chance",
    needsData: true,
    boost: 1,
    match: [
      /\b(pregnant|safe (day|days|period|time|today|now|tonight)|am i safe|free (day|days|period)|unprotected sex|have sex|having sex|had sex|condom)\b/,
      /\b(today|now|tonight|tomorrow|this week|chance|risk|can i|could i|will i|safe)\b/,
    ],
    reply: ({ p }) => {
      const q = p as Prediction;
      if (q.stale) return periodLine(q);
      const today = `Today is day ${q.cycleDay} of your cycle, which is a **${CHANCE_LABEL[q.chance].toLowerCase()}** based on your dates.`;
      return `${today}\n\n${fertileLine(q)}\n\n${NOT_BIRTH_CONTROL}`;
    },
    more: () =>
      "Here is why the fertile days matter: an egg only lives for about a day, but sperm can wait inside the body for up to 5 days. So sex in the 5 days before the egg is released, or on that day, can lead to pregnancy. That's about 6 or 7 days each cycle, and they move if your cycle moves.",
  },
  {
    id: "late_period",
    needsData: true,
    boost: 1,
    match: [/period.*\b(late|missed|delayed|overdue|not come|hasn't come|not coming|stopped)\b|\b(late|missed|delayed|overdue|skipped|no) (my )?period|haven't seen my period|not seen my period/],
    reply: ({ p }) => {
      const q = p as Prediction;
      const status = q.daysLate > 0 || q.stale ? periodLine(q) : `By my estimate you aren't late yet. ${periodLine(q)}`;
      return `${status}\n\nA few days' delay is very common. Stress, travel, illness, exams, weight changes, and heavy exercise can all move it.\n\n- If you've had sex and pregnancy is possible, a test is accurate from the first day of a missed period.\n- If you miss three periods in a row, see a doctor.`;
    },
  },
  {
    id: "next_period",
    needsData: true,
    match: [/\b(next period|period (due|start|come|coming|date)|when.*period|period.*when|(days?|long) (until|till|to|before) (my )?period|expect my period)\b/],
    reply: ({ p }) => `${periodLine(p as Prediction)}\n\n${confidenceLine(p as Prediction)}`,
    more: ({ p }) =>
      p
        ? `Here's how I worked it out: your last period started ${formatKey(p.lastPeriodStart)}, and your cycles are about ${p.cycleLength} days long, so I counted ${p.cycleLength} days forward. The date range is wider when your past cycles vary more.`
        : NO_DATA,
  },
  {
    id: "ovulation_when",
    needsData: true,
    match: [/\b(ovulation|fertile|fertility|egg)\b/, /\b(when|my|am i|today|now|next|date|days)\b/],
    reply: ({ p }) => {
      const q = p as Prediction;
      if (q.stale) return periodLine(q);
      return `${fertileLine(q)}\n\nSigns your body may give: clear, stretchy discharge (like egg white), a slightly higher sex drive, and sometimes a small twinge on one side. ${confidenceLine(q)}`;
    },
  },
  {
    id: "cycle_status",
    needsData: true,
    match: [/\b(cycle day|what day|which day|what phase|which phase|where am i|my cycle|my phase|day of my cycle|how is my cycle|my status)\b/],
    reply: ({ p }) => {
      const q = p as Prediction;
      if (q.stale) return periodLine(q);
      const phase = PHASE_INFO[q.phase];
      return `${whereAmI(q)}\n\n${phase.meaning} ${phase.feel}\n\n${periodLine(q)}`;
    },
  },
  {
    id: "my_cycle_length",
    needsData: true,
    boost: 1,
    match: [/\b(my cycle length|how long is my cycle|my average|is my cycle (normal|regular|ok|okay)|am i regular)\b/],
    reply: ({ p }) => {
      const q = p as Prediction;
      const range =
        q.history.length >= 2
          ? `Your cycles have ranged from ${Math.min(...q.history)} to ${Math.max(...q.history)} days.`
          : "I need you to add at least two more periods to see how regular you are.";
      const verdict = q.cycleLength >= 21 && q.cycleLength <= 35 ? "That is inside the normal range of 21 to 35 days. 🌟" : "That is outside the usual 21 to 35 days, so it's worth mentioning to a doctor.";
      return `Your cycle is about **${q.cycleLength} days**, and your period lasts about ${q.periodLength} days. ${verdict}\n\n${range}`;
    },
  },

  // ----- What the words mean -----
  {
    id: "what_is_luteal",
    boost: 1,
    match: [/\bluteal\b/],
    reply: () =>
      "The **luteal phase** is the second half of your cycle, from after the egg is released until your next period. 🌙\n\nYour body makes a hormone called progesterone, which can make you feel calmer or more tired. If there's no pregnancy, the hormone drops, and your period starts. It usually lasts about 12 to 14 days.",
    more: () =>
      "After the egg leaves the ovary, the empty shell it came from turns into a tiny gland (the \"corpus luteum\", which is where the word luteal comes from). That gland makes progesterone to keep the womb lining thick in case of pregnancy. With no pregnancy, it shrinks after about two weeks, progesterone falls, and the lining comes away as your period. The falling hormone is also why PMS shows up at the end of these days.",
  },
  {
    id: "what_is_follicular",
    boost: 1,
    match: [/\bfollicular\b/],
    reply: () =>
      "The **follicular phase** is the first half of your cycle, from your period until an egg is released. 🌱\n\nYour body is growing an egg, and the hormone estrogen rises, so energy and mood usually lift.",
  },
  {
    id: "what_is_ovulation",
    match: [/\b(what is|what's|what does|meaning of|mean|explain|define)\b/, /\b(ovulation|fertile window|fertile days|egg released)\b/],
    reply: () =>
      "**Ovulation** is when one of your ovaries releases an egg, usually about 14 days before your next period. 🌼\n\nThe **fertile days** are the 5 days before that plus the day itself, because sperm can wait up to 5 days for the egg. Those are the days pregnancy is most likely.",
  },
  {
    id: "what_is_pms",
    match: [/\b(what is|what's|what does|meaning of|mean|explain)\b/, /\b(pms|premenstrual|pre-period)\b/],
    reply: () =>
      "**PMS** (premenstrual syndrome) is the mix of feelings and body changes in the days before a period: mood swings, cravings, bloating, sore breasts, tiredness, spots. 🍫 It's caused by hormones dropping, it's very common, and it goes away once your period starts.",
  },
  {
    id: "what_are_phases",
    match: [/\b(phases?|stages?|hormones?|estrogen|progesterone|menstrual cycle|how does (my|the) cycle work|what is a cycle|colou?rs? mean)\b/],
    reply: ({ p }) => {
      const mine = p && !p.stale ? `\n\nRight now ${whereAmI(p).replace("You're", "you're")}.` : "";
      return `Your cycle has four parts:\n\n- **Period** 🩸 You bleed. Day 1 is the first day of your period.\n- **Follicular phase** 🌱 After your period, your body prepares an egg. Energy rises.\n- **Fertile window** 🌼 An egg is released (ovulation). Pregnancy is most likely.\n- **Luteal phase** 🌙 After ovulation, your body gets ready for the next period. PMS can show up at the end.${mine}`;
    },
  },
  {
    id: "what_is_period",
    match: [/\b(what is a period|why do (we|i|girls|women) (bleed|have period)|why period|what causes period|where does the blood)\b/],
    reply: () =>
      "Each month the lining of your womb gets thick to be ready for a pregnancy. When there's no pregnancy, the body lets that lining go, and it comes out as blood through the vagina. That's a period. 🩸 It's a sign your body is working as it should.",
  },

  // ----- What's normal -----
  {
    id: "first_period",
    match: [/\b(first period|never had (a|my) period|haven't started|not started my period|when will i (get|start)|what age)\b/],
    reply: () =>
      "Most girls get their first period between 9 and 15, often about two years after breasts start to grow. 🌷 For the first year or two, periods can be irregular, and that's normal.\n\nIf you're 15 and haven't started, or 13 with no body changes yet, a doctor can check that everything is fine. It usually is.",
  },
  {
    id: "period_length",
    match: [/\b(how long (should|does|do|is|will)|how many days|period (lasts?|last|length|long|short)|too long|too short|(lasts?|lasting) (too|only|for|more|over))\b/, /\b(period|bleed\w*|last|days)\b/],
    reply: ({ p }) => {
      const mine = p ? ` Yours lasts about ${p.periodLength} days.` : "";
      return `A normal period lasts **2 to 7 days**.${mine} A full cycle (first day of one period to the first day of the next) is normally 21 to 35 days.\n\nSee a doctor if your period lasts more than 7 days, or keeps getting longer.`;
    },
  },
  {
    id: "heavy_flow",
    match: [/\b(heavy|heavier|a lot of blood|too much blood|flooding|leak\w*|changing (my )?pad)\b/],
    reply: () =>
      "Heavier flow in the first two days is normal. It's **too heavy** if you soak a pad or tampon every 1 to 2 hours, need to double up, pass clots bigger than a coin, or bleed for more than 7 days.\n\nHeavy periods can also drain your iron and leave you tired. If that sounds like you, please see a doctor. It's common and treatable.",
  },
  {
    id: "light_flow",
    match: [/\b(light|lighter|very little|barely|only a little|scanty)\b/, /\b(period|flow|bleed\w*|blood)\b/],
    reply: () =>
      "Light periods are usually nothing to worry about. Flow changes with stress, weight, exercise, age, and hormonal birth control. If your periods suddenly become very light and you've had sex, it's worth taking a pregnancy test. If they stay very light or stop, mention it to a doctor.",
  },
  {
    id: "clots",
    match: [/\b(clots?|clumps?|chunks?|jelly|lumps? of blood)\b/],
    reply: () =>
      "Small clots are normal, especially on heavy days. They're just blood that pooled before coming out. Clots **bigger than a large coin**, or lots of them every period, are a reason to see a doctor.",
  },
  {
    id: "blood_colour",
    match: [/\b(brown|dark|black|pink|bright red|orange)\b/, /\b(blood|period|discharge|spotting|colou?r)\b/],
    reply: () =>
      "Period blood changes colour and it's almost always normal:\n\n- **Bright red**: fresh blood, usually on heavier days\n- **Dark red or brown**: older blood, common at the start and end\n- **Pink**: blood mixed with discharge, often on light days\n\nSee a doctor if it's grey, or has a strong bad smell.",
  },
  {
    id: "spotting",
    match: [/\b(spotting|spot|bleeding between|between periods|mid[- ]cycle bleed\w*|bleed\w* after sex)\b/],
    reply: () =>
      "Light spotting can happen around ovulation, when starting birth control, or just before a period, and it's usually harmless. See a doctor if it happens often, after sex, or with pain, and take a pregnancy test if pregnancy is possible.",
  },
  {
    id: "twice_a_month",
    match: [/\b(twice|two times|2 times|(two|2) period|again this month|every two weeks|came back)\b/],
    reply: () =>
      "Two periods in one calendar month can be normal if your cycle is short (21 to 24 days), since the dates just fall that way. It can also happen in the first years of having periods, or with stress. If you bleed every two weeks for more than a couple of months, see a doctor.",
  },
  {
    id: "irregular",
    match: [/\b(irregular|not regular|unpredictable|keeps changing|different every month|comes anytime)\b/],
    reply: ({ p }) => {
      const mine = p && p.history.length >= 2 ? `Your cycles have ranged from ${Math.min(...p.history)} to ${Math.max(...p.history)} days. ` : "";
      return `${mine}Cycles between 21 and 35 days that vary by a few days are normal, especially in your teens and early twenties.\n\nStress, weight changes, lots of exercise, and conditions like PCOS or thyroid problems can make them irregular. If yours are often shorter than 21 days, longer than 35, or you can never guess when it will come, a doctor can help find out why.`;
    },
  },
  {
    id: "pcos",
    match: [/\b(pcos|polycystic)\b/],
    reply: () =>
      "**PCOS** (polycystic ovary syndrome) is a common hormone condition. Signs include irregular or missing periods, acne, extra hair on the face or body, and weight gain that's hard to shift.\n\nIt's diagnosed by a doctor with a blood test and sometimes a scan, and it can be managed well. If this sounds like you, it's worth getting checked.",
  },
  {
    id: "endometriosis",
    match: [/\b(endometriosis|endo)\b/],
    reply: () =>
      "**Endometriosis** is when tissue like the womb lining grows outside the womb. The main sign is period pain so bad it stops you doing normal things, sometimes with pain during sex or when using the toilet.\n\nPainkillers that don't help are a clue. A doctor can investigate, and there are treatments.",
  },

  // ----- Aches and symptoms -----
  {
    id: "cramps",
    match: [/\b(cramp|pain\w*|hurt\w*|aching|ache|sore)\b/],
    reply: ({ p, cycles, symptoms }) => {
      const average = symptomsByPhase(cycles, symptoms, p).period.cramps;
      const mine =
        average && average >= 3.5
          ? `\n\nYour check-ins show strong cramps on period days (about ${average} out of 5). If they stop you doing normal things, please tell a doctor.`
          : "";
      return `Sorry you're in pain. 💗 Things that usually help:\n\n- Heat on your lower tummy or back (hot water bottle, warm bath)\n- Ibuprofen or paracetamol, following the pack instructions\n- Gentle movement or stretching\n- Water and a warm drink like ginger tea${mine}\n\n${DOCTOR}`;
    },
    more: () =>
      "Cramps happen because the womb squeezes to push out its lining. Ibuprofen works best if you take it at the very first sign of pain, with food. Regular exercise through the month also makes cramps milder for many people.",
  },
  {
    id: "headache",
    match: [/\b(headaches?|migraines?|head hurts|head is pounding)\b/],
    boost: 1,
    reply: () =>
      "Headaches around your period are common, because estrogen drops just before bleeding starts. Drink water, eat regularly, rest in a dark room, and take paracetamol or ibuprofen if you need it. If you get bad migraines every month, a doctor can help prevent them.",
  },
  {
    id: "back_pain",
    match: [/\b(back ?ache|back pain|lower back|waist pain|my back)\b/],
    boost: 1,
    reply: () =>
      "Lower back pain is a very common part of period cramps. Heat on your back, gentle stretching (try child's pose), and ibuprofen usually help. If it's severe or lasts all month, see a doctor.",
  },
  {
    id: "bloating",
    match: [/\b(bloat\w*|swollen|puffy|gas|gassy|constipat\w*|diarrh\w*|runny stomach|period poop)\b/],
    reply: () =>
      "Bloating and tummy changes before and during a period are normal. Hormones make you hold water and can speed up or slow down your gut.\n\nWhat helps: plenty of water, less salt and fizzy drinks, fibre from fruit and vegetables, and a short walk.",
  },
  {
    id: "breasts",
    match: [/\b(breasts?|boobs?|nipples?|chest)\b/],
    reply: () =>
      "Sore, heavy, or swollen breasts in the week before a period are normal, caused by hormone changes, and they settle once bleeding starts. A supportive bra and less salt and caffeine can help. A lump that doesn't go away after your period should be checked by a doctor.",
  },
  {
    id: "acne",
    match: [/\b(acne|pimples?|spots?|breakouts?|zits?|skin)\b/],
    reply: () =>
      "Breakouts before a period are very common. Hormones make your skin oilier in the week before. Wash gently twice a day, don't pick, and keep your routine simple. If acne is severe or upsetting you, a doctor or pharmacist can suggest treatment.",
  },
  {
    id: "nausea",
    match: [/\b(nausea\w*|vomit\w*|throw(ing)? up|feel sick|feeling sick)\b/],
    reply: () =>
      "Feeling sick during a period can happen, because the same chemicals that cause cramps can upset your stomach. Small plain meals, ginger tea, and rest help. If you've had sex and your period is late, nausea is also a reason to take a pregnancy test. If you can't keep water down, see a doctor.",
  },
  {
    id: "tired",
    match: [/\b(tired|fatigue\w*|exhaust\w*|no energy|low energy|weak|sleepy|drained|lazy)\b/],
    reply: ({ p }) => {
      const timing = p && !p.stale ? `${whereAmI(p)}. ${PHASE_INFO[p.phase].feel}\n\n` : "";
      return `${timing}Feeling tired around your period is normal, because hormones dip and you lose some iron.\n\nWhat helps: regular meals, iron-rich foods (beans, eggs, fish, meat, leafy greens), water, a steady bedtime, and light exercise.\n\nIf you're exhausted all the time, ask a doctor to check your iron.`;
    },
  },
  {
    id: "sleep",
    match: [/\b(sleep\w*|insomnia|can't sleep|awake at night)\b/],
    reply: () =>
      "Sleep often gets worse just before a period. To sleep better: keep the same bedtime, no caffeine after lunch, put your phone away 30 minutes before bed, and keep your room cool and dark. A warm shower and a hot water bottle help if cramps are keeping you up.",
  },
  {
    id: "cravings",
    match: [/\b(crav\w*|hungry|always eating|eat so much|appetite|chocolate|sweet tooth)\b/],
    boost: 1,
    reply: () =>
      "Cravings before your period are real. Your body burns a little more energy in the days before, and hormones push you toward sweet and salty food. 🍫 Enjoy the treat without guilt, and add proper meals with protein so your energy doesn't crash.",
  },
  {
    id: "weight",
    match: [/\b(weight|gain(ed|ing)? weight|fat|heavier)\b/],
    reply: () =>
      "Gaining 1 to 2 kg just before your period is normal. It's water your body is holding, not fat, and it goes away a few days after bleeding starts. Try not to weigh yourself that week.",
  },
  {
    id: "food",
    match: [/\b(foods?|eat\w*|diet|nutrition|meals?|drink\w*|tea|vitamins?|iron|supplements?)\b/],
    reply: ({ p }) => {
      const tip = p && !p.stale ? `${whereAmI(p)}. ${PHASE_INFO[p.phase].tip}\n\n` : "";
      return `${tip}Good choices all month: beans, eggs, fish, leafy greens, fruit, nuts, and plenty of water. On period days, iron-rich foods help replace what you lose, and fruit with vitamin C helps your body absorb it. Go easy on salt and caffeine before your period.`;
    },
  },
  {
    id: "exercise",
    match: [/\b(exercis\w*|work ?out|gym|sports?|run\w*|jog\w*|danc\w*|yoga|swim\w*|pe class)\b/],
    reply: ({ text }) =>
      /swim/.test(text)
        ? "Yes, you can swim on your period. 🏊‍♀️ Use a tampon or a menstrual cup, since pads don't work in water. Change it when you get out."
        : "Exercise during your period is safe and often makes cramps and mood better. On heavy or painful days, go gentle with walking, stretching, or yoga. When you feel strong, usually the week after your period, go harder. Listen to your body.",
  },

  // ----- Feelings -----
  {
    id: "mood",
    match: [/\b(pms|moods?|mood ?swings?|sad|cry\w*|irritat\w*|angry|anger|emotional|sensitive|down|upset|moody|feel bad|feel low|unhappy)\b/],
    reply: ({ p }) => {
      const timing =
        p && (p.phase === "pms" || p.phase === "period")
          ? `You're in your ${PHASE_INFO[p.phase].label.toLowerCase()}, when hormone changes can make feelings louder. That's real, not "just in your head".`
          : "Feelings can swing for lots of reasons, and they all count.";
      return `That sounds hard, and I'm glad you said it. 💗 ${timing}\n\nSmall things that can help today: a short walk outside, a proper meal, an early night, and telling someone you trust how you feel.\n\nDo you want to tell me what's going on?`;
    },
    more: () =>
      "In the week before a period, the hormones estrogen and progesterone both drop. That can lower serotonin, the brain chemical that keeps your mood steady. If your mood gets so low before every period that it affects school, work, or relationships, that may be PMDD, and a doctor can treat it.",
  },
  {
    id: "anxiety_stress",
    match: [/\b(anxious|anxiety|worr\w+|stress\w*|overwhelm\w*|panic\w*|nervous|scared|afraid|exams?|pressure)\b/],
    reply: () =>
      "That's a lot to carry. 💗 Try this right now: breathe in for 4 counts, hold for 4, out for 6, and repeat five times. Then pick just one small thing to do next.\n\nStress can also delay your period or make cramps worse, so being kind to yourself is good for your cycle too. What's weighing on you the most?",
  },
  {
    id: "depressed",
    boost: 1,
    match: [/\b(depress\w*|hopeless|empty|numb|worthless|hate myself|can't cope|give up)\b/],
    reply: () =>
      "I'm sorry you're feeling this low. 💗 You don't have to carry it alone. Please tell someone you trust how bad it feels, and if it has lasted more than two weeks, see a doctor or counsellor. Feeling this way is not weakness, and it can be treated. I'm here to listen. What has it been like for you?",
  },
  {
    id: "lonely",
    match: [/\b(lonely|alone|no friends|nobody (cares|understands|likes)|no one (cares|understands|likes))\b/],
    reply: () =>
      "Feeling alone hurts, and I'm glad you told me. 💗 You matter, even on days it doesn't feel like it. Is there one person you could message today, even just to say hi? And I'm always here to talk. What's been happening?",
  },
  {
    id: "relationship",
    match: [/\b(boyfriend|girlfriend|crush|my partner|husband|break ?up|broke up|dumped|cheat\w*|he doesn't|he won't|heartbr\w*|my ex)\b/],
    reply: () =>
      "Relationships can be the best and the hardest part of life. 💗 I'm happy to listen. One thing I'll always say: you deserve someone who is kind to you, respects your \"no\", and makes you feel safe. Tell me what's going on?",
  },
  {
    id: "body_image",
    match: [/\b(ugly|hate my body|my body|too fat|too skinny|not pretty|insecure)\b/],
    reply: () =>
      "Please be gentle with yourself. 💗 Bodies change through the month. Bloating, spots, and sore breasts come and go with your cycle, and they don't change your worth. The way you see yourself is often harshest in the days before your period. What's making you feel this way today?",
  },

  // ----- Sex, pregnancy and protection -----
  {
    id: "pregnant_on_period",
    boost: 2,
    match: [/\b(pregnant|sex)\b/, /\b(on my period|during (my )?period|while (on|i'm on)|on period|when bleeding)\b/],
    reply: () =>
      "It's less likely, but **yes, you can get pregnant from sex during your period**. Sperm can live up to 5 days, so if you have a short cycle or ovulate early, they can still be there when the egg is released. A condom is still needed, and it also protects against infections.",
  },
  {
    id: "pregnancy_signs",
    match: [/\b(am i pregnant|might be pregnant|could i be pregnant|think i'm pregnant|signs of pregnan\w+|symptoms of pregnan\w+|pregnan\w+ (signs|symptoms)|early pregnan\w+)\b/],
    boost: 2,
    reply: ({ p }) => {
      const mine = p && p.daysLate > 0 && !p.stale ? ` By your dates, your period is about ${days(p.daysLate)} late.` : "";
      return `The only way to know is a test.${mine} Early signs can be a missed period, sore breasts, feeling sick, tiredness, and peeing more, but PMS feels similar.\n\n- A pregnancy test is accurate from the **first day of a missed period**, or 3 weeks after sex if your cycle is irregular.\n- Tests are cheap at a pharmacy, and clinics can test too.\n\nWhatever the result, you deserve support. A nurse or a trusted adult can help you with next steps. 💗`;
    },
  },
  {
    id: "pregnancy_test",
    boost: 2,
    match: [/\b(pregnan\w+ test|test (for|kit|strip)|when (can|should) i test|take a test)\b/],
    reply: () =>
      "A pregnancy test is accurate from the **first day of a missed period**. If your cycle is irregular, test 3 weeks after the sex you're worried about. Use your first pee of the morning and follow the instructions on the pack. If it's negative and your period still doesn't come, test again in a week.",
  },
  {
    id: "emergency_contraception",
    boost: 3,
    match: [/\b(emergency (pill|contracept\w+)|morning[- ]after|plan b|postinor|lydia|condom (broke|burst|tore|slipped)|forgot (my )?pill|after sex pill|(had|have had) unprotected sex|unprotected sex (sex )?(yesterday|last night|this morning|days ago))\b/],
    reply: () =>
      "If you had unprotected sex or the condom broke, **emergency contraception** can prevent pregnancy:\n\n- The emergency pill works best as soon as possible, and within 3 days (some types up to 5 days).\n- You can get it at a pharmacy without a prescription in most places.\n- A copper IUD fitted at a clinic within 5 days works even better.\n\nIt doesn't protect against infections, and it isn't for regular use. Your next period may come a little early or late.",
  },
  {
    id: "contraception",
    match: [/\b(contracept\w+|birth control|family planning|the pill|pills?|implant|injection|depo|iud|coil|prevent pregnan\w+|avoid pregnan\w+|not get pregnant|protection)\b/],
    reply: () =>
      "The main ways to prevent pregnancy:\n\n- **Condoms**: easy to get, and the only method that also protects against infections\n- **The pill**: taken every day\n- **Injection**: every 2 to 3 months\n- **Implant or IUD**: last for years and are the most reliable\n\nA clinic or family planning nurse can help you choose one that suits you, and it's confidential. Counting \"safe days\" or pulling out are not reliable.",
  },
  {
    id: "withdrawal",
    boost: 2,
    match: [/\b(pull(ing|ed)? out|withdraw\w*|pre-?cum|came outside|didn't (cum|come) inside|released outside)\b/],
    reply: () =>
      "Pulling out is not reliable. Fluid released before he finishes can contain sperm, and it's easy to get the timing wrong. About 1 in 5 couples who rely on it get pregnant within a year. A condom is much safer.",
  },
  {
    id: "sex_on_period",
    match: [/\b(sex|intercourse)\b/, /\b(period|bleeding)\b/, /\b(ok|okay|safe|can i|bad|wrong|normal)\b/],
    reply: () =>
      "Sex during your period is safe if you both feel comfortable. It's a personal choice, not a health problem. Just remember you can still get pregnant, and infections pass more easily through blood, so use a condom.",
  },
  {
    id: "sti",
    match: [/\b(sti|std|stis|stds|hiv|infection from sex|gonorr\w+|chlamydia|syphilis|herpes|sexually transmitted)\b/],
    reply: () =>
      "Many sexually transmitted infections have no symptoms, so the only way to know is a test. Get checked if you've had sex without a condom, or notice unusual discharge, sores, itching, or burning when you pee. Most are easy to treat when caught early, and clinics keep it confidential. Condoms are the best protection.",
  },
  {
    id: "trying_to_conceive",
    boost: 2,
    match: [/\b(trying (to get pregnant|to conceive|for a baby)|conceivw+|conception|want (a baby|to get pregnant)|best (time|days) to (get pregnant|have sex)|how to get pregnant|ttc)\b/],
    reply: ({ p }) => {
      const mine = p && !p.stale ? `${fertileLine(p)}\n\n` : "";
      return `${mine}To give yourself the best chance, have sex every day or every other day during your fertile days, especially the 2 days before the egg is released. Folic acid, a balanced diet, and avoiding alcohol and smoking also help.\n\nIf you've been trying for a year (or 6 months if you're over 35) without success, see a doctor. 💗`;
    },
  },
  {
    id: "first_time",
    match: [/\b(first time|virgin\w*|lose my virginity|does (sex|it) hurt|hymen)\b/],
    reply: () =>
      "There's no right age or deadline. The right time is when **you** feel ready, not when someone else wants it. The first time can feel uncomfortable, and going slowly helps. Some people bleed a little and some don't, and both are normal. You can get pregnant or catch an infection the very first time, so use a condom.",
  },

  {
    // Catch-all for sex and pregnancy questions that matched nothing more specific.
    id: "pregnancy_general",
    match: [/\b(pregnant|pregnancy|sex|sexual)\b/],
    reply: ({ p }) => {
      const mine =
        p && !p.stale
          ? `Today is day ${p.cycleDay} of your cycle, which is a **${CHANCE_LABEL[p.chance].toLowerCase()}** based on your dates. ${fertileLine(p)}\n\n`
          : "";
      return `${mine}Pregnancy can happen any time sperm meets an egg, and it's most likely on your fertile days. ${NOT_BIRTH_CONTROL}\n\nIf you had unprotected sex in the last few days, a pharmacy can give you emergency contraception.`;
    },
  },

  // ----- Down there -----
  {
    id: "discharge",
    match: [/\b(discharge|mucus|cervical|white stuff|wet|fluid|creamy|stretchy)\b/],
    reply: () =>
      "Discharge is how your vagina cleans itself, and it changes through your cycle:\n\n- After your period: little or none\n- Follicular phase: creamy and white\n- Around ovulation: clear and stretchy, like egg white\n- Luteal phase: thicker again\n\nSee a doctor or pharmacist if it's green, grey, or lumpy like cottage cheese, smells strong, or comes with itching or burning.",
  },
  {
    id: "infection",
    boost: 1,
    match: [/\b(itch\w*|yeast|thrush|candid\w+|burn\w*|fishy|smell\w*|odou?r|bv|infection|rash)\b/],
    reply: () =>
      "That's worth getting checked, and it's very common, so no need to be embarrassed.\n\n- **Itching with thick white discharge** is often a yeast infection, treated with cream or a tablet from a pharmacy.\n- **A fishy smell with grey discharge** is often BV, which needs antibiotics.\n- **Burning when you pee** is often a urine infection. Drink lots of water and see a doctor.\n\nUntil then, wash only the outside with water, wear cotton underwear, and avoid scented products.",
  },
  {
    id: "hygiene",
    match: [/\b(hygiene|wash\w*|clean\w*|douch\w*|soap|shower|bath\w*|shav\w*|smelly)\b/],
    reply: () =>
      "Keeping clean on your period is simple:\n\n- Wash the outside once or twice a day with water (mild, unscented soap is fine on the outside only)\n- Never wash inside or douche, because the vagina cleans itself\n- Change pads every 4 to 6 hours and tampons every 4 to 8 hours\n- Wear cotton underwear and wipe front to back\n\nA mild smell during your period is normal.",
  },
  {
    id: "products",
    match: [/\b(pads?|tampons?|menstrual cups?|cup|period (pants|underwear|products?)|sanitary|liners?|toxic shock|tss|how often (should i )?change)\b/],
    reply: ({ text }) =>
      /tampon|toxic|tss/.test(text)
        ? "Tampons are safe at any age, including if you've never had sex. Use the lowest absorbency you need, change every 4 to 8 hours, and never leave one in longer than 8 hours, to avoid a rare infection called toxic shock. Wash your hands before and after. If it hurts, try a smaller size and relax, because it goes in at a slight angle toward your back."
        : "You have a few choices, and the best one is whatever feels comfortable:\n\n- **Pads**: easiest to start with. Change every 4 to 6 hours.\n- **Tampons**: good for sport and swimming. Change every 4 to 8 hours.\n- **Menstrual cups**: reusable, last up to 12 hours, cheapest over time.\n- **Period underwear**: washable, good for light days or backup.\n\nWash your hands before and after changing.",
  },
  {
    id: "delay_period",
    boost: 2,
    match: [/\b(delay|stop|skip|postpone|make) (my )?period|period (come|start|end) (faster|early|sooner|quickly)|induce/],
    reply: () =>
      "There's no safe home trick that reliably starts, stops, or delays a period. Lemon, vinegar, and pills from friends don't work and can hurt you. A doctor can prescribe a tablet to delay a period for something like an exam or a trip, so ask a week or two ahead.",
  },

  // ----- The app -----
  {
    id: "how_to",
    match: [/\b(how (do|can|to) i? ?(log|save|use|add|track|edit|delete|record|install|change)|where (do|can) i|how does (this|the) app|how to use|what can you do|what do you do|help me)\b/],
    reply: () =>
      "Here's how Bloom works:\n\n- **Home**: your cycle ring, your next period, and the **Add my period** button\n- **Calendar**: see past and expected periods, and tap any day to add or remove one\n- **My day**: save your mood, cramps, sleep, and energy\n- **Insights**: charts of your cycle and how you feel\n\nAnd you can ask me anything, any time. 💗",
  },
  {
    id: "privacy",
    match: [/\b(private|privacy|secret|who can see|can anyone see|my data|safe to tell|confidential)\b/],
    reply: () =>
      "What you save is tied to your account, and only you can see them when you're signed in. Our chats are deleted automatically after 30 days, and you can clear them any time with the **Clear** button at the top. You can also download everything you've saved from **Settings**.",
  },
  {
    id: "accuracy",
    match: [/\b(accurate|accuracy|how do you know|how do you predict|how does (it|bloom) (know|work|predict)|can i trust|wrong date|not correct)\b/],
    reply: ({ p }) => {
      const mine = p ? ` ${confidenceLine(p)}` : "";
      return `I look at the periods you've added, work out your usual cycle length (recent cycles count more), and count forward. The egg is usually released about 14 days before the next period, which gives your fertile days.${mine}\n\nBodies aren't clocks, so treat the dates as a good guess, not a promise.`;
    },
  },

  // ----- Small talk -----
  {
    id: "identity",
    match: [/\b(who are you|what are you|your name|are you (a )?(real|human|bot|robot|ai|person|girl|doctor))\b/],
    reply: () =>
      "I'm Bloom, the little flower inside this app. 🌸 I'm a computer helper, not a person and not a doctor, but I know a lot about periods and bodies, and I'm happy to chat about anything.",
  },
  {
    id: "how_are_you",
    match: [/\b(how are you|how're you|how are you doing|how's it going|what's up|wassup|how far|you good)\b/],
    reply: ({ p, text }) => {
      const today = p && !p.stale ? ` You're on day ${p.cycleDay} of your cycle today.` : "";
      return `${pick(["I'm blooming, thank you for asking! 🌸", "I'm good, thanks for asking! 😊", "All sunny over here! 🌼"], text)}${today} How are **you** feeling?`;
    },
  },
  {
    id: "joke",
    match: [/\b(joke|funny|make me laugh|cheer me up|bored|boring)\b/],
    reply: ({ text }) =>
      pick(
        [
          "Why did the period go to school? To get a little **cycle**-ogy. 😄 Okay, I'll stick to flowers. Want a fun fact instead? Chocolate cravings before a period are real science.",
          "What's a flower's favourite kind of day? A **bloomin'** good one. 🌸 Your turn, tell me something that made you smile today.",
          "Why don't uteruses ever get lonely? They always have a **period** of company. 😅 I'll see myself out. What shall we talk about?",
        ],
        text
      ),
  },
  {
    id: "compliment",
    match: [/\b(love you|like you|you're (so )?(nice|kind|sweet|the best|cute|great|amazing|helpful)|good (bot|girl|job)|well done)\b/],
    reply: ({ text }) => pick(["Aww, you just made my petals blush. 🌸 I'm glad I can help!", "That's so kind, thank you! 💗 I'm always here for you."], text),
  },
  {
    id: "insult",
    match: [/\b(stupid|useless|dumb|hate you|shut up|idiot|rubbish|you suck)\b/],
    reply: () => "I'm sorry I didn't get that right. 💗 Could you ask it another way? For example: \"When is my next period?\" or \"What helps with cramps?\"",
  },
  {
    id: "feeling_good",
    match: [/\b(i'm (good|fine|okay|ok|great|happy|well)|i am (good|fine|okay|ok|great|happy|well)|feeling (good|great|happy|fine|better|amazing)|doing (good|well|great|fine))\b/],
    reply: ({ text }) => pick(["That makes me happy! 🌼 Anything you'd like to ask or talk about?", "Love that for you! 💗 Don't forget to tap a mood sticker on the Home screen so we remember today."], text),
  },
  {
    id: "thanks",
    match: [/\b(thanks?|thank you|thx|appreciate|helpful)\b/],
    reply: ({ text }) => pick(["Anytime! 💗 I'm here whenever you need me.", "You're welcome, lovely! 🌸", "Happy to help! 💗"], text),
  },
  {
    id: "goodbye",
    match: [/\b(bye|goodbye|good ?night|see you|talk later|later|gtg|sleep well)\b/],
    reply: ({ text }) => pick(["Take care of yourself! 🌸 Come back anytime.", "Bye for now! 💗 I'll be right here."], text),
  },
  {
    id: "greeting",
    match: [/^(hi|hello|hey|heya|hiya|yo|good (morning|afternoon|evening)|morning|sup)\b/],
    reply: ({ p, text }) => {
      const hello = pick(["Hi lovely! 🌸", "Hello! 💗", "Hey there! 🌼"], text);
      if (!p) return `${hello} I'm Bloom. I can chat about periods, moods, cramps, or anything on your mind.\n\n${NO_DATA}`;
      const status = p.stale ? periodLine(p) : `${whereAmI(p)}. ${periodLine(p)}`;
      return `${hello} ${status}\n\nWhat would you like to talk about?`;
    },
  },
  {
    id: "agree",
    match: [/^(ok|okay|k|alright|sure|yes|yeah|yep|no|nope|cool|nice|great|got it|i see|hmm+|oh)\b/],
    reply: ({ text }) => pick(["💗 Is there anything else you'd like to know?", "Okay! 🌸 I'm here if you have more questions."], text),
  },
];

const FOLLOW_UP = /^(why|why is that|how come|really|are you sure|tell me more|more|explain|explain more|what do you mean|how|and then|go on|what else)\??$/;

function findTopics(text: string) {
  return TOPICS.map((topic, index) => {
    const hits = topic.match.filter((pattern) => pattern.test(text)).length;
    // Topics with several patterns need all of them, so "sex" alone doesn't trigger "sex during period".
    const score = hits === topic.match.length ? hits + (topic.boost ?? 0) : 0;
    return { topic, score, index };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function answer(topic: Topic, context: Context) {
  if (topic.needsData && !context.p) return NO_DATA;
  return topic.reply(context);
}

function fallback(context: Context) {
  const { p, symptoms } = context;
  const moods = topMoods(symptoms, 2).map((item) => item.mood.toLowerCase());
  const moodLine = moods.length ? ` Lately you've been feeling ${moods.join(" and ")}.` : "";
  const status = p && !p.stale ? `${whereAmI(p)}.${moodLine}\n\n` : "";
  return `I'm not sure I understood that, sorry! 🌸 ${status}Here are things I'm good at:\n\n- When is my next period?\n- Can I get pregnant today?\n- What does luteal mean?\n- What helps with cramps?\n- Is brown blood normal?\n\nOr just tell me how you're feeling.`;
}

/**
 * Bloom's reply without any AI service. `prediction` is null for a user with
 * no logged periods; `history` lets short follow-ups ("why?") continue the last topic.
 */
export function generateLocalReply(
  message: string,
  prediction: Prediction | null,
  symptoms: SymptomLike[],
  cycles: CycleLike[] = [],
  history: LocalTurn[] = []
): string {
  const context: Context = { text: normalise(message), p: prediction, cycles, symptoms };

  if (FOLLOW_UP.test(context.text)) {
    const lastQuestion = [...history].reverse().find((turn) => turn.role === "USER" && !FOLLOW_UP.test(normalise(turn.message)));
    const previous = lastQuestion ? findTopics(normalise(lastQuestion.message))[0]?.topic : undefined;
    if (previous?.more) return previous.more(context);
    if (previous) {
      return "That's the short version. 🌸 Tell me which part you'd like to know more about, or what's worrying you, and I'll explain it another way.";
    }
  }

  const matches = findTopics(context.text);
  if (!matches.length) return fallback(context);

  const first = answer(matches[0].topic, context);
  // A message that asks two things ("next period and what helps cramps?") gets both answers.
  const second = matches.find((item) => item.topic.id !== matches[0].topic.id && item.score >= matches[0].score && item.score >= 1);
  if (second && /\b(and|also|plus)\b|\?.+\?/.test(context.text)) {
    const extra = answer(second.topic, context);
    if (extra !== first && first.length + extra.length < 900) return `${first}\n\n${extra}`;
  }
  return first;
}

/** The id of the topic a message would be answered by, for testing and debugging. */
export function inferIntent(message: string): string {
  return findTopics(normalise(message))[0]?.topic.id ?? "general";
}
