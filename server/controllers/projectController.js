const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const Project = require('../models/Project');
const pinecone = require('../config/pinecone');

const { PDFParse } = require('pdf-parse');

// LangChain Imports
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { PineconeStore } = require('@langchain/pinecone');
const { TaskType } = require("@google/generative-ai");

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

    // --- EMBEDDING MODEL CONFIG ---
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      apiKey: process.env.GOOGLE_API_KEY
    });

    const pineconeIndex = pinecone.Index("nexusmind");

    for (const fileKey of fileKeys) {
      console.log(`Processing file: ${fileKey}`);

      const buffer = await downloadFromSupabase(fileKey);


      let rawText = "";
      try {
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        rawText = pdfData.text;

        if (parser.destroy) await parser.destroy();

      } catch (parseError) {
        console.error("❌ PDF Parse Error:", parseError);
        throw new Error("Failed to parse PDF text");
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const docs = await splitter.createDocuments([rawText]);

      await PineconeStore.fromDocuments(docs, embeddings, {
        pineconeIndex,
        namespace: pineconeNamespace,
      });
    }

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

exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ... existing imports ...

// @desc    Delete a project (and all associated data)
// @route   DELETE /api/projects/:id
exports.deleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;

    // 1. Find the project
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    console.log(`🗑️ Deleting project: ${project.name}`);

    // 2. Delete Vectors from Pinecone (Clean the Brain)
    const pineconeIndex = pinecone.Index("nexusmind");
    try {
      // Deletes everything in this specific namespace
      await pineconeIndex.namespace(project.pineconeNamespace).deleteAll();
      console.log('✅ Pinecone namespace deleted');
    } catch (err) {
      console.error('⚠️ Pinecone delete warning:', err.message);
      // We continue even if Pinecone fails (it might already be empty)
    }

    // 3. Delete Files from Supabase (Clean the Vault)
    if (project.fileKeys && project.fileKeys.length > 0) {
      const { error } = await supabase.storage
        .from('nexusmind-uploads')
        .remove(project.fileKeys);
      
      if (error) console.error('⚠️ Supabase delete warning:', error.message);
      else console.log('✅ Supabase files deleted');
    }

    // 4. Delete Record from MongoDB (Clean the Ledger)
    await Project.deleteOne({ _id: projectId });

    res.json({ message: 'Project deleted successfully' });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: error.message });
  }
};