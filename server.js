const express = require("express");
const Groq = require("groq-sdk");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI).then(() => console.log("MongoDB connected")).catch(err => console.error("MongoDB error:", err));

// Contact schema
const contactSchema = new mongoose.Schema({
    name: String,
    email: String,
    country: String,
    service: String,
    message: String,
}, { timestamps: true });

const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);

// Email sender
const sendEmail = async ({ name, email, country, service, message }) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
        });
        await transporter.sendMail({
            from: `Elogixa Website <${process.env.EMAIL_USER}>`,
            to: process.env.CONTACT_NOTIFICATION_EMAIL,
            replyTo: email,
            subject: `New enquiry from ${name}`,
            html: `<p><b>Name:</b> ${name}</p><p><b>Email:</b> ${email}</p><p><b>Country:</b> ${country}</p><p><b>Service:</b> ${service}</p><p><b>Message:</b> ${message}</p>`
        });
    } catch (err) {
        console.error("Email error:", err.message);
    }
};

app.post("/webhook", async (req, res) => {
    console.log("Webhook received:", JSON.stringify(req.body, null, 2));

    const queryResult = req.body?.queryResult;
    if (!queryResult?.queryText) {
        return res.status(400).json({ fulfillmentText: "Invalid request format." });
    }

    const intentName = queryResult?.intent?.displayName || "";
    const params = queryResult?.parameters || {};

    // Handle contact intent
    if (intentName.toLowerCase().includes("contact")) {
        const name = params.name || params["person"]?.name || (typeof params["person"] === "string" ? params["person"] : "") || "";
        const email = params.email || "";
        const country = params["geo-country"] || "";
        const service = params.service || "";
        const message = params.message || "";

        if (!name || !email || !service || !message) {
            return res.json({ fulfillmentText: "Please provide all required details." });
        }

        try {
            await Contact.create({ name, email, country, service, message });
            await sendEmail({ name, email, country, service, message });
            return res.json({ fulfillmentText: `Thanks ${name}! We received your request and will contact you soon.` });
        } catch (err) {
            console.error("Contact save error:", err);
            return res.json({ fulfillmentText: "Something went wrong. Please try again." });
        }
    }

    // Default: Groq AI response
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "You are Elogixa Bot, an assistant for Elogixa company. Keep answers short and concise. Only on the very first message in a conversation, briefly introduce yourself as Elogixa Bot and mention that you help users with Elogixa's IT services. After that, just answer questions directly without re-introducing yourself."
                },
                { role: "user", content: queryResult.queryText }
            ],
        });
        const reply = completion.choices[0].message.content;
        res.json({ fulfillmentText: reply });
    } catch (error) {
        console.error("Groq API error:", error?.message || error);
        res.json({ fulfillmentText: "Sorry, I couldn't process your request right now." });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
 