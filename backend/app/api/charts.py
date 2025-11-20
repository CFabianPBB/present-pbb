from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import Optional, List, Dict, Any
from app.core.database import get_db
from app.models.models import (
    Program, ProgramCost, Priority, ProgramPriorityScore, ProgramAttribute, LineItem, OrgUnit, Dataset
)
import uuid
import math
import statistics

router = APIRouter()

# PBB Category Definitions
PBB_CATEGORIES = {
    1: {
        "name": "Low Impact + Low Cost + Low Mandate + Low Reliance",
        "preferred_recommendation": "Downsize/exit or outsource/use GP partners; avoid GF spend.",
        "primary_insights": ["service_level", "sourcing", "efficiency"],
        "secondary_insights": ["cost_recovery"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": True,
            "shift_from_GF": True,
            "avoid_GF": True
        },
        "strategic_guidance": "Focus on service level adjustments, sourcing alternatives, and efficiency improvements. Avoid GF spend; reduce spending, prefer outsourcing, optional small fees for funding."
    },
    2: {
        "name": "Low Impact + Low Cost + Low Mandate + High Reliance",
        "preferred_recommendation": "Preserve access but shift burden off GP via spin-off/partners/fees.",
        "primary_insights": ["sourcing", "cost_recovery"],
        "secondary_insights": ["efficiency", "revenue_growth"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": True,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Prioritize sourcing options, cost recovery methods, and revenue growth strategies. Avoid Do not invest more, reduce spending, prefer outsourcing, optional small fees for funding, seek fee/sponsorships."
    },
    3: {
        "name": "Low Impact + Low Cost + High Mandate + Low Reliance",
        "preferred_recommendation": "Meet mandate efficiently at lowest cost; share/contract if cheaper.",
        "primary_insights": ["efficiency", "sourcing"],
        "secondary_insights": ["cost_recovery", "service_level"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": True,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Focus on efficiency improvements and sourcing options. Strategic Matrix: Avoid General Fund investments (lightest spending, prefer outsourcing, explore alternative funding where allowed."
    },
    4: {
        "name": "Low Impact + Low Cost + High Mandate + High Reliance",
        "preferred_recommendation": "Maintain compliance & access; optimize and recover partial cost.",
        "primary_insights": ["efficiency", "cost_recovery"],
        "secondary_insights": ["sourcing"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": False,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Decision Matrix: Invest only for compliance, avoid service harm when reducing spending, evaluate outsourcing, implement partial alternative funding."
    },
    5: {
        "name": "Low Impact + High Cost + Low Mandate + Low Reliance",
        "preferred_recommendation": "Prime candidate to downsize/exit or outsource; repurpose assets.",
        "primary_insights": ["service_level", "sourcing"],
        "secondary_insights": ["efficiency", "revenue_growth"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": True,
            "shift_from_GF": True,
            "avoid_GF": True
        },
        "strategic_guidance": "Decision Matrix: Do not invest more, reduce spending, prefer outsourcing, only consider alternative if retained at full cost."
    },
    6: {
        "name": "Low Impact + High Cost + Low Mandate + High Reliance",
        "preferred_recommendation": "General Mandate: Rapidly subsidize, offer outsourcing, or exit service.",
        "primary_insights": ["cost_recovery", "sourcing"],
        "secondary_insights": ["efficiency", "revenue_growth"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": True,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Matrix: Prioritize cost recovery methods and sourcing options. Decision Matrix: Avoid General Fund investments, do not subsidize without an ROI, subsidize shift to users/partners."
    },
    7: {
        "name": "Low Impact + High Cost + High Mandate + Low Reliance",
        "preferred_recommendation": "Meet mandate efficiently; consider outsourcing, aggressively pursue alternative funding.",
        "primary_insights": ["efficiency", "sourcing"],
        "secondary_insights": ["cost_recovery"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": True,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Decision Matrix: Meet mandate efficiently; regionalize/share to lower unit cost. Strategic Insights: Focus on sourcing options and efficiency improvements."
    },
    8: {
        "name": "Low Impact + High Cost + High Mandate + High Reliance",
        "preferred_recommendation": "Maintain compliance & essential access at lowest sustainable cost.",
        "primary_insights": ["efficiency", "cost_recovery"],
        "secondary_insights": ["sourcing"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": False,
            "shift_from_GF": False,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Insights: Prioritize efficiency improvements and cost recovery methods. Decision Matrix: Invest only if cost-saving ROI, careful spending reductions, evaluate outsourcing, pursue alternative funding."
    },
    9: {
        "name": "High Impact + Low Cost + Low Mandate + Low Reliance",
        "preferred_recommendation": "Maintain or grow cautiously with partners/fees; avoid GF growth.",
        "primary_insights": ["cost_recovery", "sourcing"],
        "secondary_insights": ["efficiency", "revenue_growth"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": False,
            "shift_from_GF": True,
            "avoid_GF": True
        },
        "strategic_guidance": "Strategic Insights: Prioritize cost recovery, sourcing alternatives, and revenue growth. Decision Matrix: Invest cautiously only with ROI or cost recovery, no GF spending increases, prefer fee/partnership funding."
    },
    10: {
        "name": "High Impact + Low Cost + Low Mandate + High Reliance",
        "preferred_recommendation": "Sustain and consider expansion via partnerships or fees.",
        "primary_insights": ["cost_recovery", "revenue_growth"],
        "secondary_insights": ["efficiency", "sourcing"],
        "decision_matrix": {
            "invest_more": True,
            "reduce_spending": False,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Insights: Prioritize revenue growth and cost recovery strategies. Decision Matrix: Selective GF investment with ROI analysis, maintain spending, grow via partnerships/fees."
    },
    11: {
        "name": "High Impact + Low Cost + High Mandate + Low Reliance",
        "preferred_recommendation": "Sustain service; seek efficiency gains and alternative funding.",
        "primary_insights": ["efficiency", "cost_recovery"],
        "secondary_insights": ["sourcing"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": False,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Insights: Focus on efficiency improvements and cost recovery. Decision Matrix: Selective investment for mandate compliance, maintain spending, pursue alternative funding."
    },
    12: {
        "name": "High Impact + Low Cost + High Mandate + High Reliance",
        "preferred_recommendation": "Protect and sustain; optimize operations for efficiency.",
        "primary_insights": ["efficiency"],
        "secondary_insights": ["cost_recovery"],
        "decision_matrix": {
            "invest_more": True,
            "reduce_spending": False,
            "shift_from_GF": False,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Insights: Focus on operational efficiency and service optimization. Decision Matrix: Protect from cuts, selective GF investment, maintain or grow spending carefully."
    },
    13: {
        "name": "High Impact + High Cost + Low Mandate + Low Reliance",
        "preferred_recommendation": "Sustain with partnerships/fees; avoid GF growth unless strong ROI.",
        "primary_insights": ["cost_recovery", "efficiency"],
        "secondary_insights": ["sourcing", "revenue_growth"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": False,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Insights: Prioritize cost recovery and efficiency improvements. Decision Matrix: Selective investment with strong ROI, maintain spending, pursue alternative funding."
    },
    14: {
        "name": "High Impact + High Cost + Low Mandate + High Reliance",
        "preferred_recommendation": "Sustain core service; seek efficiency and alternative funding.",
        "primary_insights": ["efficiency", "cost_recovery"],
        "secondary_insights": ["sourcing"],
        "decision_matrix": {
            "invest_more": True,
            "reduce_spending": False,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Insights: Focus on efficiency and cost recovery. Decision Matrix: Selective GF investment with ROI, maintain or grow cautiously, pursue alternative funding."
    },
    15: {
        "name": "High Impact + High Cost + High Mandate + Low Reliance",
        "preferred_recommendation": "Sustain mandate; optimize and seek alternative funding.",
        "primary_insights": ["efficiency", "cost_recovery"],
        "secondary_insights": ["sourcing"],
        "decision_matrix": {
            "invest_more": False,
            "reduce_spending": False,
            "shift_from_GF": True,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Insights: Prioritize efficiency and cost recovery. Decision Matrix: Invest for mandate compliance, maintain spending, pursue alternative funding."
    },
    16: {
        "name": "High Impact + High Cost + High Mandate + High Reliance",
        "preferred_recommendation": "Core mission-critical; protect and optimize.",
        "primary_insights": ["efficiency"],
        "secondary_insights": ["cost_recovery"],
        "decision_matrix": {
            "invest_more": True,
            "reduce_spending": False,
            "shift_from_GF": False,
            "avoid_GF": False
        },
        "strategic_guidance": "Strategic Insights: Focus on operational excellence and service optimization. Decision Matrix: Protect from cuts, strategic GF investment, maintain or grow spending as needed."
    }
}

@router.get("/spending-by-priority")
async def get_spending_by_priority(
    dataset_id: str = Query(..., description="Dataset ID"),
    group: str = Query(..., description="Priority group: 'community' or 'governance'"),
    db: Session = Depends(get_db)
):
    """
    Get spending totals grouped by priority.
    Returns list of priorities with their total costs and program counts.
    """
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Query all priorities for this group
    from app.models.models import Priority
    
    priorities = db.query(Priority).filter(
        Priority.dataset_id == dataset_uuid,
        Priority.group == ('Community' if group == 'community' else 'Governance')
    ).all()
    
    results = []
    
    # For each priority, calculate total spending and program count
    for priority in priorities:
        query = db.query(
            func.sum(ProgramCost.total_cost).label('total_cost'),
            func.count(func.distinct(Program.id)).label('program_count')
        ).join(
            ProgramCost,
            Program.id == ProgramCost.program_id
        ).join(
            ProgramPriorityScore,
            and_(
                Program.id == ProgramPriorityScore.program_id,
                ProgramPriorityScore.priority_id == priority.id
            )
        ).filter(
            Program.dataset_id == dataset_uuid,
            ProgramPriorityScore.score_int.isnot(None),
            ProgramPriorityScore.score_int > 0
        )
        
        result = query.first()
        
        if result and result.total_cost and result.total_cost > 0:
            results.append({
                "priority": priority.name,
                "total_cost": float(result.total_cost),
                "program_count": result.program_count
            })
    
    # Sort by total cost descending
    results.sort(key=lambda x: x['total_cost'], reverse=True)
    
    return results

def calculate_program_category(quartile: Optional[int], total_cost: float, median_cost: float, 
                                mandate: Optional[int], reliance: Optional[int]) -> int:
    """
    Calculate PBB category (1-16) based on program attributes.
    
    Category encoding: (Reliance * 1) + (Mandate * 2) + (Cost * 4) + (Impact * 8) + 1
    
    - Impact: Quartile 1-2 = High (1), 3-4 = Low (0) [worth 8 points, splits 1-8 from 9-16]
    - Cost: Above median = High (1), At/below median = Low (0) [worth 4 points]
    - Mandate: Score 3-5 = High (1), 0-2 = Low (0) [worth 2 points]
    - Reliance: Score 3-5 = High (1), 0-2 = Low (0) [worth 1 point]
    
    Category ranges:
    - 1-8: Low Impact programs
    - 9-16: High Impact programs
    - Within each group, Cost creates 1-4 vs 5-8 (or 9-12 vs 13-16)
    
    Examples:
    - Category 1 (LLLL): 0+0+0+0+1 = Low Impact + Low Cost + Low Mandate + Low Reliance
    - Category 5 (HLLL): 0+0+4+0+1 = Low Impact + High Cost + Low Mandate + Low Reliance
    - Category 9 (LHLL): 0+0+0+8+1 = High Impact + Low Cost + Low Mandate + Low Reliance
    - Category 16 (HHHH): 1+2+4+8+1 = High Impact + High Cost + High Mandate + High Reliance
    """
    # Parse quartile from various formats
    quartile_num = 4  # Default to low impact
    
    if quartile is not None:
        try:
            # Try direct integer conversion first
            quartile_num = int(quartile)
        except (ValueError, TypeError):
            # Handle text variations
            quartile_str = str(quartile).lower().strip()
            
            # Check for "Quartile X" format
            if 'quartile 1' in quartile_str or quartile_str == '1':
                quartile_num = 1
            elif 'quartile 2' in quartile_str or quartile_str == '2':
                quartile_num = 2
            elif 'quartile 3' in quartile_str or quartile_str == '3':
                quartile_num = 3
            elif 'quartile 4' in quartile_str or quartile_str == '4':
                quartile_num = 4
            # Check for alignment text
            elif 'most aligned' in quartile_str:
                quartile_num = 1
            elif 'more aligned' in quartile_str:
                quartile_num = 2
            elif 'less aligned' in quartile_str:
                quartile_num = 3
            elif 'least aligned' in quartile_str:
                quartile_num = 4
            else:
                quartile_num = 4  # Default to low impact if unrecognized
    
    # Impact: High (1) if quartile 1-2, Low (0) if quartile 3-4
    impact_bit = 1 if quartile_num <= 2 else 0
    
    # Cost: High (1) if above median, Low (0) if at or below median
    cost_bit = 1 if total_cost > median_cost else 0
    
    # Mandate: High (1) if score 3+, Low (0) if score 0-2
    mandate_val = mandate if mandate is not None else 0
    try:
        mandate_val = int(mandate_val)
    except (ValueError, TypeError):
        mandate_val = 0
    mandate_bit = 1 if mandate_val >= 3 else 0
    
    # Reliance: High (1) if score 3+, Low (0) if score 0-2
    reliance_val = reliance if reliance is not None else 0
    try:
        reliance_val = int(reliance_val)
    except (ValueError, TypeError):
        reliance_val = 0
    reliance_bit = 1 if reliance_val >= 3 else 0
    
    # Calculate category: 1-16
    # Formula based on correct bit weights: (Reliance * 1) + (Mandate * 2) + (Cost * 4) + (Impact * 8) + 1
    # Impact (8) splits Low (1-8) from High (9-16)
    # Cost (4) splits within each impact group
    # Mandate (2) and Reliance (1) create the final 4-way splits
    category = (reliance_bit) + (mandate_bit * 2) + (cost_bit * 4) + (impact_bit * 8) + 1
    
    return category


@router.get("/bubbles/results")
async def get_bubble_chart_data(
    dataset_id: str = Query(...),
    priority: str = Query(...),
    db: Session = Depends(get_db)
):
    """Get bubble chart data for a specific policy priority"""
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Find the priority
    priority_obj = db.query(Priority).filter(
        and_(
            Priority.dataset_id == dataset_uuid,
            Priority.name == priority
        )
    ).first()
    
    if not priority_obj:
        return {"bubbles": [], "priority": priority}
    
    # Query programs with their scores for this priority
    results = db.query(
        Program.id,
        Program.name,
        Program.service_type,
        ProgramCost.total_cost,
        ProgramPriorityScore.score_int
    ).join(ProgramCost).join(ProgramPriorityScore).filter(
        and_(
            Program.dataset_id == dataset_uuid,
            ProgramPriorityScore.priority_id == priority_obj.id
        )
    ).all()
    
    bubbles = []
    for prog_id, prog_name, service_type, total_cost, score in results:
        # Normalize score (assuming 0-4 scale) to 0-1 for shading
        normalized_shade = score / 4.0 if score else 0
        normalized_shade = max(0, min(1, normalized_shade))
        
        bubbles.append({
            "id": prog_id,
            "name": prog_name,
            "service_type": service_type or "Unknown",
            "size": float(total_cost or 0),
            "radius": math.sqrt(abs(float(total_cost or 0))) / 1000,
            "shade": normalized_shade
        })
    
    return {"bubbles": bubbles, "priority": priority}


@router.get("/bubbles/attributes")
async def get_attribute_bubble_data(
    dataset_id: str = Query(...),
    attr: str = Query(..., regex="^(reliance|population_served|demand|cost_recovery|mandate)$"),
    db: Session = Depends(get_db)
):
    """Get bubble chart data for attribute analysis with department and fund info"""
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Query programs with costs and attributes, plus department (user_group) and fund info
    results = db.query(
        Program.id,
        Program.name,
        Program.service_type,
        Program.user_group,
        Program.quartile,
        Program.description,
        ProgramCost.total_cost,
        ProgramAttribute,
        LineItem.fund
    ).join(ProgramCost).join(ProgramAttribute).outerjoin(
        LineItem, LineItem.program_id == Program.id
    ).filter(
        Program.dataset_id == dataset_uuid
    ).all()
    
    # Aggregate data by program (since a program can have multiple line items)
    program_data = {}
    for prog_id, prog_name, service_type, user_group, quartile, description, total_cost, attributes, fund in results:
        if prog_id not in program_data:
            # Get the attribute value based on the requested attribute
            attr_value = getattr(attributes, attr, 0) or 0
            
            # Normalize attribute value (assuming 1-5 scale) to 0-1 for shading
            normalized_shade = (attr_value - 1) / 4.0 if attr_value > 0 else 0
            normalized_shade = max(0, min(1, normalized_shade))
            
            program_data[prog_id] = {
                "id": prog_id,
                "name": prog_name,
                "service_type": service_type or "Unknown",
                "department": user_group or service_type or "Unknown",
                "org_unit": user_group or "Unknown",
                "description": description or "",
                "size": float(total_cost or 0),
                "radius": math.sqrt(abs(float(total_cost or 0))) / 1000,
                "shade": normalized_shade,
                "attribute_value": attr_value,
                "funds": set()
            }
        
        # Add fund to the set of funds for this program
        if fund:
            program_data[prog_id]["funds"].add(fund)
    
    # Convert funds sets to lists for JSON serialization
    bubbles = []
    for prog_data in program_data.values():
        prog_data["funds"] = sorted(list(prog_data["funds"]))
        bubbles.append(prog_data)
    
    return {"bubbles": bubbles, "shaded_by": attr}

@router.get("/bubbles/costing")
async def get_costing_bubble_data(
    dataset_id: str = Query(...),
    mode: str = Query(..., regex="^(fte|personnel|nonpersonnel|fee_recovery)$"),
    db: Session = Depends(get_db)
):
    """Get bubble chart data for Costing view - different shading modes"""
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Query programs with costs
    results = db.query(
        Program.id,
        Program.name,
        Program.fte,
        ProgramCost.total_cost,
        ProgramCost.personnel,
        ProgramCost.nonpersonnel,
        ProgramCost.revenue
    ).join(ProgramCost).filter(Program.dataset_id == dataset_uuid).all()
    
    bubbles = []
    for prog_id, prog_name, fte, total_cost, personnel, nonpersonnel, revenue in results:
        total_cost_val = float(total_cost or 0)
        personnel_val = float(personnel or 0)
        nonpersonnel_val = float(nonpersonnel or 0)
        revenue_val = float(revenue or 0)
        fte_val = float(fte or 0)
        
        # Calculate shade based on mode
        if mode == "fte":
            # Shade by FTE intensity (normalize by some reasonable scale)
            shade = min(1.0, fte_val / 20.0) if fte_val > 0 else 0
        elif mode == "personnel":
            # Shade by personnel cost percentage
            shade = personnel_val / total_cost_val if total_cost_val > 0 else 0
        elif mode == "nonpersonnel":
            # Shade by non-personnel cost percentage
            shade = nonpersonnel_val / total_cost_val if total_cost_val > 0 else 0
        elif mode == "fee_recovery":
            # Shade by fee recovery opportunity (1 - revenue/total_cost)
            recovery_rate = revenue_val / total_cost_val if total_cost_val > 0 else 0
            shade = 1 - recovery_rate  # Higher shade = more opportunity
        else:
            shade = 0.5
        
        bubbles.append({
            "id": prog_id,
            "name": prog_name,
            "size": total_cost_val,
            "radius": math.sqrt(total_cost_val) / 1000,
            "shade": max(0, min(1, shade)),
            "fte": fte_val,
            "personnel_pct": personnel_val / total_cost_val if total_cost_val > 0 else 0,
            "nonpersonnel_pct": nonpersonnel_val / total_cost_val if total_cost_val > 0 else 0,
            "recovery_rate": revenue_val / total_cost_val if total_cost_val > 0 else 0
        })
    
    return {"bubbles": bubbles, "mode": mode}

@router.get("/program-categories")
async def get_program_categories(
    dataset_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get all programs with their calculated PBB categories (1-16) plus department and fund info.
    
    Categories are based on:
    - Impact (High/Low): Quartile 1-2 = High, 3-4 = Low
    - Cost (High/Low): Above median = High, At/below median = Low
    - Mandate (High/Low): Score 3-4 = High, 0-2 = Low
    - Reliance (High/Low): Score 3-4 = High, 0-2 = Low
    """
    
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset_id format")
    
    # Query all programs with their attributes, costs, user_groups (departments), and funds
    programs = db.query(
        Program.id,
        Program.name,
        Program.quartile,
        Program.service_type,
        Program.user_group,
        Program.description,
        ProgramCost.total_cost,
        ProgramCost.revenue,
        ProgramAttribute.mandate,
        ProgramAttribute.reliance,
        ProgramAttribute.demand,
        ProgramAttribute.cost_recovery,
        ProgramAttribute.population_served,
        LineItem.fund
    ).join(ProgramCost).outerjoin(ProgramAttribute).outerjoin(
        LineItem, LineItem.program_id == Program.id
    ).filter(
        Program.dataset_id == dataset_uuid
    ).all()
    
    if not programs:
        return {"programs": [], "categories": PBB_CATEGORIES}
    
    # Calculate median cost
    unique_programs = {}
    for p in programs:
        if p.id not in unique_programs:
            unique_programs[p.id] = p
    
    costs = [float(p.total_cost or 0) for p in unique_programs.values() if p.total_cost]
    median_cost = statistics.median(costs) if costs else 0
    
    # Build result with categories, aggregating by program
    program_data = {}
    category_counts = {i: 0 for i in range(1, 17)}
    
    for prog in programs:
        if prog.id not in program_data:
            category_num = calculate_program_category(
                quartile=prog.quartile,
                total_cost=float(prog.total_cost or 0),
                median_cost=median_cost,
                mandate=prog.mandate,
                reliance=prog.reliance
            )
            
            category_counts[category_num] += 1
            
            program_data[prog.id] = {
                "id": prog.id,
                "name": prog.name,
                "quartile": prog.quartile,
                "service_type": prog.service_type or "Unknown",
                "department": prog.user_group or prog.service_type or "Unknown",
                "org_unit": prog.user_group or "Unknown",
                "description": prog.description or "",
                "total_cost": float(prog.total_cost or 0),
                "revenue": float(prog.revenue or 0),
                "mandate": prog.mandate,
                "reliance": prog.reliance,
                "demand": prog.demand,
                "cost_recovery": prog.cost_recovery,
                "population_served": prog.population_served,
                "category": category_num,
                "category_info": PBB_CATEGORIES[category_num],
                "funds": set()
            }
        
        # Add fund to the set of funds for this program
        if prog.fund:
            program_data[prog.id]["funds"].add(prog.fund)
    
    # Convert to list and convert funds sets to lists
    result_programs = []
    for prog_data in program_data.values():
        prog_data["funds"] = sorted(list(prog_data["funds"]))
        result_programs.append(prog_data)
    
    return {
        "programs": result_programs,
        "median_cost": median_cost,
        "category_counts": category_counts,
        "categories": PBB_CATEGORIES
    }


@router.get("/taxpayer-dividend")
async def get_taxpayer_dividend(
    dataset_id: str = Query(..., description="Dataset ID"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Calculate taxpayer dividend - per capita costs and return on investment for priorities.
    
    Returns:
    - Per capita total budget
    - Breakdown by priority with per capita costs and alignment scores
    - Program-level per capita costs
    """
    
    # Get dataset
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # For now, use a default population if not set
    # TODO: Add population field to Dataset model
    population = getattr(dataset, 'population', 75000)  # Default to 75k if not set
    
    if population <= 0:
        raise HTTPException(status_code=400, detail="Population must be greater than 0")
    
    # Get total budget
    total_budget = db.query(func.sum(ProgramCost.total_cost)).filter(
        ProgramCost.dataset_id == dataset_id
    ).scalar() or 0
    
    per_capita_total = float(total_budget) / population if population > 0 else 0
    
    # Get priorities with their costs and alignment scores
    priorities = db.query(Priority).filter(
        Priority.dataset_id == dataset_id
    ).all()
    
    priority_data = []
    
    for priority in priorities:
        # Get all programs aligned with this priority
        program_scores = db.query(
            ProgramPriorityScore,
            Program,
            ProgramCost
        ).join(
            Program, ProgramPriorityScore.program_id == Program.id
        ).join(
            ProgramCost, Program.id == ProgramCost.program_id
        ).filter(
            ProgramPriorityScore.priority_id == priority.id,
            ProgramPriorityScore.dataset_id == dataset_id
        ).all()
        
        if not program_scores:
            continue
        
        # WEIGHTED COST CALCULATION based on alignment scores
        # 4 = 100% of cost, 3 = 100%, 2 = 50%, 1 = 25%, 0 = 0%
        def get_weight_multiplier(score: int) -> float:
            weights = {4: 1.0, 3: 1.0, 2: 0.5, 1: 0.25, 0: 0.0}
            return weights.get(score, 0.0)
        
        # Calculate weighted totals for this priority
        priority_total_cost = 0.0
        weighted_program_count = 0.0
        
        for ps in program_scores:
            score = ps.ProgramPriorityScore.score_int or 0
            cost = float(ps.ProgramCost.total_cost or 0)
            weight = get_weight_multiplier(score)
            
            priority_total_cost += cost * weight
            
            # Only count programs with score >= 2 towards program count
            if score >= 2:
                weighted_program_count += weight
        
        priority_per_capita = priority_total_cost / population
        
        # Calculate average alignment score (only for programs with score >= 2)
        relevant_scores = [ps.ProgramPriorityScore.score_int for ps in program_scores 
                          if ps.ProgramPriorityScore.score_int is not None and ps.ProgramPriorityScore.score_int >= 2]
        avg_alignment = sum(relevant_scores) / len(relevant_scores) if relevant_scores else 0
        
        # Get program details (only include programs with meaningful alignment: score >= 2)
        programs = []
        for ps in program_scores:
            prog = ps.Program
            cost = ps.ProgramCost
            score = ps.ProgramPriorityScore
            
            # Skip programs with low alignment (0 or 1)
            if (score.score_int or 0) < 2:
                continue
            
            weight = get_weight_multiplier(score.score_int or 0)
            weighted_cost = float(cost.total_cost or 0) * weight
            
            programs.append({
                "id": prog.id,
                "name": prog.name,
                "description": prog.description,
                "total_cost": float(cost.total_cost or 0),
                "weighted_cost": weighted_cost,
                "per_capita_cost": weighted_cost / population,
                "alignment_score": score.score_int,
                "alignment_label": score.score_label
            })
        
        # Sort programs by per capita cost (highest first)
        programs.sort(key=lambda x: x['per_capita_cost'], reverse=True)
        
        priority_data.append({
            "id": priority.id,
            "name": priority.name,
            "group": priority.group,
            "total_cost": priority_total_cost,
            "per_capita_cost": priority_per_capita,
            "program_count": int(weighted_program_count),  # Round down to nearest integer
            "avg_alignment": round(avg_alignment, 2),
            "programs": programs,
            "weighting_note": "Costs weighted by alignment: 100% for scores 3-4, 50% for score 2, 25% for score 1, 0% for score 0"
        })
    
    # Sort priorities by per capita cost (highest first)
    priority_data.sort(key=lambda x: x['per_capita_cost'], reverse=True)
    
    # Split into community and governance
    community_priorities = [p for p in priority_data if p['group'] == 'Community']
    governance_priorities = [p for p in priority_data if p['group'] == 'Governance']
    
    # Calculate totals
    community_total = sum(p['per_capita_cost'] for p in community_priorities)
    governance_total = sum(p['per_capita_cost'] for p in governance_priorities)
    
    # Calculate total priority value (sum of all priority per capita costs)
    # This can exceed per_capita_total because programs contribute to multiple priorities
    total_priority_value = sum(p['per_capita_cost'] for p in priority_data)
    
    # Calculate leverage ratio - how much value is created across all priorities
    # compared to the per capita investment
    leverage_ratio = total_priority_value / per_capita_total if per_capita_total > 0 else 1.0
    
    return {
        "dataset_id": dataset_id,
        "dataset_name": dataset.name,
        "population": population,
        "total_budget": float(total_budget),
        "per_capita_total": round(per_capita_total, 2),
        "leverage_ratio": round(leverage_ratio, 2),
        "total_priority_value": round(total_priority_value, 2),
        "community_priorities": {
            "total_per_capita": round(community_total, 2),
            "priorities": community_priorities
        },
        "governance_priorities": {
            "total_per_capita": round(governance_total, 2),
            "priorities": governance_priorities
        }
    }