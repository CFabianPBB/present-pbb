from sqlalchemy import Column, Integer, String, Float, Text, Numeric, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.core.database import Base

class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    population = Column(Integer, default=75000)  # Population served by this municipality
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    programs = relationship("Program", back_populates="dataset", cascade="all, delete-orphan")
    priorities = relationship("Priority", back_populates="dataset", cascade="all, delete-orphan")
    org_units = relationship("OrgUnit", back_populates="dataset", cascade="all, delete-orphan")  # ADDED THIS

class Program(Base):
    __tablename__ = "programs"
    
    id = Column(Integer, primary_key=True)  # from program_id in Excel
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    service_type = Column(String)
    user_group = Column(String)
    quartile = Column(String)
    final_score = Column(Float)
    fte = Column(Float, default=0)
    year = Column(Integer)
    budget_label = Column(String)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="programs")
    costs = relationship("ProgramCost", back_populates="program", cascade="all, delete-orphan")
    priority_scores = relationship("ProgramPriorityScore", back_populates="program", cascade="all, delete-orphan")
    attributes = relationship("ProgramAttribute", back_populates="program", cascade="all, delete-orphan")
    line_items = relationship("LineItem", back_populates="program", cascade="all, delete-orphan")

class ProgramCost(Base):
    __tablename__ = "program_costs"
    
    id = Column(Integer, primary_key=True)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False)
    personnel = Column(Numeric(12, 2), default=0)
    nonpersonnel = Column(Numeric(12, 2), default=0)
    revenue = Column(Numeric(12, 2), default=0)
    total_cost = Column(Numeric(12, 2))  # personnel + nonpersonnel
    
    # Relationships
    program = relationship("Program", back_populates="costs")

class OrgUnit(Base):
    __tablename__ = "org_units"
    
    id = Column(Integer, primary_key=True)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    department = Column(String)
    division = Column(String)
    activity = Column(String)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="org_units")  # ADDED THIS
    line_items = relationship("LineItem", back_populates="org_unit", cascade="all, delete-orphan")

class LineItem(Base):
    __tablename__ = "line_items"
    
    id = Column(Integer, primary_key=True)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False)
    org_unit_id = Column(Integer, ForeignKey("org_units.id"))
    cost_type = Column(String)  # Personnel/NonPersonnel
    acct_type = Column(String)
    acct_number = Column(String)
    fund = Column(String)
    item_cat1 = Column(String)
    item_cat2 = Column(String)
    num_items = Column(Integer)
    total_item_cost = Column(Numeric(15, 2))  # Increased precision for larger values
    allocation_pct = Column(Numeric(8, 4))    # Increased precision for percentages
    year = Column(Integer)
    budget_label = Column(String)
    
    # Relationships
    program = relationship("Program", back_populates="line_items")
    org_unit = relationship("OrgUnit", back_populates="line_items")

class Priority(Base):
    __tablename__ = "priorities"
    
    id = Column(Integer, primary_key=True)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    name = Column(String, nullable=False)
    group = Column(String)  # Community/Governance
    
    # Relationships
    dataset = relationship("Dataset", back_populates="priorities")
    program_scores = relationship("ProgramPriorityScore", back_populates="priority", cascade="all, delete-orphan")

class ProgramPriorityScore(Base):
    __tablename__ = "program_priority_scores"
    
    id = Column(Integer, primary_key=True)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False)
    priority_id = Column(Integer, ForeignKey("priorities.id"), nullable=False)
    score_int = Column(Integer)  # extracted number
    score_label = Column(String)  # original label like "Some (2)"
    
    # Relationships
    program = relationship("Program", back_populates="priority_scores")
    priority = relationship("Priority", back_populates="program_scores")

class ProgramAttribute(Base):
    __tablename__ = "attributes"
    
    id = Column(Integer, primary_key=True)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False)
    reliance = Column(Integer)
    population_served = Column(Integer)
    demand = Column(Integer)
    cost_recovery = Column(Integer)
    mandate = Column(Integer)
    
    # Relationships
    program = relationship("Program", back_populates="attributes")