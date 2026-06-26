const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// អនុញ្ញាតឱ្យ Blogger អាចបាញ់ទិន្នន័យចូលបាន
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/translate', async (req, res) => {
    try {
        const data = req.body;

        // 🔒 ប្រព័ន្ធការពារសុវត្ថិភាព៖ បើគ្មាន License Key បាញ់មកទេ គឺទាត់ចោលភ្លាម
        if (!data.key || data.key.trim() === "") {
            return res.json({ status: "error", message: "🔒 សំណើត្រូវបានបដិសេធ! មិនមាន License Key ត្រឹមត្រូវទេ ឬអ្នកមិនទាន់បាន Log in។" });
        }

        const targetName = { "km": "Khmer", "th": "Thai", "en": "English", "zh": "Chinese" }[data.target] || data.target;

        // 🟢 បំបែកអត្ថបទចេញពីកូដ <ID:លេខ>
        const inputLines = data.text.split('\n').filter(l => l.trim() !== "");
        let textToTranslate = [];
        for (let b = 0; b < inputLines.length; b++) {
            let match = inputLines[b].match(/<ID:\d+>\s*(.*)/);
            textToTranslate.push(match ? match[1] : inputLines[b]);
        }

        const numberedInput = textToTranslate.map((t, i) => `<ID:${i}> ${t || "..."}`).join('\n');
        const contextPrompt = data.context ? `\nCONTEXT & GLOSSARY MEMORY:\n${data.context}\n` : "";
        
        const genreMap = {
            "general": "Maintain a natural, standard, and conversational tone.",
            "action": "Use a gritty, intense, and aggressive tone (mafia/action style). Use strong pronouns if appropriate.",
            "wuxia": "Use martial arts (Wuxia/Xianxia) terminology. Sound heroic, ancient, and poetic.",
            "romance": "Use a romantic, emotional, and poetic tone. Use affectionate pronouns.",
            "comedy": "Use a humorous, witty, and fun tone. Modern internet slang is highly encouraged.",
            "historical": "Use formal, historical, or royal vocabulary. Sound ancient and respectful.",
            "horror": "Use a suspenseful, dark, and terrifying tone. Express fear clearly.",
            "scifi": "Use futuristic, scientific, and technical terminology.",
            "detective": "Use a serious, analytical, and suspenseful criminal investigation tone.",
            "anime": "Use highly expressive, dramatic, and energetic tone typical of anime.",
            "vlog": "Use a very casual, friendly, and trendy daily language.",
            "gaming": "Use video game terminology and streamer hype reactions.",
            "education": "Use an informative, clear, and encouraging academic tone.",
            "news": "Use a highly formal, neutral, and objective journalistic tone.",
            "documentary": "Use a formal, objective, and professional documentary narrator tone.",
            "kids": "Use a gentle, simple, and playful fairy tale tone."
        };
        const toneInstruction = genreMap[data.genre] ? `\nTONE/GENRE STYLE: ${genreMap[data.genre]}\n` : "";

        const prompt = `You are the world's best AI Movie Recap Narrator. Your mission is to convert the following movie texts into an engaging, thrilling, and highly detailed "Khmer Commentary/Recap Voiceover".

⚠️ CRITICAL RECAP RULES FOR FILLING SILENT SCENES:
1. DEEP RECAP & AD-LIBBING: If a line contains very few words, short exclamations (e.g., "Ah!", "Oh...", "Hmm"), or silent markers like "...", you MUST NOT just translate it literally. Instead, look at the Context and previous sentences, and ACT AS A STORYTELLER. Generate a rich, natural, and poetic Khmer narrative describing what the character might be doing, thinking, or feeling at that exact moment to fill the silence beautifully (e.g., "ក្នុងចិត្តរបស់គេពេលនេះពោរពេញដោយភាពភ័យខ្លាច...", "នាងដកដង្ហើមធំទាំងមិនអស់ចិត្ត...").
2. FLUID STORYFLOW: Ensure the story flows continuously like a real YouTube/TikTok recap video. Connect lines smoothly so the audience never feels a gap in the storyline.
3. ABSOLUTELY FORBIDDEN: Do NOT use the pronoun "អ្នក" or "អ្នកឯង" for 'You'. Use natural Khmer relationship pronouns (បង/អូន, ខ្ញុំ/ឯង, លោកប្រធាន, នាង). Do NOT translate character names.
4. STRICT COMPLIANCE: You MUST keep the exact <ID:num> token at the very beginning of EVERY line. Do NOT combine, skip, or compress lines. Maintain 1 line in = 1 line out.

TONE/GENRE STYLE: ${genreMap[data.genre] || "General Recap Tone"}
${contextPrompt}

INPUT TEXT TO RECAP:
${numberedInput}`;

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${data.geminiKey}`;
        
        const payloadData = {
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadData)
        });

        const aiData = await response.json();

        if (response.ok) {
            const aiOutput = aiData.candidates[0].content.parts[0].text;
            return res.json({ status: "success", translatedText: aiOutput });
        } else {
            if (aiData.error && aiData.error.code === 429) {
                return res.json({ status: "error", code: "QUOTA_LIMIT", message: "API Limit របស់ Gemini បានពេញ" });
            }
            return res.json({ status: "error", message: aiData.error ? aiData.error.message : "Unknown Error" });
        }

    } catch (error) {
        console.error(error);
        return res.json({ status: "error", message: "Server API រវើរវាយ។ សូមរង់ចាំ... 🔄" });
    }
});

// បញ្ឆេះ Server
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});
