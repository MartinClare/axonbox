import http from "http";

function get(path: string, cookie = ""): Promise<{ status: number; body: string; buf: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: 3003, path, method: "GET", headers: cookie ? { Cookie: cookie } : {} },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode || 0, body: buf.toString("utf8"), buf });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function postForm(path: string, body: string, cookie = "") {
  return new Promise<{ status: number; body: string; setCookie: string[] }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 3003,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf8"),
            setCookie: res.headers["set-cookie"] || [],
          });
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const login = await get("/login");
  const title = login.body.match(/<title>([^<]*)<\/title>/)?.[1] || "";
  console.log("TITLE:", title);
  console.log("TITLE_OK:", title.includes("工地"));
  console.log("LOGIN_HAS_登入:", login.body.includes("登入"));

  const csrfPage = await get("/api/auth/csrf");
  const csrf = JSON.parse(csrfPage.body).csrfToken as string;
  // get cookie from csrf? next-auth may set csrf cookie on that response - need to hit with jar
  // simpler: use credentials with csrf from page
  const sign = await postForm(
    "/api/auth/callback/credentials",
    `csrfToken=${encodeURIComponent(csrf)}&email=${encodeURIComponent("admin@axon.demo")}&password=${encodeURIComponent("demo1234")}&callbackUrl=${encodeURIComponent("http://localhost:3003/")}&json=true`
  );
  const cookie = sign.setCookie.map((c) => c.split(";")[0]).join("; ");
  console.log("LOGIN_STATUS", sign.status, "COOKIE_LEN", cookie.length);

  // Also need csrf cookie - fetch csrf with cookies
  const csrf2 = await new Promise<{ body: string; cookie: string }>((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: 3003, path: "/api/auth/csrf", method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const set = (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
          resolve({ body: Buffer.concat(chunks).toString("utf8"), cookie: set });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
  const csrfToken = JSON.parse(csrf2.body).csrfToken;
  const jar1 = csrf2.cookie;
  const sign2 = await postForm(
    "/api/auth/callback/credentials",
    `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent("admin@axon.demo")}&password=${encodeURIComponent("demo1234")}&callbackUrl=${encodeURIComponent("http://localhost:3003/")}&json=true`,
    jar1
  );
  const jar = [jar1, ...sign2.setCookie.map((c) => c.split(";")[0])].filter(Boolean).join("; ");
  console.log("AUTH_OK", sign2.status, jar.includes("session-token"));

  const cases = await get("/api/cases", jar);
  const arr = JSON.parse(cases.body) as Array<{ title: string; location: string; caseNo: string }>;
  console.log("CASE_COUNT", arr.length);
  for (const c of arr.slice(0, 5)) {
    console.log("-", c.caseNo, c.title, "|", c.location);
    const bad = /Ã.|Â.|å.|æ.|ä.|é.|ç.|ï¿½|\uFFFD/.test(c.title + c.location);
    console.log("  mojibake?", bad);
  }

  const home = await get("/", jar);
  console.log("HOME_HAS_總覽:", home.body.includes("總覽"));
  console.log("HOME_HAS_進行中:", home.body.includes("進行中") || home.body.includes("Case"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
