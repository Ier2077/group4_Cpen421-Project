"""
RabbitMQ publisher and consumer utilities using aio_pika.
Each service imports this and creates its own connection.
"""
import asyncio
import json
import logging
import os
from typing import Callable, Awaitable

import aio_pika
from aio_pika import ExchangeType, Message

logger = logging.getLogger(__name__)

def _build_rabbitmq_url() -> str:
    """
    Use RABBITMQ_URL if set (CloudAMQP / production).
    Otherwise build from individual vars (local Docker Compose).
    """
    url = os.getenv("RABBITMQ_URL")
    if url:
        return url
    return (
        f"amqp://{os.getenv('RABBITMQ_USER', 'guest')}:"
        f"{os.getenv('RABBITMQ_PASS', 'guest')}@"
        f"{os.getenv('RABBITMQ_HOST', 'rabbitmq')}:"
        f"{os.getenv('RABBITMQ_PORT', '5672')}/"
    )


RABBITMQ_URL = _build_rabbitmq_url()

EXCHANGE_NAME = "emergency.events"


class RabbitMQPublisher:
    def __init__(self):
        self._connection: aio_pika.abc.AbstractConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._exchange: aio_pika.abc.AbstractExchange | None = None

    async def connect(self):
        for attempt in range(10):
            try:
                self._connection = await aio_pika.connect_robust(RABBITMQ_URL)
                self._channel = await self._connection.channel()
                self._exchange = await self._channel.declare_exchange(
                    EXCHANGE_NAME, ExchangeType.TOPIC, durable=True
                )
                logger.info("RabbitMQ publisher connected.")
                return
            except Exception as e:
                logger.warning(f"RabbitMQ connect attempt {attempt+1} failed: {e}")
                await asyncio.sleep(3)
        raise RuntimeError("Could not connect to RabbitMQ after 10 attempts.")

    async def publish(self, routing_key: str, payload: dict):
        if self._exchange is None:
            await self.connect()
        message = Message(
            body=json.dumps(payload).encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await self._exchange.publish(message, routing_key=routing_key)
        logger.debug(f"Published [{routing_key}]: {payload}")

    async def close(self):
        if self._connection:
            await self._connection.close()


class RabbitMQConsumer:
    def __init__(self, queue_name: str, routing_keys: list[str]):
        self.queue_name = queue_name
        self.routing_keys = routing_keys
        self._connection: aio_pika.abc.AbstractConnection | None = None

    async def start(self, handler: Callable[[str, dict], Awaitable[None]]):
        for attempt in range(10):
            try:
                self._connection = await aio_pika.connect_robust(RABBITMQ_URL)
                break
            except Exception as e:
                logger.warning(f"Consumer connect attempt {attempt+1} failed: {e}")
                await asyncio.sleep(3)

        channel = await self._connection.channel()
        await channel.set_qos(prefetch_count=10)
        exchange = await channel.declare_exchange(
            EXCHANGE_NAME, ExchangeType.TOPIC, durable=True
        )
        queue = await channel.declare_queue(self.queue_name, durable=True)
        for key in self.routing_keys:
            await queue.bind(exchange, routing_key=key)

        async def _on_message(msg: aio_pika.IncomingMessage):
            async with msg.process():
                try:
                    payload = json.loads(msg.body.decode())
                    await handler(msg.routing_key, payload)
                except Exception as e:
                    logger.error(f"Error processing message {msg.routing_key}: {e}")

        await queue.consume(_on_message)
        logger.info(f"Consumer [{self.queue_name}] listening on {self.routing_keys}")

    async def close(self):
        if self._connection:
            await self._connection.close()


# Module-level publisher singleton
publisher = RabbitMQPublisher()