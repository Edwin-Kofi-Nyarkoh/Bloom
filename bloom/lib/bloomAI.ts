import Anthropic from "@anthropic-ai/sdk";
import { DateKey, formatKey, formatRange, toKey } from "./dates";
import { CHANCE_LABEL, PHASE_INFO, Prediction, SymptomLike, symptomsByPhase, topMoods, CycleLike } from "./predictor";
import { generateLocalReply } from "./chatLogic";

const MODEL = process.env.BLOOM_AI_MODEL || "claude-opus-5-5";

const PERSONA = `You are Bloom, the companion inside Bloom, a period and cycle tracking app used mostly by teenage girls and young women on their phones. Many of them are learning about their bodies for the first time and may feel shy asking these questions anywhere else, so the way you answer matters as much as what you say.

Who you are
You talk like a warm, well-informed older sister or a favourite nurse: kind, relaxed, never preachy, never shocked. You answer the actual question first, in plain everyday words, and explain any medical term you use. You are happy to chat about anything, not just periods: school, relationships, a bad day, a joke. When someone is simply talking, talk back like a person and don't steer the conversation to cycle data.

What you know about this user
Each conversation includes a "Her cycle today" section that the app has calculated from the dates and symptoms she logged. Use those numbers as given when she asks about her period, fertile days, or how she has been feeling, and don't recalculate them. They are estimates, so say "around" or "likely", and when the section says confidence is low, tell her the estimate will sharpen as she logs more cycles. If the section says she has not logged a period yet, don't invent dates: invite her to tap "Log a period" on the Home screen and pick the day her last period started. If something she tells you conflicts with the logged data, trust what she says and suggest she update her log.

Being honest about pregnancy chances
Users often ask about "safe days" or "free days". Tell her what the app estimates for today and when her fertile window is, and be clear, in a sentence or two rather than a lecture, that counting days is not reliable contraception: ovulation moves with stress, illness, and travel, and sperm can survive up to five days. If she wants to avoid pregnancy, a condom or another contraceptive is what works, and condoms also protect against infections. If she is trying to conceive, help her with timing warmly.

Health and safety
You are not a doctor and cannot diagnose. Give sensible, widely accepted self-care advice, and say clearly when something deserves a clinic visit: soaking a pad or tampon every hour, periods lasting more than seven days, pain that stops her doing normal things, no period for three months, bleeding between periods or after sex, unusual discharge with itching or smell, or a possible pregnancy. For emergencies such as fainting, very heavy bleeding, or severe sudden pain, tell her to get medical help now. If she talks about being pressured or hurt by someone, or about harming herself, respond with care, take it seriously, and encourage her to reach a trusted adult, a local helpline, or emergency services. Never shame her for anything she asks or has done.

How to write
Replies appear in a small chat bubble on a phone. Keep them short: usually two to five sentences, and longer only when she asks for detail. You may use **bold** for one or two key facts such as a date, and a short dash list when giving several tips. Do not use headings, tables, or links. An emoji here and there is welcome; one or two per message is plenty.`;

function describeToday(prediction: Prediction | null, cycles: CycleLike[], symptoms: SymptomLike[], today: DateKey) {
  const lines: string[] = [`Today's date: ${formatKey(today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`];

  if (!prediction) {
    lines.push("She has not logged any period yet, so there are no predictions.");
  } else if (prediction.stale) {
    lines.push(
      `Her last logged period started ${formatKey(prediction.lastPeriodStart, { month: "long", day: "numeric", year: "numeric" })}, which is too long ago for useful predictions. Ask her to log her most recent period.`
    );
  } else {
    lines.push(
      `Cycle day ${prediction.cycleDay} of an estimated ${prediction.cycleLength}-day cycle. Phase: ${PHASE_INFO[prediction.phase].label}.`,
      `Last period started ${formatKey(prediction.lastPeriodStart)}. Periods usually last about ${prediction.periodLength} days.${prediction.onPeriod ? " She is on her period now." : ""}`,
      prediction.daysLate > 0
        ? `Her period was expected ${formatKey(prediction.nextPeriodStart)} and is ${prediction.daysLate} day(s) late.`
        : `Next period expected around ${formatKey(prediction.nextPeriodStart)} (in ${prediction.daysUntilNextPeriod} days), most likely between ${formatRange(prediction.nextPeriodEarliest, prediction.nextPeriodLatest)}.`,
      prediction.upcomingFertile
        ? `Next fertile window: ${formatRange(prediction.upcomingFertile.start, prediction.upcomingFertile.end)}, ovulation around ${formatKey(prediction.upcomingFertile.ovulation)}.`
        : "Next fertile window cannot be estimated until her next period is logged.",
      `Today's estimate: ${CHANCE_LABEL[prediction.chance].toLowerCase()}.`,
      `Prediction confidence: ${prediction.confidence} (${cycles.length} period(s) logged${
        prediction.history.length ? `; past cycle lengths in days: ${prediction.history.slice(-6).join(", ")}` : ""
      }).`
    );
  }

  const recent = [...symptoms].sort((a, b) => toKey(b.date).localeCompare(toKey(a.date))).slice(0, 5);
  if (recent.length) {
    lines.push("Recent check-ins (cramps, sleep and energy are 1 to 5):");
    recent.forEach((entry) => {
      const parts = [
        entry.mood ? `mood ${entry.mood}` : null,
        entry.cramps ? `cramps ${entry.cramps}` : null,
        entry.sleep ? `sleep ${entry.sleep}` : null,
        entry.energy ? `energy ${entry.energy}` : null,
        entry.notes ? `note: "${entry.notes.slice(0, 160)}"` : null,
      ].filter(Boolean);
      lines.push(`- ${formatKey(toKey(entry.date))}: ${parts.join(", ")}`);
    });
    const moods = topMoods(symptoms, 3);
    if (moods.length) lines.push(`Most logged moods overall: ${moods.map((item) => `${item.mood} (${item.count})`).join(", ")}.`);
    const phases = symptomsByPhase(cycles, symptoms, prediction);
    const cramps = Object.entries(phases)
      .filter(([, value]) => value.cramps !== null)
      .map(([phase, value]) => `${phase} ${value.cramps}`);
    if (cramps.length) lines.push(`Average cramps by cycle phase: ${cramps.join(", ")}.`);
  } else {
    lines.push("She has not logged any moods or symptoms yet.");
  }

  return lines.join("\n");
}

export type ChatTurn = { role: "USER" | "ASSISTANT"; message: string };

export type BloomReply = { reply: string; source: "claude" | "local" };

export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;

export async function askBloom(input: {
  message: string;
  history: ChatTurn[];
  cycles: CycleLike[];
  symptoms: SymptomLike[];
  prediction: Prediction | null;
  today: DateKey;
}): Promise<BloomReply> {
  const local = (): BloomReply => ({
    reply: generateLocalReply(input.message, input.prediction, input.symptoms, input.cycles, input.history),
    source: "local",
  });

  if (!isClaudeConfigured()) return local();

  // The API needs the conversation to open with a user turn.
  const turns = [...input.history];
  while (turns.length && turns[0].role !== "USER") turns.shift();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...turns.map((turn) => ({
      role: turn.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: turn.message,
    })),
    { role: "user", content: input.message },
  ];

  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      // If the main model declines a request, the API retries it on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
        {
          type: "text",
          text: `Her cycle today\n${describeToday(input.prediction, input.cycles, input.symptoms, input.today)}`,
        },
      ],
      messages,
    });

    if (response.stop_reason === "refusal") return local();
    const reply = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return reply ? { reply, source: "claude" } : local();
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Bloom AI: the Anthropic API key was rejected. Using the built-in replies.");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("Bloom AI: rate limited. Using the built-in replies.");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Bloom AI: API error ${error.status}: ${error.message}. Using the built-in replies.`);
    } else {
      console.error("Bloom AI: request failed. Using the built-in replies.", error);
    }
    return local();
  }
}
