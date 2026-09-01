:root {
--bg: #0b1220;
--panel: #121b2e;
--panel-edge: #1e2a44;
--ink: #e7ecf5;
--ink-dim: #8a97b3;
--accent: #4fb0ff;
--fire: #ff5d5d;
--lock: #46d39a;
}
* { box-sizing: border-box; }
body {
margin: 0;
min-height: 100vh;
background: radial-gradient(ellipse at
top, #101a2e 0%, var(--bg) 60%);
color: var(--ink);
font-family: -apple-system,
BlinkMacSystemFont, "Segoe UI", Roboto,
sans-serif;
display: flex;
flex-direction: column;
align-items: center;
padding: 24px 16px 50px;
}
header { text-align: center; max-width:
480px; margin-bottom: 26px; }
h1 { font-size: 20px; margin: 0 0 6px;
font-weight: 650; }
h1 span { color: var(--accent); }

.tagline { font-size: 13px; color: var(--
ink-dim); margin: 0; }
main { width: 100%; max-width: 480px;
display: flex; flex-direction: column;
align-items: center; gap: 20px; }
button.util.wide {
width: 100%;
background: var(--panel);
border: 1px solid var(--panel-edge);
color: var(--ink);
border-radius: 10px;
padding: 14px;
font-size: 15px;
font-weight: 600;
cursor: pointer;
}
button.util.wide.listening { border-color:
var(--lock); color: var(--lock); }
.readout {
width: 100%;
display: flex;
justify-content: space-between;
background: var(--panel);
border: 1px solid var(--panel-edge);
border-radius: 12px;
padding: 14px 18px;
}
.stat { display: flex; flex-direction:
column; align-items: center; gap: 4px; }

.stat .label { font-size: 10px; text-
transform: uppercase; letter-spacing:

0.06em; color: var(--ink-dim); }

.stat .value { font-size: 20px; font-
weight: 650; font-variant-numeric: tabular-
nums; }

canvas {
width: 100%;
background: var(--panel);
border: 1px solid var(--panel-edge);
border-radius: 12px;
}
.note {
font-size: 12.5px;
color: var(--ink-dim);
line-height: 1.5;
padding: 0 4px;
}

.note em { color: var(--accent); font-
style: normal; }
