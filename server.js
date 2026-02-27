import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests. Slow down." }
});

app.use("/generate", limiter);

const usageLog = {};

app.get("/", (req, res) => {
  res.json({ status: "Vect.ai Backend Running" });
});

app.post("/generate", async (req, res) => {
  try {
    const userIP = req.ip;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!usageLog[userIP]) {
      usageLog[userIP] = { count: 0 };
    }
    usageLog[userIP].count++;

    const models = [
      "llama-3.1-8b-instant",
      "llama-3.1-70b-versatile",
      "gemma2-9b-it"
    ];

    let aiResponse = null;
    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: `Return ONLY valid JSON in this format:
{
  "index.html": "...",
  "style.css": "...",
  "script.js": "..."
}`
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.7
          })
        });

        const data = await response.json();

        if (response.ok) {
          aiResponse = data;
          break;
        } else {
          lastError = data;
        }

      } catch (err) {
        lastError = err;
      }
    }

    if (!aiResponse) {
      return res.status(500).json({
        error: "All models failed",
        details: lastError
      });
    }

    res.json({
      result: aiResponse.choices[0].message.content,
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
