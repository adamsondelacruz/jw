# Metrics Index — Talk No. 13

Talk: **Can You Discern the Principle Behind the Law?**  
Assigned time: **24:00**

## Counting method

- Manuscript words exclude headings, metadata, highlighted legend, delivery cues, and video labels.
- The source outline designates no scripture as a formal audience reading; required-reading words are therefore zero.
- Timed totals include the actual container runtime of both English video files.
- Practical time adds media transitions, audience-facing pauses, and natural extemporaneous phrasing.

## File summary

| File | Manuscript words | Read words | Total spoken | Required reads | Videos | Supporting scripture ranges | Delivery cues | PDF pages |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| [01-draft-talk.md](01-draft-talk.md) | 1,903 | 0 | 1,903 | 0 | 2 | 17 | 1 | 6 |
| [03-draft-talk-TG.md](03-draft-talk-TG.md) | 1,940 | 0 | 1,940 | 0 | 2 | 17 | 1 | 6 |

The primary [English extemporaneous guide PDF](02-extemp-guide.pdf) is 5 A4 pages; the [Tagalog extemporaneous guide PDF](04-extemp-guide-TG.pdf) is 6 A4 pages; the [delivery-tips PDF](05-extemp-delivery-tips.pdf) is 3 A4 pages.

## Media time

| Fixed element | Outline time | Actual file runtime |
|---|---:|---:|
| Video 1 — `08-CO-v26_E_131` | 2:04 | 2:05 |
| Video 2 — `10-CO-v26_E_132` | 6:29 | 6:21 |
| **Total** | **8:33** | **about 8:26** |

The actual English files are roughly 6.5 seconds shorter in total than the outline’s rounded labels. Rehearsal uses the full actual playback.

## Straight manuscript time, including videos

| Narration rate | Manuscript | Actual videos | Calculated total |
|---:|---:|---:|---:|
| 120 wpm | 15:52 | 8:26 | 24:18 |
| 130 wpm | 14:38 | 8:26 | 23:05 |
| 140 wpm | 13:36 | 8:26 | 22:02 |

**Practical delivery target:** approximately **23:30-24:30**. The centre section fits at about 130 wpm; the opening and conclusion should be warmer and slightly slower.

### Tagalog manuscript time, including videos

| Narration rate | Manuscript | Actual videos | Calculated total |
|---:|---:|---:|---:|
| 120 wpm | 16:10 | 8:26 | 24:36 |
| 130 wpm | 14:55 | 8:26 | 23:22 |
| 140 wpm | 13:51 | 8:26 | 22:18 |

**Tagalog practical target:** approximately **23:30-24:30**. The Tagalog wording was tightened so all six laws, both videos, and the final application remain within the assignment.

## Section balance

| Outline section | Manuscript words | Fixed video | Assigned time | Delivery assessment |
|---|---:|---:|---:|---|
| Difference between law and principle | 121 | 2:05 | 3:00 | About 3:00 with a concise setup and landing |
| “You heard . . . however, I say” | 1,508 | 6:21 | 18:00 | About 18:00 at 130 wpm; keep all six examples moving |
| Love the Person behind the principle | 274 | None | 3:00 | About 2:20 straight; allows reflective pauses and final emphasis |

## Scripture map

### Required readings

- **None.** This is intentional and follows the source outline.

### Supporting references

- Psalm 119:104
- Matthew 5:17-48; Colossians 2:13, 14; Malachi 3:6
- Matthew 5:21-26; 5:27-30; 5:31, 32; 5:33-37; 5:38-42; 5:43-48
- 1 Peter 2:23; 1 John 4:8, 19
- Romans 13:8-10; Matthew 28:19
- Matthew 11:27; Galatians 6:2; Proverbs 2:4, 9

## Timing protections

- Do not ask the audience to turn to or read any of the supporting scriptures.
- Do not retell either video in detail; explain the principle it demonstrates.
- Keep each law to one principle and one practical movement.
- If long, compress supporting applications—not the six-law order, both videos, or the conclusion’s return to the road-crossing image.

Reproduce the manuscript count with:

```sh
python3 ../measure_talks.py 01-draft-talk.md
python3 ../measure_talks.py 03-draft-talk-TG.md
```
