// Real Hinglish register examples for the script-gen prompt. Per CLAUDE.md #5:
// without concrete examples the model defaults to stiff, formal Hindi instead
// of natural code-switching.
export const HINGLISH_EXAMPLE_LINES = [
  "Toh yahan dekho, humne ek async function banaya hai jo API se data fetch karta hai.",
  "Matlab jab tak promise resolve nahi hota, loading state true rehti hai.",
  "Ab is line pe dhyaan do. Yahin se asli kaam shuru hota hai.",
  "Baat simple hai. Agar user login nahi hai, toh hum use seedha login page pe bhej dete hain.",
  "Ye component do steps mein render hota hai. Pehle props padhta hai, phir markup banata hai.",
  "Pehle state set hoti hai. Phir effect chalta hai.",
  "Yahan error handling pehle se hai, isliye galat input aane pe bhi app crash nahi hota.",
] as const;
