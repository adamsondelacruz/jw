# Quarterly maintenance folder - generation prompt

This is a runbook for future Claude sessions (and Adam) on how to spin up a new
quarterly maintenance folder for the Ashburton Kingdom Hall.

## What "generate a quarter" means

Create `Maintenance/<year>/q<N>/` containing one subfolder per area
(Building, Civil, Mechanical, Electrical, Equipment, Technical) and copy the
job-card `.docx` templates that are due in that quarter from
`Maintenance/Templates/Job Cards/<Area>/`.

## How to do it

```bash
python3 Maintenance/scripts/generate_quarter.py <year> <quarter>
# preview first:
python3 Maintenance/scripts/generate_quarter.py <year> <quarter> --dry-run
# re-run to refresh templates:
python3 Maintenance/scripts/generate_quarter.py <year> <quarter> --force
```

The script:

1. Reads `Maintenance/Templates/Ashburton Maintenance Calendar .xlsx` (auto-picks
   the latest year sheet that has data, currently **2023**). Cells filled teal
   (`#29747D`) under a month column mean that job card is due that month.
2. Selects every job card whose calendar fills include any of the quarter's
   3 months.
3. **Always adds** `B-18 Compliances (Monthly)` and `B-19 Compliances (3 Monthly)`
   regardless of the calendar - these run every quarter.
4. Copies the corresponding template from `Templates/Job Cards/<Area>/` into the
   new quarter folder. Existing files are not overwritten unless `--force`.
5. Reports skipped cards (where the calendar lists a code that has no matching
   template `.docx` - e.g. B-8, B-22, B-23, C-8, E-8 as of 2026).

## What's NOT automated

- **Agenda document.** Each quarter has its own
  `Q<N> <year> Maintenance Meeting Agenda.docx`. Don't auto-generate it - the
  agenda carries meeting-specific items (status of follow-ups, general business,
  budget asks, next-meeting date). Copy from the previous quarter's agenda and
  edit, or draft fresh.
- **Minutes folder.** Created after the meeting, with the meeting minutes plus
  copies of the agenda PDF/DOCX. See `Maintenance/2026/q2/Minutes/` for the
  pattern.
- **Discretionary additions.** Q1 has historically included a few cards not
  predicted by the calendar (e.g. B-1, C-2/4/5, M-9, T-2). Q2 matched the
  calendar exactly. The script reproduces the calendar-driven rule; if a
  quarter needs extras, copy them in by hand or extend `ALWAYS_INCLUDE` at the
  top of the script.

## When to refresh the calendar

If `Templates/Ashburton Maintenance Calendar .xlsx` gets a new year sheet (say
`2026`) with teal fills, that sheet will be used automatically. Until that
happens, the 2023 sheet is the source of truth.

## Sanity-check the output

After running, compare card counts against prior quarters as a smell test:

| Quarter | Building | Civil | Mech | Elec | Equip | Tech | Total |
|---------|---------:|------:|-----:|-----:|------:|-----:|------:|
| Q1 2026 | 11       | 7     | 6    | 3    | 4     | 4    | 35    |
| Q2 2026 | 9        | 2     | 2    | 4    | 3     | 2    | 22    |
| Q3 2026 | 7        | 2     | 5    | 5    | 5     | 3    | 27    |

(The actual quarter spread varies because seasonal jobs like roof inspection,
gutters, gates, switchboard checks fall in different months.)
