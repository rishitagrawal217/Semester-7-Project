import re
from urllib.parse import urlsplit


# Common two-label public suffixes (ccTLD + generic second level), so subdomain
# counting doesn't mistake e.g. "vtop.vit.ac.in" for 3 stacked subdomains.
_TWO_LABEL_SUFFIXES = {
    "co.uk", "org.uk", "ac.uk", "gov.uk", "sch.uk", "net.uk",
    "co.in", "org.in", "net.in", "ac.in", "edu.in", "gov.in", "res.in", "gen.in",
    "co.jp", "ne.jp", "or.jp", "ac.jp",
    "co.kr", "or.kr", "ac.kr",
    "com.au", "net.au", "org.au", "edu.au", "gov.au",
    "com.br", "net.br", "org.br",
    "co.za", "org.za",
    "co.nz", "org.nz", "net.nz",
    "com.mx", "com.sg", "com.hk", "co.id", "com.tr", "com.tw",
}

# Recognized "ordinary" TLDs — the model is scoped to plain domain-style URLs
# (scheme + optional www/subdomain + domain + one of these extensions), not
# arbitrary deep paths. A suffix outside this list is itself a mild signal.
_KNOWN_TLDS = {
    "com", "org", "net", "edu", "gov", "mil", "int", "biz", "info", "name",
    "pro", "app", "dev", "tech", "shop", "store", "blog", "online", "site",
    "xyz", "cloud", "ai", "io", "co", "me", "in", "us", "uk", "au", "ca",
    "de", "fr", "jp", "cn", "ru", "br", "it", "es", "nl", "ch", "se", "no",
    "fi", "za", "sg", "hk", "ae", "sa", "nz", "kr", "tv", "fm", "cc", "ly", "to",
}

_TLD_LIST = sorted(_KNOWN_TLDS | {
    "tk", "ml", "ga", "cf", "gq", "win", "work", "click", "link", "loan",
    "review", "country", "kim", "cricket", "science", "party", "gdn", "trade",
    "date", "faith", "men", "download", "stream", "bid", "accountant", "racing",
})

_SHORTENING_SERVICES = [
    "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
    "adf.ly", "bitly.com", "cutt.ly", "shorte.st", "rebrand.ly", "tiny.cc",
    "rb.gy", "s.id", "v.gd", "shorturl.at",
]

_SUSPICIOUS_TLDS = {
    "tk", "ml", "ga", "cf", "gq", "xyz", "top", "work", "click", "link",
    "loan", "win", "review", "country", "kim", "cricket", "science", "party",
    "gdn", "trade", "date", "faith", "men", "download", "stream", "bid",
    "accountant", "racing",
}

_PHISH_HINT_WORDS = [
    "login", "signin", "sign-in", "log-in", "account", "update", "confirm",
    "verify", "verification", "secure", "security", "banking", "password",
    "credential", "wallet", "suspend", "suspended", "locked", "unlock",
    "urgent", "alert", "support", "webscr", "ebayisapi", "recovery", "unusual",
]

_PATH_EXTENSIONS = (".php", ".asp", ".aspx", ".jsp", ".cgi", ".exe")

_WORD_SPLIT_RE = re.compile(r"[^A-Za-z0-9]+")
_IPV4_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")


def _words(text: str) -> list:
    return [w for w in _WORD_SPLIT_RE.split(text) if w]


def _word_stats(text: str) -> dict:
    words = _words(text)
    lengths = [len(w) for w in words]
    return {
        "count": len(words),
        "shortest": min(lengths) if lengths else 0,
        "longest": max(lengths) if lengths else 0,
        "avg": (sum(lengths) / len(lengths)) if lengths else 0.0,
    }


def _registrable_parts(hostname: str) -> tuple:
    """Split a hostname into (subdomain_labels, registrable_domain_labels)."""
    labels = hostname.split(".") if hostname else []
    if len(labels) <= 2:
        return [], labels
    last_two = ".".join(labels[-2:])
    if last_two in _TWO_LABEL_SUFFIXES and len(labels) > 2:
        return labels[:-3], labels[-3:]
    return labels[:-2], labels[-2:]


# Manually curated, deliberately small safety net - not learned from data.
# Our lexical-only feature set has no concept of domain reputation, so it
# can mistake a legitimate service subdomain (mail.google.com,
# login.microsoftonline.com) for phishing based purely on structural
# pattern ("generic word as a subdomain" also happens to be a real phishing
# tactic). Short-circuiting these known-major platforms to "safe" avoids
# that specific, high-confidence false-positive failure mode.
_TRUSTED_DOMAINS = {
    "google.com", "youtube.com", "gmail.com", "microsoft.com", "microsoftonline.com",
    "live.com", "outlook.com", "office.com", "apple.com", "icloud.com",
    "amazon.com", "github.com", "gitlab.com", "wikipedia.org", "facebook.com",
    "instagram.com", "whatsapp.com", "paypal.com", "netflix.com", "twitter.com",
    "x.com", "linkedin.com", "spotify.com", "dropbox.com", "reddit.com",
    "stackoverflow.com", "yahoo.com", "adobe.com", "salesforce.com", "zoom.us", "slack.com",
}


def trusted_domain_match(url: str):
    """Returns the matched registrable domain if url's host belongs to a
    well-known, high-reputation platform, else None."""
    if not url:
        return None
    raw = url.strip()
    candidate = raw if "://" in raw else f"http://{raw}"
    hostname = (urlsplit(candidate).hostname or "").lower()
    _, registrable_labels = _registrable_parts(hostname)
    registrable_domain = ".".join(registrable_labels)
    return registrable_domain if registrable_domain in _TRUSTED_DOMAINS else None


def extract_features_v2(url: str) -> dict:
    """Domain-scoped lexical feature set for plain, domain-style URLs
    (scheme + optional www/subdomain + registrable domain + a recognized
    extension, e.g. https://www.example.co.in) - no network/WHOIS/page-fetch
    calls, and no reliance on path/query content.

    This is intentionally *not* a general-purpose URL scanner: deep paths and
    query strings are ignored entirely rather than scored, because scoring
    them made the model key off "does this URL have a path" - which flagged
    completely ordinary pages (e.g. github.com/login, accounts.google.com/...)
    as phishing purely because the training set's legitimate URLs skew toward
    bare homepages. Restricting scope to the hostname keeps the signal honest.
    Used identically by training and inference, so there is no train/serve skew.
    """
    if not url:
        return {}

    raw = url.strip()
    candidate = raw if "://" in raw else f"http://{raw}"
    parsed = urlsplit(candidate)
    hostname = (parsed.hostname or "").lower()
    netloc = (parsed.netloc or "").lower()
    domain_part = f"{parsed.scheme}://{netloc}" if netloc else raw
    path = (parsed.path or "").lower()
    path_and_query = path + (("?" + parsed.query) if parsed.query else "")
    has_www = hostname.startswith("www.")
    # Strip a leading "www." before computing length/word/char-shape features,
    # so the (dataset-vintage) convention of prefixing legit sites with "www."
    # doesn't leak into five different features at once - it gets exactly one
    # vote, via nb_www, instead of quietly inflating length_hostname/word
    # counts/etc. and making any modern no-www domain (github.com, twitter.com)
    # look anomalous just for lacking that prefix.
    stats_host = hostname[4:] if has_www else hostname

    subdomain_labels, registrable_labels = _registrable_parts(hostname)

    host_stats = _word_stats(stats_host)

    # Longest run of any single repeated character in the hostname (run length >= 2).
    char_repeat = 0
    run_len = 1
    for i in range(1, len(stats_host)):
        if stats_host[i] == stats_host[i - 1]:
            run_len += 1
        else:
            run_len = 1
        if run_len > char_repeat:
            char_repeat = run_len

    sld = registrable_labels[0] if registrable_labels else ""
    vowels = sum(1 for c in sld if c in "aeiou")
    random_domain = 1 if len(sld) >= 8 and vowels / len(sld) < 0.2 else 0

    features = {
        "length_url": len(domain_part),
        "length_hostname": len(stats_host),
        "ip": 1 if _IPV4_RE.match(hostname) or hostname.count(":") >= 2 else 0,
        "nb_dots": stats_host.count("."),
        "nb_hyphens": stats_host.count("-"),
        "nb_at": netloc.count("@"),
        "nb_underscore": stats_host.count("_"),
        "nb_tilde": stats_host.count("~"),
        "nb_percent": stats_host.count("%"),
        "nb_colon": netloc.count(":"),
        "nb_www": 1 if has_www else 0,
        "nb_com": stats_host.count(".com"),
        "https_token": 1 if "https" in stats_host else 0,
        "ratio_digits_url": (sum(c.isdigit() for c in domain_part) / len(domain_part)) if domain_part else 0.0,
        "ratio_digits_host": (sum(c.isdigit() for c in stats_host) / len(stats_host)) if stats_host else 0.0,
        "punycode": 1 if "xn--" in hostname else 0,
        "port": 1 if parsed.port is not None else 0,
        "tld_in_subdomain": 1 if any(t == part for t in _TLD_LIST for part in subdomain_labels) else 0,
        "abnormal_subdomain": 1 if len(subdomain_labels) > 2 else 0,
        "nb_subdomains": len(subdomain_labels),
        "prefix_suffix": 1 if "-" in ".".join(registrable_labels) else 0,
        "shortening_service": 1 if any(s in hostname for s in _SHORTENING_SERVICES) else 0,
        "suspecious_tld": 1 if registrable_labels and registrable_labels[-1] in _SUSPICIOUS_TLDS else 0,
        "known_tld": 1 if registrable_labels and (
            registrable_labels[-1] in _KNOWN_TLDS or ".".join(registrable_labels[-2:]) in _TWO_LABEL_SUFFIXES
        ) else 0,
        "random_domain": random_domain,
        # Keyword-squatting in the domain itself (e.g. "secure-paypal-login.tk"),
        # scoped to the hostname only since path content is out of scope.
        "phish_hints": sum(stats_host.count(w) for w in _PHISH_HINT_WORDS),
        "char_repeat": char_repeat,
        "length_words_host": host_stats["count"],
        "shortest_word_host": host_stats["shortest"],
        "longest_word_host": host_stats["longest"],
        "avg_word_host": host_stats["avg"],
        # Narrow, targeted path/query checks for specific evasion tricks - these
        # look for particular attack patterns rather than generic "path exists"
        # statistics, so they don't penalize ordinary pages like "/login" or
        # "/pricing" the way word-count-over-the-whole-path features did.
        "path_extension": 1 if path.endswith(_PATH_EXTENSIONS) else 0,
        "tld_in_path": 1 if any(f".{t}" in path for t in _KNOWN_TLDS) else 0,
        "http_in_path": 1 if "http" in path_and_query else 0,
        "nb_dslash": path_and_query.count("//"),
    }
    return features