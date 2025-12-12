const express = require('express');
const router = express.Router();
const { getUploadUrl, createProject } = require('../controllers/projectController'); // <--- Import createProject
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/projects/upload-url
// @desc    Get secure upload URL
router.post('/upload-url', protect, getUploadUrl);

// @route   POST /api/projects
// @desc    Save project metadata to Mongo
router.post('/', protect, createProject); 

module.exports = router;