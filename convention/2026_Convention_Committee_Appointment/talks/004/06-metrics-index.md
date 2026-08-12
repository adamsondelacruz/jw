# Metrics Index — Talk No. 4

Talk: **Messianic Prophecy Fulfilled!—“He Will Not Quarrel”**  
Assigned time: **17:00**

## Counting method

- Manuscript words exclude headings, metadata, highlighted legend, delivery cues, video labels, and the `Read ...` placeholder.
- Required-reading words count the text of Isaiah 42:1-4 separately; the verse text is not reproduced here.
- Timed totals include the actual container runtime of both English video files.
- Practical time adds page movement, video transitions, audience-facing pauses, and natural extemporaneous phrasing.

## File summary

| File | Manuscript words | Read words | Total spoken | Required reads | Videos | Supporting scripture ranges | Delivery cues | PDF pages |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| [01-draft-talk.md](01-draft-talk.md) | 1,614 | 89 | 1,703 | 1 | 2 | 12 | 2 | 5 |
| [03-draft-talk-TG.md](03-draft-talk-TG.md) | 1,801 | 90 | 1,891 | 1 | 2 | 12 | 2 | 6 |

The primary [English extemporaneous guide PDF](02-extemp-guide.pdf) is 4 A4 pages; the [Tagalog extemporaneous guide PDF](04-extemp-guide-TG.pdf) is 5 A4 pages; the [delivery-tips PDF](05-extemp-delivery-tips.pdf) is 2 A4 pages.

## Media and reading time

| Fixed element | Outline time | Actual/count basis |
|---|---:|---:|
| Video 1 — `02-CO-v26_E_041` | 0:46 | 0:50 |
| Isaiah 42:1-4 | — | 89 words; about 0:43 at 125 wpm |
| Video 2 — `04-CO-v26_E_042` | 0:52 | 0:56 |
| **Fixed total** | **1:38 + reading** | **about 2:29** |

The English media files themselves total approximately **1:46.5**, about 8.5 seconds longer than the outline’s rounded labels. The actual runtimes are used for rehearsal.

## Straight manuscript time, including videos

| Narration rate | Spoken words | Actual videos | Calculated total |
|---:|---:|---:|---:|
| 120 wpm | 14:12 | 1:46 | 15:58 |
| 130 wpm | 13:06 | 1:46 | 14:53 |
| 140 wpm | 12:10 | 1:46 | 13:56 |

**Practical delivery target:** approximately **16:30-17:15** at an unhurried 120-125 wpm, with the Isaiah reading, video transitions, emphasis, and audience-facing pauses allowed to breathe.

### Tagalog manuscript time, including videos

| Narration rate | Spoken words | Actual videos | Calculated total |
|---:|---:|---:|---:|
| 120 wpm | 15:46 | 1:46 | 17:32 |
| 130 wpm | 14:33 | 1:46 | 16:19 |
| 140 wpm | 13:30 | 1:46 | 15:17 |

**Tagalog practical target:** approximately **16:30-17:30** with natural phrasing and the 90-word Tagalog reading of Isaias 42:1-4.

## Section balance

| Outline section | Manuscript words | Fixed media/reading | Assigned time | Delivery assessment |
|---|---:|---:|---:|---|
| What was prophesied? | 179 | Video 1 + 89-word reading | 3:00 | About 3:00 at 125 wpm |
| How was fulfilled? | 750 | Video 2 | 8:00 | About 7:00 straight; pauses and explanation bring it near 8:00 |
| What can we learn? | 685 | None | 6:00 | About 5:30-6:00 with direct audience application |

## Scripture map

### Required reading

- Isaiah 42:1-4 — 89 words

### Supporting references

- Matthew 12:15-18; Matthew 12:19; Matthew 12:20, 21
- Mark 1:40-44; Mark 1:41; Mark 3:11, 12
- John 5:2-13; John 7:16-18
- Matthew 6:2, 5; Matthew 9:2-8; Matthew 5:3
- 2 Timothy 2:24

## Timing protections

- Do not create another formal scripture reading.
- Do not shorten either video in the manuscript calculation.
- If long, trim a supporting-reference sentence—not Isaiah’s reading, the controlling image, the three applications, or the handoff.
- If short, add pauses and audience contact; do not add another illustration.

Reproduce the manuscript count with:

```sh
python3 ../measure_talks.py 01-draft-talk.md
python3 ../measure_talks.py 03-draft-talk-TG.md
```
