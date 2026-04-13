const express = require("express");
const Groq = require("groq-sdk");

const app = express();
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post("/webhook", async (req, res) => {
    console.log("Webhook received:", JSON.stringify(req.body, null, 2));

    const queryResult = req.body?.queryResult;
    if (!queryResult?.queryText) {
        console.warn("Missing queryResult.queryText in request body");
        return res.status(400).json({ fulfillmentText: "Invalid request format." });
    }

    const userMessage = queryResult.queryText;
    console.log("User message:", userMessage);

    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "You are Elogixa Bot, an assistant for Elogixa company. Keep answers short and concise. Only on the very first message in a conversation, briefly introduce yourself as Elogixa Bot and mention that you help users with Elogixa's IT services. After that, just answer questions directly without re-introducing yourself."
                },
                { role: "user", content: userMessage }
            ],
        });

        const reply = completion.choices[0].message.content;
        console.log("Groq reply:", reply);

        res.json({ fulfillmentText: reply });

    } catch (error) {
        console.error("Groq API error:", error?.message || error);
        res.json({ fulfillmentText: "Sorry, I couldn't process your request right now." });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
