/**
 * RAG Retrieval Engine for PDACEK Chatbot
 * ----------------------------------------
 * Loads the vector store, generates query embeddings,
 * and retrieves the most relevant chunks via cosine similarity.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VECTOR_STORE_PATH = join(__dirname, "data", "vector_store.json");
const DEFAULT_EMBED_MODEL = "gemini-embedding-001";
const TOP_K = 6; // number of chunks to retrieve

/* ═══════════════════════════════════════════
   VECTOR STORE
   ═══════════════════════════════════════════ */

let vectorStore = null;

/** Load or reload the vector store from disk */
export function loadVectorStore() {
  if (!existsSync(VECTOR_STORE_PATH)) {
    console.warn("⚠️  Vector store not found. Run 'node scripts/crawl.js' first.");
    vectorStore = { chunks: [], metadata: {} };
    return false;
  }
  const raw = readFileSync(VECTOR_STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.chunks) || !parsed.chunks.every((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)) {
    console.warn("⚠️  Vector store is invalid. Keeping RAG disabled until a successful crawl completes.");
    vectorStore = { chunks: [], metadata: {} };
    return false;
  }
  vectorStore = parsed;
  console.log(
    `📚 RAG: Loaded ${vectorStore.chunks.length} chunks from vector store ` +
    `(crawled: ${vectorStore.metadata.last_crawled || "unknown"})`
  );
  return true;
}

/** Get the loaded vector store (for status checks) */
export function getVectorStoreMetadata() {
  return vectorStore?.metadata || {};
}

/* ═══════════════════════════════════════════
   COSINE SIMILARITY
   ═══════════════════════════════════════════ */

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

function cosineSimilarity(a, b) {
  const dp = dotProduct(a, b);
  const m = magnitude(a) * magnitude(b);
  return m === 0 ? 0 : dp / m;
}

/* ═══════════════════════════════════════════
   RETRIEVAL
   ═══════════════════════════════════════════ */

/**
 * Retrieve the most relevant chunks for a user query.
 *
 * @param {GoogleGenAI} ai - Initialized GoogleGenAI instance
 * @param {string} query - The user's question
 * @param {number} topK - Number of chunks to return
 * @returns {{ chunks: Array, confidence: number, hasOfficialData: boolean }}
 */
export async function retrieveChunks(ai, query, topK = TOP_K) {
  if (!vectorStore || vectorStore.chunks.length === 0) {
    return { chunks: [], confidence: 0, hasOfficialData: false };
  }

  // Generate query embedding
  let queryEmbedding;
  try {
    // The query must be embedded with exactly the model that created the
    // index. Mixing embedding models makes cosine similarity meaningless.
    const embedModel = vectorStore.metadata?.embedding_model || DEFAULT_EMBED_MODEL;
    const res = await ai.models.embedContent({
      model: embedModel,
      contents: [{ parts: [{ text: query }] }],
    });
    queryEmbedding = res.embeddings[0].values;
  } catch (err) {
    console.error("❌ RAG: Query embedding failed:", err.message);
    return { chunks: [], confidence: 0, hasOfficialData: false };
  }

  // Calculate similarity scores
  const scored = vectorStore.chunks
    .filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length === queryEmbedding.length)
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

  if (!scored.length) {
    console.error("❌ RAG: Vector-store dimensions do not match the query embedding.");
    return { chunks: [], confidence: 0, hasOfficialData: false };
  }

  // Sort by score descending and take top K
  scored.sort((a, b) => b.score - a.score);
  const topChunks = scored.slice(0, topK);

  // Calculate average confidence
  const avgScore = topChunks.reduce((s, c) => s + c.score, 0) / topChunks.length;

  // Deduplicate sources
  return {
    chunks: topChunks.map((c) => ({
      text: c.text,
      source_url: c.source_url,
      source_title: c.source_title,
      type: c.type,
      page: Number.isInteger(c.page) ? c.page : null,
      score: Math.round(c.score * 1000) / 1000,
    })),
    confidence: Math.round(avgScore * 1000) / 1000,
    hasOfficialData: avgScore > 0.3,
  };
}

/**
 * Build the context string from retrieved chunks for the AI prompt.
 */
export function buildContext(retrievalResult) {
  if (!retrievalResult.chunks.length) {
    return {
      contextText: "",
      sources: [],
    };
  }

  // Build context text
  const contextParts = retrievalResult.chunks.map((c, i) => {
    const label = c.type === "official_pdf" ? "📄 PDF" : "🌐 Official Page";
    const page = c.page ? `, page ${c.page}` : "";
    return `[Source ${i + 1}: ${label} — ${c.source_title}${page}]\n${c.text}`;
  });

  // Extract unique sources
  const sourceMap = new Map();
  for (const c of retrievalResult.chunks) {
    if (!sourceMap.has(c.source_url)) {
      sourceMap.set(c.source_url, {
        title: c.source_title,
        url: c.source_url,
        type: c.type === "official_pdf" ? "official_pdf" : "official",
        pages: new Set(),
      });
    }
    if (c.page) sourceMap.get(c.source_url).pages.add(c.page);
  }

  return {
    contextText: contextParts.join("\n\n---\n\n"),
    sources: Array.from(sourceMap.values()).map((source) => ({
      ...source,
      pages: Array.from(source.pages).sort((a, b) => a - b),
    })),
  };
}
