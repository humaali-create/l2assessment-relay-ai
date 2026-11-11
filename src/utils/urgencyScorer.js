/**
 * Urgency Scorer - Rule-based urgency calculation
 *
 * Order of rules:
 *   1. High-risk incident phrases (outage, database failure, security breach,
 *      payments down) return "High", unless the message is resolved, negated
 *      or an informational question.
 *   2. Positive feedback that describes no unresolved problem returns "Low".
 *   3. Everything else uses the points score below.
 */

// Words allowed between a subject and a failure word ("server is completely down")
const GAP = "(?:\\W+(?:is|are|was|were|be|been|has|have|had|went|gone|goes|completely|totally|currently|still|just|again|seems?|appears?|looks?|keeps?|to|all))*\\W+"
const SYSTEM = "(?:server|servers|site|website|app|application|service|services|system|systems|platform|api|network|portal|dashboard|everything)"
const FAILED = "(?:down|offline|unavailable|unreachable|crashed)"
const DB = "(?:database|databases|db)"

const INCIDENT_RULES = [
  // Outage or downtime
  /\b(?:outage|outages|downtime)\b/i,
  new RegExp(`\\b${SYSTEM}\\b${GAP}${FAILED}\\b`, 'i'),
  // Database connection or availability failure
  new RegExp(`\\b${DB}\\b(?:\\W+(?:connection|connections|connectivity|server|cluster))*${GAP}(?:${FAILED}|lost|failed|failure|failing|dropped|refused|corrupted|errors?)\\b`, 'i'),
  new RegExp(`\\b(?:can['’]?t|cannot|unable to|failed to|couldn['’]?t)\\s+connect\\b(?:\\W+\\w+){0,3}?\\W+${DB}\\b`, 'i'),
  // Security breach, hacking or unauthorized access
  /\b(?:hack(?:ed|er|ers|ing)?|breach(?:ed|es)?|compromised|ransomware|malware|unauthori[sz]ed|data leak(?:ed|s)?|leaked|stolen|identity theft)\b/i,
  /\b(?:someone|somebody)\b(?:\W+\w+){0,3}?\W+(?:logged\s+(?:in|into)|accessed|got\s+into|broke\s+into)\b/i,
  // Payment systems down or unavailable
  new RegExp(`\\b(?:payments|transactions|checkout|payment (?:system|processing|gateway|processor)|billing system|card processing)\\b${GAP}(?:${FAILED}|not working|not going through|not processing|failing)\\b`, 'i')
]

// Guards: a matching incident is NOT treated as High when the message says so
const RESOLVED = /\b(?:resolved|fixed|restored|solv(?:ed|ing)|resolv(?:ed|ing)|recovered|back\s+(?:up|online|to normal)|working\s+(?:again|fine|perfectly|normally)|(?:is|are)\s+up|came\s+back|was\s+down|were\s+down|had\s+been\s+down)\b/i
const NEGATED = /\b(?:not|never|isn['’]?t|wasn['’]?t|aren['’]?t|weren['’]?t|no)\b(?:\W+(?:currently|completely|totally|really|actually|been|being|fully))*\W+(?:down|offline|unavailable|unreachable|hacked|breached|compromised|an?\s+outage|outage)\b/i
const INFORMATIONAL = /\b(?:policy|policies|sla|uptime|guarantee|guaranteed|compensation|what\s+(?:happens\s+)?if|planned\s+maintenance|scheduled\s+maintenance|protect|protection|prevent|prevention|safeguard|best\s+practices|do\s+you\s+(?:offer|provide|have|support))\b/i

// Positive feedback: praise or thanks with no unresolved problem
const PRAISE = /\b(?:thank(?:s| you)?|appreciate[ds]?|love[ds]?|great|excellent|wonderful|amazing|awesome|fantastic|happy|pleased|impressed|helpful|perfect(?:ly)?|nice)\b/i
const PROBLEM = /\b(?:problems?|issues?|errors?|broken|bugs?|crash\w*|fail\w*|not working|doesn['’]?t work|does not work|can['’]?t|cannot|unable|stuck|wrong|charged|refund|cancel\w*)\b/i

function isHighRiskIncident(message) {
  if (!INCIDENT_RULES.some(rule => rule.test(message))) return false
  return !(RESOLVED.test(message) || NEGATED.test(message) || INFORMATIONAL.test(message))
}

function isPositiveFeedback(message) {
  const hasProblem = PROBLEM.test(message) && !RESOLVED.test(message)
  return PRAISE.test(message) && !hasProblem
}

export function calculateUrgency(message) {
  if (isHighRiskIncident(message)) return "High"
  if (isPositiveFeedback(message)) return "Low"

  let urgencyScore = 50
  
  // Exclamation marks add a little urgency, capped so they can never reach High alone
  const exclamationCount = (message.match(/!/g) || []).length
  urgencyScore += Math.min(exclamationCount * 10, 20)
  
  if (message.length < 50) urgencyScore -= 40
  if (message.length < 20) urgencyScore -= 60
  
  if (message === message.toUpperCase() && message.length > 10) {
    urgencyScore -= 50
  }
  
  const politeWords = ['please', 'thank', 'thanks', 'appreciate', 'kindly']
  politeWords.forEach(word => {
    if (message.toLowerCase().includes(word)) urgencyScore -= 15
  })
  
  if (message.includes('?')) urgencyScore -= 25
  
  const now = new Date()
  if (now.getDay() === 0 || now.getDay() === 6) {
    urgencyScore -= 20
  }
  if (now.getHours() < 9 || now.getHours() > 17) {
    urgencyScore -= 15
  }
  
  const positiveWords = ['happy', 'love', 'great', 'excellent', 'wonderful']
  positiveWords.forEach(word => {
    if (message.toLowerCase().includes(word)) urgencyScore -= 20
  })
  
  if (urgencyScore > 80) return "High"
  if (urgencyScore < 30) return "Low"
  return "Medium"
}
