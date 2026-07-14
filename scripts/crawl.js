#!/usr/bin/env node
/**
 * PDACEK Website Crawler & Indexer
 * ---------------------------------
 * Crawls pdacek.ac.in, extracts text from HTML pages & PDFs,
 * chunks content, generates Gemini embeddings, and saves
 * everything to data/vector_store.json.
 *
 * Usage:  node scripts/crawl.js
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from "fs";
import * as cheerio from "cheerio";
import dns from "dns";
import { GoogleGenAI } from "@google/genai";

// Force IPv4
dns.setDefaultResultOrder("ipv4first");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

dotenv.config({ path: join(ROOT, ".env") });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/* ═══════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════ */

const BASE_URL = "https://pdacek.ac.in";
const CHUNK_SIZE = 500;   // words per chunk
const CHUNK_OVERLAP = 50; // word overlap
const EMBED_MODEL = "gemini-embedding-2";
// Gemini accepts up to 100 requests in batchEmbedContents. Keeping this a
// little below the limit leaves room for one-off query embeddings from chat.
const EMBED_BATCH = 90;
const BATCH_DELAY = 1500;
const MAX_EMBED_RETRIES = 8;

// All known pages from the site navigation (scraped from menu)
const PAGES_TO_CRAWL = [
  "/home/index",
  "/home/Management",
  "/home/Institute",
  "/home/Administration",
  "/home/Vision-and-Mission",
  "/home/Governing-Body",
  "/home/Committees",
  "/home/Accreditations",
  "/home/IQAC-About",
  "/home/Mandatory-Disclosure",
  "/home/Programs-Offered",
  "/home/Eligibility-Criteria",
  "/home/Fee-Structure",
  "/home/Admission-Application-Forms",
  "/home/Prospectus",
  "/home/Civil-Engineering-Overview",
  "/home/Mechanical-Engineering-Overview",
  "/home/Electrical-and-Electronics-Engineering-Overview",
  "/home/Electronics-and-Communication-Engineering-Overview",
  "/home/Industrial-and-Production-Engineering-Overview",
  "/home/Electronics-and-Instrumentation-Engineering-Overview",
  "/home/Architecture-Overview",
  "/home/Ceramic-and-Cement-Technology-Overview",
  "/home/Computer-Science-and-Engineering-Overview",
  "/home/Automobile-Engineering-Overview",
  "/home/Information-Science-and-Engineering-Overview",
  "/home/Computer-Science-and-Design-Overview",
  "/home/Artificial-Intelligence-and-Machine-Learning-Overview",
  "/home/Physics-Overview",
  "/home/Chemistry-Overview",
  "/home/Mathematics-Overview",
  "/home/Humanities-and-Social-Science-Overview",
  "/home/Academic-Regulations",
  "/home/Code-of-Conduct",
  "/home/I-Year-BE-Curriculum",
  "/home/Calendar-of-Events",
  "/home/Academic-Council",
  "/home/Board-of-Studies",
  "/home/Academic-Notifications",
  "/home/About-Examination",
  "/home/Autonomous-Evaluation-Systems",
  "/home/Semester-End-Examination",
  "/home/Exam-Timetables",
  "/home/Exam-Circulars",
  "/home/Results",
  "/home/Malpractice-Rules-and-Regulations",
  "/home/Graduation-Day",
  "/home/Medals-and-Awards-Rank-List",
  "/home/Research-Overview",
  "/home/Funded-Research-Project",
  "/home/MoUs-with-Industries-and-Research-Center",
  "/home/Research-Publications",
  "/home/Research-Patents",
  "/home/Research-Consultancy",
  "/home/PDA-NISP-About",
  "/home/PDA-IIC-About",
  "/home/About-Library",
  "/home/Hostel",
  "/home/About-Sports",
  "/home/About-Campus-Wide-Network",
  "/home/Other-Facilities",
  "/home/About-Placement-Cell",
  "/home/Placement-Training",
  "/home/Placement-Staff",
  "/home/Placement-Statistics",
  "/home/Placement-Recruiting-Companies",
  "/home/Placement-Contact-Us",
  "/home/About-TEQIP-III",
  "/home/NIRF",
];

/* ═══════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════ */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch a URL with retries */
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PDACEK-Chatbot-Crawler/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i < retries - 1) {
        console.warn(`  ⚠️  Retry ${i + 1} for ${url}: ${err.message}`);
        await wait(2000);
      } else {
        throw err;
      }
    }
  }
}

/** Extract clean text from HTML */
function extractText(html, url) {
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer, error divs
  $("script, style, noscript, nav, footer, .news-bar, marquee, .header").remove();
  $('div[style*="border:1px solid #990000"]').remove(); // PHP error blocks

  // Get page title
  const titleEl = $("h2, h3, .section-title, .page-title").first();
  const title = titleEl.text().trim() || $("title").text().split(" - ").pop()?.trim() || "PDACEK Page";

  // Get main content text
  const mainContent = $(".main-content, .container, #content, body");
  let text = mainContent.text()
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Extract PDF links. The college site uses a mixture of absolute URLs,
  // relative URLs, uppercase extensions, and query strings on PDF links.
  const pdfLinks = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && /\.pdf(?:[?#]|$)/i.test(href)) {
      const pdfUrl = new URL(href, url).href;
      const linkText = $(el).text().trim() || "PDF Document";
      pdfLinks.push({ url: pdfUrl, title: linkText });
    }
  });

  return { title, text, pdfLinks };
}

/** Chunk text into pieces */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= chunkSize) return [text];

  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const end = Math.min(i + chunkSize, words.length);
    chunks.push(words.slice(i, end).join(" "));
    i += chunkSize - overlap;
    if (i >= words.length) break;
  }
  return chunks;
}

/** Extract individual PDF pages so answers can cite a page number. */
async function extractPdfPages(pdfParse, buffer) {
  const pages = [];
  const result = await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      });
      let lastY;
      let text = "";
      for (const item of textContent.items) {
        text += lastY === item.transform[5] || !lastY ? item.str : `\n${item.str}`;
        lastY = item.transform[5];
      }
      pages.push(text);
      return text;
    },
  });

  return pages.length ? pages : (result.text ? [result.text] : []);
}

function retryDelayMs(response, responseText, attempt) {
  const retryAfter = response?.headers?.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }

  // Gemini may return a google.rpc.RetryInfo object such as
  // {"retryDelay":"56s"}. Respect it when present.
  const retryMatch = responseText?.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
  if (retryMatch) return Math.ceil(Number(retryMatch[1]) * 1000);

  // A quota limit uses a rolling minute window. Waiting a full minute avoids
  // repeatedly spending the retry budget on the same quota window.
  if (response?.status === 429) return 65_000;

  return Math.min(2_000 * 2 ** attempt, 30_000);
}

/** Generate embeddings in correctly-sized REST batches. */
async function generateEmbeddings(texts) {
  const results = [];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${API_KEY}`;

  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batchTexts = texts.slice(i, i + EMBED_BATCH);
    const requests = batchTexts.map(text => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text: text.slice(0, 8000) }] }
    }));

    let batchEmbeddings = null;
    let lastError = null;
    for (let attempt = 0; attempt < MAX_EMBED_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests })
        });

        if (!res.ok) {
          const responseText = await res.text();
          const delay = retryDelayMs(res, responseText, attempt);
          throw Object.assign(
            new Error(`HTTP ${res.status}: ${responseText.slice(0, 300)}`),
            { retryDelay: delay }
          );
        }

        const data = await res.json();
        if (data.embeddings?.length === batchTexts.length && data.embeddings.every((embedding) => Array.isArray(embedding.values) && embedding.values.length > 0)) {
          batchEmbeddings = data.embeddings.map((embedding) => embedding.values);
          break;
        }
        throw new Error(`Expected ${batchTexts.length} embeddings but received ${data.embeddings?.length ?? 0}`);
      } catch (err) {
        lastError = err;
        if (attempt === MAX_EMBED_RETRIES - 1) break;

        const delay = err.retryDelay ?? retryDelayMs(null, null, attempt);
        console.warn(`  ⚠️  Embedding batch ${i + 1}-${i + batchTexts.length} failed; retrying in ${Math.ceil(delay / 1000)}s (${err.message?.slice(0, 120)})`);
        await wait(delay);
      }
    }

    if (!batchEmbeddings) {
      throw new Error(`Embedding batch ${i + 1}-${i + batchTexts.length} failed after ${MAX_EMBED_RETRIES} attempts: ${lastError?.message}`);
    }
    results.push(...batchEmbeddings);

    console.log(`  📊 Embedded ${Math.min(i + EMBED_BATCH, texts.length)}/${texts.length} chunks`);
    if (i + EMBED_BATCH < texts.length) {
      await wait(BATCH_DELAY);
    }
  }

  return results;
}

/* ═══════════════════════════════════════════
   MAIN CRAWL PIPELINE
   ═══════════════════════════════════════════ */

async function main() {
  console.log("\n🕷️  PDACEK Website Crawler & Indexer");
  console.log("════════════════════════════════════\n");

  const allChunks = [];
  const pdfsSeen = new Set();
  let pagesSuccess = 0;
  let pagesFailed = 0;

  // ── Step 1: Crawl HTML pages ──
  console.log(`📄 Crawling ${PAGES_TO_CRAWL.length} pages from pdacek.ac.in...\n`);

  for (const path of PAGES_TO_CRAWL) {
    const url = `${BASE_URL}${path}`;
    try {
      const res = await fetchWithRetry(url);
      const html = await res.text();
      const { title, text, pdfLinks } = extractText(html, url);

      // Skip pages with "page not found" or very little content
      if (text.length < 100 || text.includes("page you requested could not be found")) {
        console.log(`  ⏭️  ${path} — skipped (no content)`);
        pagesFailed++;
        continue;
      }

      // Chunk the text
      const chunks = chunkText(text);
      for (const chunk of chunks) {
        if (chunk.trim().length > 50) {
          allChunks.push({
            text: chunk.trim(),
            source_url: url,
            source_title: title,
            type: "official",
          });
        }
      }

      // Collect PDF links
      for (const pdf of pdfLinks) {
        if (!pdfsSeen.has(pdf.url)) pdfsSeen.add(pdf.url);
      }

      console.log(`  ✅ ${path} — ${chunks.length} chunks (${text.length} chars)`);
      pagesSuccess++;
      await wait(500); // Be polite to the server
    } catch (err) {
      console.log(`  ❌ ${path} — ${err.message?.slice(0, 60)}`);
      pagesFailed++;
    }
  }

  // ── Step 2: Crawl PDFs ──
  const pdfList = Array.from(pdfsSeen);
  if (pdfList.length > 0) {
    console.log(`\n📑 Found ${pdfList.length} PDF links. Attempting to parse...\n`);

    for (const pdfUrl of pdfList) { // Process all PDFs
      try {
        const res = await fetchWithRetry(pdfUrl);
        const buffer = await res.arrayBuffer();

        const pdfParse = (await import("pdf-parse")).default;
        const pages = await extractPdfPages(pdfParse, Buffer.from(buffer));
        let pdfChunks = 0;

        for (const [index, pageText] of pages.entries()) {
          if (!pageText || pageText.trim().length <= 50) continue;
          const chunks = chunkText(pageText.trim());
          for (const chunk of chunks) {
            if (chunk.trim().length > 50) {
              allChunks.push({
                text: chunk.trim(),
                source_url: pdfUrl,
                source_title: pdfUrl.split("/").pop() || "PDF Document",
                type: "official_pdf",
                page: index + 1,
              });
              pdfChunks++;
            }
          }
        }
        if (pdfChunks) console.log(`  ✅ ${pdfUrl.split("/").pop()} — ${pdfChunks} chunks`);
        await wait(1500); // Increased wait to prevent rate limits from pdacek server
      } catch (err) {
        console.log(`  ⏭️  ${pdfUrl.split("/").pop()} — skipped (${err.message?.slice(0, 40)})`);
      }
    }
  }

  console.log(`\n📊 Summary: ${pagesSuccess} pages crawled, ${pagesFailed} skipped, ${allChunks.length} total chunks\n`);

  if (allChunks.length === 0) {
    console.error("❌ No chunks were extracted! Check network connectivity.");
    process.exit(1);
  }

  // ── Step 3: Generate embeddings ──
  console.log(`🧠 Generating embeddings with ${EMBED_MODEL}...\n`);

  const texts = allChunks.map((c) => c.text);
  const embeddings = await generateEmbeddings(texts);

  // Filter out chunks with failed embeddings
  const indexedChunks = [];
  for (let i = 0; i < allChunks.length; i++) {
    if (embeddings[i]) {
      indexedChunks.push({
        id: `chunk_${String(i).padStart(4, "0")}`,
        ...allChunks[i],
        embedding: embeddings[i],
      });
    }
  }

  if (indexedChunks.length < allChunks.length * 0.8) {
    console.error(`❌ Too many embedding failures (${indexedChunks.length}/${allChunks.length}). Aborting to prevent data wipe.`);
    process.exit(1);
  }

  const embeddingDim = indexedChunks[0]?.embedding?.length || 0;
  if (!embeddingDim || indexedChunks.some((chunk) => chunk.embedding.length !== embeddingDim)) {
    throw new Error("Embedding response has inconsistent dimensions. Existing vector store was left untouched.");
  }

  // ── Step 4: Save vector store ──
  const dataDir = join(ROOT, "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const vectorStore = {
    chunks: indexedChunks,
    metadata: {
      last_crawled: new Date().toISOString(),
      total_chunks: indexedChunks.length,
      total_pages: pagesSuccess,
      embedding_model: EMBED_MODEL,
      embedding_dim: embeddingDim,
    },
  };

  const storePath = join(dataDir, "vector_store.json");
  // Do not trade a healthy index for a much smaller crawl when the college
  // server is temporarily blocking or timing out PDF requests.
  let previousChunkCount = 0;
  if (existsSync(storePath)) {
    try {
      previousChunkCount = JSON.parse(readFileSync(storePath, "utf-8"))?.chunks?.length || 0;
    } catch {
      // A corrupt old file should not prevent a validated replacement.
    }
  }
  if (previousChunkCount && indexedChunks.length < previousChunkCount * 0.8) {
    throw new Error(`New crawl coverage is too small (${indexedChunks.length} chunks vs ${previousChunkCount} existing). Existing vector store was left untouched.`);
  }

  const tempStorePath = `${storePath}.${process.pid}.tmp`;
  writeFileSync(tempStorePath, JSON.stringify(vectorStore));
  // Rename is atomic on the same filesystem: chat keeps the old index until
  // the complete new one is ready, even if this process is interrupted.
  renameSync(tempStorePath, storePath);

  const sizeMB = (Buffer.byteLength(JSON.stringify(vectorStore)) / 1024 / 1024).toFixed(1);
  console.log(`\n✅ Vector store saved: ${storePath}`);
  console.log(`   ${indexedChunks.length} chunks, ${sizeMB} MB`);
  console.log(`   Embedding dim: ${vectorStore.metadata.embedding_dim}`);
  console.log("\n🎉 Crawl complete!\n");
}

main().catch((err) => {
  console.error("\n💥 Crawler crashed:", err);
  process.exit(1);
});
