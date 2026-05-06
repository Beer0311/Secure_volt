const express = require("express");
const Secret = require("../models/Secret");
const auth = require("../middleware/auth");

const router = express.Router();

// Get all secrets for logged-in user
router.get("/", auth, async (req, res) => {
  try {
    const secrets = await Secret.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(secrets);
  } catch (error) {
    console.error("Get Data Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save a new encrypted secret
router.post("/", auth, async (req, res) => {
  try {
    const { encryptedData, iv, type, encryptedFileName, fileNameIv } = req.body;

    if (!encryptedData || !iv) {
      return res.status(400).json({ error: "Data is missing" });
    }

    const secret = new Secret({
      user: req.user.id,
      encryptedData,
      iv,
      type: type || 'text',
      encryptedFileName,
      fileNameIv
    });

    await secret.save();
    res.status(201).json(secret);
  } catch (error) {
    console.error("Save Data Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a secret
router.delete("/:id", auth, async (req, res) => {
  try {
    const secret = await Secret.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!secret) return res.status(404).json({ error: "Secret not found" });
    
    res.json({ message: "Secret deleted successfully" });
  } catch (error) {
    console.error("Delete Data Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
