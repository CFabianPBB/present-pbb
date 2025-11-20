from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE datasets ADD COLUMN population INTEGER DEFAULT 75000"))
    conn.commit()
    
print("Population column added successfully!")
