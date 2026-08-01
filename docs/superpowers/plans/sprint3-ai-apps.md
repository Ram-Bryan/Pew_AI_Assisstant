# Sprint 3 - AI and Apps Talking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement AI actions loop with manual user approval via tools.

**Architecture:** 
- Frontend renders new tool-call bubbles allowing accept/reject logic.
- Backend implements `Provider Tool-Call Adapters` (OpenAI format, Anthropic format) and `Action Connectors` (Gmail). 
- Backend handles Chained-call guardrails in an Agent Loop Controller.

**Tech Stack:** React Native, Expo, SQLite, Express, Node.js.

---

### Task 1: Backend 3.1 & 3.2 - Tool Call Adapters and Schema Builder
**Files:**
- Create: `backend/src/services/adapters/openai.ts`
- Create: `backend/src/services/adapters/anthropic.ts`
- Create: `backend/src/services/schemaBuilder.ts`

- [ ] **Step 1: Write the failing test**
...
- [ ] **Step 2: Run test to verify it fails**
...
- [ ] **Step 3: Write minimal implementation**
...
- [ ] **Step 4: Run test to verify passes**
...
- [ ] **Step 5: Commit**

*(The remainder of Sprint 3 tasks will be fully populated in iteration prior to Sprint 3 execution)*
