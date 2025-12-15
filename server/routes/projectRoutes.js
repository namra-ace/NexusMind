const express = require('express');
const router = express.Router();

const { getUploadUrl, createProject, getAllProjects, deleteProject } = require('../controllers/projectController'); 
const { protect } = require('../middleware/authMiddleware');

router.post('/upload-url', protect, getUploadUrl);
router.post('/', protect, createProject);
router.get('/', protect, getAllProjects);
router.delete('/:id', protect, deleteProject);

module.exports = router;