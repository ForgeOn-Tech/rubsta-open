from tokens import LIGHT, shell

def svg(paths, size=18, color="currentColor", w="1.5"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
            f'stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{paths}</svg>')

CHEV_L = svg('<path d="M15 18l-6-6 6-6"/>')
PLUS   = svg('<path d="M12 5v14M5 12h14"/>', 16)
UNDO   = svg('<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-5.6L3 10"/>', 16)
DOWN   = svg('<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>', 16)
SHARE  = svg('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/>', 16)

def phone(inner):
    return (f'<div style="width:390px;height:844px;background:var(--bg0);display:flex;'
            f'flex-direction:column;overflow:hidden;">{inner}</div>')

def topbar(kicker, title, right=""):
    return f"""<div style="background:var(--bg1);border-bottom:1px solid var(--line);padding:18px 20px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;color:var(--muted);">{CHEV_L}
          <span class="eyebrow">{kicker}</span></div>{right}
      </div>
      <div style="font-size:20px;font-weight:600;letter-spacing:-.01em;margin-top:12px;">{title}</div>
    </div>"""

def field(label, value, placeholder=False, note=None):
    col = "var(--dim)" if placeholder else "var(--ink)"
    n = f'<div style="font-size:11px;color:var(--dim);margin-top:6px;">{note}</div>' if note else ""
    return f"""<div>
      <div class="caps">{label}</div>
      <div style="height:48px;margin-top:7px;border:1px solid var(--line);background:var(--bg1);
           display:flex;align-items:center;padding:0 13px;font-size:14px;color:{col};">{value}</div>{n}
    </div>"""

def btn(label, primary=True, height=52):
    if primary:
        return (f'<div style="height:{height}px;background:var(--accent);color:var(--accent-fg);'
                f'display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;">{label}</div>')
    return (f'<div style="height:{height}px;border:1px solid var(--line);background:var(--bg1);color:var(--ink);'
            f'display:flex;align-items:center;justify-content:center;gap:8px;font-size:13.5px;font-weight:500;">{label}</div>')

# ---------------------------------------------------------------- registration
steps = ""
for i, (lab, state) in enumerate([("Event", "done"), ("Details", "now"), ("Payment", "next")]):
    if state == "done":
        mark, col, bg = "✓", "var(--accent-fg)", "var(--accent)"
    elif state == "now":
        mark, col, bg = str(i + 1), "var(--accent-fg)", "var(--accent)"
    else:
        mark, col, bg = str(i + 1), "var(--dim)", "var(--bg2)"
    weight = "600" if state != "next" else "400"
    tcol = "var(--ink)" if state != "next" else "var(--dim)"
    steps += (f'<div style="display:flex;align-items:center;gap:7px;">'
              f'<span class="mono" style="width:20px;height:20px;background:{bg};color:{col};font-size:10px;'
              f'display:flex;align-items:center;justify-content:center;font-weight:600;">{mark}</span>'
              f'<span style="font-size:11.5px;font-weight:{weight};color:{tcol};">{lab}</span></div>')
    if i < 2:
        steps += '<div style="flex:1;height:1px;background:var(--line);"></div>'

prev_rows = ""
for name, year, result in [("Monsoon Hardcourt Open", "2026", "Semi-final"),
                           ("State Ranking Series 3", "2025", "Round of 16"),
                           ("City Championship", "2025", "Winner")]:
    prev_rows += (f'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;'
                  f'padding:11px 0;border-bottom:1px solid var(--line);">'
                  f'<div style="min-width:0;"><div style="font-size:13px;font-weight:500;white-space:nowrap;'
                  f'overflow:hidden;text-overflow:ellipsis;">{name}</div>'
                  f'<div class="mono" style="font-size:10.5px;color:var(--dim);margin-top:3px;">{year}</div></div>'
                  f'<div class="mono" style="font-size:11px;color:var(--muted);white-space:nowrap;">{result}</div></div>')

reg = phone(f"""
  {topbar("Autumn Open 2026 · Entry", "Your details")}
  <div style="padding:14px 20px 0;display:flex;align-items:center;gap:9px;">{steps}</div>
  <div style="flex:1;min-height:0;overflow:hidden;padding:18px 20px 0;display:flex;flex-direction:column;gap:16px;">
    {field("Full name", "Gaurav Pillai")}
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
      {field("Age", "19")}
      {field("Best ranking", "State 24")}
    </div>
    {field("Email", "gaurav.pillai@example.com", note="Your player account and confirmation go to this address.")}
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div class="caps">Previous tournaments</div>
        <div style="display:flex;align-items:center;gap:5px;color:var(--accent);font-size:12px;font-weight:600;">{PLUS}Add</div>
      </div>
      <div style="margin-top:6px;background:var(--bg1);border:1px solid var(--line);padding:2px 13px 0;">{prev_rows}</div>
    </div>
  </div>
  <div style="padding:16px 20px 22px;background:var(--bg1);border-top:1px solid var(--line);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;">
      <div><div class="caps">Men's singles · Main draw</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">Entry closes 22 Sep, 18:00</div></div>
      <div class="mono" style="font-size:22px;font-weight:600;">[ENTRY FEE]</div>
    </div>
    {btn("Continue to payment")}
  </div>""")

# --------------------------------------------------------------------- scoring
def score_row(name, seed, sets, pts, serving):
    dot = ('<span style="width:7px;height:7px;background:var(--accent);"></span>' if serving
           else '<span style="width:7px;height:7px;"></span>')
    cells = ""
    for i, s in enumerate(sets):
        done = i < len(sets) - 1
        col = "var(--dim)" if done else "var(--ink)"
        cells += (f'<span class="mono" style="width:30px;text-align:center;font-size:20px;font-weight:600;'
                  f'color:{col};">{s}</span>')
    return (f'<div style="display:flex;align-items:center;gap:11px;height:56px;'
            f'border-bottom:1px solid var(--line);">{dot}'
            f'<span class="mono" style="font-size:10px;color:var(--dim);width:12px;">{seed or ""}</span>'
            f'<span style="flex:1;min-width:0;font-size:15px;font-weight:600;white-space:nowrap;'
            f'overflow:hidden;text-overflow:ellipsis;">{name}</span>{cells}'
            f'<span class="mono" style="width:44px;text-align:right;font-size:26px;font-weight:600;'
            f'color:var(--accent);">{pts}</span></div>')

small = []
for lab in ["Fault", "Double fault", "Let", "Undo"]:
    icon = UNDO if lab == "Undo" else ""
    small.append(f'<div style="height:46px;border:1px solid var(--line);background:var(--bg1);display:flex;'
                 f'align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:500;'
                 f'color:var(--muted);">{icon}{lab}</div>')

scoring = phone(f"""
  {topbar("Court 1 · M21", "Men's singles · R16",
          '<span class="mono" style="font-size:10px;color:var(--good);">SYNCED 2s</span>')}
  <div style="padding:16px 20px 0;">
    <div style="background:var(--bg1);border:1px solid var(--line);padding:4px 16px 0;">
      <div style="display:flex;justify-content:flex-end;gap:11px;padding:9px 0 6px;">
        <span class="thead" style="width:30px;text-align:center;">S1</span>
        <span class="thead" style="width:30px;text-align:center;">S2</span>
        <span class="thead" style="width:44px;text-align:right;">PTS</span>
      </div>
      {score_row("Y. Malhotra", "3", ["6", "3"], "40", True)}
      {score_row("G. Pillai", None, ["4", "2"], "40", False)}
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
        <span class="mono" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);">Deuce</span>
        <span class="mono" style="font-size:11px;color:var(--dim);">1:42 ELAPSED · GAME 6</span>
      </div>
    </div>
  </div>
  <div style="flex:1;min-height:0;padding:16px 20px 0;display:flex;flex-direction:column;gap:11px;">
    <div style="height:70px;background:var(--accent);color:var(--accent-fg);display:flex;align-items:center;
         justify-content:space-between;padding:0 20px;">
      <span style="font-size:16px;font-weight:600;">Point — Malhotra</span>
      <span class="mono" style="font-size:11px;letter-spacing:.08em;">SERVING</span>
    </div>
    <div style="height:70px;border:1px solid var(--line);background:var(--bg1);display:flex;align-items:center;
         padding:0 20px;"><span style="font-size:16px;font-weight:600;">Point — Pillai</span></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;">{''.join(small)}</div>
  </div>
  <div style="padding:14px 20px 22px;background:var(--bg1);border-top:1px solid var(--line);
       display:flex;align-items:center;justify-content:space-between;">
    <span class="mono" style="font-size:11px;color:var(--muted);">CHANGE ENDS AFTER THIS GAME</span>
    <span style="font-size:12.5px;font-weight:600;color:var(--accent);">Match menu</span>
  </div>""")

# ----------------------------------------------------------------- player card
def stat(label, value, unit=""):
    return (f'<div><div class="caps" style="font-size:10px;">{label}</div>'
            f'<div style="display:flex;align-items:baseline;gap:3px;margin-top:6px;">'
            f'<span class="mono" style="font-size:22px;font-weight:600;">{value}</span>'
            f'<span class="mono" style="font-size:11px;color:var(--dim);">{unit}</span></div></div>')

hist = ""
for name, year, result in [("Monsoon Hardcourt Open", "2026", "SF"),
                           ("State Ranking Series 3", "2025", "R16"),
                           ("City Championship", "2025", "W")]:
    hist += (f'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;'
             f'padding:11px 0;border-bottom:1px solid var(--line);">'
             f'<div style="min-width:0;"><div style="font-size:12.5px;font-weight:500;white-space:nowrap;'
             f'overflow:hidden;text-overflow:ellipsis;">{name}</div>'
             f'<div class="mono" style="font-size:10px;color:var(--dim);margin-top:3px;">{year}</div></div>'
             f'<div class="mono" style="font-size:12px;font-weight:600;color:var(--muted);">{result}</div></div>')

card = phone(f"""
  {topbar("Autumn Open 2026 · Player", "Player card",
          '<span class="mono" style="font-size:10px;color:var(--dim);">FL-2026-0117</span>')}
  <div style="flex:1;min-height:0;overflow:hidden;">
    <div style="background:var(--bg1);border-bottom:1px solid var(--line);padding:20px;display:flex;gap:16px;align-items:center;">
      <div style="width:72px;height:72px;flex:none;background:var(--bg2);border:1px solid var(--line);
           display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:22px;
           font-weight:600;color:var(--dim);">GP</div>
      <div style="min-width:0;">
        <div style="font-size:20px;font-weight:600;letter-spacing:-.01em;">Gaurav Pillai</div>
        <div class="mono" style="font-size:11px;color:var(--muted);margin-top:5px;">19 YRS · RIGHT-HANDED</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:9px;">
          <span style="width:6px;height:6px;background:var(--accent);"></span>
          <span class="mono" style="font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);">On court now · R16</span>
        </div>
      </div>
    </div>
    <div style="padding:18px 20px 0;display:flex;flex-direction:column;gap:18px;">
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;">
        {stat("Best ranking", "24", "state")}
        {stat("Matches", "31")}
        {stat("Win–loss", "21–10")}
      </div>
      <div style="border-top:1px solid var(--line);"></div>
      <div>
        <div class="caps">Contact</div>
        <div style="font-size:13px;margin-top:7px;">gaurav.pillai@example.com</div>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div class="caps">Previous tournaments</div>
          <span class="mono" style="font-size:10px;color:var(--dim);">3 ENTERED</span>
        </div>
        <div style="margin-top:4px;">{hist}</div>
      </div>
    </div>
  </div>
  <div style="padding:16px 20px 22px;background:var(--bg1);border-top:1px solid var(--line);
       display:flex;flex-direction:column;gap:10px;">
    {btn(DOWN + "Participation certificate", primary=False, height=48)}
    {btn(SHARE + "Share card", primary=False, height=48)}
  </div>""")

# --------------------------------------------------------------- challenge kit
tabs = ""
for lab, active in [("Serve", 1), ("Groundstroke", 0), ("Accuracy", 0), ("Reaction", 0)]:
    if active:
        tabs += ('<div style="height:38px;padding:0 14px;display:flex;align-items:center;font-size:12.5px;'
                 'font-weight:600;border-bottom:2px solid var(--accent);color:var(--accent);">' + lab + '</div>')
    else:
        tabs += ('<div style="height:38px;padding:0 14px;display:flex;align-items:center;font-size:12.5px;'
                 'color:var(--muted);border-bottom:2px solid transparent;">' + lab + '</div>')

attempts = ""
for n, speed, land, best in [("03", "168", "Wide · in", True), ("02", "161", "Body · in", False),
                             ("01", "154", "T · fault", False)]:
    col = "var(--accent)" if best else "var(--ink)"
    tag = ('<span class="mono" style="font-size:9.5px;letter-spacing:.08em;color:var(--accent);">BEST</span>'
           if best else "")
    attempts += (f'<div style="display:flex;align-items:center;gap:12px;padding:13px 0;'
                 f'border-bottom:1px solid var(--line);">'
                 f'<span class="mono" style="font-size:10px;color:var(--dim);width:18px;">{n}</span>'
                 f'<span style="flex:1;font-size:12.5px;color:var(--muted);">{land}</span>{tag}'
                 f'<span class="mono" style="font-size:18px;font-weight:600;color:{col};width:48px;'
                 f'text-align:right;">{speed}</span></div>')

court = """<svg width="130" height="150" viewBox="0 0 130 150" fill="none">
  <rect x="1" y="1" width="128" height="148" stroke="var(--line)" stroke-width="1.5"/>
  <line x1="1" y1="75" x2="129" y2="75" stroke="var(--line)" stroke-width="1.5"/>
  <line x1="65" y1="1" x2="65" y2="75" stroke="var(--line)" stroke-width="1.5"/>
  <rect x="1" y="1" width="64" height="74" fill="var(--bg2)"/>
  <circle cx="18" cy="26" r="4.5" fill="var(--accent)"/>
  <circle cx="41" cy="52" r="4.5" fill="var(--dim)"/>
  <circle cx="72" cy="22" r="4.5" fill="none" stroke="var(--bad)" stroke-width="1.5"/>
</svg>"""

chal = phone(f"""
  {topbar("Court 3 · Challenge Kit", "Serve speed challenge",
          '<span class="mono" style="font-size:10px;color:var(--dim);">12:00–14:00</span>')}
  <div style="display:flex;background:var(--bg1);border-bottom:1px solid var(--line);padding:0 8px;">{tabs}</div>
  <div style="flex:1;min-height:0;overflow:hidden;padding:20px;display:flex;flex-direction:column;gap:18px;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;">
      <div>
        <div class="caps">Best of 3 attempts</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:8px;">
          <span class="mono" style="font-size:56px;font-weight:600;line-height:1;letter-spacing:-.03em;">168</span>
          <span class="mono" style="font-size:14px;color:var(--dim);">km/h</span>
        </div>
        <div class="mono" style="font-size:11px;color:var(--muted);margin-top:9px;letter-spacing:.06em;">
          9TH TODAY · MEN'S</div>
      </div>
      <div style="flex:none;">{court}</div>
    </div>
    <div>
      <div class="caps">Attempts</div>
      <div style="margin-top:4px;">{attempts}</div>
    </div>
    <div>
      <div class="caps">Radar reading</div>
      <div style="display:flex;gap:10px;margin-top:8px;">
        <div style="flex:1;height:48px;border:1px solid var(--line);background:var(--bg1);display:flex;
             align-items:center;padding:0 13px;font-family:var(--mono);font-size:15px;color:var(--dim);">km/h</div>
        <div style="width:120px;height:48px;background:var(--accent);color:var(--accent-fg);display:flex;
             align-items:center;justify-content:center;font-size:13.5px;font-weight:600;">Add attempt</div>
      </div>
    </div>
  </div>
  <div style="padding:14px 20px 22px;background:var(--bg1);border-top:1px solid var(--line);">
    <div style="font-size:11px;color:var(--dim);line-height:1.5;">
      Measured with [RADAR MODEL] behind the baseline. Readings are for this event only and
      are not comparable with broadcast radar.</div>
  </div>""")

for fn, b in [("Registration.dc.html", reg), ("Scoring.dc.html", scoring),
              ("PlayerCard.dc.html", card), ("ChallengeKit.dc.html", chal)]:
    open(fn, "w").write(shell(LIGHT, b))
    print("wrote", fn)
