# .claude/skills/debug/SKILL.md
## Debug Checklist
1. Read the ACTUAL error message fully before suggesting fixes
2. Check: is dotenv/env loaded? Are env vars set?
3. Check: OS compatibility issues (macOS vs Linux)
4. Check: is the server/process actually restarted with new code?
5. Check: database schema matches code expectations
6. Do NOT guess - verify each step before proceeding