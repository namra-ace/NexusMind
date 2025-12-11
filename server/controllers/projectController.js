const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid'); // We need this for unique filenames

// @desc    Get a secure upload URL (Signed URL)
// @route   POST /api/projects/upload-url
exports.getUploadUrl = async (req, res) => {
  try {
    const userId = req.user.id; // Comes from Auth Middleware
    const { fileName, fileType } = req.body;

    // Create a unique file path: users/USER_ID/RANDOM_ID.pdf
    const uniqueFileName = `${uuidv4()}-${fileName}`;
    const filePath = `users/${userId}/${uniqueFileName}`;

    res.json({
      filePath: filePath,
      fileName: uniqueFileName
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};