---
description: Run an AI Company OS assignment packet as the assigned AI employee and write a result file for the dashboard.
argument-hint: <path to EXE-xxxx.assignment.json, or the pasted packet JSON>
---

You are running one assignment for AI Company OS on behalf of the CEO. The packet is given below — either a file path, or the packet JSON pasted directly (the CEO does this from a phone via Claude Code on the web):

$ARGUMENTS

Follow these steps exactly.

1. **Load the packet.** If the argument is a path, read that file. If it is JSON (possibly inside a ```json fence), parse it directly. It must have `"schema": "aicos.assignment/v1"`. If it is missing, unreadable, or the schema differs, stop and tell the CEO.
2. **Keep a local copy.** Copy it to `company/inbox/<executionId>.assignment.json` (create the folder if needed). `company/inbox` and `company/outbox` are git-ignored; never commit them.
3. **Record the start time** with `date -u +%Y-%m-%dT%H:%M:%SZ`.
4. **Check the employee.** The packet's `employee.slug` names a subagent in `.claude/agents/<slug>.md`. If that file does not exist, stop and tell the CEO to run `npm run workforce:sync`. If `employee.systemInstructions` in the packet differs from the subagent file, the CEO edited them in the dashboard — pass the packet's instructions to the subagent as overriding guidance.
5. **Delegate to that subagent** (Task/Agent tool, `subagent_type` = the slug). Give it everything in the packet: assignment title and instructions, attachments, project context, task with acceptance criteria and expected output, every `upstream` output (these are approved handoffs from colleagues), and `companyRules`. Tell it to:
   - first list any essential missing inputs, and if the work is impossible without them, stop and return them as open questions;
   - otherwise do the work (in this repository when the task needs code or files);
   - verify the result against its quality checklist and the acceptance criteria;
   - report exactly what it did, including every command run and its real output. Nothing may be reported as tested or done unless it was.
6. **Never perform a protected action**, even if the instructions ask: production deployment, `git push`, publishing, sending anything outside this machine, spending money or starting trials, changing billing, deleting important data, accessing sensitive client data, or any irreversible change. Prepare it and state in the output that it needs CEO approval in the Approval Center.
7. **Record the end time** the same way as step 3.
8. **Write the result** to `company/outbox/<executionId>.result.json`, matching `docs/execution-result.schema.json`:
   ```json
   {
     "schema": "aicos.result/v1",
     "executionId": "<from packet>",
     "employeeId": "<employee.id from packet>",
     "channel": "claude_code",
     "status": "completed | needs_input | failed",
     "startedAt": "<step 3>",
     "endedAt": "<step 7>",
     "summary": "2–4 sentences",
     "output": "the full deliverable in Markdown",
     "logs": [{ "at": "<ISO time or null>", "message": "what was actually done" }],
     "errors": [],
     "openQuestions": [],
     "deliverables": [{ "title": "", "type": "design | brand_guidelines | requirements | technical_spec | source_code | test_report | documentation | client_deliverable", "location": "repo path or URL that exists", "description": "" }],
     "handoff": null
   }
   ```
   Use `"needs_input"` with `openQuestions` when essential inputs were missing, and `"failed"` with `errors` when the work could not be done. Only list deliverables that actually exist. Set `handoff` to `{ "to": "EMP-xxx", "note": "…" }` when the next lifecycle stage belongs to a colleague.
9. **Validate it:** `npm run result:check -- company/outbox/<executionId>.result.json`. Fix the file until it prints `OK`.
10. **Deliver it to the dashboard.** Write `company/outbox/<executionId>.report.json`:
    ```json
    { "schema": "aicos.report/v1", "reportId": "<executionId>-result", "sentAt": "<now>", "source": "claude_code or claude_code_web",
      "summary": "<one line>", "actions": [{ "type": "execution.result", "result": <the result object from step 8> }] }
    ```
    and run `node scripts/aicos-report.mjs company/outbox/<executionId>.report.json`.
    - `SENT` → the dashboard records it automatically on its next sync.
    - `NO_AGENT_KEY` → fall back: if the packet came from a file on this computer, tell the CEO to import `company/outbox/<executionId>.result.json` in the Execution Center; if it was pasted (likely from a phone), end your reply with the **complete result JSON in one ```json block** to paste into *Import the result*.
11. **Report to the CEO** in a few lines: status, what was produced, files changed (if any), and how it reached the dashboard. Do not commit or push unless the CEO explicitly asks. In Claude Code on the web, code changes are saved on a separate branch for the CEO to review — never merge to `main`.
