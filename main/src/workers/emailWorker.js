require("dotenv").config();

const { Worker } = require("bullmq");
const { sendEmail } = require("../config/email");
const { CONNECTION } = require("../config/queue");

const worker = new Worker(
  "email",
  async (job) => {
    const { to, subject, html, text } = job.data;
    await sendEmail({ to, subject, html, text });
  },
  { connection: CONNECTION, concurrency: Number(process.env.WORKER_CONCURRENCY || 5) }
);

worker.on("completed", (job) => console.log(`[EmailWorker] Job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[EmailWorker] Job ${job?.id} failed: ${err.message}`));

async function shutdown() {
  await worker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
