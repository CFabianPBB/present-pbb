from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_
from typing import Optional, List, Dict
from collections import defaultdict
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


# ============================================================================
# SANKEY FLOW VISUALIZATION ENDPOINTS
# ============================================================================

@router.get("/sankey-flow")
async def get_sankey_flow(
    dataset_id: str = Query(...),
    direction: str = Query("category_to_program", description="category_to_program or program_to_category"),
    search: Optional[str] = Query(None, description="Search term for categories or programs (single, deprecated)"),
    search_items: Optional[str] = Query(None, description="Multiple search terms separated by |||"),
    department: Optional[str] = Query(None, description="Filter by department/user group (single, deprecated)"),
    departments: Optional[str] = Query(None, description="Filter by departments (comma-separated)"),
    fund: Optional[str] = Query(None, description="Filter by fund (single, deprecated)"),
    funds: Optional[str] = Query(None, description="Filter by funds (comma-separated)"),
    cost_type: Optional[str] = Query(None, description="Filter by cost type (single, deprecated)"),
    cost_types: Optional[str] = Query(None, description="Filter by cost types (comma-separated)"),
    include_priorities: bool = Query(False, description="Include priority layer for three-node Sankey"),
    limit_nodes: int = Query(25, description="Max number of nodes on each side"),
    min_flow_pct: float = Query(0.5, description="Minimum flow percentage to include"),
    db: Session = Depends(get_db)
):
    """
    Get aggregated cost flow data for Sankey diagram visualization.
    
    Returns nodes (categories and programs) and links (cost flows between them).
    Supports bidirectional view: Categories → Programs or Programs → Categories.
    Supports multi-select filters via comma-separated values.
    """
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Parse multi-select search items
    search_list = []
    if search_items:
        search_list = [s.strip() for s in search_items.split('|||') if s.strip()]
    elif search:
        search_list = [search]
    
    # Parse multi-select filters (support both singular and plural params for backwards compat)
    dept_list = []
    if departments:
        dept_list = [d.strip() for d in departments.split(',') if d.strip()]
    elif department:
        dept_list = [department]
    
    fund_list = []
    if funds:
        fund_list = [f.strip() for f in funds.split(',') if f.strip()]
    elif fund:
        fund_list = [fund]
    
    cost_type_list = []
    if cost_types:
        cost_type_list = [c.strip() for c in cost_types.split(',') if c.strip()]
    elif cost_type:
        cost_type_list = [cost_type]
    
    # Base query - join line items with programs and org units
    query = db.query(
        LineItem.item_cat1,
        LineItem.item_cat2,
        LineItem.fund,
        LineItem.cost_type,
        LineItem.total_item_cost,
        LineItem.allocation_pct,
        Program.id.label('program_id'),
        Program.name.label('program_name'),
        Program.user_group,
        OrgUnit.department
    ).join(
        Program, LineItem.program_id == Program.id
    ).outerjoin(
        OrgUnit, LineItem.org_unit_id == OrgUnit.id
    ).filter(
        LineItem.dataset_id == dataset_uuid,
        LineItem.total_item_cost > 0
    )
    
    # Apply multi-select filters
    if dept_list:
        # Check both OrgUnit.department and Program.user_group
        dept_conditions = []
        for dept in dept_list:
            dept_conditions.append(OrgUnit.department.ilike(f"%{dept}%"))
            dept_conditions.append(Program.user_group.ilike(f"%{dept}%"))
        query = query.filter(or_(*dept_conditions))
    
    if fund_list:
        fund_conditions = [LineItem.fund.ilike(f"%{f}%") for f in fund_list]
        query = query.filter(or_(*fund_conditions))
    
    if cost_type_list:
        cost_type_conditions = [LineItem.cost_type.ilike(f"%{ct}%") for ct in cost_type_list]
        query = query.filter(or_(*cost_type_conditions))
    
    # Apply multi-select search filter based on direction
    if search_list:
        if direction == "category_to_program":
            # Searching for categories - show all programs they flow to
            search_conditions = []
            for term in search_list:
                search_conditions.append(LineItem.item_cat1.ilike(f"%{term}%"))
                search_conditions.append(LineItem.item_cat2.ilike(f"%{term}%"))
            query = query.filter(or_(*search_conditions))
        else:
            # Searching for programs - show all categories that flow in
            search_conditions = [Program.name.ilike(f"%{term}%") for term in search_list]
            query = query.filter(or_(*search_conditions))
    
    # Execute query
    results = query.all()
    
    if not results:
        return {
            "nodes": [],
            "links": [],
            "total_flow": 0,
            "filters_applied": {
                "search_items": search_list,
                "departments": dept_list,
                "funds": fund_list,
                "cost_types": cost_type_list
            }
        }
    
    # Aggregate flows: category -> program
    flow_totals = defaultdict(float)
    category_totals = defaultdict(float)
    program_totals = defaultdict(lambda: {"total": 0, "user_group": None})
    
    for row in results:
        # Use item_cat1 as primary category, fall back to item_cat2 or cost_type
        category = row.item_cat1 or row.item_cat2 or row.cost_type or "Uncategorized"
        program = row.program_name
        cost = float(row.total_item_cost or 0)
        
        # Apply allocation percentage if available
        if row.allocation_pct and row.allocation_pct > 0:
            cost = cost * (float(row.allocation_pct) / 100)
        
        flow_key = (category, program)
        flow_totals[flow_key] += cost
        category_totals[category] += cost
        program_totals[program]["total"] += cost
        program_totals[program]["user_group"] = row.user_group
    
    total_flow = sum(flow_totals.values())
    
    # Minimum value threshold - filter out items less than $1000
    min_value_threshold = 1000
    
    # Filter out zero/tiny values from category and program totals
    filtered_categories = {k: v for k, v in category_totals.items() if v >= min_value_threshold}
    filtered_programs = {k: v for k, v in program_totals.items() if v["total"] >= min_value_threshold}
    
    # Also filter flow_totals to remove tiny flows
    filtered_flows = {k: v for k, v in flow_totals.items() if v >= min_value_threshold}
    
    # Determine which nodes to include based on limit
    # Sort by total and take top N
    top_categories = sorted(filtered_categories.items(), key=lambda x: x[1], reverse=True)[:limit_nodes]
    top_programs = sorted(filtered_programs.items(), key=lambda x: x[1]["total"], reverse=True)[:limit_nodes]
    
    top_category_names = {c[0] for c in top_categories}
    top_program_names = {p[0] for p in top_programs}
    
    # Build nodes list
    nodes = []
    node_indices = {}
    
    # Add category nodes (left side in category_to_program mode)
    for i, (cat, total) in enumerate(top_categories):
        node_indices[f"cat_{cat}"] = len(nodes)
        nodes.append({
            "id": f"cat_{cat}",
            "name": cat[:40] + "..." if len(cat) > 40 else cat,  # Truncate long names
            "fullName": cat,
            "type": "category",
            "value": total,
            "percentage": (total / total_flow * 100) if total_flow > 0 else 0
        })
    
    # Add program nodes (right side in category_to_program mode)  
    for i, (prog, data) in enumerate(top_programs):
        node_indices[f"prog_{prog}"] = len(nodes)
        nodes.append({
            "id": f"prog_{prog}",
            "name": prog[:40] + "..." if len(prog) > 40 else prog,
            "fullName": prog,
            "type": "program",
            "value": data["total"],
            "percentage": (data["total"] / total_flow * 100) if total_flow > 0 else 0,
            "userGroup": data["user_group"]
        })
    
    # Add priority nodes and links if requested
    priority_data = {}
    program_to_priority_flows = []
    top_priority_names = set()
    
    if include_priorities:
        try:
            # Get program IDs for the top programs
            program_name_to_id = {}
            program_query = db.query(Program.id, Program.name).filter(
                Program.dataset_id == dataset_uuid,
                Program.name.in_(top_program_names)
            ).all()
            for prog_id, prog_name in program_query:
                program_name_to_id[prog_name] = prog_id
            
            # Query program priority scores with priority names
            if program_name_to_id:
                priority_query = db.query(
                    ProgramPriorityScore.program_id,
                    Priority.name.label('priority_name'),
                    ProgramPriorityScore.score_int,  # Fixed: use score_int not score
                    Program.name.label('program_name')
                ).join(
                    Priority, ProgramPriorityScore.priority_id == Priority.id
                ).join(
                    Program, ProgramPriorityScore.program_id == Program.id
                ).filter(
                    ProgramPriorityScore.dataset_id == dataset_uuid,
                    ProgramPriorityScore.program_id.in_(program_name_to_id.values())
                ).all()
                
                # Get program costs to calculate weighted flows
                prog_costs = {}
                for prog_name, data in top_programs:
                    prog_costs[prog_name] = data["total"]
                
                for prog_id, priority_name, score_int, prog_name in priority_query:
                    if prog_name and priority_name:
                        # Use program's total cost weighted by priority score
                        prog_cost = prog_costs.get(prog_name, 0)
                        # score_int is typically 0-4, normalize to percentage
                        weight = (float(score_int or 0) / 4.0) if score_int else 0.1
                        flow_value = prog_cost * weight
                        
                        if flow_value >= min_value_threshold:  # Only include meaningful flows
                            if priority_name not in priority_data:
                                priority_data[priority_name] = 0
                            priority_data[priority_name] += flow_value
                            program_to_priority_flows.append({
                                "program": prog_name,
                                "priority": priority_name,
                                "value": flow_value
                            })
            
            # Add priority nodes - filter out small ones
            filtered_priorities = {k: v for k, v in priority_data.items() if v >= min_value_threshold}
            top_priorities = sorted(filtered_priorities.items(), key=lambda x: x[1], reverse=True)[:limit_nodes]
            for priority_name, total in top_priorities:
                node_indices[f"priority_{priority_name}"] = len(nodes)
                nodes.append({
                    "id": f"priority_{priority_name}",
                    "name": priority_name[:40] + "..." if len(priority_name) > 40 else priority_name,
                    "fullName": priority_name,
                    "type": "priority",
                    "value": total,
                    "percentage": (total / total_flow * 100) if total_flow > 0 else 0
                })
            
            top_priority_names = {p[0] for p in top_priorities}
        except Exception as e:
            # If priority query fails, just continue without priorities
            import traceback
            print(f"Priority query failed: {e}")
            traceback.print_exc()
            priority_data = {}
            program_to_priority_flows = []
            top_priority_names = set()
    
    # Build links (only between nodes that made the cut)
    links = []
    min_flow_value = max(total_flow * (min_flow_pct / 100), min_value_threshold)
    
    for (category, program), value in filtered_flows.items():
        if category not in top_category_names or program not in top_program_names:
            continue
        if value < min_flow_value:
            continue
            
        source_key = f"cat_{category}"
        target_key = f"prog_{program}"
        
        if source_key in node_indices and target_key in node_indices:
            # Swap source/target based on direction
            if direction == "category_to_program":
                links.append({
                    "source": node_indices[source_key],
                    "target": node_indices[target_key],
                    "value": value,
                    "sourceName": category,
                    "targetName": program,
                    "percentage": (value / total_flow * 100) if total_flow > 0 else 0
                })
            else:
                links.append({
                    "source": node_indices[target_key],
                    "target": node_indices[source_key],
                    "value": value,
                    "sourceName": program,
                    "targetName": category,
                    "percentage": (value / total_flow * 100) if total_flow > 0 else 0
                })
    
    # Add program -> priority links if priorities are included
    if include_priorities and program_to_priority_flows:
        for flow in program_to_priority_flows:
            prog_key = f"prog_{flow['program']}"
            priority_key = f"priority_{flow['priority']}"
            
            if prog_key in node_indices and priority_key in node_indices:
                if flow['value'] >= min_flow_value:
                    links.append({
                        "source": node_indices[prog_key],
                        "target": node_indices[priority_key],
                        "value": flow['value'],
                        "sourceName": flow['program'],
                        "targetName": flow['priority'],
                        "percentage": (flow['value'] / total_flow * 100) if total_flow > 0 else 0
                    })
    
    # Sort links by value for better rendering
    links.sort(key=lambda x: x["value"], reverse=True)
    
    # Get available filter options for the UI
    available_funds = db.query(LineItem.fund).filter(
        LineItem.dataset_id == dataset_uuid,
        LineItem.fund.isnot(None)
    ).distinct().all()
    
    available_departments = db.query(Program.user_group).filter(
        Program.dataset_id == dataset_uuid,
        Program.user_group.isnot(None)
    ).distinct().all()
    
    return {
        "nodes": nodes,
        "links": links,
        "total_flow": total_flow,
        "node_count": {
            "categories": len(top_categories),
            "programs": len(top_programs),
            "priorities": len(priority_data) if include_priorities else 0
        },
        "direction": direction,
        "include_priorities": include_priorities,
        "filters_applied": {
            "search_items": search_list,
            "departments": dept_list,
            "funds": fund_list,
            "cost_types": cost_type_list
        },
        "filter_options": {
            "funds": sorted([f[0] for f in available_funds if f[0]]),
            "departments": sorted([d[0] for d in available_departments if d[0]]),
            "cost_types": ["Personnel", "NonPersonnel"]
        }
    }


@router.get("/sankey-search")
async def search_sankey_items(
    dataset_id: str = Query(...),
    q: str = Query(..., min_length=2),
    search_type: str = Query("both", description="categories, programs, or both"),
    limit: int = Query(20),
    db: Session = Depends(get_db)
):
    """
    Enhanced semantic search endpoint for typeahead in the Sankey UI.
    Returns matching categories and/or programs with keyword expansion.
    """
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Semantic keyword expansion - maps common resident terms to program-related concepts
    keyword_expansions = {
        # Recreation & Activities
        "swimming": ["aquatics", "pool", "swim", "water safety", "recreation"],
        "swim": ["aquatics", "pool", "swimming", "water safety", "recreation"],
        "pool": ["aquatics", "swimming", "recreation"],
        "sports": ["recreation", "athletics", "youth", "adult", "league", "field"],
        "gym": ["recreation", "fitness", "center"],
        "park": ["parks", "recreation", "trails", "maintenance", "green space"],
        "playground": ["parks", "recreation", "youth"],
        "camping": ["parks", "recreation", "outdoors"],
        "hiking": ["trails", "parks", "recreation", "path"],
        
        # Public Safety
        "police": ["law enforcement", "public safety", "crime", "patrol", "officer"],
        "cops": ["law enforcement", "police", "public safety", "patrol"],
        "crime": ["law enforcement", "police", "public safety", "prevention"],
        "fire": ["fire department", "emergency", "rescue", "suppression", "prevention"],
        "ambulance": ["emergency", "medical", "ems", "paramedic", "response"],
        "911": ["emergency", "dispatch", "communications", "response"],
        "safety": ["public safety", "police", "fire", "emergency"],
        
        # Housing & Homelessness
        "homeless": ["homelessness", "housing", "shelter", "outreach", "navigation", "case management"],
        "homelessness": ["homeless", "housing", "shelter", "outreach", "navigation", "services"],
        "shelter": ["homeless", "housing", "emergency", "services"],
        "affordable housing": ["housing", "development", "voucher", "assistance"],
        "rent": ["housing", "assistance", "voucher", "affordable"],
        
        # Streets & Transportation
        "snow": ["snow removal", "winter", "street maintenance", "plow", "ice"],
        "plow": ["snow", "winter", "street", "maintenance"],
        "pothole": ["street", "maintenance", "road", "repair", "pavement"],
        "road": ["street", "maintenance", "transportation", "pavement", "traffic"],
        "street": ["road", "maintenance", "transportation", "pavement"],
        "traffic": ["transportation", "signal", "safety", "control", "engineering"],
        "sidewalk": ["pedestrian", "maintenance", "path", "walkway"],
        "bus": ["transit", "transportation", "public"],
        "parking": ["enforcement", "meters", "lots", "garage"],
        "bike": ["bicycle", "path", "trail", "lane", "cycling"],
        
        # Utilities & Environment
        "water": ["utility", "distribution", "treatment", "sewer", "stormwater"],
        "sewer": ["wastewater", "utility", "treatment", "sanitary"],
        "trash": ["solid waste", "garbage", "recycling", "collection", "refuse"],
        "garbage": ["solid waste", "trash", "collection", "refuse", "waste"],
        "recycling": ["solid waste", "trash", "sustainability", "environment"],
        "electric": ["utility", "power", "energy", "electricity"],
        "stormwater": ["drainage", "flood", "water", "utility"],
        
        # Community Services
        "library": ["circulation", "programming", "literacy", "books", "media"],
        "books": ["library", "circulation", "literacy"],
        "senior": ["aging", "elderly", "services", "center", "meals"],
        "elderly": ["senior", "aging", "services"],
        "youth": ["children", "kids", "teen", "recreation", "programs"],
        "kids": ["youth", "children", "recreation", "programs"],
        "children": ["youth", "kids", "recreation", "childcare"],
        "daycare": ["childcare", "children", "early childhood"],
        
        # Permits & Planning
        "permit": ["permitting", "building", "inspection", "code", "license"],
        "building": ["permit", "inspection", "code", "construction", "development"],
        "zoning": ["planning", "land use", "development", "code"],
        "inspection": ["permit", "building", "code", "compliance"],
        
        # Health
        "health": ["public health", "wellness", "medical", "clinic", "disease"],
        "clinic": ["health", "medical", "wellness"],
        "mental health": ["behavioral", "counseling", "crisis", "services"],
        "vaccine": ["immunization", "health", "public health"],
        
        # Administration & Finance
        "taxes": ["tax", "finance", "revenue", "assessment", "collection"],
        "tax": ["taxes", "finance", "revenue", "assessment"],
        "bill": ["utility", "payment", "customer service", "billing"],
        "budget": ["finance", "fiscal", "planning", "administration"],
        "jobs": ["employment", "human resources", "workforce", "career"],
        "hr": ["human resources", "personnel", "employment"],
        
        # Events & Culture
        "event": ["events", "special", "festival", "community", "celebration"],
        "festival": ["events", "special", "community", "celebration"],
        "concert": ["events", "arts", "culture", "entertainment"],
        "art": ["arts", "culture", "museum", "gallery"],
        "museum": ["arts", "culture", "history"],
    }
    
    # Expand search terms
    search_terms = [q.lower()]
    q_lower = q.lower()
    
    # Add expanded keywords
    for key, expansions in keyword_expansions.items():
        if key in q_lower or q_lower in key:
            search_terms.extend(expansions)
    
    # Remove duplicates while preserving order
    search_terms = list(dict.fromkeys(search_terms))
    
    results = {"categories": [], "programs": []}
    
    if search_type in ("categories", "both"):
        # Search unique categories with expanded terms
        category_conditions = []
        for term in search_terms:
            category_conditions.append(LineItem.item_cat1.ilike(f"%{term}%"))
            category_conditions.append(LineItem.item_cat2.ilike(f"%{term}%"))
        
        categories = db.query(
            LineItem.item_cat1,
            func.sum(LineItem.total_item_cost).label('total_cost'),
            func.count(LineItem.id).label('item_count')
        ).filter(
            LineItem.dataset_id == dataset_uuid,
            or_(*category_conditions),
            LineItem.item_cat1.isnot(None)
        ).group_by(
            LineItem.item_cat1
        ).order_by(
            func.sum(LineItem.total_item_cost).desc()
        ).limit(limit).all()
        
        results["categories"] = [
            {
                "name": cat.item_cat1,
                "totalCost": float(cat.total_cost) if cat.total_cost else 0,
                "itemCount": cat.item_count
            }
            for cat in categories
        ]
    
    if search_type in ("programs", "both"):
        # Search programs across multiple fields with expanded terms
        program_conditions = []
        for term in search_terms:
            program_conditions.append(Program.name.ilike(f"%{term}%"))
            program_conditions.append(Program.description.ilike(f"%{term}%"))
            program_conditions.append(Program.service_type.ilike(f"%{term}%"))
            program_conditions.append(Program.user_group.ilike(f"%{term}%"))
        
        programs = db.query(
            Program.id,
            Program.name,
            Program.description,
            Program.user_group,
            ProgramCost.total_cost
        ).join(
            ProgramCost, Program.id == ProgramCost.program_id
        ).filter(
            Program.dataset_id == dataset_uuid,
            or_(*program_conditions)
        ).order_by(
            ProgramCost.total_cost.desc()
        ).limit(limit).all()
        
        # Deduplicate programs (in case same program matches multiple terms)
        seen_ids = set()
        unique_programs = []
        for prog in programs:
            if prog.id not in seen_ids:
                seen_ids.add(prog.id)
                unique_programs.append({
                    "id": prog.id,
                    "name": prog.name,
                    "description": prog.description[:100] + "..." if prog.description and len(prog.description) > 100 else prog.description,
                    "userGroup": prog.user_group,
                    "totalCost": float(prog.total_cost) if prog.total_cost else 0
                })
        
        results["programs"] = unique_programs
    
    # Include what terms were searched (for debugging/transparency)
    results["searchTerms"] = search_terms[:10]  # Limit to first 10 for response size
    
    return results


@router.get("/program-search")
async def semantic_program_search(
    dataset_id: str = Query(...),
    q: str = Query(..., min_length=2),
    limit: int = Query(30),
    db: Session = Depends(get_db)
):
    """
    Semantic program search endpoint - "thinks like a resident".
    Searches program name, description, service_type, and user_group
    with keyword expansion for common resident terms.
    
    Examples:
    - "swimming lessons" → finds "Aquatics Safety & Instruction"
    - "homeless" → finds Outreach, Housing Navigation, Case Management
    - "snow removal" → finds Winter Street Maintenance, Sidewalk Maintenance
    """
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Semantic keyword expansion - maps common resident terms to program-related concepts
    keyword_expansions = {
        # Recreation & Activities
        "swimming": ["aquatics", "pool", "swim", "water safety", "recreation", "lessons"],
        "swim": ["aquatics", "pool", "swimming", "water safety", "recreation"],
        "pool": ["aquatics", "swimming", "recreation"],
        "sports": ["recreation", "athletics", "youth", "adult", "league", "field"],
        "gym": ["recreation", "fitness", "center"],
        "park": ["parks", "recreation", "trails", "maintenance", "green space"],
        "playground": ["parks", "recreation", "youth"],
        "camping": ["parks", "recreation", "outdoors"],
        "hiking": ["trails", "parks", "recreation", "path"],
        "golf": ["course", "pro shop", "recreation"],
        
        # Public Safety
        "police": ["law enforcement", "public safety", "crime", "patrol", "officer", "response"],
        "cops": ["law enforcement", "police", "public safety", "patrol"],
        "crime": ["law enforcement", "police", "public safety", "prevention", "investigation"],
        "fire": ["fire department", "emergency", "rescue", "suppression", "prevention", "firefighter"],
        "ambulance": ["emergency", "medical", "ems", "paramedic", "response"],
        "911": ["emergency", "dispatch", "communications", "response"],
        "safety": ["public safety", "police", "fire", "emergency", "protection"],
        
        # Housing & Homelessness
        "homeless": ["homelessness", "housing", "shelter", "outreach", "navigation", "case management", "services"],
        "homelessness": ["homeless", "housing", "shelter", "outreach", "navigation", "services"],
        "shelter": ["homeless", "housing", "emergency", "services"],
        "affordable housing": ["housing", "development", "voucher", "assistance"],
        "rent": ["housing", "assistance", "voucher", "affordable"],
        "housing": ["homeless", "voucher", "development", "assistance", "affordable"],
        
        # Streets & Transportation
        "snow": ["snow removal", "winter", "street maintenance", "plow", "ice", "clearing"],
        "plow": ["snow", "winter", "street", "maintenance"],
        "pothole": ["street", "maintenance", "road", "repair", "pavement"],
        "road": ["street", "maintenance", "transportation", "pavement", "traffic"],
        "street": ["road", "maintenance", "transportation", "pavement", "lighting"],
        "traffic": ["transportation", "signal", "safety", "control", "engineering"],
        "sidewalk": ["pedestrian", "maintenance", "path", "walkway"],
        "bus": ["transit", "transportation", "public"],
        "parking": ["enforcement", "meters", "lots", "garage"],
        "bike": ["bicycle", "path", "trail", "lane", "cycling"],
        
        # Utilities & Environment
        "water": ["utility", "distribution", "treatment", "sewer", "stormwater"],
        "sewer": ["wastewater", "utility", "treatment", "sanitary"],
        "trash": ["solid waste", "garbage", "recycling", "collection", "refuse"],
        "garbage": ["solid waste", "trash", "collection", "refuse", "waste"],
        "recycling": ["solid waste", "trash", "sustainability", "environment"],
        "electric": ["utility", "power", "energy", "electricity"],
        "stormwater": ["drainage", "flood", "water", "utility"],
        
        # Community Services
        "library": ["circulation", "programming", "literacy", "books", "media", "meeting"],
        "books": ["library", "circulation", "literacy"],
        "senior": ["aging", "elderly", "services", "center", "meals"],
        "elderly": ["senior", "aging", "services"],
        "youth": ["children", "kids", "teen", "recreation", "programs"],
        "kids": ["youth", "children", "recreation", "programs"],
        "children": ["youth", "kids", "recreation", "childcare"],
        "daycare": ["childcare", "children", "early childhood"],
        "community": ["events", "center", "services", "outreach", "engagement"],
        
        # Permits & Planning
        "permit": ["permitting", "building", "inspection", "code", "license"],
        "building": ["permit", "inspection", "code", "construction", "development"],
        "zoning": ["planning", "land use", "development", "code"],
        "inspection": ["permit", "building", "code", "compliance"],
        
        # Health
        "health": ["public health", "wellness", "medical", "clinic", "disease"],
        "clinic": ["health", "medical", "wellness"],
        "mental health": ["behavioral", "counseling", "crisis", "services"],
        "vaccine": ["immunization", "health", "public health"],
        
        # Administration & Finance
        "taxes": ["tax", "finance", "revenue", "assessment", "collection"],
        "tax": ["taxes", "finance", "revenue", "assessment"],
        "bill": ["utility", "payment", "customer service", "billing"],
        "budget": ["finance", "fiscal", "planning", "administration"],
        "jobs": ["employment", "human resources", "workforce", "career"],
        "hr": ["human resources", "personnel", "employment"],
        
        # Events & Culture
        "event": ["events", "special", "festival", "community", "celebration"],
        "festival": ["events", "special", "community", "celebration"],
        "concert": ["events", "arts", "culture", "entertainment"],
        "art": ["arts", "culture", "museum", "gallery"],
        "museum": ["arts", "culture", "history"],
        
        # IT & Technology
        "internet": ["technology", "broadband", "connectivity", "cybersecurity"],
        "computer": ["technology", "it", "software", "cybersecurity"],
        "cyber": ["cybersecurity", "it", "technology", "security"],
    }
    
    # Expand search terms
    search_terms = [q.lower()]
    q_lower = q.lower()
    
    # Add expanded keywords
    for key, expansions in keyword_expansions.items():
        if key in q_lower or q_lower in key:
            search_terms.extend(expansions)
    
    # Also check for partial matches in multi-word searches
    words = q_lower.split()
    for word in words:
        if len(word) >= 3:  # Only expand words with 3+ chars
            for key, expansions in keyword_expansions.items():
                if word in key or key in word:
                    search_terms.extend(expansions)
    
    # Remove duplicates while preserving order
    search_terms = list(dict.fromkeys(search_terms))
    
    # Build search conditions across multiple fields
    program_conditions = []
    for term in search_terms:
        program_conditions.append(Program.name.ilike(f"%{term}%"))
        program_conditions.append(Program.description.ilike(f"%{term}%"))
        program_conditions.append(Program.service_type.ilike(f"%{term}%"))
        program_conditions.append(Program.user_group.ilike(f"%{term}%"))
    
    # Query programs with all related info
    programs = db.query(
        Program.id,
        Program.name,
        Program.description,
        Program.service_type,
        Program.user_group,
        Program.quartile,
        ProgramCost.total_cost,
        ProgramCost.personnel,
        ProgramCost.nonpersonnel
    ).outerjoin(
        ProgramCost, Program.id == ProgramCost.program_id
    ).filter(
        Program.dataset_id == dataset_uuid,
        or_(*program_conditions)
    ).order_by(
        ProgramCost.total_cost.desc().nullslast()
    ).limit(limit * 2).all()  # Get extra to account for deduplication
    
    # Deduplicate and format results
    seen_ids = set()
    results = []
    for prog in programs:
        if prog.id not in seen_ids and len(results) < limit:
            seen_ids.add(prog.id)
            
            # Calculate relevance score (programs matching original query rank higher)
            relevance = 0
            prog_text = f"{prog.name} {prog.description or ''} {prog.service_type or ''} {prog.user_group or ''}".lower()
            if q_lower in prog_text:
                relevance = 100  # Exact match
            elif any(word in prog_text for word in words if len(word) >= 3):
                relevance = 50  # Partial word match
            else:
                relevance = 25  # Expanded term match
            
            results.append({
                "id": prog.id,
                "name": prog.name,
                "description": prog.description[:150] + "..." if prog.description and len(prog.description) > 150 else prog.description,
                "serviceType": prog.service_type,
                "userGroup": prog.user_group,
                "quartile": prog.quartile,
                "totalCost": float(prog.total_cost) if prog.total_cost else 0,
                "personnel": float(prog.personnel) if prog.personnel else 0,
                "nonpersonnel": float(prog.nonpersonnel) if prog.nonpersonnel else 0,
                "relevance": relevance
            })
    
    # Sort by relevance first, then by cost
    results.sort(key=lambda x: (-x["relevance"], -x["totalCost"]))
    
    return {
        "programs": results,
        "searchTerms": search_terms[:15],
        "query": q,
        "totalFound": len(results)
    }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

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