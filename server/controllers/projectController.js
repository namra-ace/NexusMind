const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const Project = require('../models/Project');
const pinecone = require('../config/pinecone');

// --- 🔧 PDF PARSE FIX 🔧 ---
const { PDFParse } = require('pdf-parse'); 

// LangChain Imports
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { PineconeStore } = require('@langchain/pinecone');
const { TaskType } = require("@google/generative-ai"); // Required for correct embedding generation

// Helper: Download file from Supabase as a Buffer
const downloadFromSupabase = async (filePath) => {
  const { data, error } = await supabase.storage
    .from('nexusmind-uploads') 
    .download(filePath);

  if (error) {
    console.error("❌ SUPABASE ERROR:", JSON.stringify(error, null, 2));
    throw new Error(`Supabase Download Error: ${error.message || 'Unknown Error'}`);
  }
  
  return Buffer.from(await data.arrayBuffer());
};

// @desc    Get a secure upload URL
// @route   POST /api/projects/upload-url
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

// @desc    Create Project & Ingest Files (The "Brain" Trigger)
// @route   POST /api/projects
exports.createProject = async (req, res) => {
  try {
    const { name, fileKeys } = req.body;
    const userId = req.user.id;

    if (!fileKeys || fileKeys.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    const pineconeNamespace = uuidv4();
    
    const project = await Project.create({
      name,
      userId,
      fileKeys,
      pineconeNamespace,
    });

    console.log(`🚀 Starting ingestion for project: ${project.name}`);

    // --- 🔧 EMBEDDING MODEL FIX 🔧 ---
    // We use 'text-embedding-004' which outputs 768 dimensions natively.
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004", 
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      apiKey: process.env.GOOGLE_API_KEY
    });

    const pineconeIndex = pinecone.Index("nexusmind");

    for (const fileKey of fileKeys) {
      console.log(`Processing file: ${fileKey}`);

      const buffer = await downloadFromSupabase(fileKey);
      
      // --- 🔧 PDF PARSING LOGIC 🔧 ---
      let rawText = "";
      try {
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        rawText = pdfData.text;
        
        if (parser.destroy) await parser.destroy();
        
        console.log(`📄 Text extracted: ${rawText.substring(0, 100).replace(/\n/g, ' ')}...`);
      } catch (parseError) {
        console.error("❌ PDF Parse Error:", parseError);
        throw new Error("Failed to parse PDF text");
      }

      // 2. Chunk Text
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const docs = await splitter.createDocuments([rawText]);
      console.log(`File split into ${docs.length} chunks`);

      // 3. Store in Pinecone
      await PineconeStore.fromDocuments(docs, embeddings, {
        pineconeIndex,
        namespace: pineconeNamespace, 
      });
    }

    console.log(`✅ Ingestion Complete for Namespace: ${pineconeNamespace}`);

    res.status(201).json({ 
      success: true, 
      project, 
      message: "Project created and documents embedded successfully!" 
    });

  } catch (error) {
    console.error("Ingestion Error:", error);
    res.status(500).json({ message: error.message });
  }
};