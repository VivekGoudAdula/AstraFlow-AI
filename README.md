# AI Funding Scout & Intelligence Engine
*(Lyzr x Qdrant Hackathon: Autonomous Ecosystems)*

An autonomous, high-integrity startup discovery pipeline built to analyze AI market trends and funding rounds without the hallucinations typical of LLMs. 

This engine acts as an automated venture scout: it takes a market hypothesis (e.g., "Recently funded AI developer tools"), uses **Lyzr Agents** to structure the market data, taps into **Qdrant Vector Memory** to find architectural and market similarities, and performs real-time internet verification via **Apify** to discover the true LinkedIn profiles of Founders and Marketing Leads.

## ✨ Core Features

1. **Hallucination-Free Extraction (Lyzr Agent)**  
   Data orchestration is handled by a strictly-prompted Lyzr Agent that extracts factual funding metrics, recent PR announcements, and key stakeholders without guessing or generating fake URLs.
   
2. **Server-Side Identity Verification (Apify Integration)**  
   Features a powerful dual-strategy fallback system to guarantee accurate contact details. Instead of blindly trusting LLM URL guesses, the backend securely interacts with Apify's Google Search scrapers to dynamically locate the exact LinkedIn profiles for company founders.

3. **Persistent Vector Memory (Qdrant)**  
   Companies discovered are automatically profiled and embedded into a Qdrant vector database. This allows the system to highlight hidden market trends and suggest "Similar Companies" based on high-dimensional semantic similarity of their market category, funding stage, and value propositions.

4. **Audit-Ready Data Export**  
   Automatically packages verified prospects into a multi-column, clean dataset. Provides one-click exporting to local CSVs and direct integration to append rows to a Google Sheet for venture workflows.

## 🛠️ Technology Stack

- **Frontend:** Next.js 14, React, Tailwind CSS, system component library (glassmorphism UI layout).
- **Core AI Orchestration:** Lyzr Agent API.
- **Vector Database / RAG:** Qdrant Cloud.
- **Real-Time Web Scraping:** Apify API (Google Search Scraper).
- **Data Integrations:** Google Sheets API (googleapis).

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following API credentials:
- `LYZR_API_KEY`
- `QDRANT_API_KEY` & `QDRANT_URL`
- `APIFY_API_KEY`
- Google Cloud Service Account JSON (`service-account.json`) for Sheets API

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```env
# Agent Orchestration
LYZR_API_KEY=your_lyzr_key

# Vector DB
QDRANT_URL=your_cluster_url
QDRANT_API_KEY=your_qdrant_key
QDRANT_COLLECTION_NAME=lyzr_companies

# Real-time Discovery
APIFY_API_KEY=your_apify_key

# Export integrations
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_email
GOOGLE_PRIVATE_KEY="your_private_key"
```

### 4. Running the Application
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3333](http://localhost:3333) with your browser to see the result.

## 🧠 Architecture Flow
1. **User Input:** User submits a market hypothesis to the UI.
2. **Phase 1 (Extraction):** The Lyzr Agent scans the internet for relevant news and returns a structured JSON payload of the startup, funding info, and insights on the market shift.
3. **Phase 2 (Verification):** The Next.js API route (`/api/linkedin`) intercepts the data and executes a secure Apify search to resolve the actual LinkedIn properties.
4. **Phase 3 (Vector Matching):** The clean payload is upserted to Qdrant. The system then queries the same DB to find semantically related startups previously identified in past scans.
5. **Insights:** The dashboard populates a cohesive, rich interface of the competitive landscape.

---
*Built for the Autonomous Ecosystems Lyzr x Qdrant Hackathon.*
