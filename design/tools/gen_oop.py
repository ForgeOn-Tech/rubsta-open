from tokens import LIGHT, shell

NAV = [("Overview",0),("Entries",0),("Draws",0),("Order of play",1),
       ("Results",0),("Players",0),("Certificates",0),("Sponsors",0)]

def nav():
    out = ""
    for label, active in NAV:
        if active:
            out += (f'<div style="display:flex;align-items:center;height:34px;padding:0 16px;'
                    f'background:var(--bg2);border-left:2px solid var(--accent);'
                    f'font-size:13px;font-weight:600;color:var(--accent);">{label}</div>')
        else:
            out += (f'<div style="display:flex;align-items:center;height:34px;padding:0 18px;'
                    f'font-size:13px;color:var(--muted);">{label}</div>')
    return out

def chip(text, kind):
    if kind == "live":
        return (f'<span style="display:inline-flex;align-items:center;gap:5px;height:19px;padding:0 7px;'
                f'background:var(--accent);color:var(--accent-fg);font-family:var(--mono);font-size:9.5px;'
                f'letter-spacing:.08em;text-transform:uppercase;font-weight:600;">'
                f'<span style="width:5px;height:5px;background:var(--accent-fg);"></span>{text}</span>')
    if kind == "done":
        return (f'<span style="display:inline-flex;align-items:center;height:19px;padding:0 7px;'
                f'border:1px solid var(--line);color:var(--dim);font-family:var(--mono);font-size:9.5px;'
                f'letter-spacing:.08em;text-transform:uppercase;">{text}</span>')
    return (f'<span style="display:inline-flex;align-items:center;height:19px;padding:0 7px;'
            f'background:var(--bg2);color:var(--muted);font-family:var(--mono);font-size:9.5px;'
            f'letter-spacing:.08em;text-transform:uppercase;">{text}</span>')

def player(name, seed=None, score=None, win=False, live=False):
    sd = (f'<span class="mono" style="font-size:10px;color:var(--dim);width:12px;">{seed}</span>'
          if seed else '<span style="width:12px;"></span>')
    w = "600" if win else "500"
    c = "var(--ink)" if (win or live) else "var(--muted)"
    sc = ""
    if score:
        col = "var(--accent)" if live else ("var(--ink)" if win else "var(--dim)")
        sc = (f'<span class="mono" style="font-size:12px;font-weight:600;color:{col};'
              f'letter-spacing:.04em;">{score}</span>')
    return (f'<div style="display:flex;align-items:center;gap:7px;height:22px;">{sd}'
            f'<span style="flex:1;min-width:0;font-size:12.5px;font-weight:{w};color:{c};'
            f'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{name}</span>{sc}</div>')

def card(no, event, rows, time_note, umpire, status=None):
    st = chip(*status) if status else ""
    return f"""<div style="background:var(--bg1);border:1px solid var(--line);padding:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;">
        <div style="display:flex;align-items:baseline;gap:7px;">
          <span class="mono" style="font-size:10px;color:var(--dim);">{no}</span>
          <span class="caps" style="font-size:10px;">{event}</span>
        </div>{st}
      </div>
      <div style="border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:5px 0;">{rows}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:9px;">
        <span class="mono" style="font-size:10.5px;color:var(--muted);letter-spacing:.04em;">{time_note}</span>
        <span class="mono" style="font-size:10px;color:var(--dim);">{umpire}</span>
      </div>
    </div>"""

def block(title, sub, note):
    return f"""<div style="background:var(--bg2);border:1px dashed var(--line);padding:14px;">
      <div class="caps" style="font-size:10px;">{sub}</div>
      <div style="font-size:13px;font-weight:600;margin-top:6px;">{title}</div>
      <div class="mono" style="font-size:10.5px;color:var(--muted);margin-top:7px;letter-spacing:.04em;">{note}</div>
    </div>"""

courts = [
  ("Court 1", "Centre · Hard", [
    card("M15", "Women's singles · R16",
         player("S. Kaul", "1", "6 6", win=True) + player("R. Menezes", None, "2 1"),
         "11:00 · Completed", "Umpire: [NAME]", ("Result in", "done")),
    card("M21", "Men's singles · R16",
         player("Y. Malhotra", "3", "6 3", live=True) + player("G. Pillai", None, "4 2", live=True),
         "From 12:30 · Set 2", "Umpire: [NAME]", ("Live", "live")),
    card("M23", "Men's singles · R16",
         player("C. Varma", "7") + player("E. Sodhi"),
         "Not before 15:30", "Umpire: [NAME]", ("To play", "next")),
  ]),
  ("Court 2", "Show court · Hard", [
    card("M16", "Women's singles · R16",
         player("T. Bedi", "4", "7 6", win=True) + player("A. Rane", None, "5 4"),
         "11:00 · Completed", "Umpire: [NAME]", ("Result in", "done")),
    card("M24", "Men's singles · R16",
         player("I. Bhandari") + player("N. Sundaram", "2"),
         "Not before 15:30", "Umpire: [NAME]", ("To play", "next")),
    card("M30", "Boys U-18 · QF",
         player("Winner M25") + player("Winner M26"),
         "Not before 17:00", "Umpire: [NAME]", ("To play", "next")),
  ]),
  ("Court 3", "Outer · Hard", [
    card("M22", "Men's singles · R16",
         player("L. Tandon") + player("F. Ansari", "6"),
         "14:00", "Umpire: [NAME]", ("To play", "next")),
    card("M17", "Women's singles · R16",
         player("P. Nagpal", "5") + player("D. Sethi"),
         "Not before 16:00", "Umpire: [NAME]", ("To play", "next")),
    block("Serve Speed Challenge", "Challenge Kit · open session",
          "12:00–14:00 · Radar on baseline · Walk-up entry"),
  ]),
  ("Court 4", "Outer · Hard", [
    card("M18", "Women's singles · R16",
         player("M. Dhillon", None, "6 6", win=True) + player("K. Rebello", None, "4 2"),
         "11:00 · Completed", "Umpire: [NAME]", ("Result in", "done")),
    card("M25", "Boys U-18 · QF",
         player("A. Trivedi", "1") + player("H. Barman"),
         "13:00", "Umpire: [NAME]", ("To play", "next")),
    card("M26", "Boys U-18 · QF",
         player("S. Lobo") + player("V. Rastogi", "4"),
         "Not before 14:30", "Umpire: [NAME]", ("To play", "next")),
  ]),
]

cols = ""
for name, surface, cards in courts:
    cols += f"""<div style="display:flex;flex-direction:column;gap:12px;">
      <div style="padding-bottom:9px;border-bottom:2px solid var(--ink);">
        <div style="font-size:14px;font-weight:600;">{name}</div>
        <div class="mono" style="font-size:10px;color:var(--dim);margin-top:3px;letter-spacing:.06em;text-transform:uppercase;">{surface}</div>
      </div>
      {''.join(cards)}
    </div>"""

days = ""
for label, active in [("Fri 25 Sep", 0), ("Sat 26 Sep", 1), ("Sun 27 Sep", 0)]:
    if active:
        days += ('<div style="height:32px;padding:0 14px;display:flex;align-items:center;font-size:12px;'
                 'font-weight:600;background:var(--bg2);">' + label + '</div>')
    else:
        days += ('<div style="height:32px;padding:0 14px;display:flex;align-items:center;font-size:12px;'
                 'color:var(--muted);border-left:1px solid var(--line);">' + label + '</div>')

body = f"""<div style="width:1440px;height:900px;display:flex;background:var(--bg0);overflow:hidden;">

  <div style="width:220px;flex:none;background:var(--bg1);border-right:1px solid var(--line);display:flex;flex-direction:column;">
    <div style="padding:20px 18px 18px;border-bottom:1px solid var(--line);">
      <div style="display:flex;align-items:center;gap:9px;">
        <div style="width:22px;height:22px;background:var(--accent);color:var(--accent-fg);
             font-family:var(--mono);font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;">F</div>
        <div style="font-size:13px;font-weight:600;letter-spacing:.02em;">ForgeLabs</div>
      </div>
      <div class="eyebrow" style="margin-top:10px;">Tournament OS</div>
    </div>
    <div style="padding:12px 0;display:flex;flex-direction:column;">{nav()}</div>
    <div style="margin-top:auto;padding:16px 18px;border-top:1px solid var(--line);">
      <div class="caps">Tournament</div>
      <div style="font-size:13px;font-weight:600;margin-top:5px;">Autumn Open 2026</div>
      <div class="mono" style="font-size:10.5px;color:var(--dim);margin-top:3px;">25–27 Sep · [VENUE]</div>
    </div>
  </div>

  <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
    <div style="padding:22px 24px 16px;border-bottom:1px solid var(--line);background:var(--bg1);">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;">
        <div>
          <div class="eyebrow">Autumn Open 2026 · Day 2</div>
          <div style="font-size:24px;font-weight:600;letter-spacing:-.02em;margin-top:7px;">Order of play</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="display:flex;border:1px solid var(--line);">{days}</div>
          <div style="height:32px;padding:0 14px;display:flex;align-items:center;font-size:12px;color:var(--muted);border:1px solid var(--line);">Print sheet</div>
          <div style="height:32px;padding:0 16px;display:flex;align-items:center;font-size:12px;font-weight:600;background:var(--accent);color:var(--accent-fg);">Publish schedule</div>
        </div>
      </div>
      <div style="display:flex;gap:22px;margin-top:14px;">
        <div class="mono" style="font-size:11px;color:var(--dim);">PLAY FROM 11:00</div>
        <div class="mono" style="font-size:11px;color:var(--dim);">4 COURTS</div>
        <div class="mono" style="font-size:11px;color:var(--dim);">11 MATCHES</div>
        <div class="mono" style="font-size:11px;color:var(--accent);">1 LIVE</div>
        <div class="mono" style="font-size:11px;color:var(--dim);">LAST UPDATE 13:12</div>
      </div>
    </div>

    <div style="flex:1;min-height:0;padding:20px 24px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;align-content:start;">
      {cols}
    </div>
  </div>
</div>"""

open("OrderOfPlay.dc.html","w").write(shell(LIGHT, body))
print("ok")
