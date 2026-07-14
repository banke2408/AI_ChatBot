import dotenv from "dotenv";
dotenv.config();
async function test() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key=${process.env.GEMINI_API_KEY}`;
  const requests = [];
  for (let i = 0; i < 90; i++) {
    requests.push({ model: "models/gemini-embedding-2", content: { parts: [{text: "hello"}] } });
  }
  const res1 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }) });
  console.log("Req 1:", res1.ok);
  const res2 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }) });
  if (!res2.ok) console.log("Req 2 error:", await res2.text());
  else console.log("Req 2 OK");
}
test();
