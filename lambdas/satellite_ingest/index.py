"""
AWS Lambda: Satellite / AIS Feed Ingest Processor
===================================================
Triggered every 15 minutes by EventBridge cron.
Processes maritime AIS position data and satellite imagery metadata.
"""

import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")

sqs = boto3.client("sqs")


def lambda_handler(event, context):
    """Lambda entry point — satellite/AIS feed ingestion."""
    logger.info("🛰️ Satellite ingest Lambda triggered")

    total_dispatched = 0

    # Process AIS vessel position data
    ais_positions = event.get("ais_positions", [])
    for pos in ais_positions:
        message = {
            "trigger_source": "live_ingestion",
            "data_type": "ais_position",
            "mmsi": pos.get("mmsi", ""),
            "vessel_name": pos.get("name", ""),
            "latitude": pos.get("lat", 0.0),
            "longitude": pos.get("lon", 0.0),
            "speed_knots": pos.get("speed", 0.0),
            "heading": pos.get("heading", 0),
            "destination": pos.get("destination", ""),
        }

        try:
            sqs.send_message(
                QueueUrl=SQS_QUEUE_URL,
                MessageBody=json.dumps(message),
                MessageGroupId="satellite-ais",
            )
            total_dispatched += 1
        except Exception as e:
            logger.error(f"SQS dispatch error: {e}")

    # Process satellite imagery metadata
    imagery = event.get("imagery_metadata", [])
    for img in imagery:
        message = {
            "trigger_source": "live_ingestion",
            "data_type": "satellite_imagery",
            "source": img.get("source", "copernicus"),
            "capture_time": img.get("timestamp", ""),
            "bounding_box": img.get("bounding_box", []),
            "resolution_meters": img.get("resolution", 10),
            "image_url": img.get("download_url", ""),
        }

        try:
            sqs.send_message(
                QueueUrl=SQS_QUEUE_URL,
                MessageBody=json.dumps(message),
                MessageGroupId="satellite-imagery",
            )
            total_dispatched += 1
        except Exception as e:
            logger.error(f"SQS dispatch error: {e}")

    logger.info(f"🛰️ Satellite ingest complete: {total_dispatched} messages dispatched")

    return {
        "statusCode": 200,
        "body": json.dumps({"dispatched": total_dispatched}),
    }
