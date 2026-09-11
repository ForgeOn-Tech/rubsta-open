LIGHT = """    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
    :root{
      --bg0:#f6f8fb; --bg1:#ffffff; --bg2:#eef2f6; --line:#dce2e8;
      --ink:#0b1620; --muted:#46586a; --dim:#5e7082;
      --accent:#2f698e; --accent-fg:#ffffff; --accent-deep:#1c587c;
      --good:#2e7d55; --warn:#8a6200; --bad:#b23a3a;
      --sans:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
      --mono:'JetBrains Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;
    }
    *,*::before,*::after{box-sizing:border-box;border-radius:0;}
    body{margin:0;font-family:var(--sans);background:var(--bg0);color:var(--ink);-webkit-font-smoothing:antialiased;}
    a{color:var(--accent);text-decoration:none;} a:hover{color:var(--accent-deep);}
    .eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);}
    .caps{font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);}
    .thead{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);}
    .mono{font-family:var(--mono);font-variant-numeric:tabular-nums;}"""

DARK = """    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
    :root{
      --bg0:#0a0b0d; --bg1:#141619; --bg2:#1d2126; --line:#2a2f36;
      --ink:rgba(255,255,255,.92); --muted:rgba(255,255,255,.62); --dim:rgba(255,255,255,.50);
      --accent:#7db8e0; --accent-fg:#050505; --accent-deep:#5a9cc9;
      --good:#6cc294; --warn:#d9b155; --bad:#e08a8a;
      --sans:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
      --mono:'JetBrains Mono',ui-monospace,'SFMono-Regular',Menlo,monospace;
    }
    *,*::before,*::after{box-sizing:border-box;border-radius:0;}
    body{margin:0;font-family:var(--sans);background:var(--bg0);color:var(--ink);-webkit-font-smoothing:antialiased;}
    a{color:var(--accent);text-decoration:none;} a:hover{color:var(--accent-deep);}
    .eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);}
    .caps{font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);}
    .thead{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);}
    .mono{font-family:var(--mono);font-variant-numeric:tabular-nums;}"""

def shell(style, body, extra=""):
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
{style}
{extra}
  </style>
</helmet>
{body}
</x-dc>
</body>
</html>
"""
