const express = require("express");
const fs = require("fs/promises");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = __dirname;
const analyticsDir = path.join(rootDir, "analytics");
const analyticsFile = path.join(analyticsDir, "visits.json");

let writeQueue = Promise.resolve();

const emptyAnalytics = () => ({
  updatedAt: null,
  summary: {
    totalVisits: 0,
    uniqueVisitors: 0,
    lastVisitAt: null,
    last7Days: 0,
    topDevice: "No data yet",
    topBrowser: "No data yet",
    topReferrer: "Direct / none",
  },
  visits: [],
});

const incrementCounter = (collection, key) => {
  if (!key) {
    return;
  }

  collection.set(key, (collection.get(key) || 0) + 1);
};

const getTopLabel = (counter, fallback) => {
  if (!counter.size) {
    return fallback;
  }

  return [...counter.entries()].sort((left, right) => right[1] - left[1])[0][0];
};

const getDeviceType = (userAgent, viewportWidth) => {
  const agent = userAgent.toLowerCase();

  if (/ipad|tablet/.test(agent)) {
    return "Tablet";
  }

  if (/mobi|android|iphone/.test(agent)) {
    return "Mobile";
  }

  if (viewportWidth && viewportWidth < 900) {
    return "Tablet";
  }

  return "Desktop";
};

const getBrowser = (userAgent) => {
  const agent = userAgent.toLowerCase();

  if (agent.includes("edg/")) {
    return "Edge";
  }

  if (agent.includes("chrome/") && !agent.includes("edg/")) {
    return "Chrome";
  }

  if (agent.includes("firefox/")) {
    return "Firefox";
  }

  if (agent.includes("safari/") && !agent.includes("chrome/")) {
    return "Safari";
  }

  return "Other";
};

const normalizeReferrer = (value) => {
  if (!value) {
    return "Direct / none";
  }

  try {
    return new URL(value).hostname;
  } catch {
    return "Direct / none";
  }
};

const buildSummary = (visits) => {
  const visitorIds = new Set();
  const devices = new Map();
  const browsers = new Map();
  const referrers = new Map();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  let lastVisitAt = null;
  let last7Days = 0;

  visits.forEach((visit) => {
    visitorIds.add(visit.visitorId);
    incrementCounter(devices, visit.deviceType);
    incrementCounter(browsers, visit.browser);
    incrementCounter(referrers, visit.referrerLabel);

    if (!lastVisitAt || visit.at > lastVisitAt) {
      lastVisitAt = visit.at;
    }

    if (new Date(visit.at).getTime() >= sevenDaysAgo) {
      last7Days += 1;
    }
  });

  return {
    totalVisits: visits.length,
    uniqueVisitors: visitorIds.size,
    lastVisitAt,
    last7Days,
    topDevice: getTopLabel(devices, "No data yet"),
    topBrowser: getTopLabel(browsers, "No data yet"),
    topReferrer: getTopLabel(referrers, "Direct / none"),
  };
};

const ensureAnalyticsFile = async () => {
  await fs.mkdir(analyticsDir, { recursive: true });

  try {
    await fs.access(analyticsFile);
  } catch {
    await fs.writeFile(analyticsFile, JSON.stringify(emptyAnalytics(), null, 2));
  }
};

const readAnalytics = async () => {
  await ensureAnalyticsFile();

  try {
    const fileContent = await fs.readFile(analyticsFile, "utf8");
    const parsed = JSON.parse(fileContent);

    return {
      updatedAt: parsed.updatedAt || null,
      summary: parsed.summary || emptyAnalytics().summary,
      visits: Array.isArray(parsed.visits) ? parsed.visits : [],
    };
  } catch {
    return emptyAnalytics();
  }
};

const writeAnalytics = async (analytics) => {
  await fs.writeFile(analyticsFile, JSON.stringify(analytics, null, 2));
};

const updateAnalytics = async (updater) => {
  writeQueue = writeQueue.then(async () => {
    const analytics = await readAnalytics();
    const nextAnalytics = await updater(analytics);
    await writeAnalytics(nextAnalytics);

    return nextAnalytics;
  });

  return writeQueue;
};

app.use(express.json({ limit: "10kb" }));

app.get("/api/analytics/summary", async (req, res) => {
  const analytics = await readAnalytics();
  res.json(analytics.summary);
});

app.post("/api/analytics/visit", async (req, res) => {
  try {
    const page = typeof req.body?.page === "string" ? req.body.page.slice(0, 120) : "/";
    const language = typeof req.body?.language === "string" ? req.body.language.slice(0, 32) : "unknown";
    const timezone = typeof req.body?.timezone === "string" ? req.body.timezone.slice(0, 64) : "unknown";
    const referrer = typeof req.body?.referrer === "string" ? req.body.referrer.slice(0, 240) : "";
    const viewportWidth = Number(req.body?.viewport?.width) || 0;
    const viewportHeight = Number(req.body?.viewport?.height) || 0;
    const screenWidth = Number(req.body?.screen?.width) || 0;
    const screenHeight = Number(req.body?.screen?.height) || 0;
    const userAgent = (req.headers["user-agent"] || "unknown").slice(0, 240);
    const forwardedFor = typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.socket.remoteAddress || "unknown";
    const visitorId = crypto.createHash("sha256").update(forwardedFor).digest("hex").slice(0, 16);

    const visit = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      page,
      visitorId,
      language,
      timezone,
      referrer,
      referrerLabel: normalizeReferrer(referrer),
      userAgent,
      browser: getBrowser(userAgent),
      deviceType: getDeviceType(userAgent, viewportWidth),
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
      screen: {
        width: screenWidth,
        height: screenHeight,
      },
    };

    const analytics = await updateAnalytics((currentAnalytics) => {
      const visits = [...currentAnalytics.visits, visit].slice(-1000);

      return {
        updatedAt: visit.at,
        summary: buildSummary(visits),
        visits,
      };
    });

    res.status(201).json(analytics.summary);
  } catch {
    res.status(500).json({ error: "Unable to record visit analytics." });
  }
});

app.use(express.static(rootDir));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.sendFile(path.join(rootDir, "index.html"));
});

ensureAnalyticsFile().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
