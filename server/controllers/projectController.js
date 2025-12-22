const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const Project = require('../models/Project');
const pinecone = require('../config/pinecone');
const { PDFParse } = require('pdf-parse'); 
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { PineconeStore } = require('@langchain/pinecone');
const { TaskType } = require("@google/generative-ai");
const { GoogleGenAI } = require("@google/genai");

// Helper: Download file from Supabase
const downloadFromSupabase = async (filePath) => {
  const { data, error } = await supabase.storage
    .from('nexusmind-uploads') 
    .download(filePath);

  if (error) throw new Error(`Supabase Download Error: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
};

exports.getUploadUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileName } = req.body;
    const uniqueFileName = `${uuidv4()}-${fileName}`;
    const filePath = `users/${userId}/${uniqueFileName}`;
    res.json({ filePath, fileName: uniqueFileName });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    const { name, fileKeys } = req.body;
    const userId = req.user.id;

    if (!fileKeys || fileKeys.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    const pineconeNamespace = uuidv4();
    
    // 1. Create Project Entry
    const project = await Project.create({
      name,
      userId,
      fileKeys,
      pineconeNamespace,
      masterSummary: "Analyzing document... check back in a few minutes.", 
    });

    res.status(201).json({ 
      success: true, 
      project, 
      message: "Project created! Deep analysis started in background." 
    });

    // ---------------------------------------------------------
    // 🚀 BACKGROUND PROCESS (Custom Map-Reduce)
    // ---------------------------------------------------------
    (async () => {
      try {
        console.log(`🧠 [Background] Starting Deep Analysis for ${project.name}...`);

        const embeddings = new GoogleGenerativeAIEmbeddings({
          model: "text-embedding-004", 
          taskType: TaskType.RETRIEVAL_DOCUMENT,
          apiKey: process.env.GOOGLE_API_KEY
        });
        const pineconeIndex = pinecone.Index("nexusmind");

        let allTextChunks = [];

        // A. Extract & Embed
        for (const fileKey of fileKeys) {
          const buffer = await downloadFromSupabase(fileKey);
          let rawText = "";
          
          try {
            const parser = new PDFParse({ data: buffer });
            const pdfData = await parser.getText();
            rawText = pdfData.text;
          } catch (e) {
            console.error("PDF Parse Error:", e);
            continue;
          }

          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
          });
          const docs = await splitter.createDocuments([rawText]);
          
          // Collect text content for summarization
          docs.forEach(d => allTextChunks.push(d.pageContent));

          // Store vectors
          await PineconeStore.fromDocuments(docs, embeddings, {
            pineconeIndex,
            namespace: pineconeNamespace, 
          });
        }

        // B. Custom Map-Reduce Summarization
        console.log(`🧠 [Background] Summarizing ${allTextChunks.length} chunks...`);
        
        // 1. MAP STEP: Summarize chunks in batches
        const chunkSize = 5; 
        let sectionSummaries = [];
        
        // Initialize New SDK Client
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

        for (let i = 0; i < allTextChunks.length; i += chunkSize) {
          const batch = allTextChunks.slice(i, i + chunkSize).join("\n\n");
          
          const prompt = `Summarize these excerpts from a document into a concise paragraph:\n\n${batch}`;
          
          try {
            // ✅ CORRECT SYNTAX FOR NEW SDK
            const result = await ai.models.generateContent({
              model: "gemma-3-1b", 
              contents: [{ role: "user", parts: [{ text: prompt }] }]
            });
            
            // New SDK returns text via .text() method usually
            const text = result.response.text;
            sectionSummaries.push(text);
            process.stdout.write("."); // Progress dot
          } catch (e) {
            console.error("Batch error", e.message);
          }
        }
        console.log("\n✅ Section summaries complete.");

        // 2. REDUCE STEP: Create Final Master Summary
        const finalPrompt = `
          You are an expert researcher. 
          Below are summaries of different sections of a document. 
          Create a detailed "Master Summary" of the entire document based on these notes.
          
          NOTES:
          ${sectionSummaries.join("\n\n")}
          
          OUTPUT FORMAT:
          - Main Theme
          - Key Concepts (Bullet points)
          - Conclusion
        `;
        
        // ✅ CORRECT SYNTAX FOR NEW SDK
        const finalResult = await ai.models.generateContent({
          model: "gemma-3-1b", 
          contents: [{ role: "user", parts: [{ text: finalPrompt }] }]
        });

        const masterSummary = finalResult.response.text;

        // C. Update Database
        project.masterSummary = masterSummary;
        await project.save();
        
        console.log(`✅ [Background] Analysis Complete for ${project.name}`);

      } catch (bgError) {
        console.error("❌ [Background] Error:", bgError);
      }
    })();
    // ---------------------------------------------------------

  } catch (error) {
    console.error("Ingestion Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};

exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;
    const project = await Project.findOne({ _id: projectId, userId });
    
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const pineconeIndex = pinecone.Index("nexusmind");
    try { await pineconeIndex.namespace(project.pineconeNamespace).deleteAll(); } catch (e) {}

    if (project.fileKeys.length > 0) {
      await supabase.storage.from('nexusmind-uploads').remove(project.fileKeys);
    }

    await Project.deleteOne({ _id: projectId });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};