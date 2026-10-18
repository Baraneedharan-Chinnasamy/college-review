import pytest
from beanie import PydanticObjectId

from app.models import Role, User
from tests.conftest import API

USERS = f"{API}/users"


async def test_admin_lists_users_with_filters(client, admin, teacher, student):
    res = await client.get(USERS, headers=admin[1])
    assert res.status_code == 200
    assert res.json()["meta"]["total"] == 3
    assert all("password_hash" not in u for u in res.json()["data"])

    teachers = await client.get(USERS, params={"role": "teacher"}, headers=admin[1])
    assert [u["name"] for u in teachers.json()["data"]] == ["Tara Teacher"]

    search = await client.get(USERS, params={"search": "sam"}, headers=admin[1])
    assert [u["name"] for u in search.json()["data"]] == ["Sam Student"]


@pytest.mark.parametrize("role", [Role.TEACHER, Role.STUDENT])
async def test_non_admin_cannot_manage_users(client, make_user, role, student):
    _, headers = await make_user(role)
    assert (await client.get(USERS, headers=headers)).status_code == 403
    res = await client.patch(f"{USERS}/{student[0].id}", json={"role": "admin"}, headers=headers)
    assert res.status_code == 403
    assert (await User.get(student[0].id)).role == Role.STUDENT


async def test_admin_gets_user(client, admin, student):
    res = await client.get(f"{USERS}/{student[0].id}", headers=admin[1])
    assert res.status_code == 200
    assert res.json()["email"] == student[0].email
    assert (await client.get(f"{USERS}/{PydanticObjectId()}", headers=admin[1])).status_code == 404


async def test_promotion_takes_effect_immediately(client, admin, student):
    """Roles are re-read from the DB on every request, so an existing token gains new rights."""
    user, headers = student
    college = {"name": "Promoted College", "city": "Madurai", "state": "Tamil Nadu"}
    assert (await client.post(f"{API}/colleges", json=college, headers=headers)).status_code == 403

    res = await client.patch(f"{USERS}/{user.id}", json={"role": "teacher"}, headers=admin[1])
    assert res.status_code == 200
    assert res.json()["role"] == "teacher"

    assert (await client.post(f"{API}/colleges", json=college, headers=headers)).status_code == 201


async def test_deactivated_user_is_locked_out(client, admin, student):
    user, headers = student
    res = await client.patch(f"{USERS}/{user.id}", json={"is_active": False}, headers=admin[1])
    assert res.json()["is_active"] is False

    me = await client.get(f"{API}/auth/me", headers=headers)
    assert me.status_code == 403
    assert me.json()["error"]["message"] == "This account has been deactivated"


@pytest.mark.parametrize("payload", [{"role": "student"}, {"is_active": False}])
async def test_admin_cannot_lock_themselves_out(client, admin, payload):
    user, headers = admin
    res = await client.patch(f"{USERS}/{user.id}", json=payload, headers=headers)
    assert res.status_code == 400
    assert (await User.get(user.id)).role == Role.ADMIN


@pytest.mark.parametrize("payload", [{}, {"role": "owner"}, {"email": "x@example.com"}])
async def test_update_user_validation(client, admin, student, payload):
    res = await client.patch(f"{USERS}/{student[0].id}", json=payload, headers=admin[1])
    assert res.status_code == 422


async def test_users_pagination(client, admin, make_user):
    for _ in range(4):
        await make_user()
    res = await client.get(USERS, params={"limit": 2, "page": 3}, headers=admin[1])
    assert len(res.json()["data"]) == 1
    assert res.json()["meta"]["total"] == 5
