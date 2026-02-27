import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiter (10 requests per minute per IP)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests. Slow down." }
});

app.use("/generate", limiter);

// In-memory IP usage log
const usageLog = {};

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Vect.ai Backend Running" });
});

// Generate endpoint
app.post("/generate", async (req, res) => {
  try {
    const userIP = req.ip;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Track usage per IP
    if (!usageLog[userIP]) {
      usageLog[userIP] = { count: 0 };
    }
    usageLog[userIP].count++;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "You are an autonomous website builder AI." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data });
    }

    res.json({
      result: data.choices[0].message.content,
      usage: usageLog[userIP]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
