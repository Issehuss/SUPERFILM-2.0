// src/constants/tasteQuestions.js
export const TASTE_QUESTIONS = [
  { id: "fav_film",              label: "Favourite Film?" },
  { id: "fav_director",          label: "Favourite Director?" },
  { id: "fav_actor",             label: "Favourite Actor?" },
  { id: "fav_actress",           label: "Favourite Actress?" },
  { id: "fav_screenplay",        label: "Favourite Screenplay?" },
  { id: "most_beautiful_dp",     label: "Most Beautiful Cinematography?" },
  { id: "fav_soundtrack",        label: "Favourite Soundtrack?" },
  { id: "broke_your_heart",      label: "A Film That Broke Your Heart?" },
  { id: "childhood_film",        label: "Favourite Childhood Film?" },
  { id: "comfort_watch",         label: "Comfort Watch?" },
  { id: "most_rewatched",        label: "Most Rewatched Film?" },
  { id: "best_horror_perf",      label: "Best Horror Performance?" },
  { id: "most_nostalgic",        label: "Most Nostalgic Film?" },
  { id: "most_underrated",       label: "Most Underrated Film?" },
  { id: "perfect_performance",   label: "A Perfect Performance?" },
  { id: "wish_in_imax",          label: "A Film You Wish Was In Imax?" },
];

// helper for quick lookups
export const TASTE_BY_ID = Object.fromEntries(
  TASTE_QUESTIONS.map(q => [q.id, q])
);
