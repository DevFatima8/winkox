import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SITE = "https://winx555games.vercel.app";

function launcherHtml() {
  // On Android the user can "Add to Home screen" from Chrome directly; this file re-opens the PWA
  // in full-screen app mode and, when supported, triggers the native install prompt via the site itself.
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<title>WinX555</title>
<link rel="manifest" href="${SITE}/manifest.webmanifest"/>
<link rel="apple-touch-icon" href="${SITE}/apple-icon.png"/>
<style>
html,body{margin:0;height:100%;background:#0b0716;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}
.w{padding:28px;max-width:340px}
.logo{width:88px;height:88px;margin:0 auto 18px;border-radius:22px;background:linear-gradient(135deg,#ffd45a,#ff8a00);display:flex;align-items:center;justify-content:center;font:900 44px Arial;color:#2a1500;box-shadow:0 10px 30px rgba(255,138,0,.4)}
h1{font-size:20px;margin:8px 0}
p{color:#b8a7e6;font-size:13px;line-height:1.5}
button{margin-top:18px;border:0;border-radius:14px;padding:14px 26px;font:900 15px Arial;background:linear-gradient(90deg,#8b5cf6,#d946ef);color:#fff;box-shadow:0 8px 24px rgba(217,70,239,.35)}
</style></head>
<body><div class="w">
<div class="logo">W</div>
<h1>WinX555</h1>
<p>Opening the app…</p>
<button onclick="go()">Open WinX555</button>
<script>
function go(){
  var u = ${JSON.stringify(SITE)} + "/";
  window.location.replace(u);
}
setTimeout(go, 400);
</script></div></body></html>`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file === "winx555.webmanifest" || file === "winx555-install.html") {
    return new NextResponse(launcherHtml(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": 'attachment; filename="WinX555-Install.html"',
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
