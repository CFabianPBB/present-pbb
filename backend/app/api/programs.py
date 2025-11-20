from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import Optional, List, Dict
from app.core.database import get_db
from app.models.models import Dataset, Program, ProgramCost, ProgramAttribute, LineItem, OrgUnit, ProgramPriorityScore, Priority
import uuid

router = APIRouter()

@router.get("/datasets")
async def list_datasets(db: Session = Depends(get_db)):
    """List all available datasets"""
    datasets = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    return [
        {
            "id": str(dataset.id),
            "name": dataset.name,
            "created_at": dataset.created_at,
            "program_count": len(dataset.programs)
        }
        for dataset in datasets
    ]

@router.get("/programs")
async def list_programs(
    dataset_id: str = Query(...),
    q: Optional[str] = Query(None, description="Search query"),
    dept: Optional[str] = Query(None, description="Filter by department"),
    division: Optional[str] = Query(None, description="Filter by division"),
    quartile: Optional[str] = Query(None, description="Filter by quartile"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    include_department: bool = Query(False, description="Include department information for treemap"),
    db: Session = Depends(get_db)
):
    """List programs with filtering and pagination. Enhanced for treemap visualization."""
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Base query
    query = db.query(Program).join(ProgramCost).filter(Program.dataset_id == dataset_uuid)
    
    # Apply filters
    if q:
        query = query.filter(Program.name.ilike(f"%{q}%"))
    if quartile:
        query = query.filter(Program.quartile == quartile)
    
    # Department/division filtering requires joining with line items and org units
    if dept or division:
        query = query.join(LineItem).join(OrgUnit)
        if dept:
            query = query.filter(OrgUnit.department.ilike(f"%{dept}%"))
        if division:
            query = query.filter(OrgUnit.division.ilike(f"%{division}%"))
    
    # For treemap mode, get all programs without pagination
    if include_department:
        programs = query.order_by(ProgramCost.total_cost.desc()).all()
        result = []
        
        for program in programs:
            cost = program.costs[0] if program.costs else None
            
            # Use user_group directly as the department (FIXED!)
            department = program.user_group or "Other"
            
            # Get priority scores for this program
            priority_scores_dict = {}
            
            # Query all priority scores for this program with their priority names
            scores = db.query(
                ProgramPriorityScore.score_int,
                Priority.name,
                Priority.group
            ).join(
                Priority,
                ProgramPriorityScore.priority_id == Priority.id
            ).filter(
                ProgramPriorityScore.program_id == program.id,
                ProgramPriorityScore.dataset_id == dataset_uuid
            ).all()
            
            # Build a dictionary mapping priority names to scores
            for score_int, priority_name, priority_group in scores:
                if score_int is not None:
                    # Create a key from the priority name
                    # e.g., "Priority 1" becomes "priority_1"
                    priority_key = priority_name.lower().replace(" ", "_")
                    priority_scores_dict[priority_key] = score_int
            
            result.append({
                "id": program.id,
                "name": program.name,
                "description": program.description,
                "service_type": program.service_type,
                "user_group": program.user_group,
                "quartile": program.quartile,
                "final_score": program.final_score,
                "total_cost": float(cost.total_cost) if cost and cost.total_cost else 0,
                "personnel": float(cost.personnel) if cost and cost.personnel else 0,
                "nonpersonnel": float(cost.nonpersonnel) if cost and cost.nonpersonnel else 0,
                "revenue": float(cost.revenue) if cost and cost.revenue else 0,
                "fte": program.fte or 0,
                "department": department,
                "cof_section": department,  # For compatibility
                "priority_scores": priority_scores_dict  # Add priority scores
            })
        
        return result
    
    # Standard paginated mode
    else:
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        programs = query.order_by(ProgramCost.total_cost.desc()).offset((page - 1) * limit).limit(limit).all()
        
        # Format response
        result = []
        for program in programs:
            cost = program.costs[0] if program.costs else None
            
            result.append({
                "id": program.id,
                "name": program.name,
                "service_type": program.service_type,
                "quartile": program.quartile,
                "final_score": program.final_score,
                "total_cost": float(cost.total_cost) if cost and cost.total_cost else 0,
                "fte": program.fte or 0,
                "department": None,  # Would need to aggregate from line items
                "division": None     # Would need to aggregate from line items
            })
        
        return {
            "programs": result,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }

@router.get("/programs/{program_id}")
async def get_program_detail(
    program_id: int,
    dataset_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific program"""
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    program = db.query(Program).filter(
        and_(Program.id == program_id, Program.dataset_id == dataset_uuid)
    ).first()
    
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Get costs
    cost = program.costs[0] if program.costs else None
    
    # Get attributes
    attributes = program.attributes[0] if program.attributes else None
    
    # Get priority scores
    priority_scores = [
        {
            "priority": score.priority.name,
            "group": score.priority.group,
            "score": score.score_int,
            "label": score.score_label
        }
        for score in program.priority_scores
    ]
    
    # Get organizational info (aggregate from line items)
    org_info = db.query(OrgUnit).join(LineItem).filter(
        LineItem.program_id == program_id
    ).first()
    
    # Get line items summary
    line_items_summary = db.query(LineItem).filter(
        LineItem.program_id == program_id
    ).all()
    
    return {
        "id": program.id,
        "name": program.name,
        "description": program.description,
        "service_type": program.service_type,
        "user_group": program.user_group,
        "quartile": program.quartile,
        "final_score": program.final_score,
        "fte": program.fte,
        "costs": {
            "personnel": float(cost.personnel) if cost and cost.personnel else 0,
            "nonpersonnel": float(cost.nonpersonnel) if cost and cost.nonpersonnel else 0,
            "revenue": float(cost.revenue) if cost and cost.revenue else 0,
            "total": float(cost.total_cost) if cost and cost.total_cost else 0
        },
        "organization": {
            "department": org_info.department if org_info else None,
            "division": org_info.division if org_info else None,
            "activity": org_info.activity if org_info else None
        },
        "attributes": {
            "reliance": attributes.reliance if attributes else None,
            "population_served": attributes.population_served if attributes else None,
            "demand": attributes.demand if attributes else None,
            "cost_recovery": attributes.cost_recovery if attributes else None,
            "mandate": attributes.mandate if attributes else None
        } if attributes else None,
        "priority_scores": priority_scores,
        "line_items_count": len(line_items_summary)
    }

@router.get("/programs/{program_id}/line-items")
async def get_program_line_items(
    program_id: int,
    dataset_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """Get all line items for a specific program"""
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Verify program exists
    program = db.query(Program).filter(
        and_(Program.id == program_id, Program.dataset_id == dataset_uuid)
    ).first()
    
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Get line items
    line_items = db.query(LineItem).filter(
        and_(
            LineItem.program_id == program_id,
            LineItem.dataset_id == dataset_uuid
        )
    ).order_by(LineItem.total_item_cost.desc()).all()
    
    return {
        "program_id": program_id,
        "program_name": program.name,
        "line_items": [
            {
                "id": item.id,
                "cost_type": item.cost_type or "",
                "acct_type": item.acct_type or "",
                "acct_number": item.acct_number or "",
                "fund": item.fund or "",
                "item_cat1": item.item_cat1 or "",
                "item_cat2": item.item_cat2 or "",
                "num_items": item.num_items or 0,
                "total_item_cost": float(item.total_item_cost) if item.total_item_cost else 0.0,
                "allocation_pct": float(item.allocation_pct) if item.allocation_pct else 0.0
            }
            for item in line_items
        ],
        "total_items": len(line_items)
    }

@router.get("/tables/line-items")
async def get_line_items(
    dataset_id: str = Query(...),
    program_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get line items table for detailed view"""
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    query = db.query(LineItem).join(OrgUnit).filter(LineItem.dataset_id == dataset_uuid)
    
    if program_id:
        query = query.filter(LineItem.program_id == program_id)
    
    line_items = query.all()
    
    result = []
    for item in line_items:
        result.append({
            "id": item.id,
            "program_id": item.program_id,
            "department": item.org_unit.department if item.org_unit else None,
            "division": item.org_unit.division if item.org_unit else None,
            "activity": item.org_unit.activity if item.org_unit else None,
            "cost_type": item.cost_type,
            "account_type": item.acct_type,
            "account_number": item.acct_number,
            "fund": item.fund,
            "category1": item.item_cat1,
            "category2": item.item_cat2,
            "num_items": item.num_items,
            "total_cost": float(item.total_item_cost) if item.total_item_cost else 0,
            "allocation_pct": float(item.allocation_pct) if item.allocation_pct else 0,
            "year": item.year,
            "budget_label": item.budget_label
        })
    
    return {"line_items": result}

def extract_department_from_program(program: Program) -> Optional[str]:
    """Extract department name from program characteristics"""
    
    program_name = (program.name or "").lower()
    service_type = (program.service_type or "").lower()
    user_group = (program.user_group or "").lower()
    
    # Department mapping based on keywords
    department_mappings = {
        # Public Safety
        'Police': ['police', 'law enforcement', 'patrol', 'detective', 'criminal', 'security'],
        'Fire': ['fire', 'emergency medical', 'ems', 'paramedic', 'ambulance', 'rescue'],
        'Municipal Court': ['court', 'judge', 'legal', 'attorney', 'prosecution'],
        
        # Infrastructure & Utilities
        'Public Works': ['public works', 'street', 'road', 'maintenance', 'snow', 'traffic'],
        'Water': ['water', 'sewer', 'wastewater', 'utility', 'treatment'],
        'Engineering': ['engineering', 'design', 'construction', 'capital improvement'],
        
        # Community Services
        'Parks & Recreation': ['park', 'recreation', 'sports', 'facility', 'community center'],
        'Library': ['library', 'information', 'literacy', 'books'],
        'Planning': ['planning', 'zoning', 'development', 'building', 'permit'],
        
        # Administration
        'City Manager': ['city manager', 'executive', 'administration', 'leadership'],
        'Finance': ['finance', 'budget', 'accounting', 'treasury', 'revenue'],
        'Human Resources': ['human resources', 'hr', 'personnel', 'benefits', 'payroll'],
        'Information Technology': ['it', 'technology', 'computer', 'software', 'network'],
        'City Clerk': ['clerk', 'records', 'elections', 'council'],
        
        # Special Services
        'Economic Development': ['economic development', 'business', 'tourism', 'marketing'],
        'Environmental': ['environment', 'sustainability', 'green', 'climate', 'energy'],
        'Health': ['health', 'medical', 'wellness', 'inspection']
    }
    
    # Check program name, service type, and user group against mappings
    text_to_check = f"{program_name} {service_type} {user_group}"
    
    for department, keywords in department_mappings.items():
        for keyword in keywords:
            if keyword in text_to_check:
                return department
    
    # Fallback: try to use service_type directly if it looks like a department
    if service_type and len(service_type) > 2:
        return service_type.title()
    
    return "Other"