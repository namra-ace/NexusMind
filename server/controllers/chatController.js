const Project = require('../models/Project');
const pinecone = require('../config/pinecone');
const { PineconeStore } = require('@langchain/pinecone');
const { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { TaskType } = require("@google/generative-ai");

exports.chatWithProject = async (req, res) => {
  try {
    const { projectId, message } = req.body;
    const userId = req.user.id;

    // 1. INPUT VALIDATION
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

    // 3. Init Vector Store (Must match ingestion model)
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

    // 4. Search Pinecone
    const results = await vectorStore.similaritySearch(message, 3);
    
    if (!results || results.length === 0) {
      return res.json({ 
        answer: "I couldn't find any relevant context in this document to answer your question.",
        sources: []
      });
    }

    const context = results.map((doc) => doc.pageContent).join('\n\n');

    // 5. Generate Answer
    // FIX: Changed 'modelName' to 'model'
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash", 
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.7,
    });

    const prompt = `
      You are an intelligent assistant. Answer the user's question based ONLY on the context provided below.
      If the answer is not in the context, strictly say "I cannot find that information in the document."
      
      Context from Document:
      ${context}

      User Question: 
      ${message}
    `;

    const response = await model.invoke(prompt);

    res.json({
      answer: response.content,
      sources: results.map(doc => ({ text: doc.pageContent.substring(0, 50) + "..." })) 
    });

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ message: error.message });
  }
};