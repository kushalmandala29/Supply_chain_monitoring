"""
AWS Lambda: RSS / GDELT Feed Ingest Processor
================================================
Triggered every 5 minutes by EventBridge cron.
Fetches RSS feeds, normalizes entries, and dispatches to SQS.
"""

import json
import logging
import os

import boto3
import feedparser

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")

RSS_FEEDS = [
    "https://news.google.com/rss/search?q=supply+chain+disruption",
    "https://news.google.com/rss/search?q=shipping+port+congestion",
    "https://news.google.com/rss/search?q=trade+sanctions",
    "https://www.reliefweb.int/updates/rss.xml",
]

sqs = boto3.client("sqs")


def lambda_handler(event, context):
    """Lambda entry point — RSS feed ingestion."""
    logger.info("📡 RSS ingestion Lambda triggered")

    total_dispatched = 0

    for feed_url in RSS_FEEDS:
        try:
            parsed = feedparser.parse(feed_url)
            entries = parsed.entries[:10]

            for entry in entries:
                message = {
                    "trigger_source": "live_ingestion",
                    "data_type": "rss_article",
                    "headline": getattr(entry, "title", ""),
                    "summary": getattr(entry, "summary", ""),
                    "link": getattr(entry, "link", ""),
                    "published": getattr(entry, "published", ""),
                    "source_feed": feed_url,
                }

                sqs.send_message(
                    QueueUrl=SQS_QUEUE_URL,
                    MessageBody=json.dumps(message),
                    MessageGroupId="rss-ingest",
                )
                total_dispatched += 1

        except Exception as e:
            logger.error(f"RSS feed error ({feed_url}): {e}")

    logger.info(f"📡 RSS ingestion complete: {total_dispatched} messages dispatched to SQS")

    return {
        "statusCode": 200,
        "body": json.dumps({"dispatched": total_dispatched}),
    }
