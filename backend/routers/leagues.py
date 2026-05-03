from fastapi import APIRouter, Depends
from models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/api/leagues", tags=["leagues"])

@router.get("/current")
async def get_current_league(current_user: User = Depends(get_current_user)):
    # Stubbed data
    return {
        "tier": "BRONZE",
        "rank": 12,
        "weekly_xp": 450,
        "promotion_zone": True,
        "top_users": [
            {"name": "Alice", "xp": 1200},
            {"name": "Bob", "xp": 1050},
            {"name": current_user.display_name, "xp": 450}
        ]
    }
