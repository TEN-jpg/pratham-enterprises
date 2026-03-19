import dotenv from "dotenv";
dotenv.config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function loadEnvFile() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;

    const fileContent = fs.readFileSync(envPath, "utf8");

    fileContent.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) return;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();

        if (key && !process.env[key]) {
            process.env[key] = value;
        }
    });
}

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3000;

const OWNER_EMAIL =
    process.env.ENQUIRY_RECEIVER_EMAIL || "info@prathamenterprises.com";

const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^[0-9]{10}$/.test(phone);
}

app.post("/submit-enquiry", async (req, res) => {
    const {
        name = "",
        phone = "",
        email = "",
        requirement = "",
        property = "",
        description = ""
    } = req.body;

    if (!name.trim()) {
        return res.status(400).json({ message: "Full name is required." });
    }

    if (!isValidPhone(phone.trim())) {
        return res
            .status(400)
            .json({ message: "Please enter a valid 10-digit phone number." });
    }

    if (!isValidEmail(email.trim())) {
        return res
            .status(400)
            .json({ message: "Please enter a valid email address." });
    }

    if (!requirement.trim()) {
        return res
            .status(400)
            .json({ message: "Please select your requirement." });
    }

    const safeProperty = property.trim() || "General Enquiry";

    try {
        await resend.emails.send({
            from: "onboarding@resend.dev",
            to: "pratikbansod82@gmail.com",
            subject: `New Enquiry: ${safeProperty}`,
            text: [
                `Name: ${name.trim()}`,
                `Phone: ${phone.trim()}`,
                `Email: ${email.trim()}`,
                `Requirement: ${requirement.trim()}`,
                `Property: ${safeProperty}`,
                `Message: ${
                    description.trim() || "No additional message provided."
                }`
            ].join("\n")
        });

        return res
            .status(200)
            .json({ message: "Enquiry sent successfully." });
    } catch (error) {
        console.error("Failed to send enquiry email:", error);
        return res.status(500).json({
            message: "We could not send your enquiry right now. Please try again."
        });
    }
});

app.post("/track-property-view", async (req, res) => {
    const { propertyName, viewerPhone } = req.body;

    const message = `
🚀 New Property View
🏠 Property: ${propertyName}
📞 Phone: ${viewerPhone}
`;

    try {
        const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message
            })
        });

        const data = await tgRes.json();
        console.log("Telegram response:", data);

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Telegram failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
