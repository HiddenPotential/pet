// Hand-drawn SVG pets with moving parts (eyes, lids, mouth, ears, tail, wings).
// Pets.svg(kind) returns the drawing; Pets.mount(el, kind) brings one to life:
// blinking, breathing, eyes that follow your cursor, moods, actions, talking and petting.

(() => {
  // Warm, friendly colors.
  const LOOKS = {
    puppy: { fur: "#d9a066", dark: "#8a5a32", light: "#f6e4cc", ears: "floppy", tail: "short", nose: "#2a1f1f", muzzle: true, sound: "Woof" },
    kitten: { fur: "#a9b1c4", dark: "#606a80", light: "#eef0f5", inner: "#f2b5c1", ears: "pointy", tail: "long", nose: "#b9737f", whiskers: true, sound: "Mrrp" },
    "baby dragon": { fur: "#6cc48a", dark: "#3b8a59", light: "#e0f3c8", ears: "horns", tail: "spiky", wings: true, nostrils: true, sound: "Rawr" },
    owl: { fur: "#a57f5c", dark: "#6a4a30", light: "#f3e4cc", ears: "tufts", beak: true, sideWings: true, bigEyes: true, faceDisk: true, sound: "Hoo" },
    hamster: { fur: "#eab27c", dark: "#b07a45", light: "#fff4e6", inner: "#f2b5c1", ears: "round", nose: "#b8737a", cheeks: true, sound: "Squeak" },
    fox: { fur: "#ef7d3a", dark: "#3b2a20", light: "#fff3e6", inner: "#2b1f18", ears: "pointy", tail: "bushy", nose: "#1f1611", muzzle: true, sound: "Yip" },
  };
  let uid = 0;

  function ears(L) {
    const d = L.dark, f = L.fur, i = L.inner || L.dark;
    switch (L.ears) {
      case "floppy": return ""; // drawn in front of the head, see floppyEars()
      case "pointy":
        return `<g class="ear ear-l" style="transform-origin:76px 50px"><polygon points="54,62 62,14 94,44" fill="${f}"/><polygon points="62,54 66,26 86,46" fill="${i}"/></g>
                <g class="ear ear-r" style="transform-origin:124px 50px"><polygon points="146,62 138,14 106,44" fill="${f}"/><polygon points="138,54 134,26 114,46" fill="${i}"/></g>`;
      case "horns":
        return `<g class="ear ear-l" style="transform-origin:80px 44px"><polygon points="70,46 66,14 88,40" fill="#f7e7b4" stroke="${d}" stroke-width="2"/></g>
                <g class="ear ear-r" style="transform-origin:120px 44px"><polygon points="130,46 134,14 112,40" fill="#f7e7b4" stroke="${d}" stroke-width="2"/></g>`;
      case "tufts":
        return `<g class="ear ear-l" style="transform-origin:70px 46px"><polygon points="56,52 50,16 84,40" fill="${d}"/></g>
                <g class="ear ear-r" style="transform-origin:130px 46px"><polygon points="144,52 150,16 116,40" fill="${d}"/></g>`;
      case "round":
        return `<g class="ear ear-l" style="transform-origin:64px 46px"><circle cx="62" cy="44" r="15" fill="${d}"/><circle cx="62" cy="44" r="8" fill="${i}"/></g>
                <g class="ear ear-r" style="transform-origin:136px 46px"><circle cx="138" cy="44" r="15" fill="${d}"/><circle cx="138" cy="44" r="8" fill="${i}"/></g>`;
    }
    return "";
  }

  function floppyEars(L) {
    if (L.ears !== "floppy") return "";
    return `<g class="ear ear-l" style="transform-origin:62px 52px"><ellipse cx="54" cy="84" rx="15" ry="32" transform="rotate(14 54 84)" fill="${L.dark}"/></g>
            <g class="ear ear-r" style="transform-origin:138px 52px"><ellipse cx="146" cy="84" rx="15" ry="32" transform="rotate(-14 146 84)" fill="${L.dark}"/></g>`;
  }

  function tail(L) {
    const f = L.fur, d = L.dark;
    switch (L.tail) {
      case "short":
        return `<g class="tail" style="transform-origin:138px 156px"><path d="M136 158 Q160 150 166 124" stroke="${f}" stroke-width="13" fill="none" stroke-linecap="round"/></g>`;
      case "long":
        return `<g class="tail" style="transform-origin:138px 166px"><path d="M136 166 C176 168 188 128 166 104" stroke="${f}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M174 116 C176 110 172 104 166 104" stroke="${d}" stroke-width="10" fill="none" stroke-linecap="round"/></g>`;
      case "spiky":
        return `<g class="tail" style="transform-origin:138px 168px"><path d="M134 168 Q180 176 184 138" stroke="${f}" stroke-width="14" fill="none" stroke-linecap="round"/><polygon points="176,140 184,114 194,140" fill="${d}"/><polygon points="160,168 168,152 174,170" fill="${d}"/></g>`;
      case "bushy":
        return `<g class="tail" style="transform-origin:136px 166px"><ellipse cx="164" cy="140" rx="17" ry="38" transform="rotate(38 164 140)" fill="${f}"/><ellipse cx="182" cy="114" rx="10" ry="14" transform="rotate(38 182 114)" fill="${L.light}"/></g>`;
    }
    return "";
  }

  // Simple cartoon eyes: a shiny dark oval with two highlights (no whites, no irises),
  // which reads as cute instead of creepy. The whole eye shifts a little to follow the cursor.
  function eye(id, x, y, R, L) {
    const rx = R * 0.72, ry = R * 0.9;
    return `<g class="eye" transform="translate(${x} ${y})">
      <clipPath id="${id}"><ellipse rx="${rx + 0.5}" ry="${ry + 0.5}"/></clipPath>
      <g class="pupil">
        <ellipse rx="${rx}" ry="${ry}" fill="#2a2230"/>
        <circle cx="${-rx * 0.32}" cy="${-ry * 0.38}" r="${rx * 0.38}" fill="#fff"/>
        <circle cx="${rx * 0.35}" cy="${ry * 0.35}" r="${rx * 0.17}" fill="#fff" opacity=".8"/>
        <g clip-path="url(#${id})"><rect class="lid" x="${-rx - 2}" y="${-ry - 2}" width="${2 * rx + 4}" height="${2 * ry + 4}" fill="${L.faceDisk ? L.light : L.fur}"/></g>
      </g>
    </g>`;
  }

  function face(L, p) {
    const R = L.bigEyes ? 14 : 11;
    const disk = L.faceDisk ? `<circle cx="80" cy="84" r="25" fill="${L.light}"/><circle cx="120" cy="84" r="25" fill="${L.light}"/>` : "";
    const muzzle = L.muzzle ? `<ellipse cx="100" cy="106" rx="20" ry="14" fill="${L.light}"/>` : "";
    const cheeks = L.cheeks ? `<ellipse cx="68" cy="104" rx="19" ry="15" fill="${L.light}"/><ellipse cx="132" cy="104" rx="19" ry="15" fill="${L.light}"/>` : "";
    const blush = `<ellipse class="blush" cx="70" cy="101" rx="7" ry="4"/><ellipse class="blush" cx="130" cy="101" rx="7" ry="4"/>`;
    let nose = "";
    if (L.nostrils) nose = `<circle cx="94" cy="100" r="2.5" fill="${L.dark}"/><circle cx="106" cy="100" r="2.5" fill="${L.dark}"/>`;
    else if (L.nose) nose = `<path d="M93 99 Q100 95 107 99 Q104 105 100 105 Q96 105 93 99Z" fill="${L.nose}"/>`;
    const whiskers = L.whiskers
      ? `<g stroke="${L.dark}" stroke-width="1.5" stroke-linecap="round"><path d="M80 104 L56 98"/><path d="M80 108 L56 110"/><path d="M120 104 L144 98"/><path d="M120 108 L144 110"/></g>`
      : "";
    const mouth = L.beak
      ? `<g class="mouth"><g class="mouth-closed mouth-smile mouth-flat"><polygon points="92,98 108,98 100,114" fill="#f2a93b" stroke="#c97f1b" stroke-width="1.5"/></g>
           <g class="mouth-open"><polygon points="92,96 108,96 100,106" fill="#f2a93b"/><ellipse cx="100" cy="109" rx="6" ry="4" fill="#5a2335"/><polygon points="94,112 106,112 100,120" fill="#e0952a"/></g></g>`
      : `<g class="mouth">
           <path class="mouth-closed mouth-smile" d="M100 105 L100 110 M92 112 Q96 115 100 110 Q104 115 108 112" stroke="${L.dark}" stroke-width="2" fill="none" stroke-linecap="round"/>
           <path class="mouth-closed mouth-flat" d="M100 105 L100 110 M93 114 Q100 111 107 114" stroke="${L.dark}" stroke-width="2" fill="none" stroke-linecap="round"/>
           <g class="mouth-open"><path d="M100 105 L100 109" stroke="${L.dark}" stroke-width="2"/><path d="M93 111 Q100 109 107 111 Q104 119 100 119 Q96 119 93 111Z" fill="#3a1a22"/><ellipse cx="100" cy="117" rx="3.5" ry="1.8" fill="#b9616f"/></g>
         </g>`;
    const by = L.bigEyes ? 84 - R - 6 : 84 - R - 2;
    const brows = `<path class="brow brow-l" d="M70 ${by} q10 -4 20 1" stroke="${L.dark}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
                   <path class="brow brow-r" d="M110 ${by + 1} q10 -5 20 -1" stroke="${L.dark}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    return disk + muzzle + cheeks + blush + eye(`${p}l`, 80, 88, R, L) + eye(`${p}r`, 120, 88, R, L) + brows + nose + whiskers + mouth;
  }

  function svg(kind, { mini = false } = {}) {
    const L = LOOKS[kind] || LOOKS.puppy;
    const p = `pet${uid++}`;
    const wings = L.wings
      ? `<g class="wing wing-l" style="transform-origin:66px 136px"><polygon points="66,132 22,98 30,128 18,140 58,152" fill="${L.dark}"/></g>
         <g class="wing wing-r" style="transform-origin:134px 136px"><polygon points="134,132 178,98 170,128 182,140 142,152" fill="${L.dark}"/></g>`
      : "";
    const sideWings = L.sideWings
      ? `<g class="wing wing-l" style="transform-origin:58px 128px"><ellipse cx="56" cy="152" rx="13" ry="28" fill="${L.dark}"/></g>
         <g class="wing wing-r" style="transform-origin:142px 128px"><ellipse cx="144" cy="152" rx="13" ry="28" fill="${L.dark}"/></g>`
      : "";
    return `<svg class="pet-svg ${mini ? "mini" : ""}" viewBox="0 0 200 200" role="img" aria-label="${kind}">
      <defs><radialGradient id="${p}shade" cx="40%" cy="32%" r="78%"><stop offset="0" stop-color="${L.fur}"/><stop offset=".62" stop-color="${L.fur}"/><stop offset="1" stop-color="${L.dark}"/></radialGradient></defs>
      <ellipse class="shadow" cx="100" cy="190" rx="46" ry="5"/>
      <g class="pet-root">
        ${tail(L)}${wings}
        <g class="body-g">
          <path d="M60 186 C54 150 64 116 100 114 C136 116 146 150 140 186 Z" fill="url(#${p}shade)" stroke="${L.dark}" stroke-opacity=".45" stroke-width="1.5"/>
          <path d="M80 184 C76 160 84 132 100 130 C116 132 124 160 120 184 Z" fill="${L.light}" opacity=".9"/>
          <path d="M70 188 q0 -10 10 -10 q9 0 9 10 Z" fill="${L.dark}"/>
          <path d="M111 188 q0 -10 9 -10 q10 0 10 10 Z" fill="${L.dark}"/>
          ${sideWings}
        </g>
        <g class="head">
          ${ears(L)}
          <path d="M100 42 C130 42 144 62 144 84 C144 110 124 126 100 126 C76 126 56 110 56 84 C56 62 70 42 100 42 Z" fill="url(#${p}shade)" stroke="${L.dark}" stroke-opacity=".45" stroke-width="1.5"/>
          ${floppyEars(L)}
          ${face(L, p)}
        </g>
      </g>
      <g class="fx"></g>
    </svg>`;
  }

  const HEART = "M0 -4 C -4 -10 -12 -6 -10 0 C -8 5 0 9 0 12 C 0 9 8 5 10 0 C 12 -6 4 -10 0 -4 Z";

  function mount(el, kind) {
    el.innerHTML = svg(kind);
    const root = el.querySelector(".pet-svg");
    const eyes = [...root.querySelectorAll(".eye")];
    const R = 7; // how far (in drawing units) the eyes can shift toward the cursor
    let look = null; // fixed gaze (e.g. "up" while thinking) overrides cursor
    let actTimer = null;
    let alive = true;

    function setPupils(dx, dy) {
      const max = R * 0.35; // small and gentle; big pupil swings look creepy
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 120);
      eyes.forEach((e) => e.querySelector(".pupil").setAttribute("transform", `translate(${(dx / len) * max * k} ${(dy / len) * max * k})`));
    }
    function onMove(ev) {
      if (look || !el.isConnected) return;
      const r = root.getBoundingClientRect();
      setPupils(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height * 0.42));
    }
    window.addEventListener("pointermove", onMove);

    // Blink every few seconds, sometimes twice.
    (function blinkLoop() {
      if (!alive) return;
      setTimeout(() => {
        root.classList.add("blink");
        setTimeout(() => root.classList.remove("blink"), 140);
        if (Math.random() < 0.25) setTimeout(() => { root.classList.add("blink"); setTimeout(() => root.classList.remove("blink"), 140); }, 300);
        blinkLoop();
      }, 2200 + Math.random() * 3200);
    })();

    const ctl = {
      el: root,
      setMood(mood) {
        root.classList.forEach((c) => c.startsWith("mood-") && root.classList.remove(c));
        root.classList.add(`mood-${mood}`);
        if (mood === "thinking") ctl.gaze(-1, -1);
        else if (look === "fixed") ctl.gaze(null);
      },
      act(action) {
        if (!action) return;
        root.classList.forEach((c) => c.startsWith("act-") && root.classList.remove(c));
        void root.getBoundingClientRect(); // restart animation
        root.classList.add(`act-${action}`);
        clearTimeout(actTimer);
        actTimer = setTimeout(() => root.classList.remove(`act-${action}`), 1400);
      },
      talking(on) {
        root.classList.toggle("talking", on);
      },
      listening(on) {
        root.classList.toggle("listening", on);
      },
      gaze(dx, dy) {
        if (dx === null) { look = null; return; }
        look = "fixed";
        setPupils(dx * 100, dy * 100);
      },
      hearts(n = 3) {
        const fx = root.querySelector(".fx");
        for (let i = 0; i < n; i++) {
          const h = document.createElementNS("http://www.w3.org/2000/svg", "g");
          h.setAttribute("transform", `translate(${70 + Math.random() * 60} ${50 + Math.random() * 30})`);
          h.innerHTML = `<path class="heart" d="${HEART}" style="animation-delay:${i * 0.15}s"/>`;
          fx.appendChild(h);
          setTimeout(() => h.remove(), 1600 + i * 150);
        }
      },
      destroy() {
        alive = false;
        window.removeEventListener("pointermove", onMove);
      },
    };
    return ctl;
  }

  window.Pets = { svg, mount, LOOKS };
})();
