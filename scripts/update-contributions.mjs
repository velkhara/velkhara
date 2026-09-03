import fs from "node:fs";

const username = process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN;

const currentYear = new Date().getFullYear();

async function graphql(query, variables = {}) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": username,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(JSON.stringify(data.errors, null, 2));
  }

  return data.data;
}

async function getUserCreatedAt() {
  const data = await graphql(
    `
      query ($login: String!) {
        user(login: $login) {
          createdAt
        }
      }
    `,
    { login: username }
  );

  return new Date(data.user.createdAt);
}

async function getContributions(from, to) {
  const data = await graphql(
    `
      query ($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
            }
          }
        }
      }
    `,
    {
      login: username,
      from: from.toISOString(),
      to: to.toISOString(),
    }
  );

  return data.user.contributionsCollection.contributionCalendar
    .totalContributions;
}

function createSvg(value, label, progress = 0.85) {
  const circumference = 534;
  const filled = Math.round(circumference * progress);

  return `
<svg width="220" height="220" viewBox="0 0 220 220"
     xmlns="http://www.w3.org/2000/svg">

  <circle
    cx="110"
    cy="110"
    r="85"
    fill="none"
    stroke="#2f2f2f"
    stroke-width="14"
  />

  <circle
    cx="110"
    cy="110"
    r="85"
    fill="none"
    stroke="#a371f7"
    stroke-width="14"
    stroke-linecap="round"
    stroke-dasharray="${filled} ${circumference}"
    transform="rotate(-90 110 110)"
  />

  <text
    x="110"
    y="102"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="34"
    font-weight="700"
    fill="#ffffff"
  >
    ${value.toLocaleString("en-US")}
  </text>

  <text
    x="110"
    y="132"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="14"
    fill="#8b949e"
  >
    ${label}
  </text>
</svg>
`.trim();
}

const now = new Date();

const yearStart = new Date(`${currentYear}-01-01T00:00:00Z`);

const thisYear = await getContributions(yearStart, now);

const createdAt = await getUserCreatedAt();

let total = 0;

for (
  let year = createdAt.getUTCFullYear();
  year <= currentYear;
  year++
) {
  const from = new Date(`${year}-01-01T00:00:00Z`);

  const to =
    year === currentYear
      ? now
      : new Date(`${year}-12-31T23:59:59Z`);

  total += await getContributions(from, to);
}

fs.writeFileSync(
  "contributions-total.svg",
  createSvg(total, "TOTAL")
);

fs.writeFileSync(
  "contributions-year.svg",
  createSvg(thisYear, String(currentYear))
);

console.log({
  total,
  thisYear,
});
