import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const botsConfig = JSON.parse(fs.readFileSync("./botsConfig.json", "utf-8"));

function sendSSE(res, data) {
  res.write(`data: ${data}\n\n`);
}

app.post("/chat-stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { botId, message } = req.body;

  if (!message || !botId) {
    sendSSE(res, "[ERROR] botId y message son obligatorios");
    return res.end();
  }

  const rolePrompt = botsConfig[botId.toLowerCase()];
  if (!rolePrompt) {
    sendSSE(res, "[ERROR] Bot no encontrado");
    return res.end();
  }

  try {
    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: rolePrompt },
        { role: "user", content: message }
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) sendSSE(res, content);
    }

    sendSSE(res, "[DONE]");
    res.end();
  } catch (err) {
    console.error("Error en /chat-stream:", err);
    sendSSE(res, "[ERROR] Error en el servidor");
    res.end();
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${process.env.PORT}`);
});