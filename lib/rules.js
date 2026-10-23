// Rule-based risk-signal detection. Works offline and sets a floor under the AI result.
const R = [
  [/guarantee[d]?|assured returns?|risk[- ]?free|pakka|sure[- ]shot/gi, 'Guaranteed returns', 'Real investments carry risk. No honest source can promise a fixed profit.'],
  [/\b([3-9]\d|\d{3})\s?%/g, 'Unrealistic returns', 'Returns this high, especially monthly, are far outside what regulated products offer.'],
  [/\b(today|immediately|urgent(ly)?|hurry|last chance|expires?|abhi|turant|aaj hi|within \d+ (hours?|minutes?))\b/gi, 'Urgency', 'Pressure to act fast is meant to stop you from checking.'],
  [/limited (slots?|seats?|period|offer)|only \d+ (slots?|seats?|left)|few (slots|seats)/gi, 'Limited-slot pressure', 'Fake scarcity pushes people to decide before they verify.'],
  [/\bkyc\b|account (will be )?(blocked|suspended)|update (your )?(pan|aadhaar)/gi, 'KYC or account-block pressure', 'Genuine KYC is done in the official app or branch, not through a forwarded message.'],
  [/(https?:\/\/|www\.)\S+|\b(bit\.ly|t\.me|wa\.me|tinyurl\.com)\S*|\b(using|click|tap|open)\s+(the\s+|this\s+)?(link|url)( below| here)?/gi, 'External link', 'Links in unsolicited messages can lead to look-alike pages that steal details.'],
  [/\b(otp|upi pin|password|cvv)\b/gi, 'Mentions OTP, PIN or password', 'Banks and regulators never ask you for these.'],
  [/(invest|deposit|transfer|pay|send)\s+(₹|rs\.?|inr)?\s?[\d,]{3,}/gi, 'Asks for money upfront', 'Being asked to pay first, before anything is verified, is a common pattern.'],
  [/(vip|premium) (group|channel)|join (my|our) (telegram|whatsapp)|telegram channel/gi, 'Pushes you into private groups', 'Private groups are hard to monitor and are often used to build false hype.'],
  [/congratulations|you (have been|are) selected|you('ve| have) won/gi, 'Unsolicited "you are selected" hook', 'Real opportunities rarely arrive as a surprise prize.']
];
const ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const HIN = {
  HIGH: 'इस संदेश में कई चेतावनी संकेत हैं। पैसे न भेजें, OTP/PIN किसी को न बताएं, पहले आधिकारिक स्रोत से जाँच करें।',
  MEDIUM: 'इसमें कुछ चेतावनी संकेत हैं। कोई भी कदम उठाने से पहले भेजने वाले की आधिकारिक स्रोत से पुष्टि करें।',
  LOW: 'कोई आम चेतावनी संकेत नहीं मिला, फिर भी पैसे या निजी जानकारी देने से पहले जाँच ज़रूर करें।'
};
const ACTIONS = [
  'Do not transfer money immediately.',
  'Do not share OTP, PIN or password with anyone.',
  'Verify the organization through official sources.',
  'Avoid tapping suspicious links.',
  'If you already paid, call 1930 or report at cybercrime.gov.in.'
];
function analyze(text) {
  const seen = new Map();
  for (const [re, label, why] of R) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) { seen.set(label, why); if (!m[0]) re.lastIndex++; }
  }
  const why = [...seen].map(([label, w]) => ({ label, why: w }));
  const n = why.length, risk = n >= 4 ? 'HIGH' : n >= 2 ? 'MEDIUM' : 'LOW';
  const explanation = n
    ? `This message contains ${n} warning sign${n > 1 ? 's' : ''} commonly associated with financial scams: ${why.map(x => x.label.toLowerCase()).join(', ')}. That does not prove who sent it, but it is enough reason to slow down and verify before acting.`
    : 'We did not find the usual warning signs. That is not a guarantee of safety. If money or personal details are involved, verify the sender through an official source.';
  return { risk, warning_signs: why, explanation, explanation_hi: HIN[risk] };
}
module.exports = { analyze, ORDER, ACTIONS };
