from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Header, Form
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import settings
from app.services.multi_file_ingestion import MultiFileIngestionService
from app.services.ingestion import ExcelIngestionService  # Keep old service for backup
from app.models.models import Dataset
import logging
import traceback
from typing import List

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

async def verify_admin_secret(x_admin_secret: str = Header(...)):
    if x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    return True

@router.post("/upload-multi")
async def upload_multiple_files(
    costs_file: UploadFile = File(..., description="Program Costs Revenue Excel file"),
    scores_file: UploadFile = File(..., description="Program Scores Excel file"),
    dataset_name: str = Form(..., description="Name for the new dataset"),
    population: int = Form(75000, description="Population served by this municipality"),  # ADDED THIS
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_secret)
):
    """Upload and process multiple Excel files to create a complete dataset"""
    
    logger.info(f"Starting multi-file upload for dataset: {dataset_name}")
    logger.info(f"Population: {population}")  # ADDED THIS
    logger.info(f"Costs file: {costs_file.filename} ({costs_file.size} bytes)")
    logger.info(f"Scores file: {scores_file.filename} ({scores_file.size} bytes)")
    
    try:
        # Validate file types
        for file, name in [(costs_file, "costs"), (scores_file, "scores")]:
            if not file.filename.endswith(('.xlsx', '.xls')):
                logger.error(f"Invalid {name} file type: {file.filename}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"{name.title()} file must be Excel format (.xlsx or .xls)"
                )
        
        # Validate file sizes
        max_size = 100 * 1024 * 1024  # 100MB limit for multiple files
        for file, name in [(costs_file, "costs"), (scores_file, "scores")]:
            if file.size and file.size > max_size:
                logger.error(f"{name.title()} file too large: {file.size} bytes")
                raise HTTPException(
                    status_code=400, 
                    detail=f"{name.title()} file too large. Maximum size is 100MB"
                )
        
        # Test database connection
        logger.info("Testing database connection...")
        try:
            db.execute(text("SELECT 1"))
            logger.info("Database connection successful")
        except Exception as db_error:
            logger.error(f"Database connection failed: {db_error}")
            raise HTTPException(
                status_code=500, 
                detail=f"Database connection error: {str(db_error)}"
            )
        
        # Read file contents
        logger.info("Reading file contents...")
        try:
            costs_content = await costs_file.read()
            scores_content = await scores_file.read()
            logger.info(f"Files read successfully:")
            logger.info(f"  Costs: {len(costs_content)} bytes")
            logger.info(f"  Scores: {len(scores_content)} bytes")
        except Exception as read_error:
            logger.error(f"Failed to read file contents: {read_error}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to read files: {str(read_error)}"
            )
        
        # Process with multi-file ingestion service
        logger.info("Starting multi-file ingestion service...")
        try:
            ingestion_service = MultiFileIngestionService(db)
            result = ingestion_service.process_costs_and_scores_files(
                costs_file_bytes=costs_content,
                scores_file_bytes=scores_content,
                dataset_name=dataset_name,
                population=population  # ADDED THIS
            )
            
            logger.info(f"Multi-file ingestion completed successfully: {result}")
            
            return {
                "message": "Files uploaded and processed successfully",
                "dataset_name": dataset_name,
                "population": population,  # ADDED THIS
                "costs_filename": costs_file.filename,
                "scores_filename": scores_file.filename,
                "dataset_id": result.get("dataset_id"),
                "counts": result.get("counts", {}),
                "success": True
            }
            
        except SQLAlchemyError as sql_error:
            logger.error(f"Database error during processing: {sql_error}")
            logger.error(f"SQL Error type: {type(sql_error).__name__}")
            
            if hasattr(sql_error, 'orig'):
                logger.error(f"Original database error: {sql_error.orig}")
                error_detail = str(sql_error.orig)
            else:
                error_detail = str(sql_error)
            
            # Provide specific error messages
            if "duplicate key" in error_detail.lower():
                detail = "Duplicate program IDs detected. Please ensure program IDs are unique across files."
            elif "foreign key" in error_detail.lower():
                detail = "Data relationship error. Program IDs in scores file must match those in costs file."
            elif "not null" in error_detail.lower():
                detail = "Missing required data. Please check all required fields are present."
            else:
                detail = f"Database error: {error_detail}"
                
            raise HTTPException(status_code=500, detail=detail)
            
        except ValueError as value_error:
            logger.error(f"Data validation error: {value_error}")
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid data format: {str(value_error)}"
            )
            
        except Exception as processing_error:
            logger.error(f"Unexpected processing error: {processing_error}")
            logger.error(f"Error type: {type(processing_error).__name__}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            
            # Try to provide specific error messages
            error_msg = str(processing_error).lower()
            if "sheet" in error_msg and ("not found" in error_msg or "missing" in error_msg):
                detail = "Required Excel sheets not found. Please ensure both files have the expected sheet structure."
            elif "column" in error_msg and "not" in error_msg:
                detail = "Expected columns missing from Excel files. Please check the file format."
            elif "pandas" in error_msg or "excel" in error_msg:
                detail = "Excel file format error. Please ensure files are valid Excel files."
            else:
                detail = f"Processing error: {str(processing_error)}"
                
            raise HTTPException(status_code=500, detail=detail)
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except Exception as unexpected_error:
        logger.error(f"Unexpected error in multi-file upload: {unexpected_error}")
        logger.error(f"Error type: {type(unexpected_error).__name__}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        raise HTTPException(
            status_code=500, 
            detail=f"Unexpected server error: {str(unexpected_error)}"
        )

# Keep the original single-file endpoint
@router.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_secret)
):
    """Original single-file upload endpoint (keep working for now)"""
    
    logger.info(f"Single-file upload: {file.filename}")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be Excel format (.xlsx or .xls)")
    
    if file.size and file.size > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB")
    
    try:
        # Read file content
        content = await file.read()
        
        # Process with original ingestion service
        ingestion_service = ExcelIngestionService(db)
        result = ingestion_service.parse_excel_and_create_dataset(
            file_bytes=content,
            dataset_name=file.filename
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.delete("/dataset/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_secret)
):
    """Delete a dataset and all its associated data"""
    
    logger.info(f"Delete request for dataset: {dataset_id}")
    
    try:
        # Find the dataset
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        
        if not dataset:
            logger.warning(f"Dataset not found: {dataset_id}")
            raise HTTPException(
                status_code=404, 
                detail=f"Dataset with ID {dataset_id} not found"
            )
        
        dataset_name = dataset.name
        logger.info(f"Found dataset: {dataset_name}")
        
        # Count related records for logging
        program_count = len(dataset.programs)
        logger.info(f"Dataset has {program_count} programs")
        
        # Delete the dataset (cascade will handle all related data)
        db.delete(dataset)
        db.commit()
        
        logger.info(f"Successfully deleted dataset: {dataset_name} (ID: {dataset_id})")
        
        return {
            "message": f"Dataset '{dataset_name}' deleted successfully",
            "dataset_id": dataset_id,
            "dataset_name": dataset_name,
            "programs_deleted": program_count,
            "success": True
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
        
    except SQLAlchemyError as sql_error:
        logger.error(f"Database error during deletion: {sql_error}")
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Database error while deleting dataset: {str(sql_error)}"
        )
        
    except Exception as e:
        logger.error(f"Unexpected error during deletion: {e}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Error deleting dataset: {str(e)}"
        )

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    try:
        # Test database connection
        result = db.execute(text("SELECT 1 as test")).fetchone()
        
        return {
            "status": "healthy", 
            "database": "connected",
            "query_test": result[0] if result else None
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Health check failed: {str(e)}"
        )