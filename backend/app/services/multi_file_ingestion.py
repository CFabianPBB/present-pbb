import pandas as pd
import logging
import traceback
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.models.models import (
    Dataset, Program, ProgramCost, OrgUnit, LineItem, 
    Priority, ProgramPriorityScore, ProgramAttribute
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MultiFileIngestionService:
    def __init__(self, db: Session):
        self.db = db
        
    def process_costs_and_scores_files(
        self, 
        costs_file_bytes: bytes, 
        scores_file_bytes: bytes, 
        dataset_name: str,
        population: int = 75000
    ) -> Dict[str, Any]:
        """Process both the Program Costs and Program Scores files"""
        
        logger.info(f"Starting multi-file ingestion for dataset: {dataset_name}")
        
        try:
            # Create dataset
            logger.info("Creating dataset...")
            dataset = Dataset(name=dataset_name, population=population)
            self.db.add(dataset)
            self.db.flush()
            logger.info(f"Dataset created with ID: {dataset.id}")
            
            counts = {}
            
            # Process Program Costs file
            logger.info("Processing Program Costs file...")
            costs_counts, program_id_map = self._process_costs_file(costs_file_bytes, dataset.id)
            counts.update(costs_counts)
            
            # Process Program Scores file  
            logger.info("Processing Program Scores file...")
            scores_counts = self._process_scores_file(scores_file_bytes, dataset.id, program_id_map)
            counts.update(scores_counts)
            
            # Commit transaction
            logger.info("Committing database transaction...")
            self.db.commit()
            logger.info("Transaction committed successfully!")
            
            return {
                "dataset_id": str(dataset.id),
                "population": population,
                "counts": counts,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Critical error in multi-file processing: {e}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            
            try:
                self.db.rollback()
                logger.info("Transaction rolled back")
            except Exception as rollback_error:
                logger.error(f"Error during rollback: {rollback_error}")
            
            raise
    
    def _process_costs_file(self, file_bytes: bytes, dataset_id: str) -> tuple[Dict[str, int], Dict[int, int]]:
        """Process the Program Costs Revenue file"""
        logger.info("Reading Program Costs file...")
        
        counts = {
            "programs": 0,
            "program_costs": 0,
            "org_units": 0,
            "line_items": 0
        }
        
        try:
            # Read all sheets
            excel_data = pd.ExcelFile(file_bytes)
            logger.info(f"Costs file sheets: {excel_data.sheet_names}")
            
            # 1. Process Programs sheet (handle multiple possible names)
            programs_sheet_name = None
            possible_names = ["Programs", "Programs or Services"]
            for name in possible_names:
                if name in excel_data.sheet_names:
                    programs_sheet_name = name
                    break
            
            if programs_sheet_name:
                logger.info(f"Processing {programs_sheet_name} sheet...")
                programs_df = pd.read_excel(file_bytes, sheet_name=programs_sheet_name)
                logger.info(f"{programs_sheet_name} sheet: {len(programs_df)} rows")
                
                # Track mapping from Excel program_id to database-generated ID
                program_id_map = {}
                
                for idx, row in programs_df.iterrows():
                    try:
                        external_program_id = self._safe_int(row.get('program_id'))
                        if not external_program_id:
                            logger.warning(f"Skipping program row {idx} - no program_id")
                            continue
                        
                        # Create program - let database auto-generate the ID
                        program = Program(
                            # NO id= parameter here - database will auto-generate
                            dataset_id=dataset_id,
                            name=self._safe_string(row.get('Program', '')),
                            description=self._safe_string(row.get('Description', '')),
                            service_type="",  # Will be filled from scores file
                            user_group="",
                            quartile="",
                            final_score=None,  # Will be filled from scores file
                            fte=self._safe_float(row.get('FTE', 0)),
                            budget_label="",
                            year=2025
                        )
                        
                        self.db.add(program)
                        self.db.flush()  # Flush to get the auto-generated ID
                        
                        # Store the mapping from external ID to database ID
                        program_id_map[external_program_id] = program.id
                        
                        # Create program cost using database-generated ID
                        personnel = self._safe_decimal(row.get('Personnel', 0))
                        nonpersonnel = self._safe_decimal(row.get('NonPersonnel', 0))
                        revenue = self._safe_decimal(row.get('Revenue', 0))
                        total_cost = self._safe_decimal(row.get('Total Program Cost', 0))
                        
                        cost = ProgramCost(
                            dataset_id=dataset_id,
                            program_id=program.id,  # Use database-generated ID
                            personnel=personnel,
                            nonpersonnel=nonpersonnel,
                            revenue=revenue,
                            total_cost=total_cost
                        )
                        
                        self.db.add(cost)
                        counts["programs"] += 1
                        counts["program_costs"] += 1
                        
                        logger.debug(f"Created program {program.id} (external ID: {external_program_id}): {program.name}")
                        
                    except Exception as e:
                        logger.error(f"Error processing program row {idx}: {e}")
                        logger.error(f"Row data: {dict(row)}")
                        raise
            else:
                raise ValueError(f"No Programs sheet found. Available sheets: {excel_data.sheet_names}. Expected one of: {possible_names}")
            
            # 2. Process allocation sheets for line items
            if "Allocations_Cost" in excel_data.sheet_names:
                logger.info("Processing Cost Allocations...")
                allocations_df = pd.read_excel(file_bytes, sheet_name="Allocations_Cost")
                logger.info(f"Cost allocations sheet: {len(allocations_df)} rows")
                
                # Create org units from allocations
                org_units_map = self._create_org_units_from_allocations(allocations_df, dataset_id)
                counts["org_units"] = len(org_units_map)
                
                # Create line items from allocations
                for idx, row in allocations_df.iterrows():
                    try:
                        external_program_id = self._safe_int(row.get('program_id'))
                        if not external_program_id:
                            continue
                        
                        # Map external program ID to database ID
                        db_program_id = program_id_map.get(external_program_id)
                        if not db_program_id:
                            logger.warning(f"Program {external_program_id} not found in program_id_map, skipping line item")
                            continue
                        
                        # Get org unit
                        division = self._safe_string(row.get('Division', ''))
                        org_unit_id = org_units_map.get(division)
                        
                        line_item = LineItem(
                            dataset_id=dataset_id,
                            program_id=db_program_id,  # Use database-generated ID
                            org_unit_id=org_unit_id,
                            cost_type=self._safe_string(row.get('ObjectType', '')),
                            acct_type=self._safe_string(row.get('Item Category 1', '')),
                            acct_number=self._safe_string(row.get('Account Number', '')),
                            fund=self._safe_string(row.get('Fund', '')),
                            item_cat1=self._safe_string(row.get('Item Category 1', '')),
                            item_cat2=self._safe_string(row.get('Item Category 2', '')),
                            num_items=self._safe_int(row.get('NumberOfItems', 1)),
                            total_item_cost=self._safe_decimal(row.get('Total Item Cost', 0)),
                            allocation_pct=self._safe_decimal(row.get('Allocation', 0)),
                            year=2025,
                            budget_label=""
                        )
                        
                        self.db.add(line_item)
                        counts["line_items"] += 1
                        
                    except Exception as e:
                        logger.error(f"Error processing allocation row {idx}: {e}")
                        logger.error(f"Row data: {dict(row)}")
                        raise
            
            logger.info(f"Costs file processing complete: {counts}")
            return counts, program_id_map
            
        except Exception as e:
            logger.error(f"Error processing costs file: {e}")
            raise
    
    def _process_scores_file(self, file_bytes: bytes, dataset_id: str, program_id_map: Dict[int, int]) -> Dict[str, int]:
        """Process the Program Scores file"""
        logger.info("Reading Program Scores file...")
        
        counts = {
            "programs_updated": 0,
            "priorities": 0,
            "priority_scores": 0,
            "attributes": 0
        }
        
        try:
            excel_data = pd.ExcelFile(file_bytes)
            logger.info(f"Scores file sheets: {excel_data.sheet_names}")
            
            # Process Summary sheet for basic program updates
            if "Summary" in excel_data.sheet_names:
                logger.info("Processing Summary sheet...")
                summary_df = pd.read_excel(file_bytes, sheet_name="Summary")
                logger.info(f"Summary sheet: {len(summary_df)} rows")
                
                for idx, row in summary_df.iterrows():
                    try:
                        external_program_id = self._safe_int(row.get('program_id'))
                        if not external_program_id:
                            continue
                        
                        # Map external program ID to database ID
                        db_program_id = program_id_map.get(external_program_id)
                        if not db_program_id:
                            logger.warning(f"Program {external_program_id} not found in program_id_map, skipping")
                            continue
                        
                        # Update existing program with score data
                        program = self.db.query(Program).filter(
                            Program.id == db_program_id,  # Use database ID
                            Program.dataset_id == dataset_id
                        ).first()
                        
                        if program:
                            program.service_type = self._safe_string(row.get('ServiceType', ''))
                            # Try multiple possible column names for user_group/department
                            user_group_value = (
                                row.get('Cost Center', '') or 
                                row.get('UserGroup', '') or 
                                row.get('User Group', '') or 
                                row.get('Department', '') or 
                                ''
                            )
                            program.user_group = self._safe_string(user_group_value)
                            program.final_score = self._safe_float(row.get('Final Score'))
                            program.quartile = self._safe_string(row.get('FinalQuartile', ''))
                            counts["programs_updated"] += 1
                            
                    except Exception as e:
                        logger.error(f"Error updating program from summary row {idx}: {e}")
                        raise
            
            # Process Score sheet for priorities and scores
            if "Score" in excel_data.sheet_names:
                logger.info("Processing Score sheet for priorities and scores...")
                score_df = pd.read_excel(file_bytes, sheet_name="Score")
                logger.info(f"Score sheet: {len(score_df)} rows")
                
                # Extract program attributes from Score sheet (PBB dimensions like Reliance, Demand, etc.)
                counts["attributes"] = self._extract_program_attributes(score_df, dataset_id, program_id_map)
                
                # Create priorities and priority scores from the actual Score sheet data
                priority_counts = self._create_priorities_from_score_sheet(score_df, dataset_id, program_id_map)
                counts.update(priority_counts)
            
            logger.info(f"Scores file processing complete: {counts}")
            return counts
            
        except Exception as e:
            logger.error(f"Error processing scores file: {e}")
            raise
    
    def _create_org_units_from_allocations(self, df: pd.DataFrame, dataset_id: str) -> Dict[str, int]:
        """Create organization units from allocation data"""
        org_units_map = {}
        
        try:
            # Check if Division column exists (some datasets may not have it)
            if 'Division' not in df.columns:
                logger.info("No 'Division' column found in allocations - skipping org unit creation")
                return org_units_map
            
            # Get unique divisions
            unique_divisions = df['Division'].dropna().unique()
            logger.info(f"Creating {len(unique_divisions)} organization units")
            
            for division in unique_divisions:
                division_clean = self._safe_string(division)
                if division_clean and division_clean not in org_units_map:
                    org_unit = OrgUnit(
                        dataset_id=dataset_id,
                        department="",  # Could extract from COF Section if needed
                        division=division_clean,
                        activity=""
                    )
                    self.db.add(org_unit)
                    self.db.flush()
                    org_units_map[division_clean] = org_unit.id
                    logger.debug(f"Created org unit: {division_clean}")
            
            return org_units_map
            
        except Exception as e:
            logger.error(f"Error creating org units: {e}")
            raise
    
    def _extract_program_attributes(self, score_df: pd.DataFrame, dataset_id: str, program_id_map: Dict[int, int]) -> int:
        """Extract program attributes from the Score sheet"""
        logger.info("Extracting program attributes from Score sheet...")
        count = 0
        
        try:
            # Group by external program_id to get all attributes for each program
            programs_with_attributes = {}
            
            for idx, row in score_df.iterrows():
                try:
                    external_program_id = self._safe_int(row.get('program_id'))
                    result_abbr = self._safe_string(row.get('Result Abbr', ''))
                    final_score = self._safe_int(row.get('Final Score', 0))
                    
                    if not external_program_id or not result_abbr:
                        continue
                    
                    if external_program_id not in programs_with_attributes:
                        programs_with_attributes[external_program_id] = {}
                    
                    # Map the Result Abbr to our attribute fields
                    if result_abbr == 'Reliance':
                        programs_with_attributes[external_program_id]['reliance'] = final_score
                    elif result_abbr == 'Demand':
                        programs_with_attributes[external_program_id]['demand'] = final_score
                    elif result_abbr == 'Cost Recovery':
                        programs_with_attributes[external_program_id]['cost_recovery'] = final_score
                    elif result_abbr == 'Mandate':
                        programs_with_attributes[external_program_id]['mandate'] = final_score
                    elif result_abbr == 'CapacitytoServe':
                        programs_with_attributes[external_program_id]['population_served'] = final_score
                    
                except Exception as e:
                    logger.error(f"Error processing attribute row {idx}: {e}")
                    continue
            
            # Create ProgramAttribute records
            for external_program_id, attributes in programs_with_attributes.items():
                try:
                    # Map external program ID to database ID
                    db_program_id = program_id_map.get(external_program_id)
                    if not db_program_id:
                        logger.warning(f"Program {external_program_id} not found in program_id_map")
                        continue
                    
                    # Check if this program exists in our dataset
                    program_exists = self.db.query(Program).filter(
                        Program.id == db_program_id,  # Use database ID
                        Program.dataset_id == dataset_id
                    ).first()
                    
                    if not program_exists:
                        logger.warning(f"Program {external_program_id} not found in dataset")
                        continue
                    
                    # Create the program attribute record
                    program_attr = ProgramAttribute(
                        dataset_id=dataset_id,
                        program_id=db_program_id,  # Use database ID
                        reliance=attributes.get('reliance'),
                        population_served=attributes.get('population_served'),
                        demand=attributes.get('demand'),
                        cost_recovery=attributes.get('cost_recovery'),
                        mandate=attributes.get('mandate')
                    )
                    
                    self.db.add(program_attr)
                    count += 1
                    logger.debug(f"Created attributes for program {db_program_id} (external ID: {external_program_id})")
                    
                except Exception as e:
                    logger.error(f"Error creating attributes for program {external_program_id}: {e}")
                    continue
            
            logger.info(f"Created {count} program attribute records")
            return count
            
        except Exception as e:
            logger.error(f"Error in _extract_program_attributes: {e}")
            raise
    
    def _create_priorities_from_score_sheet(self, score_df: pd.DataFrame, dataset_id: str, program_id_map: Dict[int, int]) -> Dict[str, int]:
        """Create priorities and priority scores from the actual Score sheet data"""
        counts = {
            "priorities": 0,
            "priority_scores": 0
        }
        
        try:
            # Filter out BPAs using the Result Type column
            # Only keep rows where Result Type is 'Community' or 'Governance'
            priority_rows = score_df[score_df['Result Type'].isin(['Community', 'Governance'])]
            
            # Get unique Result Abbr values with their Result Type
            unique_priorities = priority_rows[['Result Abbr', 'Result Type']].drop_duplicates()
            
            logger.info(f"Found {len(unique_priorities)} unique priority dimensions from Result Type column:")
            for _, row in unique_priorities.iterrows():
                logger.info(f"  - {row['Result Abbr']} ({row['Result Type']})")
            
            # Create Priority records for each unique Result Abbr
            priorities_map = {}
            for _, row in unique_priorities.iterrows():
                result_name = self._safe_string(row['Result Abbr'])
                result_type = self._safe_string(row['Result Type'])
                
                if not result_name or not result_type:
                    continue
                
                priority = Priority(
                    dataset_id=dataset_id,
                    name=result_name,
                    group=result_type  # Use the actual Result Type value ('Community' or 'Governance')
                )
                self.db.add(priority)
                self.db.flush()
                
                priorities_map[result_name] = priority.id
                counts["priorities"] += 1
                logger.info(f"Created priority: {result_name} (group: {result_type})")
            
            # Now create ProgramPriorityScore records from the actual scores
            # Only process Community and Governance rows (BPAs already filtered out)
            for idx, row in priority_rows.iterrows():
                try:
                    external_program_id = self._safe_int(row.get('program_id'))
                    result_name = self._safe_string(row.get('Result Abbr', ''))
                    final_score = self._safe_int(row.get('Final Score'))
                    
                    if not external_program_id or not result_name:
                        continue
                    
                    # Map external program ID to database ID
                    db_program_id = program_id_map.get(external_program_id)
                    if not db_program_id:
                        continue
                    
                    # Get the priority ID for this result
                    priority_id = priorities_map.get(result_name)
                    if not priority_id:
                        continue
                    
                    # Skip if score is None/null
                    if final_score is None:
                        continue
                    
                    # Create the priority score record
                    # Convert 0-4 score to label
                    score_labels = {
                        0: "No Alignment (0)",
                        1: "Low Alignment (1)", 
                        2: "Medium Alignment (2)",
                        3: "High Alignment (3)",
                        4: "Very High Alignment (4)"
                    }
                    score_label = score_labels.get(final_score, f"Score: {final_score}")
                    
                    priority_score = ProgramPriorityScore(
                        dataset_id=dataset_id,
                        program_id=db_program_id,
                        priority_id=priority_id,
                        score_int=final_score,  # Store the actual 0-4 score
                        score_label=score_label
                    )
                    
                    self.db.add(priority_score)
                    counts["priority_scores"] += 1
                    
                except Exception as e:
                    logger.error(f"Error processing score row {idx}: {e}")
                    continue
            
            logger.info(f"Created {counts['priorities']} priorities and {counts['priority_scores']} priority scores from Score sheet")
            return counts
            
        except Exception as e:
            logger.error(f"Error in _create_priorities_from_score_sheet: {e}")
            raise
    
    def _assign_program_to_priorities(self, program: Program, priorities_map: Dict[str, int]) -> Dict[str, Dict]:
        """THIS FUNCTION IS NO LONGER USED - Priorities now come from Excel Score sheet"""
        # Keeping for backwards compatibility but not called anymore
        return {}
        """Create priorities and assign programs based on their Final Score and characteristics"""
        counts = {"priorities": 0, "priority_scores": 0}
        
        try:
            # Create priorities
            priorities_data = [
                ("Community Safety", "Community"),
                ("Community Development", "Community"),
                ("Infrastructure & Asset Management", "Community"),
                ("Sustainable Community", "Community"),
                ("Quality of Place", "Community"),
                ("Responsible Government", "Governance"),
                ("Fiscal Stewardship", "Governance")
            ]
            
            priorities_map = {}
            for priority_name, group in priorities_data:
                try:
                    priority = Priority(
                        dataset_id=dataset_id,
                        name=priority_name,
                        group=group
                    )
                    self.db.add(priority)
                    self.db.flush()
                    priorities_map[priority_name] = priority.id
                    counts["priorities"] += 1
                    logger.debug(f"Created priority: {priority_name}")
                    
                except Exception as e:
                    logger.error(f"Error creating priority '{priority_name}': {e}")
                    continue
            
            # Get all programs with their final scores and service types
            programs = self.db.query(Program).filter(
                Program.dataset_id == dataset_id
            ).all()
            
            logger.info(f"Creating priority scores for {len(programs)} programs")
            
            for program in programs:
                try:
                    # Assign programs to priorities based on service type and final score
                    priority_assignments = self._assign_program_to_priorities(
                        program, priorities_map
                    )
                    
                    for priority_name, score_info in priority_assignments.items():
                        if priority_name in priorities_map:
                            score = ProgramPriorityScore(
                                dataset_id=dataset_id,
                                program_id=program.id,
                                priority_id=priorities_map[priority_name],
                                score_int=score_info['score'],
                                score_label=score_info['label']
                            )
                            self.db.add(score)
                            counts["priority_scores"] += 1
                            
                except Exception as e:
                    logger.error(f"Error creating priority scores for program {program.id}: {e}")
                    continue
            
            logger.info(f"Created {counts['priorities']} priorities and {counts['priority_scores']} priority scores")
            return counts
            
        except Exception as e:
            logger.error(f"Error in _create_realistic_priorities_from_final_scores: {e}")
            raise
    
    def _assign_program_to_priorities(self, program: Program, priorities_map: Dict[str, int]) -> Dict[str, Dict]:
        """Assign a program to priorities based on its characteristics and final score"""
        assignments = {}
        
        # Use final score as base alignment (normalize 0-100 to 1-5 scale)
        base_score = int((program.final_score or 30) / 20) + 1  # Convert 0-100 to 1-5
        base_score = max(1, min(5, base_score))  # Ensure 1-5 range
        
        # Assign programs to priorities based on service type and other characteristics
        service_type = (program.service_type or "").lower()
        program_name = (program.name or "").lower()
        
        # Community Safety - programs related to safety, police, fire, emergency
        if any(keyword in program_name for keyword in ['police', 'fire', 'emergency', 'safety', 'security', 'enforcement']):
            assignments["Community Safety"] = {
                'score': min(5, base_score + 1),
                'label': f"High Safety Alignment ({min(5, base_score + 1)})"
            }
        else:
            assignments["Community Safety"] = {
                'score': max(1, base_score - 1),
                'label': f"Low Safety Alignment ({max(1, base_score - 1)})"
            }
        
        # Infrastructure & Asset Management
        if any(keyword in program_name for keyword in ['infrastructure', 'maintenance', 'asset', 'facility', 'building', 'road', 'water', 'sewer']):
            assignments["Infrastructure & Asset Management"] = {
                'score': min(5, base_score + 1),
                'label': f"High Infrastructure Alignment ({min(5, base_score + 1)})"
            }
        else:
            assignments["Infrastructure & Asset Management"] = {
                'score': base_score,
                'label': f"Medium Infrastructure Alignment ({base_score})"
            }
        
        # Community Development
        if any(keyword in program_name for keyword in ['development', 'housing', 'planning', 'zoning', 'community']):
            assignments["Community Development"] = {
                'score': min(5, base_score + 1),
                'label': f"High Development Alignment ({min(5, base_score + 1)})"
            }
        else:
            assignments["Community Development"] = {
                'score': base_score,
                'label': f"Medium Development Alignment ({base_score})"
            }
        
        # Sustainable Community
        if any(keyword in program_name for keyword in ['environment', 'sustainability', 'green', 'energy', 'climate']):
            assignments["Sustainable Community"] = {
                'score': min(5, base_score + 1),
                'label': f"High Sustainability Alignment ({min(5, base_score + 1)})"
            }
        else:
            assignments["Sustainable Community"] = {
                'score': max(1, base_score - 1),
                'label': f"Low Sustainability Alignment ({max(1, base_score - 1)})"
            }
        
        # Quality of Place
        if any(keyword in program_name for keyword in ['park', 'recreation', 'culture', 'art', 'library', 'quality']):
            assignments["Quality of Place"] = {
                'score': min(5, base_score + 1),
                'label': f"High Quality Alignment ({min(5, base_score + 1)})"
            }
        else:
            assignments["Quality of Place"] = {
                'score': base_score,
                'label': f"Medium Quality Alignment ({base_score})"
            }
        
        # Responsible Government
        if service_type == 'governance' or any(keyword in program_name for keyword in ['admin', 'management', 'governance', 'council', 'clerk']):
            assignments["Responsible Government"] = {
                'score': min(5, base_score + 1),
                'label': f"High Government Alignment ({min(5, base_score + 1)})"
            }
        else:
            assignments["Responsible Government"] = {
                'score': base_score,
                'label': f"Medium Government Alignment ({base_score})"
            }
        
        # Fiscal Stewardship
        if any(keyword in program_name for keyword in ['finance', 'budget', 'fiscal', 'revenue', 'tax', 'accounting']):
            assignments["Fiscal Stewardship"] = {
                'score': min(5, base_score + 1),
                'label': f"High Fiscal Alignment ({min(5, base_score + 1)})"
            }
        else:
            assignments["Fiscal Stewardship"] = {
                'score': max(1, base_score - 1),
                'label': f"Low Fiscal Alignment ({max(1, base_score - 1)})"
            }
        
        return assignments
    
    # Helper methods
    def _safe_string(self, value) -> str:
        """Safely convert value to string"""
        if pd.isna(value) or value is None:
            return ''
        return str(value).strip()
    
    def _safe_float(self, value) -> Optional[float]:
        """Safely convert value to float"""
        if pd.isna(value) or value is None or value == '':
            return None
        try:
            if isinstance(value, str):
                cleaned = value.replace(',', '').replace('$', '').replace('%', '').strip()
                return float(cleaned)
            return float(value)
        except (ValueError, TypeError):
            logger.warning(f"Could not convert '{value}' to float")
            return None
    
    def _safe_int(self, value) -> Optional[int]:
        """Safely convert value to int"""
        if pd.isna(value) or value is None or value == '':
            return None
        try:
            if isinstance(value, str):
                cleaned = value.replace(',', '').replace('$', '').strip()
                return int(float(cleaned))
            return int(float(value))
        except (ValueError, TypeError):
            logger.warning(f"Could not convert '{value}' to int")
            return None
    
    def _safe_decimal(self, value):
        """Safely convert value to decimal for database storage"""
        if pd.isna(value) or value is None or value == '':
            return None
        try:
            if isinstance(value, str):
                cleaned = value.replace(',', '').replace('$', '').strip()
                return float(cleaned)
            return float(value)
        except (ValueError, TypeError):
            logger.warning(f"Could not convert '{value}' to decimal")
            return None