const mongoose = require('mongoose');
require('dotenv').config();  // Load environment variables

// Debug: Print MongoDB URI to verify it's loading correctly
console.log("🔍 Loaded MongoDB URI:", process.env.MONGO_URI);

const mongoURI = process.env.MONGO_URI;  // Correct way to fetch URI

if (!mongoURI) {
    console.error("❌ MongoDB URI is missing! Check your .env file.");
    process.exit(1); // Exit the app if URI is missing
}

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected successfully"))
.catch(err => console.error("❌ MongoDB connection error:", err));
