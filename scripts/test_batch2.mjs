import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(
      ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: "hello " + i
      })
    );
  }
  try {
    const res = await Promise.all(promises);
    console.log("Success all 50 concurrent requests!");
  } catch(e) {
    console.error("Error:", e.message);
  }
}
test();
