from fastapi import APIRouter, Depends
from models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/api/skill-tree", tags=["skill-tree"])

@router.get("/asl")
async def get_asl_tree(current_user: User = Depends(get_current_user)):
    # Stubbed data for UI
    return {
        "nodes": [
            {"id": "basics_1", "label": "ABC", "signs": ["A", "B", "C"], "unlocked": True, "completed": current_user.level > 1, "x": 50, "y": 10},
            {"id": "basics_2", "label": "DEF", "signs": ["D", "E", "F"], "unlocked": True, "completed": False, "x": 30, "y": 30},
            {"id": "basics_3", "label": "GHI", "signs": ["G", "H", "I"], "unlocked": True, "completed": False, "x": 70, "y": 30},
            {"id": "basics_4", "label": "KLM", "signs": ["K", "L", "M"], "unlocked": True, "completed": False, "x": 50, "y": 50},
            {"id": "basics_5", "label": "NOP", "signs": ["N", "O", "P"], "unlocked": True, "completed": False, "x": 30, "y": 70},
            {"id": "basics_6", "label": "QRS", "signs": ["Q", "R", "S"], "unlocked": True, "completed": False, "x": 70, "y": 70},
            {"id": "basics_7", "label": "TUV", "signs": ["T", "U", "V"], "unlocked": True, "completed": False, "x": 50, "y": 90},
            {"id": "basics_8", "label": "WXY", "signs": ["W", "X", "Y"], "unlocked": True, "completed": False, "x": 50, "y": 110},
            {"id": "greetings", "label": "Greetings", "signs": ["hello", "goodbye", "fine", "thanksgiving"], "unlocked": True, "completed": False, "x": 50, "y": 130},
            {"id": "food", "label": "Food", "signs": ["drink", "apple", "pizza", "eat", "candy"], "unlocked": True, "completed": False, "x": 30, "y": 150},
            {"id": "actions", "label": "Actions", "signs": ["go", "walk", "read", "write", "play"], "unlocked": True, "completed": False, "x": 70, "y": 150},
            {"id": "colors", "label": "Colors", "signs": ["red", "blue", "yellow", "white", "black"], "unlocked": True, "completed": False, "x": 50, "y": 170},
        ],
        "edges": [
            {"from": "basics_1", "to": "basics_2"},
            {"from": "basics_1", "to": "basics_3"},
            {"from": "basics_2", "to": "basics_4"},
            {"from": "basics_3", "to": "basics_4"},
            {"from": "basics_4", "to": "basics_5"},
            {"from": "basics_4", "to": "basics_6"},
            {"from": "basics_5", "to": "basics_7"},
            {"from": "basics_6", "to": "basics_7"},
            {"from": "basics_7", "to": "basics_8"},
            {"from": "basics_8", "to": "greetings"},
            {"from": "greetings", "to": "food"},
            {"from": "greetings", "to": "actions"},
            {"from": "food", "to": "colors"},
            {"from": "actions", "to": "colors"}
        ]
    }
