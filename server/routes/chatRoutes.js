const express = require('express');
const router = express.Router();
const { chatWithProject } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, chatWithProject);

module.exports = router;