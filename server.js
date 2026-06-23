const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 🟢 ១. បើកសិទ្ធិ CORS (អនុញ្ញាតឱ្យវិបសាយ Blogger របស់បង បាញ់ទិន្នន័យចូលបាន)
app.use(cors({
    origin: '*', // អនុញ្ញាតពីគ្រប់វិបសាយទាំងអស់
    methods: ['GET', 'POST']
}));

// អនុញ្ញាតឱ្យ Server អានទិន្នន័យទម្រង់ JSON បាន
app.use(express.json({ limit: '50mb' })); 

// 🟢 ២. បង្កើតផ្លូវ (API Endpoint) សម្រាប់ទទួលសំណើពី Blogger
app.post('/api', async (req, res) => {
    try {
        const data = req.body;
        const action = data.action;

        // តេស្តមើលថាតើ Server ដើរឬអត់
        if (action === "ping") {
            return res.json({ status: "success", message: "Node.js Server កំពុងដំណើរការយ៉ាងរលូន! 🚀" });
        }

        // 🟢 កន្លែងនេះហើយដែលយើងនឹងយកកូដបកប្រែ Gemini API ពី Google App Script មកដាក់ជំនួសវិញនៅពេលក្រោយ
        if (action === "translate") {
            return res.json({ 
                status: "success", 
                message: "កូដបញ្ជាឱ្យបកប្រែបានមកដល់ Node.js ហើយ!" 
            });
        }

        return res.json({ status: "error", message: "មិនទាន់មានមុខងារនេះនៅលើ Node.js ទេ" });

    } catch (error) {
        console.error(error);
        return res.json({ status: "error", message: error.toString() });
    }
});

// បញ្ឆេះ Server ឱ្យរង់ចាំទទួលទិន្នន័យ
app.listen(PORT, () => {
    console.log(`✅ VRS Server is running on port ${PORT}`);
});
