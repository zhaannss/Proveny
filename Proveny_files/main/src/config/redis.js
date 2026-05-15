const Redis = require("ioredis");

let redis;

function getRedis(url) {
  if (!redis) {
    redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    // Don't keep Jest alive due to open Redis socket.
    if (process.env.NODE_ENV === "test") {
      redis.disconnect();
    }
  }
  return redis;
}

async function disconnectRedis() {
  if (redis) {
    const r = redis;
    redis = undefined;
    await r.quit();
  }
}

module.exports = { getRedis, disconnectRedis };

