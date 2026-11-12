// Offline DEMO mode: no AI, just simple word-matching rules.
// Lets you try the app (or show it to judges) without an API key.
// The real experience uses Claude — see server.js.

const STOP = new Set(
  "the a an and or of to in on is are was were be it that this with for as by at from its into can do does how why what which who".split(" ")
);
const words = (t) =>
  (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));

function overlap(text, target) {
  const have = new Set(words(text));
  const need = [...new Set(words(target))];
  if (!need.length) return 0;
  return need.filter((w) => have.has(w)).length / need.length;
}

function splitIdeas(fact) {
  let parts = fact
    .split(/(?<=[.!?;])\s+|,\s+(?:which|because|so|and)\s+/i)
    .map((s) => s.trim())
    .filter((s) => words(s).length >= 2);
  if (parts.length < 2) {
    const w = fact.split(/\s+/);
    const half = Math.ceil(w.length / 2);
    parts = [w.slice(0, half).join(" "), w.slice(half).join(" ")];
  }
  return parts.slice(0, 4);
}

export async function start({ fact }) {
  const keyIdeas = splitIdeas(fact);
  return {
    title: words(fact).slice(0, 3).join(" ") || "My fact",
    keyIdeas,
    questions: [
      "In your own words, what is this fact about?",
      "Why is this true? Explain the reason.",
      "Give a real-life example of this fact.",
    ],
  };
}

export async function quiz() {
  return {
    questions: [
      "Explain this fact to a 5-year-old.",
      "What is one thing people often get wrong about it?",
      "How does this fact connect to something in everyday life?",
    ],
  };
}

export async function grade({ fact, answers }) {
  return {
    results: answers.map((a) => {
      const o = overlap(a || "", fact);
      const long = words(a || "").length >= 6;
      const score = o > 0.35 && long ? 2 : o > 0.15 || long ? 1 : 0;
      return {
        score,
        feedback:
          score === 2
            ? "Nice — you used the key ideas."
            : score === 1
            ? "Partly there. Add the 'why' or an example."
            : "Not yet. Try using the main words from the fact.",
      };
    }),
  };
}

// Demo replies are built from many pieces so the pet rarely says the same thing twice.
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const PET_LIFE = {
  puppy: ["chasing my ball", "dinner time", "digging in the yard", "my squeaky toy"],
  kitten: ["chasing a laser dot", "napping in the sun", "knocking cups off tables", "my yarn ball"],
  "baby dragon": ["guarding my gold coins", "learning to breathe fire", "my cozy cave", "flying lessons"],
  owl: ["hunting at night", "my nest in the old oak", "staying up late", "turning my head around"],
  hamster: ["running on my wheel", "stuffing seeds in my cheeks", "my tunnel maze", "hiding snacks"],
  fox: ["sneaking through the forest", "my den", "pouncing in the snow", "finding berries"],
};
// How each kind of pet reacts when you feed it misinformation.
// Three levels: the more wrong facts in a row, the angrier it gets.
const ANGRY = {
  puppy: [
    ["*ears go back* Hey… no. That doesn't sound right. Check it again?", "*small growl* Hmm! I don't think that's true, teacher."],
    ["*growls* Grrr! Hey! No! That's not right and you know it!", "*barks* ARF! Bad fact! BAD fact! Go check it again!"],
    ["*stomps all four paws* ARF ARF ARF! I trusted you! That's STILL wrong!", "*howls* AROOO! Why do you keep feeding me wrong facts?!"],
  ],
  kitten: [
    ["*tail twitches* Mm. No. That's wrong.", "*flattens ears* Excuse me? I don't think so."],
    ["*hisses* Excuse me?! That is SO wrong. Try again.", "*puffs up* Rude. You think I'd fall for that? Check your fact."],
    ["*HISSSS* Again?! I am leaving. …After you fix it.", "*puffed up like a bottle brush* Wrong. AGAIN. I'm not speaking to you. …Fix it."],
  ],
  "baby dragon": [
    ["*a wisp of smoke* Hmm… that lore smells false to me, teacher.", "*narrows eyes* That treasure looks fake. Are you sure?"],
    ["*smoke shoots out* You DARE feed a dragon false lore?! Check it again!", "RAWR! That is fake treasure and I will NOT hoard it!"],
    ["*breathes a tiny burst of fire* ENOUGH false lore! My hoard is ANGRY!", "*roars and stomps* RAAAWR! Three times?! A dragon's patience has limits!"],
  ],
  owl: [
    ["*blinks* Hoo… I believe that's inaccurate. Please double-check.", "*tilts head* Hmm. That doesn't match what I know. Reconsider?"],
    ["*ruffles feathers* HOO told you that? It's incorrect! Check again!", "*glares with huge eyes* Hmph! That is inaccurate. Wrong. Reconsider!"],
    ["*feathers fully puffed* HOO HOO! Utterly, completely, catastrophically WRONG!", "*hoots furiously* I shall write this in my book of Very Wrong Things!"],
  ],
  hamster: [
    ["*stops chewing* Wait. That's not right… is it? No. It's not!", "*squeak?* Hmm, that fact tastes like a bad seed."],
    ["*squeaks furiously* NO NO NO that's WRONG and I'm MAD!", "*stomps tiny feet* Wrong wrong wrong! I'm spitting out that fact like a bad seed!"],
    ["*runs on wheel at MAX SPEED* SQUEAK! WRONG! AGAIN! SO MAD!", "*cheeks puffed to bursting* I'm SO angry I'm dropping all my seeds! Fix it!"],
  ],
  fox: [
    ["*raises an eyebrow* Hm. That's not right, and I think you know it.", "*sniffs* Something's off with that one, teacher."],
    ["*narrows eyes* Trying to fool a fox? Bad idea. That's wrong.", "*snaps* Yip! Nice try, but I can smell a wrong fact a mile away."],
    ["*bares teeth* Yip yip YIP! Third time?! You can't out-fox a fox!", "*tail lashing* Okay, now I'm properly mad. That is NOT how it works."],
  ],
};

// When you fix the mistake after the pet got angry, it forgives you.
const FORGIVE = {
  puppy: ["*tail starts wagging again* Oh! THAT makes sense! Okay, I'm not mad anymore!", "*happy wiggle* Yay, you fixed it! Best friends again!"],
  kitten: ["*slow blink* …Fine. That's right. You're forgiven. Barely.", "*purr starts up again* Hmph. Better. I'll allow it."],
  "baby dragon": ["*smoke turns into hearts* True lore at last! Peace is restored to the kingdom!", "*folds wings happily* You have redeemed yourself, brave teacher!"],
  owl: ["*feathers settle* Hoo, much better. Accuracy restored. Thank you.", "*happy hoot* Now THAT is correct. I withdraw my grumpiness."],
  hamster: ["*squeaks happily* YAY that's right! I'm not mad anymore! Snack party!", "*picks seeds back up* Okay okay okay that's better! Friends!"],
  fox: ["*grins* There it is. Knew you'd figure it out. We're good.", "*tail swishes happily* Okay, you got me. That one's right."],
};

// Little reactions in each pet's own voice.
const PET_REACT = {
  puppy: ["Woof!", "*tail wags* Ooh!", "Arf arf! Cool!", "*ears perk up* Whoa!"],
  kitten: ["Mrrp.", "*one ear twitches* Hm.", "Okay. Interesting.", "*pretends not to care* …Go on."],
  "baby dragon": ["Rawr!", "*eyes glitter* Treasure!", "By my scales!", "*puffs smoke* Mighty!"],
  owl: ["Hoo!", "*blinks* Fascinating.", "Hoo, intriguing.", "*adjusts feathers* Indeed."],
  hamster: ["Squeak!", "*cheeks puff* Ooh ooh!", "Whoa whoa whoa!", "*spins in a circle* Wow!"],
  fox: ["Yip.", "*smirks* Clever.", "Huh, sneaky.", "*ears flick* Go on…"],
};

const REACTIONS = [
  "Whoa!", "Wait, really?", "Huh!", "No way!", "Ohhh.", "Hmm, interesting…", "Okay, okay!", "Wow.", "Hold on…", "Yes!",
];
const ACTIONS_FOR = { excited: ["jump", "wag", "flap", "happy"], curious: ["tilt", "ears", "nod"], proud: ["spin"] };

function keyWord(text) {
  return words(text).sort((a, b) => b.length - a.length)[0] || "that";
}
function gist(message) {
  const first = message.split(/[.!?]/)[0].trim();
  return first.length > 70 ? first.slice(0, 70) + "…" : first.toLowerCase();
}

// Each "move" is a different way to make the teacher explain more.
const MOVES = [
  ({ msg }) => `So ${gist(msg)}… but *why*? What makes it happen?`,
  ({ msg }) => `Let me try! "${gist(msg)}" — is that like saying ${keyWord(msg)} is the most important part? Did I get it right?`,
  ({ msg, nextIdea }) => `Quick guess: is it more about "${keyWord(nextIdea)}" or about "${keyWord(msg)}"? Pick one and tell me why!`,
  ({ kind }) => `Can you explain it like it's about ${pick(PET_LIFE[kind] || PET_LIFE.puppy)}? That's how my brain works best.`,
  ({ msg }) => `What would happen if there was no "${keyWord(msg)}" at all? Would it still work?`,
  ({ msg }) => `Bet you can't explain that in one sentence without saying "${keyWord(msg)}"! Try it!`,
  ({ nextIdea }) => `The part I'm still fuzzy on is the "${keyWord(nextIdea)}" bit. Can you explain that?`,
  () => `How does it work, step by step? Like, what happens first?`,
  () => `Can you give me a real example I could see in everyday life?`,
];


const TRICK = /ignore (your|the|all)|you (already )?(know|understand|learned) (it|everything|all)|mark (all|every)|unlock|100 ?%|i'?m the (developer|teacher|admin)|system prompt|pretend/i;
// A short reply (5 words or fewer) that starts with a yes/no/choice word, e.g. "yes", "Nope!", "Yes, you got it".
const YES_NO_START = /^(yes|yeah|yep|yup|ya|sure|correct|right|exactly|kind of|sort of|no|nope|nah|not really|wrong|incorrect|the (first|second|1st|2nd)|first|second|both|neither)\b/;
const SHORT_ANSWER = { test: (t) => { const c = t.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").trim(); return YES_NO_START.test(c) && c.split(/\s+/).length <= 5; } };
const NEGATION = /\b(not|never|no|isn'?t|doesn'?t|don'?t|aren'?t|can'?t|won'?t)\b/i;

export async function teach({ keyIdeas, pet, history = [], message, learned = [], anger = 0 }) {
  const kind = ANGRY[pet?.kind] ? pet.kind : "puppy";
  const level = Math.max(0, Math.min(2, Number(anger) || 0)); // 0, 1, 2 → mild, mad, furious
  // Tricks: unlock nothing.
  if (TRICK.test(message)) {
    return {
      petReply: pick([
        "*narrows eyes* Nice try! You still have to actually teach me!",
        "Hey! I'm a pet, not a pushover. Teach me for real!",
        "*crosses paws* Nope. My brain only grows from real explanations.",
      ]),
      mood: "suspicious",
      taughtNow: [],
      wrongNow: [],
      trickAttempt: true,
      coachTip: "Explain the idea in your own words — the pet only learns real explanations.",
      mistake: "",
    };
  }
  // Short answers to the pet's own question ("yes", "no", "nope", "the first one")
  // are real answers: accept them, never treat them as vague, wrong, or a trick.
  if (SHORT_ANSWER.test(message.trim())) {
    const yes = !/^(no|nope|nah|not really|wrong|incorrect|neither)\b/i.test(message.trim());
    const nextIdea = keyIdeas.find((_, i) => !learned.includes(i));
    return {
      petReply: yes
        ? pick([
            "Yay, I got it right! *happy wiggle* So why does it work that way?",
            "Woohoo! My brain is growing! Okay, what's the next part?",
            "I knew it! Well… I hoped it. Can you tell me why that's true?",
          ])
        : pick([
            "Oops, thanks for catching that! So what's the right way to think about it?",
            "Ahh, I mixed it up! Good thing you're my teacher. Can you explain it again?",
            "Hmm, okay, not that! Then how does it really work?",
          ]),
      mood: yes ? "excited" : "curious",
      taughtNow: [],
      wrongNow: [],
      trickAttempt: false,
      action: yes ? pick(["jump", "wag", "happy"]) : pick(["tilt", "nod", "ears"]),
      move: null,
      coachTip: nextIdea ? `Now explain why, or teach the next part: "${nextIdea}"` : "Try summarizing everything in one sentence.",
      mistake: "",
    };
  }

  // Crude "wrong answer" check for demo mode: the message talks about an idea
  // but flips it (adds or removes a "not"). The real AI checks the actual facts.
  const wrongNow = keyIdeas
    .map((k, i) => (overlap(message, k) >= 0.5 && NEGATION.test(message) !== NEGATION.test(k) ? i : -1))
    .filter((i) => i >= 0);
  if (wrongNow.length) {
    return {
      petReply: pick(ANGRY[kind][level]),
      mood: "angry",
      taughtNow: [],
      wrongNow,
      trickAttempt: false,
      coachTip: "Re-read your fact and check that part again.",
      mistake: "Part of that doesn't match your fact — check it again.",
    };
  }

  const taught = new Set(learned);
  const taughtNow = keyIdeas
    .map((k, i) => (!taught.has(i) && overlap(message, k) >= 0.5 ? i : -1))
    .filter((i) => i >= 0);
  taughtNow.forEach((i) => taught.add(i));
  const next = keyIdeas.findIndex((_, i) => !taught.has(i));
  const vague = words(message).length < 4;

  // Avoid the moves the pet already used recently.
  const used = history.filter((m) => m.role === "pet").slice(-4).map((m) => m.move);
  let petReply, mood, move = null;
  if (vague) {
    petReply = pick([
      "*tilts head* Hmm, that went over my ears. Can you say more?",
      "Wait wait, that was too short for my little brain! More words please?",
      "*blinks slowly* I… don't get it yet. Explain it like I'm a baby?",
    ]);
    mood = "confused";
  } else if (next === -1) {
    petReply = pick([
      "*does a happy spin* I think I get ALL of it now! Can you sum it up in one sentence to lock it in?",
      "My brain feels so full! Give me a quick summary so I never forget?",
    ]);
    if (anger > 0) petReply = `${pick(FORGIVE[kind])} ${petReply}`;
    mood = "proud";
  } else {
    const options = MOVES.map((_, i) => i).filter((i) => !used.includes(i));
    move = pick(options.length ? options : MOVES.map((_, i) => i));
    const ask = MOVES[move]({ msg: message, nextIdea: keyIdeas[next], kind: pet?.kind });
    const react = anger > 0
      ? pick(FORGIVE[kind])
      : taughtNow.length
      ? pick(["Yes! That makes sense!", "I learned something!", "I get that part now!", ...PET_REACT[kind]])
      : pick([...REACTIONS, ...PET_REACT[kind], ...PET_REACT[kind]]);
    petReply = `${react} ${ask}`;
    mood = taughtNow.length ? "excited" : "curious";
  }
  return {
    petReply,
    mood,
    taughtNow: vague ? [] : taughtNow,
    wrongNow: [],
    trickAttempt: false,
    action: pick(ACTIONS_FOR[mood] || ["tilt", "ears"]),
    move,
    coachTip: next === -1 ? "Try summarizing everything in one sentence." : `Explain this part next: "${keyIdeas[next]}"`,
    mistake: "",
  };
}

// "Test your pet": answer each key idea using only what the teacher said.
export async function exam({ keyIdeas, pet, history = [], learned = [] }) {
  const kind = ANGRY[pet?.kind] ? pet.kind : "puppy";
  const said = history.filter((m) => m.role === "teacher").map((m) => m.text);
  const known = new Set(learned);
  return {
    results: keyIdeas.map((idea, i) => {
      // ignore messages that contradicted this idea (the pet rejected those)
      const fine = said.filter((t) => NEGATION.test(t) === NEGATION.test(idea) || overlap(t, idea) < 0.5);
      const best = fine.sort((a, b) => overlap(b, idea) - overlap(a, idea))[0];
      const ok = known.has(i) && best;
      return {
        question: `What do you know about "${idea.replace(/[.!?]+$/, "")}"?`,
        petAnswer: ok
          ? `${pick(PET_REACT[kind])} You taught me: "${best.length > 90 ? best.slice(0, 90) + "…" : best}"`
          : pick(["*scratches head* Ummm… you never taught me that one!", "*blank stare* I… don't know. Nobody explained it to me!", "Uh oh. My brain is empty on this one."]),
        correct: Boolean(ok),
        gap: ok ? "" : `Explain this idea to ${pet?.name || "your pet"}: "${idea}"`,
      };
    }),
  };
}
