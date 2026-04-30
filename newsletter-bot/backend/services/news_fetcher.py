"""
Fetches AU accounting/finance news from RSS feeds and optional NewsAPI.
Falls back gracefully if no API key is provided.
"""
import httpx
import feedparser
import os
from datetime import datetime, timezone
from typing import List, Dict


AU_ACCOUNTING_FEEDS = [
    {
        "url": "https://www.ato.gov.au/media-centre/media-releases/rss/",
        "source": "Australian Tax Office",
    },
    {
        "url": "https://www.abc.net.au/news/feed/2942460/rss.xml",
        "source": "ABC News Business",
    },
    {
        "url": "https://www.afr.com/rss/companies/financial-services",
        "source": "Australian Financial Review",
    },
    {
        "url": "https://www.smartcompany.com.au/feed/",
        "source": "Smart Company AU",
    },
    {
        "url": "https://www.accountantsdaily.com.au/rss",
        "source": "Accountants Daily",
    },
    {
        "url": "https://www.myob.com/au/blog/feed/",
        "source": "MYOB Blog AU",
    },
    {
        "url": "https://www.cpaaustralia.com.au/rss.xml",
        "source": "CPA Australia",
    },
]

ACCOUNTING_KEYWORDS = [
    "tax", "accounting", "finance", "CFO", "bookkeeping", "ATO",
    "payroll", "cash flow", "budget", "audit", "compliance",
    "SME", "small business", "accountant", "BAS", "GST", "FBT",
    "superannuation", "super", "SMSF", "xero", "myob", "revenue",
    "cost reduction", "efficiency", "workforce", "staffing", "outsource"
]


async def fetch_rss_articles(max_per_feed: int = 5) -> List[Dict]:
    articles = []

    for feed_config in AU_ACCOUNTING_FEEDS:
        try:
            feed = feedparser.parse(feed_config["url"])
            count = 0
            for entry in feed.entries:
                if count >= max_per_feed:
                    break
                title = entry.get("title", "")
                summary = entry.get("summary", entry.get("description", ""))
                link = entry.get("link", "")
                published = entry.get("published", str(datetime.now(timezone.utc)))

                is_relevant = any(
                    kw.lower() in (title + summary).lower()
                    for kw in ACCOUNTING_KEYWORDS
                )

                if is_relevant or feed_config["source"] in ("Accountants Daily", "CPA Australia", "Australian Tax Office"):
                    articles.append({
                        "title": title,
                        "summary": summary[:500] if summary else "",
                        "url": link,
                        "source": feed_config["source"],
                        "published": published,
                    })
                    count += 1
        except Exception:
            continue

    return articles


async def fetch_newsapi_articles(query: str = "accounting finance Australia", max_results: int = 10) -> List[Dict]:
    api_key = os.getenv("NEWSAPI_KEY", "")
    if not api_key:
        return []

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "pageSize": max_results,
                    "apiKey": api_key,
                },
            )
            data = resp.json()
            articles = []
            for article in data.get("articles", []):
                articles.append({
                    "title": article.get("title", ""),
                    "summary": article.get("description", ""),
                    "url": article.get("url", ""),
                    "source": article.get("source", {}).get("name", "NewsAPI"),
                    "published": article.get("publishedAt", ""),
                })
            return articles
    except Exception:
        return []


async def get_industry_news(industry: str = "accounting", max_results: int = 10) -> List[Dict]:
    rss_articles = await fetch_rss_articles(max_per_feed=3)
    newsapi_articles = await fetch_newsapi_articles(
        query=f"{industry} Australia SME finance 2025", max_results=6
    )

    combined = rss_articles + newsapi_articles
    seen_titles = set()
    unique = []
    for a in combined:
        if a["title"] and a["title"] not in seen_titles:
            seen_titles.add(a["title"])
            unique.append(a)

    return unique[:max_results]
