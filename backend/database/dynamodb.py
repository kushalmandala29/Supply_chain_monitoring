"""
Amazon DynamoDB Session Store
===============================
Ephemeral state memory for LangGraph runtime checkpoints,
WebSocket connection keys, and transient UI parameters.
Configured with 48-hour TTL auto-expiry per spec §6.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import boto3
from boto3.dynamodb.types import TypeDeserializer, TypeSerializer

from backend.config import settings

logger = logging.getLogger("scri.db.dynamodb")

TTL_HOURS = 48


class DynamoDBStore:
    """DynamoDB session and checkpoint store."""

    def __init__(self) -> None:
        self.table_name = settings.dynamodb.table_name
        self.client = boto3.client(
            "dynamodb",
            region_name=settings.dynamodb.region,
        )
        self._serializer = TypeSerializer()
        self._deserializer = TypeDeserializer()

    async def put_checkpoint(
        self, thread_id: str, checkpoint_id: str, data: dict[str, Any]
    ) -> None:
        """
        Store a LangGraph runtime checkpoint.

        Args:
            thread_id: Unique thread identifier.
            checkpoint_id: Checkpoint step identifier.
            data: Checkpoint state data.
        """
        ttl_expiry = int(time.time()) + (TTL_HOURS * 3600)

        item = {
            "thread_id": {"S": thread_id},
            "checkpoint_id": {"S": checkpoint_id},
            "state_data": self._serializer.serialize(data),
            "ttl_expiry": {"N": str(ttl_expiry)},
            "created_at": {"N": str(int(time.time()))},
        }

        try:
            self.client.put_item(TableName=self.table_name, Item=item)
            logger.info(f"💾 DynamoDB checkpoint saved: {thread_id}/{checkpoint_id}")
        except Exception as e:
            logger.error(f"💾 DynamoDB put error: {e}")
            raise

    async def get_checkpoint(
        self, thread_id: str, checkpoint_id: str
    ) -> dict[str, Any] | None:
        """Retrieve a checkpoint by thread and checkpoint ID."""
        try:
            response = self.client.get_item(
                TableName=self.table_name,
                Key={
                    "thread_id": {"S": thread_id},
                    "checkpoint_id": {"S": checkpoint_id},
                },
            )
            item = response.get("Item")
            if item:
                return {k: self._deserializer.deserialize(v) for k, v in item.items()}
            return None
        except Exception as e:
            logger.error(f"💾 DynamoDB get error: {e}")
            return None

    async def get_thread_checkpoints(self, thread_id: str) -> list[dict[str, Any]]:
        """Retrieve all checkpoints for a thread."""
        try:
            response = self.client.query(
                TableName=self.table_name,
                KeyConditionExpression="thread_id = :tid",
                ExpressionAttributeValues={":tid": {"S": thread_id}},
                ScanIndexForward=True,
            )
            items = response.get("Items", [])
            return [
                {k: self._deserializer.deserialize(v) for k, v in item.items()}
                for item in items
            ]
        except Exception as e:
            logger.error(f"💾 DynamoDB query error: {e}")
            return []
