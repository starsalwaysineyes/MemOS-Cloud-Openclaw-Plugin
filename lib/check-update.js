import https from "https";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let lastCheckTime = 0;
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const PLUGIN_NAME = "@memtensor/memos-cloud-openclaw-plugin";

const ANSI = {
  RESET: "\x1b[0m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  CYAN: "\x1b[36m",
  RED: "\x1b[31m"
};


function getPackageVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkgData = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgData);
    return pkg.version;
  } catch (err) {
    return null;
  }
}

function getLatestVersion(log) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://registry.npmjs.org/${PLUGIN_NAME}/latest`,
      { timeout: 5000 },
      (res) => {
        if (res.statusCode !== 200) {
          req.destroy();
          return reject(new Error(`Failed to fetch version, status: ${res.statusCode}`));
        }

        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve(data.version);
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout getting latest version"));
    });
  });
}

function compareVersions(v1, v2) {
  // Split pre-release tags (e.g. 0.1.8-beta.1 -> "0.1.8" and "beta.1")
  const split1 = v1.split("-");
  const split2 = v2.split("-");
  const parts1 = split1[0].split(".").map(Number);
  const parts2 = split2[0].split(".").map(Number);
  
  // Compare major.minor.patch
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  
  // If base versions are equal, compare pre-release tags.
  // A version WITH a pre-release tag is LOWER than a version WITHOUT one.
  // e.g. 0.1.8-beta is less than 0.1.8. 0.1.8 is the final release.
  const hasPre1 = split1.length > 1;
  const hasPre2 = split2.length > 1;
  
  if (hasPre1 && !hasPre2) return -1; // v1 is a beta, v2 is a full release
  if (!hasPre1 && hasPre2) return 1;  // v1 is a full release, v2 is a beta
  if (!hasPre1 && !hasPre2) return 0; // both are full releases and equal
  
  // If both are pre-releases, do a basic string compare on the tag
  // "alpha" < "beta" < "rc"
  if (split1[1] > split2[1]) return 1;
  if (split1[1] < split2[1]) return -1;
  
  return 0;
}

export async function checkUpdate(log) {
  // Prevent infinite loop: do not check for updates if the current process
  // is already running an openclaw CLI command like `openclaw plugins update ...`
  const isUpdateCommand = process.argv.includes("plugins") && process.argv.includes("update");
  if (isUpdateCommand) {
    return;
  }

  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL) {
    return;
  }
  
  lastCheckTime = now;
  
  const currentVersion = getPackageVersion();
  if (!currentVersion) {
    return;
  }

  try {
    const latestVersion = await getLatestVersion(log);
    
    // Normal version check
    if (compareVersions(latestVersion, currentVersion) <= 0) {
      return;
    }

    log.info?.(`${ANSI.YELLOW}[memos-cloud] Update available: ${currentVersion} -> ${latestVersion}. Updating in background...${ANSI.RESET}`);


    let dotCount = 0;
    const progressInterval = setInterval(() => {
      dotCount++;
      const dots = ".".repeat(dotCount % 4);
      log.info?.(`${ANSI.YELLOW}[memos-cloud] Update in progress for memos-cloud-openclaw-plugin${dots}${ANSI.RESET}`);
    }, 5000); // Log every 5 seconds to show it's still alive

    const cliName = (() => {
      // Check the full path of the entry script (e.g., .../moltbot/bin/index.js) or the executable
      const scriptPath = process.argv[1] ? process.argv[1].toLowerCase() : "";
      const execPath = process.execPath ? process.execPath.toLowerCase() : "";

      if (scriptPath.includes("moltbot") || execPath.includes("moltbot")) return "moltbot";
      if (scriptPath.includes("clawdbot") || execPath.includes("clawdbot")) return "clawdbot";
      return "openclaw";
    })();

    exec(`${cliName} plugins update memos-cloud-openclaw-plugin`, (error, stdout, stderr) => {
      clearInterval(progressInterval);
      
      const outText = (stdout || "").trim();
      const errText = (stderr || "").trim();
      
      if (outText) log.info?.(`${ANSI.CYAN}[${cliName}-cli]${ANSI.RESET}\n${outText}`);
      if (errText) log.warn?.(`${ANSI.RED}[${cliName}-cli]${ANSI.RESET}\n${errText}`);

      // Wait for a brief moment to let file system sync if needed
      setTimeout(() => {
        const postUpdateVersion = getPackageVersion();
        const actuallyUpdated = (postUpdateVersion === latestVersion) && (postUpdateVersion !== currentVersion);

        if (error || !actuallyUpdated) {
          const reason = error ? "Command exited with error" : "Version did not change after update command";
          log.warn?.(`${ANSI.RED}[memos-cloud] Auto-update failed (${reason}). Please refer to the CLI logs above, or run manually: ${cliName} plugins update memos-cloud-openclaw-plugin${ANSI.RESET}`);
        } else {
          log.info?.(`${ANSI.GREEN}[memos-cloud] Successfully updated to version ${latestVersion}. Please restart the gateway to apply changes.${ANSI.RESET}`);
        }
      }, 1000); // Small 1-second buffer for file systems
    });

  } catch (error) {
    // Silently handle errors
  }
}
