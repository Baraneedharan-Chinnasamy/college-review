from app.models.college import College
from app.models.review import Review
from app.models.user import Role, User

DOCUMENT_MODELS = [User, College, Review]

__all__ = ["DOCUMENT_MODELS", "College", "Review", "Role", "User"]
