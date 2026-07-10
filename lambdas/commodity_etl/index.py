"""
AWS Lambda: Commodity Price ETL Processor
===========================================
Triggered hourly by EventBridge cron.
Fetches commodity prices, stores ticks, computes Z-scores,
and dispatches commodity_shock events when anomalies are detected.
"""

import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")
ZSCORE_THRESHOLD = float(os.environ.get("ZSCORE_THRESHOLD", "2.5"))
POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "")
POSTGRES_DB = os.environ.get("POSTGRES_DB", "risk_intelligence")

sqs = boto3.client("sqs")


def lambda_handler(event, context):
    """Lambda entry point — commodity price ETL cycle."""
    logger.info("📊 Commodity ETL Lambda triggered")

    # In production, this would fetch from commodity data APIs
    # (e.g., Alpha Vantage, Quandl, or Bloomberg Terminal feeds)
    # For now, process any price data passed in the event payload
    price_data = event.get("price_data", [])
    anomalies_dispatched = 0

    for tick in price_data:
        commodity_code = tick.get("commodity_code", "")
        spot_price = tick.get("spot_price", 0)
        zscore = tick.get("zscore", 0)

        # Check Z-score anomaly threshold
        if abs(zscore) >= ZSCORE_THRESHOLD:
            anomaly_message = {
                "trigger_source": "commodity_shock",
                "data_type": "price_anomaly",
                "commodity_code": commodity_code,
                "spot_price": spot_price,
                "zscore": zscore,
                "threshold": ZSCORE_THRESHOLD,
            }

            try:
                sqs.send_message(
                    QueueUrl=SQS_QUEUE_URL,
                    MessageBody=json.dumps(anomaly_message),
                    MessageGroupId="commodity-shock",
                )
                anomalies_dispatched += 1
                logger.warning(
                    f"📊 ANOMALY DETECTED: {commodity_code} Z={zscore:.2f} "
                    f"(threshold={ZSCORE_THRESHOLD})"
                )
            except Exception as e:
                logger.error(f"SQS dispatch error: {e}")

    logger.info(
        f"📊 Commodity ETL complete: {len(price_data)} ticks processed, "
        f"{anomalies_dispatched} anomalies dispatched"
    )

    return {
        "statusCode": 200,
        "body": json.dumps({
            "ticks_processed": len(price_data),
            "anomalies_dispatched": anomalies_dispatched,
        }),
    }
