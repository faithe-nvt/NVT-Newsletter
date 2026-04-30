"""
Generates newsletter content using Claude API.
Produces A/B variants with content-sandwich structure for AU accounting/CFO audience.
"""
import anthropic
import json
import os
from typing import List, Dict, Tuple


INDUSTRY_PROFILES = {
    "accounting": {
        "audience": "Australian accountants, CFOs, and finance managers at SMEs",
        "pain_points": [
            "admin overload and time spent on non-billable work",
            "difficulty scaling without blowing out headcount costs",
            "compliance pressure from ATO changes",
            "cash flow forecasting and financial visibility",
            "finding and retaining quality finance staff",
        ],
        "tone": "analytical, data-first, ROI-focused, concise, no fluff",
        "format_rules": [
            "Lead with a specific stat or bottleneck observation — never a generic greeting",
            "Use short paragraphs (2-3 sentences max)",
            "Use bullet points for takeaways",
            "Frame everything around time saved, risk reduced, or cost cut",
            "Australian English (colour, organisation, utilise, etc.)",
            "Do not use exclamation marks",
            "Avoid vague phrases like 'in today's world' or 'game-changing'",
        ],
        "cta_options": [
            "Run the numbers on how much your firm is losing to admin overhead — netavirtualteam.com.au/calculator",
            "See how other AU accounting firms are building leaner ops — netavirtualteam.com.au",
            "Find out what a Virtual Professional could take off your plate — netavirtualteam.com.au",
            "Build a role plan that fits your firm's next stage — netavirtualteam.com.au",
        ],
    }
}


CONTENT_SANDWICH_TEMPLATE = """
STRUCTURE (strict):
1. HOOK — one sharp sentence with a stat, ATO update, or industry friction point
2. INSIGHT BLOCK — 2-3 paragraphs unpacking the news. What does it mean for AU accountants/SMEs?
3. MID CTA — one sentence, subtle. Frame as "what others are doing" not a pitch
4. PRACTICAL TAKEAWAY — 3-5 bullet points. Specific, actionable, no fluff
5. CLOSING THOUGHT — one paragraph tying it back to sustainable practice growth
6. END CTA — soft sell. Link to netavirtualteam.com.au with a specific hook (calculator, role plan, etc.)
"""


def build_newsletter_prompt(
    articles: List[Dict],
    industry: str,
    variant: str,
    previous_angle: str = None,
) -> str:
    profile = INDUSTRY_PROFILES.get(industry, INDUSTRY_PROFILES["accounting"])

    articles_text = "\n\n".join([
        f"SOURCE: {a['source']}\nTITLE: {a['title']}\nSUMMARY: {a['summary']}\nURL: {a['url']}"
        for a in articles[:6]
    ])

    variant_instruction = {
        "a": (
            "VARIANT A — Analytical angle: Lead with data, regulatory change, or operational metrics. "
            "Tone is measured, precise, like a well-researched memo from a trusted industry peer."
        ),
        "b": (
            "VARIANT B — Narrative angle: Lead with a scenario or pattern you're seeing across firms. "
            "Tone is still professional but slightly more conversational — like advice from a senior colleague. "
            "Use a different hook, different angle, and different CTA from Variant A."
        ),
    }[variant]

    avoid_angle = f"\nDo NOT use the same angle as: {previous_angle}" if previous_angle else ""

    return f"""You are a specialist B2B content writer for Neta Virtual Team, an Australian offshore staffing company focused on SMEs.

TARGET AUDIENCE: {profile['audience']}
PAIN POINTS: {', '.join(profile['pain_points'])}
TONE: {profile['tone']}
FORMAT RULES:
{chr(10).join('- ' + r for r in profile['format_rules'])}

{variant_instruction}{avoid_angle}

CONTENT STRUCTURE TO FOLLOW:
{CONTENT_SANDWICH_TEMPLATE}

AVAILABLE NEWS/SOURCES (use 2-4 of these, cite them inline):
{articles_text}

COMPANY CTA OPTIONS (pick the most relevant one for mid + end):
{chr(10).join('- ' + c for c in profile['cta_options'])}

OUTPUT FORMAT — return valid JSON only, no markdown fences:
{{
  "subject_line": "...",
  "hook": "...",
  "insight_block": "...",
  "mid_cta": "...",
  "practical_takeaway": ["...", "...", "...", "...", "..."],
  "closing_thought": "...",
  "end_cta": "...",
  "angle_used": "brief label e.g. 'compliance risk framing' or 'capacity bottleneck narrative'",
  "style_rationale": "2-3 sentences on why this writing style and angle works for this audience",
  "sources_used": [{{"title": "...", "source": "...", "url": "..."}}]
}}"""


async def generate_newsletter_variants(
    articles: List[Dict],
    industry: str = "accounting",
) -> Tuple[Dict, Dict, str]:
    """Returns (variant_a, variant_b, campaign_rationale)"""
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt_a = build_newsletter_prompt(articles, industry, "a")
    response_a = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system="You are an expert B2B newsletter writer. Output valid JSON only.",
        messages=[{"role": "user", "content": prompt_a}],
    )
    variant_a = json.loads(response_a.content[0].text)

    prompt_b = build_newsletter_prompt(
        articles, industry, "b", previous_angle=variant_a.get("angle_used", "")
    )
    response_b = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system="You are an expert B2B newsletter writer. Output valid JSON only.",
        messages=[{"role": "user", "content": prompt_b}],
    )
    variant_b = json.loads(response_b.content[0].text)

    rationale_prompt = f"""Given these two newsletter variants for AU accounting professionals:

Variant A angle: {variant_a.get('angle_used')}
Variant B angle: {variant_b.get('angle_used')}

Write a 3-4 sentence QA rationale explaining:
1. Why this topic is timely and relevant for AU accountants/CFOs right now
2. What the A/B test is designed to learn (analytical vs narrative preference)
3. What a successful campaign result looks like for Neta Virtual Team's brand positioning

Be specific and insightful. No fluff."""

    rationale_resp = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": rationale_prompt}],
    )
    campaign_rationale = rationale_resp.content[0].text

    return variant_a, variant_b, campaign_rationale


def render_email_html(variant: Dict, campaign_id: int, subscriber_id: int, token: str, base_url: str) -> str:
    """Renders the newsletter as HTML with tracking pixel and tracked links."""
    takeaways_html = "".join(
        f"<li style='margin-bottom:8px;'>{t}</li>"
        for t in variant.get("practical_takeaway", [])
    )

    tracking_pixel = f'<img src="{base_url}/track/open/{token}" width="1" height="1" style="display:none;" />'

    def tracked_link(url: str, text: str) -> str:
        import urllib.parse
        encoded = urllib.parse.quote(url, safe="")
        return f'<a href="{base_url}/track/click/{token}?url={encoded}" style="color:#1a56db;text-decoration:underline;">{text}</a>'

    mid_cta_text = variant.get("mid_cta", "")
    end_cta_text = variant.get("end_cta", "")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{variant.get('subject_line', 'Newsletter')}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr><td style="background:#0f172a;padding:28px 40px;">
        <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Neta Virtual Team — Industry Briefing</p>
        <p style="margin:8px 0 0;color:#f8fafc;font-size:22px;font-weight:bold;font-family:Arial,sans-serif;line-height:1.3;">{variant.get('subject_line', '')}</p>
      </td></tr>

      <!-- Hook -->
      <tr><td style="padding:32px 40px 0;border-left:4px solid #1a56db;">
        <p style="margin:0;color:#1e293b;font-size:17px;line-height:1.6;font-style:italic;">{variant.get('hook', '')}</p>
      </td></tr>

      <!-- Insight block -->
      <tr><td style="padding:24px 40px 0;">
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.8;">{variant.get('insight_block', '').replace(chr(10), '<br/><br/>')}</p>
      </td></tr>

      <!-- Mid CTA -->
      <tr><td style="padding:24px 40px;">
        <table width="100%" cellpadding="16" cellspacing="0" style="background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd;">
          <tr><td>
            <p style="margin:0;color:#0369a1;font-size:14px;font-family:Arial,sans-serif;">{mid_cta_text}</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Takeaways -->
      <tr><td style="padding:0 40px 24px;">
        <p style="margin:0 0 12px;color:#0f172a;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;">Key Takeaways</p>
        <ul style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:1.8;">
          {takeaways_html}
        </ul>
      </td></tr>

      <!-- Closing -->
      <tr><td style="padding:0 40px 32px;">
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.8;">{variant.get('closing_thought', '')}</p>
      </td></tr>

      <!-- End CTA -->
      <tr><td style="background:#0f172a;padding:28px 40px;">
        <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;font-family:Arial,sans-serif;">From Neta Virtual Team</p>
        <p style="margin:0;color:#f8fafc;font-size:14px;line-height:1.7;font-family:Arial,sans-serif;">{end_cta_text}</p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:20px 40px;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Arial,sans-serif;">
          You're receiving this because you subscribed to Neta Virtual Team updates.<br/>
          <a href="{base_url}/unsubscribe/{token}" style="color:#94a3b8;">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
{tracking_pixel}
</body>
</html>"""
