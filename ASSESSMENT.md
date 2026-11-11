# Relay AI Customer Inbox Triage: Week 8 Technical Assessment

**How to read the labels.** *Verified* means I ran it and saw the result. *Code-read* means I found it by reading the source. *Hypothesis* means I have not tested it. "Node" means I ran the scorer directly in Node. "UI" means I used the real app with the real Groq model, not the mock.

## 1. The Original App

Relay AI's Customer Inbox Triage app takes a customer message, asks a Groq-hosted LLM to assign a category (Billing Issue, Technical Problem, Feature Request, General Inquiry, or Unknown), maps that category to a recommended action, and assigns an urgency (High, Medium, Low) with a separate rule-based scorer. It is React 19, Vite and Tailwind, and it calls Groq from the browser.

## 2. Three Improvement Areas

### 2.1 Urgency scoring (implemented)
- **Problem (code-read, and verified in baseline testing):** The original scorer starts at 50 and adjusts the score by message length, exclamation points (+30 each, uncapped), politeness words, question marks, weekend, time of day, and positive words. It does not measure how serious the problem is, so a serious outage message could score Low.
- **Solution:** rules that detect serious incidents, plus guards and caps (section 3).

### 2.2 Category mapping (identified, not implemented)
- **Problem:** Some real-model replies were mapped to `Unknown` (verified in the UI). The app parses the model's reply by substring against five fixed labels and sends no system prompt or fixed label list (code-read). That unsupported labels cause `Unknown` is a **hypothesis**.
- **Proposed solution:** put the fixed list of allowed labels in the prompt and use a stricter parser.

### 2.3 Silent API failure handling (identified, not implemented)
- **Problem (code-read, `src/utils/llmHelper.js`):** If the Groq call throws, the app falls back to a mock response and logs only a console warning. The user is not told. In practice this hid a real failure: the original model, `llama-3.3-70b-versatile`, is deprecated by Groq, so the app served mock results.
- **Proposed solution:** show a visible message when the app falls back to mock results.

## 3. What I Implemented

**Model ID** (`src/utils/llmHelper.js`, one line): `llama-3.3-70b-versatile` became `openai/gpt-oss-120b`, one of the replacements Groq lists.

**Urgency scoring** (`src/utils/urgencyScorer.js`):
- **Incident detection:** rules for outage or downtime, a failed system, database failure, security breach, and payments or checkout down. A match returns High.
- **Resolved guard:** a message saying the problem is already resolved is not High. I narrowed it after review so a bare "fix" and "working now" no longer cancel a real outage.
- **Negated guard:** a message that negates the incident is not High.
- **Informational guard:** an informational message is not High.
- **Positive feedback:** a praise-only message returns Low.
- **Capped exclamation score:** at most +20 in total, instead of +30 per exclamation point.
- Anything else uses the original points arithmetic.

## 4. Testing and Results

I wrote my expectations before the fresh-set and focused-check runs. For the baseline tests, I wrote no expectations for tests 4–15, and my expectations for test 1 were saved after the run. Claude Code wrote some of the focused-check expectations, as noted below.

| Check | Result | Where |
|---|---|---|
| Regression set | 5/5 pass | Node |
| Fresh set (F1–F7) | 4/7 pass (F2, F3, F6, F7) | UI; Node matched the UI on all 7 |
| Same fresh set, original scorer | 2/7 pass (F2, F7) | Node |
| Focused resolved-guard check | 8/8 after the final correction, 4/8 before | Node |
| "Thanks! Checkout is not working now." | High | Node only |
| 18 original baseline urgency results | 0 changed by the final one-line patch; 5 of 18 differ from the original scorer (tests 1, 2, 6, 7, 13) | Node |
| After the final patch: C1, C2, C4 (outage messages) | High, HTTP 200, no mock fallback, no console warning | UI |

**Limits of this testing**
- The fresh set is **not a blind test**. I wrote it after I knew the original scorer's weaknesses.
- Comparing the original and new scorer shows the new rules changed F3 and F6. The exclamation cap changed F4 from High to Medium. The seven fresh messages did not exercise the three new guards.
- I found the resolved-guard defect in review after the fresh tests and fixed it with a one-line change before committing. The original 4/7 result is unchanged. Claude Code wrote four of the focused-check messages with the rules in view, so that check is limited verification.
- UI testing used the built-in browser only. I did not verify in Safari or Chrome, and I did not repeat runs.

## 5. The Three Fresh-Test Failures

- **F1:** The checkout outage wording was not detected, so the message did not get the High rating I expected. *Verified failure.*
- **F4:** A message with frustration and design feedback scored Medium. I expected Low. The exclamation cap moved it from High to Medium, but it still does not match my expectation. *Verified failure.*
- **F5:** A short login problem scored Low. I expected Medium. The scorer subtracts points for short messages (code-read), which is a likely cause. *Hypothesis; I did not test it.*

## 6. Limitations and Recommendations

- **Verified:** 4/7 on the fresh set, and the three failures above.
- **Code-read:** "solving" and "resolving" are still treated as resolved, so an active incident described that way could be ranked lower than it should be.
- **Code-read, not measured:** the scorer is keyword and regex based and English-only, so wording it was not written for can be missed, and it can also give false positives.
- **Unchanged:** category mapping and silent fallback (sections 2.2 and 2.3).
- **Future proposals, not implemented or tested:** LLM-based severity reasoning or a hybrid LLM and rule-based approach for urgency; the category and fallback fixes above.

## 7. Repository and Delivery

- Branch with this work: https://github.com/humaali-create/l2assessment-relay-ai/tree/relay-ai-nov-attempt. `main` is unchanged by this work.
- Implementation commits:
  - `8b8d07a`: `fix: update deprecated Groq model ID`
  - `0f95504`: `feat: improve customer message urgency scoring`
