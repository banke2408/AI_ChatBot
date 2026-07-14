import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const res = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: Array(100).fill("test string")
    });
    console.log(`✅ Success! The new API (gemini-embedding-2) works perfectly! Generated ${res.embeddings.length} embeddings in a single request.`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}
test();
