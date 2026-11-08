"""Application entry point for the TediForge Fintech API."""

from fastapi import FastAPI

from app.api.user.beneficiaries.routes import router as beneficiaries_router
from app.api.user.campaigns.routes import router as campaigns_router
from app.api.user.compliance.routes import router as compliance_router
from app.api.user.devices.routes import router as devices_router
from app.api.user.feedback.routes import router as feedback_router
from app.api.user.help import router as help_router
from app.api.user.help.chat import router as chat_router
from app.api.user.help.chat.routes import chat_websocket_endpoint
from app.api.user.kyc.routes import router as kyc_router
from app.api.user.notifications.routes import router as notifications_router
from app.api.user.profile.routes import router as profile_router
from app.api.user.referrals.routes import router as referrals_router
from app.api.user.rewards.routes import router as rewards_router
from app.api.user.settings.routes import router as settings_router
from app.api.user.subscription.notification.routes import (
    router as subscription_notification_router,
)
from app.api.user.tiers.routes import router as tiers_router
from app.api.user.verify.ng.address.routes import router as ng_address_verify_router
from app.api.user.verify.ng.business.routes import router as ng_business_verify_router
from app.api.user.verify.ng.bvn.routes import router as ng_bvn_verify_router
from app.api.user.verify.ng.income.routes import router as ng_income_verify_router
from app.api.user.verify.ng.nin.routes import router as ng_nin_verify_router
from app.api.user.wallets.routes import router as wallets_router
from app.api.v1.router import router as v1_router
from app.middleware import AuthenticationMiddleware, MaintenanceMiddleware

app = FastAPI(title="TediForge Fintech API")

# Middleware executes in reverse registration order on requests.
app.add_middleware(MaintenanceMiddleware)
app.add_middleware(AuthenticationMiddleware)

app.include_router(v1_router, prefix="/v1")
app.include_router(profile_router, prefix="/user", tags=["profile"])
app.include_router(feedback_router, prefix="/user/feedback", tags=["feedback"])
app.include_router(tiers_router, prefix="/user/tiers", tags=["tiers"])
app.include_router(settings_router, prefix="/user/settings", tags=["settings"])
app.include_router(kyc_router, prefix="/user/kyc", tags=["kyc"])
app.include_router(ng_nin_verify_router)
app.include_router(ng_bvn_verify_router)
app.include_router(ng_address_verify_router)
app.include_router(ng_business_verify_router)
app.include_router(ng_income_verify_router)
app.include_router(
    compliance_router, prefix="/user/compliance", tags=["compliance"]
)
app.include_router(
    campaigns_router, prefix="/user/campaigns", tags=["campaigns"]
)
app.include_router(
    notifications_router, prefix="/user/notifications", tags=["notifications"]
)
app.include_router(devices_router, prefix="/user/devices", tags=["devices"])
app.include_router(
    subscription_notification_router,
    prefix="/user/subscription/notification",
    tags=["subscription-notifications"],
)
app.include_router(wallets_router, prefix="/user/wallets", tags=["wallets"])
app.include_router(
    beneficiaries_router, prefix="/user/beneficiaries", tags=["beneficiaries"]
)
app.include_router(
    referrals_router, prefix="/user/referrals", tags=["referrals"]
)
app.include_router(rewards_router, prefix="/user/rewards", tags=["rewards"])
app.include_router(help_router, prefix="/user/help", tags=["help"])
app.include_router(chat_router, prefix="/user/help/chat", tags=["support-chat"])
app.add_api_websocket_route(
    "/user/help/chat", chat_websocket_endpoint, name="support-chat-websocket"
)
