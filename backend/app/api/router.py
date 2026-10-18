from fastapi import APIRouter

from app.api.routes import auth, colleges, health, reviews, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(colleges.router)
api_router.include_router(reviews.router)
api_router.include_router(users.router)
