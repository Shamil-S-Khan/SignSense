
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from database import async_session, engine, Base
from models.skill_tree import SkillNode
from models.lesson import Lesson

async def seed_wlasl():
    async with engine.begin() as conn:
        # Ensure tables exist
        # await conn.run_sync(Base.metadata.create_all)
        pass

    async with async_session() as session:
        # 1. Create a Dynamic Signs Node
        dynamic_node = SkillNode(
            id="dynamic_basics",
            name="Dynamic Signs I",
            description="Learn words involving movement: Hello, Drink, Computer.",
            category="Vocabulary",
            level=2,
            pos_x=200,
            pos_y=0,
            required_node_id="alphabet_basics" # Assuming this exists
        )
        session.add(dynamic_node)

        # 2. Add Greetings Lesson
        greetings = Lesson(
            id="greetings_1",
            node_id="dynamic_basics",
            title="Essential Greetings",
            description="Master common greetings and basic needs.",
            signs=["hello", "goodbye", "drink", "computer"],
            order=1
        )
        session.add(greetings)

        # 3. Add Activity Lesson
        activity = Lesson(
            id="activity_1",
            node_id="dynamic_basics",
            title="Daily Activities",
            description="Signs for things you do every day.",
            signs=["go", "walk", "read", "write", "play"],
            order=2
        )
        session.add(activity)

        try:
            await session.commit()
            print("Successfully seeded dynamic signs into the database!")
        except Exception as e:
            await session.rollback()
            print(f"Seeding failed (possibly already exists): {e}")

if __name__ == "__main__":
    asyncio.run(seed_wlasl())
