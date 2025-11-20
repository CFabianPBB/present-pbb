import pandas as pd
import re
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.models import (
    Dataset, Program, ProgramCost, OrgUnit, LineItem, 
    Priority, ProgramPriorityScore, ProgramAttribute
)

class ExcelIngestionService:
    def __init__(self, db: Session):
        self.db = db
        
    def parse_excel_and_create_dataset(self, file_bytes: bytes, dataset_name: str) -> Dict[str, Any]:
        """Parse Excel file and create a complete dataset"""
        
        # Read Excel file
        excel_data = pd.ExcelFile(file_bytes)
        
        # Create dataset
        dataset = Dataset(name=dataset_name)
        self.db.add(dataset)
        self.db.flush()  # Get the ID
        
        counts = {}
        
        # Parse Programs Inventory sheet
        if "Programs Inventory" in excel_data.sheet_names:
            programs_df = pd.read_excel(file_bytes, sheet_name="Programs Inventory")
            counts["programs"] = self._ingest_programs_inventory(programs_df, dataset.id)
        
        # Parse Details sheet
        if "Details" in excel_data.sheet_names:
            details_df = pd.read_excel(file_bytes, sheet_name="Details")
            detail_counts = self._ingest_details(details_df, dataset.id)
            counts.update(detail_counts)
        
        self.db.commit()
        
        return {
            "dataset_id": str(dataset.id),
            "counts": counts
        }
    
    def _ingest_programs_inventory(self, df: pd.DataFrame, dataset_id: str) -> int:
        """Ingest Programs Inventory sheet"""
        count = 0
        
        for _, row in df.iterrows():
            # Create program
            program = Program(
                id=row.get('program_id'),
                dataset_id=dataset_id,
                name=row.get('Program', ''),
                description=row.get('Program Description', ''),
                service_type=row.get('Service Type', ''),
                user_group=row.get('User Group', ''),
                quartile=row.get('Quartile', ''),
                final_score=self._safe_float(row.get('Final Score')),  # CHANGE THIS
                fte=self._safe_float(row.get('FTE', 0)),               # CHANGE THIS
                budget_label=row.get('Budget', ''),
                year=2025
            )
            
            self.db.add(program)
            
            # Create program costs
            personnel = self._safe_float(row.get('Personnel', 0))      # CHANGE THIS
            nonpersonnel = self._safe_float(row.get('NonPersonnel', 0)) # CHANGE THIS
            revenue = self._safe_float(row.get('Revenue', 0))          # CHANGE THIS
            
            cost = ProgramCost(
                dataset_id=dataset_id,
                program_id=program.id,
                personnel=personnel,
                nonpersonnel=nonpersonnel,
                revenue=revenue,
                total_cost=personnel + nonpersonnel
            )
            self.db.add(cost)
            count += 1
            
        return count
    
    def _ingest_details(self, df: pd.DataFrame, dataset_id: str) -> Dict[str, int]:
        """Ingest Details sheet"""
        counts = {"line_items": 0, "priorities": 0, "attributes": 0}
        
        # Get unique org units
        org_units_map = self._create_org_units(df, dataset_id)
        
        # Process each row
        for _, row in df.iterrows():
            program_id = row.get('program_id')
            if pd.isna(program_id):
                continue
                
            # Create line item
            org_key = (row.get('Department', ''), row.get('Division', ''), '')  # No Activity column
            org_unit_id = org_units_map.get(org_key)
            
            line_item = LineItem(
                dataset_id=dataset_id,
                program_id=int(program_id),
                org_unit_id=org_unit_id,
                cost_type=row.get('Cost Type', ''),
                acct_type=row.get('AcctType', ''),
                acct_number=str(row.get('AcctNumber', '')),  # Make sure this is str()
                fund=row.get('Fund', ''),
                item_cat1=row.get('P/NP category1', ''),
                item_cat2=row.get('P/NP category2', ''),
                num_items=self._safe_int(row.get('NumOfItems')),  # Using helper function
                total_item_cost=self._safe_float(row.get('Total Cost', 0)),  # Using helper function
                allocation_pct=self._safe_float(row.get('Allocation', 0)),  # Using helper function
                year=row.get('Year', 2025),
                budget_label=row.get('Budget', '')
            )
            
            self.db.add(line_item)
            counts["line_items"] += 1
        
        # Process priorities and attributes (first row only for metadata)
        if len(df) > 0:
            first_row = df.iloc[0]
            counts["priorities"] = self._create_priorities_and_scores(df, dataset_id, first_row)
            counts["attributes"] = self._create_attributes(df, dataset_id)
        
        return counts
    
    def _create_org_units(self, df: pd.DataFrame, dataset_id: str) -> Dict[Tuple, int]:
        """Create organization units and return mapping"""
        org_units_map = {}
        unique_orgs = df[['Department', 'Division']].drop_duplicates()  # No Activity column
        
        for _, row in unique_orgs.iterrows():
            org_unit = OrgUnit(
                dataset_id=dataset_id,
                department=row.get('Department', ''),
                division=row.get('Division', ''),
                activity=''  # No activity in your data
            )
            self.db.add(org_unit)
            self.db.flush()  # Get ID
            
            org_key = (row.get('Department', ''), row.get('Division', ''), '')
            org_units_map[org_key] = org_unit.id
            
        return org_units_map
    
    def _create_priorities_and_scores(self, df: pd.DataFrame, dataset_id: str, sample_row: pd.Series) -> int:
        """Create priorities and their scores for all programs"""
        count = 0
        
        # Priority columns mapping - Updated to match your exact data
        priority_columns = {
            'Community Safety': 'Community',
            'Community Development ': 'Community',  # Note: includes trailing space!
            'Infrastructure & Asset Management': 'Community',
            'Sustainable Community': 'Community',
            'Quality of Place': 'Community',
            'Responsible Government': 'Governance',
            'Fiscal Stewardship': 'Governance'
        }
        
        # Create priorities
        priorities_map = {}
        for priority_name, group in priority_columns.items():
            if priority_name in df.columns:
                priority = Priority(
                    dataset_id=dataset_id,
                    name=priority_name.strip(),  # Clean up any trailing spaces
                    group=group
                )
                self.db.add(priority)
                self.db.flush()
                priorities_map[priority_name] = priority.id
                count += 1
        
        # Create scores for each program
        for _, row in df.iterrows():
            program_id = row.get('program_id')
            if pd.isna(program_id):
                continue
                
            for priority_name, priority_id in priorities_map.items():
                score_label = row.get(priority_name, '')
                if pd.isna(score_label) or score_label == '':
                    continue
                    
                # Extract integer from label like "Some (2)" or handle direct values
                score_int = self._extract_score_from_label(str(score_label))
                
                score = ProgramPriorityScore(
                    dataset_id=dataset_id,
                    program_id=int(program_id),
                    priority_id=priority_id,
                    score_int=score_int,
                    score_label=str(score_label)
                )
                self.db.add(score)
        
        return count
    
    def _create_attributes(self, df: pd.DataFrame, dataset_id: str) -> int:
        """Create program attributes"""
        count = 0
        attribute_columns = ['Reliance', 'Population Served', 'Demand', 'Cost Recovery', 'Mandate']
        
        # Get unique programs and their attributes
        program_attrs = df[['program_id'] + attribute_columns].drop_duplicates()
        
        for _, row in program_attrs.iterrows():
            program_id = row.get('program_id')
            if pd.isna(program_id):
                continue
                
            attr = ProgramAttribute(
                dataset_id=dataset_id,
                program_id=int(program_id),
                reliance=self._extract_score_from_label(str(row.get('Reliance', ''))),
                population_served=self._extract_score_from_label(str(row.get('Population Served', ''))),
                demand=self._extract_score_from_label(str(row.get('Demand', ''))),
                cost_recovery=self._extract_score_from_label(str(row.get('Cost Recovery', ''))),
                mandate=self._extract_score_from_label(str(row.get('Mandate', '')))
            )
            self.db.add(attr)
            count += 1
            
        return count
    

    
    def _extract_score_from_label(self, label: str) -> int:
        """Extract integer score from labels like 'Some (2)', 'High (4)', or handle direct numeric values"""
        # Handle parenthetical format like "Some (2)"
        match = re.search(r'\((\d+)\)', label)
        if match:
            return int(match.group(1))
        
        # Handle direct numeric values (in case some cells just have numbers)
        try:
            return int(float(label))
        except (ValueError, TypeError):
            pass
            
        # Default mapping for text values without parentheses
        text_mappings = {
            'none': 0,
            'minor': 1,
            'some': 2,
            'moderate': 3,
            'major': 4,
            'high': 4,
            'low': 1
        }
        
        label_lower = label.lower().strip()
        return text_mappings.get(label_lower, 0)
    
    def _safe_float(self, value) -> float:
        """Safely convert value to float, handling strings and None"""
        if pd.isna(value) or value is None or value == '':
            return 0.0
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0
    
    def _safe_int(self, value) -> int:
        """Safely convert value to int, handling strings and None"""
        if pd.isna(value) or value is None or value == '':
            return 0
        try:
            return int(float(value))  # Convert to float first to handle decimals
        except (ValueError, TypeError):
            return 0