const fs = require("fs");
const https = require("https");

const USERNAME = process.env.PROFILE_USERNAME || "UsamaFaisal";
const README_PATH = process.env.README_PATH || "README.md";
const MAX_REPOS = Number(process.env.MAX_REPOS || 8);
const START_MARKER = "<!-- RECENT_REPOS_START -->";
const END_MARKER = "<!-- RECENT_REPOS_END -->";

function requestJson(url, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${USERNAME}-profile-readme-updater`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub API returned ${response.statusCode}: ${body}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function escapeCell(value) {
  if (!value) return "-";

  return String(value)
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function formatDate(dateString) {
  if (!dateString) return "-";

  return new Date(dateString).toISOString().slice(0, 10);
}

function buildTable(repos) {
  const rows = repos
    .filter((repo) => !repo.fork)
    .slice(0, MAX_REPOS)
    .map((repo, index) => {
      const language = escapeCell(repo.language);
      const description = escapeCell(repo.description);
      const lastPush = formatDate(repo.pushed_at);

      return `| ${index + 1} | [**${escapeCell(repo.name)}**](${repo.html_url}) | ${language} | ${
        repo.stargazers_count
      } | ${lastPush} | ${description} |`;
    });

  return [
    START_MARKER,
    "| # | Repository | Language | Stars | Last push | Description |",
    "|--:|:-----------|:---------|------:|:----------|:------------|",
    ...rows,
    END_MARKER,
  ].join("\n");
}

async function main() {
  const token = process.env.PROFILE_README_TOKEN || process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/users/${USERNAME}/repos?sort=pushed&direction=desc&per_page=100`;
  const repos = await requestJson(url, token);
  const readme = fs.readFileSync(README_PATH, "utf8");
  const startIndex = readme.indexOf(START_MARKER);
  const endIndex = readme.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Could not find ${START_MARKER} and ${END_MARKER} in ${README_PATH}`);
  }

  const before = readme.slice(0, startIndex);
  const after = readme.slice(endIndex + END_MARKER.length);
  const nextReadme = `${before}${buildTable(repos)}${after}`;

  fs.writeFileSync(README_PATH, nextReadme);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
