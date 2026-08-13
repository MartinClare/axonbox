import http from "http";

function req(
  method: string,
  path: string,
  opts: { cookie?: string; body?: string } = {}
) {
  return new Promise<{ status?: number; body: string; cookie: string }>((resolve, reject) => {
    const r = http.request(
      {
        hostname: "127.0.0.1",
        port: 3005,
        path,
        method,
        headers: {
          ...(opts.cookie ? { Cookie: opts.cookie } : {}),
          ...(opts.body
            ? {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(opts.body),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
            cookie: (res.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; "),
          })
        );
      }
    );
    r.on("error", reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

async function main() {
  const csrf = await req("GET", "/api/auth/csrf");
  const token = JSON.parse(csrf.body).csrfToken as string;
  const login = await req("POST", "/api/auth/callback/credentials", {
    cookie: csrf.cookie,
    body: `csrfToken=${encodeURIComponent(token)}&email=${encodeURIComponent("admin@axon.demo")}&password=${encodeURIComponent("demo1234")}&callbackUrl=${encodeURIComponent("http://localhost:3005/")}&json=true`,
  });
  const jar = [csrf.cookie, login.cookie].filter(Boolean).join("; ");

  const pages = ["/", "/cases", "/tasks", "/capture", "/evidence", "/daily-reports", "/reports", "/settings"];
  for (const p of pages) {
    const res = await req("GET", p, { cookie: jar });
    const err =
      res.body.includes("Application error") ||
      res.body.includes("Unhandled Runtime Error") ||
      res.body.includes("useSession") ||
      res.status === 500;
    console.log(`${p} status=${res.status} error=${err} hasSidebar=${res.body.includes("AXON Case")}`);
  }

  // hit a case detail page
  const cases = JSON.parse((await req("GET", "/api/cases", { cookie: jar })).body) as Array<{ id: string }>;
  if (cases[0]) {
    const detail = await req("GET", `/cases/${cases[0].id}`, { cookie: jar });
    const err =
      detail.body.includes("Application error") ||
      detail.body.includes("useSession") ||
      detail.status === 500;
    console.log(`case-detail status=${detail.status} error=${err}`);
  }
}

main();
