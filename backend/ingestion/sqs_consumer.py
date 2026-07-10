"""
SQS Queue Consumer
====================
Consumes messages from the Amazon SQS FIFO task queue and dispatches
them to the LangGraph Supervisor Agent for processing.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import boto3

from backend.config import settings

logger = logging.getLogger("scri.ingestion.sqs_consumer")


class SQSConsumer:
    """Consumes tasks from the Amazon SQS FIFO queue."""

    def __init__(self) -> None:
        self.queue_url = settings.app.sqs_queue_url
        self.client = boto3.client(
            "sqs",
            region_name=settings.dynamodb.region,
        )

    async def poll_messages(self, max_messages: int = 10) -> list[dict[str, Any]]:
        """
        Long-poll the SQS queue for new task messages.

        Args:
            max_messages: Maximum number of messages to receive (1-10).

        Returns:
            List of parsed message payloads.
        """
        try:
            response = self.client.receive_message(
                QueueUrl=self.queue_url,
                MaxNumberOfMessages=min(max_messages, 10),
                WaitTimeSeconds=20,  # Long polling
                MessageAttributeNames=["All"],
            )

            messages = response.get("Messages", [])
            tasks = []

            for msg in messages:
                try:
                    body = json.loads(msg.get("Body", "{}"))
                    tasks.append({
                        "message_id": msg.get("MessageId"),
                        "receipt_handle": msg.get("ReceiptHandle"),
                        "payload": body,
                    })
                except json.JSONDecodeError as e:
                    logger.warning(f"📨 Invalid SQS message body: {e}")

            if tasks:
                logger.info(f"📨 SQS consumer: {len(tasks)} messages received")

            return tasks

        except Exception as e:
            logger.error(f"📨 SQS poll error: {e}")
            return []

    async def delete_message(self, receipt_handle: str) -> None:
        """Delete a processed message from the queue."""
        try:
            self.client.delete_message(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle,
            )
        except Exception as e:
            logger.error(f"📨 SQS delete error: {e}")

    async def send_message(
        self, payload: dict[str, Any], group_id: str = "default"
    ) -> None:
        """Send a message to the SQS FIFO queue."""
        try:
            self.client.send_message(
                QueueUrl=self.queue_url,
                MessageBody=json.dumps(payload),
                MessageGroupId=group_id,
            )
            logger.info(f"📨 SQS message sent | group={group_id}")
        except Exception as e:
            logger.error(f"📨 SQS send error: {e}")
