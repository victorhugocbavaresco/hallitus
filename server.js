import express from "express";
import OpenAI from "openai";
import { ChromaClient } from "chromadb";

const app = express();
app.use(express.json());

// 🔑 Inicializa cliente de OpenAI
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🗂 Inicializa cliente de ChromaDB (persistente en disco de Render)
const chroma = new ChromaClient({ path: "./memoria_db" });
const collection = await chroma.getOrCreateCollection({ name: "memoria" });

// 📌 Guardar recuerdos
async function guardarMemoria(userId, texto) {
  const embedding = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texto,
  });

  await collection.add({
    ids: [`${userId}_${Date.now()}`], // id único
    embeddings: [embedding.data[0].embedding],
    documents: [texto],
    metadatas: [{ userId }],
  });
}

// 📌 Recuperar recuerdos relevantes
async function recuperarMemoria(userId, mensaje, topK = 5) {
  const embedding = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: mensaje,
  });

  const resultados = await collection.query({
    queryEmbeddings: [embedding.data[0].embedding],
    nResults: topK,
    where: { userId },
  });

  return resultados.documents?.[0] || [];
}

// 📌 Endpoint principal de chat
app.post("/chat", async (req, res) => {
  try {
    const { userId, mensaje } = req.body;
    if (!userId || !mensaje) {
      return res.status(400).json({ error: "Falta userId o mensaje" });
    }

    // Recuperar recuerdos relevantes
    const recuerdos = await recuperarMemoria(userId, mensaje);
    const contexto = recuerdos.join("\n");

    // Llamar al modelo con recuerdos
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Eres un asistente con memoria persistente de cada usuario.",
        },
        { role: "system", content: `Recuerdos del usuario:\n${contexto}` },
        { role: "user", content: mensaje },
      ],
    });

    const respuesta = completion.choices[0].message.content;

    // Guardar el mensaje como recuerdo nuevo
    await guardarMemoria(userId, mensaje);

    res.json({ respuesta });
  } catch (err) {
    console.error("Error en /chat:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// 🚀 Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
