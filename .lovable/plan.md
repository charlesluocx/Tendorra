# Ongoing Team references in phase tabs

## Changes
- Preserve each started phase's order and timestamp when loading the project.
- Track the phase where each confirmed continuing role joined the project.
- At the top of each active phase tab, show an **Ongoing Team** row only when eligible roles exist for that phase.
- Render compact read-only role chips; selecting one scrolls to its managed entry in **Project Team**.
- Keep all scope, invite, quote, and removal controls exclusively in **Project Team**.

## Eligibility
A continuing role appears in its joining phase and every later started phase. It never appears in an earlier phase. Phase assignment is the primary signal, with confirmation/start timestamps used as a fallback for legacy records.

## Verification
- Test a Schematic project with Architect confirmed, then add Planning & Approval.
- Confirm Architect appears in Planning & Approval's Ongoing Team row.
- Confirm the chip jumps to Project Team and no management controls are duplicated in the phase tab.
- Check desktop/mobile layout and current build health.
