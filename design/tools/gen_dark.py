from tokens import DARK, shell

def svg(paths, size=18, w="1.5"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{paths}</svg>')

CHEV_L = svg('<path d="M15 18l-6-6 6-6"/>')
CLAP   = svg('<path d="M5 13l-2-3.5a1.6 1.6 0 0 1 2.7-1.7L8 11"/><path d="M8 11V4.6a1.6 1.6 0 0 1 3.2 0V11"/><path d="M11.2 11V5.6a1.6 1.6 0 0 1 3.2 0V11"/><path d="M14.4 11V7.4a1.6 1.6 0 0 1 3.2 0V14a7 7 0 0 1-7 7H10a5 5 0 0 1-4-2l-1-1.4"/>', 20)
FIRE   = svg('<path d="M12 3s4.5 3.6 4.5 8a4.5 4.5 0 0 1-9 0c0-1.4.6-2.6 1.3-3.5"/><path d="M12 21a5 5 0 0 0 5-5c0-2.2-1.5-4-2.5-5"/>', 20)
BALL   = svg('<circle cx="12" cy="12" r="9"/><path d="M4.2 8.5A7 7 0 0 1 12 15a7 7 0 0 1 7.8-6.5"/><path d="M4.2 15.5A7 7 0 0 0 12 9a7 7 0 0 0 7.8 6.5"/>', 20)
SEND   = svg('<path d="M21 3L11 14"/><path d="M21 3l-6.5 18-3.5-7.5L3.5 10 21 3z"/>', 18)

def head(right_label, mid=None):
    m = ""
    if mid:
        m = (f'<div style="display:flex;align-items:center;gap:8px;">'
             f'<span style="width:8px;height:8px;background:var(--accent);"></span>'
             f'<span class="mono" style="font-size:12px;letter-spacing:.16em;color:var(--accent);">{mid}</span></div>')
    return f"""<div style="height:72px;flex:none;background:var(--bg1);border-bottom:1px solid var(--line);
       display:flex;align-items:center;justify-content:space-between;padding:0 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:26px;height:26px;background:var(--accent);color:var(--accent-fg);font-family:var(--mono);
             font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;">F</div>
        <div>
          <div style="font-size:14px;font-weight:600;letter-spacing:.02em;">Autumn Open 2026</div>
          <div class="eyebrow" style="margin-top:3px;">ForgeLabs LiveScore</div>
        </div>
      </div>
      {m}
      <div class="mono" style="font-size:12px;color:var(--muted);letter-spacing:.06em;">{right_label}</div>
    </div>"""

def foot(note):
    return f"""<div style="height:56px;flex:none;background:var(--bg1);border-top:1px solid var(--line);
       display:flex;align-items:center;justify-content:space-between;padding:0 32px;">
      <span class="mono" style="font-size:11px;color:var(--dim);letter-spacing:.06em;">{note}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="mono" style="font-size:10px;color:var(--dim);letter-spacing:.14em;">PARTNER</span>
        <div style="width:132px;height:28px;border:1px dashed var(--line);display:flex;align-items:center;
             justify-content:center;font-family:var(--mono);font-size:10px;color:var(--dim);">[SPONSOR]</div>
      </div>
    </div>"""

# ------------------------------------------------------------------ live board
def big_row(name, seed, sets, pts, serving):
    dot = ('<span style="width:10px;height:10px;background:var(--accent);"></span>' if serving
           else '<span style="width:10px;height:10px;"></span>')
    cells = ""
    for i, s in enumerate(sets):
        done = i < len(sets) - 1
        col = "var(--muted)" if done else "var(--ink)"
        cells += (f'<span class="mono" style="width:52px;text-align:center;font-size:40px;font-weight:600;'
                  f'color:{col};line-height:1;">{s}</span>')
    sd = f'<span class="mono" style="font-size:14px;color:var(--dim);width:22px;">{seed}</span>' if seed else '<span style="width:22px;"></span>'
    return (f'<div style="display:flex;align-items:center;gap:18px;height:88px;'
            f'border-bottom:1px solid var(--line);">{dot}{sd}'
            f'<span style="flex:1;min-width:0;font-size:30px;font-weight:600;letter-spacing:-.01em;">{name}</span>'
            f'{cells}<span class="mono" style="width:76px;text-align:right;font-size:44px;font-weight:600;'
            f'color:var(--accent);line-height:1;">{pts}</span></div>')

stats = ""
for label, a, b in [("Aces", "6", "3"), ("Double faults", "1", "4"), ("First serve in", "68%", "54%"),
                    ("Winners", "14", "9"), ("Unforced errors", "11", "18"), ("Break points won", "2/4", "0/2")]:
    stats += (f'<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;'
              f'border-bottom:1px solid var(--line);">'
              f'<span class="mono" style="width:56px;font-size:16px;font-weight:600;">{a}</span>'
              f'<span class="caps" style="font-size:11px;text-align:center;flex:1;">{label}</span>'
              f'<span class="mono" style="width:56px;text-align:right;font-size:16px;font-weight:600;'
              f'color:var(--muted);">{b}</span></div>')

def mini(court, event, p1, s1, p2, s2, state, live=False):
    col = "var(--accent)" if live else "var(--dim)"
    return (f'<div style="padding:13px 0;border-bottom:1px solid var(--line);">'
            f'<div style="display:flex;align-items:center;justify-content:space-between;">'
            f'<span class="mono" style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);">{court} · {event}</span>'
            f'<span class="mono" style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:{col};">{state}</span></div>'
            f'<div style="display:flex;justify-content:space-between;margin-top:9px;">'
            f'<span style="font-size:14px;font-weight:500;">{p1}</span>'
            f'<span class="mono" style="font-size:14px;font-weight:600;">{s1}</span></div>'
            f'<div style="display:flex;justify-content:space-between;margin-top:5px;">'
            f'<span style="font-size:14px;font-weight:500;color:var(--muted);">{p2}</span>'
            f'<span class="mono" style="font-size:14px;color:var(--muted);">{s2}</span></div></div>')

live = f"""<div style="width:1280px;height:720px;background:var(--bg0);display:flex;flex-direction:column;overflow:hidden;">
  {head("SAT 26 SEP · 13:12", "LIVE")}
  <div style="flex:1;min-height:0;display:flex;">
    <div style="flex:1;min-width:0;padding:28px 32px;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class="eyebrow">Court 1 · Men's singles · Round of 16</span>
        <span class="mono" style="font-size:11px;color:var(--dim);letter-spacing:.08em;">M21 · 1:42 ELAPSED</span>
      </div>
      <div style="margin-top:18px;border-top:1px solid var(--line);">
        <div style="display:flex;justify-content:flex-end;gap:0;padding:10px 0 6px;">
          <span class="thead" style="width:52px;text-align:center;">SET 1</span>
          <span class="thead" style="width:52px;text-align:center;">SET 2</span>
          <span class="thead" style="width:76px;text-align:right;">POINTS</span>
        </div>
        {big_row("Y. Malhotra", "3", ["6", "3"], "40", True)}
        {big_row("G. Pillai", None, ["4", "2"], "40", False)}
      </div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:16px;">
        <span style="height:26px;padding:0 10px;background:var(--accent);color:var(--accent-fg);
             font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;display:flex;
             align-items:center;">DEUCE</span>
        <span class="mono" style="font-size:11px;color:var(--muted);letter-spacing:.06em;">MALHOTRA SERVING · GAME 6</span>
      </div>
      <div style="margin-top:22px;">
        <div class="thead" style="padding-bottom:4px;">Match statistics</div>
        {stats}
      </div>
    </div>
    <div style="width:392px;flex:none;border-left:1px solid var(--line);padding:28px 32px;
         display:flex;flex-direction:column;">
      <div class="thead">Also on court</div>
      <div style="margin-top:4px;">
        {mini("Court 4", "Boys U-18 QF", "A. Trivedi", "6 4 1", "H. Barman", "3 6 2", "Live · Set 3", True)}
        {mini("Court 3", "Men's singles R16", "L. Tandon", "—", "F. Ansari", "—", "14:00")}
      </div>
      <div class="thead" style="margin-top:26px;">Latest results</div>
      <div style="margin-top:4px;">
        {mini("Court 2", "Men's singles R16", "M. Rathore", "6 6", "V. Naidu", "4 4", "Final")}
        {mini("Court 1", "Men's singles R32", "C. Varma", "7 6", "Z. Khatri", "6(5) 4", "Final")}
        {mini("Court 2", "Women's singles R16", "T. Bedi", "7 6", "A. Rane", "5 4", "Final")}
      </div>
    </div>
  </div>
  {foot("LIVE SCORES · [TOURNAMENT URL]")}
</div>"""

# ------------------------------------------------------------- challenge board
def podium(rank, name, club, speed):
    accent = rank == "1"
    col = "var(--accent)" if accent else "var(--ink)"
    border = "2px solid var(--accent)" if accent else "1px solid var(--line)"
    return f"""<div style="flex:1;background:var(--bg1);border:{border};padding:22px;display:flex;
         flex-direction:column;justify-content:space-between;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class="mono" style="font-size:13px;color:var(--dim);letter-spacing:.1em;">RANK {rank}</span>
      </div>
      <div style="margin-top:20px;">
        <div style="font-size:20px;font-weight:600;">{name}</div>
        <div class="mono" style="font-size:11px;color:var(--dim);margin-top:5px;letter-spacing:.06em;
             text-transform:uppercase;">{club}</div>
      </div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:22px;">
        <span class="mono" style="font-size:52px;font-weight:600;line-height:1;letter-spacing:-.03em;color:{col};">{speed}</span>
        <span class="mono" style="font-size:13px;color:var(--dim);">km/h</span>
      </div>
    </div>"""

rows = ""
for rank, name, club, best, fh, bh, att in [
        ("4", "G. Pillai", "City TC", "168", "131", "119", "3"),
        ("5", "E. Sodhi", "Riverside Academy", "166", "128", "121", "3"),
        ("6", "L. Tandon", "[CLUB]", "163", "134", "115", "2"),
        ("7", "I. Bhandari", "State Centre", "161", "126", "118", "3"),
        ("8", "J. Dsouza", "[CLUB]", "159", "129", "112", "3"),
        ("9", "H. Barman", "Riverside Academy", "157", "122", "116", "2")]:
    rows += (f'<div style="display:grid;grid-template-columns:64px 1fr 200px 96px 96px 96px 88px;'
             f'align-items:center;padding:14px 0;border-bottom:1px solid var(--line);">'
             f'<span class="mono" style="font-size:14px;color:var(--dim);">{rank}</span>'
             f'<span style="font-size:16px;font-weight:500;">{name}</span>'
             f'<span class="mono" style="font-size:12px;color:var(--dim);">{club}</span>'
             f'<span class="mono" style="font-size:18px;font-weight:600;text-align:right;">{best}</span>'
             f'<span class="mono" style="font-size:15px;color:var(--muted);text-align:right;">{fh}</span>'
             f'<span class="mono" style="font-size:15px;color:var(--muted);text-align:right;">{bh}</span>'
             f'<span class="mono" style="font-size:13px;color:var(--dim);text-align:right;">{att}</span></div>')

board = f"""<div style="width:1280px;height:720px;background:var(--bg0);display:flex;flex-direction:column;overflow:hidden;">
  {head("SAT 26 SEP · 13:12", "CHALLENGE KIT")}
  <div style="flex:1;min-height:0;padding:26px 32px;display:flex;flex-direction:column;">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;">
      <div>
        <div class="eyebrow">Court 3 · Open session 12:00–14:00</div>
        <div style="font-size:26px;font-weight:600;letter-spacing:-.02em;margin-top:8px;">Serve speed challenge — men's</div>
      </div>
      <span class="mono" style="font-size:11px;color:var(--dim);letter-spacing:.08em;">UPDATED 13:09 · 3 ATTEMPTS EACH</span>
    </div>
    <div style="display:flex;gap:16px;margin-top:20px;height:196px;">
      {podium("1", "M. Rathore", "State Centre · seed 8", "182")}
      {podium("2", "Y. Malhotra", "City TC · seed 3", "176")}
      {podium("3", "C. Varma", "[CLUB] · seed 7", "171")}
    </div>
    <div style="margin-top:24px;display:grid;grid-template-columns:64px 1fr 200px 96px 96px 96px 88px;
         padding-bottom:8px;border-bottom:1px solid var(--line);">
      <span class="thead">#</span><span class="thead">Player</span><span class="thead">Club</span>
      <span class="thead" style="text-align:right;">Serve</span>
      <span class="thead" style="text-align:right;">FH</span>
      <span class="thead" style="text-align:right;">BH</span>
      <span class="thead" style="text-align:right;">Att.</span>
    </div>
    {rows}
  </div>
  {foot("SPEEDS IN KM/H · [RADAR MODEL] BEHIND THE BASELINE · EVENT USE ONLY")}
</div>"""

# -------------------------------------------------------------------- fan zone
def option(name, pct, lead):
    bar = "var(--accent)" if lead else "var(--bg2)"
    return f"""<div style="position:relative;height:52px;border:1px solid var(--line);margin-bottom:10px;
         display:flex;align-items:center;overflow:hidden;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:{pct}%;background:{bar};opacity:{'0.22' if lead else '1'};"></div>
      <div style="position:relative;display:flex;align-items:center;justify-content:space-between;
           width:100%;padding:0 15px;">
        <span style="font-size:14px;font-weight:600;">{name}</span>
        <span class="mono" style="font-size:14px;font-weight:600;color:{'var(--accent)' if lead else 'var(--muted)'};">{pct}%</span>
      </div>
    </div>"""

comments = ""
for ini, who, text, when in [("RS", "Rhea S.", "That backhand down the line was ridiculous", "2m"),
                             ("AK", "Arjun K.", "Pillai has to hold here or the set is gone", "1m"),
                             ("MV", "Meera V.", "Court 4 is the better match honestly", "just now")]:
    comments += (f'<div style="display:flex;gap:11px;padding:11px 0;border-bottom:1px solid var(--line);">'
                 f'<div style="width:30px;height:30px;flex:none;background:var(--bg2);display:flex;'
                 f'align-items:center;justify-content:center;font-family:var(--mono);font-size:11px;'
                 f'color:var(--muted);">{ini}</div>'
                 f'<div style="min-width:0;flex:1;">'
                 f'<div style="display:flex;align-items:baseline;gap:8px;">'
                 f'<span style="font-size:12px;font-weight:600;">{who}</span>'
                 f'<span class="mono" style="font-size:10px;color:var(--dim);">{when}</span></div>'
                 f'<div style="font-size:13px;color:var(--muted);margin-top:3px;line-height:1.45;">{text}</div>'
                 f'</div></div>')

reactions = ""
for icon, count in [(CLAP, "312"), (FIRE, "184"), (BALL, "97")]:
    reactions += (f'<div style="flex:1;height:46px;border:1px solid var(--line);display:flex;align-items:center;'
                  f'justify-content:center;gap:8px;color:var(--muted);">{icon}'
                  f'<span class="mono" style="font-size:12px;">{count}</span></div>')

fan = f"""<div style="width:390px;height:844px;background:var(--bg0);display:flex;flex-direction:column;overflow:hidden;">
  <div style="background:var(--bg1);border-bottom:1px solid var(--line);padding:16px 20px;
       display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;color:var(--muted);">{CHEV_L}
      <span class="eyebrow">Autumn Open 2026 · Fan zone</span></div>
    <span class="mono" style="font-size:10px;color:var(--dim);">2.1k WATCHING</span>
  </div>

  <div style="position:relative;width:390px;height:219px;background:var(--bg2);flex:none;
       display:flex;align-items:center;justify-content:center;">
    <span class="mono" style="font-size:11px;color:var(--dim);letter-spacing:.1em;">COURT 1 · LIVE STREAM</span>
    <div style="position:absolute;top:12px;left:12px;display:flex;align-items:center;gap:6px;height:22px;
         padding:0 8px;background:var(--accent);color:var(--accent-fg);">
      <span style="width:5px;height:5px;background:var(--accent-fg);"></span>
      <span class="mono" style="font-size:10px;font-weight:600;letter-spacing:.1em;">LIVE</span>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:0;background:var(--bg1);border-top:1px solid var(--line);
         padding:9px 14px;display:flex;flex-direction:column;gap:5px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:13px;font-weight:600;">Y. Malhotra <span class="mono" style="font-size:10px;color:var(--dim);">3</span></span>
        <span class="mono" style="font-size:13px;font-weight:600;">6 &nbsp;3 &nbsp;<span style="color:var(--accent);">40</span></span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:13px;color:var(--muted);">G. Pillai</span>
        <span class="mono" style="font-size:13px;color:var(--muted);">4 &nbsp;2 &nbsp;<span style="color:var(--accent);">40</span></span>
      </div>
    </div>
  </div>

  <div style="flex:1;min-height:0;overflow:hidden;padding:18px 20px 0;display:flex;flex-direction:column;gap:18px;">
    <div style="border:1px solid var(--line);background:var(--bg1);padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class="caps">Who takes this set?</span>
        <span class="mono" style="font-size:10px;color:var(--dim);">CLOSES AT 5 GAMES</span>
      </div>
      <div style="margin-top:13px;">
        {option("Y. Malhotra", 71, True)}
        {option("G. Pillai", 29, False)}
      </div>
      <div style="font-size:11px;color:var(--dim);line-height:1.5;">
        Predictions are for fun. No entry fee and no cash prize — you are playing for the
        tournament leaderboard only.</div>
    </div>

    <div style="display:flex;gap:10px;">{reactions}</div>

    <div>
      <div class="thead">Court chat</div>
      <div style="margin-top:2px;">{comments}</div>
    </div>
  </div>

  <div style="padding:12px 20px 22px;background:var(--bg1);border-top:1px solid var(--line);
       display:flex;gap:10px;align-items:center;">
    <div style="flex:1;height:46px;border:1px solid var(--line);display:flex;align-items:center;padding:0 14px;
         font-size:13px;color:var(--dim);">Say something…</div>
    <div style="width:46px;height:46px;background:var(--accent);color:var(--accent-fg);display:flex;
         align-items:center;justify-content:center;">{SEND}</div>
  </div>
</div>"""

for fn, b in [("LiveBoard.dc.html", live), ("ChallengeBoard.dc.html", board), ("FanZone.dc.html", fan)]:
    open(fn, "w").write(shell(DARK, b))
    print("wrote", fn)
