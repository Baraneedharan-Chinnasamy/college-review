from datetime import UTC, datetime

import pytest
from beanie import PydanticObjectId

from app.models import Review, Role
from tests.conftest import API

REVIEWS = f"{API}/reviews"


def _review(college, /, **overrides):
    return {
        "college_id": str(college),
        "rating": 5,
        "title": "Excellent faculty",
        "comment": "Professors are approachable and the labs are well equipped.",
    } | overrides


# --- create ---------------------------------------------------------------------------------


async def test_student_creates_review(client, student, college):
    user, headers = student

    res = await client.post(REVIEWS, json=_review(college.id), headers=headers)

    assert res.status_code == 201
    body = res.json()
    assert body["rating"] == 5
    assert body["title"] == "Excellent faculty"
    assert body["college_id"] == str(college.id)
    assert body["author"] == {"id": str(user.id), "name": "Sam Student", "role": "student"}
    assert body["college"] == {"id": str(college.id), "name": college.name}
    assert await Review.count() == 1


async def test_teacher_and_admin_can_also_review(client, teacher, admin, college):
    for _, headers in (teacher, admin):
        res = await client.post(REVIEWS, json=_review(college.id), headers=headers)
        assert res.status_code == 201


async def test_create_review_requires_auth(client, college):
    res = await client.post(REVIEWS, json=_review(college.id))
    assert res.status_code == 401


async def test_create_review_for_unknown_college(client, student):
    res = await client.post(REVIEWS, json=_review(PydanticObjectId()), headers=student[1])
    assert res.status_code == 404
    assert res.json()["error"]["message"] == "College not found"


async def test_one_review_per_college_per_user(client, student, college):
    _, headers = student
    assert (
        await client.post(REVIEWS, json=_review(college.id), headers=headers)
    ).status_code == 201

    res = await client.post(REVIEWS, json=_review(college.id, rating=1), headers=headers)

    assert res.status_code == 409
    assert "already reviewed" in res.json()["error"]["message"]


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"rating": 0}, "rating"),
        ({"rating": 6}, "rating"),
        ({"rating": "five"}, "rating"),
        ({"title": "ok"}, "title"),
        ({"comment": "too short"}, "comment"),
        ({"comment": "x" * 2001}, "comment"),
        ({"college_id": "not-an-object-id"}, "college_id"),
        ({"author_id": "5f1d7f0c2b1e4a3d9c8b7a6f"}, "author_id"),  # cannot spoof authorship
    ],
)
async def test_create_review_validation(client, student, college, overrides, field):
    res = await client.post(REVIEWS, json=_review(college.id, **overrides), headers=student[1])
    assert res.status_code == 422
    assert field in {detail["field"] for detail in res.json()["error"]["details"]}


async def test_whitespace_is_trimmed(client, student, college):
    res = await client.post(
        REVIEWS, json=_review(college.id, title="   Great   "), headers=student[1]
    )
    assert res.json()["title"] == "Great"


# --- read -----------------------------------------------------------------------------------


async def test_get_review_is_public(client, college, student, make_review):
    review = await make_review(college, student[0], rating=3)

    res = await client.get(f"{REVIEWS}/{review.id}")

    assert res.status_code == 200
    assert res.json()["id"] == str(review.id)
    assert res.json()["author"]["name"] == "Sam Student"


async def test_get_review_not_found_and_invalid_id(client, db):
    missing = await client.get(f"{REVIEWS}/{PydanticObjectId()}")
    invalid = await client.get(f"{REVIEWS}/123")
    assert missing.status_code == 404
    assert invalid.status_code == 422


async def test_list_reviews_paginates(client, college, make_user, make_review):
    for i in range(7):
        user, _ = await make_user(name=f"Student {i}")
        await make_review(college, user, rating=(i % 5) + 1)

    first = (await client.get(REVIEWS, params={"page": 1, "limit": 3})).json()
    last = (await client.get(REVIEWS, params={"page": 3, "limit": 3})).json()

    assert len(first["data"]) == 3
    assert first["meta"] == {
        "page": 1,
        "limit": 3,
        "total": 7,
        "total_pages": 3,
        "has_next": True,
        "has_prev": False,
    }
    assert len(last["data"]) == 1
    assert last["meta"]["has_next"] is False
    assert last["meta"]["has_prev"] is True
    # newest first by default
    first_dates = [r["created_at"] for r in first["data"]]
    assert first_dates == sorted(first_dates, reverse=True)


async def test_list_reviews_rejects_bad_pagination(client, db):
    assert (await client.get(REVIEWS, params={"page": 0})).status_code == 422
    assert (await client.get(REVIEWS, params={"limit": 101})).status_code == 422
    assert (await client.get(REVIEWS, params={"sort": "random"})).status_code == 422


async def test_list_reviews_filters(client, make_college, make_user, make_review):
    a = await make_college("Alpha College")
    b = await make_college("Beta College")
    u1, _ = await make_user()
    u2, _ = await make_user()
    await make_review(a, u1, rating=5)
    await make_review(a, u2, rating=2)
    await make_review(b, u1, rating=4)

    async def ids(**params):
        res = await client.get(REVIEWS, params=params)
        assert res.status_code == 200
        return sorted((r["college"]["name"], r["rating"]) for r in res.json()["data"])

    assert await ids(college_id=str(a.id)) == [("Alpha College", 2), ("Alpha College", 5)]
    assert await ids(author_id=str(u1.id)) == [("Alpha College", 5), ("Beta College", 4)]
    assert await ids(rating=2) == [("Alpha College", 2)]
    assert await ids(min_rating=4) == [("Alpha College", 5), ("Beta College", 4)]


async def test_list_reviews_sorted_by_rating(client, college, make_user, make_review):
    for rating in (3, 5, 1):
        await make_review(college, (await make_user())[0], rating=rating)

    desc = await client.get(REVIEWS, params={"sort": "-rating"})
    asc = await client.get(REVIEWS, params={"sort": "rating"})
    oldest = await client.get(REVIEWS, params={"sort": "oldest"})

    assert [r["rating"] for r in desc.json()["data"]] == [5, 3, 1]
    assert [r["rating"] for r in asc.json()["data"]] == [1, 3, 5]
    assert [r["rating"] for r in oldest.json()["data"]] == [3, 5, 1]


async def test_search_reviews_full_text(client, college, make_user, make_review):
    await make_review(
        college,
        (await make_user())[0],
        title="Amazing placements",
        comment="Top recruiters visit every year.",
    )
    await make_review(
        college,
        (await make_user())[0],
        title="Hostel food",
        comment="The hostel mess needs improvement; placements are fine.",
    )
    await make_review(
        college,
        (await make_user())[0],
        title="Sports facilities",
        comment="Great cricket ground and gym.",
    )

    res = await client.get(REVIEWS, params={"search": "placement"})  # stemmed match
    data = res.json()["data"]

    assert res.status_code == 200
    assert res.json()["meta"]["total"] == 2
    # title matches are weighted higher than comment matches
    assert data[0]["title"] == "Amazing placements"

    none = await client.get(REVIEWS, params={"search": "swimming"})
    assert none.json()["meta"]["total"] == 0

    # explicit sort still applies while searching
    newest = await client.get(REVIEWS, params={"search": "placement", "sort": "newest"})
    assert newest.json()["data"][0]["title"] == "Hostel food"


async def test_relevance_sort_without_search_falls_back_to_newest(
    client, college, make_user, make_review
):
    await make_review(college, (await make_user())[0], title="First one")
    await make_review(college, (await make_user())[0], title="Second one")
    res = await client.get(REVIEWS, params={"sort": "relevance"})
    assert [r["title"] for r in res.json()["data"]] == ["Second one", "First one"]


async def test_college_reviews_endpoint(client, make_college, student, make_review):
    a = await make_college("Alpha College")
    b = await make_college("Beta College")
    await make_review(a, student[0], rating=5)
    await make_review(b, student[0], rating=1)

    res = await client.get(f"{API}/colleges/{a.id}/reviews", params={"min_rating": 4})
    assert res.status_code == 200
    assert [r["college"]["name"] for r in res.json()["data"]] == ["Alpha College"]

    missing = await client.get(f"{API}/colleges/{PydanticObjectId()}/reviews")
    assert missing.status_code == 404


# --- update ---------------------------------------------------------------------------------


async def test_author_updates_own_review(client, student, college, make_review):
    user, headers = student
    written = datetime(2024, 1, 1, tzinfo=UTC)
    review = await make_review(college, user, rating=2, created_at=written, updated_at=written)

    res = await client.patch(
        f"{REVIEWS}/{review.id}",
        json={"rating": 4, "title": "Changed my mind"},
        headers=headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["rating"] == 4
    assert body["title"] == "Changed my mind"
    assert body["comment"] == review.comment  # untouched
    assert body["updated_at"] > body["created_at"]


@pytest.mark.parametrize("role", [Role.STUDENT, Role.TEACHER, Role.ADMIN])
async def test_cannot_update_someone_elses_review(
    client, student, college, make_review, make_user, role
):
    review = await make_review(college, student[0])
    _, other_headers = await make_user(role)

    res = await client.patch(f"{REVIEWS}/{review.id}", json={"rating": 1}, headers=other_headers)

    assert res.status_code == 403
    assert (await Review.get(review.id)).rating == review.rating


@pytest.mark.parametrize(
    "payload", [{}, {"rating": None}, {"rating": 9}, {"college_id": "5f1d7f0c2b1e4a3d9c8b7a6f"}]
)
async def test_update_review_validation(client, student, college, make_review, payload):
    review = await make_review(college, student[0])
    res = await client.patch(f"{REVIEWS}/{review.id}", json=payload, headers=student[1])
    assert res.status_code == 422


async def test_update_missing_review(client, student):
    res = await client.patch(
        f"{REVIEWS}/{PydanticObjectId()}", json={"rating": 3}, headers=student[1]
    )
    assert res.status_code == 404


async def test_update_requires_auth(client, student, college, make_review):
    review = await make_review(college, student[0])
    res = await client.patch(f"{REVIEWS}/{review.id}", json={"rating": 3})
    assert res.status_code == 401


# --- delete ---------------------------------------------------------------------------------


async def test_author_deletes_own_review(client, student, college, make_review):
    review = await make_review(college, student[0])

    res = await client.delete(f"{REVIEWS}/{review.id}", headers=student[1])

    assert res.status_code == 204
    assert res.content == b""
    assert (await client.get(f"{REVIEWS}/{review.id}")).status_code == 404


async def test_other_student_and_teacher_cannot_delete(
    client, student, teacher, make_user, college, make_review
):
    review = await make_review(college, student[0])
    _, other_student = await make_user(Role.STUDENT)

    for headers in (other_student, teacher[1]):
        res = await client.delete(f"{REVIEWS}/{review.id}", headers=headers)
        assert res.status_code == 403
    assert await Review.get(review.id) is not None


async def test_admin_can_delete_any_review(client, student, admin, college, make_review):
    review = await make_review(college, student[0])
    res = await client.delete(f"{REVIEWS}/{review.id}", headers=admin[1])
    assert res.status_code == 204
    assert await Review.get(review.id) is None


async def test_delete_missing_review(client, admin):
    res = await client.delete(f"{REVIEWS}/{PydanticObjectId()}", headers=admin[1])
    assert res.status_code == 404


async def test_review_lifecycle_updates_college_rating(client, student, teacher, college):
    """End-to-end: create -> aggregate -> update -> aggregate -> delete -> aggregate."""

    async def stats():
        body = (await client.get(f"{API}/colleges/{college.id}")).json()
        return body["average_rating"], body["review_count"]

    assert await stats() == (None, 0)

    r1 = (await client.post(REVIEWS, json=_review(college.id, rating=5), headers=student[1])).json()
    await client.post(REVIEWS, json=_review(college.id, rating=2), headers=teacher[1])
    assert await stats() == (3.5, 2)

    await client.patch(f"{REVIEWS}/{r1['id']}", json={"rating": 3}, headers=student[1])
    assert await stats() == (2.5, 2)

    await client.delete(f"{REVIEWS}/{r1['id']}", headers=student[1])
    assert await stats() == (2.0, 1)
