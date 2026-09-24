import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

USER_ID = "user_testrecordio"
EMAIL = "test@recordio.ai"
TOKEN = "recordio-test-token-abc123"

async def main():
    await db.users.update_one(
        {"email": EMAIL},
        {"$set": {"user_id": USER_ID, "email": EMAIL, "name": "Test Business",
                  "picture": "", "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await db.user_sessions.update_one(
        {"session_token": TOKEN},
        {"$set": {"session_token": TOKEN, "user_id": USER_ID,
                  "created_at": datetime.now(timezone.utc),
                  "expires_at": datetime.now(timezone.utc) + timedelta(days=3650)}},
        upsert=True,
    )
    print("seeded user", USER_ID, "token", TOKEN)

asyncio.run(main())
