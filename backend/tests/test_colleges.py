import pytest
from beanie import PydanticObjectId

from app.models import College, Review, Role
from tests.conftest import API

COLLEGES = f"{API}/colleges"

NEW_COLLEGE = {
    "name": "National Institute of Technology, Tiruchirappalli",
    "city": "Tiruchirappalli",
    "state": "Tamil Nadu",
    "description": "Premier engineering institute.",
    "website": "https://www.nitt.edu",
    "established_year": 1964,
    "courses": ["B.Tech CSE", "B.Tech ECE", " B.Tech CSE ", ""],
}


@pytest.fixture
async def rated_colleges(make_college, make_user, make_review):
    """Three colleges: A rated 5,4 (avg 4.5), B rated 3 (avg 3.0), C unrated."""
    a = await make_college("Alpha University", city="Chennai", state="Tamil Nadu")
    b = await make_college("Beta Institute", city="Bengaluru", state="Karnataka")
    c = await make_college("Gamma College", city="Coimbatore", state="Tamil Nadu")
    u1, _ = await make_user()
    u2, _ = await make_user()
    await make_review(a, u1, rating=5)
    await make_review(a, u2, rating=4)
    await make_review(b, u1, rating=3)
    return a, b, c


# --- list + aggregation ---------------------------------------------------------------------


async def test_list_includes_average_rating_and_review_count(client, rated_colleges):
    res = await client.get(COLLEGES)

    assert res.status_code == 200
    rows = {c["name"]: (c["average_rating"], c["review_count"]) for c in res.json()["data"]}
    assert rows == {
        "Alpha University": (4.5, 2),
        "Beta Institute": (3.0, 1),
        "Gamma College": (None, 0),
    }
    assert res.json()["meta"]["total"] == 3


async def test_average_rating_is_rounded(client, college, make_user, make_review):
    for rating in (5, 4, 4):
        await make_review(college, (await make_user())[0], rating=rating)
    res = await client.get(COLLEGES)
    assert res.json()["data"][0]["average_rating"] == 4.33


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("name", ["Alpha University", "Beta Institute", "Gamma College"]),
        ("-name", ["Gamma College", "Beta Institute", "Alpha University"]),
        ("-rating", ["Alpha University", "Beta Institute", "Gamma College"]),
        ("rating", ["Gamma College", "Beta Institute", "Alpha University"]),
        ("-reviews", ["Alpha University", "Beta Institute", "Gamma College"]),
        ("reviews", ["Gamma College", "Beta Institute", "Alpha University"]),
        ("newest", ["Gamma College", "Beta Institute", "Alpha University"]),
        ("oldest", ["Alpha University", "Beta Institute", "Gamma College"]),
    ],
)
async def test_list_sorting(client, rated_colleges, sort, expected):
    res = await client.get(COLLEGES, params={"sort": sort})
    assert [c["name"] for c in res.json()["data"]] == expected


async def test_list_min_rating_filter(client, rated_colleges):
    res = await client.get(COLLEGES, params={"min_rating": 4})
    assert [c["name"] for c in res.json()["data"]] == ["Alpha University"]
    assert res.json()["meta"]["total"] == 1


async def test_list_search_and_location_filters(client, rated_colleges):
    async def names(**params):
        res = await client.get(COLLEGES, params=params)
        assert res.status_code == 200
        return [c["name"] for c in res.json()["data"]]

    assert await names(search="beta") == ["Beta Institute"]
    assert await names(search="karnat") == ["Beta Institute"]  # matches state
    assert await names(search="(") == []  # regex metacharacters are escaped
    assert await names(state="tamil nadu") == ["Alpha University", "Gamma College"]
    assert await names(city="CHENNAI") == ["Alpha University"]


async def test_list_pagination_with_rating_sort(client, rated_colleges):
    res = await client.get(COLLEGES, params={"sort": "-rating", "page": 2, "limit": 2})
    body = res.json()
    assert [c["name"] for c in body["data"]] == ["Gamma College"]
    assert body["meta"]["total"] == 3
    assert body["meta"]["total_pages"] == 2


async def test_list_empty(client, db):
    res = await client.get(COLLEGES)
    assert res.json() == {
        "data": [],
        "meta": {
            "page": 1,
            "limit": 10,
            "total": 0,
            "total_pages": 0,
            "has_next": False,
            "has_prev": False,
        },
    }


@pytest.mark.parametrize("params", [{"sort": "best"}, {"min_rating": 6}, {"limit": 0}])
async def test_list_invalid_query(client, db, params):
    res = await client.get(COLLEGES, params=params)
    assert res.status_code == 422
    assert res.json()["error"]["details"][0]["location"] == "query"


# --- detail ---------------------------------------------------------------------------------


async def test_get_college_with_rating_distribution(client, rated_colleges):
    alpha, _, gamma = rated_colleges

    body = (await client.get(f"{COLLEGES}/{alpha.id}")).json()
    assert body["average_rating"] == 4.5
    assert body["review_count"] == 2
    assert body["rating_distribution"] == {"1": 0, "2": 0, "3": 0, "4": 1, "5": 1}

    empty = (await client.get(f"{COLLEGES}/{gamma.id}")).json()
    assert empty["average_rating"] is None
    assert empty["rating_distribution"] == {str(i): 0 for i in range(1, 6)}


async def test_get_college_not_found(client, db):
    assert (await client.get(f"{COLLEGES}/{PydanticObjectId()}")).status_code == 404
    assert (await client.get(f"{COLLEGES}/not-an-id")).status_code == 422


# --- create ---------------------------------------------------------------------------------


@pytest.mark.parametrize("role", [Role.TEACHER, Role.ADMIN])
async def test_staff_can_create_college(client, make_user, role):
    user, headers = await make_user(role)

    res = await client.post(COLLEGES, json=NEW_COLLEGE, headers=headers)

    assert res.status_code == 201
    body = res.json()
    assert body["name"] == NEW_COLLEGE["name"]
    assert body["country"] == "India"
    assert body["courses"] == ["B.Tech CSE", "B.Tech ECE"]  # trimmed + de-duplicated
    assert body["website"].startswith("https://www.nitt.edu")
    assert body["average_rating"] is None
    assert body["review_count"] == 0
    stored = await College.get(body["id"])
    assert stored.created_by == user.id


async def test_student_cannot_create_college(client, student):
    res = await client.post(COLLEGES, json=NEW_COLLEGE, headers=student[1])
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


async def test_anonymous_cannot_create_college(client, db):
    assert (await client.post(COLLEGES, json=NEW_COLLEGE)).status_code == 401


async def test_duplicate_college_name_is_case_insensitive(client, teacher):
    await client.post(COLLEGES, json=NEW_COLLEGE, headers=teacher[1])
    res = await client.post(
        COLLEGES, json=NEW_COLLEGE | {"name": NEW_COLLEGE["name"].upper()}, headers=teacher[1]
    )
    assert res.status_code == 409


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": ""},
        {"website": "not a url"},
        {"established_year": 3000},
        {"established_year": 1500},
        {"courses": "B.Tech"},
        {"rating": 5},
    ],
)
async def test_create_college_validation(client, teacher, overrides):
    res = await client.post(COLLEGES, json=NEW_COLLEGE | overrides, headers=teacher[1])
    assert res.status_code == 422


async def test_create_college_missing_required_fields(client, teacher):
    res = await client.post(COLLEGES, json={"name": "Only a name"}, headers=teacher[1])
    assert res.status_code == 422
    fields = {d["field"] for d in res.json()["error"]["details"]}
    assert {"city", "state"} <= fields


# --- update ---------------------------------------------------------------------------------


async def test_teacher_updates_college(client, teacher, college):
    res = await client.patch(
        f"{COLLEGES}/{college.id}",
        json={"description": "Updated description", "courses": ["MBA"]},
        headers=teacher[1],
    )
    assert res.status_code == 200
    body = res.json()
    assert body["description"] == "Updated description"
    assert body["courses"] == ["MBA"]
    assert body["name"] == college.name


async def test_student_cannot_update_college(client, student, college):
    res = await client.patch(
        f"{COLLEGES}/{college.id}", json={"city": "Madurai"}, headers=student[1]
    )
    assert res.status_code == 403


@pytest.mark.parametrize("payload", [{}, {"name": None}, {"unknown": "x"}])
async def test_update_college_validation(client, teacher, college, payload):
    res = await client.patch(f"{COLLEGES}/{college.id}", json=payload, headers=teacher[1])
    assert res.status_code == 422


async def test_update_college_rename_conflict(client, teacher, make_college):
    await make_college("Existing College")
    other = await make_college("Other College")
    res = await client.patch(
        f"{COLLEGES}/{other.id}", json={"name": "existing college"}, headers=teacher[1]
    )
    assert res.status_code == 409


async def test_update_missing_college(client, admin):
    res = await client.patch(
        f"{COLLEGES}/{PydanticObjectId()}", json={"city": "Madurai"}, headers=admin[1]
    )
    assert res.status_code == 404


# --- delete ---------------------------------------------------------------------------------


async def test_admin_deletes_college_and_its_reviews(client, admin, rated_colleges):
    alpha, beta, _ = rated_colleges

    res = await client.delete(f"{COLLEGES}/{alpha.id}", headers=admin[1])

    assert res.status_code == 204
    assert await College.get(alpha.id) is None
    assert await Review.find(Review.college_id == alpha.id).count() == 0
    assert await Review.find(Review.college_id == beta.id).count() == 1  # untouched


@pytest.mark.parametrize("role", [Role.TEACHER, Role.STUDENT])
async def test_non_admin_cannot_delete_college(client, make_user, college, role):
    _, headers = await make_user(role)
    res = await client.delete(f"{COLLEGES}/{college.id}", headers=headers)
    assert res.status_code == 403
    assert await College.get(college.id) is not None


async def test_delete_missing_college(client, admin):
    res = await client.delete(f"{COLLEGES}/{PydanticObjectId()}", headers=admin[1])
    assert res.status_code == 404
