# Sprint 2 - Basic Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Basic Chatbot full conversation loop with persistent history and voice input/output.

**Architecture:** 
- Frontend reads from local SQLite to manage chat sessions and message history. 
- Frontend hooks into `@react-native-voice/voice` for input and `expo-speech` for output. 
- Backend chat endpoints route messages to the chosen AI provider adapter securely.

**Tech Stack:** React Native, Expo, SQLite, Express, Node.js.

---

### Task 1: Backend 2.1 - Chat completion endpoint
**Files:**
- Create: `backend/src/routes/chat.ts`
- Create: `backend/src/services/provider.ts`

- [ ] **Step 1: Write the failing test**
...
- [ ] **Step 2: Run test to verify it fails**
...
- [ ] **Step 3: Write minimal implementation**
...
- [ ] **Step 4: Run test to verify it passes**
...
- [ ] **Step 5: Commit (if auto_commit enabled)**

---

### Task 2: Backend 2.5 - Budget Guard
**Files:**
- Modify: `backend/src/routes/chat.ts`
...

*(The remainder of Sprint 2 tasks will be fully populated in iteration prior to Sprint 2 execution)*
