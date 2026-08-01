import os
from sqlalchemy.orm import Session
from .database import engine, Base, SessionLocal
from .models import User, Note
from .ranking_dataset import RANKING_DATASET
from .ai_sample_notes import AI_SAMPLE_NOTES

SEED_USERS = [
    {"id": 1, "name": "Alice", "email": "alice@example.com", "password": "alicepass123"},
    {"id": 2, "name": "Bob", "email": "bob@example.com", "password": "bobpass123"},
]

SEED_NOTES = [
    {"id": 1, "owner_id": 1, "title": "Standup Summary", "tag": "work",
     "content": "Discussed sprint progress, blockers on the payments API integration, and the plan for the demo on Friday."},
    {"id": 2, "owner_id": 1, "title": "Sprint Retro Notes", "tag": "work",
     "content": "Retro highlighted communication gaps between frontend and backend teams and agreed on daily syncs going forward."},
    {"id": 3, "owner_id": 2, "title": "One on One", "tag": "work",
     "content": "Quick check-in, no blockers, discussed career growth goals for next quarter."},
    {"id": 4, "owner_id": 1, "title": "Morning Run", "tag": "health",
     "content": "Ran 5km along the river trail before breakfast, felt great."},
    {"id": 5, "owner_id": 2, "title": "Doctor Visit", "tag": "health",
     "content": "Annual checkup went well, blood pressure normal, scheduled next visit in six months."},
    {"id": 6, "owner_id": 1, "title": "Pasta Recipe", "tag": "recipes",
     "content": "Boil pasta, saute garlic in olive oil, add tomatoes, basil, and a pinch of chili flakes."},
    {"id": 7, "owner_id": 2, "title": "Smoothie Recipe", "tag": "recipes",
     "content": "Blend banana, spinach, almond milk, and a spoon of peanut butter for breakfast."},
    {"id": 8, "owner_id": 1, "title": "Flight Booking", "tag": "travel",
     "content": "Booked a round trip flight for the December vacation, window seat confirmed."},
    {"id": 9, "owner_id": 2, "title": "Random Thought", "tag": "random",
     "content": "Maybe the library needs a better recommendation system based on reading history."},
    {"id": 10, "owner_id": 1, "title": "Quote To Remember", "tag": "random",
     "content": "Done is better than perfect, keep shipping."},
]


def seed():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for user_data in SEED_USERS:
            existing = db.query(User).filter_by(email=user_data["email"]).first()
            if not existing:
                user = User(id=user_data["id"], name=user_data["name"], email=user_data["email"], password=user_data["password"])
                db.add(user)
        db.commit()

        for note_data in SEED_NOTES:
            existing = db.query(Note).filter_by(title=note_data["title"], owner_id=note_data["owner_id"]).first()
            if not existing:
                note = Note(owner_id=note_data["owner_id"], title=note_data["title"], content=note_data["content"], tag=note_data["tag"])
                db.add(note)
        db.commit()

        for demo in RANKING_DATASET:
            existing = db.query(Note).filter_by(title=demo["title"], owner_id=1).first()
            if not existing:
                note = Note(owner_id=1, title=demo["title"], content=demo["content"], tag="kb-demo")
                db.add(note)
        db.commit()

        for sample in AI_SAMPLE_NOTES:
            existing = db.query(Note).filter_by(title=sample["title"], owner_id=2).first()
            if not existing:
                note = Note(owner_id=2, title=sample["title"], content=sample["content"], tag="ai-demo")
                db.add(note)
        db.commit()

    print("Seed data loaded successfully.")


if __name__ == "__main__":
    seed()
RANKING_DATASET = [
    {"id": 1, "title": "Apple Harvest Notes", "content": "The apple orchard yielded a strong apple harvest this season with apple crates ready."},
    {"id": 2, "title": "Budget Draft", "content": "Quarterly budget review shows spending under control across all departments."},
    {"id": 3, "title": "Coffee Tasting", "content": "Sampled three coffee blends today, the dark roast coffee stood out the most."},
    {"id": 4, "title": "Daily Standup", "content": "Team standup covered blockers, progress, and the plan for tomorrow."},
    {"id": 5, "title": "Evening Walk", "content": "Took a long evening walk around the park to clear my head."},
    {"id": 6, "title": "Fruit Basket Plan", "content": "Planning a fruit basket with apple, banana, and orange slices for the event."},
    {"id": 7, "title": "Garden Update", "content": "The garden apple tree is finally blooming after the apple tree pruning last month."},
    {"id": 8, "title": "History Reading", "content": "Continued reading the history book about ancient trade routes."},
    {"id": 9, "title": "Invoice Follow-up", "content": "Sent a follow-up email regarding the pending invoice payment."},
    {"id": 10, "title": "Journal Entry", "content": "Reflected on the week's progress and set goals for next week."},
    {"id": 11, "title": "Kitchen Inventory", "content": "Checked the kitchen inventory; running low on coffee and sugar."},
    {"id": 12, "title": "Language Practice", "content": "Practiced twenty new vocabulary words during today's language session."},
]

AI_SAMPLE_NOTES = [
    {"id": 1, "title": "Morning workout plan", "content": "Do 30 minutes of cardio followed by strength training focused on legs and core."},
    {"id": 2, "title": "Grocery list", "content": "Buy milk, eggs, spinach, chicken breast, and whole wheat bread for the week."},
    {"id": 3, "title": "Project deadline reminder", "content": "The backend API for the Zomato Notes capstone must be deployed and demoed by Friday."},
    {"id": 4, "title": "Book recommendation", "content": "A friend suggested reading a novel about a detective solving crimes in a coastal town."},
    {"id": 5, "title": "Recipe idea", "content": "Try making a vegetable stir fry with broccoli, bell peppers, and soy sauce tonight."},
    {"id": 6, "title": "Gym schedule change", "content": "Switch leg day to Thursday and move the rest day to Sunday this week."},
    {"id": 7, "title": "Meeting notes", "content": "Discussed the database schema for the notes app and agreed on using foreign keys for ownership."},
    {"id": 8, "title": "Weekend hiking trip", "content": "Plan a short hiking trip to a nearby trail, pack water bottles and snacks in advance."},
]
