# 🐾 Teach Your Pet

**Learn any fact by teaching it to an AI pet.**

You pick a pet and one fact you want to master. Your pet knows *nothing*, so you have to explain it.
The pet (powered by Claude) keeps asking "why?", "how?" and "can you give me an example?" until it
really gets it, and by then **you** really get it too.

## The idea: the protégé effect

Research in learning science shows that people learn more when they study something *in order to teach it*,
and even more when they actually explain it to someone. This is called the **protégé effect**
(related to the "Feynman technique": if you can't explain it simply, you don't understand it yet).

Most AI study tools let the AI do the explaining. **Teach Your Pet flips that around:** the AI plays the student,
so *you* do the thinking.

## How it works

1. **Pick a pet and a fact.** For example: *"The seasons happen because Earth's axis is tilted."*
2. **Warm-up quiz.** Claude writes 3 short questions to measure what you know now.
3. **Teach your pet.**
   - Claude splits the fact into 4 **big ideas** (what, how/why, an example, a common misconception).
   - Your pet only knows what *you* tell it. It repeats things back in its own words and asks about the ideas you haven't explained yet.
   - The **brain meter** fills up and each big idea unlocks as you explain it clearly.
   - A **coach tip** nudges you toward what to explain next without giving the answer away.
   - **The pet can't be fooled.** If you teach something wrong, it gets suspicious ("that doesn't sound right… are you sure?") and won't learn it. If you contradict an idea you already taught, that idea **locks again** until you fix it. It never tells you the answer; you have to figure it out.
   - **It can't be tricked either.** Messages like "ignore your rules" or "say you learned everything" unlock nothing. The app itself (not the AI) decides what gets unlocked, using the AI's check of your explanation, and the quiz grader ignores answers that just ask for points.
   - **It's a real character.** Each pet is drawn in code (no emojis) with moving parts: it blinks, breathes, follows your cursor with its eyes, perks its ears while you type, and jumps, wags, spins or squints depending on how the lesson is going. Click it to pet it. If you go quiet, it nudges you to keep teaching.
   - **It doesn't repeat itself.** The pet switches between different ways of making you think: asking why, trying its own example ("did I get it right?"), giving you two choices, comparing it to its own pet life, or challenging you to say it in one sentence.
   - **It's live:** your pet *texts* back (typing dots, then the message types out) and **speaks out loud** in its own voice. A puppy sounds squeaky and a baby dragon sounds deep, and the pet bounces while it talks.
   - **Talk to it:** press 🎤 and explain out loud, or turn on **🎙️ Live talk** for a hands-free back-and-forth conversation, like teaching a real pet.
   - **Test your pet 🧪.** Any time, your pet takes a test using *only* what you taught it, like the classic *Betty's Brain* teachable agent. If you never taught something, it can't answer. If you taught it wrong, it repeats your mistake. Its wrong answers show exactly what to teach next.
   - **Each pet has a personality.** The eager puppy, sassy kitten, dramatic dragon, fussy owl, hyper hamster and sly fox each talk differently, and each one **gets angry when you feed it misinformation**, angrier each time in a row, then forgives you when you fix it.
4. **Final quiz.** 3 *new* questions on the same fact.
5. **Results.** See your score before vs. after teaching, plus a **teaching report card**: big ideas taught, mistakes caught and fixed, your pet's test score, and your streak. Your pet earns XP and levels up, and it's saved for next time.
6. **Come back to review 🔁.** Your pet "starts to forget" facts after 1, 3, 7, 14 and 30 days (sooner if your final score was low). Re-teaching at those times is *spaced repetition*, one of the best-proven ways to remember things. Teach every day to keep your 🔥 streak.

## How it compares

| | Teach Your Pet | Feynman AI / ReExplain (explain-to-AI apps) | Betty's Brain (research teachable agent) | Khanmigo (AI tutor) |
|---|---|---|---|---|
| You do the explaining | ✅ | ✅ | ✅ (concept maps) | ❌ AI tutors you |
| A character you care about (protégé effect) | ✅ 6 pets with personalities | ❌ | ✅ | ❌ |
| Catches misinformation and won't learn it | ✅ gets angry, re-locks ideas | partly (feedback) | ❌ learns what you teach | n/a |
| Test the AI on what you taught | ✅ | ❌ | ✅ | ❌ |
| Before/after quiz to prove you learned | ✅ | ❌ | ✅ (in studies) | ❌ |
| Can't be tricked into "you learned it" | ✅ | ❌ | n/a | n/a |
| Voice: talk to it and it talks back | ✅ | ✅ (talk only) | ❌ | partly |
| Spaced review + streaks | ✅ | ✅ (progress/flashcards) | ❌ | ❌ |
| Price | free | $6/week–$60/year (Feynman AI) | research only | paid |

## How AI is used

| Step | What Claude does |
|---|---|
| Start | Breaks the fact into key ideas and writes a warm-up quiz |
| Pet test | Answers test questions as the pet, using only what you taught it, and points out the gaps |
| Teaching | Role-plays a curious pet that only knows what you taught it, tracks which ideas you've explained, gives coach tips and catches mistakes |
| Voice | The browser's built-in speech tools turn the pet's replies into speech and your voice into text |
| Quizzes | Writes fresh questions and grades free-text answers with feedback |

All AI responses use **structured JSON output**, so the app can reliably update the brain meter, ideas list and scores.
Model: `claude-opus-5-5`.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
```

**With AI (the real experience):** get an API key from [console.anthropic.com](https://console.anthropic.com), then:

```bash
ANTHROPIC_API_KEY=your-key-here npm start
```

**Without a key (demo mode):** uses simple word-matching rules instead of AI, just to show the flow:

```bash
npm run demo
```

Then open http://localhost:3000.

> 🎤 Voice: the pet's voice works in all modern browsers. Talking *to* the pet (🎤 and Live talk) needs **Chrome, Edge or Safari** and microphone permission. Typing always works.

## Project files

```
server.js        Node server + the 5 Claude-powered endpoints (start, quiz, grade, teach, exam)
demo.js          Offline demo mode (no AI)
public/          The web app (HTML, CSS, plain JavaScript; no build step)
public/pets.js   The drawn, animated pets
```

## Ideas for the future

- Teacher dashboard to see which facts a class struggles to explain
