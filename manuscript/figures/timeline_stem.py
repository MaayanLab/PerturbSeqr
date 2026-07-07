"""Connectivity-mapping timeline (Hughes 2000 → Perturb-Seqr).


See https://matplotlib.org/stable/gallery/lines_bars_and_markers/timeline.html
each event is a dot on a year axis connected to label.
"""
from pathlib import Path

import matplotlib.pyplot as plt

# Use DM Sans if available
plt.rcParams["font.family"] = "sans-serif"
plt.rcParams["font.sans-serif"] = ["DM Sans", *plt.rcParams["font.sans-serif"]]

BG = "#F3F4F6"    
DOT = "#003DA5"   
LEADER = "#9AA7B8"

# (year, label_x, level, label, citation)
#   year     — where the dot sits on the axis
#   label_x  — x of the label box (offset to declutter crowded years)
#   level    — label height/side: + above the axis, - below; magnitude stacks rows
EVENTS = [
    (2000, 2000.0,  1, "Hughes et al.",   "Hughes et al., Cell"),
    (2006, 2006.0,  1, "CMap Build 02",   "Lamb et al., Science"),
    (2012, 2012.0, -1, "DrugMatrix",      "Auerbach, NIEHS CEBS"),
    (2014, 2013.5,  1, "NCI-DREAM",       "Bansal et al., Nat Biotech"),
    (2016, 2016.0, -1, "CREEDS",          "Wang et al., Nat Commun"),
    (2016, 2016.0,  2, "Perturb-seq",     "Adamson et al., Cell"),
    (2017, 2017.0,  1, "CMap / L1000 v2", "Subramanian et al., Cell"),
    (2018, 2019.0,  2, "DRUG-seq",        "Ye et al., Nat Commun"),
    (2020, 2019.5, -2, "Sci-Plex",        "Srivatsan et al., Science"),
    (2022, 2021.5,  1, "NIBR MoABox",     "Li et al., ACS Chem Biol"),
    (2022, 2022.0, -1, "Replogle et al.", "Replogle et al., Cell"),
    (2023, 2024.6,  1, "DeepCover MoA",   "Mitchell et al., Nat Biotech"),
    (2024, 2023.0, -2, "RummaGEO",        "Marino et al., Patterns"),
    (2024, 2022.5,  2, "Perturb Atlas",   "Zhang et al., NAR"),
    (2024, 2025.5, -1, "Ginkgo GDP×1",    "Ginkgo Datapoints"),
    (2024, 2026.5, -2, "CM4AI",           "bioRxiv (data: Jan 2026)"),
    (2025, 2025.0, -3, "Ginkgo GDPx2",    "Baugh et al., bioRxiv"),
    (2025, 2025.5,  2, "Tahoe-100M",      "Zhang et al., bioRxiv"),
]

fig, ax = plt.subplots(figsize=(19, 6.5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.axhline(0, color="#999999", linewidth=2.5, zorder=1)

for year, label_x, level, label, citation in EVENTS:
    ax.plot([year, label_x], [0, level], color=LEADER, linewidth=1.0, zorder=2)
    ax.plot(year, 0, "o", color=DOT, markersize=10,
            markeredgecolor="white", markeredgewidth=1.5, zorder=4)
    ax.annotate(
        f"{label}\n{citation}",
        xy=(label_x, level), ha="center", va="bottom" if level > 0 else "top",
        fontsize=9.5, color="#222222", linespacing=1.15,
        bbox=dict(boxstyle="round,pad=0.3", facecolor="white",
                  edgecolor="#cccccc", linewidth=0.8),
    )

ax.set_xlim(1998.5, 2028.5)
ax.set_ylim(-3.9, 3.2)
ax.set_yticks([])
ax.set_xticks(range(2000, 2027, 2))
ax.tick_params(axis="x", length=0, pad=10)
for spine in ("top", "right", "left", "bottom"):
    ax.spines[spine].set_visible(False)

fig.tight_layout()
out = Path(__file__).resolve().parent / "perturbseqr_timeline_stem"
fig.savefig(f"{out}.png", dpi=220, bbox_inches="tight", facecolor=BG)
fig.savefig(f"{out}.pdf", bbox_inches="tight", facecolor=BG)
print(f"Saved {out}.png and {out}.pdf")
