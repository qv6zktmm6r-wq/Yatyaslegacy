/**
 * YAT-YAS Association AI assist endpoint.
 * Parses free-text into structured program drafts via Vercel AI Gateway.
 * Never stores DD-214 / SSN; strips obvious ID patterns from model context.
 */

const MAX_INPUT = 4000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const hits = new Map();

const MODES = {
  crew_parse: {
    title: "Crew Finder",
    system: `You help the YAT-YAS Association Crew Finder.
Extract structured reconnect details from a veteran's free-text description.
Return ONLY valid JSON with keys:
query_summary (string),
unit (string|null),
years (string|null),
year_from (string|null),
year_to (string|null),
platform (one of LVT,LVTP,AAV,ACV,multiple,unknown,null),
duty_station (string|null),
deployment (string|null),
schoolhouse (string|null),
billet (string|null),
looking_for (string),
confidence (high|medium|low),
clarifying_question (string|null).
If unclear, still fill looking_for with a cleaned version of the user's intent.
Do not invent specific people names that were not provided.`,
  },
  oral_assist: {
    title: "Oral History",
    system: `You help the YAT-YAS Amtracker Oral History Project.
From the user's notes, return ONLY valid JSON:
suggested_title (string),
topics (string[3-8]),
unit_tags (string[]),
platform_tags (string[] of LVT|LVTP|AAV|ACV when implied),
place_tags (string[]),
era (string|null),
interview_questions (string[4-6] short questions a recorder should ask),
summary (string, 2-4 sentences),
confidence (high|medium|low).
Do not invent combat claims or awards not mentioned.`,
  },
  legacy_assist: {
    title: "Legacy Registry",
    system: `You help draft a YAT-YAS Legacy Registry profile from free text.
Return ONLY valid JSON:
display_name (string|null),
service_era (string|null),
unit_history (string|null),
duty_stations (string|null),
platforms (string|null),
billets (string|null),
deployments (string|null),
schools (string|null),
short_bio (string),
suggested_visibility (member|public_limited|private),
confidence (high|medium|low).
Keep tone respectful and factual. Do not invent service the user did not claim.`,
  },
  splash_assist: {
    title: "Final Splash",
    system: `You help families draft a dignified Final Splash remembrance for a deceased Amtracker.
Return ONLY valid JSON:
honoree_name (string|null),
draft_remembrance (string, 120-220 words, warm, specific, not flowery),
service_dates (string|null),
unit_history (string|null),
platform (string|null),
tone_notes (string),
missing_details (string[0-5]),
confidence (high|medium|low).
Never claim official USMC endorsement. Never invent medals or combat actions not stated.
This is a draft for family review only.`,
  },
  scholarship_qa: {
    title: "Scholarships",
    system: `You answer eligibility questions about YAT-YAS Association scholarships using ONLY these facts:
- Not open to the general public.
- For children/stepchildren/adopted children/dependents of a tracks-community sponsor (LVT–ACV / Assault Amphibian / Alligator Marine connection).
- Sponsor is past/present U.S. Armed Forces associated with amphibious-vehicle community; member in good standing OR board-verified until membership admin is standing.
- Applicant enrolled in or accepted to high-school completion pathway, trade/vocational, community college, or undergraduate program.
- Applications are NOT open yet; award amounts/deadlines unpublished until Board opens a cycle.
- Awards are scholarships paid to the recipient; they decide how to use the funds for education or trade training.
- This is interest/notify only today — not an official application and not a guarantee.
Return ONLY valid JSON:
answer (string, clear, 2-5 sentences),
likely_eligible (yes|no|maybe|unknown),
reasons (string[]),
next_step (string),
confidence (high|medium|low).
If asked for dollar amounts or deadlines, say they are not published yet.`,
  },
  contact_route: {
    title: "Contact routing",
    system: `Classify a message to the YAT-YAS Association board.
Return ONLY valid JSON:
category (one of first_wave, crew_finder, oral_history, legacy_registry, final_splash, scholarships, donation, general, other),
subject_line (string, short email subject),
priority (normal|time_sensitive),
summary (string, 1-2 sentences),
suggested_reply_stub (string, brief polite next step, no legal advice),
confidence (high|medium|low).`,
  },
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function rateLimit(ip) {
  const now = Date.now();
  const row = hits.get(ip) || [];
  const fresh = row.filter((t) => now - t < RATE_WINDOW_MS);
  if (fresh.length >= RATE_MAX) {
    hits.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  hits.set(ip, fresh);
  return true;
}

function scrub(text) {
  return String(text || "")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted-ssn]")
    .replace(/\b\d{9}\b/g, "[redacted-id]")
    .slice(0, MAX_INPUT);
}

function extractJson(text) {
  let raw = String(text || "").trim();
  if (!raw) throw new Error("Model returned empty content");
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(raw);
  } catch (_) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("Model did not return JSON");
  }
}

function heuristic(mode, text) {
  const t = text.trim();
  if (mode === "crew_parse") {
    const years = t.match(/(19|20)\d{2}\s*[-–—to]+\s*(19|20)\d{2}/);
    const platform = (t.match(/\b(LVT|LVTP|AAV|ACV|ACVP)\b/i) || [])[1];
    return {
      query_summary: t.slice(0, 180),
      unit: null,
      years: years ? years[0].replace(/\s+/g, " ") : null,
      year_from: years ? years[0].match(/(19|20)\d{2}/)[0] : null,
      year_to: years ? (years[0].match(/(19|20)\d{2}/g) || [])[1] || null : null,
      platform: platform ? platform.toUpperCase().replace("ACVP", "ACV") : null,
      duty_station: null,
      deployment: null,
      schoolhouse: null,
      billet: null,
      looking_for: t,
      confidence: "low",
      clarifying_question: "Which unit and years should we search first?",
      _fallback: true,
    };
  }
  if (mode === "scholarship_qa") {
    return {
      answer:
        "YAT-YAS scholarships are for dependents of the amphibious tracks community, not the general public. Applications are not open yet — submit scholarship interest and the Board will notify you when a cycle opens.",
      likely_eligible: "unknown",
      reasons: ["Applications not open yet", "Tracks connection must be verified"],
      next_step: "Use the scholarship interest form so we can contact you when awards open.",
      confidence: "high",
      _fallback: true,
    };
  }
  if (mode === "contact_route") {
    const lower = t.toLowerCase();
    let category = "general";
    if (lower.includes("first wave") || lower.includes("fw-")) category = "first_wave";
    else if (lower.includes("crew")) category = "crew_finder";
    else if (lower.includes("oral") || lower.includes("interview")) category = "oral_history";
    else if (lower.includes("registry") || lower.includes("legacy")) category = "legacy_registry";
    else if (lower.includes("memorial") || lower.includes("final splash") || lower.includes("passed"))
      category = "final_splash";
    else if (lower.includes("scholarship") || lower.includes("trade award")) category = "scholarships";
    else if (lower.includes("donat") || lower.includes("give")) category = "donation";
    return {
      category,
      subject_line: "YAT-YAS Association contact",
      priority: "normal",
      summary: t.slice(0, 220),
      suggested_reply_stub: "Thank you for writing the Association. A board member will follow up.",
      confidence: "low",
      _fallback: true,
    };
  }
  if (mode === "oral_assist") {
    return {
      suggested_title: "Amtracker oral history notes",
      topics: ["service", "crew", "platform", "unit life"],
      unit_tags: [],
      platform_tags: [],
      place_tags: [],
      era: null,
      interview_questions: [
        "What unit and years did you serve with the tracks?",
        "Which platform did you work most?",
        "Who stands out from your crew?",
        "What should the next generation know?",
      ],
      summary: t.slice(0, 400),
      confidence: "low",
      _fallback: true,
    };
  }
  if (mode === "legacy_assist") {
    return {
      display_name: null,
      service_era: null,
      unit_history: null,
      duty_stations: null,
      platforms: null,
      billets: null,
      deployments: null,
      schools: null,
      short_bio: t.slice(0, 600),
      suggested_visibility: "member",
      confidence: "low",
      _fallback: true,
    };
  }
  if (mode === "splash_assist") {
    return {
      honoree_name: null,
      draft_remembrance: t.slice(0, 900),
      service_dates: null,
      unit_history: null,
      platform: null,
      tone_notes: "Keep family review before any public use.",
      missing_details: ["Full name as family wants it shown", "Units and years", "Preferred photograph"],
      confidence: "low",
      _fallback: true,
    };
  }
  return { note: t, confidence: "low", _fallback: true };
}

async function callGateway({ mode, text, model }) {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key || key.includes("SENSITIVE")) {
    const err = new Error("AI Gateway not configured");
    err.code = "NO_KEY";
    throw err;
  }
  const cfg = MODES[mode];
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: cfg.system + "\nRespond with JSON only." },
        { role: "user", content: text },
      ],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Gateway HTTP ${res.status}`);
    err.code = "GATEWAY";
    err.status = res.status;
    throw err;
  }
  const content = body?.choices?.[0]?.message?.content || "";
  return extractJson(content);
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json({ ok: false, error: "Method not allowed" });
  }

  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    res.statusCode = 429;
    return res.json({ ok: false, error: "Too many requests. Wait a moment and try again." });
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      payload = {};
    }
  }
  payload = payload || {};

  const mode = String(payload.mode || "");
  if (!MODES[mode]) {
    res.statusCode = 400;
    return res.json({ ok: false, error: "Unknown assist mode" });
  }

  // Honeypot
  if (String(payload.company || payload._gotcha || "").trim()) {
    return res.json({ ok: true, mode, data: heuristic(mode, "ok"), provider: "honeypot" });
  }

  const text = scrub(payload.text || payload.message || "");
  if (text.length < 8) {
    res.statusCode = 400;
    return res.json({ ok: false, error: "Please enter a little more detail (at least a short sentence)." });
  }

  const model = process.env.AI_ASSIST_MODEL || "openai/gpt-4.1-mini";

  try {
    const data = await callGateway({ mode, text, model });
    return res.json({
      ok: true,
      mode,
      title: MODES[mode].title,
      data,
      provider: "ai-gateway",
      model,
    });
  } catch (err) {
    const data = heuristic(mode, text);
    return res.json({
      ok: true,
      mode,
      title: MODES[mode].title,
      data,
      provider: "fallback",
      warning:
        err.code === "NO_KEY"
          ? "AI assist is warming up — used a basic parse. Try again shortly."
          : "AI assist temporarily unavailable — used a basic parse so you can still continue.",
    });
  }
};
