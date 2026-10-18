"""Seed the database with demo users, colleges and reviews.

    python -m scripts.seed            # wipe users/colleges/reviews and insert demo data
    python -m scripts.seed --force    # required when ENVIRONMENT=production

Data is deterministic (fixed random seed) so screenshots and docs stay reproducible.
"""

import argparse
import asyncio
import random
import sys
from datetime import UTC, datetime, timedelta

from app.core.config import get_settings
from app.core.database import connect_db
from app.core.security import hash_password
from app.models import DOCUMENT_MODELS, College, Review, Role, User

DEMO_PASSWORD = "Password@123"
ADMIN = ("Aarav Admin", "admin@collegereview.dev", "Admin@123", Role.ADMIN)

USERS = [
    ("Priya Raman", "priya.teacher@collegereview.dev", Role.TEACHER),
    ("Karthik Subramanian", "karthik.teacher@collegereview.dev", Role.TEACHER),
    ("Divya Krishnan", "divya@collegereview.dev", Role.STUDENT),
    ("Arjun Mehta", "arjun@collegereview.dev", Role.STUDENT),
    ("Sneha Iyer", "sneha@collegereview.dev", Role.STUDENT),
    ("Rahul Verma", "rahul@collegereview.dev", Role.STUDENT),
    ("Ananya Reddy", "ananya@collegereview.dev", Role.STUDENT),
    ("Vikram Nair", "vikram@collegereview.dev", Role.STUDENT),
    ("Meera Pillai", "meera@collegereview.dev", Role.STUDENT),
    ("Rohan Das", "rohan@collegereview.dev", Role.STUDENT),
]

# fmt: off
# (name, city, state, established, website, quality 1-5, courses, description)
COLLEGES = [
    ("Indian Institute of Technology Madras", "Chennai", "Tamil Nadu", 1959,
     "https://www.iitm.ac.in", 4.7, ["B.Tech", "M.Tech", "MBA", "PhD"],
     "Institute of national importance known for engineering research and a lush forest campus."),
    ("Anna University", "Chennai", "Tamil Nadu", 1978,
     "https://www.annauniv.edu", 4.1, ["B.E.", "B.Tech", "M.E.", "MCA"],
     "State technical university with the historic College of Engineering, Guindy."),
    ("National Institute of Technology Tiruchirappalli", "Tiruchirappalli", "Tamil Nadu", 1964,
     "https://www.nitt.edu", 4.4, ["B.Tech", "M.Tech", "MBA", "MCA"],
     "Top-ranked NIT with strong placements and an active student club culture."),
    ("PSG College of Technology", "Coimbatore", "Tamil Nadu", 1951,
     "https://www.psgtech.edu", 4.2, ["B.E.", "B.Tech", "M.E.", "MBA"],
     "Autonomous college with deep industry ties in Coimbatore's manufacturing hub."),
    ("Vellore Institute of Technology", "Vellore", "Tamil Nadu", 1984,
     "https://vit.ac.in", 3.9, ["B.Tech", "M.Tech", "MBA", "B.Sc"],
     "Large private university with a flexible credit system and international tie-ups."),
    ("SRM Institute of Science and Technology", "Chennai", "Tamil Nadu", 1985,
     "https://www.srmist.edu.in", 3.5, ["B.Tech", "MBBS", "MBA", "B.Sc"],
     "Multi-disciplinary private university with a large campus at Kattankulathur."),
    ("Loyola College", "Chennai", "Tamil Nadu", 1925,
     "https://www.loyolacollege.edu", 4.3, ["B.A.", "B.Com", "B.Sc", "M.A."],
     "Jesuit arts and science college known for commerce, economics and visual communication."),
    ("Indian Institute of Technology Bombay", "Mumbai", "Maharashtra", 1958,
     "https://www.iitb.ac.in", 4.8, ["B.Tech", "M.Tech", "MBA", "PhD"],
     "Leading engineering institute in Powai with a thriving startup ecosystem."),
    ("Birla Institute of Technology and Science", "Pilani", "Rajasthan", 1964,
     "https://www.bits-pilani.ac.in", 4.5, ["B.E.", "M.E.", "M.Sc", "PhD"],
     "Deemed university famous for its no-reservation admissions and practice school programme."),
    ("Christ University", "Bengaluru", "Karnataka", 1969,
     "https://christuniversity.in", 3.8, ["BBA", "B.Com", "B.A.", "MBA"],
     "Private university in Bengaluru with strict attendance and strong management programmes."),
    ("Manipal Institute of Technology", "Manipal", "Karnataka", 1957,
     "https://manipal.edu/mit.html", 4.0, ["B.Tech", "M.Tech", "MCA"],
     "Constituent institute of MAHE with a vibrant multicultural student town."),
    ("Delhi Technological University", "New Delhi", "Delhi", 1941,
     "https://dtu.ac.in", 4.1, ["B.Tech", "M.Tech", "MBA"],
     "Formerly Delhi College of Engineering, a state university with strong coding culture."),
]

PHRASES = {
    5: [
        ("Outstanding faculty and research", "Professors are world-class and always open to undergraduate research. Labs are fully equipped."),
        ("Best decision of my life", "Placements were excellent and the alumni network opened many doors for me."),
        ("World-class campus", "Hostels are comfortable, the library is open late and the campus is green and safe."),
    ],
    4: [
        ("Great placements, decent hostels", "Most of my batch got placed in good companies. Hostel food could be better."),
        ("Strong academics", "Curriculum is rigorous and up to date. Some labs need newer equipment."),
        ("Good overall experience", "Supportive faculty and active clubs. Administration can be slow at times."),
    ],
    3: [
        ("Average but improving", "Teaching quality varies a lot between departments. Infrastructure is improving."),
        ("Okay for the fees", "Decent placements for CSE, fewer opportunities for core branches."),
        ("Mixed feelings", "Good friends and events, but the attendance policy is very strict."),
    ],
    2: [
        ("Needs better management", "Frequent schedule changes and poor communication from the administration."),
        ("Overcrowded classes", "Too many students per section so faculty attention is limited."),
    ],
    1: [
        ("Disappointing", "Facilities did not match the brochure and the placement cell was unhelpful."),
    ],
}
# fmt: on


def pick_rating(rng: random.Random, quality: float) -> int:
    return max(1, min(5, round(rng.gauss(quality, 0.8))))


async def seed(force: bool) -> None:
    settings = get_settings()
    if settings.environment == "production" and not force:
        sys.exit("Refusing to wipe a production database. Re-run with --force if you are sure.")

    client = await connect_db(settings)
    try:
        for model in DOCUMENT_MODELS:
            await model.get_pymongo_collection().delete_many({})

        rng = random.Random(42)
        now = datetime.now(UTC)

        admin_name, admin_email, admin_password, _ = ADMIN
        admin = User(
            name=admin_name,
            email=admin_email,
            password_hash=await hash_password(admin_password),
            role=Role.ADMIN,
        )
        demo_hash = await hash_password(DEMO_PASSWORD)
        users = [admin] + [
            User(name=name, email=email, password_hash=demo_hash, role=role)
            for name, email, role in USERS
        ]
        await User.insert_many(users)
        users = await User.find_all().to_list()
        admin = next(u for u in users if u.role == Role.ADMIN)
        reviewers = [u for u in users if u.role != Role.ADMIN]

        colleges = [
            College(
                name=name,
                city=city,
                state=state,
                established_year=year,
                website=website,
                courses=courses,
                description=description,
                created_by=admin.id,
                created_at=now - timedelta(days=90 - i),
                updated_at=now - timedelta(days=90 - i),
            )
            for i, (name, city, state, year, website, _, courses, description) in enumerate(
                COLLEGES
            )
        ]
        await College.insert_many(colleges)
        colleges = await College.find_all().sort("+created_at").to_list()
        quality = {name: q for name, _, _, _, _, q, _, _ in COLLEGES}

        reviews: list[Review] = []
        for college in colleges:
            # Leave the newest college unreviewed to show the "no ratings yet" state.
            if college.name == COLLEGES[-1][0]:
                continue
            for author in rng.sample(reviewers, k=rng.randint(3, len(reviewers))):
                rating = pick_rating(rng, quality[college.name])
                title, comment = rng.choice(PHRASES[rating])
                written = now - timedelta(days=rng.randint(0, 80), minutes=rng.randint(0, 1440))
                reviews.append(
                    Review(
                        college_id=college.id,
                        author_id=author.id,
                        rating=rating,
                        title=title,
                        comment=comment,
                        created_at=written,
                        updated_at=written,
                    )
                )
        await Review.insert_many(reviews)

        print(f"Seeded database '{settings.mongodb_db}':")
        print(f"  {len(users)} users, {len(colleges)} colleges, {len(reviews)} reviews\n")
        print("  Role     Email                                Password")
        print(f"  admin    {admin_email:<36} {admin_password}")
        for _, email, role in USERS[:3]:
            print(f"  {role.value:<8} {email:<36} {DEMO_PASSWORD}")
        print(f"  (all other seeded users also use {DEMO_PASSWORD})")
    finally:
        await client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="allow seeding in production")
    asyncio.run(seed(parser.parse_args().force))


if __name__ == "__main__":
    main()
