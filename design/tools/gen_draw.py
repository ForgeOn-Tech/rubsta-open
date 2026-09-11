from tokens import LIGHT, shell

def P(name, seed=None, bye=False, win=False, scores=None, tbd=False):
    return dict(name=name, seed=seed, bye=bye, win=win, scores=scores or [], tbd=tbd)

def M(top, bot, note=None, live=False):
    return dict(top=top, bot=bot, note=note, live=live)

r32 = [
    M(P("R. Menon", 1, win=True), P("Bye", bye=True), note="Bye"),
    M(P("A. Bhatt", win=True, scores=["6","6"]), P("K. Iyer", scores=["3","4"])),
    M(P("S. Grewal", scores=["5","2"]), P("V. Naidu", win=True, scores=["7","6"])),
    M(P("D. Chawla", scores=["2","1"]), P("M. Rathore", 8, win=True, scores=["6","6"])),
    M(P("T. Sengupta", 5, win=True, scores=["6","6"]), P("H. Patil", scores=["4","4"])),
    M(P("N. Qureshi", scores=["6","6","3"]), P("J. Dsouza", win=True, scores=["4","7","6"])),
    M(P("P. Bakshi", win=True, scores=["6","6"]), P("R. Kulkarni", scores=["1","4"])),
    M(P("Bye", bye=True), P("A. Fernandes", 4, win=True), note="Bye"),
    M(P("Y. Malhotra", 3, win=True), P("Bye", bye=True), note="Bye"),
    M(P("G. Pillai", win=True, scores=["6","3","7"]), P("S. Ahluwalia", scores=["4","6","5"])),
    M(P("B. Mathew", scores=["2","2"]), P("L. Tandon", win=True, scores=["6","6"])),
    M(P("O. Deshmukh", scores=["0","3"]), P("F. Ansari", 6, win=True, scores=["6","6"])),
    M(P("C. Varma", 7, win=True, scores=["7","6"]), P("Z. Khatri", scores=["6","4"])),
    M(P("U. Joshi", scores=["3","4"]), P("E. Sodhi", win=True, scores=["6","6"])),
    M(P("I. Bhandari", win=True, scores=["6","7"]), P("W. Chopra", scores=["4","5"])),
    M(P("Bye", bye=True), P("N. Sundaram", 2, win=True), note="Bye"),
]

r16 = [
    M(P("R. Menon", 1, win=True, scores=["6","6"]), P("A. Bhatt", scores=["2","3"])),
    M(P("V. Naidu", scores=["4","4"]), P("M. Rathore", 8, win=True, scores=["6","6"])),
    M(P("T. Sengupta", 5, win=True, scores=["7","6"]), P("J. Dsouza", scores=["5","4"])),
    M(P("P. Bakshi", scores=["3","2"]), P("A. Fernandes", 4, win=True, scores=["6","6"])),
    M(P("Y. Malhotra", 3, scores=["6","3"]), P("G. Pillai", scores=["4","2"]), note="Live · Court 1", live=True),
    M(P("L. Tandon"), P("F. Ansari", 6), note="Court 3 · 14:00"),
    M(P("C. Varma", 7), P("E. Sodhi"), note="Court 1 · 15:30"),
    M(P("I. Bhandari"), P("N. Sundaram", 2), note="Court 2 · 15:30"),
]

qf = [
    M(P("R. Menon", 1), P("M. Rathore", 8), note="Sun 27 · Court 1 · 10:00"),
    M(P("T. Sengupta", 5), P("A. Fernandes", 4), note="Sun 27 · Court 2 · 10:00"),
    M(P("Winner M21", tbd=True), P("Winner M22", tbd=True), note="Sun 27 · Court 1 · 11:30"),
    M(P("Winner M23", tbd=True), P("Winner M24", tbd=True), note="Sun 27 · Court 2 · 11:30"),
]
sf = [
    M(P("Winner QF1", tbd=True), P("Winner QF2", tbd=True), note="Sun 27 · Court 1 · 14:00"),
    M(P("Winner QF3", tbd=True), P("Winner QF4", tbd=True), note="Sun 27 · Court 1 · 15:45"),
]
fin = [M(P("Winner SF1", tbd=True), P("Winner SF2", tbd=True), note="Sun 27 · Centre · 17:30")]

def row(p, live):
    seed = f'<span class="mono" style="font-size:10px;color:var(--dim);width:13px;text-align:right;">{p["seed"]}</span>' if p["seed"] else '<span style="width:13px;"></span>'
    if p["bye"]:
        nm = '<span style="font-size:11.5px;color:var(--dim);font-style:italic;">Bye</span>'
    elif p["tbd"]:
        nm = f'<span style="font-size:11.5px;color:var(--dim);">{p["name"]}</span>'
    else:
        weight = "600" if p["win"] else "400"
        color = "var(--ink)" if p["win"] else "var(--muted)"
        nm = f'<span style="font-size:11.5px;font-weight:{weight};color:{color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{p["name"]}</span>'
    cells = ""
    for s in p["scores"]:
        c = "var(--accent)" if live else ("var(--ink)" if p["win"] else "var(--dim)")
        w = "600" if p["win"] else "400"
        cells += f'<span class="mono" style="font-size:11px;width:12px;text-align:center;color:{c};font-weight:{w};">{s}</span>'
    return (f'<div style="display:flex;align-items:center;gap:6px;height:18px;'
            f'border-bottom:1px solid var(--line);padding-right:2px;">{seed}'
            f'<span style="flex:1;min-width:0;display:flex;">{nm}</span>'
            f'<span style="display:flex;gap:2px;">{cells}</span></div>')

def match(m):
    note = ""
    if m["note"]:
        col = "var(--accent)" if m["live"] else "var(--dim)"
        dot = '<span style="width:5px;height:5px;background:var(--accent);display:inline-block;"></span>' if m["live"] else ""
        gap = 'display:flex;align-items:center;gap:5px;'
        note = (f'<div style="{gap}font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;'
                f'text-transform:uppercase;color:{col};padding-top:3px;">{dot}{m["note"]}</div>')
    return f'<div>{row(m["top"], m["live"])}{row(m["bot"], m["live"])}{note}</div>'

def round_col(ms, last=False):
    slots = "".join(f'<div style="flex:1;display:flex;align-items:center;">'
                    f'<div style="width:100%;">{match(m)}</div></div>' for m in ms)
    border = "" if last else "border-right:1px solid var(--line);"
    pad = "padding:0 14px 0 0;" if last else "padding:0 14px;"
    if ms is r32:
        pad = "padding:0 14px 0 0;"
    return f'<div style="display:flex;flex-direction:column;{border}{pad}">{slots}</div>'

NAV = [("Overview", 0), ("Entries", 0), ("Draws", 1), ("Order of play", 0),
       ("Results", 0), ("Players", 0), ("Certificates", 0), ("Sponsors", 0)]

def nav():
    out = ""
    for label, active in NAV:
        if active:
            out += (f'<div style="display:flex;align-items:center;gap:10px;height:34px;padding:0 16px;'
                    f'background:var(--bg2);border-left:2px solid var(--accent);'
                    f'font-size:13px;font-weight:600;color:var(--accent);">{label}</div>')
        else:
            out += (f'<div style="display:flex;align-items:center;gap:10px;height:34px;padding:0 18px;'
                    f'font-size:13px;color:var(--muted);">{label}</div>')
    return out

rounds = (round_col(r32) + round_col(r16) + round_col(qf) + round_col(sf) + round_col(fin, last=True))

heads = ""
for label, sub in [("Round of 32", "16 matches"), ("Round of 16", "8 matches"),
                   ("Quarter-finals", "4 matches"), ("Semi-finals", "2 matches"), ("Final", "")]:
    heads += (f'<div style="display:flex;align-items:baseline;gap:8px;">'
              f'<span class="thead">{label}</span>'
              f'<span class="mono" style="font-size:10px;color:var(--dim);">{sub}</span></div>')

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
          <div class="eyebrow">Autumn Open 2026 · Day 2 · Sat 26 Sep</div>
          <div style="font-size:24px;font-weight:600;letter-spacing:-.02em;margin-top:7px;">Men's Singles — Main Draw</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="display:flex;border:1px solid var(--line);">
            <div style="height:32px;padding:0 14px;display:flex;align-items:center;font-size:12px;font-weight:600;background:var(--bg2);color:var(--ink);">Main draw</div>
            <div style="height:32px;padding:0 14px;display:flex;align-items:center;font-size:12px;color:var(--muted);border-left:1px solid var(--line);">Qualifying</div>
          </div>
          <div style="height:32px;padding:0 14px;display:flex;align-items:center;font-size:12px;color:var(--muted);border:1px solid var(--line);">Export PDF</div>
          <div style="height:32px;padding:0 16px;display:flex;align-items:center;font-size:12px;font-weight:600;background:var(--accent);color:var(--accent-fg);">Publish draw</div>
        </div>
      </div>
      <div style="display:flex;gap:22px;margin-top:14px;">
        <div class="mono" style="font-size:11px;color:var(--dim);">32 DRAW</div>
        <div class="mono" style="font-size:11px;color:var(--dim);">8 SEEDS</div>
        <div class="mono" style="font-size:11px;color:var(--dim);">4 BYES → SEEDS 1–4</div>
        <div class="mono" style="font-size:11px;color:var(--dim);">ENTRIES CLOSED 22 SEP</div>
        <div class="mono" style="font-size:11px;color:var(--accent);">1 MATCH LIVE</div>
      </div>
    </div>

    <div style="flex:1;min-height:0;padding:16px 24px 20px;display:flex;flex-direction:column;">
      <div style="display:grid;grid-template-columns:252px 236px 220px 220px 220px;padding-bottom:10px;">{heads}</div>
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:252px 236px 220px 220px 220px;">{rounds}</div>
    </div>
  </div>
</div>"""

open("Main.dc.html", "w").write(shell(LIGHT, body))
print("Main.dc.html", len(shell(LIGHT, body)))
