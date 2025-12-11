const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a project name'],
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  fileKey: {
    type: String,
    required: true
  },
  // This connects to Pinecone (The Vector Database)
  // We use the Project ID itself as the namespace usually, 
  // but storing it explicitly is good practice.
  pineconeNamespace: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ProjectSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Project', ProjectSchema);