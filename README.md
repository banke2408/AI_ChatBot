# PDA College of Engineering — AI Campus Guide 🤖🎓

A full-stack Retrieval-Augmented Generation (RAG) chatbot designed specifically for **P.D.A. College of Engineering, Kalaburagi**. This AI assistant acts as a virtual campus guide, capable of answering detailed questions about the college, fee structures, curriculums, placements, and more by dynamically crawling and reading the college's official website and PDFs.

## 🌟 Features

- **Intelligent RAG Chatbot:** Uses Google's advanced Gemini models (`gemini-2.5-pro` / `gemini-2.5-flash`) to generate accurate, context-aware answers.
- **Automated Web & PDF Crawler:** An admin-triggered background crawler (`scripts/crawl.js`) that scrapes `pdacek.ac.in`, downloads all official PDFs (prospectus, syllabi, NIRF data), and extracts their text.
- **Custom Vector Database:** Embeddings are generated via the `gemini-embedding-2` REST API and stored locally in a highly optimized `vector_store.json`.
- **Admin Dashboard:** A secure `/admin` panel to monitor crawler logs, view the vector database size, and manually trigger a re-crawl.
- **Modern Glassmorphism UI:** A sleek, animated frontend featuring floating particles, quick-action suggestion chips, and a responsive chat interface.

---

## 🏗️ Project Architecture & Workflow

How does the AI know about the college? Here is the step-by-step flow:

### 1. Data Ingestion (The Crawler)
- **Trigger:** The Admin clicks "Re-Crawl Website" in the dashboard.
- **Scraping:** The Node.js crawler navigates `pdacek.ac.in`, extracting text from HTML pages and finding hidden `.pdf` links.
- **Parsing:** It downloads the PDFs and extracts raw text using `pdf-parse`.
- **Chunking:** The text is split into small 500-word chunks so the AI can digest it easily.

### 2. Embedding (Vector Database)
- **Vectorization:** Each text chunk is sent to the **Gemini Embedding API** (`gemini-embedding-2`). To bypass free-tier rate limits (100 requests/min), the script batches 90 chunks into a single REST API call and carefully paces itself with a 65-second delay.
- **Storage:** The resulting embeddings (arrays of numbers) are saved locally into `data/vector_store.json`.

### 3. Retrieval & Generation (RAG)
- **User Query:** A student asks a question like *"What is the fee structure for CS?"* on the frontend.
- **Query Embedding:** The backend converts the student's question into a vector using the same Gemini model.
- **Cosine Similarity:** The system mathematically compares the question vector against the 600+ chunks in the vector database to find the 5 most relevant pieces of text from the college website/PDFs.
- **Prompting:** The backend sends the student's question *along with the retrieved college text* to the **Gemini Language Model**.
- **Response:** Gemini reads the exact college data provided in the prompt and formulates a helpful, polite, and factually accurate response.

---

## 🚀 How to Run the Project Locally

### Prerequisites
- Node.js (v18+)
- A Google Gemini API Key

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/banke2408/AI_ChatBot.git
cd AI_ChatBot
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory and add your Gemini API key:
```env
PORT=3000
GEMINI_API_KEY=your_google_gemini_api_key_here
ADMIN_PASSWORD=pdacek2026
```

### 3. Start the Application
```bash
npm start
```
The server will start on `http://localhost:3000`.

### 4. Populate the Database
Before the chatbot can answer specific questions, it needs data:
1. Go to `http://localhost:3000/admin`
2. Log in using the password (`pdacek2026`).
3. Click **"Re-Crawl Website"**.
4. The backend will begin scraping the college website and embedding PDFs. This process takes about **7–8 minutes** to safely navigate API rate limits. You can monitor progress live in the dashboard logs.

---

## 📂 Project Structure

```text
├── public/                 # Frontend Assets
│   ├── index.html          # Main Chatbot UI
│   ├── admin.html          # Admin Dashboard UI
│   ├── style.css           # Chat UI Styles (Glassmorphism)
│   ├── admin.css           # Admin Dashboard Styles
│   ├── chat.js             # Chatbot Frontend Logic
│   └── admin.js            # Admin Dashboard Logic
├── scripts/
│   └── crawl.js            # The Web/PDF Scraper & Embedder
├── data/
│   ├── vector_store.json   # Local Vector Database (Created after crawl)
│   ├── crawl.log           # Live log output from the crawler
│   ├── sources.json        # List of crawled URLs
│   └── chat_logs.db        # SQLite database for storing chat history
├── server.js               # Express Backend Server & API Routes
├── rag.js                  # RAG Logic (Cosine Similarity & Gemini API calls)
├── .env                    # Environment variables (API Key, Port)
├── package.json            # Node.js Dependencies
└── README.md               # You are here!
```

---

## 🛠️ Built With

- **Backend:** Node.js, Express.js
- **AI & Embeddings:** Google Gemini AI API (`@google/genai`), `gemini-embedding-2`, `gemini-2.5-pro`
- **Data Processing:** `pdf-parse`, `cheerio`, `axios`
- **Database:** Local JSON (Vector Store), SQLite3 (Chat Logs)
- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript, Marked.js (Markdown parsing)
