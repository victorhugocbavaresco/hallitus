import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Historial de conversación por usuario (en memoria)
const conversationHistory = {}; // { userId: [ {role, content}, ... ] }
const MAX_HISTORY = 10; // Limita el historial para no gastar demasiados tokens

app.post("/chat", async (req, res) => {
  try {
    const { userId, mensaje } = req.body;
    if (!userId || !mensaje) {
      return res.status(400).json({ error: "Falta userId o mensaje" });
    }

    // Inicializar historial si no existe
    if (!conversationHistory[userId]) {
      conversationHistory[userId] = [
        { role: "system", content: "Eres un asistente amigable que mantiene el hilo de la conversación." }
      ];
    }

    // Agregar mensaje del usuario
    conversationHistory[userId].push({ role: "user", content: mensaje });

    // Limitar historial
    conversationHistory[userId] = conversationHistory[userId].slice(-MAX_HISTORY);

    // Llamada a ChatGPT con todo el historial
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversationHistory[userId]
    });

    const respuesta = completion.choices[0].message.content;

    // Agregar respuesta del bot al historial
    conversationHistory[userId].push({ role: "assistant", content: respuesta });

    // Limitar historial nuevamente
    conversationHistory[userId] = conversationHistory[userId].slice(-MAX_HISTORY);

    // Enviar respuesta al cliente
    res.json({ respuesta });
  } catch (err) {
    console.error("Error en /chat:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
