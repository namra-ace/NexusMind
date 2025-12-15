const Project = require('../models/Project');
const pinecone = require('../config/pinecone');
const { PineconeStore } = require('@langchain/pinecone');
// We keep LangChain ONLY for Vector Search (Embedding Model)
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { TaskType } = require("@google/generative-ai");

// ✅ NEW SDK IMPORT
const { GoogleGenAI } = require("@google/genai");

exports.chatWithProject = async (req, res) => {
  try {
    const { projectId, message } = req.body;
    const userId = req.user.id;

    // 1. Input Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: "Please provide a valid 'message' string." });
    }
    if (!projectId) {
      return res.status(400).json({ message: "Project ID is required." });
    }

    // 2. Validate Project
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    console.log(`🤖 Chatting with project: ${project.name}`);

    // 3. RETRIEVAL (Search Pinecone using LangChain)
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
    
    if (!results || results.length === 0) {
      return res.json({ 
        answer: "I checked the document but couldn't find any relevant information.",
        sources: []
      });
    }

    const context = results.map((doc) => doc.pageContent).join('\n\n');

    // 4. GENERATION (Using the NEW @google/genai SDK)
    
    // Initialize the new client
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

    const finalPrompt = `
      You are NexusMind, an expert AI Tutor.
      Answer the user's question based strictly on the context below.

      ----------------
      CONTEXT:
      ${context}
      ----------------

      USER QUESTION: 
      ${message}
      
      INSTRUCTIONS:
      - Answer in Markdown format.
      - If the answer is not in the context, say "I cannot find that information in the document."
    `;

    // ✅ Call the new API
    // You can swap "gemini-1.5-flash" with "gemini-2.0-flash-exp" or "gemini-1.5-pro" easily here.
    const response = await ai.models.generateContent({
      model: "gemini-robotics-er-1.5-preview", 
      contents: [
        { 
          role: "user", 
          parts: [{ text: finalPrompt }] 
        }
      ],
    });

    const answerText = response.text; 

    // 5. Send Response
    res.json({
      answer: answerText,
      sources: results.map(doc => ({ text: doc.pageContent.substring(0, 50) + "..." })) 
    });

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ message: error.message || "AI Generation Failed" });
  }
};