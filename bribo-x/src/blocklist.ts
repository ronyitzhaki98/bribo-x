const POLITICS = [
  "election", "elections", "electoral", "ballot", "ballots", "polls", "voter", "voters", "voting",
  "senate", "senator", "senators", "congress", "congressman", "congresswoman", "parliament", "parliamentary",
  "president", "presidential", "governor", "mayor", "democrat", "democrats", "democratic", "republican", "republicans",
  "gop", "tory", "tories", "labour", "white house", "kremlin", "downing street", "supreme court",
  "trump", "biden", "harris", "vance", "obama", "putin", "zelensky", "netanyahu", "xi jinping", "modi",
  "starmer", "macron", "erdogan", "khamenei", "immigration", "abortion", "gaza", "israel", "israeli",
  "palestine", "palestinian", "hamas", "hezbollah", "ukraine", "ukrainian", "russia", "russian", "iran",
  "sanctions", "nato", "tariff", "tariffs",
];

const TRAGEDY = [
  "dead", "dies", "died", "death", "deaths", "deadly", "killed", "kill", "kills", "killing", "murder", "murdered",
  "shooting", "shooter", "shot", "stabbing", "stabbed", "crash", "crashed", "earthquake", "flood", "flooding",
  "hurricane", "wildfire", "tornado", "tsunami", "attack", "attacks", "bomb", "bombing", "terror", "terrorist",
  "hostage", "hostages", "victim", "victims", "injured", "overdose", "suicide", "cancer", "funeral", "massacre",
  "genocide", "rape", "abuse", "abused", "war", "wars", "missile", "missiles", "airstrike", "troops", "famine",
  "outbreak", "pandemic", "epidemic", "kidnapped", "trafficking",
];

const HEADLINE_ONLY = ["government", "minister", "ministry", "lawmakers", "legislation", "policy", "campaign", "protest", "protests"];

function compile(terms: string[]): RegExp {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}

const HEADLINE_RE = compile([...POLITICS, ...TRAGEDY, ...HEADLINE_ONLY]);
const OUTPUT_RE = compile([...POLITICS, ...TRAGEDY]);

export function isBlockedHeadline(text: string): boolean {
  return HEADLINE_RE.test(text);
}

export function isBlockedOutput(text: string): boolean {
  return OUTPUT_RE.test(text);
}
