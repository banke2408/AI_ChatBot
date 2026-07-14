import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const res = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: "Hello"
    });
    console.log("Success SINGLE gemini-embedding-2!");
  } catch (err) {
    console.error("Error SINGLE gemini-embedding-2:", err.message);
  }
}
test();
