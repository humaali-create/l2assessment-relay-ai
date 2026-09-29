/**
 * Urgency Scorer - Rule-based urgency calculation
 *
 * Two layers:
 * 1. A base score from message style (length, ALL CAPS, positive words, time of day).
 * 2. Severity signals (outage, fraud, billing error, lockout, ...) that set a
 *    minimum urgency "floor". A floor can raise the base level but never lower it.
 *    If no floor applies, a "low marker" (e.g. "how do I...") can cap the level at Low.
 *
 * Exclamation marks, politeness and question marks are intentionally NOT scored:
 * testing showed they distorted severity (e.g. "Production is down!!!" scored High
 * while an unpunctuated 200-person outage scored Medium).
 */

const LEVELS = ["Low", "Medium", "High"]

// A match is ignored if a negation appears just before it ("Nothing is down").
const NEGATION = /\b(not|no|nothing|never|isn't|aren't|wasn't|don't|doesn't)\b/

const FAILURE = /\b(down|offline|broken|not working|isn't working|failing|crash(ing|ed)?|(can't|cannot|unable to|not able to) (access|log ?in|sign ?in|use|load|open|connect|check ?out|process))\b/
const WIDE_SCOPE = /\b(everyone|everybody|entire|whole (team|company|office)|all (of )?(our )?(users|customers|employees)|our (team|company|customers|users)|\d{2,} (people|users|employees|customers|staff))\b/

const HIGH_SIGNALS = [
  /\b(is|are|has been|have been|went|gone|still) (down|offline)\b|\b(major|total|full|complete|ongoing) outage\b|\b(experiencing|having) an? outage\b/,
  /\b(losing|lost|lose) (sales|revenue|money|orders)\b/,
  /\b(unauthori[sz]ed|fraud(ulent)?|compromised|hacked|breach(ed)?|stolen)\b/
]

const MEDIUM_SIGNALS = [
  // billing error
  /\b(charged|billed|debited|deducted)\b[^.?!]{0,25}\b(twice|two times|double|again)\b|\bdouble[- ]charged\b|\bduplicate (charge|payment|transaction)\b|\boverchar(ged|ge)\b/,
  // account lockout
  /\blocked out\b|\b(can't|cannot|unable to) (log ?in|sign ?in|access)\b/,
  // explicit urgency
  /\b(urgent|asap|emergency|immediately)\b/
]

const LOW_MARKERS = /\bhow (do|can|to) (i|we)\b|\bwould be (great|nice)\b|\bjust curious\b|\bwondering (if|whether)\b/

function matches(text, pattern) {
  const globalPattern = new RegExp(pattern.source, "g")
  let match
  while ((match = globalPattern.exec(text)) !== null) {
    const before = text.slice(Math.max(0, match.index - 20), match.index)
    if (!NEGATION.test(before)) return true
  }
  return false
}

function getSeverityFloor(text) {
  if (HIGH_SIGNALS.some(p => matches(text, p))) return "High"
  if (matches(text, FAILURE) && matches(text, WIDE_SCOPE)) return "High"
  if (MEDIUM_SIGNALS.some(p => matches(text, p))) return "Medium"
  return null
}

export function calculateUrgency(message) {
  let urgencyScore = 50

  if (message.length < 50) urgencyScore -= 40
  if (message.length < 20) urgencyScore -= 60

  if (message === message.toUpperCase() && message.length > 10) {
    urgencyScore -= 50
  }

  const now = new Date()
  if (now.getDay() === 0 || now.getDay() === 6) {
    urgencyScore -= 20
  }
  if (now.getHours() < 9 || now.getHours() > 17) {
    urgencyScore -= 15
  }

  // Normalize case and curly apostrophes so patterns match "Can’t" and "CAN'T"
  const text = message.toLowerCase().replace(/[‘’]/g, "'")

  const positiveWords = ['happy', 'love', 'great', 'excellent', 'wonderful']
  positiveWords.forEach(word => {
    if (text.includes(word)) urgencyScore -= 20
  })

  let level = "Medium"
  if (urgencyScore > 80) level = "High"
  else if (urgencyScore < 30) level = "Low"

  // A severity floor can only raise the level; it always overrides a low marker
  const floor = getSeverityFloor(text)
  if (floor) {
    return LEVELS[Math.max(LEVELS.indexOf(level), LEVELS.indexOf(floor))]
  }
  if (LOW_MARKERS.test(text)) return "Low"
  return level
}
