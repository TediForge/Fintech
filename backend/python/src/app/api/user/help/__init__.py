"""Help and support API routes."""

from fastapi import APIRouter

from app.api.user.help.articles import router as articles_router
from app.api.user.help.faq import router as faq_router
from app.api.user.help.findus import router as findus_router
from app.api.user.help.socials import router as socials_router

router = APIRouter()
router.include_router(articles_router, prefix="/articles", tags=["help-articles"])
router.include_router(faq_router, prefix="/faqs", tags=["help-faqs"])
router.include_router(socials_router, prefix="/socials", tags=["help-socials"])
router.include_router(findus_router, prefix="/findus", tags=["help-findus"])

__all__ = ["router"]
