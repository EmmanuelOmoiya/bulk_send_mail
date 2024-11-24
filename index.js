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

let testHtml = (name, previousReservedSeats, currentReservedSeats) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Salam Odo N'uwa - NUESA DINNER AND AWARDS NIGHT</title>
</head>
<body>
    <table align="center" cellspacing="0" cellpadding="0" style="width: 468px; margin: auto; font-family: 'Arial, sans-serif'; background-color: '#f4f4f4'; padding: '20px'">
      <tbody align="center" style="border: 1px solid #99999933; border-color: transparent; background-color: #fff5eb; width: 468px;">
        <tr align="center" style="border-color: transparent; width: 468px;">
          <td align="center" style="font-family: sans-serif; width: 342px; height: 100%; border-radius: 20px; overflow: hidden; margin: 0 auto;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" align="center" style="background-color: '#ffffff'; border-radius: '10px'; overflow: 'hidden'; box-shadow: '0 0 10px rgba(0, 0, 0, 0.1)'">
              <tr style="background-color: #8f0000;">
                <td align="center" style="padding: 2rem 0">
                  <h1 style="color: #FFD700; margin: 0; font-family: 'Palatino Linotype', serif;">Salam Odo N'uwa</h1>
                  <p style="color: #FFF; margin: 10px 0 0 0;">A Traditional Wedding-Themed Dinner Night</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 2rem 1.5rem; color: '#333333';">
                  <p>Dear <b>${name}</b>,</p>
                  <h3 style="color: '#8f0000'; text-align: center;">Your reservation is confirmed for our special cultural dinner celebration!</h3>
                  
                  <div style="background-color: rgba(139, 69, 19, 0.1); padding: 1.5rem; border-radius: 10px; margin: 1.5rem 0;">
                    <h4 style="margin: 0 0 1rem 0; color: #8f0000;">Event Details:</h4>
                    <p style="margin: 0.5rem 0;">🎉 Cultural Dinner Night</p>
                    <p style="margin: 0.5rem 0;">📅 23rd, November 2024</p>
                    <p style="margin: 0.5rem 0;">⏰ 06:00PM</p>
                  </div>

                  <ul style="background-color: rgba(139, 69, 19, 0.1); padding: 1.5rem; border-radius: 10px; margin: 1.5rem 0;">
                    <h4 style="margin: 0 0 1rem 0; color: #8f0000;">Your Reserved Seats:</h4>
                    <p>Previous Seat number(s):</p>
                    ${
                        previousReservedSeats.map((seat)=>`<li style="margin: 0.5rem 0;">🪑 Seat: ${seat}</li>`)
                    }
                    
                    <p>Current Seat number(s):</p>
                    ${
                        currentReservedSeats.map((seat)=>`<li style="margin: 0.5rem 0;">🪑 Seat: ${seat}</li>`)
                    }
                  </ul>

                  <div style="background-color: rgba(139, 69, 19, 0.1); padding: 1.5rem; border-radius: 10px; margin: 1.5rem 0;">
                    <h4 style="margin: 0 0 1rem 0; color: #8f0000;">What to Expect:</h4>
                    <p style="margin: 0.5rem 0;">🎭 Traditional wedding ceremony reenactment</p>
                    <p style="margin: 0.5rem 0;">🍽️ Cultural cuisine experience</p>
                    <p style="margin: 0.5rem 0;">🎵 Cultural music and entertainment</p>
                    <p style="margin: 0.5rem 0;">📸 Photo opportunities</p>
                  </div>

                  <p style="text-align: center; color: #8f0000; margin: 2rem 0;">
                    Dress Code: Gold and Wine!<br>
                    <span style="font-size: 0.9em; color: #666;">(Feel free to dress in any traditional outfit of your choice)</span>
                  </p>
                  <p style="font-size: 0.9em; color: #888888;">Best regards,<br>Elizabeth<br>Social Director (Female)<br>Salam Odo N'uwa Organizing Team<br></p>
                </td>
              </tr>
              <tr>
                <td style="padding: 2rem 1.5rem; background-color: '#f4f4f4'; text-align: center; color: #888888;">
                  <p>Join us for an evening of cultural celebration and fun!</p>
                  <p style="font-size: 12px; color: '#666666';">©2024 NUESA ABUAD. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
</body>
</html>`
}

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
    let mine = testHtml(payload.name, payload.previousReservedSeats, payload.currentReservedSeats)
    // console.log(String(mine)
      let message = {
        from: `"NUESA ABUAD" <hello@nuesaabuad.ng>`, // Sender address
        to,
        subject,
        // html: compiledTemplate(payload),
        html: "Hello Chai"
        // icalEvent: {
        //   content: createEvent({
        //     start: [2024, 11, 24, 18, 0],
        //     duration: { hours: 3, minutes: 0 },
        //     title: "Salam Odo N'uwa - NUESA DINNER AND AWARDS NIGHT",
        //     description: "",
        //     location: "Alfa Belgore, Afe Babalola University Ado-Ekiti",
        //     url: "https://dinner.nuesaabuad.ng/",
        //     // geo: { lat: 7.6058402, lon: 5.3068889 },
        //     organizer: { name: "NUESA ABUAD", email: "hello@nuesaabuad.ng" },
        //   }),
        //   method: "request",
        //   filename: "invite.ics",
        // },
      }
      const info = await transporter.sendMail(message);

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
