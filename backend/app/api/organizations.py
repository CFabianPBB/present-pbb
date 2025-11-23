from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.models.models import Organization, Dataset

router = APIRouter()

# Admin authentication
def verify_admin(x_admin_secret: str = Header(...)):
    if x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    return True

# Pydantic schemas
class OrganizationCreate(BaseModel):
    name: str
    show_priorities: bool = True
    show_taxpayer_dividend: bool = True
    show_strategic_overview: bool = True

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    show_priorities: Optional[bool] = None
    show_taxpayer_dividend: Optional[bool] = None
    show_strategic_overview: Optional[bool] = None

class DatasetSummary(BaseModel):
    id: str
    name: str
    population: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class OrganizationResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    show_priorities: bool
    show_taxpayer_dividend: bool
    show_strategic_overview: bool
    datasets: List[DatasetSummary]
    
    class Config:
        from_attributes = True

class FeatureFlags(BaseModel):
    show_priorities: bool
    show_taxpayer_dividend: bool
    show_strategic_overview: bool

# Public endpoint - no auth required (for checking feature flags)
@router.get("/dataset/{dataset_id}/features", response_model=FeatureFlags)
def get_dataset_features(dataset_id: str, db: Session = Depends(get_db)):
    """
    Get feature flags for a dataset (public endpoint for navigation).
    Returns default flags (all enabled) for standalone datasets.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Default feature flags (all enabled for standalone datasets)
    if not dataset.organization:
        return FeatureFlags(
            show_priorities=True,
            show_taxpayer_dividend=True,
            show_strategic_overview=True
        )
    
    # Return organization's feature flags
    return FeatureFlags(
        show_priorities=dataset.organization.show_priorities,
        show_taxpayer_dividend=dataset.organization.show_taxpayer_dividend,
        show_strategic_overview=dataset.organization.show_strategic_overview
    )

# Admin-only endpoints below
@router.get("/organizations", response_model=List[OrganizationResponse])
def list_organizations(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin)
):
    """Get all organizations with their datasets"""
    organizations = db.query(Organization).all()
    return organizations

@router.post("/organizations", response_model=OrganizationResponse)
def create_organization(
    org: OrganizationCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin)
):
    """Create a new organization"""
    # Check if organization name already exists
    existing = db.query(Organization).filter(Organization.name == org.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Organization name already exists")
    
    new_org = Organization(
        id=uuid.uuid4(),
        name=org.name,
        show_priorities=org.show_priorities,
        show_taxpayer_dividend=org.show_taxpayer_dividend,
        show_strategic_overview=org.show_strategic_overview
    )
    
    db.add(new_org)
    db.commit()
    db.refresh(new_org)
    
    return new_org

@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
def get_organization(
    org_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin)
):
    """Get a specific organization by ID"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

@router.put("/organizations/{org_id}", response_model=OrganizationResponse)
def update_organization(
    org_id: str,
    org_update: OrganizationUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin)
):
    """Update organization details"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Update fields if provided
    if org_update.name is not None:
        # Check if new name already exists (for a different org)
        existing = db.query(Organization).filter(
            Organization.name == org_update.name,
            Organization.id != org_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Organization name already exists")
        org.name = org_update.name
    
    if org_update.show_priorities is not None:
        org.show_priorities = org_update.show_priorities
    if org_update.show_taxpayer_dividend is not None:
        org.show_taxpayer_dividend = org_update.show_taxpayer_dividend
    if org_update.show_strategic_overview is not None:
        org.show_strategic_overview = org_update.show_strategic_overview
    
    db.commit()
    db.refresh(org)
    
    return org

@router.delete("/organizations/{org_id}")
def delete_organization(
    org_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin)
):
    """Delete an organization (datasets will have organization_id set to NULL)"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    org_name = org.name
    db.delete(org)
    db.commit()
    
    return {"success": True, "message": f"Organization '{org_name}' deleted successfully"}