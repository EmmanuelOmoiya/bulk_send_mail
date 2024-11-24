const express = require("express");
const nodemailer = require("nodemailer");
// const { Queue, Worker, QueueScheduler } = require("bullmq");
const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
require("dotenv").config();
const handlebars = require("handlebars");
const path = require("path");
const fs = require("fs");
const { createEvent } = require("ics");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Redis configuration
const connection = new Redis(process.env.REDIS_URL, {
  // url: process.env.REDIS_URL,
  //   host: process.env.REDIS_HOST || "127.0.0.1",
  //   port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

// BullMQ queue setup
// Create a QueueScheduler to manage stalled jobs
// const emailQueue = new QueueScheduler("emailQueue", { connection });

const emailQueue = new Queue("emailQueue", { connection });
// new QueueScheduler("emailQueue", { connection }); // Ensures reliable queue processing

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
  host: "us2.smtp.mailhostbox.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "hello@nuesaabuad.ng",
    pass: "3A_oBnp8#oy@",
  },
});

// Email worker to process jobs
new Worker(
  "emailQueue",
  async (job) => {
    try {
      console.log(`Processing job with ID: ${job.id}`);
      console.log(`Job Data:`, job.data);
      const { to, subject, payload, html } = job.data;

      const templateDir = path.join(process.cwd(), "./templates");
      const source = fs.readFileSync(path.join(templateDir, html), "utf-8");
      const compiledTemplate = handlebars.compile(String(source));

      // Send email
      const info = await transporter.sendMail({
        from: `"NUESA ABUAD" <hello@nuesaabuad.ng>`, // Sender address
        to,
        subject,
        html: compiledTemplate(payload),
        icalEvent: {
          content: createEvent({
            start: [2024, 11, 24, 18, 0],
            duration: { hours: 3, minutes: 0 },
            title: "Salam Odo N'uwa - NUESA DINNER AND AWARDS NIGHT",
            description: "",
            location: "Alfa Belgore, Afe Babalola University Ado-Ekiti",
            url: "https://dinner.nuesaabuad.ng/",
            // geo: { lat: 7.6058402, lon: 5.3068889 },
            organizer: { name: "NUESA ABUAD", email: "hello@nuesaabuad.ng" },
          }),
          method: "request",
          filename: "invite.ics",
        },
      });

      console.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      // Log detailed error information
      console.error(`Failed to process job ID ${job.id}:`, error);

      // Optionally, log specific error details
      if (error.response) {
        console.error("SMTP Response:", error.response);
        console.error("SMTP Response Code:", error.responseCode);
      }

      // Throw error again to let the queue retry
      throw error;
    }
  },
  { connection }
);

// API to enqueue bulk emails
app.post("/send-bulk-emails", async (req, res) => {
  const { emails } = req.body; // Array of email objects { to, subject, text, html }

  if (!emails || !Array.isArray(emails)) {
    return res
      .status(400)
      .json({ error: "Invalid input. Provide an array of emails." });
  }

  try {
    // Enqueue emails
    await Promise.all(
      emails.map((email) =>
        emailQueue.add("emailQueue", email, {
          attempts: 3, // Retry failed jobs up to 3 times
          backoff: 5000, // Retry delay in milliseconds
        })
      )
    );

    res.status(200).json({ message: "Emails enqueued successfully." });
  } catch (error) {
    console.error("Failed to enqueue emails:", error);
    res.status(500).json({ error: "Failed to enqueue emails." });
  }
});

app.listen(PORT, () => {
  console.log(`Email microservice is running on port ${PORT}`);
});
