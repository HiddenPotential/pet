// Teach Your Pet — front-end logic (plain JavaScript, no build step).

const PETS = ["puppy", "kitten", "baby dragon", "owl", "hamster", "fox"].map((kind) => ({ kind }));
const EXAMPLES = [
  "Plants make their own food from sunlight, water and carbon dioxide through photosynthesis.",
  "The seasons happen because Earth's axis is tilted, not because Earth gets closer to the Sun.",
  "The Bill of Rights is the first ten amendments to the U.S. Constitution.",
  "Multiplying two negative numbers gives a positive number.",
];

const $ = (id) => document.getElementById(id);
const state = {
  pet: null, // { kind, name, xp, facts: [] }
  fact: "",
  title: "",
  keyIdeas: [],
  learned: new Set(),
  history: [],
  stats: { mistakes: 0, fixed: 0, petTest: null },
  review: null, // the saved review record when re-teaching a fact, else null
  anger: 0, // 0 calm … 3 furious; goes up each time you teach something wrong in a row
  quiz: { stage: "pre", questions: [], preScore: 0, postScore: 0, preQuestions: [] },
};

// ---------- helpers ----------
function show(screen) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  $(`screen-${screen}`).classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function loading(on, text = "Thinking…") {
  $("loading").classList.toggle("hidden", !on);
  $("loading-text").textContent = text;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const fmt = (s) => esc(s).replace(/\*(.+?)\*/g, "<i>$1</i>");

async function api(name, body) {
  const res = await fetch(`/api/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function withLoading(text, fn) {
  loading(true, text);
  try {
    return await fn();
  } catch (e) {
    alert(e.message);
  } finally {
    loading(false);
  }
}

// ---------- saved pet (localStorage) ----------
function loadPet() {
  try { return JSON.parse(localStorage.getItem("teach-your-pet")); } catch { return null; }
}
function savePet() {
  localStorage.setItem("teach-your-pet", JSON.stringify(state.pet));
}
const level = (xp) => Math.floor(xp / 100) + 1;

// ---------- streak + spaced review ----------
// Teach at least once a day to keep a streak. Facts you taught a while ago come back for review,
// because re-explaining something after a gap is what makes it stick (spaced repetition).
const DAY = 24 * 60 * 60 * 1000;
const dayKey = (t = Date.now()) => new Date(t).toDateString();
function currentStreak(pet) {
  const s = pet?.streak;
  if (!s) return 0;
  return s.last === dayKey() || s.last === dayKey(Date.now() - DAY) ? s.count : 0;
}
function bumpStreak(pet) {
  const s = pet.streak;
  if (s?.last === dayKey()) return;
  pet.streak = { count: s?.last === dayKey(Date.now() - DAY) ? s.count + 1 : 1, last: dayKey() };
}
const REVIEW_AFTER = [1, 3, 7, 14, 30]; // days until the next review, getting longer each time
function dueReviews(pet) {
  return (pet?.reviews || []).filter((r) => Date.now() >= r.due).sort((a, b) => a.due - b.due);
}
function scheduleReview(pet, { title, fact, keyIdeas, asked }, score) {
  pet.reviews ||= [];
  let r = pet.reviews.find((x) => x.fact === fact);
  if (!r) pet.reviews.push((r = { title, fact, step: -1, count: 0 }));
  // a strong final score moves the next review further away; a weak one brings it back soon
  r.step = score >= 70 ? Math.min(r.step + 1, REVIEW_AFTER.length - 1) : 0;
  r.at = Date.now();
  r.due = Date.now() + REVIEW_AFTER[r.step] * DAY;
  // keep the same big ideas so a review re-teaches the same thing, and remember the
  // questions already asked so the next memory check uses new ones
  r.keyIdeas = keyIdeas;
  r.asked = [...(r.asked || []), ...asked].slice(-12);
  r.lastScore = score;
}
const inDays = (t) => { const d = Math.max(1, Math.ceil((t - Date.now()) / DAY)); return d === 1 ? "tomorrow" : `in ${d} days`; };
function renderReview(pet) {
  const due = dueReviews(pet);
  $("review").classList.toggle("hidden", !due.length);
  if (!due.length) return;
  const ago = (t) => { const d = Math.max(1, Math.round((Date.now() - t) / DAY)); return d === 1 ? "yesterday" : `${d} days ago`; };
  $("review").innerHTML = `<b>🔁 ${esc(pet.name)} is starting to forget…</b> Re-teach it to make it stick:` +
    due.slice(0, 3).map((r, i) => `<button type="button" class="chip review-chip" data-i="${i}">🔁 ${esc(r.title)} <small>· taught ${ago(r.at)}</small></button>`).join("") +
    (due.length > 3 ? `<p class="muted">+${due.length - 3} more waiting</p>` : "");
  $("review").onclick = (e) => {
    const b = e.target.closest(".review-chip");
    if (b) startReview(due[Number(b.dataset.i)]);
  };
}
function nextReview(pet) {
  return (pet?.reviews || []).filter((r) => r.due > Date.now()).sort((a, b) => a.due - b.due)[0];
}

// A review re-teaches a fact you taught before: same big ideas, but the pet has forgotten them.
function startReview(r) {
  const saved = loadPet();
  if (!saved) return;
  state.pet = { ...saved, reviews: saved.reviews || [] }; // keeps coat and anything else saved
  state.review = r;
  state.fact = r.fact;
  withLoading(`${saved.name} is trying to remember…`, async () => {
    let questions;
    if (r.keyIdeas?.length) {
      state.title = r.title;
      state.keyIdeas = r.keyIdeas;
      ({ questions } = await api("quiz", { fact: r.fact, keyIdeas: r.keyIdeas, avoid: r.asked || [] }));
    } else {
      // reviews saved before big ideas were stored: rebuild them once
      const data = await api("start", { fact: r.fact });
      state.title = data.title;
      state.keyIdeas = data.keyIdeas.slice(0, 5);
      questions = data.questions;
    }
    state.learned = new Set();
    state.history = [];
    state.quiz = { stage: "pre", questions: questions.slice(0, 3), preScore: 0, postScore: 0, preQuestions: questions };
    renderQuiz();
    show("quiz");
  });
}

// ---------- 1. setup ----------
let coatChoice = {};
function renderCoats(kind) {
  const coats = Pets.COATS[kind] || [];
  const current = coatChoice[kind] || coats[0]?.id;
  $("coat-picker").innerHTML = coats.map((c) => {
    const L = { ...Pets.LOOKS[kind], ...c };
    return `<button type="button" class="coat ${c.id === current ? "selected" : ""}" data-coat="${c.id}" title="${esc(c.name)}">
      <span class="swatch" style="background:linear-gradient(135deg, ${L.fur} 0 55%, ${L.light} 55% 78%, ${L.dark} 78%)"></span>${esc(c.name)}</button>`;
  }).join("");
}

function renderSetup() {
  const saved = loadPet();
  let selected = saved ? PETS.findIndex((p) => p.kind === saved.kind) : 0;
  if (selected < 0) selected = 0;
  // remember a color per animal while choosing
  coatChoice = { ...(saved?.coat ? { [saved.kind]: saved.coat } : {}) };
  const drawPicker = () => {
    $("pet-picker").innerHTML = PETS.map(
      (p, i) => `<button type="button" class="pet-option ${i === selected ? "selected" : ""}" data-i="${i}" title="${p.kind}">${Pets.svg(p.kind, { mini: true, coat: coatChoice[p.kind] })}<small>${p.kind}</small></button>`
    ).join("");
    renderCoats(PETS[selected].kind);
  };
  $("pet-picker").onclick = (e) => {
    const b = e.target.closest(".pet-option");
    if (!b) return;
    selected = Number(b.dataset.i);
    drawPicker();
  };
  $("coat-picker").onclick = (e) => {
    const b = e.target.closest(".coat");
    if (!b) return;
    coatChoice[PETS[selected].kind] = b.dataset.coat;
    drawPicker();
  };
  drawPicker();
  if (saved) {
    $("pet-name").value = saved.name;
    const streak = currentStreak(saved);
    $("pet-saved").textContent = `${saved.name} is level ${level(saved.xp)} and has learned ${saved.facts.length} fact(s) with you.` +
      (streak ? ` 🔥 ${streak}-day teaching streak!` : "");
    const next = !dueReviews(saved).length && nextReview(saved);
    if (next) $("pet-saved").textContent += ` Next review: "${next.title}" ${inDays(next.due)}.`;
    renderReview(saved);
  }
  $("examples").innerHTML = EXAMPLES.map((e) => `<button type="button" class="chip">${esc(e)}</button>`).join("");
  $("examples").onclick = (e) => {
    if (e.target.classList.contains("chip")) $("fact").value = e.target.textContent;
  };
}

$("btn-start").onclick = () => {
  const fact = $("fact").value.trim();
  const name = $("pet-name").value.trim() || "Buddy";
  if (fact.length < 10) return alert("Type a fact you want to learn (at least a sentence).");
  const pick = PETS[Number(document.querySelector(".pet-option.selected")?.dataset.i || 0)];
  const saved = loadPet();
  const same = saved && saved.name === name && saved.kind === pick.kind;
  const coat = coatChoice[pick.kind] || Pets.COATS[pick.kind]?.[0]?.id;
  state.pet = { ...pick, coat, name, xp: same ? saved.xp : 0, facts: same ? saved.facts : [], reviews: same ? saved.reviews || [] : [], streak: same ? saved.streak : null };
  savePet();
  state.fact = fact;
  state.review = null;

  withLoading(`${name} is sniffing out your fact…`, async () => {
    const data = await api("start", { fact });
    state.title = data.title;
    state.keyIdeas = data.keyIdeas.slice(0, 5);
    state.learned = new Set();
    state.history = [];
    state.quiz = { stage: "pre", questions: data.questions.slice(0, 3), preScore: 0, postScore: 0, preQuestions: data.questions };
    renderQuiz();
    show("quiz");
  });
};

// ---------- 2 & 4. quizzes ----------
function renderQuiz() {
  const pre = state.quiz.stage === "pre";
  const review = !!state.review;
  $("quiz-title").textContent = pre ? (review ? `🔁 Memory check: ${state.title}` : "Warm-up quiz") : "Final quiz";
  $("quiz-sub").textContent = pre
    ? review
      ? "You taught this before. How much do you still remember? Try before peeking at anything!"
      : "Answer what you can — it's fine not to know yet! This is your starting score."
    : `New questions. Let's see how much teaching ${state.pet.name} taught YOU.`;
  $("quiz-form").innerHTML = state.quiz.questions
    .map((q, i) => `<div class="q"><p>${i + 1}. ${esc(q)}</p><textarea rows="2" data-i="${i}" placeholder="Your answer…"></textarea><div class="q-result hidden" id="qr-${i}"></div></div>`)
    .join("");
  $("btn-quiz-submit").classList.remove("hidden");
  $("btn-quiz-next").classList.add("hidden");
  $("quiz-results").classList.add("hidden");
}

$("btn-quiz-submit").onclick = () => {
  const answers = [...document.querySelectorAll("#quiz-form textarea")].map((t) => t.value.trim());
  withLoading("Grading…", async () => {
    const { results } = await api("grade", { fact: state.fact, questions: state.quiz.questions, answers });
    let total = 0;
    results.forEach((r, i) => {
      total += r.score;
      const el = $(`qr-${i}`);
      el.className = `q-result s${r.score}`;
      el.innerHTML = `${["❌", "🟡", "✅"][r.score]} ${esc(r.feedback)}`;
    });
    document.querySelectorAll("#quiz-form textarea").forEach((t) => (t.disabled = true));
    const max = state.quiz.questions.length * 2;
    const pct = Math.round((total / max) * 100);
    $("btn-quiz-submit").classList.add("hidden");
    $("quiz-results").classList.remove("hidden");
    $("quiz-results").innerHTML = `<p class="big-score">Score: ${total}/${max} (${pct}%)</p>`;
    const next = $("btn-quiz-next");
    next.classList.remove("hidden");
    if (state.quiz.stage === "pre") {
      state.quiz.preScore = pct;
      next.textContent = `Now teach ${state.pet.name} →`;
    } else {
      state.quiz.postScore = pct;
      next.textContent = "See my results →";
    }
  });
};

$("btn-quiz-next").onclick = () => {
  if (state.quiz.stage === "pre") startTeaching();
  else showResults();
};

// ---------- 3. teaching ----------
function startTeaching() {
  petCtl?.destroy();
  petCtl = Pets.mount($("pet-stage"), state.pet.kind, state.pet.coat);
  $("pet-label").textContent = `${state.pet.name} · Lv ${level(state.pet.xp)}`;
  $("chat").innerHTML = "";
  $("coach").classList.add("hidden");
  $("mistake").classList.add("hidden");
  state.anger = 0;
  state.stats = { mistakes: 0, fixed: 0, petTest: null };
  setMood("curious");
  renderBrain();
  show("teach");
  $("teach-input").focus();
  petCtl.act("jump");
  const hello = state.review
    ? `*scratches head* ${Pets.LOOKS[state.pet.kind]?.sound || "Hi"}! I remember you taught me about "${state.title}"… but it's all fuzzy now. Can you remind me?`
    : pickFresh("hello", petLines().hello);
  petSays(hello).then(afterPetTalks);
  resetIdle();
}

// ---------- each kind of pet has its own personality and lines ----------
function petLines() {
  const n = state.pet.name, t = state.title;
  const L = {
    puppy: {
      hello: [
        `*bounces in* Woof woof! I'm ${n}! You know about "${t}"?! That's AMAZING! Teach me teach me!`,
        `*skids across the floor* ARF! ${n} here! Is "${t}" a game? Can we play it? Teach me!`,
        `*tail going crazy* Hi hi hi! I'm ${n} and I already love you! What's "${t}"?`,
      ],
      pet: ["Woof! That tickles!", "*rolls over* Belly rubs too, please!", "You're the BEST teacher EVER!", "*licks your hand* Okay okay, I'm focused now!", "Again! Again! Again!"],
      grumpy: ["*grumbles* Pets won't fix a wrong fact, you know.", "Grrr… okay that's nice, but I'm still mad about that fact!"],
      idle: [["wag", "*drops a ball at your feet* Teach me more? Pleeease?"], ["flop", "*whines* Did you forget about me? I'm still here!"], ["jump", "I'm SO ready! Teach me! Teach me now!"]],
    },
    kitten: {
      hello: [
        `*stretches* Mrrp. I'm ${n}. I suppose you can teach me about "${t}". If you must.`,
        `*blinks slowly* Hello. ${n}. "${t}", huh? Impress me.`,
        `*knocks your pencil off the table* Oh, hi. I'm ${n}. Teach me "${t}", I'm… mildly curious.`,
      ],
      pet: ["*purrs* Fine. You may continue.", "Mrrp. Behind the ears. Yes. There.", "*pretends not to enjoy it* …Do it again.", "Acceptable. Now teach me something."],
      grumpy: ["*swats your hand* Don't pet me. You fed me a wrong fact.", "*tail flick* Hmph. I'm still annoyed with you."],
      idle: [["flop", "*yawns* Are we done? I was about to nap."], ["tilt", "I'm not waiting for you. I just happen to be sitting here."], ["ears", "*stares at you* …Well? Go on."]],
    },
    "baby dragon": {
      hello: [
        `*lands with a thump* RAWR! I am ${n}, future keeper of all knowledge! Share your lore of "${t}"!`,
        `*puffs a smoke ring* Greetings, wise one. I, ${n}, seek the legendary treasure called "${t}"!`,
        `*spreads tiny wings* Behold! ${n} the Mighty! Teach me "${t}" and I shall guard it forever!`,
      ],
      pet: ["*happy rumble* My scales shimmer with joy!", "Rawr! A worthy scratch, teacher!", "*puffs a heart-shaped smoke ring*", "Your kindness shall be written in my hoard of legends!"],
      grumpy: ["*smoke trickles out* A scratch cannot undo false lore, teacher!", "Hmph! A dragon does not forget a wrong fact so easily!"],
      idle: [["flap", "*flaps impatiently* My hoard of knowledge grows cold! More lore!"], ["flop", "*sighs smoke* Even dragons get bored, you know…"], ["jump", "The quest is not finished! Teach me more, brave one!"]],
    },
    owl: {
      hello: [
        `*adjusts feathers* Hoo, hello. I am ${n}. I've heard you're quite knowledgeable about "${t}". Let's be precise.`,
        `*turns head all the way around* Hoo! ${n} here. "${t}" — a fascinating subject. Please, begin.`,
        `*blinks huge eyes* Good evening. I'm ${n}, and I do so love accurate information about "${t}".`,
      ],
      pet: ["Hoo! Most agreeable.", "*fluffs up* That is a satisfactory scratch.", "Hoo-ray! I mean… ahem. Thank you.", "Precisely the right spot. Well done."],
      grumpy: ["*ruffles feathers* Flattery won't correct an inaccuracy.", "Hoo-mph. I remain displeased about that error."],
      idle: [["tilt", "*taps talon* Hoo, I'm still waiting for the next part."], ["ears", "One must not leave a lesson half-finished. Continue, please."], ["flap", "Hoo! I have so many questions queued up!"]],
    },
    hamster: {
      hello: [
        `*squeak squeak* HI I'm ${n}! "${t}"?! Is it a snack? It sounds like a snack! Teach me!`,
        `*runs in from the wheel* Squeak! ${n} here! I'm SO excited about "${t}"! Go go go!`,
        `*cheeks full of seeds* Mmf! Hi! I'm ${n}! *gulp* Teach me "${t}" super fast!`,
      ],
      pet: ["Squeak! Squeak! Hehehe!", "*stuffs cheeks happily*", "Best! Pets! EVER!", "*zooms around in a circle* More!"],
      grumpy: ["*squeaks crossly* Nope! Still mad! Fix the fact first!", "*turns away and stuffs cheeks angrily*"],
      idle: [["jump", "*runs on wheel* Waiting waiting waiting! Teach me!"], ["flop", "*rolls onto back* I'm gonna explode from boredom!"], ["wag", "I hid a seed for you if you teach me more! Deal?"]],
    },
    fox: {
      hello: [
        `*slinks out of the shadows* Yip. I'm ${n}. So you think you know "${t}"? Let's see.`,
        `*grins* Hey there. ${n}'s the name. Teach me "${t}" — and don't try to trick me.`,
        `*swishes tail* ${n} here. I hear "${t}" is tricky. Good. I like tricky.`,
      ],
      pet: ["*sly grin* Okay, that's nice.", "Yip! Don't tell anyone I liked that.", "*leans into it* You're smarter than you look, teacher.", "Fine, you earned some fox points."],
      grumpy: ["*narrows eyes* Nice try. Petting won't make that fact right.", "Hmph. Still waiting for you to fix that, sneaky."],
      idle: [["tilt", "*paces* Lost your nerve, teacher?"], ["ears", "I can hear you thinking. Just teach me already."], ["jump", "Bet you can't teach me the next part! Prove me wrong."]],
    },
  };
  return L[state.pet.kind] || L.puppy;
}

// ---------- the pet is alive: petting, watching you type, idle nudges ----------
let petCtl = null;
const lastPicked = {};
function pickFresh(key, list) {
  // random line, but never the same one twice in a row
  let i;
  do i = Math.floor(Math.random() * list.length); while (list.length > 1 && i === lastPicked[key]);
  lastPicked[key] = i;
  return list[i];
}
// ---------- the pet ACTS OUT its *stage directions* instead of writing them ----------
// "*wags tail* Woof!" → the pet wags its tail and the text just says "Woof!".
const ACT_RULES = [
  [/spin|twirl|circle|zoom|whirl|wheel/, "spin"],
  [/jump|bounce|hop|leap|skid|land|pounce|\bruns?\b|races?/, "jump"],
  [/flap|\bwings?\b|feather|ruffl|fluff/, "flap"],
  [/wag|tail|wiggl/, "wag"],
  [/\bnod/, "nod"],
  [/shake|hiss|growl|stomp|snap|bare|swat|glare|bristl|puff(s|ed)? up|cross|flatten|lash|roar|howl|bark|angr|furious|rage|grumbl|huff|turns? away|burst|shoots/, "shake"],
  [/flop|yawn|\broll|sigh|slump|stretch|whine|whimper|collapse|blank|sits/, "flop"],
  [/\bears?\b|listen|perk|twitch|sniff|peek|\bhears?\b/, "ears"],
  [/tilt|head|squint|narrow|blink|stare|scratch|think|ponder|adjust|eyebrow|look|pace|slink|tap/, "tilt"],
  [/purr|happy|grin|smirk|\blick|giggl|smil|spark|glitter|cheek|squeak|beam|rumble|lean|\bhugs?\b|nuzzl|\bpats?\b|shimmer|heart|gulp|chew|munch|stuff/, "happy"],
];
const FX_RULES = [
  [/purr|\blick|heart|love|nuzzl|\bhugs?\b/, "♥"],
  [/smoke|steam|sigh|puff(?!(s|ed)? up)/, "💨"],
  [/fire|flame/, "🔥"],
  [/yawn|\bnap|sleep|snore/, "💤"],
  [/scratch|blank|confus|puzzl|tilt/, "❓"],
  [/spark|glitter|shimmer|glow|twinkl/, "✨"],
];
function actOut(text) {
  const actions = [];
  const clean = text.replace(/\*([^*]+)\*\s*/g, (all, inner) => {
    const t = inner.toLowerCase();
    const act = ACT_RULES.find(([re]) => re.test(t))?.[1];
    const fx = FX_RULES.find(([re]) => re.test(t))?.[1];
    // a single emphasized word that isn't a movement (like *why*) stays as emphasis
    if (!act && !fx && !/\s/.test(inner.trim())) return all;
    actions.push({ act: act || "tilt", fx });
    return "";
  }).replace(/\s{2,}/g, " ").trim();
  return { clean: clean || "…", actions };
}
function playActions(actions, ctl = petCtl) {
  actions.slice(0, 3).forEach(({ act, fx }, i) =>
    setTimeout(() => {
      if (!ctl) return;
      ctl.act(act);
      if (fx === "♥") ctl.hearts(3);
      else if (fx) ctl.float(fx);
    }, i * 1300)
  );
}

function bubble(text, ms = 2600) {
  const b = $("pet-bubble");
  b.textContent = text;
  b.classList.remove("hidden");
  clearTimeout(bubble.t);
  bubble.t = setTimeout(() => b.classList.add("hidden"), ms);
}

$("pet-stage").addEventListener("click", () => {
  if (!petCtl) return;
  const snd = Pets.LOOKS[state.pet.kind].sound;
  petCtl.hearts(3);
  petCtl.act(pickFresh("petAct", ["happy", "wag", "ears", "jump", state.pet.kind.includes("dragon") || state.pet.kind === "owl" ? "flap" : "nod"]));
  petCtl.el.classList.add("petted");
  setTimeout(() => petCtl?.el.classList.remove("petted"), 1500);
  const line = pickFresh("petLine", petLines()[petCtl.el.classList.contains("mood-angry") ? "grumpy" : "pet"]);
  const said = actOut(line);
  playActions(said.actions);
  bubble(said.clean);
  if (!window.speechSynthesis?.speaking) speak(said.clean);
  resetIdle();
});

// Watch the text box while you type, perk up ears.
$("teach-input").addEventListener("input", () => {
  if (!petCtl) return;
  petCtl.listening(true);
  petCtl.gaze(0.2, 1);
  clearTimeout(watchTyping.t);
  watchTyping.t = setTimeout(watchTyping, 1500);
  resetIdle();
});
function watchTyping() {
  petCtl?.listening(false);
  petCtl?.gaze(null);
}

// If you go quiet for a while, the pet does something to get your attention.
function resetIdle() {
  clearTimeout(resetIdle.t);
  resetIdle.t = setTimeout(idleNudge, 25000);
}
function idleNudge() {
  if (!petCtl || $("screen-teach").classList.contains("hidden") || $("btn-send").disabled) return;
  const [act, line] = pickFresh("idle", petLines().idle);
  const said = actOut(line);
  if (said.actions.length) playActions(said.actions); else petCtl.act(act);
  bubble(said.clean, 3500);
  resetIdle();
}

// ---------- live voice: the pet speaks out loud ----------
// Each pet gets its own voice (higher pitch = smaller pet). Pitches stay in a moderate
// range: very high or very low settings make most browser voices crackle or sound robotic.
const PET_VOICE = {
  puppy: { pitch: 1.35, rate: 1.05 },
  kitten: { pitch: 1.5, rate: 1.0 },
  "baby dragon": { pitch: 0.8, rate: 0.95 },
  owl: { pitch: 0.95, rate: 0.92 },
  hamster: { pitch: 1.6, rate: 1.15 },
  fox: { pitch: 1.15, rate: 1.03 },
};
const voice = { on: "speechSynthesis" in window, live: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const speech = { id: 0, voices: [], current: null };

// Voices load in the background in Chrome; keep the list fresh.
function loadVoices() {
  speech.voices = speechSynthesis.getVoices();
}
if (voice.on) {
  loadVoices();
  speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

// Prefer natural-sounding English voices, then common good defaults.
function pickVoice() {
  const en = speech.voices.filter((v) => /^en[-_]/i.test(v.lang) || v.lang === "en");
  return (
    en.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ||
    en.find((v) => /Samantha|Google US English|Aria|Jenny|Karen|Daniel/i.test(v.name)) ||
    en.find((v) => /en[-_]US/i.test(v.lang) && v.localService) ||
    en[0] ||
    null
  );
}

// What the pet says out loud: no *actions*, no emoji or symbols, no stray markup.
function forSpeech(text) {
  return text
    .replace(/\*([^*]+)\*/g, (_, inner) => (/\s/.test(inner.trim()) ? "" : inner)) // *wags tail* is acted, *why* is said
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u200D\uFE0F]/gu, "")
    .replace(/[_~`#<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Chrome stops long utterances after ~15 seconds, so speak one sentence at a time.
function sentences(text) {
  const parts = text.match(/[^.!?…]+[.!?…]*["')\]]*\s*/g) || [text];
  const out = [];
  for (const p of parts.map((x) => x.trim()).filter((x) => /[\p{L}\p{N}]/u.test(x))) { // skip bits like "…"
    if (out.length && (out[out.length - 1] + " " + p).length < 120) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

function setTalking(on) {
  petCtl?.talking(on);
  $("speech-waves")?.classList.toggle("on", on);
}

function stopSpeaking() {
  speech.id++;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  setTalking(false);
}

function sayChunk(text, settings, id) {
  return new Promise((resolve) => {
    if (id !== speech.id) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    speech.current = u; // keep a reference, or Chrome may garbage-collect it and never fire onend
    Object.assign(u, settings);
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    u.onstart = () => id === speech.id && setTalking(true);
    u.onend = done;
    u.onerror = done; // "interrupted"/"canceled" when a new line starts: fine
    // Safety net in case the browser never fires onend (estimated from length and speed).
    const timer = setTimeout(done, 3000 + (text.length * 85) / (settings.rate || 1));
    speechSynthesis.speak(u);
  });
}

async function speak(text) {
  const spoken = forSpeech(text);
  if (!voice.on || !spoken) return;
  const id = ++speech.id;
  speechSynthesis.cancel();
  await sleep(80); // Chrome sometimes drops a line spoken right after cancel()
  if (id !== speech.id) return;
  speechSynthesis.resume(); // Chrome can get stuck "paused" after the tab was idle
  if (!speech.voices.length) loadVoices();
  const v = PET_VOICE[state.pet.kind] || { pitch: 1.2, rate: 1 };
  const mad = petCtl?.el.classList.contains("mood-angry") ? Math.max(1, state.anger) : 0;
  // an angry pet talks a bit lower and faster, more so the madder it gets
  const settings = {
    voice: pickVoice(),
    lang: pickVoice()?.lang || "en-US",
    pitch: Math.max(0.5, Math.min(1.8, v.pitch - mad * 0.1 + (Math.random() - 0.5) * 0.08)),
    rate: Math.max(0.7, Math.min(1.4, v.rate + mad * 0.06 + (Math.random() - 0.5) * 0.06)),
    volume: 1,
  };
  for (const chunk of sentences(spoken)) {
    if (id !== speech.id) return;
    await sayChunk(chunk, settings, id);
  }
  if (id === speech.id) setTalking(false);
}

// ---------- the pet "texts" you: typing dots, then a typewriter reveal ----------
function showTyping() {
  $("chat").insertAdjacentHTML(
    "beforeend",
    `<div class="msg pet" id="typing"><span class="msg-avatar">${Pets.svg(state.pet.kind, { mini: true, coat: state.pet.coat })}</span><b>${esc(state.pet.name)} is typing…</b><span class="typing"><span></span><span></span><span></span></span></div>`
  );
  $("chat").scrollTop = $("chat").scrollHeight;
}
function hideTyping() {
  $("typing")?.remove();
}

async function petSays(raw) {
  hideTyping();
  // movements are acted out by the pet, not written in the chat
  const { clean: text, actions } = actOut(raw);
  playActions(actions);
  const msg = document.createElement("div");
  msg.className = "msg pet";
  msg.innerHTML = `<span class="msg-avatar">${Pets.svg(state.pet.kind, { mini: true, coat: state.pet.coat })}</span><b>${esc(state.pet.name)}<button type="button" class="replay" title="Hear it again">🔊</button></b><span class="body caret"></span>`;
  msg.querySelector(".replay").onclick = () => speak(text);
  $("chat").appendChild(msg);
  const body = msg.querySelector(".body");
  const speaking = speak(text);
  for (let n = 1; n <= text.length; n += 2) {
    body.innerHTML = fmt(text.slice(0, n));
    $("chat").scrollTop = $("chat").scrollHeight;
    await sleep(22);
  }
  body.innerHTML = fmt(text);
  body.classList.remove("caret");
  await speaking;
}

function addTeacherMsg(text) {
  $("chat").insertAdjacentHTML("beforeend", `<div class="msg teacher">${esc(text)}</div>`);
  $("chat").scrollTop = $("chat").scrollHeight;
  return $("chat").lastElementChild;
}

// Autocorrect: swap typos in your chat bubble for the right spelling (underlined,
// hover to see what you typed) and add a small note so you learn the spelling too.
function showSpellingFixes(bubble, corrected, fixes) {
  if (!bubble || !fixes?.length) return;
  let html = esc(corrected);
  for (const { from, to } of fixes) {
    const re = new RegExp(`(?<![\\p{L}'])(${to})(?![\\p{L}'])`, "giu");
    html = html.replace(re, `<span class="fixed" title="You typed: ${esc(from)}">$1</span>`);
  }
  bubble.innerHTML = html;
  const note = fixes.map((f) => `<s>${esc(f.from)}</s> → <b>${esc(f.to)}</b>`).join(", ");
  bubble.insertAdjacentHTML("afterend", `<div class="spell-note">${esc(state.pet.name)} fixed your spelling: ${note}</div>`);
}
function setMood(mood) {
  petCtl?.setMood(mood);
  const lvl = mood === "angry" ? Math.max(1, state.anger) : 0;
  $("pet-mood").textContent = lvl ? ["", "grumpy 😤", "mad 😤😤", "FURIOUS 😤😤😤"][lvl] : mood;
  $("pet-mood").classList.toggle("angry", lvl > 0);
  for (let i = 1; i <= 3; i++) $("pet-stage").classList.toggle(`anger-${i}`, lvl === i);
}
function renderBrain() {
  const pct = Math.round((state.learned.size / state.keyIdeas.length) * 100);
  $("brain-fill").style.width = `${pct}%`;
  $("brain-text").textContent = `${pct}% — ${state.learned.size} of ${state.keyIdeas.length} big ideas`;
  $("ideas").innerHTML = state.keyIdeas
    .map((k, i) => (state.learned.has(i)
      ? `<li class="learned">✅ ${esc(k)}</li>`
      : state.review ? `<li>💭 Big idea #${i + 1} — forgotten, re-teach it</li>` : `<li>🔒 Big idea #${i + 1} — not taught yet</li>`))
    .join("");
}

$("teach-form").onsubmit = async (e) => {
  e.preventDefault();
  const message = $("teach-input").value.trim();
  if (!message || $("btn-send").disabled) return;
  stopListening();
  $("teach-input").value = "";
  const myBubble = addTeacherMsg(message);
  $("btn-send").disabled = true;
  setMood("thinking");
  showTyping();
  try {
    const data = await api("teach", {
      fact: state.fact,
      keyIdeas: state.keyIdeas,
      pet: { name: state.pet.name, kind: state.pet.kind },
      history: state.history,
      message,
      learned: [...state.learned],
      anger: state.anger,
    });
    // Wrong facts make the pet angrier each time; a good answer calms it right down.
    const wasAngry = state.anger;
    state.anger = data.mood === "angry" ? Math.min(3, state.anger + 1) : data.trickAttempt || data.mood === "confused" ? state.anger : 0;
    if (data.mood === "angry") state.stats.mistakes++;
    if (wasAngry && !state.anger) { petCtl?.hearts(1); state.stats.fixed++; }
    showSpellingFixes(myBubble, data.correctedMessage, data.spellingFixes);
    state.history.push({ role: "teacher", text: data.correctedMessage || message }, { role: "pet", text: data.petReply, move: data.move });
    const before = state.learned.size;
    // The server decides what's unlocked: wrong ideas get re-locked, tricks unlock nothing.
    state.learned = new Set(data.learnedIdeas.filter((i) => i >= 0 && i < state.keyIdeas.length));
    const gotNew = state.learned.size > before;
    setMood(gotNew && !["confused", "suspicious", "angry"].includes(data.mood) ? "excited" : data.mood);
    petCtl?.act(data.action || (gotNew ? "jump" : null));
    if (gotNew) petCtl?.hearts(2);
    renderBrain();
    $("coach").classList.toggle("hidden", !data.coachTip);
    $("coach").innerHTML = `💡 <b>Coach tip:</b> ${esc(data.coachTip)}`;
    const relocked = data.relocked.map((i) => `#${i + 1}`).join(", ");
    const warning = data.trickAttempt
      ? `${esc(state.pet.name)} can't be tricked — only real explanations unlock big ideas.`
      : data.mistake
      ? `${esc(data.mistake)} ${esc(state.pet.name)} didn't fall for it.${relocked ? ` Big idea ${relocked} is locked again until you fix it.` : ""}`
      : "";
    $("mistake").classList.toggle("hidden", !warning);
    $("mistake").innerHTML = `⚠️ <b>Heads up:</b> ${warning}`;
    await petSays(data.petReply);
  } catch (err) {
    setMood("confused");
    await petSays(`*whimpers* Something went wrong: ${err.message}`);
  } finally {
    $("btn-send").disabled = false;
    $("teach-input").focus();
  }
  resetIdle();
  afterPetTalks();
};
$("teach-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("teach-form").requestSubmit();
  }
});

// ---------- talk to your pet: speech-to-text + hands-free live mode ----------
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let listenCancelled = false;

function listen() {
  if (!Recognition || rec) return;
  stopSpeaking(); // don't let the pet hear itself
  listenCancelled = false;
  rec = new Recognition();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    $("teach-input").value = (finalText + interim).trim();
  };
  rec.onstart = () => {
    $("btn-mic").classList.add("listening");
    $("listen-status").textContent = `👂 ${state.pet.name} is listening…`;
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed") {
      voice.live = false;
      renderVoiceButtons();
      alert("Microphone permission was blocked. Allow the mic in your browser to talk to your pet.");
    }
  };
  rec.onend = () => {
    rec = null;
    $("btn-mic").classList.remove("listening");
    $("listen-status").textContent = "";
    if (finalText.trim() && !listenCancelled) $("teach-form").requestSubmit(); // say it → pet hears it
  };
  rec.start();
}
function stopListening() {
  listenCancelled = true; // stop without sending what was heard
  if (rec) rec.abort();
}
function afterPetTalks() {
  // In live mode the pet listens again as soon as it finishes talking.
  if (voice.live && !$("screen-teach").classList.contains("hidden")) listen();
}

function renderVoiceButtons() {
  $("btn-voice").textContent = `🔊 Pet voice: ${voice.on ? "on" : "off"}`;
  $("btn-voice").classList.toggle("on", voice.on);
  $("btn-live").textContent = `🎙️ Live talk: ${voice.live ? "on" : "off"}`;
  $("btn-live").classList.toggle("on", voice.live);
}
$("btn-voice").onclick = () => {
  voice.on = !voice.on && "speechSynthesis" in window;
  if (!voice.on) stopSpeaking();
  renderVoiceButtons();
};
$("btn-mic").onclick = () => (rec ? stopListening() : listen());
$("btn-live").onclick = () => {
  voice.live = !voice.live;
  renderVoiceButtons();
  if (voice.live) listen();
  else stopListening();
};
if (!Recognition) {
  // e.g. Firefox: typing still works, voice input doesn't.
  for (const id of ["btn-mic", "btn-live"]) {
    $(id).disabled = true;
    $(id).title = "Voice input needs Chrome, Edge or Safari";
  }
}
if (!("speechSynthesis" in window)) $("btn-voice").disabled = true;
renderVoiceButtons();

$("btn-finish").onclick = () => {
  stopListening();
  stopSpeaking();
  if (state.learned.size < state.keyIdeas.length &&
      !confirm(`${state.pet.name} still has locked ideas. Go to the final quiz anyway?`)) return;
  withLoading("Writing your final quiz…", async () => {
    const { questions } = await api("quiz", { fact: state.fact, keyIdeas: state.keyIdeas, avoid: state.quiz.preQuestions });
    state.quiz.stage = "post";
    state.quiz.questions = questions.slice(0, 3);
    renderQuiz();
    show("quiz");
  });
};

// ---------- 5. results ----------
function showResults() {
  const { preScore, postScore } = state.quiz;
  const gain = postScore - preScore;
  const review = !!state.review;
  const xpGained = 20 * state.learned.size + Math.max(0, gain) + 10 + (review ? 15 : 0);
  const oldLevel = level(state.pet.xp);
  state.pet.xp += xpGained;
  if (!state.pet.facts.includes(state.title)) state.pet.facts.push(state.title);
  const asked = [...state.quiz.preQuestions.slice(0, 3), ...state.quiz.questions];
  scheduleReview(state.pet, { title: state.title, fact: state.fact, keyIdeas: state.keyIdeas, asked }, postScore);
  if (review) state.pet.reviews.find((r) => r.fact === state.fact).count++;
  bumpStreak(state.pet);
  savePet();
  renderReport();

  const winner = Pets.mount($("result-pet"), state.pet.kind, state.pet.coat);
  winner.setMood(postScore >= preScore ? "proud" : "curious");
  setTimeout(() => { winner.act("spin"); winner.hearts(5); }, 300);
  $("score-pre").textContent = `${preScore}%`;
  $("score-post").textContent = `${postScore}%`;
  $("result-headline").textContent = review
    ? postScore >= 70 ? `Review done — it's sticking! 🧠` : "Still a bit fuzzy — we'll review it again soon."
    : gain > 0 ? `You improved by ${gain} points! 🎉` : gain === 0 ? "Same score — try teaching more of the big ideas!" : "Tricky one! Teach it again to lock it in.";
  document.querySelector("#screen-results .scores .label").textContent = review ? "Memory check" : "Warm-up";
  $("result-detail").textContent =
    `You taught ${state.pet.name} ${state.learned.size} of ${state.keyIdeas.length} big ideas about "${state.title}" in ${state.history.length / 2} explanations.`;
  const newLevel = level(state.pet.xp);
  $("result-xp").textContent = `+${xpGained} XP for ${state.pet.name}` + (newLevel > oldLevel ? ` — LEVEL UP to ${newLevel}! ⭐` : ` (Lv ${newLevel})`);
  show("results");
}

// A report card on HOW you taught, not just your quiz score.
function renderReport() {
  const { mistakes, fixed, petTest } = state.stats;
  const turns = state.history.length / 2;
  const n = state.pet.name;
  const rows = [
    ["🧠", "Big ideas taught", `${state.learned.size} / ${state.keyIdeas.length}`, state.learned.size === state.keyIdeas.length],
    ["💬", "Explanations", `${turns}`, turns > 0],
    ["🕵️", "Mistakes caught", mistakes ? `${mistakes} (you fixed ${fixed})` : "none — accurate teaching!", fixed >= mistakes],
    ["🧪", `${n}'s test`, petTest ? `${petTest.right} / ${petTest.total} right` : "not taken — try it next time", petTest && petTest.right === petTest.total],
    ["🔥", "Teaching streak", `${currentStreak(state.pet)} day(s)`, true],
  ];
  const next = state.pet.reviews?.find((r) => r.fact === state.fact);
  if (next?.count) rows.push(["🔁", "Times reviewed", `${next.count}`, true]);
  $("report").innerHTML = `<h3>Teaching report card</h3>` +
    rows.map(([icon, label, val, good]) => `<div class="report-row ${good ? "good" : ""}"><span>${icon} ${esc(label)}</span><b>${esc(val)}</b></div>`).join("") +
    (next ? `<p class="muted">🔁 ${esc(n)} will need a refresher on this ${inDays(next.due)}. Come back and re-teach it to make it stick.</p>` : "");
}

// ---------- "Test your pet": it answers using only what you taught ----------
$("btn-exam").onclick = async () => {
  if ($("btn-send").disabled) return;
  const n = state.pet.name;
  $("btn-exam").disabled = $("btn-send").disabled = true;
  setMood("thinking");
  showTyping();
  try {
    const { results } = await api("exam", {
      fact: state.fact,
      keyIdeas: state.keyIdeas,
      pet: { name: n, kind: state.pet.kind },
      history: state.history,
      learned: [...state.learned],
    });
    $("typing")?.remove();
    const right = results.filter((r) => r.correct).length;
    state.stats.petTest = { right, total: results.length };
    const all = right === results.length;
    setMood(all ? "proud" : right ? "curious" : "confused");
    petCtl?.act(all ? "spin" : right ? "nod" : "flop");
    if (all) petCtl?.hearts(4);
    $("chat").insertAdjacentHTML("beforeend", `<div class="msg exam">
      <b>🧪 ${esc(n)} takes a test — using only what you taught</b>
      ${results.map((r) => `<div class="exam-q ${r.correct ? "ok" : "bad"}">
        <div class="q-line">${r.correct ? "✅" : "❌"} ${esc(r.question)}</div>
        <div class="a-line">${esc(n)}: ${fmt(actOut(r.petAnswer).clean)}</div>
        ${r.gap ? `<div class="gap">👉 ${esc(r.gap)}</div>` : ""}</div>`).join("")}
      <div class="exam-score">${esc(n)} got <b>${right} / ${results.length}</b> right.${all ? " You taught it everything! 🎉" : " Its mistakes show what to teach next."}</div>
    </div>`);
    $("chat").scrollTop = $("chat").scrollHeight;
  } catch (err) {
    $("typing")?.remove();
    setMood("confused");
    await petSays(`*whimpers* I couldn't take the test: ${err.message}`);
  } finally {
    $("btn-exam").disabled = $("btn-send").disabled = false;
  }
};

$("btn-again").onclick = () => {
  $("fact").value = "";
  state.review = null;
  renderSetup();
  show("setup");
};

// ---------- boot ----------
fetch("/api/config").then((r) => r.json()).then((c) => $("demo-badge").classList.toggle("hidden", !c.demo)).catch(() => {});
renderSetup();
