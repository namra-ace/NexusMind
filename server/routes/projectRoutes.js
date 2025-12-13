const express = require('express');
const router = express.Router();
// Import all controller functions
const { getUploadUrl, createProject, getAllProjects } = require('../controllers/projectController'); 
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/projects/upload-url
// @desc    Get secure upload URL
router.post('/upload-url', protect, getUploadUrl);

// @route   POST /api/projects
// @desc    Save project metadata to Mongo & Ingest
router.post('/', protect, createProject);

// @route   GET /api/projects
// @desc    Get all projects for the user
router.get('/', protect, getAllProjects); 

module.exports = router;