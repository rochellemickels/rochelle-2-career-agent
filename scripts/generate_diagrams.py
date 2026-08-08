from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets"
OUT.mkdir(parents=True, exist_ok=True)


def fonts():
    regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    return ImageFont.truetype(regular, 23), ImageFont.truetype(bold, 26), ImageFont.truetype(bold, 38)


REGULAR, BOLD, TITLE = fonts()
NAVY = "#17233f"
PLUM = "#7c3a72"
TEAL = "#147d78"
BLUE = "#3568b8"
GOLD = "#b7791f"
INK = "#20283a"
MUTED = "#667085"
CANVAS = "#f5f6f9"
WHITE = "#ffffff"


def rounded_box(draw, box, fill, title, subtitle):
    draw.rounded_rectangle(box, radius=22, fill=fill)
    x1, y1, x2, y2 = box
    title_width = draw.textbbox((0, 0), title, font=BOLD)[2]
    draw.text(((x1 + x2 - title_width) / 2, y1 + 26), title, font=BOLD, fill=WHITE)
    lines = subtitle.split("\n")
    for i, line in enumerate(lines):
        width = draw.textbbox((0, 0), line, font=REGULAR)[2]
        draw.text(((x1 + x2 - width) / 2, y1 + 70 + i * 31), line, font=REGULAR, fill="#e8edf5")


def arrow(draw, start, end, color=NAVY):
    draw.line([start, end], fill=color, width=5)
    x, y = end
    draw.polygon([(x, y), (x - 15, y - 10), (x - 15, y + 10)], fill=color)


def architecture():
    image = Image.new("RGB", (1700, 760), CANVAS)
    draw = ImageDraw.Draw(image)
    draw.text((70, 48), "Rochelle 2.0 Career Agent", font=TITLE, fill=NAVY)
    draw.text((70, 100), "Daily discovery, transparent scoring, and a free static portal", font=REGULAR, fill=MUTED)

    boxes = [
        ((70, 255, 340, 440), BLUE, "Public ATS feeds", "Greenhouse · Lever\nAshby"),
        ((405, 255, 675, 440), NAVY, "Source adapters", "Normalize · validate\nDeduplicate"),
        ((740, 255, 1010, 440), GOLD, "Rule-based score", "Salary · remote\nTitle · quality"),
        ((1075, 255, 1345, 440), PLUM, "AI fit analyst", "Mission · leadership\nResponsibilities · AI"),
        ((1410, 255, 1630, 440), TEAL, "Career portal", "Rank · filter\nSave · track"),
    ]
    for box, fill, title, subtitle in boxes:
        rounded_box(draw, box, fill, title, subtitle)
    for index in range(len(boxes) - 1):
        arrow(draw, (boxes[index][0][2] + 8, 348), (boxes[index + 1][0][0] - 8, 348))

    draw.rounded_rectangle((405, 530, 1345, 660), radius=18, fill=WHITE, outline="#d9dee7", width=3)
    draw.text((445, 555), "Security boundary", font=BOLD, fill=NAVY)
    draw.text((445, 599), "OPENAI_API_KEY stays in GitHub Actions. Browser notes stay in localStorage.", font=REGULAR, fill=INK)
    image.save(OUT / "agent-interactions.png", optimize=True)


def sequence():
    image = Image.new("RGB", (1450, 920), WHITE)
    draw = ImageDraw.Draw(image)
    draw.text((60, 42), "Daily refresh sequence", font=TITLE, fill=NAVY)
    actors = [(135, "GitHub Actions"), (480, "Job feeds"), (825, "Career agent"), (1170, "Portal data")]
    for x, label in actors:
        draw.rounded_rectangle((x - 100, 120, x + 100, 180), radius=14, fill=NAVY if label != "Career agent" else PLUM)
        width = draw.textbbox((0, 0), label, font=BOLD)[2]
        draw.text((x - width / 2, 136), label, font=BOLD, fill=WHITE)
        draw.line((x, 180, x, 850), fill="#d9dee7", width=3)

    events = [
        (245, 135, 480, "Request authorized public jobs"),
        (325, 480, 135, "Return published listings"),
        (430, 135, 825, "Send shortlisted evidence"),
        (515, 825, 135, "Return structured fit scores"),
        (620, 135, 1170, "Write jobs.json + source health"),
        (725, 1170, 135, "Portal shows newest ranked roles"),
    ]
    for y, start_x, end_x, label in events:
        direction = 1 if end_x > start_x else -1
        draw.line((start_x, y, end_x, y), fill=TEAL if direction == 1 else BLUE, width=4)
        draw.polygon(
            [(end_x, y), (end_x - 14 * direction, y - 9), (end_x - 14 * direction, y + 9)],
            fill=TEAL if direction == 1 else BLUE,
        )
        width = draw.textbbox((0, 0), label, font=REGULAR)[2]
        draw.text(((start_x + end_x - width) / 2, y - 36), label, font=REGULAR, fill=INK)
    image.save(OUT / "agent-sequence.png", optimize=True)


if __name__ == "__main__":
    architecture()
    sequence()
    print(f"Wrote diagrams to {OUT}")

