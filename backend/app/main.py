from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import admin, programs, charts, organizations  # ADD organizations import

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Present PBB API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(programs.router, prefix="/api", tags=["programs"])
app.include_router(charts.router, prefix="/api/charts", tags=["charts"])
app.include_router(organizations.router, prefix="/api", tags=["organizations"])  # ADD THIS

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {"message": "Present PBB API is running"}