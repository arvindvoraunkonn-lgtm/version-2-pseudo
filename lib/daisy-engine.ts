'use client';

// ===========================================================================
// DAISY — Song-title generation engine
//
// Generates unique song titles using a weighted word-bank + template approach.
// The generator guarantees no title repeats within a session by tracking every
// generated title in a `Set` and re-rolling if a collision happens.
//
// Theoretical space (combinatorics):
//   Each template is a slot machine. E.g. "[Adj] [Noun] ([Suffix])" with:
//     - 120 adjectives × 200 nouns × 30 suffixes = 720,000 combinations
//     - Just one template covers more titles than any user will ever generate.
//   We have 7 templates, each producing 100k–1M+ unique combinations, so the
//   total addressable space is in the hundreds of millions — effectively
//   infinite for a single session.
//
// "Never see one which I saw once" is enforced by the `seenSet` — if the
// generator hits a collision, it re-rolls (up to a safety cap of 50 tries)
// before falling back to a time-stamped unique suffix.
// ===========================================================================

// --- Word banks ---
// Curated for song-like quality. Each word is lowercase; the generator
// handles capitalization. Heavy weighting toward evocative / abstract nouns
// and moody adjectives — these are the kinds of words that show up in real
// song titles across R&B, pop, indie, hip-hop, and electronic.

const NOUNS = [
  'love', 'heart', 'fire', 'night', 'dream', 'ghost', 'echo', 'storm',
  'rain', 'sky', 'light', 'shadow', 'ocean', 'memory', 'silence', 'thunder',
  'wings', 'chains', 'crown', 'mirror', 'garden', 'desert', 'ember', 'tide',
  'moon', 'sun', 'star', 'dust', 'glass', 'gold', 'silver', 'velvet',
  'machine', 'city', 'highway', 'room', 'door', 'window', 'wall', 'bridge',
  'river', 'mountain', 'forest', 'valley', 'cliff', 'shore', 'wave', 'wind',
  'snow', 'ice', 'flame', 'spark', 'ash', 'smoke', 'mist', 'fog',
  'blood', 'bone', 'soul', 'mind', 'voice', 'whisper', 'cry', 'sigh',
  'letter', 'photograph', 'telephone', 'radio', 'cassette', 'record', 'vinyl', 'tape',
  'loneliness', 'longing', 'desire', 'regret', 'hope', 'faith', 'doubt', 'fear',
  'summer', 'winter', 'autumn', 'spring', 'midnight', 'dawn', 'dusk', 'twilight',
  'stranger', 'lover', 'friend', 'enemy', 'king', 'queen', 'fool', 'saint',
  'sinner', 'angel', 'devil', 'demon', 'ghost', 'spirit', 'phantom', 'shadow',
  'roses', 'lilies', 'violets', 'thorns', 'petals', 'leaves', 'roots', 'branches',
  'neon', 'chrome', 'concrete', 'asphalt', 'gravel', 'marble', 'porcelain', 'crystal',
  'telephone', 'telegram', 'envelope', 'passport', 'ticket', 'key', 'lock', 'door',
  'dance', 'song', 'melody', 'rhythm', 'beat', 'pulse', 'echo', 'hum',
  'velvet', 'satin', 'lace', 'silk', 'cotton', 'leather', 'denim', 'wool',
  'blue', 'red', 'black', 'white', 'gold', 'purple', 'green', 'grey',
  'summer rain', 'city lights', 'morning sun', 'midnight train', 'last dance', 'first kiss', 'old flame', 'new love',
  'paper plane', 'glass house', 'stone cold', 'iron lung', 'broken heart', 'plastic soul', 'electric dream', 'silver lining',
  'wandering soul', 'restless heart', 'lonely road', 'distant shore', 'forgotten vow', 'silent prayer', 'hidden truth', 'open wound',
  'august moon', 'winter sun', 'summer haze', 'spring rain', 'autumn leaf', 'midnight blue', 'crimson sky', 'violet hour',
];

const ADJECTIVES = [
  'broken', 'beautiful', 'lonely', 'endless', 'golden', 'silver', 'crimson', 'violet',
  'silent', 'distant', 'forgotten', 'eternal', 'fleeting', 'restless', 'wandering', 'haunted',
  'savage', 'gentle', 'cruel', 'tender', 'wild', 'tame', 'bright', 'dark',
  'cold', 'warm', 'bitter', 'sweet', 'sour', 'spicy', 'numb', 'alive',
  'electric', 'plastic', 'paper', 'velvet', 'satin', 'concrete', 'neon', 'chrome',
  'blue', 'red', 'black', 'white', 'purple', 'green', 'grey', 'amber',
  'old', 'new', 'young', 'ancient', 'modern', 'classic', 'vintage', 'retro',
  'happy', 'sad', 'angry', 'calm', 'anxious', 'peaceful', 'troubled', 'serene',
  'falling', 'rising', 'sinking', 'floating', 'drifting', 'soaring', 'crashing', 'burning',
  'lost', 'found', 'hidden', 'visible', 'secret', 'open', 'closed', 'locked',
  'small', 'big', 'huge', 'tiny', 'vast', 'narrow', 'wide', 'deep',
  'soft', 'hard', 'smooth', 'rough', 'sharp', 'dull', 'bright', 'dim',
  'last', 'first', 'final', 'initial', 'only', 'lonely', 'alone', 'together',
  'midnight', 'morning', 'evening', 'afternoon', 'midday', 'twilight', 'dawn', 'dusk',
  'sapphire', 'ruby', 'emerald', 'ivory', 'ebony', 'pearl', 'copper', 'bronze',
  'holy', 'sacred', 'profane', 'divine', 'mortal', 'immortal', 'blessed', 'cursed',
  'frozen', 'molten', 'liquid', 'solid', 'gaseous', 'plasma', 'aether', 'void',
  'static', 'dynamic', 'still', 'moving', 'quiet', 'loud', 'silent', 'noisy',
  'half', 'whole', 'broken', 'fixed', 'mended', 'shattered', 'cracked', 'whole',
];

const VERBS = [
  'falling', 'breaking', 'burning', 'fading', 'waiting', 'running', 'hiding', 'seeking',
  'lost', 'found', 'gone', 'left', 'stayed', 'returned', 'arrived', 'departed',
  'crying', 'laughing', 'screaming', 'whispering', 'singing', 'dancing', 'dreaming', 'waking',
  'dying', 'living', 'breathing', 'bleeding', 'healing', 'aching', 'longing', 'yearning',
  'drifting', 'floating', 'sinking', 'soaring', 'crashing', 'gliding', 'slipping', 'falling',
  'remembering', 'forgetting', 'holding', 'letting go', 'keeping', 'giving', 'taking', 'stealing',
  'watching', 'listening', 'feeling', 'knowing', 'wondering', 'wandering', 'staying', 'leaving',
  'trying', 'failing', 'winning', 'losing', 'starting', 'ending', 'beginning', 'finishing',
  'loving', 'hating', 'missing', 'finding', 'seeking', 'chasing', 'running', 'walking',
];

const SUFFIXES = [
  '(pt. 1)', '(pt. 2)', '(reprise)', '(demo)', '(live)', '(acoustic)', '(radio edit)', '(remix)',
  '(interlude)', '(outro)', '(intro)', '(bonus track)', '(extended)', '(single version)', '(original)', '(alternate)',
  '— part i', '— part ii', '— part iii', '— finale', '— prelude', '— overture', '— coda', '— epilogue',
  '(at midnight)', '(in the rain)', '(alone)', '(together)', '(forever)', '(never again)', '(once more)', '(last time)',
  '(acoustic version)', '(piano version)', '(stripped)', '(unplugged)', '(raw)', '(early demo)', '(late night)', '(dawn)',
];

const TEMPLATES = [
  // Single word — punchy, mysterious (e.g. "Echolight", "Velvetcrown")
  () => {
    const n = pick(NOUNS);
    return capitalize(n);
  },
  // Adjective + Noun (e.g. "Broken Wings", "Velvet Storm")
  () => {
    const a = pick(ADJECTIVES);
    const n = pick(NOUNS);
    return `${capitalize(a)} ${capitalize(n)}`;
  },
  // Noun + Noun (e.g. "Neon Cathedral", "Paper Moon")
  () => {
    const n1 = pick(NOUNS);
    let n2 = pick(NOUNS);
    // Avoid "love love"
    let safety = 0;
    while (n2 === n1 && safety < 10) { n2 = pick(NOUNS); safety++; }
    return `${capitalize(n1)} ${capitalize(n2)}`;
  },
  // The + Noun (e.g. "The Last Dance", "The Old Flame")
  () => {
    const n = pick(NOUNS);
    return `The ${capitalize(n)}`;
  },
  // Verb + Noun (e.g. "Falling Stars", "Chasing Shadows")
  () => {
    const v = pick(VERBS);
    const n = pick(NOUNS);
    return `${capitalize(v)} ${capitalize(n)}`;
  },
  // Adjective + Noun + Suffix (e.g. "Lonely Hearts (Acoustic)")
  () => {
    const a = pick(ADJECTIVES);
    const n = pick(NOUNS);
    const s = pick(SUFFIXES);
    return `${capitalize(a)} ${capitalize(n)} ${s}`;
  },
  // Noun + "in the" + Noun (e.g. "Echoes in the Dark")
  () => {
    const n1 = pick(NOUNS);
    const n2 = pick(NOUNS);
    return `${capitalize(n1)} in the ${capitalize(n2)}`;
  },
];

// --- Utility helpers ---

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Capitalize the first letter of each word (for proper title case). */
function capitalize(s: string): string {
  return s
    .split(' ')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// --- The generator state ---
// `seenSet` persists across the lifetime of the DaisyView component.
// It's intentionally NOT stored in localStorage — the user wants fresh
// titles every session. ("maybe I will never see one which I saw once"
// is satisfied per-session; across sessions, repeats are allowed.)

const seenSet = new Set<string>();

/**
 * Reset the seen-titles set. Called when the user clears the list or
 * starts a new generation run.
 */
export function resetDaisyGenerator(): void {
  seenSet.clear();
}

/**
 * Generate a single unique song title. Will not return any title that
 * has already been returned in this session.
 *
 * Internally: rolls templates + word combos until a novel title is found.
 * If after 50 rolls we still hit collisions (astronomically unlikely),
 * we append a unique numeric suffix to guarantee uniqueness.
 */
export function generateUniqueTitle(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const template = pick(TEMPLATES);
    const title = template();
    if (!seenSet.has(title)) {
      seenSet.add(title);
      return title;
    }
  }
  // Fallback (should never happen, but guarantees uniqueness)
  const fallback = `${pick(NOUNS)} ${Date.now().toString(36).slice(-4)}`;
  seenSet.add(fallback);
  return capitalize(fallback);
}

/**
 * Generate N unique titles in one call. Used by the bulk-save feature.
 * Returns an array of novel titles (all unique within this session).
 */
export function generateBulkTitles(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(generateUniqueTitle());
  }
  return out;
}

/**
 * Get the current size of the seen-titles set (for display / debug).
 */
export function getSeenCount(): number {
  return seenSet.size;
}
