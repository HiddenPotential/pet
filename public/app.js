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
function scheduleReview(pet, title, fact, score) {
  pet.reviews ||= [];
  let r = pet.reviews.find((x) => x.fact === fact);
  if (!r) pet.reviews.push((r = { title, fact, step: -1 }));
  // a strong final score moves the next review further away; a weak one brings it back soon
  r.step = score >= 70 ? Math.min(r.step + 1, REVIEW_AFTER.length - 1) : 0;
  r.at = Date.now();
  r.due = Date.now() + REVIEW_AFTER[r.step] * DAY;
}
function renderReview(pet) {
  const due = dueReviews(pet);
  $("review").classList.toggle("hidden", !due.length);
  if (!due.length) return;
  const ago = (t) => { const d = Math.max(1, Math.round((Date.now() - t) / DAY)); return d === 1 ? "yesterday" : `${d} days ago`; };
  $("review").innerHTML = `<b>🔁 ${esc(pet.name)} is starting to forget…</b> Re-teach it to make it stick:` +
    due.slice(0, 3).map((r, i) => `<button type="button" class="chip review-chip" data-i="${i}">${esc(r.title)} <small>· taught ${ago(r.at)}</small></button>`).join("");
  $("review").onclick = (e) => {
    const b = e.target.closest(".review-chip");
    if (b) $("fact").value = due[Number(b.dataset.i)].fact;
  };
}

// ---------- 1. setup ----------
function renderSetup() {
  const saved = loadPet();
  let selected = saved ? PETS.findIndex((p) => p.kind === saved.kind) : 0;
  if (selected < 0) selected = 0;
  $("pet-picker").innerHTML = PETS.map(
    (p, i) => `<button type="button" class="pet-option ${i === selected ? "selected" : ""}" data-i="${i}" title="${p.kind}">${Pets.svg(p.kind, { mini: true })}<small>${p.kind}</small></button>`
  ).join("");
  $("pet-picker").onclick = (e) => {
    const b = e.target.closest(".pet-option");
    if (!b) return;
    document.querySelectorAll(".pet-option").forEach((x) => x.classList.remove("selected"));
    b.classList.add("selected");
  };
  if (saved) {
    $("pet-name").value = saved.name;
    const streak = currentStreak(saved);
    $("pet-saved").textContent = `${saved.name} is level ${level(saved.xp)} and has learned ${saved.facts.length} fact(s) with you.` +
      (streak ? ` 🔥 ${streak}-day teaching streak!` : "");
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
  state.pet = { ...pick, name, xp: same ? saved.xp : 0, facts: same ? saved.facts : [], reviews: same ? saved.reviews || [] : [], streak: same ? saved.streak : null };
  savePet();
  state.fact = fact;

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
  $("quiz-title").textContent = pre ? "Warm-up quiz" : "Final quiz";
  $("quiz-sub").textContent = pre
    ? "Answer what you can — it's fine not to know yet! This is your starting score."
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
  petCtl = Pets.mount($("pet-stage"), state.pet.kind);
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
  petSays(pickFresh("hello", petLines().hello)).then(afterPetTalks);
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
  bubble(line.replace(/\*/g, ""));
  if (!speechSynthesis?.speaking) speak(line);
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
  petCtl.act(act);
  bubble(line.replace(/\*[^*]*\*\s*/g, ""), 3500);
  resetIdle();
}

// ---------- live voice: the pet speaks out loud ----------
// Each pet gets its own voice (higher pitch = smaller pet).
const PET_VOICE = {
  puppy: { pitch: 1.6, rate: 1.1 },
  kitten: { pitch: 1.9, rate: 1.05 },
  "baby dragon": { pitch: 0.7, rate: 0.95 },
  owl: { pitch: 1.0, rate: 0.9 },
  hamster: { pitch: 2.0, rate: 1.3 },
  fox: { pitch: 1.3, rate: 1.05 },
};
const voice = { on: "speechSynthesis" in window, live: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  return voices.find((v) => /Samantha|Google US English|Aria|Jenny/i.test(v.name)) || voices[0] || null;
}
if (voice.on) speechSynthesis.onvoiceschanged = () => {}; // makes some browsers load voices early

function speak(text) {
  const spoken = text
    // *wags tail* is acted out, not said; a *single* emphasized word is still said
    .replace(/\*([^*]+)\*/g, (_, inner) => (/\s/.test(inner.trim()) ? "" : inner))
    .replace(/\s+/g, " ")
    .trim();
  if (!voice.on || !spoken) return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(spoken);
    const v = PET_VOICE[state.pet.kind] || { pitch: 1.4, rate: 1 };
    const mad = petCtl?.el.classList.contains("mood-angry") ? Math.max(1, state.anger) : 0;
    // an angry pet talks lower and faster, more so the madder it gets
    u.pitch = Math.max(0.1, Math.min(2, v.pitch - mad * 0.15 + (Math.random() - 0.5) * 0.2)); // a little different every time
    u.rate = v.rate + mad * 0.08 + (Math.random() - 0.5) * 0.1;
    u.voice = pickVoice();
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      petCtl?.talking(false);
      $("speech-waves").classList.remove("on");
      resolve();
    };
    u.onstart = () => {
      petCtl?.talking(true);
      $("speech-waves").classList.add("on");
    };
    u.onend = done;
    u.onerror = done;
    setTimeout(done, 2000 + spoken.length * 90); // safety net if the browser never fires onend
    speechSynthesis.speak(u);
  });
}

// ---------- the pet "texts" you: typing dots, then a typewriter reveal ----------
function showTyping() {
  $("chat").insertAdjacentHTML(
    "beforeend",
    `<div class="msg pet" id="typing"><span class="msg-avatar">${Pets.svg(state.pet.kind, { mini: true })}</span><b>${esc(state.pet.name)} is typing…</b><span class="typing"><span></span><span></span><span></span></span></div>`
  );
  $("chat").scrollTop = $("chat").scrollHeight;
}
function hideTyping() {
  $("typing")?.remove();
}

async function petSays(text) {
  hideTyping();
  const msg = document.createElement("div");
  msg.className = "msg pet";
  msg.innerHTML = `<span class="msg-avatar">${Pets.svg(state.pet.kind, { mini: true })}</span><b>${esc(state.pet.name)}<button type="button" class="replay" title="Hear it again">🔊</button></b><span class="body caret"></span>`;
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
    .map((k, i) => (state.learned.has(i) ? `<li class="learned">✅ ${esc(k)}</li>` : `<li>🔒 Big idea #${i + 1} — not taught yet</li>`))
    .join("");
}

$("teach-form").onsubmit = async (e) => {
  e.preventDefault();
  const message = $("teach-input").value.trim();
  if (!message || $("btn-send").disabled) return;
  stopListening();
  $("teach-input").value = "";
  addTeacherMsg(message);
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
    state.history.push({ role: "teacher", text: message }, { role: "pet", text: data.petReply, move: data.move });
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
  speechSynthesis?.cancel(); // don't let the pet hear itself
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
  if (!voice.on) speechSynthesis?.cancel();
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
  speechSynthesis?.cancel();
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
  const xpGained = 20 * state.learned.size + Math.max(0, gain) + 10;
  const oldLevel = level(state.pet.xp);
  state.pet.xp += xpGained;
  if (!state.pet.facts.includes(state.title)) state.pet.facts.push(state.title);
  scheduleReview(state.pet, state.title, state.fact, postScore);
  bumpStreak(state.pet);
  savePet();
  renderReport();

  const winner = Pets.mount($("result-pet"), state.pet.kind);
  winner.setMood(postScore >= preScore ? "proud" : "curious");
  setTimeout(() => { winner.act("spin"); winner.hearts(5); }, 300);
  $("score-pre").textContent = `${preScore}%`;
  $("score-post").textContent = `${postScore}%`;
  $("result-headline").textContent =
    gain > 0 ? `You improved by ${gain} points! 🎉` : gain === 0 ? "Same score — try teaching more of the big ideas!" : "Tricky one! Teach it again to lock it in.";
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
  const next = dueReviews(state.pet).length ? "" : state.pet.reviews?.find((r) => r.fact === state.fact);
  $("report").innerHTML = `<h3>Teaching report card</h3>` +
    rows.map(([icon, label, val, good]) => `<div class="report-row ${good ? "good" : ""}"><span>${icon} ${esc(label)}</span><b>${esc(val)}</b></div>`).join("") +
    (next ? `<p class="muted">🔁 ${esc(n)} will need a refresher on this in ${Math.round((next.due - Date.now()) / DAY)} day(s). Come back and re-teach it to make it stick.</p>` : "");
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
        <div class="a-line">${esc(n)}: ${fmt(r.petAnswer)}</div>
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
  renderSetup();
  show("setup");
};

// ---------- boot ----------
fetch("/api/config").then((r) => r.json()).then((c) => $("demo-badge").classList.toggle("hidden", !c.demo)).catch(() => {});
renderSetup();
