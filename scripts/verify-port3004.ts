import http from "http";
import fs from "fs";

function req(
  method: string,
  path: string,
  opts: { cookie?: string; body?: string; type?: string } = {}
) {
  return new Promise<{ status?: number; body: string; cookie: string }>((resolve, reject) => {
    const r = http.request(
      {
        hostname: "127.0.0.1",
        port: 3004,
        path,
        method,
        headers: {
          ...(opts.cookie ? { Cookie: opts.cookie } : {}),
          ...(opts.body
            ? {
                "Content-Type": opts.type || "application/x-www-form-urlencoded",
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
    body: `csrfToken=${encodeURIComponent(token)}&email=${encodeURIComponent("admin@axon.demo")}&password=${encodeURIComponent("demo1234")}&callbackUrl=${encodeURIComponent("http://localhost:3004/")}&json=true`,
  });
  const jar = [csrf.cookie, login.cookie].filter(Boolean).join("; ");
  const cases = JSON.parse((await req("GET", "/api/cases", { cookie: jar })).body) as Array<{
    caseNo: string;
    title: string;
    location: string;
  }>;
  const loginHtml = (await req("GET", "/login")).body;
  const home = (await req("GET", "/", { cookie: jar })).body;
  const titleMatch = loginHtml.match(/<title>([^<]+)<\/title>/);
  const out = {
    title: titleMatch?.[1] || "",
    loginOk: loginHtml.includes("\u767b\u5165"),
    homeOk: home.includes("\u7e3d\u89bd"),
    sample: cases.slice(0, 3).map((c) => ({
      caseNo: c.caseNo,
      title: c.title,
      location: c.location,
    })),
    mojibakeCount: cases.filter((c) => /Ã.|Â.|ï¿½/.test(c.title + c.location)).length,
    total: cases.length,
  };
  fs.writeFileSync("scripts/utf8-check.json", JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out));
}

main();
