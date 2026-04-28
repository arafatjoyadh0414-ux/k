import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workshop-dashboard-1.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def workshop_session(mongo):
    """Seed a workshop user with approved KYC + credit limit."""
    suffix = uuid.uuid4().hex[:8]
    user_id = f"TEST_ws_user_{suffix}"
    workshop_id = f"TEST_ws_{suffix}"
    token = f"TEST_token_ws_{suffix}"
    now = datetime.now(timezone.utc).isoformat()
    mongo.users.insert_one({
        "user_id": user_id, "email": f"TEST_workshop_{suffix}@example.com",
        "name": "Test Workshop User", "picture": "", "role": "workshop",
        "created_at": now,
    })
    mongo.workshops.insert_one({
        "workshop_id": workshop_id, "user_id": user_id,
        "company_name": "Acme Auto Repair", "contact_phone": "+8801712345678",
        "address": "Dhaka", "city": "Dhaka", "trade_license_no": "TL-AUTO-1",
        "kyc_status": "approved", "kyc_remark": "",
        "credit_limit": 50000.0, "credit_used": 0.0,
        "documents": [], "created_at": now,
    })
    mongo.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now,
    })
    yield {"user_id": user_id, "workshop_id": workshop_id, "token": token}
    # Cleanup
    mongo.users.delete_one({"user_id": user_id})
    mongo.workshops.delete_one({"workshop_id": workshop_id})
    mongo.user_sessions.delete_one({"session_token": token})
    mongo.orders.delete_many({"user_id": user_id})


@pytest.fixture(scope="session")
def workshop_pending_session(mongo):
    """Seed a workshop user whose KYC is NOT approved."""
    suffix = uuid.uuid4().hex[:8]
    user_id = f"TEST_wsp_user_{suffix}"
    workshop_id = f"TEST_wsp_{suffix}"
    token = f"TEST_token_wsp_{suffix}"
    now = datetime.now(timezone.utc).isoformat()
    mongo.users.insert_one({
        "user_id": user_id, "email": f"TEST_wsp_{suffix}@example.com",
        "name": "Pending Workshop", "picture": "", "role": "workshop",
        "created_at": now,
    })
    mongo.workshops.insert_one({
        "workshop_id": workshop_id, "user_id": user_id,
        "company_name": "", "contact_phone": "", "address": "", "city": "",
        "trade_license_no": "", "kyc_status": "not_submitted", "kyc_remark": "",
        "credit_limit": 0.0, "credit_used": 0.0, "documents": [], "created_at": now,
    })
    mongo.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now,
    })
    yield {"user_id": user_id, "workshop_id": workshop_id, "token": token}
    mongo.users.delete_one({"user_id": user_id})
    mongo.workshops.delete_one({"workshop_id": workshop_id})
    mongo.user_sessions.delete_one({"session_token": token})


@pytest.fixture(scope="session")
def admin_session(mongo):
    suffix = uuid.uuid4().hex[:8]
    user_id = f"TEST_admin_user_{suffix}"
    token = f"TEST_token_admin_{suffix}"
    now = datetime.now(timezone.utc).isoformat()
    mongo.users.insert_one({
        "user_id": user_id, "email": f"TEST_admin_{suffix}@example.com",
        "name": "Test Admin", "picture": "", "role": "admin", "created_at": now,
    })
    mongo.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now,
    })
    yield {"user_id": user_id, "token": token}
    mongo.users.delete_one({"user_id": user_id})
    mongo.user_sessions.delete_one({"session_token": token})


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture
def workshop_headers(workshop_session):
    return auth_headers(workshop_session["token"])


@pytest.fixture
def workshop_pending_headers(workshop_pending_session):
    return auth_headers(workshop_pending_session["token"])


@pytest.fixture
def admin_headers(admin_session):
    return auth_headers(admin_session["token"])
