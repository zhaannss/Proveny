const { Queue } = require("bullmq");
const { env } = require("./env");

const CONNECTION = { url: env.REDIS_URL };

let emailQueue;
function getEmailQueue() {
  if (!emailQueue) emailQueue = new Queue("email", { connection: CONNECTION });
  return emailQueue;
}

let analysisQueue;
function getAnalysisQueue() {
  if (!analysisQueue) analysisQueue = new Queue("analysis", { connection: CONNECTION });
  return analysisQueue;
}

let maintenanceQueue;
function getMaintenanceQueue() {
  if (!maintenanceQueue) maintenanceQueue = new Queue("maintenance", { connection: CONNECTION });
  return maintenanceQueue;
}

async function enqueueEmail(payload) {
  await getEmailQueue().add("send", payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  });
}

async function enqueueAnalysis(payload) {
  await getAnalysisQueue().add("analyze", payload, {
    attempts: 3,
    backoff: { type: "fixed", delay: 2_000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  });
}

async function closeQueues() {
  if (emailQueue) await emailQueue.close();
  if (analysisQueue) await analysisQueue.close();
  if (maintenanceQueue) await maintenanceQueue.close();
}

module.exports = {
  CONNECTION,
  getEmailQueue,
  getAnalysisQueue,
  getMaintenanceQueue,
  enqueueEmail,
  enqueueAnalysis,
  closeQueues,
};
