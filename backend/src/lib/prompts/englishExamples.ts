// Register examples for English scripts. The same reason as the Hinglish set:
// without concrete lines the model drifts into stiff, brochure-style English
// instead of how a developer talks a viewer through their own project. They are
// also the spoken style in miniature: short, plain, no dashes or colons.
export const ENGLISH_EXAMPLE_LINES = [
  "Every time someone signed up, we sent the welcome email right there in the request. That made signing up slow.",
  "This function takes text like two days and gives you back the number of milliseconds.",
  "Now look at this line. This is where the real work happens.",
  "If the user isn't signed in, we send them straight to the login page.",
  "The component draws itself in two steps. First it reads the props, then it builds the markup.",
  "The state is set up first. Then the effect runs.",
  "Bad input can't crash the app, because the error handling is already built in.",
] as const;
