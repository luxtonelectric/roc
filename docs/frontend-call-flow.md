# Frontend Call-Flows & State Transitions 📞🔁

This document lists all frontend-initiated actions, their payloads/callbacks, the server-side state transitions they cause, events the frontend must handle, and short examples for P2P, GROUP and REC flows.

> Note: This mirrors the actual logic implemented in `server/src/UnifiedCallManager.js`, `server/src/vgcs/NetworkGCC.js`, `server/src/vgcs/MobileStationVGCS.js`, `server/src/vgcs/VGCSBus.js`, and `server/src/vgcs/VGCSSocketBridge.js`.

---

## At-a-glance: allowed frontend actions (events you can emit) ✅

- `placeCall` (callback returns call id string or `false`)
  - Payload: `call.toEmittable()` (P2P: `senderPhoneId`, `receiver`; GROUP: `groupId`; REC: `senderPhoneId`, `options`)
  - Server transitions:
    - P2P: create call with status `OFFERED` (simple states)
    - GROUP: create `GroupCallRequest`, set status → `N1_INITIATED`, create sender `MobileStationVGCS`, send `START_REQ` to VGCS
    - REC: same as GROUP but `autoAnswer=true` for sender and participants (REC must be `EMERGENCY`)
  - Emits: `callUpdate` (offer) and `groupCallInitiated` (for GROUP/REC)

- `acceptCall` (callback returns `true` on success)
  - Payload: `{ id: callId }`
  - Server transitions:
    - P2P: move from `requestedCalls` → `activeCalls`, status `ACCEPTED`
    - GROUP/REC: add participant; if first acceptance (status `N1_INITIATED`) → `N3_ESTABLISHING` → allocate channel → `N2_ACTIVE` and move to `activeCalls`
  - Emits: `joinedCall`, `callUpdate`, `groupCallActive` / `groupCallParticipantJoined`

- `rejectCall` (callback: `{ success: true }` or `false`)
  - Payload: `{ id: callId }`
  - Server transitions:
    - P2P: set status `REJECTED` → move to past → broadcast `callUpdate` with `REJECTED`
    - GROUP: if sender rejects → terminate (N4_TERMINATING); if participant rejects → remove participant only

- `terminateCall` (callback: `{ success: true }` or `false`)
  - Payload: `{ id: callId }`
  - Server transitions:
    - P2P: `ENDED` → move to past → `callEnded`
    - GROUP/REC: `N4_TERMINATING` → VGCS `RELEASE` → `N0_NULL` → cleanup → `groupCallTerminated`, `callEnded`

- `leaveCall` (no callback required by client wrapper)
  - Payload: `{ id: callId }`
  - Server transitions:
    - P2P: leaving participant terminates the call
    - GROUP/REC: participant leaves (calls `mobileStation.leave()`), removed from participants; if last → terminate entire call

- `startGroupCall` / `joinGroupCall` / `leaveGroupCall` / `terminateGroupCall` (VGCS socket-level actions)
  - `startGroupCall` payload: `{ type, level, senderPhoneId, options? }`
  - `joinGroupCall` payload: `{ groupId, phoneId }`
  - `leaveGroupCall` payload: `{ phoneId }`
  - `terminateGroupCall` payload: `{ phoneId }` (sender or controller required to terminate)
  - Server transitions are handled by `NetworkGCC` (VGCS FSM) and may produce `GROUP_CALL_INITIATED`, `GROUP_CALL_ACTIVE`, `GROUP_CALL_TERMINATED` via the `VGCSBus`→`VGCSSocketBridge` publish/subscribe paths.

---

## Server → Frontend events you must handle 🔁

- `callUpdate` — Unified call creation/updates. Payload: `call.toEmittable()` (status, type, channel, participants, etc.). Update local queue/state.
- `groupCallInitiated` — Emitted when VGCS `START_REQ` is processed. Show group/REC offer UI (REC may require modal & countdown).
- `groupCallActive` — Emitted when VGCS moves to `N2_ACTIVE`. Move to in-call UI and join audio channel.
- `groupCallParticipantJoined` / `groupCallParticipantLeft` — Update participant list.
- `groupCallTerminated` — Close group UI and cleanup local call state.
- `groupCallError` / `vgcsError` / `callError` — Handle errors and display messages (may include `recoverable` flag).
- `joinedCall` / `kickedFromCall` / `callEnded` — Join acknowledgment, kicked event, and final termination.
- `callQueueUpdate` — Per-phone queue refresh event.
- Admin events: `adminGroupCallUpdate`, `adminGroupCallError`, `adminCallUpdate` (for admin UIs).

---

## Allowed state transitions (explicit) 🔁

### P2P (simple states, `BaseCall`)
- `OFFERED` → `ACCEPTED` (by `acceptCall`) → `ENDED` (by `terminateCall` or participant leaving)
- `OFFERED` → `REJECTED` (by `rejectCall`) → move to past

### GROUP / REC (VGCS, enforced by `GroupCallRequest` & `NetworkGCC`)
- `N0_NULL` → `N1_INITIATED` (on `placeCall` / `startGroupCall`)
- `N1_INITIATED` → `N3_ESTABLISHING` (first accept or if `immediateSetup`) 
- `N3_ESTABLISHING` → `N2_ACTIVE` (resource setup or immediate setup → `CHANNEL_ASSIGN`)
- `N2_ACTIVE` → `N4_TERMINATING` (`terminateCall`, sender reject, or idle/no-users)
- `N4_TERMINATING` → `N0_NULL` (`_reset()` / `_releaseAll()`)

> Important: the **sender cannot use `leaveCall`** — sender must `terminateCall`/`terminateGroupCall`. REC calls auto-answer (fast path to active) via `autoAnswer = true`.

---

## VGCS message flow & timers ⚙️

**Network messages (`NetworkGCC.MSG`)**: `NOTIFICATION`, `START_REQ`, `START_ACK`, `JOIN_REQ`, `JOIN_ACCEPT`, `CHANNEL_ASSIGN`, `LEAVE`, `TERMINATE`, `RELEASE`, `WITHDRAWN`.

**Key timers** in `NetworkGCC`:
- `T_PRESENT` — withdrawal timer before establishment for non-immediate setup
- `T_SETUP` — time to transition to `N2_ACTIVE` (establishment)
- `T_IDLE` — auto-clear empty active calls

**MobileStation timers**:
- Present timeout (≈4.5s) for manual answer; auto-accept for REC calls when `autoAnswer=true`.

---

## UX expectations / validations (frontend should enforce) ✨

- Validate phone connectivity (Discord ID) before accepting a call.
- Do not attempt to place REC calls with non-`EMERGENCY` level — server will reject.
- For accept/reject/terminate/join/leave actions, prefer server callback to drive UI changes; client may optimistically clear UI but still honor server responses.
- On reception of terminal statuses (`REJECTED`, `ENDED`, `N0_NULL`) in `callUpdate`, remove calls from queues and stop call audio.

---

## Example sequences (short) 🧭

1) **P2P call (success)**
   - A emits `placeCall` → server creates `OFFERED` call → B receives `callUpdate` (offer)
   - B emits `acceptCall` → server `acceptP2PCall` assigns channel → status `ACCEPTED` → `callUpdate` & `joinedCall`

2) **Group call start + participant join**
   - Sender emits `startGroupCall` (`START_REQ`) → Network `N1_INITIATED` → `groupCallInitiated` & `callUpdate`
   - Participant emits `joinGroupCall` → Network accepts participant `JOIN_ACCEPT` then `CHANNEL_ASSIGN` at establishment → `groupCallActive`

3) **REC call (auto-accept)**
   - Sender emits `placeCall` as REC (EMERGENCY) → server sets `autoAnswer` for sender/participants → quick path to `N2_ACTIVE` and `groupCallActive`

---

## References (important files)

- `server/src/UnifiedCallManager.js` — orchestration: `placeCall`, `_setupGroupCall`, `acceptGroupCall`, `acceptP2PCall`, `terminateCall`, `leaveCall`, `rejectCall`, `moveCallToPast`
- `server/src/vgcs/NetworkGCC.js` — network-side VGCS FSM and timers
- `server/src/vgcs/MobileStationVGCS.js` — mobile station FSM and message handling
- `server/src/vgcs/VGCSBus.js` — bus & publish/subscribe
- `server/src/vgcs/VGCSSocketBridge.js` — bridge from VGCS messages to socket events
- `client/composables/useCallManager.ts` — how frontend emits events and handles `callUpdate` and group events

---

If you'd like, I can also:
- produce a single combined Mermaid diagram merging P2P + GROUP + Mobile + Network flows, or
- provide a small JSON socket contract (event names, payload shapes, responses) for TypeScript types.

---

*Document generated from live source code (Dec 2025).*