const express = require("express");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

function loadEnvFile() {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) {
        return;
    }

    const fileContent = fs.readFileSync(envPath, "utf8");
    fileContent.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            return;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            return;
        }

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

const OWNER_EMAIL = process.env.ENQUIRY_RECEIVER_EMAIL || "info@prathamenterprises.com";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_SERVICE = process.env.SMTP_SERVICE || "gmail";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^[0-9]{10}$/.test(phone);
}

function createTransporter() {
    if (!SMTP_USER || !SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
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
        return res.status(400).json({ message: "Please enter a valid 10-digit phone number." });
    }

    if (!isValidEmail(email.trim())) {
        return res.status(400).json({ message: "Please enter a valid email address." });
    }

    if (!requirement.trim()) {
        return res.status(400).json({ message: "Please select your requirement." });
    }

    const transporter = createTransporter();

    if (!transporter) {
        return res.status(500).json({
            message: "Email service is not configured yet. Add SMTP_USER and SMTP_PASS in the server environment."
        });
    }

    const safeProperty = property.trim() || "General Enquiry";

    const mailOptions = {
        from: SMTP_USER,
        replyTo: email.trim(),
        to: OWNER_EMAIL,
        subject: `New Enquiry: ${safeProperty}`,
        text: [
            `Name: ${name.trim()}`,
            `Phone: ${phone.trim()}`,
            `Email: ${email.trim()}`,
            `Requirement: ${requirement.trim()}`,
            `Property: ${safeProperty}`,
            `Message: ${description.trim() || "No additional message provided."}`
        ].join("\n")
    };

    try {
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: "Enquiry sent successfully." });
    } catch (error) {
        console.error("Failed to send enquiry email:", error);
        return res.status(500).json({ message: "We could not send your enquiry right now. Please try again." });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
