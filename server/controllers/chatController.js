const Project = require('../models/Project');
const pinecone = require('../config/pinecone');
const { PineconeStore } = require('@langchain/pinecone');
// We keep LangChain ONLY for Vector Search (Embedding Model)
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { TaskType } = require("@google/generative-ai");

// ✅ NEW SDK IMPORT (Fast Generation)
const { GoogleGenAI } = require("@google/genai");

exports.chatWithProject = async (req, res) => {
  try {
    const { projectId, message } = req.body;
    const userId = req.user.id;

    // --- 1. VALIDATION ---
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: "Please provide a valid 'message' string." });
    }
    if (!projectId) {
      return res.status(400).json({ message: "Project ID is required." });
    }

    // --- 2. GET PROJECT DATA ---
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    console.log(`🤖 Chatting with project: ${project.name}`);

    // --- 3. RETRIEVAL (Search Pinecone for Specific Details) ---
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      taskType: TaskType.RETRIEVAL_QUERY, 
      apiKey: process.env.GOOGLE_API_KEY
    });

    const pineconeIndex = pinecone.Index("nexusmind");

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace: project.pineconeNamespace, 
    });

    // Search for top 3 relevant chunks
    const results = await vectorStore.similaritySearch(message, 3);
    
    // Prepare Specific Context
    const specificContext = results.map((doc) => doc.pageContent).join('\n\n');

    // --- 4. PREPARE GLOBAL CONTEXT (The "Brain") ---
    // If the background job hasn't finished yet, use a placeholder.
    const masterSummary = project.masterSummary || "Full document analysis is still in progress...";

    // --- 5. GENERATION (Using the NEW @google/genai SDK) ---
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

    const finalPrompt = `
      You are NexusMind, an expert AI Tutor and Research Assistant.
      
      You have two sources of information to answer the user:
      1. **GLOBAL SUMMARY**: An overview of the entire document (Context A).
      2. **SPECIFIC EXCERPTS**: Exact text segments relevant to the user's question (Context B).

      ----------------
      (A) GLOBAL DOCUMENT SUMMARY:
      ${masterSummary}
      ----------------
      (B) SPECIFIC EXCERPTS:
      ${specificContext}
      ----------------

      USER QUESTION: 
      ${message}
      
      INSTRUCTIONS:
      - Combine the **Global Summary** (for high-level understanding) with the **Specific Excerpts** (for precise details).
      - If the Global Summary says "analysis is still in progress", explicitly tell the user: "I am still reading the full book in the background, but I can answer based on the excerpts I found."
      - **Format**: Use Markdown. Use **Bold** for key terms. Use Bullet points for lists.
      - **Tone**: Educational, professional, and detailed.
      - If the answer is not in either context, say "I cannot find that information in the document."
    `;

    // Call Gemini 1.5 Flash
    const response = await ai.models.generateContent({
      model: "gemmna-3-1b", 
      contents: [
        { 
          role: "user", 
          parts: [{ text: finalPrompt }] 
        }
      ],
    });

    const answerText = response.text; 

    // --- 6. SEND RESPONSE ---
    res.json({
      answer: answerText,
      // Return the sources so the frontend could optionally show them later
      sources: results.map(doc => ({ text: doc.pageContent.substring(0, 50) + "..." })) 
    });

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ message: error.message || "AI Generation Failed" });
  }
};