import type { ISODate } from "./types";

export type Quote = { text: string; by: string; source?: string };

// One quote per day, in this order. Only well-attributed quotes; the source is
// given where the line comes from a specific book, poem or letter.
export const QUOTES: Quote[] = [
  { text: "How we spend our days is, of course, how we spend our lives.", by: "Annie Dillard", source: "The Writing Life" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", by: "Seneca", source: "On the Shortness of Life" },
  { text: "Attention is the rarest and purest form of generosity.", by: "Simone Weil" },
  { text: "Tell me, what is it you plan to do with your one wild and precious life?", by: "Mary Oliver", source: "The Summer Day" },
  { text: "Not everything that is faced can be changed, but nothing can be changed until it is faced.", by: "James Baldwin" },
  { text: "Life can only be understood backwards; but it must be lived forwards.", by: "Søren Kierkegaard" },
  { text: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", by: "Marcus Aurelius", source: "Meditations" },
  { text: "In the depth of winter, I finally learned that within me there lay an invincible summer.", by: "Albert Camus", source: "Return to Tipasa" },
  { text: "The best way out is always through.", by: "Robert Frost", source: "A Servant to Servants" },
  { text: "We suffer more often in imagination than in reality.", by: "Seneca", source: "Letters to Lucilius" },
  { text: "Be patient toward all that is unsolved in your heart and try to love the questions themselves.", by: "Rainer Maria Rilke", source: "Letters to a Young Poet" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", by: "Marcus Aurelius", source: "Meditations" },
  { text: "He who has a why to live can bear almost any how.", by: "Friedrich Nietzsche", source: "Twilight of the Idols" },
  { text: "Things do not change; we change.", by: "Henry David Thoreau", source: "Walden" },
  { text: "Nothing in life is to be feared, it is only to be understood.", by: "Marie Curie" },
  { text: "Let everything happen to you: beauty and terror. Just keep going. No feeling is final.", by: "Rainer Maria Rilke", source: "Book of Hours" },
  { text: "First say to yourself what you would be; and then do what you have to do.", by: "Epictetus", source: "Discourses" },
  { text: "Hope is the thing with feathers that perches in the soul.", by: "Emily Dickinson" },
  { text: "The world breaks everyone and afterward many are strong at the broken places.", by: "Ernest Hemingway", source: "A Farewell to Arms" },
  { text: "Begin at once to live, and count each separate day as a separate life.", by: "Seneca", source: "Letters to Lucilius" },
  { text: "Do not spoil what you have by desiring what you have not.", by: "Epicurus" },
  { text: "There is a crack in everything. That's how the light gets in.", by: "Leonard Cohen", source: "Anthem" },
  { text: "The unexamined life is not worth living.", by: "Socrates", source: "Plato, Apology" },
  { text: "Almost everything will work again if you unplug it for a few minutes, including you.", by: "Anne Lamott" },
  { text: "What stands in the way becomes the way.", by: "Marcus Aurelius", source: "Meditations" },
  { text: "I went to the woods because I wished to live deliberately.", by: "Henry David Thoreau", source: "Walden" },
  { text: "The cure for anything is salt water: sweat, tears or the sea.", by: "Isak Dinesen" },
  { text: "Gratitude is not only the greatest of virtues, but the parent of all the others.", by: "Cicero" },
  { text: "There is no greater agony than bearing an untold story inside you.", by: "Maya Angelou", source: "I Know Why the Caged Bird Sings" },
  { text: "Wherever you go, there you are.", by: "Jon Kabat-Zinn" },
  { text: "One day I will find the right words, and they will be simple.", by: "Jack Kerouac", source: "The Dharma Bums" },
  { text: "Our life is frittered away by detail. Simplify, simplify.", by: "Henry David Thoreau", source: "Walden" },
  { text: "Well done is better than well said.", by: "Benjamin Franklin" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", by: "Will Durant", source: "on Aristotle" },
];

/** The old built-in line. Treated like an empty setting: show the rotating quote. */
export const OLD_DEFAULT_TAGLINE = "A focused day builds a brighter life.";

/** Same quote all day on every device; the next one tomorrow. `offset` steps through the list. */
export function quoteForDay(date: ISODate, offset = 0): Quote {
  const [y, m, d] = date.split("-").map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const n = QUOTES.length;
  return QUOTES[(((day + offset) % n) + n) % n];
}

/** A custom line from Settings, or null to use the rotating quote. */
export function customLine(tagline: string | undefined): string | null {
  const t = (tagline ?? "").trim();
  return t && t !== OLD_DEFAULT_TAGLINE ? t : null;
}
