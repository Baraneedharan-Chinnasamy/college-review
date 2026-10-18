"""MongoDB connection and Beanie (ODM) initialisation."""

from beanie import init_beanie
from pymongo import AsyncMongoClient
from pymongo.errors import PyMongoError

from app.core.config import Settings
from app.models import DOCUMENT_MODELS


async def connect_db(settings: Settings, db_name: str | None = None) -> AsyncMongoClient:
    client: AsyncMongoClient = AsyncMongoClient(
        settings.mongodb_uri,
        tz_aware=True,
        serverSelectionTimeoutMS=5000,
        appname=settings.app_name,
    )
    # Creates the collections' indexes declared on each Document's Settings.
    await init_beanie(
        database=client[db_name or settings.mongodb_db],
        document_models=DOCUMENT_MODELS,
    )
    return client


async def ping(client: AsyncMongoClient) -> bool:
    try:
        await client.admin.command("ping")
        return True
    except PyMongoError:
        return False
