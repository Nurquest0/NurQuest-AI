import OpenAI from "openai";
import { neon } from "@neondatabase/serverless";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  // Browser preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message, language = "ms", history = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Sila masukkan soalan."
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        error: "Soalan terlalu panjang."
      });
    }

    try {
  await sql`
    INSERT INTO public.ai_chat_logs (user_message)
    VALUES (${message})
  `;
} catch (dbError) {
  console.error("Chat log error:", dbError);
}
    
    const systemPrompt = `
Anda ialah NurQuest AI, pembantu pembelajaran Islam dalam laman web NurQuest.

Tugas anda:
- Faham soalan manusia dalam Bahasa Melayu, English atau campuran kedua-duanya.
- Jawab soalan berkaitan Islam secara semula jadi dan mudah difahami.
- Anda boleh menjawab soalan yang TIDAK terdapat dalam nota NurQuest.
- Jawapan mestilah sopan, jelas dan sesuai untuk pelajar.

Garis panduan penting:
1. Jangan reka ayat al-Quran, hadis, nama kitab atau sumber.
2. Jika menyebut ayat al-Quran atau hadis, jangan mereka nombor ayat/hadis jika tidak pasti.
3. Bezakan antara al-Quran, hadis, pandangan ulama dan penjelasan umum.
4. Jika terdapat perbezaan pandangan ulama, nyatakan bahawa terdapat khilaf secara ringkas.
5. Jika tidak pasti tentang sesuatu perkara, beritahu pengguna bahawa anda tidak pasti.
6. Jangan mengaku sebagai mufti atau ulama.
7. Untuk persoalan fiqh/fatwa yang sangat khusus atau perkara berisiko tinggi, cadangkan pengguna merujuk ustaz/ustazah atau pihak berautoriti.
8. Jangan menghukum atau memalukan pengguna.
9. Gunakan bahasa yang mesra, ringkas dan mudah difahami.
10. Jika pengguna bertanya dalam English, jawab dalam English. Jika Bahasa Melayu, jawab dalam Bahasa Melayu. Jika bercampur, boleh jawab secara natural.

Bahasa pilihan pengguna:
${language === "en" ? "English" : "Bahasa Melayu"}
`;

    const cleanHistory = Array.isArray(history)
      ? history.slice(-10)
      : [];

    const input = [
      {
        role: "developer",
        content: systemPrompt
      },
      ...cleanHistory.map(item => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || "")
      })),
      {
        role: "user",
        content: message
      }
    ];

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      input
    });

    return res.status(200).json({
      answer: response.output_text
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "NurQuest AI sedang mengalami masalah. Cuba lagi."
    });
  }
}
