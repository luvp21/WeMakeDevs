// Real Hinglish register examples for the script-gen prompt. Per CLAUDE.md #5:
// without concrete examples the model defaults to stiff, formal Hindi instead
// of natural code-switching.
export const HINGLISH_EXAMPLE_LINES = [
  "Toh yahan pe dekho, humne ek async function banaya hai jo API se data fetch karta hai.",
  "Basically iska matlab hai ki jab tak promise resolve nahi hota, tab tak loading state true rahegi.",
  "Ab is line pe focus karo — yahi wo checkpoint hai jahan se actual magic start hoti hai.",
  "Simple si baat hai: agar user authenticated nahi hai, toh hum unhe seedha login page pe redirect kar dete hain.",
  "Chaliye ab dekhte hain ki ye component kaise render hota hai, step by step samjhte hain.",
  "Ek second, isko thoda break down karte hain — pehle state initialize hoti hai, fir effect trigger hota hai.",
  "Yahan pe interesting cheez ye hai ki error handling already built in hai, toh crash hone ka chance kaafi kam hai.",
] as const;
