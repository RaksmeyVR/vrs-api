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

        const prompt = `Please process the following text into ${targetName}.
Follow these strict instructions and context provided by the system:
${contextPrompt}
TONE/GENRE STYLE: ${genreMap[data.genre] || "Maintain a natural and standard tone"}

INPUT TEXT:
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
            
            // 🟢 ១. រាប់ចំនួនបន្ទាត់ដែលបញ្ជូនទៅ AI
            const linesUsed = inputLines.length; 

            let newUsageFromDB = null;

            // 🟢 ២. បាញ់ទិន្នន័យរាយការណ៍ទៅកាន់ Google Apps Script
            try {
                // បងយក Link ទាំង ៦ មកដាក់ទីនេះតែម្តង!
                const GAS_LIST = [
                    "https://script.google.com/macros/s/AKfycbxUhTvjYGAfxdYgJ_H1R9b0GGbrBK8zYU4LT3pvft_YKfKk2ZoKd4L9ljHbZLDATceHkA/exec",
                    "https://script.google.com/macros/s/AKfycbzYZUIJlp5pJWpdD8vOmOSnVuHo1QknhhPjQNhw-x05QS3mdvS6LCEtBpFuvnHPHFeh/exec",
                    "https://script.google.com/macros/s/AKfycbyrzBfPWuQNp12L9TDSlDWp2NNb3g4OcneXdfZKl1JVouHWIEteAb4fQ0wh83XM2YI/exec",
                    "https://script.google.com/macros/s/AKfycbzZkq73WVRd6p-zQnndKAJ4DYcdfW0RtFMFY2f2_9heAGNEV7iNihABRvvAiML876bj-g/exec",
                    "https://script.google.com/macros/s/AKfycbzutlHZTFRYj68_9FCvYbpMIcSSiLnWQj2TkVHIqRlbs1mbNjMuoJ3r-fNFSu5lWsId/exec",
                    "https://script.google.com/macros/s/AKfycbxllsVsY3ck6iPHzNGMCwuPzrvgoKA-Z52kkmmca8ufRvpmHptL7TGLAgk4U2ZAE71O/exec"
                ];
                
                // ឱ្យ Render ជ្រើសរើស Link មួយដោយចៃដន្យ (Random)
                const gasUrl = GAS_LIST[Math.floor(Math.random() * GAS_LIST.length)]; 
                
                const gasRes = await fetch(gasUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "updateLineUsage",
                        key: data.key,
                        linesUsed: linesUsed
                    })
                });
                
                const gasData = await gasRes.json();
                if (gasData.status === "success") {
                    newUsageFromDB = gasData.newUsage; 
                }
            } catch (dbErr) {
                console.error("បរាជ័យក្នុងការរាយការណ៍ទៅ Google Sheet:", dbErr);
            }

            // 🟢 ៣. បាញ់លទ្ធផល និងចំនួន Usage ថ្មីត្រឡប់ទៅ Blogger វិញ
            return res.json({ 
                status: "success", 
                translatedText: aiOutput,
                newUsage: newUsageFromDB 
            });
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
