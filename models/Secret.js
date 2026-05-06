const mongoose = require("mongoose");

const SecretSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['text', 'image', 'document'], default: 'text' },
  encryptedData: { type: String, required: true },
  iv: { type: String, required: true }, // Store IV (Initialization Vector) for decryption
  encryptedFileName: { type: String }, // For documents
  fileNameIv: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Secret", SecretSchema);
